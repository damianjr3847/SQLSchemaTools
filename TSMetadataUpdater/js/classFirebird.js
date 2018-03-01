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
        this.connectionParams = {
            host: this.hostName,
            port: this.portNumber,
            database: this.database,
            password: this.dbPassword,
            user: this.dbUser,
            lowercase_keys: this.lowercase_keys,
            role: this.dbrole,
            pageSize: this.pageSize
        };
    };
    fbConnection.prototype.zaraza = function (aQuery, aParams, tType) {
    };
    fbConnection.prototype.selectquery = function (aQuery, aParams, atransactionReadOnly) {
        if (atransactionReadOnly === void 0) { atransactionReadOnly = true; }
        var pr;
        var tType;
        var queryRows;
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
            db.transaction(tType, function (err, transaction) {
                transaction.query(aQuery, aParams, function (err, result) {
                    if (err) {
                        transaction.rollback();
                        return;
                    }
                    queryRows = result;
                    //return resolve(result);
                    //console.log('result transaction: %j',queryRows);
                    transaction.commit(function (err) {
                        if (err)
                            transaction.rollback();
                        else
                            db.detach();
                    });
                    return queryRows;
                });
            });
        });
        //console.log('r1 %j',queryRows); 
    };
    return fbConnection;
}());
exports.fbConnection = fbConnection;
//# sourceMappingURL=classFirebird.js.map