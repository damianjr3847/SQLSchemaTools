import * as libfirebird from 'node-firebird';

export class fbConnection { 
     
    private dbHandle: libfirebird.Database | undefined;
    private tr: libfirebird.Transaction | undefined;
  
    hostName:string        = '';
    portNumber:number      = 3050;
    database:string        = '';
    dbUser:string          = 'SYSDBA';
    dbPassword:string      = 'masterkey';
    lowercase_keys:boolean = false;
    dbrole:any             = null;
    pageSize:number        = 8192;

    constructor(){
    }

    escape = function (value: any){
        return libfirebird.escape(value);
    }

    checkConnectionParams() {            
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

    checkConnection() {
        if (!this.dbHandle)
            throw 'conection is closed';
    }

    checkTransaction() {
        if (!this.tr)
            throw 'transaction is closed';
    }
    
    async connect(this: fbConnection){
        this.checkConnectionParams();

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

        if (this.dbHandle)
            return;

        this.dbHandle = await  new Promise<libfirebird.Database>((resolve, reject) => {
            libfirebird.attach(connectionParams, function(err, db){
                if (err) return reject(err);
                resolve(db);
            });
        });
    } 

    async disconnect(this: fbConnection){
        if (!this.dbHandle)
            return;
        await this.rollback();
        await new Promise<void>((resolve, reject) => {
            this.dbHandle!.detach(function(err) {
                if (err) return reject(err);
                resolve();
            });
        });
        this.dbHandle = undefined;
    }

    async startTransaction(this: fbConnection, aReadOnly: boolean){
        let tType: libfirebird.Isolation;              
        
        if (aReadOnly) {
            tType = libfirebird.ISOLATION_READ_COMMITED_READ_ONLY;        
        }
        else {
            tType = libfirebird.ISOLATION_READ_COMMITED;
        }            

        this.checkConnection;
        this.tr = await new Promise<libfirebird.Transaction>((resolve, reject) => {
            this.dbHandle!.transaction(tType, function(err, rs){
                if (err) return reject(err);
                resolve(rs);
            });
        });
    } 

    async commit(this: fbConnection){
        this.checkTransaction();
        await new Promise<void>((resolve, reject) => {
            this.tr!.commit(function(err) {
                if (err) return reject(err);
                resolve();
            });
        });
        this.tr = undefined;
    } 

    async rollback(this: fbConnection){
        this.checkTransaction();
        await new Promise<void>((resolve, reject) => {
            this.tr!.rollback(function(err) {
                if (err) return reject(err);
                resolve();
            });
        });
        this.tr = undefined;
    } 

    query(this: fbConnection, aQuery: string, aParams: Array<any>){
        this.checkTransaction();
        return new Promise<any>((resolve, reject) => {
            this.tr!.query(aQuery, aParams, function(err: any, result: any) {
                if (err) return reject(err);
                resolve(result);
            });
        });
    }

    execute(this: fbConnection, aQuery: string, aParams: Array<any>){
        this.checkTransaction();
        return new Promise<any>((resolve, reject) => {
            this.tr!.execute(aQuery, aParams, function(err: any, result: any) {
                if (err) return reject(err);
                resolve(result);
            });
        });
    }

}