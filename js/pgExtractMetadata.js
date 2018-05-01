"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const yaml = require("js-yaml");
const GlobalTypes = require("./globalTypes");
const globalFunction = require("./globalFunction");
const sources = require("./loadsource");
const pg = require("pg");
const metadataQuerys = require("./pgMetadataQuerys");
;
const defaultSchema = 'public';
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
        //va con RegExp porque el replace cambia solo la primer ocurrencia.        
        aRet = aRet.replace(new RegExp('{FILTER_SCHEMA}', 'g'), "'" + defaultSchema + "'");
        if (aObjectName !== '')
            aRet = aRet.replace('{FILTER_OBJECT}', "WHERE UPPER(TRIM(cc.objectName)) = '" + aObjectName.toUpperCase() + "'");
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
                    aRet = aRet.replace('{FILTER_OBJECT}', function (x) { return 'WHERE TRIM(CC.objectName) NOT IN (' + aux + ')'; });
                }
                else
                    aRet = aRet.replace('{FILTER_OBJECT}', '');
            }
            else
                aRet = aRet.replace('{FILTER_OBJECT}', '');
        }
        //r = ordinary table, i = index, S = sequence, v = view, m = materialized view, c = composite type, t = TOAST table, f = foreign table
        if (aObjectType === GlobalTypes.ArrayobjectType[2]) //tabla
            aRet = aRet.replace('{RELTYPE}', " AND relkind IN ('r','t','f') ");
        else if (aObjectType === GlobalTypes.ArrayobjectType[4]) //vista
            aRet = aRet.replace('{RELTYPE}', " AND relkind IN ('v','m') ");
        return aRet;
    }
    async extractMetadataProcedures(objectName, aRetYaml = false, openTr = true) {
        let rProcedures;
        let rParamater;
        let rQuery;
        let outReturnYaml = [];
        let outProcedure = GlobalTypes.emptyProcedureYamlType();
        let outProcedureParameterInput = [];
        let outProcedureParameterOutput = [];
        let j = 0;
        let body = '';
        let procedureName = '';
        let ft = {};
        try {
            if (openTr) {
                await this.pgDb.query('BEGIN');
            }
            rQuery = await this.pgDb.query(this.analyzeQuery(metadataQuerys.queryProcedure, objectName, GlobalTypes.ArrayobjectType[0]), []);
            rProcedures = rQuery.rows;
            //rQuery = await this.pgDb.query(this.analyzeQuery(metadataQuerys.queryProcedureParameters, objectName, GlobalTypes.ArrayobjectType[0]), []);
            //rParamater = rQuery.rows;
            rParamater = [];
            for (let i = 0; i < rProcedures.length; i++) {
                //"schema", "functionName", "objectName","languageName","cost","rows",
                //"isStrict","volatility","source", "description",returnType
                procedureName = rProcedures[i].functionName;
                if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[0], procedureName)) {
                    outProcedure.procedure.name = procedureName;
                    if (rProcedures[i].description !== null)
                        outProcedure.procedure.description = rProcedures[i].description;
                    outProcedure.procedure.pg.executionCost = rProcedures[i].cost;
                    outProcedure.procedure.pg.resultType = rProcedures[i].returnType;
                    outProcedure.procedure.pg.language = rProcedures[i].languageName;
                    outProcedure.procedure.pg.resultRows = rProcedures[i].rows;
                    outProcedure.procedure.pg.options.optimization.type = rProcedures[i].volatility;
                    outProcedure.procedure.pg.options.optimization.returnNullonNullInput = rProcedures[i].isStrict;
                    j = rParamater.findIndex(aItem => (aItem.functionName.trim() === procedureName));
                    if (j !== -1) {
                        while ((j < rParamater.length) && (rParamater[j].functionName === procedureName)) {
                            /*ft.AName = rParamater[j].PARAMATER_NAME;
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
                            }*/
                            j++;
                        }
                    }
                    body = rProcedures[i].source;
                    outProcedure.procedure.body = body; //.replace(/\r/g, '');;
                    if (outProcedureParameterInput.length > 0)
                        outProcedure.procedure.inputs = outProcedureParameterInput;
                    if (outProcedureParameterOutput.length > 0)
                        outProcedure.procedure.outputs = outProcedureParameterOutput;
                    if (aRetYaml) {
                        outReturnYaml.push(outProcedure);
                    }
                    else {
                        this.saveToFile(outProcedure, GlobalTypes.ArrayobjectType[0], outProcedure.procedure.name);
                        console.log(('generado procedimiento ' + outProcedure.procedure.name + '.yaml').padEnd(70, '.') + 'OK');
                    }
                    outProcedure = GlobalTypes.emptyProcedureYamlType();
                    outProcedureParameterInput = [];
                    outProcedureParameterOutput = [];
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
            throw new Error('Error generando procedimiento ' + procedureName + '. ' + err.message);
        }
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
            rQuery = await this.pgDb.query(this.analyzeQuery(metadataQuerys.queryTablesView, objectName, GlobalTypes.ArrayobjectType[2]), []);
            rTables = rQuery.rows;
            rQuery = await this.pgDb.query(this.analyzeQuery(metadataQuerys.queryTablesViewFields, objectName, GlobalTypes.ArrayobjectType[2]), []);
            rFields = rQuery.rows;
            rQuery = await this.pgDb.query(this.analyzeQuery(metadataQuerys.queryTablesIndexes, objectName, GlobalTypes.ArrayobjectType[2]), []);
            rIndexes = rQuery.rows;
            rQuery = await this.pgDb.query(this.analyzeQuery(metadataQuerys.queryTableIndexesField, objectName, GlobalTypes.ArrayobjectType[2]), []);
            rIndexesFld = rQuery.rows;
            rQuery = await this.pgDb.query(this.analyzeQuery(metadataQuerys.queryTableCheckConstraint, objectName, GlobalTypes.ArrayobjectType[2]), []);
            rCheckConst = rQuery.rows;
            for (let i = 0; i < rTables.length; i++) {
                tableName = rTables[i].tableName.trim();
                if (tableName === 'art_arch')
                    tableName = tableName;
                if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[2], tableName)) {
                    outTables.table.name = tableName;
                    if (rTables[i].description !== null)
                        outTables.table.description = rTables[i].description.trim();
                    //fields
                    j_fld = rFields.findIndex(aItem => (aItem.tableName.trim() === tableName));
                    if (j_fld !== -1) {
                        while ((j_fld < rFields.length) && (rFields[j_fld].tableName.trim() == tableName)) {
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
                                if (rIndexes[j_idx].description !== null)
                                    outTables.table.constraint.primaryKey.description = rIndexes[j_idx].description.trim();
                            }
                            else {
                                outIndexes.push(GlobalTypes.emptyTablesIndexesType());
                                if (rIndexes[j_idx].description !== null)
                                    outIndexes[outIndexes.length - 1].index.description = rIndexes[j_idx].description.trim();
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
                                        if (rIndexesFld[j_idx_fld].option === 0) //0 =  ningun ordenamiento 
                                            aOrden = 'ASC';
                                        else if (rIndexesFld[j_idx_fld].option === 1) //desending
                                            aOrden = 'DESC';
                                        else if (rIndexesFld[j_idx_fld].option === 2) //null last
                                            aOrden = 'NULL LAST';
                                        else if (rIndexesFld[j_idx_fld].option === 3) //desending con null last
                                            aOrden = 'DESC NULL LAST';
                                        outIndexes[outIndexes.length - 1].index.columns.push({ name: rIndexesFld[j_idx_fld].columnName.trim(), order: aOrden });
                                    }
                                    j_idx_fld++;
                                }
                            }
                            j_idx++;
                        }
                    }
                    //"constraintSchema", "constraintName","constraintType","constraintDescription","columnName","tableSchema",
                    //"tableName","position","uniqueConstraintPosition","isDeferrable","initiallyDeferred","matchOption","updateRule",
                    //"deleteRule","referencedTableSchema","referencedTableName","referencedColumnName","check_source"
                    j_const = rCheckConst.findIndex(aItem => (aItem.tableName.trim() === tableName));
                    if (j_const !== -1) {
                        while ((j_const < rCheckConst.length) && (rCheckConst[j_const].tableName.trim() == tableName)) {
                            if (rCheckConst[j_const].constraintType.toString().trim().toUpperCase() === 'CHECK') {
                                outcheck.push({ check: { name: '', expresion: '' } });
                                outcheck[outcheck.length - 1].check.name = rCheckConst[j_const].constraintName.trim();
                                outcheck[outcheck.length - 1].check.expresion = rCheckConst[j_const].check_source;
                                if (rCheckConst[j_const].constraintDescription !== null)
                                    outcheck[outcheck.length - 1].check.description = rCheckConst[j_const].constraintDescription.trim();
                            }
                            else if (rCheckConst[j_const].constraintType.toString().trim().toUpperCase() === 'FOREIGN KEY') {
                                outforeignk.push({ foreignkey: { name: '' } });
                                outforeignk[outforeignk.length - 1].foreignkey.name = rCheckConst[j_const].constraintName.trim();
                                outforeignk[outforeignk.length - 1].foreignkey.onColumn = rCheckConst[j_const].columnName.trim();
                                outforeignk[outforeignk.length - 1].foreignkey.toTable = rCheckConst[j_const].referencedTableName.trim();
                                outforeignk[outforeignk.length - 1].foreignkey.toColumn = rCheckConst[j_const].referencedColumnName.trim();
                                if (rCheckConst[j_const].constraintDescription !== null)
                                    outforeignk[outcheck.length - 1].foreignkey.description = rCheckConst[j_const].constraintDescription.trim();
                                if (rCheckConst[j_const].updateRule.toString().trim() !== 'RESTRICT') {
                                    outforeignk[outforeignk.length - 1].foreignkey.updateRole = rCheckConst[j_const].updateRule.toString().trim();
                                }
                                if (rCheckConst[j_const].deleteRule.toString().trim() !== 'RESTRICT') {
                                    outforeignk[outforeignk.length - 1].foreignkey.deleteRole = rCheckConst[j_const].deleteRule.toString().trim();
                                }
                            }
                            j_const++;
                        }
                    }
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
        let rViews;
        let rFields;
        let rQuery;
        let outViewYalm = [];
        let outViews = GlobalTypes.emptyViewYamlType();
        let j_fld = 0;
        let viewName = '';
        let body = '';
        try {
            if (openTr) {
                await this.pgDb.query('BEGIN');
            }
            rQuery = await this.pgDb.query(this.analyzeQuery(metadataQuerys.queryTablesView, objectName, GlobalTypes.ArrayobjectType[4]), []);
            rViews = rQuery.rows;
            rQuery = await this.pgDb.query(this.analyzeQuery(metadataQuerys.queryTablesViewFields, objectName, GlobalTypes.ArrayobjectType[4]), []);
            rFields = rQuery.rows;
            for (let i = 0; i < rViews.length; i++) {
                viewName = rViews[i].tableName.trim();
                if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[4], viewName)) {
                    outViews.view.name = viewName;
                    if (rViews[i].description !== null)
                        outViews.view.description = rViews[i].description.trim();
                    if (rViews[i].view_source !== null)
                        body = rViews[i].view_source;
                    outViews.view.body = body.replace(/\r/g, '');
                    //fields
                    j_fld = rFields.findIndex(aItem => (aItem.tableName.trim() === viewName));
                    if (j_fld !== -1) {
                        while ((j_fld < rFields.length) && (rFields[j_fld].tableName.trim() == viewName)) {
                            outViews.view.columns.push(rFields[j_fld].columnName.trim());
                            j_fld++;
                        }
                    }
                    if (aRetYaml) {
                        outViewYalm.push(outViews);
                    }
                    else {
                        this.saveToFile(outViews, GlobalTypes.ArrayobjectType[4], viewName);
                        console.log(('generado view ' + viewName + '.yaml').padEnd(70, '.') + 'OK');
                    }
                    outViews = GlobalTypes.emptyViewYamlType();
                }
            }
            if (openTr) {
                await this.pgDb.query('COMMIT');
            }
            if (aRetYaml) {
                return outViewYalm;
            }
        }
        catch (err) {
            throw new Error('Error generando view ' + viewName + '.' + err.message);
        }
    }
    async extractMetadataGenerators(objectName) {
        let rGenerator;
        let rQuery;
        let outGenerator = { generator: { name: '' } };
        let genName = '';
        let j = 0;
        try {
            await this.pgDb.query('BEGIN');
            rQuery = await this.pgDb.query(this.analyzeQuery(metadataQuerys.queryGenerator, objectName, GlobalTypes.ArrayobjectType[2]), []);
            rGenerator = rQuery.rows;
            for (let i = 0; i < rGenerator.length; i++) {
                genName = rGenerator[i].sequenceName.trim();
                if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[3], genName)) {
                    outGenerator.generator.name = genName;
                    outGenerator.generator.increment = Number(rGenerator[i].increment);
                    if (rGenerator[i].description !== null) {
                        outGenerator.generator.description = rGenerator[i].description;
                    }
                    this.saveToFile(outGenerator, GlobalTypes.ArrayobjectType[3], genName);
                    console.log(('generado generator ' + genName + '.yaml').padEnd(70, '.') + 'OK');
                    outGenerator = { generator: { name: '' } };
                }
            }
            await this.pgDb.query('COMMIT');
        }
        catch (err) {
            throw new Error('Error generando procedimiento ' + genName + '. ' + err.message);
        }
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
                if (objectType === GlobalTypes.ArrayobjectType[0] || objectType === '') {
                    await this.extractMetadataProcedures(objectName);
                }
                if (objectType === GlobalTypes.ArrayobjectType[2] || objectType === '') {
                    await this.extractMetadataTables(objectName);
                }
                /*if (objectType === GlobalTypes.ArrayobjectType[1] || objectType === '') {
                    await this.extractMetadataTriggers(objectName);
                }*/
                if (objectType === GlobalTypes.ArrayobjectType[3] || objectType === '') {
                    await this.extractMetadataGenerators(objectName);
                }
                if (objectType === GlobalTypes.ArrayobjectType[4] || objectType === '') {
                    await this.extractMetadataViews(objectName);
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
            ft = aParam.AType + '(' + aParam.APrecision.toString() + ',' + aParam.AScale.toString() + ')';
            break;
        case 'decimal':
            ft = aParam.AType + '(' + aParam.APrecision.toString() + ',' + aParam.AScale.toString() + ')';
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
    return ft.toUpperCase();
}
//# sourceMappingURL=pgExtractMetadata.js.map