import * as fs from 'fs';
import * as GlobalTypes from './globalTypes';
import * as globalFunction from './globalFunction';
import * as pgExtractMetadata from './pgExtractMetadata';
import * as metadataQuerys from './pgMetadataQuerys';

import * as pg from 'pg';
import { clearTimeout } from 'timers';

function outFileScript(aFields: Array<pgExtractMetadata.iFieldType>, aData: Array<any>, aTable: string, filesPath: string) {

    const saveTo: number = 10000;

    let insertQuery: string = '';

    let contSaveTo: number = 0;
    let qQuery: Array<any> = [];
    let y: number = 0;

    for (let i = 0; i < aData.length; i++) {
        qQuery = [];
        y = aData[i].length;
        for (let j = 0; j < aFields.length; j++)
            qQuery.push(globalFunction.varToJSON(aData[i][aFields[j].AName], aFields[j].AType, aFields[j].ASubType));

        insertQuery += JSON.stringify(qQuery) + GlobalTypes.CR;
        if (contSaveTo < saveTo)
            contSaveTo++;
        else {
            fs.appendFileSync(filesPath + aTable + '.sql', insertQuery, 'utf8');
            contSaveTo = 0;
            insertQuery = '';
        }

    }
    fs.appendFileSync(filesPath + aTable + '.sql', insertQuery, 'utf8');
    contSaveTo = 0;
    insertQuery = '';

}

export class pgExtractLoadData {

    private connectionString: pg.ClientConfig = {};
    private pgDb: pg.Client | any;
    public dbRole: string = '';

    filesPath: string = '';
    excludeObject: any;

    private analyzeQuery(aQuery: string, aObjectName: string, aObjectType: string) {
        let aRet: string = aQuery;

        if (aObjectName !== '')
            aRet = aRet.replace('{FILTER_OBJECT}', "WHERE UPPER(TRIM(OBJECT_NAME)) = '" + aObjectName.toUpperCase() + "'");
        else
            aRet = aRet.replace('{FILTER_OBJECT}', '');

        if (aObjectType === GlobalTypes.ArrayobjectType[5]) { //field  COMPUTED_SOURCE campos calculados
            aRet = aRet.replace('SELECT *', 'SELECT OBJECT_NAME, FIELDNAME, FTYPE, SUBTYPE ');
            aRet = aRet.replace('{RELTYPE}', ' AND (REL.RDB$RELATION_TYPE<>1 OR REL.RDB$RELATION_TYPE IS NULL) AND FLD.RDB$COMPUTED_SOURCE IS NULL');
        }
        else //table RELATION_TYPE teporales 
            aRet = aRet.replace('{RELTYPE}', ' AND (REL.RDB$RELATION_TYPE NOT IN (1,5,4) OR REL.RDB$RELATION_TYPE IS NULL)');

        return aRet;
    }

    public async loadData(ahostName: string, aportNumber: number, adatabase: string, adbUser: string, adbPassword: string, objectName: string, adbRole:string) {
        
        let tableName: string = '';
        let filesDirSource1: Array<any> = [];
        let rTables: Array<any> = [];
        let rFields: Array<any> = [];
        let rData: Array<any> = [];
        let iField: pgExtractMetadata.iFieldType = {};
        let qFields: Array<pgExtractMetadata.iFieldType> = [];
        let query: string = '';
        let xCont: number = 0;
        let xContGral: number = 0;
        let j: number = 0;


        this.connectionString.host = ahostName;
        this.connectionString.database = adatabase;
        this.connectionString.password = adbPassword;
        this.connectionString.user = adbUser;
        this.connectionString.port = aportNumber;

        this.pgDb = new pg.Client(this.connectionString);

        try {
            if (!(this.filesPath.endsWith('/')))
                this.filesPath += '/';

            await this.pgDb.connect();
            await this.pgDb.query('SET ROLE ' + adbRole);
            this.dbRole = adbRole;

            try {

                await this.pgDb.query('BEGIN');

                rTables = await this.pgDb.query(this.analyzeQuery(metadataQuerys.queryTablesView, objectName, GlobalTypes.ArrayobjectType[2]), []);
                rFields = await this.pgDb.query(this.analyzeQuery(metadataQuerys.queryTablesViewFields, objectName, GlobalTypes.ArrayobjectType[5]), []);

                await this.pgDb.query('COMMIT');

                filesDirSource1 = globalFunction.readRecursiveDirectory(this.filesPath);

                
                for (let i = 0; i < filesDirSource1.length; i++) {
                    
                    tableName = rTables[i].tableName.trim();
                    if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[2], tableName)) {

                        j = rFields.findIndex(aItem => (aItem.tableName.trim() === tableName));
                        qFields = [];

                        if (fs.existsSync(this.filesPath + tableName + '.sql')) {
                            fs.unlinkSync(this.filesPath + tableName + '.sql');
                        }

                        if (j !== -1) {
                            while ((j < rFields.length) && (rFields[j].tableName.trim() === tableName)) {
                                if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[5], rFields[j].FIELDNAME)) {
                                    iField = {};
                                    iField.AType = rFields[j].type;
                                    iField.ALength = rFields[j].length;
                                    iField.APrecision = rFields[j].precision;
                                    iField.AScale = rFields[j].scale;
                                    qFields.push(iField);                                    
                                }
                                j++;
                            }

                            await this.pgDb.query('BEGIN');

                            query = 'SELECT ' + globalFunction.arrayToString(qFields, ',', 'AName') + ' FROM ' + globalFunction.quotedString(tableName);
                            rData = [];
                            xCont = 0;
                            xContGral = 0;
                            console.log(i.toString() + '/' + rTables.length.toString() + ' - extract ' + tableName);


                            fs.appendFileSync(this.filesPath + tableName + '.sql', '["' + globalFunction.arrayToString(qFields, '","', 'AName') + '"]' + GlobalTypes.CR, 'utf8');

                            await this.fb.dbSequentially(query, [], async function (row: any, index: any) {
                                let value: any;

                                if (qBlobFields.length > 0) {
                                    for (let i in qBlobFields) {
                                        if (row[qBlobFields[i].AName] !== null || row[qBlobFields[i].AName] instanceof Function) { //me aseguro que es un blob                                            
                                            if (qBlobFields[i].ASubType === 0) //binario                                            
                                                value = new Buffer(row[qBlobFields[i].AName]).toString('base64');

                                            row[qBlobFields[i].AName] = value;
                                        }
                                    }
                                }

                                rData.push(row);
                                xCont++;
                                //console.log(xCont.toString());
                                if (xCont >= 20000) {
                                    outFileScript(qFields, rData, tableName, filepath);
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
                                outFileScript(qFields, rData, tableName, filepath);
                                //fs.appendFileSync('/home/damian/temp/db/'+tableName+'.sql', JSON.stringify(rData), 'utf8');
                            }

                            await this.pgDb.query('COMMIT');
                        }
                    }
                }

            }
            finally {
                await this.pgDb.disconnect();
            }
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    }
}


