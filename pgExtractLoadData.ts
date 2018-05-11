import * as fs from 'fs';
import * as GlobalTypes from './globalTypes';
import * as globalFunction from './globalFunction';
import * as pgExtractMetadata from './pgExtractMetadata';
import * as metadataQuerys from './pgMetadataQuerys';

import * as pg from 'pg';
import { clearTimeout } from 'timers';

const defaultSchema: string = 'public';

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
            qQuery.push(globalFunction.varToJSON(aData[i][aFields[j].AName], aFields[j].AType, 0));

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
    public schema: string = defaultSchema;

    filesPath: string = '';
    excludeObject: any;

    private analyzeQuery(aQuery: string, aObjectName: string, aObjectType: string) {
        let aRet: string = aQuery;
        aRet = aRet.replace(new RegExp('{FILTER_SCHEMA}', 'g'), "'" + this.schema + "'");

        if (aObjectName !== '')
            aRet = aRet.replace('{FILTER_OBJECT}', "WHERE UPPER(TRIM(cc.objectName)) = '" + aObjectName.toUpperCase() + "'")
        else
            aRet = aRet.replace('{FILTER_OBJECT}', '');

        aRet = aRet.replace('{RELTYPE}', " AND relkind IN ('r','t','f') ");

        return aRet;
    }

    public async loadData(ahostName: string, aportNumber: number, adatabase: string, adbUser: string, adbPassword: string, objectName: string, adbRole: string) {

        let tableName: string = '';
        let filesDirSource1: Array<any> = [];
        let rQuery: any;
        let rTables: Array<any> = [];
        let rFields: Array<any> = [];
        let rData: Array<any> = [];
        let qFields: Array<pgExtractMetadata.iFieldType> = [];
        let query: string = '';
        let queryValues: string = '';
        let xCont: number = 0;
        let xContGral: number = 0;
        let contline: number = 0;
        let j: number = 0;
        let rs: fs.ReadStream;
        let filelines: any;
        let jsonline: any;


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

                rQuery = await this.pgDb.query(this.analyzeQuery(metadataQuerys.queryTablesView, objectName, GlobalTypes.ArrayobjectType[2]), []);
                rTables = rQuery.rows;
                rQuery = await this.pgDb.query(this.analyzeQuery(metadataQuerys.queryTablesViewFields, objectName, GlobalTypes.ArrayobjectType[5]), []);
                rFields = rQuery.rows;

                await this.pgDb.query('COMMIT');

                filesDirSource1 = globalFunction.readRecursiveDirectory(this.filesPath, false);


                for (let i = 0; i < filesDirSource1.length; i++) {

                    tableName = filesDirSource1[i].file;
                    tableName = tableName.substring(0, tableName.length - 4); //quito extension

                    if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[2], tableName)) {

                        filelines = fs.readFileSync(filesDirSource1[i].path + filesDirSource1[i].file);

                        console.log(filesDirSource1[i].path + filesDirSource1[i].file);
                        contline = 0;
                        rData = [];

                        //for (let line in filelines.toString().split(String.fromCharCode(10))) {                        
                        filelines.toString().split(/\r?\n/).forEach(function (line:any) {    
                            if (contline === 0) {
                                jsonline = JSON.parse(line);
                                qFields = [];
                                query = 'INSERT INTO ' + globalFunction.quotedString(tableName) + '( ';
                                for (let z = 0; z < jsonline.length; z++) {
                                    j = rFields.findIndex(aItem => (aItem.tableName.toLowerCase().trim() === tableName.toLowerCase().trim() && aItem.columnName.toUpperCase().trim() === jsonline[z].toUpperCase().trim()));
                                    if (j !== -1) {
                                        qFields.push({ AName: rFields[j].columnName, AType: rFields[j].type });
                                        query += rFields[j].columnName + ',';
                                    }
                                    else
                                        throw new Error('El campo ' + jsonline[z] + ' de la tabla ' + tableName + ', no existe');
                                }
                                query = query.substr(0, query.length - 1) + ') VALUES(';
                            }
                            else {
                                queryValues = '';    
                                jsonline = JSON.parse(line);                                
                                for (let z = 0; z < jsonline.length; z++) {
                                    if (jsonline[z] === null) 
                                        queryValues += 'NULL,';
                                    else if (typeof jsonline[z] === 'string') 
                                        queryValues += "'"+jsonline[z]+"',";
                                    else if (typeof jsonline[z] === 'object') {
                                        for(let jname in jsonline[z]) {
                                            if (jname === '$numberlong' || jname === '$numberint') {
                                                queryValues += jsonline[z][jname]+',';       
                                            }
                                            else if (jname === '$binary') {

                                            }
                                            else if (jname === '$date') {
                                                queryValues += "'"+jsonline[z][jname]+"',";    
                                            }
                                        }                                           
                                    }  
                                }
                                rData.push(query+queryValues.substr(0, queryValues.length - 1) + ')');
                            }
                            contline += 1;
                        });
                        await this.pgDb.query('BEGIN');
                        for(let p = 0; p < rData.length; p++) { 
                            await this.pgDb.query(rData[p]);
                        }    
                        await this.pgDb.query('COMMIT');                                                    
                    }

                }
            }    
            finally {
                    await this.pgDb.end();
                }
            }
            catch (err) {
                console.error(err.message);
                process.exit(1);
            }
        }
}

