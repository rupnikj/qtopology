"use strict";
var spt = require("./spout_common");
exports.create = function (context) {
    return new spt.MySpout(context);
};
