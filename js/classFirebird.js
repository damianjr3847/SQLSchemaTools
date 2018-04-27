"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const libfirebird = require("node-firebird");
function getBlob(blobField, blobType) {
    let value;
    if (blobType === 'text')
        value = '';
    return new Promise((resolve, reject) => {
        blobField(async function (err, name, e) {
            if (err)
                return reject(err);
            await new Promise(function (resolve) {
                e.on('data', function (chunk) {
                    value += chunk;
                });
                e.on('end', function () {
                    resolve();
                });
                e.on('error', function (err) {
                    reject(err);
                });
            });
            resolve(value);
        });
    });
}
exports.getBlob = getBlob;
class fbConnection {
    constructor() {
        this.hostName = 'localhost';
        this.portNumber = 3050;
        this.database = '';
        this.dbUser = 'SYSDBA';
        this.dbPassword = 'masterkey';
        this.lowercase_keys = false;
        this.dbrole = null;
        this.pageSize = 8192;
        this.escape = function (value) {
            return libfirebird.escape(value);
        };
    }
    checkConnectionParams() {
        if (this.hostName === '')
            throw new Error('Connection error: hostName empty');
        if (this.portNumber === 0)
            throw new Error('Connection error: invalid portNumber');
        if (this.database === '')
            throw new Error('Connection error: database Empty');
        if (this.dbUser === '')
            throw new Error('Connection error: dbUser Empty');
        if (this.dbPassword === '')
            throw new Error('Connection error: dbPassword Empty');
    }
    checkInConnection() {
        if (!this.db)
            throw new Error('conection is closed');
    }
    checkInTransaction() {
        if (!this.tr)
            throw new Error('transaction is closed');
    }
    connected() {
        return this.db !== undefined;
    }
    inTransaction() {
        return this.tr !== undefined;
    }
    async connect() {
        this.checkConnectionParams();
        let connectionParams = {
            host: this.hostName,
            port: this.portNumber,
            database: this.database,
            password: this.dbPassword,
            user: this.dbUser,
            lowercase_keys: this.lowercase_keys,
            role: this.dbrole,
            pageSize: this.pageSize
        };
        if (this.db)
            return;
        this.db = await new Promise((resolve, reject) => {
            libfirebird.attach(connectionParams, function (err, db) {
                if (err)
                    return reject(err);
                resolve(db);
            });
        });
    }
    async disconnect() {
        if (!this.db)
            return;
        if (this.tr)
            await this.rollback();
        await new Promise((resolve, reject) => {
            this.db.detach(function (err) {
                if (err)
                    return reject(err);
                resolve();
            });
        });
        this.db = undefined;
    }
    async startTransaction(aReadOnly) {
        let tType;
        if (aReadOnly) {
            tType = libfirebird.ISOLATION_READ_COMMITED_READ_ONLY;
        }
        else {
            tType = libfirebird.ISOLATION_READ_COMMITED;
        }
        this.checkInConnection;
        this.tr = await new Promise((resolve, reject) => {
            this.db.transaction(tType, function (err, rs) {
                if (err)
                    return reject(err);
                resolve(rs);
            });
        });
    }
    async commit() {
        this.checkInTransaction();
        await new Promise((resolve, reject) => {
            this.tr.commit(function (err) {
                if (err)
                    return reject(err);
                resolve();
            });
        });
        this.tr = undefined;
    }
    async rollback() {
        this.checkInTransaction();
        await new Promise((resolve, reject) => {
            this.tr.rollback(function (err) {
                if (err)
                    return reject(err);
                resolve();
            });
        });
        this.tr = undefined;
    }
    query(aQuery, aParams) {
        this.checkInTransaction();
        return new Promise((resolve, reject) => {
            this.tr.query(aQuery, aParams, function (err, result) {
                if (err)
                    return reject(err);
                resolve(result);
            });
        });
    }
    execute(aQuery, aParams) {
        this.checkInTransaction();
        return new Promise((resolve, reject) => {
            this.tr.execute(aQuery, aParams, function (err, result) {
                if (err)
                    return reject(err);
                resolve(result);
            });
        });
    }
    /*getBlobAsString(blobField: any) {
        let value: string = '';

        return new Promise<string>((resolve, reject) => {
            blobField(async function(err: any, name: string, e: any){
                if (err) return reject(err);

                await new Promise(function( resolve ){
                    e.on('data', function(chunk:any) {
                        value += chunk;
                    });
                    e.on('end', function() {
                        resolve();
                    });
                })

                resolve(value);
            });
        });
    }*/
    validate(aQuery, aParams) {
        let res;
        this.checkInTransaction();
        return new Promise((resolve, reject) => {
            this.tr.query(aQuery, aParams, function (err, result) {
                if (err)
                    return reject(err);
                resolve(result.length > 0);
            });
        });
    }
    ;
    trSequentially(aQuery, aParams, aFunctionRow) {
        this.checkInTransaction();
        return new Promise((resolve, reject) => {
            this.tr.sequentially(aQuery, aParams, async function (row, index, next) {
                aFunctionRow(row, index);
                next();
            }, function (err) {
                if (err)
                    return reject(err);
                resolve();
            });
        });
    }
    dbSequentially(aQuery, aParams, aFunctionRow) {
        this.checkInConnection();
        return new Promise((resolve, reject) => {
            this.db.sequentially(aQuery, aParams, async function (row, index, next) {
                aFunctionRow(row, index);
                next();
            }, function (err) {
                if (err)
                    return reject(err);
                resolve();
            });
        });
    }
}
exports.fbConnection = fbConnection;
//# sourceMappingURL=classFirebird.js.map