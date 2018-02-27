"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var libfirebird = require("node-firebird");
var fbConnection = /** @class */ (function () {
    function fbConnection() {
        this.hostName = '';
        this.portNumber = 3050;
        this.database = '';
        this.dbUser = 'SYSDBA';
        this.dbPassword = 'masterkey';
        this.lowercase_keys = false;
        this.dbrole = null;
        this.pageSize = 4096;
        /*
        */
    }
    fbConnection.prototype.checkConnectionParams = function () {
        console.log('zaraza___' + this.hostName);
        if (this.hostName === '') {
            throw 'Connection error: hostName empty';
        }
        if (this.portNumber === 0) {
            throw 'Connection error: invalid portNumber';
        }
        if (this.database === '') {
            throw 'Connection error: database Empty';
        }
        if (this.dbUser === '') {
            throw 'Connection error: dbUser Empty';
        }
        if (this.dbPassword === '') {
            throw 'Connection error: dbPassword Empty';
        }
        this.connectionParams.host = this.hostName;
        this.connectionParams.database = this.database;
        this.connectionParams.lowercase_keys = this.lowercase_keys;
        this.connectionParams.pageSize = this.pageSize;
        this.connectionParams.password = this.dbPassword;
        this.connectionParams.port = this.portNumber;
        this.connectionParams.role = this.dbrole;
        this.connectionParams.user = this.dbUser;
    };
    fbConnection.prototype.selectquery = function (aQuery, aParams, atransactionReadOnly) {
        if (atransactionReadOnly === void 0) { atransactionReadOnly = true; }
        var tType;
        this.checkConnectionParams();
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
