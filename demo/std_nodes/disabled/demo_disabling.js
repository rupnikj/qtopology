"use strict";

const async = require("async");
const qtopology = require("../../..");

let config = require("./topology.json");
qtopology.validate({ config: config, exitOnError: true });
let topology = new qtopology.TopologyLocal();

async.series(
    [
        (xcallback) => {
            topology.init("topology.1", config, xcallback);
        },
        (xcallback) => {
            console.log("Init done");
            topology.run(xcallback);
        },
        (xcallback) => {
            console.log("Waiting - 5 sec");
            setTimeout(() => { xcallback(); }, 5000);
        },
        (xcallback) => {
            console.log("Starting shutdown sequence...");
            topology.shutdown(xcallback);
            topology = null;
        }
    ],
    (err) => {
        if (err) {
            console.log("Error in shutdown", err);
        }
        console.log("Finished.");
    }
);


function shutdown(err) {

    if (err) {
        console.log("Error", err);
    }
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
process.on('uncaughtException', (err) => { shutdown(err); });
