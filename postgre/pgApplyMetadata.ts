import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as GlobalTypes from '../common/globalTypes';
import * as globalFunction from '../common/globalFunction';
import * as sources from '../common/loadsource';
import * as pg from 'pg';
import * as pgMetadataQuerys from './pgMetadataQuerys';
import * as pgExtractMetadata from './pgExtractMetadata';
//import { globalAgent } from 'https';

const defaultSchema = 'public';

const saveMetadataTable = `CREATE TABLE {TABLE} (
                                FINDICE  INTEGER NOT NULL PRIMARY KEY,
                                FFECHA   DATE NOT NULL,
                                FHORA    TIME NOT NULL,
                                FOBTYPE  VARCHAR(20) NOT NULL,
                                FOBNAME  VARCHAR(100) NOT NULL,
                                FQUERY   TEXT
                            );`;

const saveMetadataGenerator = `CREATE SEQUENCE {TABLE} INCREMENT 1;`;

const saveQueryLog = `INSERT INTO {TABLE} (FINDICE, FFECHA, FHORA, FOBTYPE, FOBNAME, FQUERY)
                      VALUES (nextval('g_{TABLE}'), CURRENT_DATE, CURRENT_TIME, $1, $2, $3)`;

interface iFieldType {
    AName?: string | any;
    AType?: number | any,
    ASubType?: number | any,
    ALength?: number | any,
    APrecision?: number | any,
    AScale?: number | any,
    ACharSet?: string | any,
    ACollate?: string | any,
    ADefault?: string | any,
    ANotNull?: boolean | any,
    AComputed?: string | any,
    ADescription?: string | any,
    AValidation?: string | any
};


export class pgApplyMetadata {

    private connectionString: pg.ClientConfig = {};
    private pgDb: pg.Client | any;
    private pgExMe: pgExtractMetadata.pgExtractMetadata;

    public pathFileScript: string = '';
    public excludeObject: any;
    public saveToLog: string = '';
    public sources: sources.tSource | any;

    public originalMetadata: sources.tSource;

    public schema: string = defaultSchema;
    public dbRole: string = '';
    public saveafterapply: string = '';

    constructor() {
        this.sources = new sources.tSource;
        this.pgExMe = new pgExtractMetadata.pgExtractMetadata;
        this.originalMetadata = new sources.tSource;
    }

    private async validate(aQuery: string, aParam: Array<any>): Promise<boolean> {
        let rResult: any;
        rResult = await this.pgDb.query(aQuery, aParam);
        if (rResult.rows.length > 0)
            return true;
        else
            return false;
    }

    private async checkMetadataLog() {
        let lQuery: string = '';

        lQuery = pgMetadataQuerys.queryTablesView;
        lQuery = lQuery.replace('{FILTER_SCHEMA}', "'" + this.schema + "'");
        lQuery = lQuery.replace('{RELTYPE}', " AND relkind IN ('r','t','f') ");
        lQuery = lQuery.replace('{FILTER_OBJECT}', 'WHERE TRIM(CC."objectName")=' + "'" + this.saveToLog + "'");

        await this.pgDb.query('BEGIN');
        if (!(await this.validate(lQuery, []))) {
            await this.pgDb.query(saveMetadataTable.replace('{TABLE}', this.schema + '.' + this.saveToLog));
        }
        lQuery = pgMetadataQuerys.queryGenerator;
        lQuery = lQuery.replace('{FILTER_SCHEMA}', "'" + this.schema + "'");
        lQuery = lQuery.replace('{FILTER_OBJECT}', 'WHERE TRIM(CC."objectName")=' + "'g_" + this.saveToLog + "'");

        if (!(await this.validate(lQuery, []))) {
            await this.pgDb.query(saveMetadataGenerator.replace('{TABLE}', this.schema + '.g_' + this.saveToLog));
        }
        await this.pgDb.query('COMMIT');;
    }


    private async applyChange(aObjectType: string, aObjectName: string, aAlterScript: Array<string>) {
        let query: string = '';

        try {
            if (this.pathFileScript === '') {
                for (var i in aAlterScript) {
                    //console.log(i.toString()+'--'+aAlterScript[i]);    
                    query = aAlterScript[i];
                    await this.pgDb.query('BEGIN');
                    try {
                        await this.pgDb.query(aAlterScript[i]);
                        if (this.saveToLog !== '') {
                            await this.pgDb.query(saveQueryLog.replace(new RegExp('{TABLE}', 'g'), this.saveToLog), [aObjectType, aObjectName, aAlterScript[i]]);
                        }
                    }
                    finally {
                        await this.pgDb.query('COMMIT');
                    }
                }
                console.log(('Aplicando ' + aObjectType + ' ' + aObjectName).padEnd(70, '.') + 'OK');
            }
            else
                globalFunction.outFileScript(aObjectType, aAlterScript, this.pathFileScript);
        }
        catch (err) {
            throw new Error(query + '.' + err.message);
        }
    }
    //****************************************************************** */
    //        P R O C E D U R E S
    //******************************************************************* */

    private async readProcedures(aWithBody: boolean, dbYaml: Array<any>) {

        let paramString = (aParam: any, aInOut: string, aOnlyType: boolean = false) => {
            let aText: string = '';

            if (aParam.length > 0) {
                if (aInOut === 'OUT')
                    withOutputs = true;
                for (let j = 0; j < aParam.length - 1; j++) {
                    if (aOnlyType)
                        aText += aInOut + ' ' + GlobalTypes.convertDataTypeToPG(aParam[j].param.type, true) + ',';
                    else
                        aText += aInOut + ' ' + globalFunction.quotedString(aParam[j].param.name) + ' ' + GlobalTypes.convertDataTypeToPG(aParam[j].param.type, true) + ',';
                }
                if (aOnlyType)
                    aText += aInOut + ' ' + GlobalTypes.convertDataTypeToPG(aParam[aParam.length - 1].param.type, true);
                else
                    aText += aInOut + ' ' + globalFunction.quotedString(aParam[aParam.length - 1].param.name) + ' ' + GlobalTypes.convertDataTypeToPG(aParam[aParam.length - 1].param.type, true);
            }
            return aText;
        };


        let procedureYamltoString = (aYaml: any, aWithBody: boolean) => {

            let aProc: string = '';
            let aParams: string = '';

            aProc = 'CREATE OR REPLACE FUNCTION ' + this.schema + '.' + globalFunction.quotedString(aYaml.procedure.name);

            if ('inputs' in aYaml.procedure)
                aParams = paramString(aYaml.procedure.inputs, '');


            if (aYaml.procedure.pg.resultType.toUpperCase().trim() === 'TABLE') {
                aProc += '(' + aParams + ')';
                if ('outputs' in aYaml.procedure) {
                    aProc += ' RETURNS TABLE (' + paramString(aYaml.procedure.outputs, 'O') + ')' + GlobalTypes.CR;
                    withOutputs = true;
                }
                else {
                    aProc += ' RETURNS void ' + GlobalTypes.CR;
                    withOutputs = false;
                }
            }
            else if ('outputs' in aYaml.procedure) {
                aParams = '(' + aParams + ',' + paramString(aYaml.procedure.outputs, 'OUT') + ')';
                aProc += aParams + ' RETURNS ' + aYaml.procedure.pg.resultType + GlobalTypes.CR;
                withOutputs = false;
            }

            if ('language' in aYaml.procedure.pg) {
                if (GlobalTypes.ArrayPgFunctionLenguage.indexOf(aYaml.procedure.pg.language) > -1) {
                    aProc += 'LANGUAGE ' + aYaml.procedure.pg.language.toUpperCase() + GlobalTypes.CR;
                }
                else
                    throw new Error('lenguaje no soportado ' + aYaml.procedure.pg.language + '. ' + aYaml.procedure.name);
            }
            else
                throw new Error('falta lenguaje en ' + aYaml.procedure.name);

            if ('executionCost' in aYaml.procedure.pg) {
                aProc += 'COST ' + aYaml.procedure.pg.executionCost + GlobalTypes.CR;
            }
            else
                aProc += 'COST 100' + GlobalTypes.CR;

            if ('type' in aYaml.procedure.pg.options.optimization) {
                aProc += aYaml.procedure.pg.options.optimization.type.toUpperCase() + GlobalTypes.CR;
            }
            else
                aProc += 'VOLATILE' + GlobalTypes.CR;

            if ('parallelMode' in aYaml.procedure.pg.options.optimization) {
                if (GlobalTypes.ArrayPgFunctionParallelMode.indexOf(aYaml.procedure.pg.options.optimization.parallelMode.trim().toLowerCase()) > -1)
                    aProc += 'PARALLEL ' + aYaml.procedure.pg.options.optimization.parallelMode.toUpperCase() + GlobalTypes.CR;
                else
                    throw new Error('parallelMode incorrecto ' + aYaml.procedure.pg.options.optimization.parallelMode + '. ' + aYaml.procedure.name);
            }

            if ('returnNullonNullInput' in aYaml.procedure.pg.options.optimization) {
                if (aYaml.procedure.pg.options.optimization.returnNullonNullInput)
                    aProc += 'RETURNS NULL ON NULL INPUT ' + GlobalTypes.CR;
            }

            if (withOutputs) {
                if ('resultRows' in aYaml.procedure.pg)
                    aProc += 'ROWS ' + aYaml.procedure.pg.resultRows + GlobalTypes.CR;
                else
                    aProc += 'ROWS 1000 ' + GlobalTypes.CR;
            }

            if (aWithBody)
                aProc += GlobalTypes.CR + 'AS $BODY$' + GlobalTypes.CR + aYaml.procedure.body + GlobalTypes.CR + '$BODY$';
            else {
                aProc += GlobalTypes.CR + 'AS $BODY$' + GlobalTypes.CR + " begin RAISE EXCEPTION  USING MESSAGE = 'Cambiando procedimiento aguerde un momento por favor'; end" + GlobalTypes.CR + '$BODY$';
            }
            return aProc;
        }

        let procedureName: string = '';
        let cambios: boolean = false;
        let fileYaml: any;
        let procedureBody: string = '';
        let procedureParams: string = '';
        let procedureInDB: any;
        let j: number = 0;
        let rQuery: Array<string> = [];
        let withOutputs: boolean = false;

        try {


            for (let i in this.sources.proceduresArrayYaml) {

                fileYaml = this.sources.proceduresArrayYaml[i].contentFile;

                procedureName = fileYaml.procedure.name.toLowerCase().trim();
                if (('applyDb' in fileYaml.procedure && fileYaml.procedure.applyDb.indexOf('pg') !== -1) || (!('applyDb' in fileYaml.procedure))) {

                    if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[0], procedureName)) {

                        j = dbYaml.findIndex(aItem => (aItem.procedure.name.toLowerCase().trim() === procedureName));

                        procedureBody = procedureYamltoString(fileYaml, true);
                        if (j !== -1) {
                            procedureInDB = procedureYamltoString(dbYaml[j], true);
                        }

                        if (procedureInDB !== procedureBody) {
                            cambios = true;
                            rQuery = [];
                            if (j !== -1)
                                rQuery.push('DROP FUNCTION ' + this.schema + '.' + procedureName);

                            rQuery.push(procedureYamltoString(fileYaml, aWithBody));
                            if (j === -1) {
                                if ('inputs' in fileYaml.procedure)
                                    rQuery.push('ALTER FUNCTION ' + this.schema + '.' + procedureName + paramString(fileYaml.procedure.inputs, 'I', true) + ' OWNER TO ' + this.dbRole + ';');
                                else
                                    rQuery.push('ALTER FUNCTION ' + this.schema + '.' + procedureName + '() OWNER TO ' + this.dbRole + ';');
                            }
                            await this.applyChange(GlobalTypes.ArrayobjectType[0], procedureName, rQuery);
                        }

                        procedureBody = '';
                        procedureInDB = '';
                    }
                }
            }
            return cambios;
        }
        catch (err) {
            throw new Error('Error aplicando procedimiento ' + procedureName + '. ' + err.message + GlobalTypes.CR + procedureBody);
        }
    }

    private async applyProcedures() {
        let dbYaml: Array<any> = [];

        try {
            await this.pgDb.query('BEGIN');
            try {
                dbYaml = await this.pgExMe.extractMetadataProcedures('', true, false);
            }
            finally {
                await this.pgDb.query('COMMIT');
            }

            if (await this.readProcedures(false, dbYaml)) {
                await this.readProcedures(true, dbYaml);
            }
            //console.log(Date.now());               
        }
        catch (err) {
            throw new Error(err.message);
        }
    }

    //****************************************************************** */
    //        T R I G G E R S
    //******************************************************************* */

    private async applyTriggers() {
        /*
        CREATE FUNCTION public.prueba()
    RETURNS trigger
    LANGUAGE 'plpgsql'
    VOLATILE NOT LEAKPROOF 

    CREATE TRIGGER t_art_arch_ean
    BEFORE INSERT OR DELETE OR UPDATE 
    ON public.art_arch
    FOR EACH ROW
    EXECUTE PROCEDURE public."T_ART_ARCH_EAN"();*/
        let triggerYamltoString = (aYaml: any, aDbYaml: any) => {
            let aProc: string = '';
            let rTrigger: Array<string> = [];
            let x: number = 0;
            let aAux: Array<any> = [];

            for (let i = 0; i < aYaml.triggerFunction.triggers.length; i++) {

                //si existe borro el trigger
                if (aDbYaml !== undefined) {
                    aAux = aDbYaml.triggerFunction.triggers;
                    if (aAux.length > 0) {
                        x = aAux.findIndex(aItem => (aItem.trigger.name.toLowerCase().trim() === aYaml.triggerFunction.triggers[i].trigger.name.toLowerCase().trim()));
                        if (x !== -1)
                            rTrigger.push('DROP TRIGGER ' + aYaml.triggerFunction.triggers[i].trigger.name + ' ON ' + this.schema + '.' + globalFunction.quotedString(aYaml.triggerFunction.triggers[i].trigger.table));
                    }
                }

                aProc = 'CREATE TRIGGER ' + globalFunction.quotedString(aYaml.triggerFunction.triggers[i].trigger.name) + GlobalTypes.CR;

                aProc += aYaml.triggerFunction.triggers[i].trigger.fires + ' ';

                aProc += aYaml.triggerFunction.triggers[i].trigger.events[0];
                for (let j = 1; j < aYaml.triggerFunction.triggers[i].trigger.events.length; j++) {
                    aProc += ' OR ' + aYaml.triggerFunction.triggers[i].trigger.events[j];
                };

                aProc += GlobalTypes.CR;

                aProc += 'ON ' + this.schema + '.' + globalFunction.quotedString(aYaml.triggerFunction.triggers[i].trigger.table) + GlobalTypes.CR;

                aProc += 'FOR EACH ROW' + GlobalTypes.CR;

                aProc += 'EXECUTE PROCEDURE ' + this.schema + '.' + globalFunction.quotedString(aYaml.triggerFunction.name) + '()';

                rTrigger.push(aProc);
                if ('active' in aYaml.triggerFunction.triggers[i].trigger)
                    if (aYaml.triggerFunction.triggers[i].trigger.active === false)
                        rTrigger.push('ALTER TABLE ' + this.schema + '.' + globalFunction.quotedString(aYaml.triggerFunction.triggers[i].trigger.table) + ' DISABLE TRIGGER ' + globalFunction.quotedString(aYaml.triggerFunction.triggers[i].trigger.name));
                if ('description' in aYaml.triggerFunction.triggers[i].trigger)
                    rTrigger.push('COMMENT ON TRIGGER  ON ' + this.schema + '.' + globalFunction.quotedString(aYaml.triggerFunction.triggers[i].trigger.table) + ' IS ' + "'" + aYaml.triggerFunction.triggers[i].trigger.description + "'");
            }
            return rTrigger;
        };

        let triggerFunctionYamltoString = (aYaml: any) => {
            let aProc: string = '';

            aProc = 'CREATE OR REPLACE FUNCTION ' + this.schema + '.' + globalFunction.quotedString(aYaml.triggerFunction.name) + '() ' + GlobalTypes.CR;
            aProc += 'RETURNS TRIGGER' + GlobalTypes.CR;

            if ('language' in aYaml.triggerFunction.function) {
                if (GlobalTypes.ArrayPgFunctionLenguage.indexOf(aYaml.triggerFunction.function.language) > -1) {
                    aProc += 'LANGUAGE ' + aYaml.triggerFunction.function.language.toUpperCase() + GlobalTypes.CR;
                }
                else
                    throw new Error('lenguaje no soportado ' + aYaml.triggerFunction.function + '. ' + aYaml.triggerFunction.name);
            }
            else
                throw new Error('falta lenguaje en ' + aYaml.triggerFunction.name);

            if ('executionCost' in aYaml.triggerFunction.function) {
                aProc += 'COST ' + aYaml.triggerFunction.function.executionCost + GlobalTypes.CR;
            }
            else
                aProc += 'COST 100' + GlobalTypes.CR;

            if ('type' in aYaml.triggerFunction.function.options.optimization) {
                aProc += aYaml.triggerFunction.function.options.optimization.type.toUpperCase() + GlobalTypes.CR;
            }
            else
                aProc += 'VOLATILE' + GlobalTypes.CR;

            //esta puesto por separado el AS y as porque no puedo pasar al body del trigger a upper o lower por si tiene literales
            aYaml.triggerFunction.function.body = aYaml.triggerFunction.function.body.trimRight();

            if (aYaml.triggerFunction.function.body.startsWith('AS'))
                aProc += aYaml.triggerFunction.function.body.replace('AS', 'AS $BODY$') + ' $BODY$';
            else if (aYaml.triggerFunction.function.body.startsWith('as'))
                aProc += aYaml.triggerFunction.function.body.replace('as', 'AS $BODY$') + ' $BODY$';
            else
                aProc += 'AS $BODY$' + aYaml.triggerFunction.function.body + ' $BODY$';

            return aProc;
        };

        let triggerName: string = '';
        let dbYaml: Array<any> = [];
        let fileYaml: any;
        let triggerBody: string = '';
        let triggerInDb: string = '';
        let j: number = 0;
        let rQuery: Array<string> = [];

        try {

            await this.pgDb.query('BEGIN');
            try {
                dbYaml = await this.pgExMe.extractMetadataTriggers('', true, false);
            }
            finally {
                await this.pgDb.query('COMMIT');
            }

            for (let i in this.sources.triggersArrayYaml) {

                fileYaml = this.sources.triggersArrayYaml[i].contentFile;

                triggerName = fileYaml.triggerFunction.name.toLowerCase().trim();

                if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[1], triggerName)) {

                    j = dbYaml.findIndex(aItem => (aItem.triggerFunction.name.toLowerCase().trim() === triggerName));

                    triggerBody = triggerFunctionYamltoString(fileYaml);

                    if (j !== -1) {
                        triggerInDb = triggerFunctionYamltoString(dbYaml[j]);
                    }

                    rQuery = [];

                    if (triggerBody !== triggerInDb) {
                        //no puedo borrar la funcion del trigger porque sino deberia de borrar todas la dependencias
                        //if (j !== -1)
                        //  rQuery.push('DROP FUNCTION ' + this.schema + '.' + triggerName + '()');

                        rQuery.push(triggerBody);

                        if (j === -1) {
                            rQuery.push('ALTER FUNCTION ' + this.schema + '.' + triggerName + '() OWNER TO ' + this.dbRole + ';');
                        }

                        await this.applyChange(GlobalTypes.ArrayobjectType[1], triggerName, rQuery);

                    }

                    triggerBody = '';
                    triggerInDb = '';
                }
            }
        }
        catch (err) {
            throw new Error('Error aplicando trigger ' + triggerName + '. ' + err.message);
        }
    }

    //****************************************************************** */
    //        V I E W S
    //******************************************************************* */
    private async applyViews() {
        let viewYamltoString = (aYaml: any) => {
            let aView: string = '';

            aView = 'CREATE OR REPLACE VIEW ' + this.schema + '.' + globalFunction.quotedString(aYaml.view.name) + '(' + GlobalTypes.CR;

            for (let j = 0; j < aYaml.view.columns.length - 1; j++) {
                aView += globalFunction.quotedString(aYaml.view.columns[j]) + ',' + GlobalTypes.CR;
            };
            aView += globalFunction.quotedString(aYaml.view.columns[aYaml.view.columns.length - 1]) + ')' + GlobalTypes.CR;

            aView += 'AS' + GlobalTypes.CR + aYaml.view.body;

            return aView;
        };

        let dbYaml: Array<any> = [];
        let viewName: string = '';
        let viewInDb: string = '';
        let j: number = 0;
        let fileYaml: any;
        let viewBody: string = '';
        let rQuerys: Array<string> = [];

        try {
            await this.pgDb.query('BEGIN')
            try {
                dbYaml = await this.pgExMe.extractMetadataViews('', true, false);
            }
            finally {
                await this.pgDb.query('COMMIT');
            }

            for (let i in this.sources.viewsArrayYaml) {
                fileYaml = this.sources.viewsArrayYaml[i].contentFile;

                viewName = fileYaml.view.name.toLowerCase().trim();

                if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[4], viewName)) {
                    j = dbYaml.findIndex(aItem => (aItem.view.name.toLowerCase().trim() === viewName));

                    viewBody = viewYamltoString(fileYaml);
                    if (j !== -1) {
                        viewInDb = viewYamltoString(dbYaml[j]);
                    }

                    if (viewBody !== viewInDb) {
                        rQuerys = [];
                        rQuerys.push(viewBody);
                        if (j === -1)
                            rQuerys.push('ALTER TABLE ' + this.schema + '.' + globalFunction.quotedString(viewName) + ' OWNER TO ' + this.dbRole + ';');

                        await this.applyChange(GlobalTypes.ArrayobjectType[4], viewName, rQuerys);
                    }
                    viewBody = '';
                    viewInDb = '';
                }
            }

        } catch (err) {
            throw new Error('Error aplicando view ' + viewName + '. ' + err.message);
        }
    }

    //****************************************************************** */
    //        G E N E R A T O R S
    //******************************************************************* */

    private async applyGenerators() {
        let genName: string = '';
        let genBody: Array<string> = [];
        let fileYaml: any;
        let dbYaml: Array<any>;

        try {

            await this.pgDb.query('BEGIN');
            try {
                dbYaml = await this.pgExMe.extractMetadataGenerators('', true, false);

                if (dbYaml === undefined)
                    throw 'no se pudo extraer el metadata de la base';
            }
            finally {
                await this.pgDb.query('COMMIT');
            }

            for (let i in this.sources.generatorsArrayYaml) {
                if (globalFunction.isChange(this.sources.generatorsArrayYaml[i], this.originalMetadata.generatorsArrayYaml, GlobalTypes.ArrayobjectType[3])) {
                    fileYaml = this.sources.generatorsArrayYaml[i].contentFile;
                    genBody = [];
                    genName = fileYaml.generator.name;

                    if (!genName.toUpperCase().startsWith('G_'))
                        genName = 'G_' + genName;

                    if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[3], genName)) {
                        genBody.push('CREATE SEQUENCE ' + this.schema + '.' + genName + ' INCREMENT ' + fileYaml.generator.increment.toString() + ';');
                        genBody.push('ALTER SEQUENCE ' + this.schema + '.' + genName + ' OWNER TO ' + this.dbRole + ';');
                        if ('description' in fileYaml.generator)
                            genBody.push('COMMENT ON SEQUENCE ' + this.schema + '.' + genName + " IS '" + fileYaml.generator.description + "';");
                        if (dbYaml.findIndex(aItem => (aItem.generator.name.toLowerCase() === genName.toLowerCase())) === -1) {
                            await this.applyChange(GlobalTypes.ArrayobjectType[3], genName, genBody);
                        }
                    }
                }
            }
        }
        catch (err) {
            throw new Error('Error aplicando generador ' + genName + '. ' + err.message);
        }
    }

    //****************************************************************** */
    //        E X T E N S I O N
    //******************************************************************* */

    private async applyExtension() {
        let extName: string = '';
        let extBody: Array<string> = [];
        let fileYaml: any;
        let dbYaml: Array<any>;
        let rquery: any;

        try {
            await this.pgDb.query('BEGIN');
            try {
                rquery = await this.pgDb.query('select * from pg_extension');
                dbYaml = rquery.rows;
            }
            finally {
                await this.pgDb.query('COMMIT');
            }

            for (let i in this.sources.extensionArrayYaml) {

                fileYaml = this.sources.extensionArrayYaml[i].contentFile;
                for (let j = 0; j < fileYaml.installExtension.length; j++) {
                    extName = fileYaml.installExtension[j].extension.name.trim().toLowerCase();
                    if (dbYaml.findIndex(aItem => (aItem.extname.toLowerCase() === extName)) === -1) {
                        extBody.push('CREATE EXTENSION IF NOT EXISTS ' + extName);
                    }
                }
            }
            if (extBody.length > 0)
                await this.applyChange(GlobalTypes.ArrayobjectType[3], 'extension', extBody);
        }
        catch (err) {
            throw new Error('Error aplicando generador ' + extName + '. ' + err.message);
        }
    }

    //****************************************************************** */
    //        T A B L E S
    //******************************************************************* */
    private async applyTables() {
        let tableName: string = '';
        let dbYaml: Array<any> = [];
        let tableScript: Array<string> = [];
        let j: number = 0;
        let fileYaml: any;
        let arrayAux: Array<any> = [];
        let iDB: number = 0;

        try {
            await this.pgDb.query('BEGIN');
            try {
                dbYaml = await this.pgExMe.extractMetadataTables('', true, false);

                if (dbYaml === undefined) {
                    throw 'no se pudo extraer el metadata de la base';
                }
            }
            finally {
                await this.pgDb.query('COMMIT');
            }

            for (let i in this.sources.tablesArrayYaml) {
                if (globalFunction.isChange(this.sources.tablesArrayYaml[i], this.originalMetadata.tablesArrayYaml, GlobalTypes.ArrayobjectType[2])) {
                    fileYaml = this.sources.tablesArrayYaml[i].contentFile;

                    if (('temporaryType' in fileYaml.table && fileYaml.table.temporaryType === '') || (!('temporaryType' in fileYaml.table))) {
                        tableName = fileYaml.table.name;

                        if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[2], tableName)) {

                            j = dbYaml.findIndex(aItem => (aItem.table.name.toLowerCase() === tableName.toLowerCase()));
                            tableScript = [];

                            if (j === -1) { //NO EXISTE TABLA
                                tableScript = this.newTableYamltoString(fileYaml.table);
                                //tableScript.push('ALTER TABLE ' + this.schema + '.' + globalFunction.quotedString(tableName) + ' OWNER TO ' + this.dbRole + ';');
                            }
                            else {
                                tableScript = tableScript.concat(this.getTableColumnDiferences(tableName, fileYaml.table.columns, dbYaml[j].table.columns, this.schema));
                                tableScript = tableScript.concat(this.getTableConstraintDiferences(tableName, fileYaml.table.constraint, dbYaml[j].table.constraint, this.schema));
                                tableScript = tableScript.concat(this.getTableDescriptionDiferences(tableName, fileYaml.table, dbYaml[j].table, this.schema));
                                // ver indices se cambio el formato de los campos que lo componen
                                tableScript = tableScript.concat(this.getTableIndexesDiferences(tableName, fileYaml.table, dbYaml[j].table, this.schema));
                            }

                            if (tableScript.length > 0)
                                await this.applyChange(GlobalTypes.ArrayobjectType[2], tableName, tableScript);
                        }
                    }
                }
            }

            // solamente para los constraint van a lo ultimo por los foreinkey
            for (let i in this.sources.tablesArrayYaml) {
                if (globalFunction.isChange(this.sources.tablesArrayYaml[i], this.originalMetadata.tablesArrayYaml, GlobalTypes.ArrayobjectType[2])) {
                    fileYaml = this.sources.tablesArrayYaml[i].contentFile;

                    if ('temporaryType' in fileYaml && fileYaml.temporaryType !== '') {
                        tableName = fileYaml.table.name.toLowerCase().trim();

                        if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[2], tableName)) {

                            j = dbYaml.findIndex(aItem => (aItem.table.name.toLowerCase().trim() === tableName));
                            tableScript = [];

                            if (j === -1) {
                                if ('constraint' in fileYaml.table) {
                                    if ('foreignkeys' in fileYaml.table.constraint)
                                        tableScript = tableScript.concat(foreignkeysToSql(globalFunction.quotedString(tableName), fileYaml.table.constraint.foreignkeys, this.schema));
                                }
                            }
                            else {
                                //tableScript = tableScript.concat(this.getTableConstraintDiferences(tableName, fileYaml.table.constraint, dbYaml[j].table.constraint));
                                if ('foreignkeys' in fileYaml.table.constraint) {
                                    if ('foreignkeys' in dbYaml[j].table.constraint)
                                        arrayAux = dbYaml[j].table.constraint.foreignkeys;
                                    else
                                        arrayAux = [];

                                    for (let z = 0; z < fileYaml.table.constraint.foreignkeys.length; z++) {
                                        iDB = arrayAux.findIndex(aItem => (aItem.foreignkey.name.toLowerCase().trim() === fileYaml.table.constraint.foreignkeys[z].foreignkey.name.toLowerCase().trim()));
                                        if (iDB === -1)
                                            tableScript = tableScript.concat(foreignkeysToSql(globalFunction.quotedString(tableName), Array(fileYaml.table.constraint.foreignkeys[z]), this.schema));
                                        else { /* || or && and*/
                                            if (String(fileYaml.table.constraint.foreignkeys[z].foreignkey.onColumn).trim().toUpperCase() !== String(dbYaml[j].table.constraint.foreignkeys[iDB].foreignkey.onColumn).trim().toUpperCase() ||
                                                String(fileYaml.table.constraint.foreignkeys[z].foreignkey.toTable).trim().toUpperCase() !== String(dbYaml[j].table.constraint.foreignkeys[iDB].foreignkey.toTable).trim().toUpperCase() ||
                                                String(fileYaml.table.constraint.foreignkeys[z].foreignkey.toColumn).trim().toUpperCase() !== String(dbYaml[j].table.constraint.foreignkeys[iDB].foreignkey.toColumn).trim().toUpperCase() ||
                                                String(fileYaml.table.constraint.foreignkeys[z].foreignkey.updateRole).trim().toUpperCase() !== String(dbYaml[j].table.constraint.foreignkeys[iDB].foreignkey.updateRole).trim().toUpperCase() ||
                                                String(fileYaml.table.constraint.foreignkeys[z].foreignkey.deleteRole).trim().toUpperCase() !== String(dbYaml[j].table.constraint.foreignkeys[iDB].foreignkey.deleteRole).trim().toUpperCase()) {

                                                tableScript.push('ALTER TABLE ' + globalFunction.quotedString(tableName) + ' DROP CONSTRAINT ' + globalFunction.quotedString(fileYaml.table.constraint.foreignkeys[z].foreignkey.name) + ';');
                                                tableScript = tableScript.concat(foreignkeysToSql(globalFunction.quotedString(tableName), Array(fileYaml.table.constraint.foreignkeys[z]), this.schema));
                                            }
                                        }
                                    }
                                }
                            }
                            if (tableScript.length > 0)
                                await this.applyChange(GlobalTypes.ArrayobjectType[2], tableName, tableScript);
                        }
                    }
                }
            }

            //solamente pra rdb$database
            j = dbYaml.findIndex(aItem => (aItem.table.name.toLowerCase() === 'rdb$database'));

            if (j === -1) { //NO EXISTE TABLA
                tableScript.push('CREATE TABLE rdb$database (fcodigo integer)')
                await this.applyChange(GlobalTypes.ArrayobjectType[2], tableName, tableScript);
            }

        } catch (err) {
            throw new Error('Error aplicando tabla ' + tableName + '.' + err.message);
        }

    }

    newTableYamltoString(aYaml: any): Array<string> {
        let aTable: string = '';
        let aText: string = '';
        let aRet: Array<string> = [];
        let aNameTable: string = globalFunction.quotedString(aYaml.name);

        aTable = 'CREATE TABLE ' + this.schema + '.' + globalFunction.quotedString(aYaml.name) + ' (' + GlobalTypes.CR;
        for (let j = 0; j < aYaml.columns.length - 1; j++) {
            aTable += GlobalTypes.TAB + fieldToSql(aYaml.columns[j].column) + ',' + GlobalTypes.CR;
        }

        aTable += GlobalTypes.TAB + fieldToSql(aYaml.columns[aYaml.columns.length - 1].column) + ');';

        aRet.push(aTable);

        aRet.push('ALTER TABLE ' + this.schema + '.' + aNameTable + ' OWNER TO ' + this.dbRole + ';');

        if ('constraint' in aYaml) {
            /*if ('foreignkeys' in aYaml.constraint)
                aRet = aRet.concat(foreignkeysToSql(aYaml.name, aYaml.constraint.foreignkeys, this.schema));*/
            if ('checks' in aYaml.constraint)
                aRet = aRet.concat(checkToSql(aNameTable, aYaml.constraint.checks, this.schema));
            if ('primaryKey' in aYaml.constraint)
                aRet.push(primaryKeyToSql(aNameTable, aYaml.constraint.primaryKey, this.schema));
        }

        if ('indexes' in aYaml) {
            aRet = aRet.concat(indexesToSql(aNameTable, aYaml.indexes, this.schema));
        }

        if ('description' in aYaml) {
            aTable = "COMMENT ON TABLE " + this.schema + '.' + aNameTable + " IS '" + aYaml.description + "';";
            aRet.push(aTable);
        }

        for (let j = 0; j < aYaml.columns.length; j++) {
            if ('description' in aYaml.columns[j].column && aYaml.columns[j].column.description !== '') {
                aTable = "COMMENT ON COLUMN " + this.schema + '.' + aNameTable + "." + aYaml.columns[j].column.name + " IS '" + aYaml.columns[j].column.description + "';";
                aRet.push(aTable);
            }
        }
        return aRet;
    }

    getTableColumnDiferences(aTableName: string, aFileColumnsYaml: Array<any>, aDbColumnsYaml: Array<any>, aSchema: string): Array<string> {
        let i: number = 0;
        let retText: string = '';
        let retArray: Array<string> = [];
        let retCmd: string = '';
        let retAux: string = '';

        aTableName = globalFunction.quotedString(aTableName);

        for (let j = 0; j < aFileColumnsYaml.length; j++) {
            if (globalFunction.includeObject(this.excludeObject, 'fields', aFileColumnsYaml[j].column.name)) {
                i = aDbColumnsYaml.findIndex(aItem => (aItem.column.name.toLowerCase() === aFileColumnsYaml[j].column.name.toLowerCase()));

                if (i === -1) { //no existe campo
                    retArray.push('ALTER TABLE ' + aSchema + '.' + aTableName + ' ADD ' + fieldToSql(aFileColumnsYaml[j].column) + ';');
                }
                else { //existe campo 
                    if (!("computed" in aFileColumnsYaml[j].column)) {
                        if (GlobalTypes.convertDataTypeToPG(aFileColumnsYaml[j].column.type).toUpperCase() !== GlobalTypes.convertDataTypeToPG(aDbColumnsYaml[i].column.type).toUpperCase()) {
                            retArray.push('ALTER TABLE ' + aSchema + '.' + aTableName + ' ALTER COLUMN ' + globalFunction.quotedString(aFileColumnsYaml[j].column.name) + ' TYPE ' + aFileColumnsYaml[j].column.type + ';');
                        }
                    }
                    if (aFileColumnsYaml[j].column.default !== aDbColumnsYaml[i].column.default) {
                        if (aFileColumnsYaml[j].column.default !== '')
                            retArray.push('ALTER TABLE ' + aSchema + '.' + aTableName + ' ALTER COLUMN ' + globalFunction.quotedString(aFileColumnsYaml[j].column.name) + ' SET DEFAULT ' + aFileColumnsYaml[j].column.default + ';');
                        else
                            retArray.push('ALTER TABLE ' + aSchema + '.' + aTableName + ' ALTER COLUMN ' + globalFunction.quotedString(aFileColumnsYaml[j].column.name) + ' DROP DEFAULT;');
                    }
                    if (aFileColumnsYaml[j].column.nullable !== aDbColumnsYaml[i].column.nullable) {
                        retAux = 'ALTER TABLE ' + aSchema + '.' + aTableName + ' ALTER COLUMN ' + globalFunction.quotedString(aFileColumnsYaml[j].column.name);
                        retCmd = '';

                        if (aFileColumnsYaml[j].column.nullable === false && aDbColumnsYaml[i].column.nullable === true) {
                            if (!('nullableToNotNullValue' in aFileColumnsYaml[j].column))
                                throw new Error('Si cambia de null a not null complete la opcion "nullableToNotNullValue" para llenar el campo');

                            retCmd = 'UPDATE ' + aSchema + '.' + aTableName + ' SET ' + globalFunction.quotedString(aFileColumnsYaml[j].column.name) + "='" + aFileColumnsYaml[j].column.nullableToNotNullValue + "' WHERE " + globalFunction.quotedString(aFileColumnsYaml[j].column.name) + ' IS NULL;';
                            retAux += ' SET NOT NULL'; //ver con que lo lleno al campo que seteo asi   
                        }
                        else if (aFileColumnsYaml[j].column.nullable === true && aDbColumnsYaml[i].column.nullable === false) {
                            retAux += ' DROP NOT NULL';
                        }
                        if (retCmd !== '')
                            retArray.push(retCmd);

                        retArray.push(retAux + ';');
                    }
                    if (aFileColumnsYaml[j].column.computed !== aDbColumnsYaml[i].column.computed) {
                        retArray.push('ALTER TABLE ' + aSchema + '.' + aTableName + ' ALTER COLUMN ' + globalFunction.quotedString(aFileColumnsYaml[j].column.name) + ' COMPUTED BY ' + aFileColumnsYaml[j].column.computed + ';');
                    }
                    //present?: boolean
                    if (i !== j) { //difiere posicion del campo
                        retArray.push('ALTER TABLE ' + aSchema + '.' + aTableName + ' ALTER COLUMN ' + globalFunction.quotedString(aFileColumnsYaml[j].column.name) + ' POSITION ' + (j + 1) + ';');
                    }
                }
            }
        }
        return retArray;
    }

    getTableConstraintDiferences(aTableName: string, aFileConstraintYaml: any, aDbConstraintYaml: any, aSchema: string): Array<string> {
        let retArray: Array<string> = [];
        let iDB: number = 0;
        let pkDB: string = '';
        let pkFY: string = '';
        let arrayAux: Array<any> = [];

        aTableName = globalFunction.quotedString(aTableName);

        if ('checks' in aFileConstraintYaml) {
            if ('checks' in aDbConstraintYaml)
                arrayAux = aDbConstraintYaml.checks;
            else
                arrayAux = [];
            for (let j = 0; j < aFileConstraintYaml.checks.length; j++) {
                iDB = arrayAux.findIndex(aItem => (aItem.check.name.toLowerCase().trim() === aFileConstraintYaml.checks[j].check.name.toLowerCase().trim()));
                if (iDB === -1)
                    retArray = retArray.concat(checkToSql(aTableName, Array(aFileConstraintYaml.checks[j]), aSchema));
                else { /* || or && and*/
                    if (String(aFileConstraintYaml.checks[j].expresion).trim().toUpperCase() !== String(aDbConstraintYaml.checks[iDB].expresion).trim().toUpperCase()) {
                        retArray.push('ALTER TABLE ' + aSchema + '.' + aTableName + ' DROP CONSTRAINT ' + globalFunction.quotedString(aFileConstraintYaml[j].foreignkey.name) + ';');
                        retArray = retArray.concat(checkToSql(aTableName, Array(aFileConstraintYaml.foreignkeys[j]), aSchema));
                    }
                }
            }
        }

        if ('primaryKey' in aFileConstraintYaml) {
            pkFY = primaryKeyToSql(aTableName, aFileConstraintYaml.primaryKey, aSchema);
            pkDB = primaryKeyToSql(aTableName, aDbConstraintYaml.primaryKey, aSchema);
            if (pkFY.trim().toUpperCase() !== pkDB.trim().toUpperCase()) {
                if (pkDB !== '')
                    retArray.push('ALTER TABLE ' + aSchema + '.' + aTableName + ' DROP CONSTRAINT ' + globalFunction.quotedString(aDbConstraintYaml.primaryKey.name));

                retArray.push(pkFY);
            }
        }

        return retArray;
    }

    getTableIndexesDiferences(aTableName: string, aFileIdxYaml: any, aDbIdxYaml: any, aSchema: string): Array<string> {
        let retArray: Array<string> = [];
        let iDB: number = 0;
        let arrayAux: Array<any> = [];
        let idxYL: string = '';
        let idxDB: string = '';

        aTableName = globalFunction.quotedString(aTableName);

        if ('indexes' in aFileIdxYaml) {
            if ('indexes' in aDbIdxYaml)
                arrayAux = aDbIdxYaml.indexes;
            else
                arrayAux = [];

            for (let j = 0; j < aFileIdxYaml.indexes.length; j++) {
                iDB = arrayAux.findIndex(aItem => (aItem.index.name.toLowerCase().trim() === aFileIdxYaml.indexes[j].index.name.toLowerCase().trim()));
                //el index del array que devuelve el siguiente proc es 0 porque me devuelve la linea de creacion
                //en el primer elemento del array.
                idxYL = indexesToSql(aTableName, Array(aFileIdxYaml.indexes[j]), aSchema)[0];
                if (iDB === -1)
                    retArray.push(idxYL);
                else {
                    idxDB = indexesToSql(aTableName, Array(aDbIdxYaml.indexes[iDB]), aSchema)[0];
                    if (idxDB.trim().toUpperCase() !== idxYL.trim().toUpperCase()) {
                        retArray.push('DROP INDEX ' + aSchema + '.' + globalFunction.quotedString(aFileIdxYaml.indexes[j].index.name) + ';');
                        retArray.push(idxYL);
                    }
                }
            }
        }
        return retArray;
    }

    getTableDescriptionDiferences(aTableName: string, aFileYaml: any, aDbYaml: any, aSchema: string): Array<string> {
        //COMMENT ON COLUMN public.art_arch.fcodigo IS 'ffff';
        let setDescription = (aFY: any, aDB: any, aStartQuery: string): string => {
            let aText: string = '';
            if ('description' in aFY) {
                if ('description' in aDB) {
                    if (aFY.description !== aDB.description)
                        aText = 'COMMENT ON ' + aStartQuery + " IS '" + aFY.description + "';" + GlobalTypes.CR;
                }
                else
                    aText = 'COMMENT ON ' + aStartQuery + " IS '" + aFY.description + "';" + GlobalTypes.CR;
            }
            else if ('description' in aDB)
                aText = 'COMMENT ON ' + aStartQuery + " IS NULL;" + GlobalTypes.CR;

            return aText;
        }

        let retArray: Array<string> = [];
        let iDB: number = 0;
        let arrayAux: Array<any> = [];

        if (setDescription(aFileYaml, aDbYaml, 'TABLE ' + aSchema + '.' + aTableName) !== '')
            retArray.push(setDescription(aFileYaml, aDbYaml, 'TABLE ' + aSchema + '.' + aTableName));

        arrayAux = aDbYaml.columns;

        for (let j = 0; j < aFileYaml.columns.length; j++) {
            iDB = arrayAux.findIndex(aItem => (aItem.column.name === aFileYaml.columns[j].column.name));
            if (iDB !== -1 && setDescription(aFileYaml.columns[j].column, aDbYaml.columns[iDB].column, 'COLUMN ' + aSchema + '.' + aTableName + '.' + aFileYaml.columns[j].column.name) !== '')
                retArray.push(setDescription(aFileYaml.columns[j].column, aDbYaml.columns[iDB].column, 'COLUMN ' + aSchema + '.' + aTableName + '.' + aFileYaml.columns[j].column.name));
        }

        return retArray;
    }

    //****************************************************************** */
    //        D E C L A R A C I O N E S    P U B L I C A S
    //******************************************************************* */

    public async applyYalm(ahostName: string, aportNumber: number, adatabase: string, adbUser: string, adbPassword: string, adbRole: string, objectType: string, objectName: string) {
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

            this.pgExMe.pgDb = this.pgDb;

            if (this.saveToLog)
                await this.checkMetadataLog();

            try {
                if (this.saveafterapply !== '') {
                    this.pgExMe.excludeObject = this.excludeObject;
                    this.pgExMe.schema = this.schema;
                    this.pgExMe.filesPath = this.saveafterapply;

                    this.originalMetadata.pathSource1 = this.saveafterapply;
                    this.originalMetadata.readSource(objectType, objectName);
                }

                this.sources.readSource(objectType, objectName);
                if (objectType === '' || objectType === GlobalTypes.ArrayobjectType[3]) {
                    await this.applyGenerators();
                    if (this.saveafterapply !== '')
                        await this.pgExMe.extractMetadataGenerators(objectName, false, false);
                }
                if (objectType === '' || objectType === GlobalTypes.ArrayobjectType[2]) {
                    await this.applyTables();
                    if (this.saveafterapply !== '')
                        await this.pgExMe.extractMetadataTables(objectName, false, false);
                }
                if (objectType === '' || objectType === GlobalTypes.ArrayobjectType[4]) {
                    await this.applyViews();
                    if (this.saveafterapply !== '')
                        await this.pgExMe.extractMetadataViews(objectName, false, false);
                }
                if (objectType === '' || objectType === GlobalTypes.ArrayobjectType[0]) {
                    await this.applyProcedures();
                    if (this.saveafterapply !== '')
                        await this.pgExMe.extractMetadataProcedures(objectName, false, false);
                }
                if (objectType === '' || objectType === GlobalTypes.ArrayobjectType[1]) {
                    await this.applyTriggers();
                    if (this.saveafterapply !== '')
                        await this.pgExMe.extractMetadataTriggers(objectName, false, false);
                }
                if (objectType === '' || objectType === GlobalTypes.ArrayobjectType[7]) {
                    await this.applyExtension();
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


function fieldToSql(aField: any) {
    let retFld: string = '';

    retFld = globalFunction.quotedString(aField.name) + ' ';
    if ('computed' in aField) {
        retFld += ' COMPUTED BY ' + aField.computed;
    }
    else {
        switch (aField.type) {
            case 'blob text':
                retFld += 'text';
                break;
            case 'blob binary':
                retFld += 'bytea';
                break;
            default:
                retFld += aField.type;
        }

        if ('default' in aField) {
            if (!String(aField.default).toUpperCase().startsWith('DEFAULT'))
                retFld += ' DEFAULT ' + aField.default;
            else
                retFld += ' ' + aField.default;
        }
        if (aField.nullable === false) {
            retFld += ' NOT NULL';
        }
    }
    return retFld;
}

function foreignkeysToSql(aTableName: string, aForeinKey: any, aSchema: string): Array<string> {
    //name,onColumn,toTable,toColumn,updateRole,deleteRole
    //ALTER TABLE ART_ARCH ADD CONSTRAINT FK_ART_ARCH_CUECOM FOREIGN KEY (FCUECOM) REFERENCES CON_CUEN (FCUENTA) ON UPDATE CASCADE;
    let aRet: Array<string> = [];
    let aText: string = '';
    aTableName = globalFunction.quotedString(aTableName);
    for (let j = 0; j < aForeinKey.length; j++) {
        aText = 'ALTER TABLE ' + aSchema + '.' + aTableName + ' ADD CONSTRAINT ' + globalFunction.quotedString(aForeinKey[j].foreignkey.name) + ' FOREIGN KEY (' + aForeinKey[j].foreignkey.onColumn + ') REFERENCES ' + aForeinKey[j].foreignkey.toTable + ' (' + aForeinKey[j].foreignkey.toColumn + ')';
        if ('updateRole' in aForeinKey[j].foreignkey) {
            aText += ' ON UPDATE ' + aForeinKey[j].foreignkey.updateRole;
        }
        if ('deleteRole' in aForeinKey[j].foreignkey) {
            aText += ' ON DELETE ' + aForeinKey[j].foreignkey.deleteRole
        }
        aRet.push(aText + ';');
        if ('description' in aForeinKey[j].foreignkey)
            aRet.push('COMMENT ON CONSTRAINT ' + aSchema + '.' + aTableName + " IS '" + aForeinKey[j].foreignkey.description + "';");
    }
    return aRet;
}

function checkToSql(aTableName: string, aCheck: any, aSchema: string): Array<string> {
    //name, expresion
    //ALTER TABLE ART_ARCH ADD CONSTRAINT ART_ARCH_UXD CHECK (FUXD>0);
    let aRet: Array<string> = [];
    let aText: string = '';

    aTableName = globalFunction.quotedString(aTableName);

    for (let j = 0; j < aCheck.length; j++) {
        aText = 'ALTER TABLE ' + aSchema + '.' + aTableName + ' ADD CONSTRAINT ' + globalFunction.quotedString(aCheck[j].check.name);
        if (aCheck[j].check.expresion.trim().toUpperCase().startsWith('CHECK')) {
            aText += ' ' + aCheck[j].check.expresion.trim() + ';';
        }
        else {
            aText += ' CHECK ' + aCheck[j].check.expresion.trim() + ';';
        }
        aRet.push(aText);
        if ('description' in aCheck[j].check)
            aRet.push('COMMENT ON CONSTRAINT ' + aSchema + '.' + aTableName + " IS '" + aCheck[j].check.description + "';");
    }
    return aRet;
}

function primaryKeyToSql(aTableName: string, aPk: any, aSchema: string): string {
    //ALTER TABLE ART_ARCH ADD CONSTRAINT ART_ARCH_PK PRIMARY KEY (FCODINT);    
    let aText: string = '';

    if (aPk.name !== undefined && aPk.name !== '' && aPk.columns.length > 0) {
        aText += 'ALTER TABLE ' + aSchema + '.' + aTableName + ' ADD CONSTRAINT ' + globalFunction.quotedString(aPk.name) + ' PRIMARY KEY (';
        for (let j = 0; j < aPk.columns.length - 1; j++) {
            aText += globalFunction.quotedString(aPk.columns[j]) + ',';
        }
        aText += globalFunction.quotedString(aPk.columns[aPk.columns.length - 1]) + ');';
    }
    return aText;
}

function indexesToSql(aTableName: string, aIdx: any, aSchema: string): Array<string> {
    //active,computedBy,columns,name,unique,descending
    //CREATE UNIQUE INDEX ART_ARCH_CODIGO ON ART_ARCH (FCODIGO);
    //CREATE INDEX ART_ARCH_CODMAD ON ART_ARCH (FCODMAD);
    //CREATE INDEX ART_ARCH_IDX2 ON ART_ARCH COMPUTED BY (TRIM(FCODIGO))
    let aRet: Array<string> = [];
    let aText: string = '';
    let aDescending: boolean = false;


    for (let j = 0; j < aIdx.length; j++) {
        aText = '';
        if (aIdx[j].index.unique == true)
            aText = ' UNIQUE ';
        if (aIdx[j].index.descending == true)
            aDescending = true;
        if ('computedBy' in aIdx[j].index) {
            if (String(aIdx[j].index.computedBy).startsWith('('))
                aText = 'CREATE ' + aText + ' INDEX ' + globalFunction.quotedString(aIdx[j].index.name) + ' ON ' + aSchema + '.' + aTableName + ' ' + aIdx[j].index.computedBy;
            else
                aText = 'CREATE ' + aText + ' INDEX ' + globalFunction.quotedString(aIdx[j].index.name) + ' ON ' + aSchema + '.' + aTableName + '(' + aIdx[j].index.computedBy + ')';
        }
        else {
            aText = 'CREATE ' + aText + ' INDEX ' + globalFunction.quotedString(aIdx[j].index.name) + ' ON ' + aSchema + '.' + aTableName + '(';
            for (let i = 0; i < aIdx[j].index.columns.length - 1; i++) {
                //diferencia entre typeof e instanceof https://stackoverflow.com/questions/14839656/differences-between-typeof-and-instanceof-in-javascript                
                if (typeof aIdx[j].index.columns[i] === 'string') {
                    aText += globalFunction.quotedString(aIdx[j].index.columns[i]) + globalFunction.ifThen(aDescending, ' DESC', '') + ',';
                }
                else {
                    aText += globalFunction.quotedString(aIdx[j].index.columns[i].name);
                    switch (aIdx[j].index.columns[i].order.toUpperCase().trim()) {
                        case 'ASC':
                        case 'ASC NULLS LAST':
                            aText += ',';
                            break;
                        case 'DESC NULLS FIRST':
                            aText += ' DESC,';
                            break;
                        default:
                            aText += ' ' + aIdx[j].index.columns[i].order + ',';
                    }
                }
            }

            if (typeof aIdx[j].index.columns[aIdx[j].index.columns.length - 1] === 'string') {
                aText += globalFunction.quotedString(aIdx[j].index.columns[aIdx[j].index.columns.length - 1]) + globalFunction.ifThen(aDescending, ' DESC', '') + ')'
            }
            else {
                aText += globalFunction.quotedString(aIdx[j].index.columns[aIdx[j].index.columns.length - 1].name);
                switch (aIdx[j].index.columns[aIdx[j].index.columns.length - 1].order.toUpperCase().trim()) {
                    case 'ASC':
                    case 'ASC NULLS LAST':
                        aText += ')';
                        break;
                    case 'DESC NULLS FIRST':
                        aText += ' DESC)';
                        break;
                    default:
                        aText += aIdx[j].index.columns[aIdx[j].index.columns.length - 1].order + ')';
                }
            }
        }
        aRet.push(aText + ';');

        if ('description' in aIdx[j].index)
            aRet.push('COMMENT ON INDEX ' + aSchema + '.' + aTableName + " IS '" + aIdx[j].index.description + "';");
    }
    return aRet;
}            
