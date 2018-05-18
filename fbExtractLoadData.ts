import * as fs from 'fs';
import * as fbClass from './classFirebird';
import * as GlobalTypes from './globalTypes';
import * as globalFunction from './globalFunction';
import * as fbExtractMetadata from './fbExtractMetadata';
import * as metadataQuerys from './fbMetadataQuerys';

import * as nfb from 'node-firebird';
import { clearTimeout } from 'timers';

function outFileScript(aFields: Array<fbExtractMetadata.iFieldType>, aData: Array<any>, aTable: string, filesPath: string, aFormat: string) {

    const saveTo: number = 10000;

    let insertQuery: string = '';

    let contSaveTo: number = 0;
    let qSQL: Array<any> = [];



    for (let i = 0; i < aData.length; i++) {
        
        qSQL = [];    

        for (let j = 0; j < aFields.length; j++) {
            if (aFormat === 'sql')
                qSQL.push(globalFunction.varToJSON(aData[i][aFields[j].AName], aFields[j].AType, aFields[j].ASubType));
            else {
                if (j < (aFields.length-1))    
                    insertQuery += globalFunction.varToCSV(aData[i][aFields[j].AName], aFields[j].AType, aFields[j].ASubType) +',';
                else     
                    insertQuery += globalFunction.varToCSV(aData[i][aFields[j].AName], aFields[j].AType, aFields[j].ASubType);
            }    
        }

        if (aFormat === 'sql')
            insertQuery += JSON.stringify(qSQL) + GlobalTypes.CR;
        else
            insertQuery += GlobalTypes.CR;

        if (contSaveTo < saveTo)
            contSaveTo++;
        else {
            fs.appendFileSync(filesPath + aTable + '.' + aFormat, insertQuery, 'utf8');
            contSaveTo = 0;
            insertQuery = '';
        }

    }
    fs.appendFileSync(filesPath + aTable + '.' + aFormat, insertQuery, 'utf8');
    contSaveTo = 0;
    insertQuery = '';

}


export class fbExtractLoadData {

    public fb: fbClass.fbConnection;
    public formatExport: string = '';


    filesPath: string = '';
    excludeObject: any;

    constructor() {
        this.fb = new fbClass.fbConnection;
    }

    private analyzeQuery(aQuery: string, aObjectName: string, aObjectType: string) {
        let aRet: string = aQuery;

        if (aObjectName !== '')
            aRet = aRet.replace('{FILTER_OBJECT}', "WHERE UPPER(TRIM(OBJECT_NAME)) = '" + aObjectName.toUpperCase() + "'");
        else
            aRet = aRet.replace('{FILTER_OBJECT}', '');

        if (aObjectType === GlobalTypes.ArrayobjectType[5]) { //field  COMPUTED_SOURCE campos calculados
            aRet = aRet.replace('SELECT *', 'SELECT OBJECT_NAME, FIELDNAME, FTYPE, SUBTYPE ');
            aRet = aRet.replace('{RELTYPE}', ' AND (REL.RDB$RELATION_TYPE<>1 OR REL.RDB$RELATION_TYPE IS NULL) /*AND FLD.RDB$COMPUTED_SOURCE IS NULL*/');
        }
        else //table RELATION_TYPE teporales 
            aRet = aRet.replace('{RELTYPE}', ' AND (REL.RDB$RELATION_TYPE NOT IN (1,5,4) OR REL.RDB$RELATION_TYPE IS NULL)');

        return aRet;
    }

    public async extractData(ahostName: string, aportNumber: number, adatabase: string, adbUser: string, adbPassword: string, objectName: string) {
        let filepath: string = this.filesPath; //para poder llamarlo en el callback
        let formatExport: string = this.formatExport; //para poder llamarlo en el callback          

        let tableName: string = '';
        let filesDirSource1: Array<any> = [];
        let rTables: Array<any> = [];
        let rFields: Array<any> = [];
        let rData: Array<any> = [];
        let iField: fbExtractMetadata.iFieldType = {};
        let qFields: Array<fbExtractMetadata.iFieldType> = [];
        let qBlobFields: Array<fbExtractMetadata.iFieldType> = [];
        let query: string = '';
        let xCont: number = 0;
        let xContGral: number = 0;
        let j: number = 0;


        this.fb.database = adatabase;
        this.fb.dbPassword = adbPassword;
        this.fb.dbUser = adbUser;
        this.fb.hostName = ahostName;
        this.fb.portNumber = aportNumber;

        try {
            if (!(this.filesPath.endsWith('/')))
                this.filesPath += '/';

            await this.fb.connect();

            try {

                await this.fb.startTransaction(true);

                rTables = await this.fb.query(this.analyzeQuery(metadataQuerys.queryTablesView, objectName, GlobalTypes.ArrayobjectType[2]), []);
                rFields = await this.fb.query(this.analyzeQuery(metadataQuerys.queryTablesViewFields, objectName, GlobalTypes.ArrayobjectType[5]), []);

                await this.fb.commit();

                for (let i = 0; i < rTables.length; i++) {
                    tableName = rTables[i].OBJECT_NAME.trim();
                    if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[2], tableName)) {

                        j = rFields.findIndex(aItem => (aItem.OBJECT_NAME.trim() === tableName));
                        qFields = [];
                        qBlobFields = [];

                        if (fs.existsSync(this.filesPath + tableName + '.' + formatExport)) {
                            fs.unlinkSync(this.filesPath + tableName + '.' + formatExport);
                        }

                        if (j !== -1) {
                            while ((j < rFields.length) && (rFields[j].OBJECT_NAME.trim() === tableName)) {
                                if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[5], rFields[j].FIELDNAME)) {
                                    iField = {};
                                    iField.AName = rFields[j].FIELDNAME.trim();
                                    iField.AType = rFields[j].FTYPE;
                                    iField.ASubType = rFields[j].SUBTYPE;
                                    qFields.push(iField);
                                    if (iField.AType === 261)  //blobs solamente para hacer mas rapida la busqueda en el callback
                                        qBlobFields.push(iField);
                                }
                                j++;
                            }

                            await this.fb.startTransaction(true);

                            query = 'SELECT ' + globalFunction.arrayToString(qFields, ',', 'AName') + ' FROM ' + globalFunction.quotedString(tableName);
                            //query += ' where fcodint=33771';
                            rData = [];
                            xCont = 0;
                            xContGral = 0;
                            console.log(i.toString() + '/' + rTables.length.toString() + ' - extract ' + tableName);


                            if (formatExport.toLowerCase() === 'sql')
                                fs.appendFileSync(this.filesPath + tableName + '.sql', '["' + globalFunction.arrayToString(qFields, '","', 'AName') + '"]' + GlobalTypes.CR, 'utf8');
                            else if (formatExport.toLowerCase() === 'csv')
                                fs.appendFileSync(this.filesPath + tableName + '.csv', globalFunction.arrayToString(qFields, ',', 'AName') + GlobalTypes.CR, 'utf8');

                            await this.fb.dbSequentially(query, [], async function (row: any, index: any) {
                                let value: any;

                                if (qBlobFields.length > 0) {
                                    for (let i in qBlobFields) {
                                        if (row[qBlobFields[i].AName] !== null || row[qBlobFields[i].AName] instanceof Function) { //me aseguro que es un blob                                            
                                            if (qBlobFields[i].ASubType === 0) { //binario                                            
                                                if (formatExport.toLowerCase() === 'sql')
                                                    value = new Buffer(row[qBlobFields[i].AName]).toString('base64');
                                                else (formatExport.toLowerCase() === 'csv')
                                                value = new Buffer(row[qBlobFields[i].AName]).toString('hex');
                                            }

                                            row[qBlobFields[i].AName] = value;
                                        }
                                    }
                                }

                                rData.push(row);
                                xCont++;
                                //console.log(xCont.toString());
                                if (xCont >= 20000) {

                                    outFileScript(qFields, rData, tableName, filepath, formatExport);
                                    //fs.appendFileSync('/home/damian/temp/db/'+tableName+'.sql', JSON.stringify(rData), 'utf8');
                                    xContGral += xCont;
                                    console.log('   Registros: ' + xContGral.toString());
                                    rData = [];
                                    xCont = 0;
                                }
                            });
                            if (rData.length > 0) {
                                xContGral += xCont;
                                console.log('   Registros: ' + xContGral.toString());
                                outFileScript(qFields, rData, tableName, filepath, formatExport);
                                //fs.appendFileSync('/home/damian/temp/db/'+tableName+'.sql', JSON.stringify(rData), 'utf8');
                            }

                            await this.fb.commit();
                        }
                    }
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


