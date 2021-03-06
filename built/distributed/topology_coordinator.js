"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const async = require("async");
const leader = require("./topology_leader");
const intf = require("../topology_interfaces");
const log = require("../util/logger");
const MAX_ERR_MSG_LENGTH = 1000;
/** This class handles communication with topology coordination storage.
 */
class TopologyCoordinator {
    /** Simple constructor */
    constructor(name, storage, client) {
        this.storage = storage;
        this.client = client;
        this.name = name;
        this.leadership = new leader.TopologyLeader(this.name, this.storage, null);
        this.is_running = false;
        this.is_shutting_down = false;
        this.shutdown_callback = null;
        this.loop_timeout = 2 * 1000; // 2 seconds for refresh
        this.start_time = new Date();
        this.log_prefix = "[Coordinator] ";
        this.pingIntervalId = null;
        this.pingInterval = 1000;
        this.current_dormancy_state = false;
    }
    /** Runs main loop */
    run() {
        let self = this;
        self.is_running = true;
        self.storage.registerWorker(self.name, () => {
            self.setPingInterval();
        });
        self.leadership.run();
        let check_counter = 0;
        async.whilst(() => {
            return self.is_running;
        }, (xcallback) => {
            async.parallel([
                (ycallback) => {
                    if (self.leadership.isRunning()) {
                        ycallback();
                    }
                    else {
                        self.is_running = false;
                        ycallback(new Error("Leadership object was stopped"));
                    }
                },
                (ycallback) => {
                    setTimeout(() => {
                        self.handleIncommingRequests(ycallback);
                    }, self.loop_timeout);
                },
                (ycallback) => {
                    if (++check_counter % 5 == 1) {
                        self.checkAssignedTopologies(ycallback);
                    }
                    else {
                        ycallback();
                    }
                },
                (ycallback) => {
                    if (++check_counter % 5 == 0) {
                        self.checkWorkerStatus(ycallback);
                    }
                    else {
                        ycallback();
                    }
                }
            ], xcallback);
        }, (err) => {
            log.logger().important(self.log_prefix + "Coordinator stopped.");
            if (self.shutdown_callback) {
                self.shutdown_callback(err);
            }
            else {
                // This exit was not triggered from outside,
                // so notify the parent.
                self.client.shutdown(() => {
                    log.logger().important(this.log_prefix + "Exiting with code 0");
                    self.client.exit(0);
                });
            }
        });
    }
    /** Shut down the loop */
    preShutdown(callback) {
        let self = this;
        self.is_shutting_down = true;
        self.reportWorker(self.name, intf.Consts.WorkerStatus.closing, (err) => {
            if (err) {
                log.logger().error(self.log_prefix + "Error while reporting worker status as 'closing':");
                log.logger().exception(err);
            }
            self.leadership.shutdown((err) => {
                if (err) {
                    log.logger().error(self.log_prefix + "Error while shutting down leader:");
                    log.logger().exception(err);
                }
                callback();
            });
        });
    }
    /** Shut down the loop */
    shutdown(callback) {
        let self = this;
        log.logger().important(self.log_prefix + "Shutting down coordinator");
        // TODO check what happens when a topology is waiting
        self.reportWorker(self.name, intf.Consts.WorkerStatus.dead, (err) => {
            clearInterval(self.pingIntervalId);
            if (err) {
                log.logger().error(self.log_prefix + "Error while reporting worker status as 'dead':");
                log.logger().exception(err);
            }
            if (self.is_running) {
                self.shutdown_callback = callback;
                self.is_running = false;
            }
            else {
                callback();
            }
        });
    }
    /** Set status on given topology */
    reportTopology(uuid, status, error, callback) {
        let self = this;
        if (error.length > MAX_ERR_MSG_LENGTH) {
            error = error.substring(0, MAX_ERR_MSG_LENGTH);
        }
        this.storage.setTopologyStatus(uuid, this.name, status, error, (err) => {
            if (err) {
                log.logger().error(self.log_prefix + "Couldn't report topology status");
                log.logger().error(self.log_prefix + `Topology: ${uuid}, status=${status}, error=${error}`);
                log.logger().exception(err);
            }
            if (callback) {
                callback(err);
            }
        });
    }
    /** Set pid on given topology */
    reportTopologyPid(uuid, pid, callback) {
        let self = this;
        this.storage.setTopologyPid(uuid, pid, (err) => {
            if (err) {
                log.logger().error(self.log_prefix + "Couldn't report topology pid");
                log.logger().error(self.log_prefix + `Topology: ${uuid}, pid=${pid}`);
                log.logger().exception(err);
            }
            if (callback) {
                callback(err);
            }
        });
    }
    /** Set status on given worker */
    reportWorker(name, status, callback) {
        let self = this;
        this.storage.setWorkerStatus(name, status, (err) => {
            if (err) {
                log.logger().error(self.log_prefix + "Couldn't report worker status");
                log.logger().error(self.log_prefix + `Worker: name=${name}, status=${status}`);
                log.logger().exception(err);
            }
            if (callback) {
                callback(err);
            }
        });
    }
    /** Handle single request */
    handleSingleRequest(msg, callback) {
        let self = this;
        let simple_callback = ((err) => {
            if (err) {
                log.logger().exception(err);
            }
        });
        if (msg.created < self.start_time) {
            // just ignore, it was sent before this coordinator was started
            return callback();
        }
        else if (msg.cmd === intf.Consts.LeaderMessages.start_topology) {
            self.storage.getTopologyInfo(msg.content.uuid, (err, res) => {
                if (err) {
                    return callback(err);
                }
                if (self.name == res.worker && res.status == intf.Consts.TopologyStatus.waiting) {
                    // topology is still assigned to this worker
                    // otherwise the message could be old and stale, the toplogy was re-assigned to another worker
                    self.client.startTopology(msg.content.uuid, res.config, simple_callback);
                    callback();
                }
                else {
                    return callback();
                }
            });
        }
        else if (msg.cmd === intf.Consts.LeaderMessages.start_topologies) {
            async.each(msg.content.uuids, (uuid, xcallback) => {
                self.handleSingleRequest({
                    cmd: intf.Consts.LeaderMessages.start_topology,
                    content: { uuid: uuid },
                    created: new Date()
                }, xcallback);
            }, (err) => {
                return callback(err);
            });
        }
        else if (msg.cmd === intf.Consts.LeaderMessages.stop_topology) {
            self.client.stopTopology(msg.content.uuid, simple_callback);
            callback();
        }
        else if (msg.cmd === intf.Consts.LeaderMessages.set_disabled) {
            log.logger().important("Setting worker as disabled: " + self.name);
            self.leadership.releaseLeadership((err) => {
                if (err)
                    return simple_callback(err);
                self.reportWorker(self.name, intf.Consts.WorkerStatus.disabled, (err) => {
                    if (err)
                        return simple_callback(err);
                    self.client.stopAllTopologies(simple_callback);
                });
            });
            callback();
        }
        else if (msg.cmd === intf.Consts.LeaderMessages.set_enabled) {
            log.logger().important("Setting worker as enabled: " + self.name);
            self.reportWorker(self.name, intf.Consts.WorkerStatus.alive, simple_callback);
            callback();
        }
        else if (msg.cmd === intf.Consts.LeaderMessages.stop_topologies) {
            async.each(msg.content.stop_topologies, (stop_topology, xcallback) => {
                self.client.stopTopology(stop_topology.uuid, simple_callback);
                xcallback();
            }, callback);
        }
        else if (msg.cmd === intf.Consts.LeaderMessages.kill_topology) {
            self.client.killTopology(msg.content.uuid, simple_callback);
            callback();
        }
        else if (msg.cmd === intf.Consts.LeaderMessages.shutdown) {
            // shutdown only logs exceptions
            self.client.shutdown(() => {
                log.logger().important(this.log_prefix + "Exiting with code 0");
                self.client.exit(0);
            });
            return callback();
        }
        else if (msg.cmd === intf.Consts.LeaderMessages.rebalance) {
            self.leadership.forceRebalance();
            return callback();
        }
        else {
            // unknown message
            return callback();
        }
    }
    /** This method checks for new messages from coordination storage. */
    handleIncommingRequests(callback) {
        let self = this;
        if (self.is_shutting_down) {
            return callback();
        }
        self.storage.getMessage(self.name, (err, msg) => {
            if (err) {
                return callback(err);
            }
            if (!msg) {
                let new_dormancy_state = self.client.is_dormant_period();
                if (new_dormancy_state != self.current_dormancy_state) {
                    self.current_dormancy_state = new_dormancy_state;
                    // dormancy state changed, create new message and send into handler
                    msg = {
                        cmd: (new_dormancy_state ? intf.Consts.LeaderMessages.set_disabled : intf.Consts.LeaderMessages.set_enabled),
                        content: {},
                        created: new Date()
                    };
                }
                else {
                    return callback();
                }
            }
            self.handleSingleRequest(msg, callback);
        });
    }
    /** This method marks this worker as disabled. */
    setAsDisabled(callback) {
        let self = this;
        self.reportWorker(self.name, intf.Consts.WorkerStatus.disabled, callback);
    }
    /** This method checks current status for this worker.
     * It might happen that leader marked it as dead (e.g. pings were not
     * comming into db for some time), but this worker is actually still alive.
     * The worker must announce that it is available. The leader will then
     * handle the topologies appropriatelly.
     */
    checkWorkerStatus(callback) {
        let self = this;
        self.storage.getWorkerStatus((err, workers) => {
            if (err)
                return callback(err);
            let curr_status = workers
                .filter(x => x.name == self.name)
                .map(x => x.status);
            if (curr_status.length == 0) {
                // current worker doesn't have a record
                self.storage.registerWorker(self.name, callback);
            }
            else if (curr_status[0] != intf.Consts.WorkerStatus.alive && curr_status[0] != intf.Consts.WorkerStatus.disabled) {
                // state was set to something else, but this worker is still running
                self.storage.setWorkerStatus(self.name, intf.Consts.WorkerStatus.alive, callback);
            }
            else {
                callback();
            }
        });
    }
    /** This method checks if all topologies, assigned to this worker, actually run. */
    // TODO assert PIDs
    checkAssignedTopologies(callback) {
        let self = this;
        self.storage.getTopologiesForWorker(self.name, (err, topologies) => {
            if (err)
                return callback(err);
            let topologies_running = topologies
                .filter(x => x.status == intf.Consts.TopologyStatus.running)
                .map(x => x.uuid);
            self.client.resolveTopologyMismatches(topologies_running, callback);
        });
    }
    setPingInterval() {
        let self = this;
        if (self.pingIntervalId) {
            clearInterval(self.pingIntervalId);
        }
        // send ping to child in regular intervals
        self.pingIntervalId = setInterval(() => {
            self.storage.pingWorker(self.name, (err) => {
                if (err) {
                    log.logger().error(self.log_prefix + "Error while sending worker ping:");
                    log.logger().exception(err);
                }
            });
        }, self.pingInterval);
    }
}
exports.TopologyCoordinator = TopologyCoordinator;
//# sourceMappingURL=topology_coordinator.js.map