"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GlobalTypes = require("./globalTypes");
const pg = require("pg");
const pgMetadataQuerys = require("./pgMetadataQuerys");
const defaultSchema = 'public';
class pgCheckMetadata {
    constructor() {
        this.connectionString = {};
        this.schema = defaultSchema;
        this.dbRole = '';
    }
    analyzeQuery(aQuery, aObjectName, aObjectType) {
        let aRet = aQuery;
        let namesArray = [];
        let aux = '';
        //va con RegExp porque el replace cambia solo la primer ocurrencia.        
        aRet = aRet.replace(new RegExp('{FILTER_SCHEMA}', 'g'), "'" + this.schema + "'");
        if (aObjectName !== '')
            aRet = aRet.replace('{FILTER_OBJECT}', "WHERE UPPER(TRIM(cc.objectName)) = '" + aObjectName.toUpperCase() + "'");
        else {
            aRet = aRet.replace('{FILTER_OBJECT}', '');
        }
        if (aObjectType === GlobalTypes.ArrayobjectType[0])
            aRet = aRet.replace('{RELTYPE}', " and lower(format_type(p.prorettype,null)) <> 'trigger' and  l.lanname = 'plpgsql'  ");
        else if (aObjectType === GlobalTypes.ArrayobjectType[1])
            aRet = aRet.replace('{RELTYPE}', " and lower(format_type(p.prorettype,null)) = 'trigger' and  l.lanname = 'plpgsql' ");
        return aRet;
    }
    async checkProcedures(aobjectName) {
        let dbProcedures = [];
        let result;
        try {
            await this.pgDb.query('BEGIN');
            try {
                result = await this.pgDb.query(this.analyzeQuery(pgMetadataQuerys.queryProcedureTrigger, aobjectName, GlobalTypes.ArrayobjectType[0]));
                dbProcedures = result.rows;
                for (let i = 0; i < dbProcedures.length; i++) {
                    result = await this.pgDb.query('select plpgsql_check_function as textline from plpgsql_check_function(' + dbProcedures[i].oid + ')');
                    if (result.rows.length > 0) {
                        console.log('\x1b[31m' + ('Compilando procedure ' + dbProcedures[i].functionName).padEnd(70, '.') + 'ERROR');
                        for (let j = 0; j < result.rows.length; j++) {
                            console.log('\x1b[0m' + result.rows[j].textline);
                        }
                    }
                    else {
                        console.log('\x1b[0m' + ('Compilando procedure ' + dbProcedures[i].functionName).padEnd(70, '.') + 'OK');
                    }
                }
            }
            finally {
                await this.pgDb.query('COMMIT');
            }
        }
        catch (err) {
            throw new Error(err.message);
        }
    }
    //****************************************************************** */
    //        D E C L A R A C I O N E S    P U B L I C A S
    //******************************************************************* */
    async check(ahostName, aportNumber, adatabase, adbUser, adbPassword, adbRole, objectType, objectName) {
        this.connectionString.host = ahostName;
        this.connectionString.database = adatabase;
        this.connectionString.password = adbPassword;
        this.connectionString.user = adbUser;
        this.connectionString.port = aportNumber;
        this.pgDb = new pg.Client(this.connectionString);
        try {
            await this.pgDb.connect();
            await this.pgDb.query('SET ROLE ' + adbRole);
            this.dbRole = adbRole;
            try {
                if (objectType === '' || objectType === GlobalTypes.ArrayobjectType[0]) {
                    await this.checkProcedures(objectName);
                }
                if (objectType === '' || objectType === GlobalTypes.ArrayobjectType[1]) {
                    // await this.checkTriggers(objectName);
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
exports.pgCheckMetadata = pgCheckMetadata;
//# sourceMappingURL=pgCheckMetadata.js.map