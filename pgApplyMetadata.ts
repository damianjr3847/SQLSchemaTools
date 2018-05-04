import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as GlobalTypes from './globalTypes';
import * as globalFunction from './globalFunction';
import * as sources from './loadsource';
import * as pg from 'pg';
import * as pgMetadataQuerys from './pgMetadataQuerys';
import * as pgExtractMetadata from './pgExtractMetadata';

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

    public schema: string = defaultSchema;
    public dbRole: string = '';

    constructor() {
        this.sources = new sources.tSource;
        this.pgExMe = new pgExtractMetadata.pgExtractMetadata;
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
    private async applyProcedures() {

    }

    //****************************************************************** */
    //        T R I G G E R S
    //******************************************************************* */

    private async applyTriggers() {

    }

    //****************************************************************** */
    //        V I E W S
    //******************************************************************* */
    private async applyViews() {

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

            this.pgDb.query('BEGIN');
            try {
                dbYaml = await this.pgExMe.extractMetadataGenerators('', true, false);

                if (dbYaml === undefined)
                    throw 'no se pudo extraer el metadata de la base';
            }
            finally {
                this.pgDb.query('COMMIT');
            }

            for (let i in this.sources.generatorsArrayYaml) {
                fileYaml = this.sources.generatorsArrayYaml[i];
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
        catch (err) {
            console.error('Error aplicando generador ' + genName + '. ', err.message);
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
                fileYaml = this.sources.tablesArrayYaml[i];

                tableName = fileYaml.table.name;
                if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[2], tableName)) {

                    j = dbYaml.findIndex(aItem => (aItem.table.name.toLowerCase() === tableName.toLowerCase()));
                    tableScript = [];

                    if (j === -1) { //NO EXISTE TABLA
                        tableScript = this.newTableYamltoString(fileYaml.table);
                    }
                    else {

                        tableScript = tableScript.concat(this.getTableColumnDiferences(tableName, fileYaml.table.columns, dbYaml[j].table.columns, this.schema));
                        tableScript = tableScript.concat(this.getTableConstraintDiferences(tableName, fileYaml.table.constraint, dbYaml[j].table.constraint, this.schema));
                        tableScript = tableScript.concat(this.getTableDescriptionDiferences(tableName, fileYaml.table, dbYaml[j].table, this.schema));
                        ver indices se cambio el formato de los campos que lo componen
                        tableScript = tableScript.concat(this.getTableIndexesDiferences(tableName, fileYaml.table, dbYaml[j].table, this.schema));
                    }

                    if (tableScript.length > 0)
                        await this.applyChange(GlobalTypes.ArrayobjectType[2], tableName, tableScript);
                }
            }

        } catch (err) {
            console.error('Error aplicando tabla ' + tableName + '.', err.message);
        }

    }

    newTableYamltoString(aYaml: any): Array<string> {
        let aTable: string = '';
        let aText: string = '';
        let aRet: Array<string> = [];

        aTable = 'CREATE TABLE ' + this.schema + '.' + globalFunction.quotedString(aYaml.name) + ' (' + GlobalTypes.CR;
        for (let j = 0; j < aYaml.columns.length - 1; j++) {
            aTable += GlobalTypes.TAB + fieldToSql(aYaml.columns[j].column) + ',' + GlobalTypes.CR;
        }

        aTable += GlobalTypes.TAB + fieldToSql(aYaml.columns[aYaml.columns.length - 1].column) + ');';

        aRet.push(aTable);

        aRet.push('ALTER TABLE ' + this.schema + '.' + globalFunction.quotedString(aYaml.name) + ' OWNER TO ' + this.dbRole + ';');

        if ('constraint' in aYaml) {
            if ('foreignkeys' in aYaml.constraint)
                aRet = aRet.concat(foreignkeysToSql(aYaml.name, aYaml.constraint.foreignkeys, this.schema));
            if ('checks' in aYaml.constraint)
                aRet = aRet.concat(checkToSql(aYaml.name, aYaml.constraint.checks, this.schema));
            if ('primaryKey' in aYaml.constraint)
                aRet.push(primaryKeyToSql(aYaml.name, aYaml.constraint.primaryKey, this.schema));
        }

        if ('indexes' in aYaml) {
            aRet = aRet.concat(indexesToSql(aYaml.name, aYaml.indexes, this.schema));
        }

        if ('description' in aYaml) {
            aTable = "COMMENT ON TABLE " + this.schema + '.' + aYaml.name + " IS '" + aYaml.description + "';";
            aRet.push(aTable);
        }

        for (let j = 0; j < aYaml.columns.length; j++) {
            if ('description' in aYaml.columns[j].column && aYaml.columns[j].column.description !== '') {
                aTable = "COMMENT ON COLUMN " + this.schema + '.' + aYaml.name + "." + aYaml.columns[j].column.name + " IS '" + aYaml.columns[j].column.description + "';";
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
                        if (aFileColumnsYaml[j].column.type.toUpperCase() !== aDbColumnsYaml[i].column.type.toUpperCase()) {
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


        if ('foreignkeys' in aFileConstraintYaml) {
            arrayAux = aDbConstraintYaml.foreignkeys;
            for (let j = 0; j < aFileConstraintYaml.foreignkeys.length; j++) {
                iDB = arrayAux.findIndex(aItem => (aItem.foreignkey.name.toLowerCase() === aFileConstraintYaml.foreignkeys[j].foreignkey.name.toLowerCase()));
                if (iDB === -1)
                    retArray = retArray.concat(foreignkeysToSql(aTableName, Array(aFileConstraintYaml.foreignkeys[j]), aSchema));
                else { /* || or && and*/
                    if (String(aFileConstraintYaml.foreignkeys[j].foreignkey.onColumn).trim().toUpperCase() !== String(aDbConstraintYaml.foreignkeys[iDB].foreignkey.onColumn).trim().toUpperCase() ||
                        String(aFileConstraintYaml.foreignkeys[j].foreignkey.toTable).trim().toUpperCase() !== String(aDbConstraintYaml.foreignkeys[iDB].foreignkey.toTable).trim().toUpperCase() ||
                        String(aFileConstraintYaml.foreignkeys[j].foreignkey.toColumn).trim().toUpperCase() !== String(aDbConstraintYaml.foreignkeys[iDB].foreignkey.toColumn).trim().toUpperCase() ||
                        String(aFileConstraintYaml.foreignkeys[j].foreignkey.updateRole).trim().toUpperCase() !== String(aDbConstraintYaml.foreignkeys[iDB].foreignkey.updateRole).trim().toUpperCase() ||
                        String(aFileConstraintYaml.foreignkeys[j].foreignkey.deleteRole).trim().toUpperCase() !== String(aDbConstraintYaml.foreignkeys[iDB].foreignkey.deleteRole).trim().toUpperCase()) {

                        retArray.push('ALTER TABLE ' + aSchema + '.' + aTableName + ' DROP CONSTRAINT ' + globalFunction.quotedString(aFileConstraintYaml.foreignkeys[j].foreignkey.name) + ';');
                        retArray = retArray.concat(foreignkeysToSql(aTableName, Array(aFileConstraintYaml.foreignkeys[j]), aSchema));
                    }
                }
            }
        }

        if ('checks' in aFileConstraintYaml) {
            arrayAux = aDbConstraintYaml.checks;
            for (let j = 0; j < aFileConstraintYaml.checks.length; j++) {
                iDB = arrayAux.findIndex(aItem => (aItem.check.name.toLowerCase() === aFileConstraintYaml.checks[j].check.name.toLowerCase()));
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
            arrayAux = aDbIdxYaml.indexes;
            for (let j = 0; j < aFileIdxYaml.indexes.length; j++) {
                iDB = arrayAux.findIndex(aItem => (aItem.index.name.toLowerCase() === aFileIdxYaml.indexes[j].index.name.toLowerCase()));
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
                this.sources.readSource(objectType, objectName);
                if (objectType === '' || objectType === GlobalTypes.ArrayobjectType[3])
                    await this.applyGenerators();
                if (objectType === '' || objectType === GlobalTypes.ArrayobjectType[2])
                    await this.applyTables();
                if (objectType === '' || objectType === GlobalTypes.ArrayobjectType[4])
                    await this.applyViews();
                if (objectType === '' || objectType === GlobalTypes.ArrayobjectType[1])
                    await this.applyTriggers();
                if (objectType === '' || objectType === GlobalTypes.ArrayobjectType[0])
                    await this.applyProcedures();

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
            aText += ' ON UPDATE ' + aForeinKey[j].foreignkey.updateRole + ';'
        }
        if ('deleteRole' in aForeinKey[j].foreignkey) {
            aText += ' ON DELETE ' + aForeinKey[j].foreignkey.deleteRole + ';'
        }
        aRet.push(aText);
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

    aTableName = globalFunction.quotedString(aTableName);

    if (aPk.name !== undefined && aPk.name !== '' && aPk.columns.length > 0) {
        aText += 'ALTER TABLE ' + aSchema + '.' + aTableName + ' ADD CONSTRAINT ' + globalFunction.quotedString(aPk.name) + ' PRIMARY KEY (';
        for (let j = 0; j < aPk.columns.length - 1; j++) {
            aText += aPk.columns[j] + ',';
        }
        aText += aPk.columns[aPk.columns.length - 1] + ');';
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

   

    for (let j = 0; j < aIdx.length; j++) {
        aText = '';
        if (aIdx[j].index.unique == true)
            aText = ' UNIQUE ';
        if (aIdx[j].index.descending == true)
            aText = ' DESCENDING ';
        if ('computedBy' in aIdx[j].index)
            aText = 'CREATE ' + aText + ' INDEX ' + globalFunction.quotedString(aIdx[j].index.name) + ' ON ' + aSchema + '.' + aTableName + ' COMPUTED BY (' + aIdx[j].index.computedBy + ')';
        else {
            aText = 'CREATE ' + aText + ' INDEX ' + globalFunction.quotedString(aIdx[j].index.name) + ' ON ' + aSchema + '.' + aTableName + '(';
            for (let i = 0; i < aIdx[j].index.columns.length - 1; i++) {
                aText += aIdx[j].index.columns[i] + ',';
            }
            aText += aIdx[j].index.columns[aIdx[j].index.columns.length - 1] + ')'
        }
        aRet.push(aText + ';');

        if ('description' in aIdx[j].index)
            aRet.push('COMMENT ON INDEX ' + aSchema + '.' + aTableName + " IS '" + aIdx[j].index.description + "';");
    }
    return aRet;
}            
