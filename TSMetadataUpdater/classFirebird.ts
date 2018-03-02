import * as libfirebird from 'node-firebird';

export class fbConnection { 
    private 
        connectionParams : libfirebird.Options;  
        dbHandle: libfirebird.Database;
        tr: libfirebird.Transaction;
  
        checkConnectionParams() {            
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
                                    pageSize: this.pageSize};            
        }           

        internalConnect(): Promise<libfirebird.Database> {
            return new Promise<libfirebird.Database>((resolve, reject) => {
                libfirebird.attach( this.connectionParams, function(err, db){
                    if (err) return reject(err);
                    resolve(db);
                });
            });
        }

        internalDisconnect = function (){
            return new Promise<null>((resolve, reject) => {
                this.dbHandle.detach(function(err) {
                    if (err) return reject(err);
                    resolve(null);
                });
            });
        }
        
        internalStartTransaction = function (aReadOnly){
            let tType : libfirebird.Isolation;              
            
            if (aReadOnly) {
                tType = libfirebird.ISOLATION_READ_COMMITED_READ_ONLY;        
            }
            else {
                tType = libfirebird.ISOLATION_READ_COMMITED;
            }            

            return new Promise<libfirebird.Transaction>((resolve, reject) => {
                this.dbHandle.transaction(tType, function(err, rs){
                    if (err) return reject(err);
                    resolve(rs);
                });
            });
        }

        internalCommit = function (){
            return new Promise<null>((resolve, reject) => {
                this.tr.commit(function(err) {
                    if (err) return reject(err);
                    resolve(null);
                });
            });
        }

        internalRollback = function (){
            return new Promise<null>((resolve, reject) => {
                this.tr.rollback(function(err) {
                    if (err) return reject(err);
                    resolve(null);
                });
            });
        }

    public
        hostName:string        = '';
        portNumber:number      = 3050;
        database:string        = '';
        dbUser:string          = 'SYSDBA';
        dbPassword:string      = 'masterkey';
        lowercase_keys:boolean = false;
        dbrole:any             = null;
        pageSize:number        = 8192;
        constructor(){
            /* 
            */
        }

        escape = function (value){
            return libfirebird.escape(value);
        }

        get db(){
            if (this.dbHandle === undefined) 
                throw 'connection is not active';
            return this.dbHandle;
        }

        async connect(){
            if (this.dbHandle === undefined) {
                this.checkConnectionParams();
                this.dbHandle = await this.internalConnect();
            }
        } 

        async disconnect(){
            await this.rollback();
            if (this.dbHandle !== undefined) {
                await this.internalDisconnect();
                this.dbHandle = undefined;
            }
        }

        async startTransaction(aReadOnly){
            if (this.tr === undefined) {
                this.tr = await this.internalStartTransaction(aReadOnly);
            }
        } 

        async commit(){
            if (this.tr !== undefined) {
                await this.internalCommit();
                this.tr = undefined;
            }
        } 

        async rollback(){
            if (this.tr !== undefined) {
                await this.internalRollback();
                this.tr = undefined;
            }
        } 

        query = function (aQuery, aParams){
            return new Promise<any>((resolve, reject) => {
                this.tr.query(aQuery, aParams, function(err, result) {
                    if (err) return reject(err);
                    resolve(result);
                });
            });
        }

        execute = function (aQuery, aParams){
            return new Promise<any>((resolve, reject) => {
                this.tr.execute(aQuery, aParams, function(err, result) {
                    if (err) return reject(err);
                    resolve(result);
                });
            });
        }

}