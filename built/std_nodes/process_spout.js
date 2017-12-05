"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cp = require("child_process");
class Utils {
    static readJsonFile(content, tuples) {
        let lines = content.split("\n");
        for (let line of lines) {
            line = line.trim();
            if (line.length == 0)
                continue;
            tuples.push(JSON.parse(line));
        }
    }
    static readRawFile(content, tuples) {
        let lines = content.split("\n");
        for (let line of lines) {
            line = line.trim().replace("\r", "");
            if (line.length == 0)
                continue;
            tuples.push({ content: line });
        }
    }
    static readCsvFile(content, tuples, csv_has_header, csv_separator, csv_fields) {
        let lines = content.split("\n");
        // if CSV file contains header, use it.
        // otherwise, the first line already contains data
        if (csv_has_header) {
            // read first list and parse fields names
            let header = lines[0].replace("\r", "");
            csv_fields = header.split(csv_separator);
            lines = lines.slice(1);
        }
        for (let line of lines) {
            line = line.trim().replace("\r", "");
            if (line.length == 0)
                continue;
            let values = line.split(csv_separator);
            let result = {};
            for (let i = 0; i < csv_fields.length; i++) {
                result[csv_fields[i]] = values[i];
            }
            tuples.push(result);
        }
    }
}
exports.Utils = Utils;
/** This spout executes specified process, collects its stdout, parses it and emits tuples. */
class ProcessSpout {
    constructor() {
        //this.name = null;
        this.stream_id = null;
        this.file_format = null;
        this.tuples = null;
        this.should_run = false;
    }
    init(name, config, context, callback) {
        //this.name = name;
        this.stream_id = config.stream_id;
        this.cmd_line = config.cmd_line;
        this.file_format = config.file_format || "json";
        this.tuples = [];
        if (this.file_format == "csv") {
            this.csv_separator = config.separator || ",";
            this.csv_fields = config.fields;
            this.csv_has_header = config.csv_has_header;
        }
        this.runProcessAndCollectOutput(callback);
    }
    runProcessAndCollectOutput(callback) {
        let args = this.cmd_line.split(" ");
        let cmd = args[0];
        args = args.slice(1);
        let content2 = cp.spawnSync(cmd, args).output[1];
        let content = content2.toString();
        if (this.file_format == "json") {
            Utils.readJsonFile(content, this.tuples);
        }
        else if (this.file_format == "csv") {
            Utils.readCsvFile(content, this.tuples, this.csv_has_header, this.csv_separator, this.csv_fields);
        }
        else if (this.file_format == "raw") {
            Utils.readRawFile(content, this.tuples);
        }
        else {
            callback(new Error("Unsupported file format: " + this.file_format));
        }
        callback();
    }
    heartbeat() { }
    shutdown(callback) {
        callback();
    }
    run() {
        this.should_run = true;
    }
    pause() {
        this.should_run = false;
    }
    next(callback) {
        if (!this.should_run) {
            return callback(null, null, null);
        }
        if (this.tuples.length === 0) {
            return callback(null, null, null);
        }
        let data = this.tuples[0];
        this.tuples = this.tuples.slice(1);
        callback(null, data, this.stream_id);
    }
}
exports.ProcessSpout = ProcessSpout;
/** This spout spawns specified process and starts collecting its stdout, parsing it and emiting the tuples. */
class ProcessSpoutContinuous {
    constructor() {
        //this.name = null;
        this.stream_id = null;
        this.file_format = null;
        this.tuples = null;
        this.should_run = false;
    }
    init(name, config, context, callback) {
        //this.name = name;
        this.stream_id = config.stream_id;
        this.cmd_line = config.cmd_line;
        this.file_format = config.file_format || "json";
        this.tuples = [];
        if (this.file_format == "csv") {
            this.csv_separator = config.separator || ",";
            this.csv_fields = config.fields;
            this.csv_has_header = config.csv_has_header;
        }
        let self = this;
        ;
        let args = this.cmd_line.split(" ");
        let cmd = args[0];
        args = args.slice(1);
        this.child_process = cp.spawn(cmd, args);
        this.child_process.on("data", (data) => {
            self.handleNewData(data);
        });
        callback();
    }
    handleNewData(content) {
        if (this.file_format == "json") {
            Utils.readJsonFile(content, this.tuples);
        }
        else if (this.file_format == "csv") {
            Utils.readCsvFile(content, this.tuples, this.csv_has_header, this.csv_separator, this.csv_fields);
        }
        else if (this.file_format == "raw") {
            Utils.readRawFile(content, this.tuples);
        }
        else {
            throw new Error("Unsupported file format: " + this.file_format);
        }
    }
    heartbeat() { }
    shutdown(callback) {
        callback();
    }
    run() {
        this.should_run = true;
    }
    pause() {
        this.should_run = false;
    }
    next(callback) {
        if (!this.should_run) {
            return callback(null, null, null);
        }
        if (this.tuples.length === 0) {
            return callback(null, null, null);
        }
        let data = this.tuples[0];
        this.tuples = this.tuples.slice(1);
        callback(null, data, this.stream_id);
    }
}
exports.ProcessSpoutContinuous = ProcessSpoutContinuous;
//# sourceMappingURL=process_spout.js.map