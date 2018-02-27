import * as fs from 'fs-extra';
import * as fbClass from './classFirebird';

let fb : fbClass.fbConnection;

export function writeYalm(ahostName:string, aportNumber:number, adatabase:string, adbUser:string, adbPassword:string)  {
    let r;    
    fb = new fbClass.fbConnection();
    
    
    console.log('connectionString: %j',ahostName+':'+adatabase);
    console.log('dbPort: %j', aportNumber);
    console.log('dbUser: %j', adbUser);
    console.log('dbPass: %j',adbPassword);


    /*fb.connectionParams.database = adatabase;
    fb.connectionParams.password = adbPassword;
    fb.connectionParams.user = adbUser;
    fb.connectionParams.host = ahostName;
    fb.connectionParams.port = aportNumber;*/

    /*fb.connectionParams.database = '/pool/testing/demo.gdb';
    fb.connectionParams.password = 'masterkey';
    fb.connectionParams.user = 'SYSDBA';
    fb.connectionParams.host = 'srv-01.sig2k.com';
    fb.connectionParams.port = 3050;*/

    fb.connectionParams = {host:'srv-01.sig2k.com',port:3050, database:'/pool/testing/demo.gdb',password:'masterkey', user:'SYSDBA',lowercase_keys:false,role:null,pageSize:4096};

    r = fb.selectquery('SELECT FCODIGO, FDESCRI FROM ART_LIPR',[],true);
    console.log(r);    
}

export function readYalm() {

}

