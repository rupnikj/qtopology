"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const http_server = require("../../util/http_server");
//////////////////////////////////////////////////////////////////////
class DashboardServer {
    constructor() {
        this.storage = null;
        this.port = null;
        this.server = null;
    }
    initCommon(storage, callback) {
        let self = this;
        self.storage = storage;
        self.server = new http_server.MinimalHttpServer("[QTopology Dashboard]");
        // first register static files
        let static_dir = path.join(__dirname, "../../../resources/gui/");
        static_dir = path.resolve(static_dir);
        self.server.addDirectory(static_dir);
        self.server.addRoute("/", path.join(static_dir, "qtopology_dashboard.html"));
        // now add REST handlers
        self.server.addHandler("worker-status", (data, callback) => {
            self.storage.getWorkerStatus(callback);
        });
        self.server.addHandler("topology-status", (data, callback) => {
            self.storage.getTopologyStatus(callback);
        });
        self.server.addHandler("register-topology", (data, callback) => {
            self.storage.registerTopology(data.uuid, data.config, callback);
        });
        self.server.addHandler("clear-topology-error", (data, callback) => {
            self.storage.clearTopologyError(data.uuid, callback);
        });
        self.server.addHandler("disable-topology", (data, callback) => {
            self.storage.disableTopology(data.uuid, callback);
        });
        self.server.addHandler("enable-topology", (data, callback) => {
            self.storage.enableTopology(data.uuid, callback);
        });
        self.server.addHandler("stop-topology", (data, callback) => {
            self.storage.stopTopology(data.uuid, callback);
        });
        self.server.addHandler("topology-info", (data, callback) => {
            self.storage.getTopologyInfo(data.uuid, callback);
        });
        self.server.addHandler("topology-history", (data, callback) => {
            self.storage.getTopologyHistory(data.uuid, callback);
        });
        self.server.addHandler("worker-history", (data, callback) => {
            self.storage.getWorkerHistory(data.name, callback);
        });
        self.server.addHandler("delete-worker", (data, callback) => {
            self.storage.deleteWorker(data.name, callback);
        });
        self.server.addHandler("shut-down-worker", (data, callback) => {
            self.storage.shutDownWorker(data.name, callback);
        });
        self.server.addHandler("storage-info", (data, callback) => {
            self.storage.getProperties((err, props) => {
                callback(err, { data: props });
            });
        });
        callback();
    }
    init(port, storage, callback) {
        this.port = port;
        this.initCommon(storage, callback);
    }
    initForExpress(app, prefix, storage, callback) {
        let self = this;
        self.initCommon(storage, (err) => {
            if (err)
                return callback(err);
            let prepareAddr = (url) => {
                return url.replace(`/${prefix}`, "");
            };
            app.get(`/${prefix}/*`, (req, res) => {
                self.handle(req.method, prepareAddr(req.url), req.body, res);
            });
            app.post(`/${prefix}/*`, (req, res) => {
                console.log("body", req.body);
                self.handle(req.method, prepareAddr(req.url), req.body, res);
            });
            callback();
        });
    }
    run() {
        this.server.run(this.port);
    }
    handle(method, addr, body, resp) {
        this.server.handle(method, addr, body, resp);
    }
}
exports.DashboardServer = DashboardServer;
//# sourceMappingURL=dashboard_server.js.map