import * as intf from "../topology_interfaces";

/** This bolt transforms given date fields in incoming
 * messages either Date objects, numerics or booleans
 * and sends them forward. */
export class TypeTransformBolt implements intf.Bolt {

    private date_transform_fields: string[];
    private numeric_transform_fields: string[];
    private bool_transform_fields: string[];
    private onEmit: intf.BoltEmitCallback;
    private stream_id: string;
    private reuse_stream_id: boolean;

    constructor() {
        this.onEmit = null;
        this.date_transform_fields = [];
    }

    init(name: string, config: any, context: any, callback: intf.SimpleCallback) {
        this.onEmit = config.onEmit;
        this.date_transform_fields = config.date_transform_fields || [];
        this.numeric_transform_fields = config.numeric_transform_fields || [];
        this.bool_transform_fields = config.bool_transform_fields || [];
        this.stream_id = config.stream_id;
        this.reuse_stream_id = config.reuse_stream_id;
        callback();
    }

    heartbeat() { }

    shutdown(callback: intf.SimpleCallback) {
        callback();
    }

    receive(data: any, stream_id: string, callback: intf.SimpleCallback) {
        for (let date_field of this.date_transform_fields) {
            if (data[date_field]) {
                data[date_field] = new Date(data[date_field]);
            }
        }
        for (let date_field of this.numeric_transform_fields) {
            if (data[date_field]) {
                data[date_field] = +data[date_field];
            }
        }
        for (let date_field of this.bool_transform_fields) {
            if (data[date_field]) {
                data[date_field] = (data[date_field] && data[date_field] != "false" ? true : false);
            }
        }
        this.onEmit(data, (this.reuse_stream_id ? stream_id : this.stream_id), callback);
    }
}
