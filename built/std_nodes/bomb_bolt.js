"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const log = require("../util/logger");
/** This bolt explodes after predefined time interval.
 * Primarily used for testing.
*/
class BombBolt {
    constructor() {
        this.onEmit = null;
        this.explode_after = null;
        this.started_at = null;
    }
    init(name, config, context, callback) {
        this.onEmit = config.onEmit;
        this.explode_after = config.explode_after || 10 * 1000;
        this.started_at = Date.now();
        callback();
    }
    heartbeat() {
        if (Date.now() - this.started_at >= this.explode_after) {
            log.logger().log("Bomb about to explode");
            eval("this.someBadName();");
        }
    }
    shutdown(callback) {
        callback();
    }
    receive(data, stream_id, callback) {
        this.onEmit(data, stream_id, callback);
    }
}
exports.BombBolt = BombBolt;
//# sourceMappingURL=bomb_bolt.js.map