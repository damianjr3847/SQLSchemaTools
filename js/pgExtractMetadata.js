"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const yaml = require("js-yaml");
const GlobalTypes = require("./globalTypes");
const globalFunction = require("./globalFunction");
const sources = require("./loadsource");
const pg = require("pg");
const queryProcedure = `SELECT * 
     FROM ( SELECT TRIM(RDB$PROCEDURE_NAME) AS OBJECT_NAME,
                RDB$PROCEDURE_SOURCE AS SOURCE,
                RDB$DESCRIPTION AS DESCRIPTION
            FROM RDB$PROCEDURES PPA
            WHERE RDB$SYSTEM_FLAG=0
            ORDER BY RDB$PROCEDURE_NAME)
    {FILTER_OBJECT} `;
const queryProcedureParameters = `SELECT *
    FROM (SELECT 
            TRIM(PPA.RDB$PROCEDURE_NAME) AS OBJECT_NAME, 
            TRIM(PPA.RDB$PARAMETER_NAME) AS PARAMATER_NAME,
            FLD.RDB$FIELD_TYPE AS FTYPE, 
            FLD.RDB$FIELD_SUB_TYPE AS FSUB_TYPE,
            FLD.RDB$FIELD_LENGTH AS FLENGTH, 
            FLD.RDB$FIELD_PRECISION AS FPRECISION, 
            FLD.RDB$FIELD_SCALE AS FSCALE, 
            TRIM(COL.RDB$COLLATION_NAME) AS FCOLLATION_NAME,        /* COLLATE*/
            PPA.RDB$DEFAULT_SOURCE AS FSOURCE,        /* DEFAULT*/
            PPA.RDB$NULL_FLAG  AS FLAG,             /* NULLABLE*/
            FLD.RDB$DESCRIPTION AS DESCRIPTION, 
            PPA.RDB$PARAMETER_TYPE AS PARAMATER_TYPE         /* input / output*/
        FROM RDB$PROCEDURE_PARAMETERS PPA 
        LEFT OUTER JOIN RDB$FIELDS FLD ON FLD.RDB$FIELD_NAME = PPA.RDB$FIELD_SOURCE 
        LEFT OUTER JOIN RDB$COLLATIONS COL ON (PPA.RDB$COLLATION_ID = COL.RDB$COLLATION_ID AND FLD.RDB$CHARACTER_SET_ID = COL.RDB$CHARACTER_SET_ID)             
        ORDER BY PPA.RDB$PROCEDURE_NAME, PPA.RDB$PARAMETER_TYPE, PPA.RDB$PARAMETER_NUMBER)
    {FILTER_OBJECT} `;
exports.queryTablesView = `SELECT * 
    FROM (SELECT
        CONCAT(table_catalog, '.', table_schema)                    AS "parent",
        table_catalog                                               AS "catalog",
        table_schema                                                AS "schema",
        table_name                                                  AS "table",
        CONCAT(table_schema, '.', table_name)                       AS "fullname",
        CONCAT(table_catalog, '.', table_schema, '.', table_name)   AS "fullCatalogName",
        pg_catalog.obj_description(c.oid, 'pg_class')               AS "description",
        relkind                                                     AS "type"
        --r = ordinary table, i = index, S = sequence, v = view, m = materialized view, c = composite type, t = TOAST table, f = foreign table
    FROM information_schema.tables x
    INNER JOIN pg_catalog.pg_class c ON c.relname = table_name
    WHERE table_schema = 'public' {RELTYPE}
    ORDER BY table_catalog, table_schema, table_name) AS CC
    {FILTER_OBJECT}`;
exports.queryTablesViewFields = `SELECT * 
    FROM (SELECT
            CONCAT(table_catalog, '.', table_schema, '.', table_name)          AS "parent",
            table_catalog                                                      AS "catalog",
            table_schema                                                       AS "schema",
            table_name                                                         AS "table",
            column_name                                                        AS "columnName",
            CONCAT(table_schema, '.', table_name, '.', column_name)            AS "fullName",
            CONCAT(table_catalog, '.', table_schema, '.', table_name, '.', column_name) AS "fullCatalogName",
            column_default                                                     AS "defaultWithTypeCast",
            CASE WHEN column_default ILIKE 'nextval%' THEN TRUE ELSE FALSE END AS "isAutoIncrement",
            CAST(is_nullable AS BOOLEAN)                                       AS "allowNull",
            NOT CAST(is_nullable AS BOOLEAN)                                   AS "notNull",
            CASE WHEN udt_name = 'hstore' THEN udt_name
            ELSE LOWER(data_type) END                                          AS "type",
            t.typcategory                                                      AS "typeCategory", -- See http://www.postgresql.org/docs/current/static/catalog-pg-type.html
            CASE WHEN t.typcategory = 'E' THEN
                (SELECT Array_agg(e.enumlabel)
                FROM pg_catalog.pg_type t JOIN pg_catalog.pg_enum e ON t.oid = e.enumtypid
                WHERE t.typname = udt_name)
            ELSE NULL END                                                      AS "enumValues",
            CASE WHEN LOWER(data_type) = 'array' THEN information_schema._pg_char_max_length(arraytype.oid, a.atttypmod)
            ELSE character_maximum_length END                                  AS "length",
            CASE WHEN LOWER(data_type) = 'array' THEN COALESCE(
                information_schema._pg_datetime_precision(arraytype.oid, a.atttypmod),
                information_schema._pg_numeric_precision(arraytype.oid, a.atttypmod))
            WHEN datetime_precision IS NULL THEN numeric_precision
            ELSE datetime_precision END                                        AS "precision",
            CASE WHEN LOWER(data_type) = 'array' THEN information_schema._pg_numeric_scale(arraytype.oid, a.atttypmod)
            ELSE numeric_scale END                                             AS "scale",
            CASE WHEN LEFT(udt_name, 1) = '_' THEN LEFT(format_type(a.atttypid, NULL), -2)
            ELSE NULL END                                                      AS "arrayType",
            a.attndims                                                         AS "arrayDimension",
            domain_catalog                                                     AS "domainCatalog",
            domain_schema                                                      AS "domainSchema",
            domain_name                                                        AS "domainName",
            CASE WHEN domain_name IS NOT NULL THEN CONCAT(domain_schema, '.', domain_name)
            ELSE NULL END                                                      AS "domainFullName",
            CASE WHEN t.typcategory IN ('E', 'C') THEN format_type(a.atttypid, NULL)
            ELSE NULL END                                                      AS "userDefinedType",
            udt_name                                                           AS "udtName",      -- User Defined Types such as composite, enumerated etc.
            ordinal_position                                                   AS "position",
            pg_catalog.col_description(c.oid, columns.ordinal_position :: INT) AS "description"
        FROM information_schema.columns
            INNER JOIN pg_catalog.pg_attribute a ON a.attname = column_name
            INNER JOIN pg_catalog.pg_class c ON c.oid = a.attrelid AND c.relname = table_name
            LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace AND pg_catalog.pg_table_is_visible(c.oid)
            LEFT JOIN pg_catalog.pg_type arraytype ON arraytype.typname = RIGHT(udt_name, -1)
            INNER JOIN pg_type t ON a.atttypid = t.oid
        WHERE table_schema = 'public' {RELTYPE}    
        ORDER BY table_schema, table_name, ordinal_position) CC
    {FILTER_OBJECT}`;
/*
-- NOTE: I tried to avoid joins by using information_schema.columns views's content as CTE after adding below selections.
-- However performance of CTE seems much worse then view with joins. 550 ms vs 80 ms.

-- OID of array's elements' type. (NOT array type itself):
--COLAESCE(bt.typelem, t.typelem)

-- Array's elements' character length:
--information_schema._pg_char_max_length(COALESCE(bt.typelem, t.typelem), a.atttypmod) AS "array_character_maximum_length",

-- Array's elements' precision:
--COALESCE(
--    information_schema._pg_datetime_precision(COALESCE(bt.typelem, t.typelem), a.atttypmod),
--    information_schema._pg_numeric_precision(COALESCE(bt.typelem, t.typelem), a.atttypmod)
--) as "array_precision",

-- Array's elements' scale:
--information_schema._pg_numeric_scale(COALESCE(bt.typelem, t.typelem), a.atttypmod) AS "array_scale",

--Array's elements' type. LEFT(.., -2) removes [] from end of data type such as integer[].
--CASE WHEN RIGHT(format_type(a.atttypid, NULL), 2) = '[]' THEN LEFT(format_type(a.atttypid, NULL), -2) ELSE NULL END AS "array_data_type",

-- Array dimesnion:
--CASE WHEN a.attndims = 0 THEN NULL ELSE a.attndims END as "array_dimension",

-- Column description at position attnum:
--pg_catalog.col_description(c.oid, a.attnum::information_schema.cardinal_number) AS "description",

-- Enum values
--(SELECT Array_agg(e.enumlabel) FROM pg_catalog.pg_enum e WHERE t.oid = e.enumtypid) AS "enum_values",
*/
const queryTablesIndexes = `SELECT * 
    FROM (SELECT
                current_database()                                                          AS "catalog",
                ns.nspname                                                                  AS "schema",
                CONCAT(ns.nspname, '.', i.relname) 				                            AS "fullName",
                CONCAT(current_database(), '.', ns.nspname, '.', i.relname) 				AS "fullCatalogName",
                CONCAT(current_database(), '.', ns.nspname, '.', t.relname) 				AS "tableFullCatalogName",
                current_database() 															AS "tableCatalog",
                ns.nspname 																	AS "tableSchema",
                t.relname 																	AS "tableName",
                i.relname 																	AS "name",
                ix.indisunique 																AS "isUnique",
                ix.indisprimary																AS "isPrimaryKey",	
	            pg_get_expr(ix.indexprs, t.oid, true)                                       AS "expresion" 	
            FROM pg_index ix
            INNER JOIN pg_class t ON (t.oid = ix.indrelid AND t.relkind = 'r')	-- Tables only from pg_class, r: ordinary table
            INNER JOIN pg_class i ON (i.oid = ix.indexrelid AND i.relkind = 'i')	-- Indexes only from pg_class, i: indexes
            INNER JOIN pg_namespace ns ON (ns.oid = t.relnamespace)
            WHERE ns.nspname = 'public' 
            ORDER BY t.relname,i.relname) CC
    {FILTER_OBJECT}`;
const queryTableIndexesField = `SELECT * 
    FROM (SELECT
                CONCAT(current_database(), '.', ns.nspname, '.', t.relname, '.', a.attname) AS "columnFullCatalogName",
                CONCAT(current_database(), '.', ns.nspname, '.', i.relname) 				AS "indexFullCatalogName",
                CONCAT(current_database(), '.', ns.nspname, '.', t.relname) 				AS "tableFullCatalogName",
                current_database() 															AS "tableCatalog",
                ns.nspname 																	AS "tableSchema",
                t.relname 																	AS "tableName",
                a.attname 																	AS "columnName",
                i.relname 																	AS "indexName",
                ix.indisunique 																AS "isUnique",
                ix.indisprimary																AS "isPrimaryKey",
                ix.indoption[(SELECT MIN(CASE WHEN ix.indkey[i] = a.attnum THEN i ELSE NULL END)::int
                    FROM generate_series(ARRAY_LOWER(ix.indkey, 1), ARRAY_UPPER(ix.indkey, 1)) i)] as "option",
                (SELECT MIN(CASE WHEN ix.indkey[i] = a.attnum THEN i ELSE NULL END)::int
                    FROM generate_series(ARRAY_LOWER(ix.indkey, 1), ARRAY_UPPER(ix.indkey, 1)) i) AS "position"
            
            FROM pg_index ix
            INNER JOIN pg_class t ON (t.oid = ix.indrelid AND t.relkind = 'r')	-- Tables only from pg_class, r: ordinary table
            INNER JOIN pg_class i ON (i.oid = ix.indexrelid AND i.relkind = 'i')	-- Indexes only from pg_class, i: indexes
            INNER JOIN pg_attribute a ON (a.attrelid = t.oid AND a.attnum = ANY(ix.indkey))
            INNER JOIN pg_namespace ns ON (ns.oid = t.relnamespace)
            WHERE ns.nspname = 'public'
            ORDER BY t.relname,i.relname, 11) CC
    {FILTER_OBJECT}`;
const queryTableCheckConstraint = `SELECT *
    FROM (SELECT REL.RDB$RELATION_NAME AS OBJECT_NAME, CON.RDB$CONSTRAINT_NAME AS CONST_NAME, CON.RDB$CONSTRAINT_TYPE AS CONST_TYPE, 
                 CON.RDB$INDEX_NAME AS INDEXNAME, 
                 IDX.RDB$INDEX_TYPE AS INDEXTYPE,
                 RLC.RDB$RELATION_NAME AS REF_TABLE,
                 RLC.RDB$INDEX_NAME AS REF_INDEX,
                 REF.RDB$UPDATE_RULE AS REF_UPDATE,
                 REF.RDB$DELETE_RULE AS REF_DELETE,
                 IDX.RDB$DESCRIPTION AS DESCRIPTION,
                 (SELECT RTR.RDB$TRIGGER_SOURCE
                  FROM RDB$CHECK_CONSTRAINTS RCH
                  INNER JOIN RDB$TRIGGERS RTR ON RTR.RDB$TRIGGER_NAME=RCH.RDB$TRIGGER_NAME AND RTR.RDB$TRIGGER_TYPE=1
                  WHERE RCH.RDB$CONSTRAINT_NAME=CON.RDB$CONSTRAINT_NAME) AS CHECK_SOURCE
        FROM RDB$RELATIONS REL
        LEFT OUTER JOIN RDB$RELATION_CONSTRAINTS CON ON CON.RDB$RELATION_NAME=REL.RDB$RELATION_NAME
        LEFT OUTER JOIN RDB$INDICES IDX ON IDX.RDB$INDEX_NAME=CON.RDB$INDEX_NAME
        LEFT OUTER JOIN RDB$REF_CONSTRAINTS REF ON REF.RDB$CONSTRAINT_NAME=CON.RDB$CONSTRAINT_NAME
        LEFT OUTER JOIN RDB$RELATION_CONSTRAINTS RLC ON RLC.RDB$CONSTRAINT_NAME=REF.RDB$CONST_NAME_UQ
        WHERE REL.RDB$SYSTEM_FLAG=0 AND CON.RDB$CONSTRAINT_TYPE IN ('CHECK','FOREIGN KEY','PRIMARY KEY')
        ORDER BY CON.RDB$RELATION_NAME, CON.RDB$CONSTRAINT_TYPE, CON.RDB$CONSTRAINT_NAME)
     {FILTER_OBJECT} `;
const queryGenerator = `SELECT *
     FROM (SELECT RDB$GENERATOR_NAME AS OBJECT_NAME, RDB$DESCRIPTION AS DESCRIPTION
          FROM RDB$GENERATORS 
          WHERE RDB$SYSTEM_FLAG = 0 
          ORDER BY RDB$GENERATOR_NAME)
     {FILTER_OBJECT}`;
const queryTrigger = `SELECT *
    FROM (SELECT  TRG.RDB$TRIGGER_NAME AS OBJECT_NAME, TRG.RDB$RELATION_NAME AS TABLENAME, TRG.RDB$TRIGGER_SOURCE AS SOURCE, 
                  TRG.RDB$TRIGGER_SEQUENCE AS SEQUENCE,
                  TRG.RDB$TRIGGER_TYPE AS TTYPE, TRG.RDB$TRIGGER_INACTIVE AS INACTIVE, TRG.RDB$DESCRIPTION AS DESCRIPTION
          FROM RDB$TRIGGERS TRG
          LEFT OUTER JOIN RDB$CHECK_CONSTRAINTS CON ON (CON.RDB$TRIGGER_NAME = TRG.RDB$TRIGGER_NAME)
          WHERE ((TRG.RDB$SYSTEM_FLAG = 0) OR (TRG.RDB$SYSTEM_FLAG IS NULL)) AND (CON.RDB$TRIGGER_NAME IS NULL)
          ORDER BY TRG.RDB$TRIGGER_NAME)
    {FILTER_OBJECT}`;
;
class pgExtractMetadata {
    constructor() {
        //****************************************************************** */
        //        D E C L A R A C I O N E S    P R I V A D A S
        //******************************************************************* */
        this.connectionString = {};
        //****************************************************************** */
        //        D E C L A R A C I O N E S    P U B L I C A S
        //******************************************************************* */
        this.filesPath = '';
        this.excludeFrom = false;
        this.nofolders = false;
        this.sources = new sources.tSource;
    }
    saveToFile(aYalm, aObjectType, aObjectName) {
        if (this.nofolders) {
            fs.writeFileSync(this.filesPath + '/' + aObjectType + '_' + aObjectName + '.yaml', yaml.safeDump(aYalm, GlobalTypes.yamlExportOptions), GlobalTypes.yamlFileSaveOptions);
        }
        else {
            if (!fs.existsSync(this.filesPath + aObjectType + '/')) {
                fs.mkdirSync(this.filesPath + aObjectType);
            }
            fs.writeFileSync(this.filesPath + aObjectType + '/' + aObjectName + '.yaml', yaml.safeDump(aYalm, GlobalTypes.yamlExportOptions), GlobalTypes.yamlFileSaveOptions);
        }
    }
    analyzeQuery(aQuery, aObjectName, aObjectType) {
        let aRet = aQuery;
        let namesArray = [];
        let aux = '';
        if (aObjectName !== '')
            aRet = aRet.replace('{FILTER_OBJECT}', "WHERE UPPER(TRIM(OBJECT_NAME)) = '" + aObjectName.toUpperCase() + "'");
        else {
            if (this.excludeFrom) {
                if (!this.sources.loadYaml)
                    this.sources.readSource('', '');
                switch (aObjectType) {
                    case GlobalTypes.ArrayobjectType[2]:
                        for (let i in this.sources.tablesArrayYaml)
                            namesArray.push("'" + this.sources.tablesArrayYaml[i].table.name + "'");
                        break;
                    case GlobalTypes.ArrayobjectType[0]:
                        for (let i in this.sources.proceduresArrayYaml)
                            namesArray.push("'" + this.sources.proceduresArrayYaml[i].procedure.name + "'");
                        break;
                    case GlobalTypes.ArrayobjectType[1]:
                        for (let i in this.sources.triggersArrayYaml)
                            namesArray.push("'" + this.sources.triggersArrayYaml[i].triggerFunction.name + "'");
                        break;
                    case GlobalTypes.ArrayobjectType[4]:
                        for (let i in this.sources.viewsArrayYaml)
                            namesArray.push("'" + this.sources.viewsArrayYaml[i].view.name + "'");
                        break;
                    case GlobalTypes.ArrayobjectType[3]:
                        for (let i in this.sources.generatorsArrayYaml)
                            namesArray.push("'" + this.sources.generatorsArrayYaml[i].generator.name + "'");
                        break;
                }
                if (namesArray.length > 0) {
                    aux = globalFunction.arrayToString(namesArray, ',');
                    aRet = aRet.replace('{FILTER_OBJECT}', function (x) { return 'WHERE TRIM(CC.OBJECT_NAME) NOT IN (' + aux + ')'; });
                    //                    console.log(aux);
                    //aRet= aRet.replace('{FILTER_OBJECT}', 'WHERE UPPER(TRIM(OBJECT_NAME)) NOT IN (' + aux+')');                                    
                }
                else
                    aRet = aRet.replace('{FILTER_OBJECT}', '');
            }
            else
                aRet = aRet.replace('{FILTER_OBJECT}', '');
        }
        //r = ordinary table, i = index, S = sequence, v = view, m = materialized view, c = composite type, t = TOAST table, f = foreign table
        if (aObjectType === GlobalTypes.ArrayobjectType[2])
            aRet = aRet.replace('{RELTYPE}', " AND relkind IN ('r','t','f') ");
        else if (aObjectType === GlobalTypes.ArrayobjectType[4])
            aRet = aRet.replace('{RELTYPE}', " AND relkind IN ('v','m'");
        return aRet;
    }
    async extractMetadataProcedures(objectName, aRetYaml = false, openTr = true) {
        /* let rProcedures: Array<any>;
         let rParamater: Array<any>;
 
         let outReturnYaml: Array<any> = [];
 
         let outProcedure: GlobalTypes.iProcedureYamlType = GlobalTypes.emptyProcedureYamlType();
         let outProcedureParameterInput: GlobalTypes.iProcedureParameter[] = [];
         let outProcedureParameterOutput: GlobalTypes.iProcedureParameter[] = [];
         let j: number = 0;
         let body: string = '';
         let procedureName: string = '';
         let ft: iFieldType = {};
 
         try {
 
             if (openTr) {
                 await this.fb.startTransaction(true);
             }
 
             rProcedures = await this.fb.query(this.analyzeQuery(queryProcedure, objectName, GlobalTypes.ArrayobjectType[0]), []);
             rParamater = await this.fb.query(this.analyzeQuery(queryProcedureParameters, objectName, GlobalTypes.ArrayobjectType[0]), []);
 
             for (let i = 0; i < rProcedures.length; i++) {
 
                 procedureName = rProcedures[i].OBJECT_NAME;
                 if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[0], procedureName)) {
 
                     outProcedure.procedure.name = procedureName;
 
                     j= rParamater.findIndex(aItem => (aItem.OBJECT_NAME.trim() === rProcedures[i].OBJECT_NAME.trim()));
                     if (j !== -1) {
                         while ((j < rParamater.length) && (rParamater[j].OBJECT_NAME === rProcedures[i].OBJECT_NAME)) {
                             ft.AName = rParamater[j].PARAMATER_NAME;
                             ft.AType = rParamater[j].FTYPE;
                             ft.ASubType = rParamater[j].FSUB_TYPE;
                             ft.ALength = rParamater[j].FLENGTH;
                             ft.APrecision = rParamater[j].FPRECISION;
                             ft.AScale = rParamater[j].FSCALE;
                             ft.ACharSet = null;
                             ft.ACollate = rParamater[j].FCOLLATION_NAME;
                             if (rParamater[j].FSOURCE !== null) // al ser blob si es nulo no devuelve una funcion si no null
                                 ft.ADefault = await fbClass.getBlob(rParamater[j].FSOURCE);
                             else
                                 ft.ADefault = rParamater[j].FSOURCE;
                             ft.ANotNull = rParamater[j].FLAG
                             ft.AComputed = null;
 
                             if (rParamater[j].PARAMATER_TYPE == 0) {
                                 outProcedureParameterInput.push({ param: { name: "", type: "" } });
                                 outProcedureParameterInput[outProcedureParameterInput.length - 1].param.name = rParamater[j].PARAMATER_NAME;
                                 outProcedureParameterInput[outProcedureParameterInput.length - 1].param.type = FieldType(ft);
                             }
                             else if (rParamater[j].PARAMATER_TYPE == 1) {
                                 outProcedureParameterOutput.push({ param: { name: "", type: "" } });
                                 outProcedureParameterOutput[outProcedureParameterOutput.length - 1].param.name = rParamater[j].PARAMATER_NAME;
                                 outProcedureParameterOutput[outProcedureParameterOutput.length - 1].param.type = FieldType(ft);
                             }
                             j++;
                         }
                     }
 
                     body = await fbClass.getBlob(rProcedures[i].SOURCE);
 
                     outProcedure.procedure.body = body.replace(/\r/g, '');;
 
                     if (outProcedureParameterInput.length > 0)
                         outProcedure.procedure.inputs = outProcedureParameterInput;
 
                     if (outProcedureParameterOutput.length > 0)
                         outProcedure.procedure.outputs = outProcedureParameterOutput;
 
                     if (aRetYaml) {
                         outReturnYaml.push(outProcedure);
                     }
                     else {
                         this.saveToFile(outProcedure,GlobalTypes.ArrayobjectType[0],outProcedure.procedure.name);
                         console.log(('generado procedimiento ' + outProcedure.procedure.name + '.yaml').padEnd(70, '.') + 'OK');
                     }
 
                     outProcedure = GlobalTypes.emptyProcedureYamlType();
                     outProcedureParameterInput = [];
                     outProcedureParameterOutput = [];
                 }
             }
             if (openTr) {
                 await this.fb.commit();
             }
             if (aRetYaml) {
                 return outReturnYaml;
             }
         }
         catch (err) {
             throw new Error('Error generando procedimiento ' + procedureName + '. ' + err.message);
         }*/
    }
    async extractMetadataTables(objectName, aRetYaml = false, openTr = true) {
        let rTables;
        let rFields;
        let rIndexes;
        let rIndexesFld;
        let rCheckConst;
        let rQuery;
        let outTables = GlobalTypes.emptyTablesYamlType();
        let outFields = [];
        let outFK = [];
        let outCheck = [];
        let outIndexes = [];
        let outforeignk = [];
        let outcheck = [];
        let outReturnYaml = [];
        let j_fld = 0;
        let j_idx = 0;
        let j_idx_fld = 0;
        let j_const = 0;
        let j_fkf = 0;
        let tableName = '';
        let txtAux = '';
        let aOrden = '';
        let ft = {}; // {AName:null, AType:null, ASubType:null, ALength:null, APrecision:null, AScale:null, ACharSet: null, ACollate:null, ADefault:null, ANotNull:null, AComputed:null};   
        try {
            if (openTr) {
                await this.pgDb.query('BEGIN');
            }
            rQuery = await this.pgDb.query(this.analyzeQuery(exports.queryTablesView, objectName, GlobalTypes.ArrayobjectType[2]), []);
            rTables = rQuery.rows;
            rQuery = await this.pgDb.query(this.analyzeQuery(exports.queryTablesViewFields, objectName, GlobalTypes.ArrayobjectType[2]), []);
            rFields = rQuery.rows;
            rQuery = await this.pgDb.query(this.analyzeQuery(queryTablesIndexes, objectName, GlobalTypes.ArrayobjectType[2]), []);
            rIndexes = rQuery.rows;
            rQuery = await this.pgDb.query(this.analyzeQuery(queryTableIndexesField, objectName, GlobalTypes.ArrayobjectType[2]), []);
            rIndexesFld = rQuery.rows;
            //rCheckConst = await this.pgDbfb.query(this.analyzeQuery(queryTableCheckConstraint, objectName, GlobalTypes.ArrayobjectType[2]), []);
            for (let i = 0; i < rTables.length; i++) {
                tableName = rTables[i].table.trim();
                if (tableName === 'aaaa')
                    tableName = tableName;
                if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[2], tableName)) {
                    outTables.table.name = tableName;
                    if (rTables[i].description !== null)
                        outTables.table.description = rTables[i].description;
                    //fields
                    j_fld = rFields.findIndex(aItem => (aItem.table.trim() === rTables[i].table.trim()));
                    if (j_fld !== -1) {
                        while ((j_fld < rFields.length) && (rFields[j_fld].table.trim() == tableName)) {
                            if (globalFunction.includeObject(this.excludeObject, 'fields', rFields[j_fld].columnName.trim())) {
                                outFields.push(GlobalTypes.emptyTablesFieldYamlType());
                                outFields[outFields.length - 1].column.name = rFields[j_fld].columnName.trim();
                                outFields[outFields.length - 1].column.nullable = rFields[j_fld].allowNull;
                                ft.AType = rFields[j_fld].type;
                                ft.ALength = rFields[j_fld].length;
                                ft.APrecision = rFields[j_fld].precision;
                                ft.AScale = rFields[j_fld].scale;
                                if (rFields[j_fld].description !== null)
                                    outFields[outFields.length - 1].column.description = rFields[j_fld].description;
                                if (rFields[j_fld].defaultWithTypeCast !== null)
                                    outFields[outFields.length - 1].column.default = rFields[j_fld].defaultWithTypeCast;
                                outFields[outFields.length - 1].column.type = FieldType(ft);
                            }
                            j_fld++;
                        }
                    }
                    //indices
                    j_idx = rIndexes.findIndex(aItem => (aItem.tableName.trim() === tableName));
                    if (j_idx !== -1) {
                        //"catalog","schema","fullName","fullCatalogName","tableFullCatalogName","tableCatalog",
                        //"tableSchema","tableName","name","isUnique","isPrimaryKey"
                        while ((j_idx < rIndexes.length) && (rIndexes[j_idx].tableName.trim() == tableName)) {
                            if (rIndexes[j_idx].isPrimaryKey) {
                                outTables.table.constraint.primaryKey.name = rIndexes[j_idx].name.trim();
                            }
                            else {
                                outIndexes.push(GlobalTypes.emptyTablesIndexesType());
                                outIndexes[outIndexes.length - 1].index.name = rIndexes[j_idx].name.trim();
                                if (rIndexes[j_idx].expresion !== null)
                                    outIndexes[outIndexes.length - 1].index.computedBy = rIndexes[j_idx].expresion;
                                outIndexes[outIndexes.length - 1].index.unique = rIndexes[j_idx].isUnique;
                            }
                            j_idx_fld = rIndexesFld.findIndex(aItem => (aItem.tableName.trim() == rIndexes[j_idx].tableName.trim()) && (aItem.indexName.trim() == rIndexes[j_idx].name.trim()));
                            if (j_idx_fld > -1) {
                                // "columnFullCatalogName","indexFullCatalogName","tableFullCatalogName","tableCatalog",
                                // "tableSchema","tableName","columnName","indexName","isUnique","isPrimaryKey","position"
                                while ((j_idx_fld < rIndexesFld.length) && (rIndexesFld[j_idx_fld].tableName.trim() == rIndexes[j_idx].tableName.trim()) && (rIndexesFld[j_idx_fld].indexName.trim() == rIndexes[j_idx].name.trim())) {
                                    if (rIndexes[j_idx].isPrimaryKey)
                                        outTables.table.constraint.primaryKey.columns.push(rIndexesFld[j_idx_fld].columnName.trim());
                                    else {
                                        /*if (rIndexesFld[j_idx_fld].option === 0)  //0 =  ningun ordenamiento
                                            outIndexes[outIndexes.length - 1].index.orderColumns.push('ASC');
                                        else if (rIndexesFld[j_idx_fld].option === 1) //desending
                                            outIndexes[outIndexes.length - 1].index.orderColumns.push('DESC');
                                        else if (rIndexesFld[j_idx_fld].option === 2) //null last
                                            outIndexes[outIndexes.length - 1].index.orderColumns.push('NULL LAST');
                                        else if (rIndexesFld[j_idx_fld].option === 3) //desending con null last
                                            outIndexes[outIndexes.length - 1].index.orderColumns.push('DESC NULL LAST');*/
                                        if (rIndexesFld[j_idx_fld].option === 0)
                                            aOrden = 'ASC';
                                        else if (rIndexesFld[j_idx_fld].option === 1)
                                            aOrden = 'DESC';
                                        else if (rIndexesFld[j_idx_fld].option === 2)
                                            aOrden = 'NULL LAST';
                                        else if (rIndexesFld[j_idx_fld].option === 3)
                                            aOrden = 'DESC NULL LAST';
                                        outIndexes[outIndexes.length - 1].index.columns.push({ name: rIndexesFld[j_idx_fld].columnName.trim(), order: aOrden });
                                    }
                                    j_idx_fld++;
                                }
                            }
                            j_idx++;
                        }
                    }
                    // TABLENAME,CONST_NAME,CONST_TYPE, INDEXNAME, INDEXTYPE, REF_TABLE, REF_INDEX, REF_UPDATE, 
                    //   REF_DELETE, DESCRIPTION, CHECK_SOURCE
                    /*
                    j_const= rCheckConst.findIndex(aItem => (aItem.OBJECT_NAME.trim() === rTables[i].OBJECT_NAME.trim()));
                    if (j_const !== -1) {
                        while ((j_const < rCheckConst.length) && (rCheckConst[j_const].OBJECT_NAME.trim() == rTables[i].OBJECT_NAME.trim())) {
                            if (rCheckConst[j_const].CONST_TYPE.toString().trim().toUpperCase() === 'CHECK') {
                                outcheck.push({ check: { name: '', expresion: '' } });

                                outcheck[outcheck.length - 1].check.name = rCheckConst[j_const].CONST_NAME.trim();
                                outcheck[outcheck.length - 1].check.expresion = await fbClass.getBlob(rCheckConst[j_const].CHECK_SOURCE);
                            }
                            else if (rCheckConst[j_const].CONST_TYPE.toString().trim().toUpperCase() === 'FOREIGN KEY') {
                                outforeignk.push({ foreignkey: { name: '' } });
                                outforeignk[outforeignk.length - 1].foreignkey.name = rCheckConst[j_const].CONST_NAME.trim();

                                //busco el campo del indice de la FK en la tabla origen
                                j_fkf = rIndexesFld.findIndex(aItem => (aItem.OBJECT_NAME.trim() == rCheckConst[j_const].OBJECT_NAME.trim()) && (aItem.INDEXNAME.trim() == rCheckConst[j_const].INDEXNAME.trim()));
                                if (j_fkf > -1) {
                                    outforeignk[outforeignk.length - 1].foreignkey.onColumn = rIndexesFld[j_fkf].FLDNAME.trim();
                                }

                                outforeignk[outforeignk.length - 1].foreignkey.toTable = rCheckConst[j_const].REF_TABLE.trim();

                                //busco el campo del indice de la FK en la tabla destino
                                j_fkf = rIndexesFld.findIndex(aItem => (aItem.OBJECT_NAME.trim() == rCheckConst[j_const].REF_TABLE.trim()) && (aItem.INDEXNAME.trim() == rCheckConst[j_const].REF_INDEX.trim()));
                                if (j_fkf > -1) {
                                    outforeignk[outforeignk.length - 1].foreignkey.toColumn = rIndexesFld[j_fkf].FLDNAME.trim();
                                }

                                if (rCheckConst[j_const].REF_UPDATE.toString().trim() !== 'RESTRICT') {
                                    outforeignk[outforeignk.length - 1].foreignkey.updateRole = rCheckConst[j_const].REF_UPDATE.toString().trim();
                                }
                                if (rCheckConst[j_const].REF_DELETE.toString().trim() !== 'RESTRICT') {
                                    outforeignk[outforeignk.length - 1].foreignkey.deleteRole = rCheckConst[j_const].REF_DELETE.toString().trim();
                                }
                            }
                            else if (rCheckConst[j_const].CONST_TYPE.toString().trim().toUpperCase() === 'PRIMARY KEY') {

                                outTables.table.constraint.primaryKey.name = rCheckConst[j_const].CONST_NAME.trim();
                                //busco el/los campos de la clave primaria
                                j_fkf = rIndexesFld.findIndex(aItem => (aItem.OBJECT_NAME.trim() == rCheckConst[j_const].OBJECT_NAME.trim()) && (aItem.INDEXNAME.trim() == rCheckConst[j_const].INDEXNAME.trim()));
                                if (j_fkf > -1) {
                                    while ((j_fkf < rIndexesFld.length) && (rIndexesFld[j_fkf].OBJECT_NAME.trim() == rCheckConst[j_const].OBJECT_NAME.trim()) && (rIndexesFld[j_fkf].INDEXNAME.trim() == rCheckConst[j_const].INDEXNAME.trim())) {
                                        //TABLENAME, INDEXNAME, FPOSITION, FLDNAME
                                        outTables.table.constraint.primaryKey.columns.push(rIndexesFld[j_fkf].FLDNAME.trim())
                                        j_fkf++;
                                    }
                                }
                            }
                            j_const++;
                        }
                    }*/
                    outTables.table.columns = outFields;
                    if (outIndexes.length > 0) {
                        outTables.table.indexes = outIndexes;
                    }
                    if (outforeignk.length > 0) {
                        outTables.table.constraint.foreignkeys = outforeignk;
                    }
                    if (outcheck.length > 0) {
                        outTables.table.constraint.checks = outcheck;
                    }
                    if (aRetYaml) {
                        outReturnYaml.push(outTables);
                    }
                    else {
                        this.saveToFile(outTables, GlobalTypes.ArrayobjectType[2], outTables.table.name);
                        console.log(('generado tabla ' + outTables.table.name + '.yaml').padEnd(70, '.') + 'OK');
                    }
                    outTables = GlobalTypes.emptyTablesYamlType();
                    outFields = [];
                    outIndexes = [];
                    outcheck = [];
                    outforeignk = [];
                }
            }
            if (openTr) {
                await this.pgDb.query('COMMIT');
            }
            if (aRetYaml) {
                return outReturnYaml;
            }
        }
        catch (err) {
            throw new Error('Error generando tabla ' + tableName + '.' + err.message);
        }
    }
    async extractMetadataTriggers(objectName, aRetYaml = false, openTr = true) {
        /*NAME, TABLENAME, SOURCE, SEQUENCE, TTYPE, INACTIVE,  DESCRIPTION */
        /* let rTrigger: Array<any>;
         let outReturnYaml: Array<any> = [];
         let outTrigger: GlobalTypes.iTriggerYamlType = GlobalTypes.emptyTriggerYamlType();
         let outTriggerTables: GlobalTypes.iTriggerTable[] = [];
         let j: number = 0;
         let body: string = '';
         let triggerName: string = '';
 
         try {
             if (openTr) {
                 await this.fb.startTransaction(true);
             }
 
             rTrigger = await this.fb.query(this.analyzeQuery(queryTrigger, objectName, GlobalTypes.ArrayobjectType[1]), []);
 
             for (let i = 0; i < rTrigger.length; i++) {
 
                 triggerName = rTrigger[i].OBJECT_NAME.trim();
                 if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[1], triggerName)) {
                     outTrigger.triggerFunction.name = triggerName;
 
                     outTriggerTables.push({ trigger: { name: '', events: [] } });
 
                     outTriggerTables[outTriggerTables.length - 1].trigger.name = triggerName;
                     outTriggerTables[outTriggerTables.length - 1].trigger.table = rTrigger[i].TABLENAME.trim();
 
 
 
                     outTriggerTables[outTriggerTables.length - 1].trigger.active = rTrigger[i].INACTIVE === 0;
 
                     if ([1, 3, 5, 17, 25, 27, 113].indexOf(rTrigger[i].TTYPE) !== -1) {
                         outTriggerTables[outTriggerTables.length - 1].trigger.fires = 'BEFORE';
                     }
                     else if ([2, 4, 6, 18, 26, 28, 114].indexOf(rTrigger[i].TTYPE) !== -1) {
                         outTriggerTables[outTriggerTables.length - 1].trigger.fires = 'AFTER';
                     }
                     if ([1, 2, 17, 18, 25, 26, 113, 114].indexOf(rTrigger[i].TTYPE) !== -1) {
                         outTriggerTables[outTriggerTables.length - 1].trigger.events.push('INSERT');
                     }
                     if ([3, 4, 17, 18, 27, 28, 113, 114].indexOf(rTrigger[i].TTYPE) !== -1) {
                         outTriggerTables[outTriggerTables.length - 1].trigger.events.push('UPDATE');
                     }
                     if ([5, 6, 25, 26, 27, 28, 113, 114].indexOf(rTrigger[i].TTYPE) !== -1) {
                         outTriggerTables[outTriggerTables.length - 1].trigger.events.push('DELETE');
                     }
 
                     if (rTrigger[i].DESCRIPTION !== null) {
                         outTriggerTables[outTriggerTables.length - 1].trigger.description = await fbClass.getBlob(rTrigger[i].DESCRIPTION);
                     }
 
                     outTriggerTables[outTriggerTables.length - 1].trigger.position = rTrigger[i].SEQUENCE;
 
                     body = await fbClass.getBlob(rTrigger[i].SOURCE);
 
                     outTrigger.triggerFunction.function.body = body.replace(/\r/g, '');;
 
                     outTrigger.triggerFunction.triggers = outTriggerTables;
 
                     if (aRetYaml) {
                         outReturnYaml.push(outTrigger);
                     }
                     else {
                         this.saveToFile(outTrigger,GlobalTypes.ArrayobjectType[1],triggerName);
                         console.log(('generado trigger ' + triggerName + '.yaml').padEnd(70, '.') + 'OK');
                     }
 
                     outTrigger = GlobalTypes.emptyTriggerYamlType();
                     outTriggerTables = [];
                 }
             }
             if (openTr) {
                 await this.fb.commit();
             }
             if (aRetYaml) {
                 return outReturnYaml;
             }
         }
         catch (err) {
             throw new Error('Error generando trigger ' + triggerName + '. ' + err.message);
         }*/
    }
    async extractMetadataViews(objectName, aRetYaml = false, openTr = true) {
        /* let rViews: Array<any>;
         let rFields: Array<any>;
 
         let outViewYalm: Array<any> = [];
         let outViews: GlobalTypes.iViewYamlType = GlobalTypes.emptyViewYamlType();
 
         let j_fld: number = 0;
 
         let viewName: string = '';
         let body: string = '';
 
         try {
             if (openTr) {
                 await this.fb.startTransaction(true);
             }
 
             rViews = await this.fb.query(this.analyzeQuery(queryTablesView, objectName, GlobalTypes.ArrayobjectType[4]), []);
             rFields = await this.fb.query(this.analyzeQuery(queryTablesViewFields, objectName, GlobalTypes.ArrayobjectType[4]), []);
 
 
             for (let i = 0; i < rViews.length; i++) {
                 //FIELDNAME, FTYPE, SUBTYPE, FLENGTH, FPRECISION, SCALE, CHARACTERSET,
                 //FCOLLATION, DEFSOURCE, FLAG, VALSOURCE, COMSOURCE, DESCRIPTION
                 viewName = rViews[i].OBJECT_NAME.trim();
                 if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[4], viewName)) {
                     outViews.view.name = viewName;
 
                     if (rViews[i].DESCRIPTION !== null)
                         outViews.view.description = await fbClass.getBlob(rViews[i].DESCRIPTION);
 
                     if (rViews[i].SOURCE !== null)
                         body = await fbClass.getBlob(rViews[i].SOURCE);
 
                     outViews.view.body = body.replace(/\r/g, '');
                     //fields
                     j_fld= rFields.findIndex(aItem => (aItem.OBJECT_NAME.trim() === rViews[i].OBJECT_NAME.trim()));
                     if (j_fld !== -1) {
                         while ((j_fld < rFields.length) && (rFields[j_fld].OBJECT_NAME.trim() == rViews[i].OBJECT_NAME.trim())) {
                             outViews.view.columns.push(rFields[j_fld].FIELDNAME.trim());
                             j_fld++;
                         }
                     }
 
                     if (aRetYaml) {
                         outViewYalm.push(outViews);
                     }
                     else {
                         this.saveToFile(outViews,GlobalTypes.ArrayobjectType[4],viewName);
                         console.log(('generado view ' + viewName + '.yaml').padEnd(70, '.') + 'OK');
                     }
                     outViews = GlobalTypes.emptyViewYamlType();
                 }
             }
             if (openTr) {
                 await this.fb.commit();
             }
             if (aRetYaml) {
                 return outViewYalm;
             }
         } catch (err) {
             throw new Error('Error generando view ' + viewName + '.' + err.message);
         }
 */
    }
    async extractMetadataGenerators(objectName) {
        /*  let rGenerator: Array<any>;
          let outGenerator: GlobalTypes.iGeneratorYamlType = { generator: { name: '' } };
          let genName: string = '';
  
          let j: number = 0;
  
          try {
              await this.fb.startTransaction(true);
  
              rGenerator = await this.fb.query(this.analyzeQuery(queryGenerator, objectName, GlobalTypes.ArrayobjectType[3]), []);
  
              for (let i = 0; i < rGenerator.length; i++) {
  
                  genName = rGenerator[i].OBJECT_NAME.trim();
                  if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[3], genName)) {
                      outGenerator.generator.name = genName;
  
                      if (rGenerator[i].DESCRIPTION !== null) {
                          outGenerator.generator.description = await fbClass.getBlob(rGenerator[i].DESCRIPTION);
                      }
  
                      this.saveToFile(outGenerator,GlobalTypes.ArrayobjectType[3],genName);
  
                      console.log(('generado generator ' + genName + '.yaml').padEnd(70, '.') + 'OK');
                      outGenerator = { generator: { name: '' } };
                  }
              }
              await this.fb.commit();
          }
          catch (err) {
              throw new Error('Error generando procedimiento ' + genName + '. ' + err.message);
          }*/
    }
    async writeYalm(ahostName, aportNumber, adatabase, adbUser, adbPassword, objectType, objectName) {
        this.connectionString.host = ahostName;
        this.connectionString.database = adatabase;
        this.connectionString.password = adbPassword;
        this.connectionString.user = adbUser;
        this.connectionString.port = aportNumber;
        this.pgDb = new pg.Client(this.connectionString);
        try {
            await this.pgDb.connect();
            try {
                /*if (objectType === GlobalTypes.ArrayobjectType[0] || objectType === '') {
                    await this.extractMetadataProcedures(objectName);
                }*/
                if (objectType === GlobalTypes.ArrayobjectType[2] || objectType === '') {
                    await this.extractMetadataTables(objectName);
                }
                /*if (objectType === GlobalTypes.ArrayobjectType[1] || objectType === '') {
                    await this.extractMetadataTriggers(objectName);
                }
                if (objectType === GlobalTypes.ArrayobjectType[3] || objectType === '') {
                    await this.extractMetadataGenerators(objectName);
                }
                if (objectType === GlobalTypes.ArrayobjectType[4] || objectType === '') {
                    await this.extractMetadataViews(objectName);
                }*/
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
exports.pgExtractMetadata = pgExtractMetadata;
function FieldType(aParam) {
    let ft = '';
    switch (aParam.AType) {
        case 'bit':
        case 'bit varying':
            ft = aParam.AType + '(' + aParam.ALength.toString() + ')';
            break;
        //tipo de datos string
        case 'character':
        case 'char':
            ft = 'char(' + aParam.ALength.toString() + ')';
            break;
        case 'character varying':
        case 'varchar':
            ft = 'varchar(' + aParam.ALength.toString() + ')';
            break;
        case 'text':
            ft = 'blob text';
            break;
        //numericos con decimales
        case 'numeric':
        case 'decimal':
            ft = aParam.AType + ' (' + aParam.APrecision.toString() + ',' + aParam.AScale.toString() + ')';
            break;
        case 'double precision':
        case 'float8':
            ft = 'double precision';
            break;
        case 'real':
        case 'float4':
            ft = 'real';
            break;
        //monetarios
        case 'money':
            ft = aParam.AType;
            break;
        //enteros
        case 'bigint':
        case 'int8':
            ft = 'bigint';
            break;
        case 'bigserial':
        case 'serial8':
            ft = 'bigserial';
            break;
        case 'integer':
        case 'int':
        case 'int4':
            ft = 'integer';
            break;
        case 'smallint':
        case 'int2':
            ft = 'smallint';
            break;
        case 'smallserial':
        case 'serial2':
            ft = 'smallserial';
            break;
        case 'serial':
        case 'serial4':
            ft = 'serial';
            break;
        //network
        case 'inet': //direcciones ip v4 y v6
        case 'cidr': //hostname
        case 'macaddr':
        case 'macaddr8':
            ft = aParam.AType;
            break;
        //fecha y hora
        case 'timestamp':
        case 'timestamp without time zone':
            /*if (aParam.APrecision !== null || aParam.APrecision > 0)
                ft = 'timestamp('+aParam.APrecision.toString()+')';
            else*/
            ft = 'timestamp';
            break;
        case 'timestamp with time zone':
        case 'timestamptz':
            /*if (aParam.APrecision !== null || aParam.APrecision > 0)
                ft = aParam.AType+'('+aParam.APrecision.toString()+')';
            else*/
            ft = aParam.AType;
            break;
        case 'date':
            ft = aParam.AType;
            break;
        case 'time':
        case 'time without time zone':
            /*if (aParam.APrecision !== null || aParam.APrecision > 0)
                ft = 'time('+aParam.APrecision.toString()+')';
            else*/
            ft = 'time';
            break;
        case 'time with time zone':
        case 'timetz':
            /*if (aParam.APrecision !== null || aParam.APrecision > 0)
                ft = aParam.AType+'('+aParam.APrecision.toString()+')';
            else*/
            ft = aParam.AType;
            break;
        case 'interval':
            if (aParam.APrecision !== null || aParam.APrecision > 0)
                ft = aParam.AType + '(' + aParam.APrecision.toString() + ')';
            else
                ft = aParam.AType;
            break;
        //binarios    
        case 'bytea':
            ft = 'blob binary';
            break;
        //booleanos     
        case 'boolean':
        case 'bool':
            ft = 'boolean';
            break;
        //geometricos
        case 'box':
        case 'circle':
        case 'polygon':
        case 'line':
        case 'lseg':
        case 'point':
        case 'path':
            ft = aParam.AType;
            break;
        //otros    	 	    	
        case 'tsquery':
        case 'tsvector':
        case 'txid_snapshot':
        case 'uuid':
        case 'json':
        case 'xml':
            ft = aParam.AType;
            break;
        default:
            throw new Error('tipo de dato desconocido ' + aParam.AType);
    }
    return ft;
}
//# sourceMappingURL=pgExtractMetadata.js.map