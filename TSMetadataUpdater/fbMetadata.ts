import * as fs from 'fs-extra';
import * as fbClass from './classFirebird';

let fb : fbClass.fbConnection;

export async function writeYalm(ahostName:string, aportNumber:number, adatabase:string, adbUser:string, adbPassword:string)  {
    

    fb = new fbClass.fbConnection();    

    fb.database = adatabase;
    fb.dbPassword = adbPassword;
    fb.dbUser = adbUser;
    fb.hostName = ahostName;
    fb.portNumber = aportNumber;

    await fb.connect();
    await fb.startTransaction(true);

    let rs = await fb.query('SELECT FCODIGO, FDESCRI FROM ART_LIPR',[]);

    await fb.commit();
    await fb.disconnect();

    console.log('r2 %j',rs);    
}

export function readYalm() {

}

