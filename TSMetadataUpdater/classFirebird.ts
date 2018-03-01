import * as libfirebird from 'node-firebird';

const {promisify} = require('util');
const attachAsync = promisify(libfirebird.attach);

//import * as q from 'q';

export class fbConnection { 
    private 
        connectionParams : libfirebird.Options;    
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
    public  
        hostName:string        = '';
        portNumber:number      = 3050;
        database:string        = '';
        dbUser:string          = 'SYSDBA';
        dbPassword:string      = 'masterkey';
        lowercase_keys:boolean = false;
        dbrole:any             = null;
        pageSize:number        = 4096;
        constructor(){
            /* 
            */
        }

        connectToDB = function (acfg){
            var def = q.defer();
         
            libfirebird.attach( acfg,
               function(err, db){
                  err ? def.reject(err) : def.resolve(db);
               }
            );
            return def.promise;
        };

        async selectquery(aQuery:string, aParams: any[], atransactionReadOnly: boolean = true) {
            let db;
            let tType : libfirebird.Isolation;              
            let queryRows;
        
            this.checkConnectionParams();
            
            if (atransactionReadOnly) {
                tType = libfirebird.ISOLATION_READ_COMMITED_READ_ONLY;        
            }
            else {
                tType = libfirebird.ISOLATION_READ_COMMITED;
            }            
            

            db = await attachAsync(this.connectionParams);
            //db = await this.connectToDB(this.connectionParams);


            libfirebird.attach(this.connectionParams, function(err, db) { 
                            if (err)                  
                                throw err;
                            
                            db.transaction(tType, function(err, transaction) {
                                transaction.query(aQuery, aParams, function(err, result) {
                        
                                    if (err) {
                                        transaction.rollback();
                                        return;
                                    }
                                    
                                    queryRows= result;

                                    //return resolve(result);
                                    //console.log('result transaction: %j',queryRows);
            
                                    transaction.commit(function(err) {
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
            
        } 
        /*selectquery(aQuery:string, aParams: any[], atransactionReadOnly: boolean = true) {
            let pr;
            let tType : libfirebird.Isolation;              
            let queryRows;
        
            this.checkConnectionParams();
            
            if (atransactionReadOnly) {
                tType = libfirebird.ISOLATION_READ_COMMITED_READ_ONLY;        
            }
            else {
                tType = libfirebird.ISOLATION_READ_COMMITED;
            }   

            pr = new //(function(resolve, reject) {
                let prres; 
                libfirebird.attach(this.connectionParams, function(err, db) { 
                    if (err)                  
                        throw err;
                    
                    db.transaction(tType, function(err, transaction) {
                        transaction.query(aQuery, aParams, function(err, result) {
                 
                            if (err) {
                                transaction.rollback();
                                return;
                            }
    
                            //queryRows= result;
                            prres = result;        
                            //console.log('result transaction: %j',queryRows);
    
                            transaction.commit(function(err) {
                                if (err)
                                    transaction.rollback();
                                else
                                    db.detach();
                            });
                        });
                    });
                });
                resolve(prres)
              });
            
          
            //.resolve().then(function (result) {    
            console.log('r1 %j',queryRows) }); 
            //return queryRows;                            
        }  */  
}