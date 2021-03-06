"use strict";

/*global describe, it, before, beforeEach, after, afterEach */

const assert = require("assert");
const log = require("../../built/util/logger");
log.logger().setLevel("none");
const tlw = require("../../built/distributed/topology_local_wrapper");
const bb = require("../helpers/bad_bolt.js");
const bs = require("../helpers/bad_spout.js");
const intf = require("../../built/topology_interfaces");

let topology_json = {
    "general": {
        "uuid": "top1",
        "heartbeat": 10000,
        // each module needs to expose init(initObj, common_context, xcallback)
        "initialization": [
            {
                "disabled": true,
                "working_dir": "./tests/helpers",
                "cmd": "bad_init.js",
                "init": {}
            }
        ],
        // each module needs to expose shutdown(callback)
        "shutdown": [
            {
                "disabled": true,
                "working_dir": "./tests/helpers",
                "cmd": "bad_shutdown.js",
            }
        ]
    },
    "spouts": [],
    "bolts": [],
    "variables": {}
}
const EventEmitter = require('events');

class MockProcess extends EventEmitter {
    constructor(done, expectedExitCode) {
        super();
        this.done = done;
        this.exits = [];
        this.sends = [];
        this.pid = 1;
        this.connected = true;
        this.expectedExitCode = expectedExitCode;
    }
    exit(code) {
        this.exits.push(code);
        if (this.expectedExitCode) {
            assert.equal(code, this.expectedExitCode);
        }
        this.done();
    }
    send(obj, sendHandle, options, callback) { this.sends.push(obj); if (callback) { return callback(); } }
}

describe('local wrapper', function () {
    describe('Construction', function () {
        it('should be constructable', function (done) {
            const mockProcess = new MockProcess(done);
            let target = new tlw.TopologyLocalWrapper(mockProcess,
                intf.ChildExitCode.shutdown_notinit_error);
            target.exitTimeout = 5;
            mockProcess.emit("message", { cmd: intf.ParentMsgCode.shutdown });
        });
    });
    describe('Termination', function () {
        it('should shutdown on SIGINT', function (done) {
            const mockProcess = new MockProcess(done,
                intf.ChildExitCode.shutdown_notinit_error);
            let target = new tlw.TopologyLocalWrapper(mockProcess);
            target.exitTimeout = 5;
            mockProcess.emit("SIGINT");
        });
        it('should shutdown on SIGTERM', function (done) {
            const mockProcess = new MockProcess(done,
                intf.ChildExitCode.shutdown_notinit_error);
            let target = new tlw.TopologyLocalWrapper(mockProcess);
            target.exitTimeout = 5;
            mockProcess.emit("SIGTERM");
        });
        it('should shutdown on unhandeled exception', function (done) {
            const mockProcess = new MockProcess(done,
                intf.ChildExitCode.unhandeled_error);
            let target = new tlw.TopologyLocalWrapper(mockProcess);
            target.exitTimeout = 5;
            mockProcess.emit("uncaughtException", new Error("uncaught"));
        });
    });
    describe('Ping', function () {
        it('should ping timeout', function (done) {
            const mockProcess = new MockProcess(done,
                intf.ChildExitCode.parent_ping_timeout);
            let target = new tlw.TopologyLocalWrapper(mockProcess);
            target.exitTimeout = 5;
            target.pingTimeout = 20;
            target.pingInterval = 5;
            target.setPingInterval();
            let total = 0;
            let intv = setInterval(() => {
                total += 10;
                if (total > 50) {
                    clearInterval(intv);
                    target.clearPingInterval();
                }
                mockProcess.emit("message", {
                    cmd: intf.ParentMsgCode.ping,
                    data: {}
                });
            }, 100);
        });
        it('should ping timeout', function (done) {
            const mockProcess = new MockProcess(done,
                intf.ChildExitCode.parent_ping_timeout);
            let target = new tlw.TopologyLocalWrapper(mockProcess);
            target.exitTimeout = 5;
            target.pingTimeout = 20;
            target.pingInterval = 10;
            target.setPingInterval();
        });
        it('should exit when disconnected timeout', function (done) {
            const mockProcess = new MockProcess(done,
                intf.ChildExitCode.parent_disconnect);
            mockProcess.connected = false;
            let target = new tlw.TopologyLocalWrapper(mockProcess);
            target.exitTimeout = 5;
            target.pingTimeout = 20;
            target.pingInterval = 10;
            target.setPingInterval();
        });
    });
    describe('Initialization', function () {
        it('should init and shutdown', function (done) {
            const mockProcess = new MockProcess(done,
                intf.ChildExitCode.exit_ok);
            let target = new tlw.TopologyLocalWrapper(mockProcess);
            target.exitTimeout = 5;
            let top_config = JSON.parse(JSON.stringify(topology_json));
            mockProcess.emit("message", {
                cmd: intf.ParentMsgCode.init,
                data: top_config
            });
            setTimeout(() => {
                assert.equal(mockProcess.sends.length, 1);
                assert.equal(mockProcess.sends[0].cmd, intf.ChildMsgCode.response_init);
                assert.equal(mockProcess.sends[0].data.err, null);
                target.clearPingInterval();
                mockProcess.emit("message", { cmd: intf.ParentMsgCode.shutdown });
            }, 20);
        });
        it('should pass an exception to init callback if bolt_config.inputs is missing', function (done) {
            const mockProcess = new MockProcess(done,
                intf.ChildExitCode.init_error);
            mockProcess.connected = false;
            let target = new tlw.TopologyLocalWrapper(mockProcess);
            let top_config = JSON.parse(JSON.stringify(topology_json));
            let config = {
                name: "test1",
                working_dir: "./tests/helpers",
                cmd: "bad_bolt.js",
                init: {
                    action: bb.badActions.throw,
                    location: bb.badLocations.init
                }
            };
            top_config.bolts.push(config);
            target.exitTimeout = 5;
            mockProcess.emit("message", {
                cmd: intf.ParentMsgCode.init,
                data: top_config
            });
            setTimeout(() => {
                assert.equal(mockProcess.sends.length, 1);
                assert.equal(mockProcess.sends[0].cmd, intf.ChildMsgCode.response_init);
                assert.notEqual(mockProcess.sends[0].data.err, null);
            }, 20);
        });
        it('should pass an exception to init callback if bolt_config.inputs is missing', function (done) {
            const mockProcess = new MockProcess(done,
                intf.ChildExitCode.init_error);
            mockProcess.connected = false;
            let target = new tlw.TopologyLocalWrapper(mockProcess);
            let top_config = JSON.parse(JSON.stringify(topology_json));
            let config = {
                name: "test1",
                working_dir: "./tests/helpers",
                cmd: "bad_bolt.js",
                init: {
                    action: bb.badActions.throw,
                    location: bb.badLocations.init
                },
                inputs: []
            };
            top_config.bolts.push(config);
            target.exitTimeout = 5;
            mockProcess.emit("message", {
                cmd: intf.ParentMsgCode.init,
                data: top_config
            });
            setTimeout(() => {
                assert.equal(mockProcess.sends.length, 1);
                assert.equal(mockProcess.sends[0].cmd, intf.ChildMsgCode.response_init);
                assert.notEqual(mockProcess.sends[0].data.err, null);
            }, 20);
        });
        it('should pass an exception to init callback if bolt_config.inputs is missing', function (done) {
            const mockProcess = new MockProcess(done,
                intf.ChildExitCode.init_error);
            mockProcess.connected = false;
            let target = new tlw.TopologyLocalWrapper(mockProcess);
            let top_config = JSON.parse(JSON.stringify(topology_json));
            let config = {
                name: "test1",
                working_dir: "./tests/helpers",
                cmd: "bad_bolt.js",
                init: {
                    action: bb.badActions.callbackException,
                    location: bb.badLocations.init
                },
                inputs: []
            };
            top_config.bolts.push(config);
            target.exitTimeout = 5;
            mockProcess.emit("message", {
                cmd: intf.ParentMsgCode.init,
                data: top_config
            });
            setTimeout(() => {
                assert.equal(mockProcess.sends.length, 1);
                assert.equal(mockProcess.sends[0].cmd, intf.ChildMsgCode.response_init);
                assert.notEqual(mockProcess.sends[0].data.err, null);
            }, 20);
        });
    });
    describe('Double calls', function () {
        it('should not allow calling init twice', function (done) {
            const mockProcess = new MockProcess(done,
                intf.ChildExitCode.exit_ok);
            let target = new tlw.TopologyLocalWrapper(mockProcess);
            let top_config = JSON.parse(JSON.stringify(topology_json));
            let config = {
                name: "test1",
                working_dir: "./tests/helpers",
                cmd: "bad_bolt.js",
                init: {
                    action: "",
                    location: ""
                },
                inputs: []
            };
            top_config.bolts.push(config);
            target.exitTimeout = 5;
            mockProcess.emit("message", {
                cmd: intf.ParentMsgCode.init,
                data: top_config
            });
            setTimeout(() => {
                mockProcess.emit("message", {
                    cmd: intf.ParentMsgCode.init,
                    data: top_config
                });
                setTimeout(() => {
                    assert.equal(mockProcess.sends.length, 2);
                    assert.equal(mockProcess.sends[0].cmd, intf.ChildMsgCode.response_init);
                    assert.equal(mockProcess.sends.length, 2);
                    assert.equal(mockProcess.sends[1].cmd, intf.ChildMsgCode.response_init);
                    assert.notEqual(mockProcess.sends[1].data.err, null);
                    mockProcess.emit("message", {
                        cmd: intf.ParentMsgCode.shutdown,
                        data: {}
                    });
                }, 10);
            }, 10);
        });
        it('should not allow calling run when already running', function (done) {
            const mockProcess = new MockProcess(done,
                intf.ChildExitCode.run_error);
            let target = new tlw.TopologyLocalWrapper(mockProcess);
            target.exitTimeout = 5;
            let top_config = JSON.parse(JSON.stringify(topology_json));
            mockProcess.emit("message", {
                cmd: intf.ParentMsgCode.init,
                data: top_config
            });
            setTimeout(() => {
                mockProcess.emit("message", {
                    cmd: intf.ParentMsgCode.run,
                    data: {}
                });
                setTimeout(() => {
                    mockProcess.emit("message", {
                        cmd: intf.ParentMsgCode.run,
                        data: {}
                    });
                    setTimeout(() => {
                        assert.equal(mockProcess.sends.length, 3);
                        assert.equal(mockProcess.sends[0].cmd, intf.ChildMsgCode.response_init);
                        assert.equal(mockProcess.sends[0].data.err, null);
                        assert.equal(mockProcess.sends[1].cmd, intf.ChildMsgCode.response_run);
                        assert.equal(mockProcess.sends[1].data.err, null);
                        assert.equal(mockProcess.sends[2].cmd, intf.ChildMsgCode.response_run);
                        assert.notEqual(mockProcess.sends[2].data.err, null);
                        clearInterval(target.topology_local.heartbeatTimer);
                    }, 20);
                }, 20);
            }, 20);
        });
        it('should not allow calling pause when not running', function (done) {
            const mockProcess = new MockProcess(done,
                intf.ChildExitCode.pause_error);
            let target = new tlw.TopologyLocalWrapper(mockProcess);
            target.exitTimeout = 5;
            let top_config = JSON.parse(JSON.stringify(topology_json));
            mockProcess.emit("message", {
                cmd: intf.ParentMsgCode.init,
                data: top_config
            });
            setTimeout(() => {
                mockProcess.emit("message", {
                    cmd: intf.ParentMsgCode.pause,
                    data: {}
                });
                setTimeout(() => {
                    assert.equal(mockProcess.sends.length, 2);
                    assert.equal(mockProcess.sends[0].cmd, intf.ChildMsgCode.response_init);
                    assert.equal(mockProcess.sends[0].data.err, null);
                    assert.equal(mockProcess.sends[1].cmd, intf.ChildMsgCode.response_pause);
                    assert.notEqual(mockProcess.sends[1].data.err, null);
                    clearInterval(target.topology_local.heartbeatTimer);
                }, 20);
            }, 20);
        });
    });
    it('should allow calling shutdown twice', function (done) {
        let mockProcess = new MockProcess(done,
            intf.ChildExitCode.exit_ok);
        let target = new tlw.TopologyLocalWrapper(mockProcess);
        target.exitTimeout = 5;
        let top_config = JSON.parse(JSON.stringify(topology_json));

        mockProcess.emit("message", {
            cmd: intf.ParentMsgCode.init,
            data: top_config
        });
        setTimeout(() => {
            mockProcess.emit("message", {
                cmd: intf.ParentMsgCode.shutdown,
                data: {}
            });
            setTimeout(() => {
                mockProcess.emit("message", {
                    cmd: intf.ParentMsgCode.shutdown,
                    data: {}
                });
                setTimeout(() => {
                    assert.equal(mockProcess.sends.length, 2);
                    assert.equal(mockProcess.sends[0].cmd, intf.ChildMsgCode.response_init);
                    assert.equal(mockProcess.sends[0].data.err, null);
                    assert.equal(mockProcess.sends[1].cmd, intf.ChildMsgCode.response_shutdown);
                    assert.equal(mockProcess.sends[1].data.err, null);
                    clearInterval(target.topology_local.heartbeatTimer);
                }, 20);
            }, 20);
        }, 20);
    });
    describe('Not initialized calls', function () {
        it('should exit with error when shutdown is called and not initialized', function (done) {
            const mockProcess = new MockProcess(done,
                intf.ChildExitCode.shutdown_notinit_error);
            let target = new tlw.TopologyLocalWrapper(mockProcess);
            target.exitTimeout = 5;
            mockProcess.emit("message", {
                cmd: intf.ParentMsgCode.shutdown,
                data: {}
            });
            setTimeout(() => {
                assert.equal(mockProcess.sends.length, 1);
                assert.equal(mockProcess.sends[0].cmd, intf.ChildMsgCode.response_shutdown);
                assert.notEqual(mockProcess.sends[0].data.err, null);
            }, 10);
        });
        it('should not allow calling run when not initialized', function (done) {
            const mockProcess = new MockProcess(done,
                intf.ChildExitCode.shutdown_notinit_error);
            let target = new tlw.TopologyLocalWrapper(mockProcess);
            target.exitTimeout = 5;
            mockProcess.emit("message", {
                cmd: intf.ParentMsgCode.run,
                data: {}
            });
            setTimeout(() => {
                assert.equal(mockProcess.sends.length, 1);
                assert.equal(mockProcess.sends[0].cmd, intf.ChildMsgCode.response_run);
                assert.notEqual(mockProcess.sends[0].data.err, null);
                mockProcess.emit("message", {
                    cmd: intf.ParentMsgCode.shutdown,
                    data: {}
                });
            }, 10);
        });
        it('should not allow calling pause when not initialized', function (done) {
            const mockProcess = new MockProcess(done,
                intf.ChildExitCode.shutdown_notinit_error);
            let target = new tlw.TopologyLocalWrapper(mockProcess);
            target.exitTimeout = 5;
            mockProcess.emit("message", {
                cmd: intf.ParentMsgCode.pause,
                data: {}
            });
            setTimeout(() => {
                assert.equal(mockProcess.sends.length, 1);
                assert.equal(mockProcess.sends[0].cmd, intf.ChildMsgCode.response_pause);
                assert.notEqual(mockProcess.sends[0].data.err, null);
                mockProcess.emit("message", {
                    cmd: intf.ParentMsgCode.shutdown,
                    data: {}
                });
            }, 10);
        });
    });
});