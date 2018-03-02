import * as fs from 'fs-extra';
import * as fbClass from './classFirebird2';

let fb : fbClass.fbConnection;

export async function writeYalm(ahostName:string, aportNumber:number, adatabase:string, adbUser:string, adbPassword:string)  {
    

    fb = new fbClass.fbConnection();    

    fb.database = adatabase;
    fb.dbPassword = adbPassword;
    fb.dbUser = adbUser;
    fb.hostName = ahostName;
    fb.portNumber = aportNumber;

    let db = await fb.connect();
    let tr = await fb.startTransaction(true);

    let rs = await this.query('SELECT FCODIGO, FDESCRI FROM ART_LIPR',[]);

    await this.commit;
    await this.disconnect;

    console.log('r2 %j',rs);    
}

export function readYalm() {

}

