import * as GlobalTypes from './globalTypes';
import * as globalFunction from './globalFunction';
import * as sources from './loadsource';
import * as pg from 'pg';
import * as pgMetadataQuerys from './pgMetadataQuerys';

const defaultSchema = 'public';


export class pgCheckMetadata {

    private connectionString: pg.ClientConfig = {};
    private pgDb: pg.Client | any;

    public schema: string = defaultSchema;
    public dbRole: string = '';

    private analyzeQuery(aQuery: string, aObjectName: string, aObjectType: string) {
        let aRet: string = aQuery;
        let namesArray: Array<string> = [];
        let aux: string = '';

        //va con RegExp porque el replace cambia solo la primer ocurrencia.        
        aRet = aRet.replace(new RegExp('{FILTER_SCHEMA}', 'g'), "'" + this.schema + "'");

        if (aObjectName !== '')
            aRet = aRet.replace('{FILTER_OBJECT}', "WHERE UPPER(TRIM(cc.objectName)) = '" + aObjectName.toUpperCase() + "'")
        else {
            aRet = aRet.replace('{FILTER_OBJECT}', '');
        }

        if (aObjectType === GlobalTypes.ArrayobjectType[0])     //procedure
            aRet = aRet.replace('{RELTYPE}', " and lower(format_type(p.prorettype,null)) <> 'trigger' and  l.lanname = 'plpgsql'  ");
        else if (aObjectType === GlobalTypes.ArrayobjectType[1])     //TRIGGER
            aRet = aRet.replace('{RELTYPE}', " and lower(format_type(p.prorettype,null)) = 'trigger' and  l.lanname = 'plpgsql' ");

        return aRet;
    }

    private async checkProcedures(aobjectName: string) {
        let dbProcedures: Array<any> = [];
        let result:any;

        try {
            await this.pgDb.query('BEGIN');
            try {
                result = await this.pgDb.query(this.analyzeQuery(pgMetadataQuerys.queryProcedureTrigger, aobjectName, GlobalTypes.ArrayobjectType[0]));
                dbProcedures = result.rows;
                for (let i = 0; i < dbProcedures.length; i++) {
                    result = await this.pgDb.query('select plpgsql_check_function as textline from plpgsql_check_function('+dbProcedures[i].oid+')');
                    if (result.rows.length > 0) {
                        console.log('\x1b[31m'+('Compilando procedure '+dbProcedures[i].functionName).padEnd(70, '.') + 'ERROR');
                        for (let j = 0; j < result.rows.length; j++) {                            
                            console.log('\x1b[0m'+result.rows[j].textline);
                        }
                    }
                    else {
                        console.log('\x1b[0m'+('Compilando procedure '+dbProcedures[i].functionName).padEnd(70, '.') + 'OK');
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

    public async check(ahostName: string, aportNumber: number, adatabase: string, adbUser: string, adbPassword: string, adbRole: string, objectType: string, objectName: string) {
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
