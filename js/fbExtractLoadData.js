"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const fbClass = require("./classFirebird");
const GlobalTypes = require("./globalTypes");
const globalFunction = require("./globalFunction");
const metadataQuerys = require("./fbMetadataQuerys");
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
class fbExtractLoadData {
    constructor() {
        this.filesPath = '';
        this.fb = new fbClass.fbConnection;
    }
    analyzeQuery(aQuery, aObjectName, aObjectType) {
        let aRet = aQuery;
        if (aObjectName !== '')
            aRet = aRet.replace('{FILTER_OBJECT}', "WHERE UPPER(TRIM(OBJECT_NAME)) = '" + aObjectName.toUpperCase() + "'");
        else
            aRet = aRet.replace('{FILTER_OBJECT}', '');
        if (aObjectType === GlobalTypes.ArrayobjectType[5]) {
            aRet = aRet.replace('SELECT *', 'SELECT OBJECT_NAME, FIELDNAME, FTYPE, SUBTYPE ');
            aRet = aRet.replace('{RELTYPE}', ' AND (REL.RDB$RELATION_TYPE<>1 OR REL.RDB$RELATION_TYPE IS NULL) AND FLD.RDB$COMPUTED_SOURCE IS NULL');
        }
        else
            aRet = aRet.replace('{RELTYPE}', ' AND (REL.RDB$RELATION_TYPE NOT IN (1,5,4) OR REL.RDB$RELATION_TYPE IS NULL)');
        return aRet;
    }
    async extractData(ahostName, aportNumber, adatabase, adbUser, adbPassword, objectName) {
        let filepath = this.filesPath; //para poder llamarlo en el callback        
        let tableName = '';
        let filesDirSource1 = [];
        let rTables = [];
        let rFields = [];
        let rData = [];
        let iField = {};
        let qFields = [];
        let qBlobFields = [];
        let query = '';
        let xCont = 0;
        let xContGral = 0;
        let j = 0;
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
                        if (fs.existsSync(this.filesPath + tableName + '.sql')) {
                            fs.unlinkSync(this.filesPath + tableName + '.sql');
                        }
                        if (j !== -1) {
                            while ((j < rFields.length) && (rFields[j].OBJECT_NAME.trim() === tableName)) {
                                if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[5], rFields[j].FIELDNAME)) {
                                    iField = {};
                                    iField.AName = rFields[j].FIELDNAME.trim();
                                    iField.AType = rFields[j].FTYPE;
                                    iField.ASubType = rFields[j].SUBTYPE;
                                    qFields.push(iField);
                                    if (iField.AType === 261)
                                        qBlobFields.push(iField);
                                }
                                j++;
                            }
                            await this.fb.startTransaction(true);
                            query = 'SELECT ' + globalFunction.arrayToString(qFields, ',', 'AName') + ' FROM ' + globalFunction.quotedString(tableName);
                            rData = [];
                            xCont = 0;
                            xContGral = 0;
                            console.log(i.toString() + '/' + rTables.length.toString() + ' - extract ' + tableName);
                            fs.appendFileSync(this.filesPath + tableName + '.sql', '["' + globalFunction.arrayToString(qFields, '","', 'AName') + '"]' + GlobalTypes.CR, 'utf8');
                            await this.fb.dbSequentially(query, [], async function (row, index) {
                                let value;
                                if (qBlobFields.length > 0) {
                                    for (let i in qBlobFields) {
                                        if (row[qBlobFields[i].AName] !== null || row[qBlobFields[i].AName] instanceof Function) {
                                            if (qBlobFields[i].ASubType === 0)
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
exports.fbExtractLoadData = fbExtractLoadData;
//# sourceMappingURL=fbExtractLoadData.js.map