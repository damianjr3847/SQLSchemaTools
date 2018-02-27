import * as libfirebird from 'node-firebird';

export class fbConnection {
    public hostName:string = '';
    public portNumber:number = 3050;
    public database:string = '';
    public dbUser:string = 'SYSDBA';
    public dbPassword:string = 'masterkey';
    public lowercase_keys:boolean = false;
    public dbrole:any = null;
    public pageSize:number = 4096;
    private connectionParams : libfirebird.Options;
    constructor(){
        /* 
        */
    }
    private checkConnectionParams() {
        console.log('zaraza___'+this.hostName);
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
    }
    public selectquery(aQuery:string, aParams: any[], atransactionReadOnly: boolean = true) {
        let tType : libfirebird.Isolation;
        
        this.checkConnectionParams();

        if (atransactionReadOnly) {
            tType = libfirebird.ISOLATION_READ_COMMITED_READ_ONLY;        
        }
        else {
            tType = libfirebird.ISOLATION_READ_COMMITED;
        }

        libfirebird.attach(this.connectionParams, function(err, db) {
            
            if (err)
                throw err;
        
            // db = DATABASE
            db.transaction(tType, function(err, transaction) {
                transaction.query(aQuery, aParams, function(err, result) {
                    if (err) {
                        transaction.rollback();
                        return;
                    }                                        
                    transaction.commit(function(err) {
                        if (err)
                            transaction.rollback();
                        else
                            db.detach();
                    });
                    return result;
                });
            });
        });    
        
    }
}