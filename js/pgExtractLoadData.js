"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const GlobalTypes = require("./globalTypes");
const globalFunction = require("./globalFunction");
const metadataQuerys = require("./pgMetadataQuerys");
const pg = require("pg");
const defaultSchema = 'public';
function outFileScript(aFields, aData, aTable, filesPath) {
    const saveTo = 10000;
    let insertQuery = '';
    let contSaveTo = 0;
    let qQuery = [];
    let y = 0;
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
class pgExtractLoadData {
    constructor() {
        this.connectionString = {};
        this.dbRole = '';
        this.schema = defaultSchema;
        this.filesPath = '';
    }
    analyzeQuery(aQuery, aObjectName, aObjectType) {
        let aRet = aQuery;
        aRet = aRet.replace(new RegExp('{FILTER_SCHEMA}', 'g'), "'" + this.schema + "'");
        if (aObjectName !== '')
            aRet = aRet.replace('{FILTER_OBJECT}', "WHERE UPPER(TRIM(cc.objectName)) = '" + aObjectName.toUpperCase() + "'");
        else
            aRet = aRet.replace('{FILTER_OBJECT}', '');
        aRet = aRet.replace('{RELTYPE}', " AND relkind IN ('r','t','f') ");
        return aRet;
    }
    async loadData(ahostName, aportNumber, adatabase, adbUser, adbPassword, objectName, adbRole) {
        let tableName = '';
        let filesDirSource1 = [];
        let rQuery;
        let rTables = [];
        let rFields = [];
        let rData = [];
        let qFields = [];
        let query = '';
        let queryValues = '';
        let xCont = 0;
        let xContGral = 0;
        let contline = 0;
        let j = 0;
        let rs;
        let filelines;
        let jsonline;
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
                        filelines.toString().split(/\r?\n/).forEach(function (line) {
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
                                        queryValues += "'" + jsonline[z] + "',";
                                    else if (typeof jsonline[z] === 'object') {
                                        for (let jname in jsonline[z]) {
                                            if (jname === '$numberlong' || jname === '$numberint') {
                                                queryValues += jsonline[z][jname] + ',';
                                            }
                                            else if (jname === '$binary') {
                                            }
                                            else if (jname === '$date') {
                                                queryValues += "'" + jsonline[z][jname] + "',";
                                            }
                                        }
                                    }
                                }
                                rData.push(query + queryValues.substr(0, queryValues.length - 1) + ')');
                            }
                            contline += 1;
                        });
                        await this.pgDb.query('BEGIN');
                        for (let p = 0; p < rData.length; p++) {
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
exports.pgExtractLoadData = pgExtractLoadData;
//# sourceMappingURL=pgExtractLoadData.js.map