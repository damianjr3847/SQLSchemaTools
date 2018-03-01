import * as fs from 'fs-extra';
import * as fbClass from './classFirebird';

let fb : fbClass.fbConnection;

export function writeYalm(ahostName:string, aportNumber:number, adatabase:string, adbUser:string, adbPassword:string)  {
    

    let r;    
    fb = new fbClass.fbConnection();    

    fb.database = adatabase;
    fb.dbPassword = adbPassword;
    fb.dbUser = adbUser;
    fb.hostName = ahostName;
    fb.portNumber = aportNumber;

    Promise.resolve(fb.selectquery('SELECT FCODIGO, FDESCRI FROM ART_LIPR',[],true)).then(() => {console.log('r3 %j',r);});
    console.log('r2 %j',r);    
}

export function readYalm() {

}

