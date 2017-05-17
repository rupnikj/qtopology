"use strict";

const fs = require("fs");
const async = require("async");
const tn = require("../../..").local;
const validator = require("../../..").util.validation;

// demo configuration
let config = require("./topology.json");
validator.validate({ config: config, exitOnError: true });
let topology = new tn.TopologyLocal();

async.series(
    [
        (xcallback) => {
            console.log("Starting init");
            topology.init(config, xcallback);
        },
        (xcallback) => {
            console.log("Init done");
            topology.run();
            setTimeout(function () {
                xcallback();
            }, 2000);
        },
        (xcallback) => {
            fs.appendFileSync("./temp_file.tmp", "Some content\n", {encoding: "utf8"});
            setTimeout(function () {
                xcallback();
            }, 2000);
        },
        (xcallback) => {
            fs.appendFileSync("./temp_file.tmp", "Another content\n", {encoding: "utf8"});
            setTimeout(function () {
                xcallback();
            }, 2000);
        },
        (xcallback) => {
            fs.unlinkSync("./temp_file.tmp");
            setTimeout(function () {
                xcallback();
            }, 2000);
        },
        (xcallback) => {
            console.log("Starting shutdown sequence...");
            topology.shutdown(xcallback);
        }
    ],
    (err) => {
        if (err) {
            console.log("Error in shutdown", err);
        }
        console.log("Finished.");
    }
);


function shutdown() {
    if (topology) {
        topology.shutdown((err) => {
            if (err) {
                console.log("Error", err);
            }
            process.exit(1);
        });
        topology = null;
    }
}

//do something when app is closing
process.on('exit', shutdown);

//catches ctrl+c event
process.on('SIGINT', shutdown);

//catches uncaught exceptions
process.on('uncaughtException', shutdown);