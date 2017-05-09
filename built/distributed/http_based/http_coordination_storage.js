"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http_server = require("./http_server");
class RecWorker {
}
class RecTopology {
}
class RecMessage {
}
//////////////////////////////////////////////////////////////////////
// Storage implementation - accessed over HTTP
//
// Broad schema:
// Workers: uuid, title, last_ping, status, lstatus
// Topologies: uuid, config, status, worker
// Msgs: worker, cmd, content
//
// Worker status: alive, dead, unloaded
// worker lstatus: leader, candidate, ""
// Topology status: unassigned, waiting, running, error, stopped
class HttpCoordinationStorage {
    constructor() {
        this.workers = [];
        this.topologies = [];
        this.messages = [];
    }
    addTopology(config) {
        this.topologies.push({
            uuid: config.general.name,
            config: config,
            status: "unassigned",
            worker: null,
            last_ping: Date.now(),
            error: null
        });
    }
    /** Performs upsert of worker record. It's initial status is alive */
    registerWorker(name) {
        let rec = null;
        for (let worker of this.workers) {
            if (worker.name == name) {
                rec = worker;
                worker.last_ping = Date.now();
                worker.status = "alive";
                worker.lstatus = "";
                worker.lstatus_ts = null;
                break;
            }
        }
        if (!rec) {
            rec = {
                name: name,
                last_ping: Date.now(),
                status: "alive",
                lstatus: "",
                lstatus_ts: null
            };
            this.workers.push(rec);
        }
        return { success: true };
    }
    /** Determines leadership status */
    getLeadershipStatus() {
        this.disableDefunctLeaders();
        let hits = this.workers.filter(x => x.lstatus == "leader");
        if (hits.length > 0)
            return { leadership: "ok" };
        hits = this.workers.filter(x => x.lstatus == "candidate");
        if (hits.length > 0)
            return { leadership: "pending" };
        return { leadership: "vacant" };
    }
    announceLeaderCandidacy(name) {
        this.disableDefunctLeaders();
        // if we already have a leader, abort
        let hits = this.workers.filter(x => x.lstatus == "leader");
        if (hits.length > 0)
            return;
        // find pending records that are not older than 5 sec
        hits = this.workers.filter(x => x.lstatus == "pending");
        if (hits.length > 0)
            return;
        // ok, announce new candidate
        for (let worker of this.workers) {
            if (worker.name == name) {
                worker.lstatus = "pending";
                worker.lstatus_ts = Date.now();
                break;
            }
        }
        return;
    }
    /** Checks if leadership candidacy for specified worker was successful. */
    checkLeaderCandidacy(name) {
        this.disableDefunctLeaders();
        let res = false;
        for (let worker of this.workers) {
            if (worker.name == name && worker.lstatus == "pending") {
                worker.lstatus = "leader";
                res = true;
                break;
            }
        }
        return res;
    }
    /** Returns worker statuses */
    getWorkerStatuses() {
        this.disableDefunctWorkers();
        return this.workers
            .map(x => {
            let cnt = 0;
            this.topologies.forEach(y => {
                cnt += (y.worker === x.name ? 1 : 0);
            });
            return {
                name: x.name,
                status: x.status,
                topology_count: cnt,
                lstatus: x.lstatus,
                last_ping_d: x.last_ping,
                last_ping: new Date(x.last_ping),
                lstatus_ts: x.lstatus_ts,
                lstatus_ts_d: new Date(x.lstatus_ts)
            };
        });
    }
    getTopologyStatuses() {
        this.disableDefunctWorkers();
        this.unassignWaitingTopologies();
        return this.topologies
            .map(x => {
            return {
                uuid: x.uuid,
                status: x.status,
                worker: x.worker
            };
        });
    }
    getTopologiesForWorker(name) {
        return this.topologies
            .filter(x => x.worker === name)
            .map(x => {
            return {
                uuid: x.uuid,
                status: x.status,
                worker: x.worker
            };
        });
    }
    assignTopology(uuid, target) {
        let topology = this.topologies.filter(x => x.uuid == uuid)[0];
        this.messages.push({
            worker: target,
            cmd: "start",
            content: {
                uuid: uuid,
                config: topology.config
            }
        });
        topology.status = "waiting";
        topology.worker = target;
    }
    markTopologyAsRunning(uuid) {
        let topology = this.topologies.filter(x => x.uuid == uuid)[0];
        topology.status = "running";
        topology.last_ping = Date.now();
    }
    markTopologyAsStopped(uuid) {
        let topology = this.topologies.filter(x => x.uuid == uuid)[0];
        topology.status = "stopped";
        topology.last_ping = Date.now();
    }
    markTopologyAsError(uuid, error) {
        let topology = this.topologies.filter(x => x.uuid == uuid)[0];
        topology.status = "error";
        topology.last_ping = Date.now();
        topology.error = error;
    }
    setTopologyPing(uuid) {
        let topology = this.topologies.filter(x => x.uuid == uuid)[0];
        topology.last_ping = Date.now();
        return { success: true };
    }
    setTopologyStatus(uuid, status, error) {
        if (status == "running")
            return this.markTopologyAsRunning(uuid);
        if (status == "stopped")
            return this.markTopologyAsStopped(uuid);
        if (status == "unassigned")
            return this.markTopologyAsStopped(uuid);
        if (status == "error")
            return this.markTopologyAsError(uuid, error);
        return {
            success: false,
            error: `Unknown topology status: "${status}", uuid: "${uuid}"`
        };
    }
    setWorkerStatus(name, status) {
        let hits = this.workers.filter(x => x.name === name);
        if (hits.length > 0) {
            hits[0].status = status;
            if (status !== "alive") {
                hits[0].lstatus = "";
            }
            return { success: true };
        }
        else {
            return { success: false, error: "Unknown worker: " + name };
        }
    }
    getMessagesForWorker(name) {
        this.pingWorker(name);
        let result = this.messages.filter(x => x.worker === name);
        this.messages = this.messages.filter(x => x.worker !== name);
        return result;
    }
    pingWorker(name) {
        for (let worker of this.workers) {
            if (worker.name == name) {
                worker.last_ping = Date.now();
                break;
            }
        }
    }
    unassignWaitingTopologies() {
        // set topologies to unassigned if they have been waiting too long
        let d = Date.now() - 30 * 1000;
        let worker_map = {};
        for (let worker of this.workers) {
            worker_map[worker.name] = worker.status;
        }
        for (let topology of this.topologies) {
            if (topology.status == "waiting" && topology.last_ping < d) {
                topology.status = "unassigned";
                topology.worker = null;
            }
            if (topology.worker) {
                if (worker_map[topology.worker] == "dead") {
                    topology.status = "unassigned";
                    topology.worker = null;
                }
            }
        }
    }
    disableDefunctWorkers() {
        // disable workers that did not update their status
        let d = Date.now() - 30 * 1000;
        for (let worker of this.workers) {
            if (worker.status == "alive" && worker.last_ping < d) {
                worker.status = "dead";
            }
        }
    }
    disableDefunctLeaders() {
        // disable worker that did not perform their leadership duties
        let d = Date.now() - 10 * 1000;
        for (let worker of this.workers) {
            if (worker.lstatus == "leader" || worker.lstatus == "candidate") {
                if (worker.last_ping < d) {
                    worker.lstatus = "";
                }
            }
        }
    }
}
////////////////////////////////////////////////////////////////////
// Initialize storage
let storage = new HttpCoordinationStorage();
////////////////////////////////////////////////////////////////////
// Initialize simple REST server
http_server.addHandler('/worker-statuses', (data, callback) => {
    let result = storage.getWorkerStatuses();
    callback(null, result);
});
http_server.addHandler('/topology-statuses', (data, callback) => {
    let result = storage.getTopologyStatuses();
    callback(null, result);
});
http_server.addHandler('/leadership-status', (data, callback) => {
    let result = storage.getLeadershipStatus();
    callback(null, result);
});
http_server.addHandler('/worker-topologies', (data, callback) => {
    let worker = data.worker;
    let result = storage.getTopologiesForWorker(worker);
    callback(null, result);
});
http_server.addHandler('/get-messages', (data, callback) => {
    let worker = data.worker;
    let result = storage.getMessagesForWorker(worker);
    callback(null, result);
});
http_server.addHandler('/assign-topology', (data, callback) => {
    let worker = data.worker;
    let uuid = data.uuid;
    let result = storage.assignTopology(uuid, worker);
    callback(null, result);
});
http_server.addHandler('/check-leader-candidacy', (data, callback) => {
    let worker = data.worker;
    let result = storage.checkLeaderCandidacy(worker);
    callback(null, result);
});
http_server.addHandler('/announce-leader-candidacy', (data, callback) => {
    let worker = data.worker;
    let result = storage.announceLeaderCandidacy(worker);
    callback(null, result);
});
http_server.addHandler('/register-worker', (data, callback) => {
    let worker = data.worker;
    let result = storage.registerWorker(worker);
    callback(null, result);
});
http_server.addHandler('/set-topology-status', (data, callback) => {
    let uuid = data.uuid;
    let status = data.status;
    let error = data.error;
    let result = storage.setTopologyStatus(uuid, status, error);
    callback(null, result);
});
http_server.addHandler('/set-worker-status', (data, callback) => {
    let name = data.name;
    let status = data.status;
    let result = storage.setWorkerStatus(name, status);
    callback(null, result);
});
/////////////////////////////////////////////////////////////////////////////
exports.addTopology = function (config) {
    storage.addTopology(config);
};
exports.run = function (options) {
    http_server.run(options);
};
//# sourceMappingURL=http_coordination_storage.js.map