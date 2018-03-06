import * as libfirebird from 'node-firebird';

export class fbConnection { 
     
    private db: libfirebird.Database | undefined;
    private tr: libfirebird.Transaction | undefined;
  
    hostName:string        = 'localhost';
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

    checkInConnection() {
        if (!this.db)
            throw 'conection is closed';
    }

    checkInTransaction() {
        if (!this.tr)
            throw 'transaction is closed';
    }
    
    connected(): boolean {
        return this.db !== undefined;
    }

    inTransaction(): boolean {
        return this.tr !== undefined;
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

        if (this.db)
            return;

        this.db = await new Promise<libfirebird.Database>((resolve, reject) => {
            libfirebird.attach(connectionParams, function(err, db){
                if (err) return reject(err);
                resolve(db);
            });
        });
    } 

    async disconnect(this: fbConnection){
        if (!this.db)
            return;
        if (this.tr)         
            await this.rollback();
        await new Promise<void>((resolve, reject) => {
            this.db!.detach(function(err) {
                if (err) return reject(err);
                resolve();
            });
        });
        this.db = undefined;
    }

    async startTransaction(this: fbConnection, aReadOnly: boolean){
        let tType: libfirebird.Isolation;              
        
        if (aReadOnly) {
            tType = libfirebird.ISOLATION_READ_COMMITED_READ_ONLY;        
        }
        else {
            tType = libfirebird.ISOLATION_READ_COMMITED;
        }            

        this.checkInConnection;
        this.tr = await new Promise<libfirebird.Transaction>((resolve, reject) => {
            this.db!.transaction(tType, function(err, rs){
                if (err) return reject(err);
                resolve(rs);
            });
        });
    } 

    async commit(this: fbConnection){
        this.checkInTransaction();
        await new Promise<void>((resolve, reject) => {
            this.tr!.commit(function(err) {
                if (err) return reject(err);
                resolve();
            });
        });
        this.tr = undefined;
    } 

    async rollback(this: fbConnection){
        this.checkInTransaction();
        await new Promise<void>((resolve, reject) => {
            this.tr!.rollback(function(err) {
                if (err) return reject(err);
                resolve();
            });
        });
        this.tr = undefined;
    } 

    query(this: fbConnection, aQuery: string, aParams: Array<any>){
        this.checkInTransaction();
        return new Promise<any>((resolve, reject) => {
            this.tr!.query(aQuery, aParams, function(err: any, result: any) {
                if (err) return reject(err);
                resolve(result);
            });
        });
    }

    execute(this: fbConnection, aQuery: string, aParams: Array<any>){
        this.checkInTransaction();
        return new Promise<any>((resolve, reject) => {
            this.tr!.execute(aQuery, aParams, function(err: any, result: any) {
                if (err) return reject(err);
                resolve(result);
            });
        });
    }

    getBlobAsString(blobField: any) {
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
    }

}