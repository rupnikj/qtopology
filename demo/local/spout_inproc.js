"use strict";

const tn = require("../../").child;
const cmdline = require("../../src/util/cmdline");

/////////////////////////////////////////////////////////////////////////////

class DataGenerator {
    constructor() {
        this._enabled = false;
        this._data = [];
    }
    enable() {
        this._enabled = true;
    }
    disable() {
        this._enabled = false;
    }
    next() {
        if (!this._enabled) {
            return false;
        }
        if (this._data.length === 0) {
            this._data = [];
            for (let i = 0; i < 31; i++) {
                this._data.push({ a: i });
            }
            return null;
        } else {
            return this._data.pop();
        }
    }
}

class MySpout {

    constructor() {
        this._name = null;
        this._prefix = "";
        this._generator = new DataGenerator();
    }

    init(name, config, callback) {
        this._name = name;
        this._prefix = `[InprocSpout ${this._name}]`;
        console.log(this._prefix, "Inside init:", config);
        callback();
    }

    heartbeat() {
        console.log(this._prefix, "Inside heartbeat.");
    }

    shutdown(callback) {
        console.log(this._prefix, "Shutting down gracefully.");
        callback();
    }

    run() {
        console.log(this._prefix, "Inside run");
        this._generator.enable();
    }

    pause() {
        console.log(this._prefix, "Inside pause");
        this._generator.disable();
    }

    next(callback) {
        console.log(this._prefix, "Inside next");
        let data = this._generator.next();
        callback(null, data);
    }
}

////////////////////////////////////////////////////////////////////////////////

exports.create = function () { return new MySpout(); };
