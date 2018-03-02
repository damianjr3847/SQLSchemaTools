import * as libfirebird from 'node-firebird';

export class fbConnection { 
     
    private dbHandle: libfirebird.Database | undefined;
    private tr: libfirebird.Transaction | undefined;
  
    private checkConnection() {
        if (!this.dbHandle)
            throw 'conection is closed';
    }

    private checkConnectionParams() {            
        if (this.hostName === '')
            throw 'Connection error: hostName empty';
        if (this.portNumber === 0)
            throw 'Connection error: invalid portNumber';
        if (this.database === '')
            throw 'Connection error: database Empty';
        if (this.dbUser === '')
            throw 'Connection error: dbUser Empty';
        if (this.dbPassword === '')
            throw 'Connection error: dbPassword Empty';
    }           

    private internalConnect(): Promise<libfirebird.Database> {
        let connectionParams: libfirebird.Options = {
            host: this.hostName,
            port: this.portNumber,
            database: this.database,
            password: this.dbPassword,
            user: this.dbUser,
            lowercase_keys: this.lowercase_keys,
            role: this.dbrole,
            pageSize: this.pageSize
        };            

        return new Promise<libfirebird.Database>((resolve, reject) => {
            libfirebird.attach(connectionParams, function(err, db){
                if (err) return reject(err);
                resolve(db);
            });
        });
    }

    private internalDisconnect = function (db: libfirebird.Database){
        return new Promise<void>((resolve, reject) => {
            db.detach(function(err) {
                if (err) return reject(err);
                resolve();
            });
        });
    }
    
    private checkTransaction() {
        if (!this.tr)
            throw 'transaction is closed';
    }

    private internalStartTransaction = function (db: libfirebird.Database, aReadOnly: boolean){
        let tType : libfirebird.Isolation;              
        
        if (aReadOnly) {
            tType = libfirebird.ISOLATION_READ_COMMITED_READ_ONLY;        
        }
        else {
            tType = libfirebird.ISOLATION_READ_COMMITED;
        }            

        return new Promise<libfirebird.Transaction>((resolve, reject) => {
            db.transaction(tType, function(err, rs){
                if (err) return reject(err);
                resolve(rs);
            });
        });
    }

    private internalCommit = function (tr: libfirebird.Transaction){
        return new Promise<void>((resolve, reject) => {
            tr.commit(function(err) {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    private internalRollback = function (tr: libfirebird.Transaction){
        return new Promise<void>((resolve, reject) => {
            tr.rollback(function(err) {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    /******************************* public ********************************/
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

    escape = function (value: any){
        return libfirebird.escape(value);
    }

    get db(this: fbConnection){
        if (!this.dbHandle) 
            throw 'connection is not active';
        return this.dbHandle;
    }

    async connect(this: fbConnection){
        if (!this.dbHandle) {
            this.checkConnectionParams();
            this.dbHandle = await this.internalConnect();
        }
    } 

    async disconnect(this: fbConnection){
        await this.rollback();
        if (this.dbHandle) {
            await this.internalDisconnect(this.dbHandle);
            this.dbHandle = undefined;
        }
    }

    async startTransaction(this: fbConnection, aReadOnly: boolean){
        this.checkConnection;
        if (!this.tr) {
            this.tr = await this.internalStartTransaction(this.dbHandle!, aReadOnly);
        }
    } 

    async commit(this: fbConnection){
        if (this.tr) {
            await this.internalCommit(this.tr);
            this.tr = undefined;
        }
    } 

    async rollback(this: fbConnection){
        if (this.tr) {
            await this.internalRollback(this.tr);
            this.tr = undefined;
        }
    } 

    query = function (this: fbConnection, aQuery: string, aParams: Array<any>){
        this.checkTransaction();
        return new Promise<any>((resolve, reject) => {
            this.tr!.query(aQuery, aParams, function(err: any, result: any) {
                if (err) return reject(err);
                resolve(result);
            });
        });
    }

    execute = function (this: fbConnection, aQuery: string, aParams: Array<any>){
        this.checkTransaction();
        return new Promise<any>((resolve, reject) => {
            this.tr!.execute(aQuery, aParams, function(err: any, result: any) {
                if (err) return reject(err);
                resolve(result);
            });
        });
    }

}