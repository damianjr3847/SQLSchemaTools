"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var libfirebird = require("node-firebird");
var fbConnection = /** @class */ (function () {
    function fbConnection() {
        /*
        */
    }
    fbConnection.prototype.selectquery = function (aQuery, aParams, atransactionReadOnly) {
        if (atransactionReadOnly === void 0) { atransactionReadOnly = true; }
        var tType;
        if (atransactionReadOnly) {
            tType = libfirebird.ISOLATION_READ_COMMITED_READ_ONLY;
        }
        else {
            tType = libfirebird.ISOLATION_READ_COMMITED;
        }
        libfirebird.attach(this.connectionParams, function (err, db) {
            if (err)
                throw err;
            // db = DATABASE
            db.transaction(tType, function (err, transaction) {
                transaction.query(aQuery, aParams, function (err, result) {
                    if (err) {
                        transaction.rollback();
                        return;
                    }
                    transaction.commit(function (err) {
                        if (err)
                            transaction.rollback();
                        else
                            db.detach();
                    });
                    return result;
                });
            });
        });
    };
    return fbConnection;
}());
exports.fbConnection = fbConnection;
