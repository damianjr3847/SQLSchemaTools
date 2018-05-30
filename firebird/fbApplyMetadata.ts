import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as fbClass from './classFirebird';
import * as GlobalTypes from '../common/globalTypes';
import * as fbExtractMetadata from './fbExtractMetadata';
import * as globalFunction from '../common/globalFunction';
import * as sources from '../common/loadsource';

const saveMetadataTable = `CREATE TABLE {TABLE} (
                                FINDICE  INTEGER NOT NULL PRIMARY KEY,
                                FFECHA   DATE NOT NULL,
                                FHORA    TIME NOT NULL,
                                FOBTYPE  VARCHAR(20) NOT NULL,
                                FOBNAME  VARCHAR(100) NOT NULL,
                                FQUERY   BLOB SUB_TYPE 1 SEGMENT SIZE 80
                            );`;
const saveMetadataGenerator = `CREATE SEQUENCE G_{TABLE};`;

const saveQueryLog = `INSERT INTO {TABLE} (FINDICE, FFECHA, FHORA, FOBTYPE, FOBNAME, FQUERY)
                      VALUES (GEN_ID(G_{TABLE},1), CURRENT_DATE, CURRENT_TIME, ?, ?, ?)`;

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


export class fbApplyMetadata {
    private fb: fbClass.fbConnection;
    private fbExMe: fbExtractMetadata.fbExtractMetadata;

    public pathFileScript: string = '';
    public excludeObject: any;
    public saveToLog: string = '';
    public sources: sources.tSource | any;

    constructor() {
        this.fb = new fbClass.fbConnection;
        this.fbExMe = new fbExtractMetadata.fbExtractMetadata(this.fb);
        this.sources = new sources.tSource;
    }

    private async checkMetadataLog() {
        await this.fb.startTransaction(false);
        try {
            if (!(await this.fb.validate('SELECT 1 FROM RDB$RELATIONS REL WHERE UPPER(REL.RDB$RELATION_NAME)=?', [this.saveToLog.toUpperCase()]))) {
                await this.fb.execute(saveMetadataTable.replace('{TABLE}', this.saveToLog), []);
            }
            if (!(await this.fb.validate('SELECT 1 FROM RDB$GENERATORS WHERE UPPER(RDB$GENERATOR_NAME)=?', ['G_' + this.saveToLog.toUpperCase()]))) {
                await this.fb.execute(saveMetadataGenerator.replace('{TABLE}', this.saveToLog), []);
            }
        }
        finally {
            await this.fb.commit();
        }
    }

    private async applyChange(aObjectType: string, aObjectName: string, aAlterScript: Array<string>) {
        let query: string = '';

        try {
            if (this.pathFileScript === '') {
                for (var i in aAlterScript) {
                    //console.log(i.toString()+'--'+aAlterScript[i]);    
                    query = aAlterScript[i];
                    if (query !== '') {
                        if (aObjectName === 'lis_hojadecarga_faltante')
                            aObjectName = aObjectName
                        await this.fb.startTransaction(false);
                        await this.fb.execute(aAlterScript[i], []);
                        if (this.saveToLog !== '') {
                            await this.fb.execute(saveQueryLog.replace(new RegExp('{TABLE}', 'g'), this.saveToLog), [aObjectType, aObjectName, aAlterScript[i]]);
                        }
                        await this.fb.commit();
                    }    
                }
                console.log(('Aplicando ' + aObjectType + ' ' + aObjectName).padEnd(70, '.') + 'OK');
            }
            else
                globalFunction.outFileScript(aObjectType, aAlterScript, this.pathFileScript);
            //this.outFileScript(aObjectType, aAlterScript);
        }
        catch (err) {
            if (this.fb.inTransaction())
                await this.fb.rollback();
            throw new Error(query + '.' + err.message);
        }

    }
    //****************************************************************** */
    //        P R O C E D U R E S
    //******************************************************************* */
    private async applyProcedures() {
        let procedureYamltoString = (aYaml: any, aWithBody: boolean) => {
            let paramString = (param: any, aExtra: string) => {
                let aText: string = '';

                if (param.length > 0) {
                    for (let j = 0; j < param.length - 1; j++) {
                        aText += globalFunction.quotedString(param[j].param.name) + ' ' + GlobalTypes.convertDataTypeToFB(param[j].param.type) + ',' + GlobalTypes.CR;
                    }
                    aText += globalFunction.quotedString(param[param.length - 1].param.name) + ' ' + GlobalTypes.convertDataTypeToFB(param[param.length - 1].param.type);
                    aText = aExtra + '(' + GlobalTypes.CR + aText + ')';
                };
                return aText;
            };

            let aProc: string = '';

            aProc = 'CREATE OR ALTER PROCEDURE ' + globalFunction.quotedString(aYaml.procedure.name);

            if ('inputs' in aYaml.procedure)
                aProc += paramString(aYaml.procedure.inputs, '');
            if ('outputs' in aYaml.procedure)
                aProc += paramString(aYaml.procedure.outputs, ' RETURNS ');

            if (aWithBody)
                aProc += GlobalTypes.CR + 'AS' + GlobalTypes.CR + aYaml.procedure.body;
            else {
                if ('outputs' in aYaml.procedure)
                    aProc += GlobalTypes.CR + 'AS' + GlobalTypes.CR + " begin exception e_custom_err 'Cambiando procedimiento aguerde un momento por favor'; suspend; end";
                else
                    aProc += GlobalTypes.CR + 'AS' + GlobalTypes.CR + " begin exception e_custom_err 'Cambiando procedimiento aguerde un momento por favor'; end";
            }
            return aProc;
        }

        let readProcedures = async (aWithBody: boolean) => {
            let cambios: boolean = false;

            for (let i in this.sources.proceduresArrayYaml) {

                fileYaml = this.sources.proceduresArrayYaml[i].contentFile;

                procedureName = fileYaml.procedure.name.toLowerCase().trim();

                if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[0], procedureName)) {

                    j = dbYaml.findIndex(aItem => (aItem.procedure.name.toLowerCase().trim() === procedureName));

                    procedureBody = procedureYamltoString(fileYaml, true);
                    if (j !== -1) {
                        procedureInDB = procedureYamltoString(dbYaml[j], true);
                    }

                    if (procedureInDB !== procedureBody) {
                        cambios = true;
                        await this.applyChange(GlobalTypes.ArrayobjectType[0], procedureName, Array(procedureYamltoString(fileYaml, aWithBody)));
                    }

                    procedureBody = '';
                    procedureInDB = '';
                }
            }
            return cambios;
        }

        let procedureName: string = '';
        let fileYaml: any;
        let dbYaml: Array<any> = [];
        let procedureBody: string = '';
        let procedureParams: string = '';
        let procedureInDB: any;
        let j: number = 0;

        try {
            await this.fb.startTransaction(true);

            dbYaml = await this.fbExMe.extractMetadataProcedures('', true, false);

            await this.fb.commit();

            if (await readProcedures(false)) {
                await readProcedures(true);
            }
            //console.log(Date.now());               
        }
        catch (err) {
            throw new Error('Error aplicando procedimiento ' + procedureName + '. ' + err.message + GlobalTypes.CR + procedureBody);
        }
    }

    //****************************************************************** */
    //        T R I G G E R S
    //******************************************************************* */

    private async applyTriggers() {
        let triggerYamltoString = (aYaml: any) => {
            let aProc: string = '';

            aProc = 'CREATE OR ALTER TRIGGER ' + globalFunction.quotedString(aYaml.triggerFunction.name) + ' FOR ';

            aProc += aYaml.triggerFunction.triggers[0].trigger.table;
            if (aYaml.triggerFunction.triggers[0].trigger.active) {
                aProc += ' ACTIVE ';
            }
            else {
                aProc += ' INACTIVE ';
            }

            aProc += aYaml.triggerFunction.triggers[0].trigger.fires + ' ';
            aProc += aYaml.triggerFunction.triggers[0].trigger.events[0];
            for (let j = 1; j < aYaml.triggerFunction.triggers[0].trigger.events.length; j++) {
                aProc += ' OR ' + aYaml.triggerFunction.triggers[0].trigger.events[j];
            };
            aProc += ' POSITION ' + aYaml.triggerFunction.triggers[0].trigger.position;

            aProc += GlobalTypes.CR + aYaml.triggerFunction.function.body;
            return aProc;
        };

        let triggerName: string = '';
        let dbYaml: Array<any> = [];
        let fileYaml: any;
        let triggerBody: string = '';
        let triggerInDb: string = '';
        let j: number = 0;

        try {
            await this.fb.startTransaction(true);

            dbYaml = await this.fbExMe.extractMetadataTriggers('', true, false);

            await this.fb.commit();

            for (let i in this.sources.triggersArrayYaml) {

                fileYaml = this.sources.triggersArrayYaml[i].contentFile;

                triggerName = fileYaml.triggerFunction.name.toLowerCase().trim();

                if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[1], triggerName)) {
                    j = dbYaml.findIndex(aItem => (aItem.triggerFunction.name.toLowerCase().trim() === triggerName));

                    triggerBody = triggerYamltoString(fileYaml);
                    if (j !== -1) {
                        triggerInDb = triggerYamltoString(dbYaml[j]);
                    }

                    if (triggerBody !== triggerInDb) {
                        await this.applyChange(GlobalTypes.ArrayobjectType[1], triggerName, Array(triggerBody));
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

            aView = 'CREATE OR ALTER VIEW ' + globalFunction.quotedString(aYaml.view.name) + '(' + GlobalTypes.CR;

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

        try {
            await this.fb.startTransaction(true);
            dbYaml = await this.fbExMe.extractMetadataViews('', true, false);
            await this.fb.commit();

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
                        await this.applyChange(GlobalTypes.ArrayobjectType[4], viewName, Array(viewBody));
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
            await this.fb.startTransaction(false);
            try {
                dbYaml = await this.fbExMe.extractMetadataGenerators('', true, false);

                if (dbYaml === undefined)
                    throw 'no se pudo extraer el metadata de la base';
            }
            finally {
                this.fb.commit();
            }

            for (let i in this.sources.generatorsArrayYaml) {
                fileYaml = this.sources.generatorsArrayYaml[i].contentFile;
                genBody = [];
                genName = fileYaml.generator.name.toLowerCase().trim();
                if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[3], genName)) {
                    genBody.push('CREATE SEQUENCE ' + globalFunction.quotedString(genName) + ' INCREMENT BY ' + fileYaml.generator.increment.toString() + ';');
                    if ('description' in fileYaml.generator)
                        genBody.push('COMMENT ON GENERATOR ' + genName + " IS '" + fileYaml.generator.description + "'");
                    i

                    if (dbYaml.findIndex(aItem => (aItem.generator.name.toLowerCase() === genName.toLowerCase())) === -1) {
                        await this.applyChange(GlobalTypes.ArrayobjectType[3], genName, genBody);
                    }
                }
            }

        }
        catch (err) {
            throw new Error('Error aplicando generador ' + genName + '. ' + err.message);
        }
    }

    //****************************************************************** */
    //        T A B L E S
    //******************************************************************* */
    private async applyTables() {
        let tableName: string = '';
        let dbYaml: Array<any> = [];
        let arrayAux: Array<any> = [];
        let tableScript: Array<string> = [];
        let j: number = 0;
        let fileYaml: any;
        let iDB: number = 0;

        try {
            await this.fb.startTransaction(true);

            dbYaml = await this.fbExMe.extractMetadataTables('', true, false);

            if (dbYaml === undefined) {
                throw 'no se pudo extraer el metadata de la base';
            }

            await this.fb.commit();

            for (let i in this.sources.tablesArrayYaml) {
                fileYaml = this.sources.tablesArrayYaml[i].contentFile;

                tableName = fileYaml.table.name.toLowerCase().trim();
                if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[2], tableName)) {

                    j = dbYaml.findIndex(aItem => (aItem.table.name.toLowerCase().trim() === tableName));
                    tableScript = [];

                    if (j === -1) { //NO EXISTE TABLA
                        tableScript = this.newTableYamltoString(fileYaml.table);
                    }
                    else {
                        tableScript = tableScript.concat(this.getTableColumnDiferences(tableName, fileYaml.table.columns, dbYaml[j].table.columns));
                        tableScript = tableScript.concat(this.getTableDescriptionDiferences(tableName, fileYaml.table, dbYaml[j].table));
                        tableScript = tableScript.concat(this.getTableIndexesDiferences(tableName, fileYaml.table, dbYaml[j].table));
                        tableScript = tableScript.concat(this.getTableConstraintDiferences(tableName, fileYaml.table.constraint, dbYaml[j].table.constraint));
                    }

                    if (tableScript.length > 0)
                        await this.applyChange(GlobalTypes.ArrayobjectType[2], tableName, tableScript);
                }
            }

            // solamente para los constraint van a lo ultimo por los foreinkey
            for (let i in this.sources.tablesArrayYaml) {
                fileYaml = this.sources.tablesArrayYaml[i].contentFile;

                tableName = fileYaml.table.name.toLowerCase().trim();                

                if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[2], tableName)) {

                    j = dbYaml.findIndex(aItem => (aItem.table.name.toLowerCase().trim() === tableName));
                    tableScript = [];

                    if (j === -1) {
                        if ('constraint' in fileYaml.table) {
                            if ('foreignkeys' in fileYaml.table.constraint)
                                tableScript = tableScript.concat(foreignkeysToSql(globalFunction.quotedString(tableName), fileYaml.table.constraint.foreignkeys));
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
                                    tableScript = tableScript.concat(foreignkeysToSql(globalFunction.quotedString(tableName), Array(fileYaml.table.constraint.foreignkeys[z])));
                                else { /* || or && and*/
                                    if (String(fileYaml.table.constraint.foreignkeys[z].foreignkey.onColumn).trim().toUpperCase() !== String(dbYaml[j].table.constraint.foreignkeys[iDB].foreignkey.onColumn).trim().toUpperCase() ||
                                        String(fileYaml.table.constraint.foreignkeys[z].foreignkey.toTable).trim().toUpperCase() !== String(dbYaml[j].table.constraint.foreignkeys[iDB].foreignkey.toTable).trim().toUpperCase() ||
                                        String(fileYaml.table.constraint.foreignkeys[z].foreignkey.toColumn).trim().toUpperCase() !== String(dbYaml[j].table.constraint.foreignkeys[iDB].foreignkey.toColumn).trim().toUpperCase() ||
                                        String(fileYaml.table.constraint.foreignkeys[z].foreignkey.updateRole).trim().toUpperCase() !== String(dbYaml[j].table.constraint.foreignkeys[iDB].foreignkey.updateRole).trim().toUpperCase() ||
                                        String(fileYaml.table.constraint.foreignkeys[z].foreignkey.deleteRole).trim().toUpperCase() !== String(dbYaml[j].table.constraint.foreignkeys[iDB].foreignkey.deleteRole).trim().toUpperCase()) {

                                        tableScript.push('ALTER TABLE ' + globalFunction.quotedString(tableName) + ' DROP CONSTRAINT ' + globalFunction.quotedString(fileYaml.table.constraint.foreignkeys[z].foreignkey.name) + ';');
                                        tableScript = tableScript.concat(foreignkeysToSql(globalFunction.quotedString(tableName), Array(fileYaml.table.constraint.foreignkeys[z])));
                                    }
                                }
                            }
                        }
                    }
                    if (tableScript.length > 0)
                        await this.applyChange(GlobalTypes.ArrayobjectType[2], tableName, tableScript);
                }
            }

        } catch (err) {
            throw new Error('Error aplicando tabla ' + tableName + '. ' + err.message);
        }

    }

    newTableYamltoString(aYaml: any): Array<string> {
        let aTable: string = '';
        let aText: string = '';
        let aRet: Array<string> = [];
        let aNameTable: string = globalFunction.quotedString(aYaml.name);


        aTable = 'CREATE TABLE ' + aNameTable + ' (' + GlobalTypes.CR;
        for (let j = 0; j < aYaml.columns.length - 1; j++) {
            aTable += GlobalTypes.TAB + fieldToSql(aYaml.columns[j].column) + ',' + GlobalTypes.CR;
        }

        aTable += GlobalTypes.TAB + fieldToSql(aYaml.columns[aYaml.columns.length - 1].column) + ');' + GlobalTypes.CR;

        aRet.push(aTable);

        if ('constraint' in aYaml) {
            if ('checks' in aYaml.constraint) {
                aRet = aRet.concat(checkToSql(aNameTable, aYaml.constraint.checks));
            }
            if ('primaryKey' in aYaml.constraint) {
                aRet = aRet.concat(primaryKeyToSql(aNameTable, aYaml.constraint.primaryKey));
            }
        }

        if ('indexes' in aYaml) {
            aRet = aRet.concat(indexesToSql(aNameTable, aYaml.indexes));
        }

        if ('description' in aYaml) {
            aTable = "COMMENT ON TABLE " + aNameTable + " IS '" + aYaml.description + "';" + GlobalTypes.CR;
            aRet.push(aTable);
        }

        for (let j = 0; j < aYaml.columns.length; j++) {
            if ('description' in aYaml.columns[j].column && aYaml.columns[j].column.description !== '') {
                aTable = "COMMENT ON COLUMN " + aNameTable + "." + globalFunction.quotedString(aYaml.columns[j].column.name) + " IS '" + aYaml.columns[j].column.description + "';" + GlobalTypes.CR;
                aRet.push(aTable);
            }
        }
        return aRet;
    }

    getTableColumnDiferences(aTableName: string, aFileColumnsYaml: Array<any>, aDbColumnsYaml: Array<any>): Array<string> {
        let i: number = 0;
        let retText: string = '';
        let retArray: Array<string> = [];
        let retCmd: string = '';
        let retAux: string = '';

        aTableName = globalFunction.quotedString(aTableName);

        for (let j = 0; j < aFileColumnsYaml.length; j++) {
            if (globalFunction.includeObject(this.excludeObject, 'fields', aFileColumnsYaml[j].column.name)) {
                i = aDbColumnsYaml.findIndex(aItem => (aItem.column.name.toLowerCase().trim() === aFileColumnsYaml[j].column.name.toLowerCase().trim()));

                if (i === -1) { //no existe campo
                    retArray.push('ALTER TABLE ' + aTableName + ' ADD ' + fieldToSql(aFileColumnsYaml[j].column) + ';');
                }
                else { //existe campo 
                    if (!("computed" in aFileColumnsYaml[j].column)) {
                        if (aFileColumnsYaml[j].column.type.toUpperCase() !== aDbColumnsYaml[i].column.type.toUpperCase()) {
                            retArray.push('ALTER TABLE ' + aTableName + ' ALTER COLUMN ' + globalFunction.quotedString(aFileColumnsYaml[j].column.name) + ' TYPE ' + aFileColumnsYaml[j].column.type + ';');
                        }
                    }
                    if (aFileColumnsYaml[j].column.default !== aDbColumnsYaml[i].column.default) { //no valido por upper o lower ya que el valor por defecto de un campo puede ser mayuscula o minuscula
                        if (aFileColumnsYaml[j].column.default !== '')
                            retArray.push('ALTER TABLE ' + aTableName + ' ALTER COLUMN ' + globalFunction.quotedString(aFileColumnsYaml[j].column.name) + ' SET DEFAULT ' + aFileColumnsYaml[j].column.default + ';');
                        else
                            retArray.push('ALTER TABLE ' + aTableName + ' ALTER COLUMN ' + globalFunction.quotedString(aFileColumnsYaml[j].column.name) + ' DROP DEFAULT;');
                    }
                    if (aFileColumnsYaml[j].column.nullable !== aDbColumnsYaml[i].column.nullable) {
                        retAux = 'ALTER TABLE ' + aTableName + ' ALTER COLUMN ' + globalFunction.quotedString(aFileColumnsYaml[j].column.name);
                        retCmd = '';

                        if (aFileColumnsYaml[j].column.nullable === false && aDbColumnsYaml[i].column.nullable === true) {
                            if (!('nullableToNotNullValue' in aFileColumnsYaml[j].column))
                                throw new Error('Si cambia de null a not null complete la opcion "nullableToNotNullValue" para llenar el campo');

                            retCmd = 'UPDATE ' + aTableName + ' SET ' + globalFunction.quotedString(aFileColumnsYaml[j].column.name) + "='" + aFileColumnsYaml[j].column.nullableToNotNullValue + "' WHERE " + globalFunction.quotedString(aFileColumnsYaml[j].column.name) + ' IS NULL;';
                            retAux += ' SET NOT NULL'; //ver con que lo lleno al campo que seteo asi   
                        }
                        else if (aFileColumnsYaml[j].column.nullable === true && aDbColumnsYaml[i].column.nullable === false) {
                            retAux += ' DROP NOT NULL';
                        }
                        if (retCmd !== '')
                            retArray.push(retCmd);

                        retArray.push(retAux + ';');
                    }
                    if (String(aFileColumnsYaml[j].column.computed).toUpperCase().trim() !== String(aDbColumnsYaml[i].column.computed).toUpperCase().trim()) {
                        retArray.push('ALTER TABLE ' + aTableName + ' ALTER COLUMN ' + globalFunction.quotedString(aFileColumnsYaml[j].column.name) + ' COMPUTED BY ' + aFileColumnsYaml[j].column.computed + ';');
                    }
                    //present?: boolean
                    if (i !== j) { //difiere posicion del campo
                        retArray.push('ALTER TABLE ' + aTableName + ' ALTER COLUMN ' + globalFunction.quotedString(aFileColumnsYaml[j].column.name) + ' POSITION ' + (j + 1) + ';');
                    }
                }
            }
        }
        return retArray;
    }

    getTableConstraintDiferences(aTableName: string, aFileConstraintYaml: any, aDbConstraintYaml: any): Array<string> {
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
                    retArray = retArray.concat(checkToSql(aTableName, Array(aFileConstraintYaml.checks[j])));
                else { /* || or && and*/
                    if (String(aFileConstraintYaml.checks[j].expresion).trim().toUpperCase() !== String(aDbConstraintYaml.checks[iDB].expresion).trim().toUpperCase()) {
                        retArray.push('ALTER TABLE ' + aTableName + ' DROP CONSTRAINT ' + globalFunction.quotedString(aFileConstraintYaml[j].foreignkey.name) + ';');
                        retArray = retArray.concat(checkToSql(aTableName, Array(aFileConstraintYaml.foreignkeys[j])));
                    }
                }
            }
        }

        if ('primaryKey' in aFileConstraintYaml) {
            pkFY = primaryKeyToSql(aTableName, aFileConstraintYaml.primaryKey);
            pkDB = primaryKeyToSql(aTableName, aDbConstraintYaml.primaryKey);
            if (pkFY.trim().toUpperCase() !== pkDB.trim().toUpperCase()) {
                if (pkDB !== '')
                    retArray.push('ALTER TABLE ' + aTableName + ' DROP CONSTRAINT ' + globalFunction.quotedString(aDbConstraintYaml.primaryKey.name));

                retArray.push(pkFY);
            }
        }

        return retArray;
    }

    getTableIndexesDiferences(aTableName: string, aFileIdxYaml: any, aDbIdxYaml: any): Array<string> {
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
                idxYL = indexesToSql(aTableName, Array(aFileIdxYaml.indexes[j]))[0];
                if (iDB === -1)
                    retArray.push(idxYL);
                else {
                    idxDB = indexesToSql(aTableName, Array(aDbIdxYaml.indexes[iDB]))[0];
                    if (idxDB.trim().toUpperCase() !== idxYL.trim().toUpperCase()) {
                        retArray.push('DROP INDEX ' + globalFunction.quotedString(aFileIdxYaml.indexes[j].index.name) + ';');
                        retArray.push(idxYL);
                    }
                }
            }
        }
        return retArray;
    }

    getTableDescriptionDiferences(aTableName: string, aFileYaml: any, aDbYaml: any): Array<string> {
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

        aTableName = globalFunction.quotedString(aTableName);

        if (setDescription(aFileYaml, aDbYaml, 'TABLE ' + aTableName) !== '')
            retArray.push(setDescription(aFileYaml, aDbYaml, 'TABLE ' + aTableName));

        arrayAux = aDbYaml.columns;

        for (let j = 0; j < aFileYaml.columns.length; j++) {
            iDB = arrayAux.findIndex(aItem => (aItem.column.name === aFileYaml.columns[j].column.name));
            if (iDB !== -1 && setDescription(aFileYaml.columns[j].column, aDbYaml.columns[iDB].column, 'COLUMN ' + aTableName + '.' + globalFunction.quotedString(aFileYaml.columns[j].column.name)) !== '')
                retArray.push(setDescription(aFileYaml.columns[j].column, aDbYaml.columns[iDB].column, 'COLUMN ' + aTableName + '.' + globalFunction.quotedString(aFileYaml.columns[j].column.name)));
        }

        return retArray;
    }

    //****************************************************************** */
    //        D E C L A R A C I O N E S    P U B L I C A S
    //******************************************************************* */

    public async applyYalm(ahostName: string, aportNumber: number, adatabase: string, adbUser: string, adbPassword: string, objectType: string, objectName: string) {

        this.fb.database = adatabase;
        this.fb.dbPassword = adbPassword;
        this.fb.dbUser = adbUser;
        this.fb.hostName = ahostName;
        this.fb.portNumber = aportNumber;
        this.fbExMe.excludeObject = this.excludeObject;

        try {

            await this.fb.connect();
            if (this.saveToLog)
                await this.checkMetadataLog();

            try {
                this.sources.readSource(objectType, objectName);
                if (objectType === '' || objectType === GlobalTypes.ArrayobjectType[3])
                    await this.applyGenerators();
                if (objectType === '' || objectType === GlobalTypes.ArrayobjectType[2])
                    await this.applyTables();
                if (objectType === '' || objectType === GlobalTypes.ArrayobjectType[4])
                    await this.applyViews();
                if (objectType === '' || objectType === GlobalTypes.ArrayobjectType[0])
                    await this.applyProcedures();
                if (objectType === '' || objectType === GlobalTypes.ArrayobjectType[1])
                    await this.applyTriggers();


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


function fieldToSql(aField: any) {
    let retFld: string = '';

    retFld = globalFunction.quotedString(aField.name) + ' ';
    if ('computed' in aField) {
        retFld += ' COMPUTED BY ' + aField.computed;
    }
    else {
        retFld += GlobalTypes.convertDataTypeToFB(aField.type);
        if ('default' in aField) {
            if (!String(aField.default).toUpperCase().startsWith('DEFAULT'))
                retFld += ' DEFAULT ' + aField.default;
            else
                retFld += ' ' + aField.default;
        }
        if ('charset' in aField) {
            retFld += ' CHARACTER SET ' + aField.charset;
        }
        if (aField.nullable === false) {
            retFld += ' NOT NULL';
        }
    }
    return retFld;
}

function foreignkeysToSql(aTableName: string, aForeinKey: any): Array<string> {
    //name,onColumn,toTable,toColumn,updateRole,deleteRole
    //ALTER TABLE ART_ARCH ADD CONSTRAINT FK_ART_ARCH_CUECOM FOREIGN KEY (FCUECOM) REFERENCES CON_CUEN (FCUENTA) ON UPDATE CASCADE;
    let aRet: Array<string> = [];
    let aText: string = '';

    for (let j = 0; j < aForeinKey.length; j++) {
        aText = 'ALTER TABLE ' + aTableName + ' ADD CONSTRAINT ' + globalFunction.quotedString(aForeinKey[j].foreignkey.name) + ' FOREIGN KEY (' + globalFunction.quotedString(aForeinKey[j].foreignkey.onColumn) + ') REFERENCES ' + globalFunction.quotedString(aForeinKey[j].foreignkey.toTable) + ' (' + globalFunction.quotedString(aForeinKey[j].foreignkey.toColumn) + ')';
        if ('updateRole' in aForeinKey[j].foreignkey) {
            aText += ' ON UPDATE ' + aForeinKey[j].foreignkey.updateRole;
        }
        if ('deleteRole' in aForeinKey[j].foreignkey) {
            aText += ' ON DELETE ' + aForeinKey[j].foreignkey.deleteRole;
        }
        aRet.push(aText + ';');
    }
    return aRet;
}

function checkToSql(aTableName: string, aCheck: any): Array<string> {
    //name, expresion
    //ALTER TABLE ART_ARCH ADD CONSTRAINT ART_ARCH_UXD CHECK (FUXD>0);
    let aRet: Array<string> = [];
    let aText: string = '';
    for (let j = 0; j < aCheck.length; j++) {
        aText = 'ALTER TABLE ' + aTableName + ' ADD CONSTRAINT ' + globalFunction.quotedString(aCheck[j].check.name);
        if (aCheck[j].check.expresion.trim().toUpperCase().startsWith('CHECK')) {
            aText += ' ' + aCheck[j].check.expresion.trim() + ';';
        }
        else {
            aText += ' CHECK ' + aCheck[j].check.expresion.trim() + ';';
        }
        aRet.push(aText);
    }
    return aRet;
}

function primaryKeyToSql(aTableName: string, aPk: any): string {
    //ALTER TABLE ART_ARCH ADD CONSTRAINT ART_ARCH_PK PRIMARY KEY (FCODINT);    
    let aText: string = '';
    if (aPk.name !== undefined && aPk.name !== '' && aPk.columns.length > 0) {
        aText += 'ALTER TABLE ' + aTableName + ' ADD CONSTRAINT ' + globalFunction.quotedString(aPk.name) + ' PRIMARY KEY (';
        for (let j = 0; j < aPk.columns.length - 1; j++) {
            aText += globalFunction.quotedString(aPk.columns[j]) + ',';
        }
        aText += globalFunction.quotedString(aPk.columns[aPk.columns.length - 1]) + ');';
    }
    return aText;
}

function indexesToSql(aTableName: string, aIdx: any): Array<string> {
    //active,computedBy,columns,name,unique,descending
    //CREATE UNIQUE INDEX ART_ARCH_CODIGO ON ART_ARCH (FCODIGO);
    //CREATE INDEX ART_ARCH_CODMAD ON ART_ARCH (FCODMAD);
    //CREATE INDEX ART_ARCH_IDX2 ON ART_ARCH COMPUTED BY (TRIM(FCODIGO))
    let aRet: Array<string> = [];
    let aText: string = '';
    for (let j = 0; j < aIdx.length; j++) {
        aText = '';
        if (aIdx[j].index.unique == true)
            aText = ' UNIQUE ';
        if (aIdx[j].index.descending == true)
            aText = ' DESCENDING ';
        if ('computedBy' in aIdx[j].index) {
            aText = 'CREATE ' + aText + ' INDEX ' + globalFunction.quotedString(aIdx[j].index.name) + ' ON ' + aTableName + ' COMPUTED BY ';
            if (String(aIdx[j].index.computedBy).startsWith('('))
                aText += aIdx[j].index.computedBy;
            else
                aText += '(' + aIdx[j].index.computedBy + ')';
        }
        else {
            aText = 'CREATE ' + aText + ' INDEX ' + globalFunction.quotedString(aIdx[j].index.name) + ' ON ' + aTableName + '(';
            for (let i = 0; i < aIdx[j].index.columns.length - 1; i++) {

                if (typeof aIdx[j].index.columns[i] === 'string') {
                    aText += globalFunction.quotedString(aIdx[j].index.columns[i]) + ',';
                }
                else {
                    aText += globalFunction.quotedString(aIdx[j].index.columns[i].name);
                }

            }
            if (typeof aIdx[j].index.columns[aIdx[j].index.columns.length - 1] === 'string') {
                aText += globalFunction.quotedString(aIdx[j].index.columns[aIdx[j].index.columns.length - 1]) + ')'
            }
            else {
                aText += globalFunction.quotedString(aIdx[j].index.columns[aIdx[j].index.columns.length - 1].name) + ')'
            }
        }
        aRet.push(aText + ';');
    }
    return aRet;
}            
