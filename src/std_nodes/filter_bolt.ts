import * as intf from "../topology_interfaces";
import * as pm  from "../util/pattern_matcher";

/////////////////////////////////////////////////////////////////////////////

/** This bolt filters incoming messages based on provided
 * filter and sends them forward. */
export class FilterBolt implements intf.Bolt {

    private matcher: pm.PaternMatcher;
    private onEmit: intf.BoltEmitCallback;

    constructor() {
        this.onEmit = null;
        this.matcher = null;
    }

    /** Initializes filtering pattern */
    init(name: string, config: any, context: any, callback: intf.SimpleCallback) {
        this.onEmit = config.onEmit;
        this.matcher = new pm.PaternMatcher(config.filter);
        callback();
    }

    heartbeat() { }

    shutdown(callback: intf.SimpleCallback) {
        callback();
    }

    receive(data: any, stream_id: string, callback: intf.SimpleCallback) {
        if (this.matcher.isMatch(data)) {
            this.onEmit(data, stream_id, callback);
        } else {
            callback();
        }
    }
}
