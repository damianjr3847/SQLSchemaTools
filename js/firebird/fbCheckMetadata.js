"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fbClass = require("./classFirebird");
const GlobalTypes = require("../common/globalTypes");
const metadataQuerys = require("./fbMetadataQuerys");
class fbCheckMetadata {
    constructor(aConnection = undefined) {
        //****************************************************************** */
        //        D E C L A R A C I O N E S    P U B L I C A S
        //******************************************************************* */
        this.filesPath = '';
        this.excludeFrom = false;
        this.nofolders = false;
        this.fb = new fbClass.fbConnection;
    }
    async checkIndexes(aobjectName) {
        let dbIdx = [];
        let tAux = '';
        console.log(' ');
        console.log(' ');
        try {
            await this.fb.startTransaction(true);
            try {
                dbIdx = await this.fb.query(metadataQuerys.queryCheckIndexes, []);
                if (dbIdx.length > 0) {
                    console.log('\x1b[31m' + 'REVISAR LOS SIGUIENTES INDICES REDUNDANTES: ');
                    console.log('\x1b[31m\x1b[5m' + '************************************************************');
                    console.log('\x1b[31m\x1b[5m' + '***                 A D V E R T E N C I A                ***');
                    console.log('\x1b[31m\x1b[5m' + '***  ESTO NO QUIERE DECIR QUE TENGA QUE BORRAR ESTOS     ***');
                    console.log('\x1b[31m\x1b[5m' + '***          INDICES EN FORMA INDISCRIMINADA             ***');
                    console.log('\x1b[31m\x1b[5m' + '***       REVISE USTED CUAL ES NECESARIO BORRAR          ***');
                    console.log('\x1b[31m\x1b[5m' + '************************************************************');
                }
                for (let i = 0; i < dbIdx.length; i++) {
                    /*table_name,Deletioncandidateindex,Deletioncandidatecolumns,Existingindex,Existingcolumns"*/
                    if (tAux === '' || tAux !== dbIdx[i].table_name) {
                        tAux = dbIdx[i].table_name;
                        console.log('\x1b[0m');
                        console.log('\x1b[0m' + 'Tabla: ' + dbIdx[i].table_name);
                    }
                    console.log('\x1b[0m' + 'Indice ' + dbIdx[i].Deletioncandidateindex + '(' + dbIdx[i].Deletioncandidatecolumns + '). Esta incluido en ' + dbIdx[i].Existingindex + '(' + dbIdx[i].Existingcolumns + ')');
                }
            }
            finally {
                console.log('\x1b[0m');
                await this.fb.commit();
            }
        }
        catch (err) {
            throw new Error(err.message);
        }
    }
    async check(ahostName, aportNumber, adatabase, adbUser, adbPassword, objectType, objectName) {
        this.fb.database = adatabase;
        this.fb.dbPassword = adbPassword;
        this.fb.dbUser = adbUser;
        this.fb.hostName = ahostName;
        this.fb.portNumber = aportNumber;
        try {
            await this.fb.connect();
            try {
                if (objectType === GlobalTypes.ArrayobjectType[6] || objectType === '') {
                    await this.checkIndexes(objectName);
                }
            }
            finally {
                await this.fb.disconnect();
            }
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    }
}
exports.fbCheckMetadata = fbCheckMetadata;
//# sourceMappingURL=fbCheckMetadata.js.map