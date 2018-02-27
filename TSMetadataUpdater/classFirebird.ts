import * as libfirebird from 'node-firebird';

export class fbConnection {    
    public connectionParams : libfirebird.Options;
    constructor(){
        /* 
        */
    }    
    public selectquery(aQuery:string, aParams: any[], atransactionReadOnly: boolean = true) {
        let tType : libfirebird.Isolation;              

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