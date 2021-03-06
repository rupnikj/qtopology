"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const port_default = 3000;
const nrc = require("node-rest-client");
//////////////////////////////////////////////////////////////////////
// Storage-coordination implementation
class HttpStorage {
    constructor(port) {
        this.port = port || port_default;
        this.client = new nrc.Client();
        this.url_prefix = "http://localhost:" + this.port + "/";
    }
    getProperties(callback) {
        let res = [];
        res.push({ key: "type", value: "HttpCoordinator" });
        res.push({ key: "port", value: this.port });
        res.push({ key: "url_prefix", value: this.url_prefix });
        callback(null, res);
    }
    getMessages(name, callback) {
        this.call("get-messages", { worker: name }, callback);
    }
    getMessage(name, callback) {
        this.call("get-message", { worker: name }, callback);
    }
    getWorkerStatus(callback) {
        this.call("worker-statuses", {}, callback);
    }
    getTopologyStatus(callback) {
        this.call("topology-statuses", {}, callback);
    }
    getTopologiesForWorker(name, callback) {
        this.call("worker-topologies", { worker: name }, callback);
    }
    getTopologyInfo(uuid, callback) {
        this.call("topology-info", { uuid: uuid }, callback);
    }
    registerWorker(name, callback) {
        this.call("register-worker", { worker: name }, callback);
    }
    pingWorker(name, callback) {
        this.call("ping-worker", { worker: name }, callback);
    }
    announceLeaderCandidacy(name, callback) {
        this.call("announce-leader-candidacy", { worker: name }, callback);
    }
    checkLeaderCandidacy(name, callback) {
        this.call("check-leader-candidacy", { worker: name }, callback);
    }
    assignTopology(uuid, name, callback) {
        this.call("assign-topology", { worker: name, uuid: uuid }, callback);
    }
    sendMessageToWorker(worker, cmd, content, valid_msec, callback) {
        this.call("send-message", { worker: worker, cmd: cmd, content: content, valid_msec: valid_msec }, callback);
    }
    setTopologyStatus(uuid, worker, status, error, callback) {
        this.call("set-topology-status", { uuid: uuid, status: status, error: error, worker: worker }, callback);
    }
    getMsgQueueContent(callback) {
        this.call("get-msg-queue-content", {}, callback);
    }
    setWorkerStatus(name, status, callback) {
        this.call("set-worker-status", { name: name, status: status }, callback);
    }
    setWorkerLStatus(name, lstatus, callback) {
        this.call("set-worker-lstatus", { name: name, lstatus: lstatus }, callback);
    }
    setTopologyPid(uuid, pid, callback) {
        this.call("set-topology-pid", { uuid: uuid, pid: pid }, callback);
    }
    registerTopology(uuid, config, callback) {
        this.call("register-topology", { uuid: uuid, config: config }, callback);
    }
    disableTopology(uuid, callback) {
        this.call("disable-topology", { uuid: uuid }, callback);
    }
    enableTopology(uuid, callback) {
        this.call("enable-topology", { uuid: uuid }, callback);
    }
    deleteTopology(uuid, callback) {
        this.call("delete-topology", { uuid: uuid }, callback);
    }
    clearTopologyError(uuid, callback) {
        this.call("clear-topology-error", { uuid: uuid }, callback);
    }
    stopTopology(uuid, callback) {
        this.call("stop-topology", { uuid: uuid }, callback);
    }
    killTopology(uuid, callback) {
        this.call("kill-topology", { uuid: uuid }, callback);
    }
    deleteWorker(name, callback) {
        this.call("delete-worker", { name: name }, callback);
    }
    shutDownWorker(name, callback) {
        this.call("shut-down-worker", { name: name }, callback);
    }
    getTopologyHistory(uuid, callback) {
        this.call("topology-history", { uuid: uuid }, callback);
    }
    getWorkerHistory(name, callback) {
        this.call("worker-history", { name: name }, callback);
    }
    call(addr, req_data, callback) {
        let self = this;
        let args = { data: req_data, headers: { "Content-Type": "application/json" } };
        let req = this.client.post(self.url_prefix + addr, args, (data, response) => {
            callback(null, data);
        });
        req.on('error', (err) => {
            callback(err);
        });
    }
}
exports.HttpStorage = HttpStorage;
//# sourceMappingURL=http_storage.js.map