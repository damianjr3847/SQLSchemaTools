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
    r = fb.selectquery('SELECT FCODIGO, FDESCRI FROM ART_LIPR',[],true);
    console.log(r);    
}

export function readYalm() {

}

