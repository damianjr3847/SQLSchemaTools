import * as libfirebird from 'node-firebird';
import * as q from 'q';

export class fbConnection { 
    private 
        connectionParams : libfirebird.Options;  
        db: libfirebird.Database;
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

        internalConnect = function (){
            var def = q.defer();
         
            this.checkConnectionParams();

            libfirebird.attach( this.connectionParams,
               function(err, db){
                  err ? def.reject(err) : def.resolve(db);
               }
            );

            return def.promise;
        };

        internalStartTransaction = function (aReadOnly){
            var def = q.defer();

            let tType : libfirebird.Isolation;              
            
            if (aReadOnly) {
                tType = libfirebird.ISOLATION_READ_COMMITED_READ_ONLY;        
            }
            else {
                tType = libfirebird.ISOLATION_READ_COMMITED;
            }            

            this.db.transaction(tType, function(err, rs){
                err ? def.reject(err) : def.resolve(rs);
            });

            return def.promise;
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

        async connect(){
            this.db = await this.internalConnect();
        } 

        async startTransaction(aReadOnly){
            this.tr = await this.internalStartTransaction(aReadOnly);
        } 

        disconnect = function (){
            var def = q.defer();
            
            this.db.detach(function(err) {
                err ? def.reject(err) : def.resolve(null);
            });

            return def.promise;
        }

        commit = function (){
            var def = q.defer();
            
            this.tr.commit(function(err) {
                err ? def.reject(err) : def.resolve(null);
            });

            return def.promise;
        }

        query = function (aQuery, aParams){
            var def = q.defer();

            this.tr.query(aQuery, aParams, function(err, result) {
                err ? def.reject(err) : def.resolve(result);
            });

            return def.promise;
        }

}