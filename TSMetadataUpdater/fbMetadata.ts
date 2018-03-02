import * as fs from 'fs-extra';
import * as fbClass from './classFirebird';

let fb : fbClass.fbConnection;

export async function writeYalm(ahostName:string, aportNumber:number, adatabase:string, adbUser:string, adbPassword:string)  {
    let rs;

    fb = new fbClass.fbConnection();    

    fb.database = adatabase;
    fb.dbPassword = adbPassword;
    fb.dbUser = adbUser;
    fb.hostName = ahostName;
    fb.portNumber = aportNumber;

    try {

        await fb.connect();
        try {
            await fb.startTransaction(true);

            rs = await fb.query('SELECT FCODIGO, FDESCRI FROM ART_LIPR',[]);
            console.log('r2 %j',rs);    

            rs = await fb.query('SELECT FCODIGO, FDESCRI FROM ART_LIPR',[]);
            console.log('r2 %j',rs);    

            rs = await fb.query('SELECT aaFCODIGO, FDESCRI FROM ART_LIPR',[]);
            console.log('r2 %j',rs);    

            await fb.commit();
        }
        finally {
            await fb.disconnect();
        }

    }
    catch (err) {
        console.log('Error: ', err.message);
    }

}

export function readYalm() {

}

