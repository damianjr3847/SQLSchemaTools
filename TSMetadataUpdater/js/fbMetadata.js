"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fbClass = require("./classFirebird");
var fb;
function writeYalm(ahostName, aportNumber, adatabase, adbUser, adbPassword) {
    var r;
    fb = new fbClass.fbConnection();
    fb.database = adatabase;
    fb.dbPassword = adbPassword;
    fb.dbUser = adbUser;
    fb.hostName = ahostName;
    fb.portNumber = aportNumber;
    r = fb.selectquery('SELECT FCODIGO, FDESCRI FROM ART_LIPR', [], true);
    console.log(r);
}
exports.writeYalm = writeYalm;
function readYalm() {
}
exports.readYalm = readYalm;
