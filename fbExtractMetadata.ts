import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as fbClass from './classFirebird';
import * as GlobalTypes from './globalTypes';
import * as globalFunction from './globalFunction';
import * as sources from './loadsource';
import * as metadataQuerys from './fbMetadataQuerys';

export interface iFieldType {
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


export class fbExtractMetadata {
    //****************************************************************** */
    //        D E C L A R A C I O N E S    P R I V A D A S
    //******************************************************************* */

    private fb: fbClass.fbConnection;
    public sources: sources.tSource | any;

    private saveToFile(aYalm: any, aObjectType: string, aObjectName: string) {
        if (this.nofolders) {
            fs.writeFileSync(this.filesPath + aObjectType + '_' + aObjectName + '.yaml', yaml.safeDump(aYalm, GlobalTypes.yamlExportOptions), GlobalTypes.yamlFileSaveOptions);
        }
        else {
            if (!fs.existsSync(this.filesPath + aObjectType + '/')) {
                fs.mkdirSync(this.filesPath + aObjectType)
            }
            fs.writeFileSync(this.filesPath + aObjectType + '/' + aObjectName + '.yaml', yaml.safeDump(aYalm, GlobalTypes.yamlExportOptions), GlobalTypes.yamlFileSaveOptions);
        }
    }

    private analyzeQuery(aQuery: string, aObjectName: string, aObjectType: string) {
        let aRet: string = aQuery;
        let namesArray: Array<string> = [];
        let aux: string = '';


        if (aObjectName !== '')
            aRet = aRet.replace('{FILTER_OBJECT}', "WHERE UPPER(TRIM(OBJECT_NAME)) = '" + aObjectName.toUpperCase() + "'")
        else {
            if (this.excludeFrom) {
                if (!this.sources.loadYaml)
                    this.sources.readSource('', '');
                switch (aObjectType) {
                    case GlobalTypes.ArrayobjectType[2]:
                        for (let i in this.sources.tablesArrayYaml)
                            namesArray.push("'" + this.sources.tablesArrayYaml[i].contentFile.table.name + "'")
                        break;
                    case GlobalTypes.ArrayobjectType[0]:
                        for (let i in this.sources.proceduresArrayYaml)
                            namesArray.push("'" + this.sources.proceduresArrayYaml[i].contentFile.procedure.name + "'")
                        break;
                    case GlobalTypes.ArrayobjectType[1]:
                        for (let i in this.sources.triggersArrayYaml)
                            namesArray.push("'" + this.sources.triggersArrayYaml[i].contentFile.triggerFunction.name + "'")
                        break;
                    case GlobalTypes.ArrayobjectType[4]:
                        for (let i in this.sources.viewsArrayYaml)
                            namesArray.push("'" + this.sources.viewsArrayYaml[i].contentFile.view.name + "'")
                        break;
                    case GlobalTypes.ArrayobjectType[3]:
                        for (let i in this.sources.generatorsArrayYaml)
                            namesArray.push("'" + this.sources.generatorsArrayYaml[i].contentFile.generator.name + "'")
                        break;
                }
                if (namesArray.length > 0) {
                    aux = globalFunction.arrayToString(namesArray, ',');
                    aRet = aRet.replace('{FILTER_OBJECT}', function (x: string) { return 'WHERE TRIM(OBJECT_NAME) NOT IN (' + aux + ')' });
                    //                    console.log(aux);
                    //aRet= aRet.replace('{FILTER_OBJECT}', 'WHERE UPPER(TRIM(OBJECT_NAME)) NOT IN (' + aux+')');                                    
                }
                else
                    aRet = aRet.replace('{FILTER_OBJECT}', '');
            }
            else
                aRet = aRet.replace('{FILTER_OBJECT}', '');
        }
        if (aObjectType === GlobalTypes.ArrayobjectType[2])     //tabla
            aRet = aRet.replace('{RELTYPE}', ' AND (REL.RDB$RELATION_TYPE<>1 OR REL.RDB$RELATION_TYPE IS NULL)');
        else if (aObjectType === GlobalTypes.ArrayobjectType[4])     //vista
            aRet = aRet.replace('{RELTYPE}', ' AND (REL.RDB$RELATION_TYPE=1)');

        return aRet;
    }

    async extractMetadataProcedures(objectName: string, aRetYaml: boolean = false, openTr: boolean = true): Promise<any> {
        let rProcedures: Array<any>;
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

            rProcedures = await this.fb.query(this.analyzeQuery(metadataQuerys.queryProcedure, objectName, GlobalTypes.ArrayobjectType[0]), []);
            rParamater = await this.fb.query(this.analyzeQuery(metadataQuerys.queryProcedureParameters, objectName, GlobalTypes.ArrayobjectType[0]), []);

            for (let i = 0; i < rProcedures.length; i++) {
                procedureName = rProcedures[i].OBJECT_NAME.toLowerCase().trim();

                if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[0], procedureName)) {

                    outProcedure.procedure.name = procedureName;

                    j = rParamater.findIndex(aItem => (aItem.OBJECT_NAME.toLowerCase().trim() === procedureName));
                    if (j !== -1) {
                        while ((j < rParamater.length) && (rParamater[j].OBJECT_NAME.toLowerCase().trim() === procedureName)) {
                            ft.AName = rParamater[j].PARAMATER_NAME.toLowerCase().trim();
                            ft.AType = rParamater[j].FTYPE;
                            ft.ASubType = rParamater[j].FSUB_TYPE;
                            ft.ALength = rParamater[j].FLENGTH;
                            ft.APrecision = rParamater[j].FPRECISION;
                            ft.AScale = rParamater[j].FSCALE;
                            ft.ACharSet = null;
                            ft.ACollate = rParamater[j].FCOLLATION_NAME;
                            if (rParamater[j].FSOURCE !== null) { // al ser blob si es nulo no devuelve una funcion si no null
                                ft.ADefault = await fbClass.getBlob(rParamater[j].FSOURCE, 'text');
                                ft.ADefault = ft.ADefault.toLowerCase().trim();
                            }
                            else
                                ft.ADefault = rParamater[j].FSOURCE;


                            ft.ANotNull = rParamater[j].FLAG;
                            ft.AComputed = null;

                            if (rParamater[j].PARAMATER_TYPE == 0) {
                                outProcedureParameterInput.push({ param: { name: "", type: "" } });
                                outProcedureParameterInput[outProcedureParameterInput.length - 1].param.name = rParamater[j].PARAMATER_NAME.toLowerCase().trim();
                                outProcedureParameterInput[outProcedureParameterInput.length - 1].param.type = FieldType(ft);
                            }
                            else if (rParamater[j].PARAMATER_TYPE == 1) {
                                outProcedureParameterOutput.push({ param: { name: "", type: "" } });
                                outProcedureParameterOutput[outProcedureParameterOutput.length - 1].param.name = rParamater[j].PARAMATER_NAME.toLowerCase().trim();
                                outProcedureParameterOutput[outProcedureParameterOutput.length - 1].param.type = FieldType(ft);
                            }
                            j++;
                        }
                    }

                    if (rProcedures[i].DESCRIPTION !== null) {
                        outProcedure.procedure.description = await fbClass.getBlob(rProcedures[i].DESCRIPTION, 'text');
                    }

                    body = await fbClass.getBlob(rProcedures[i].SOURCE, 'text');

                    outProcedure.procedure.body = body.replace(new RegExp(String.fromCharCode(9), 'g'), '    ').replace(/\r/g, '');
                    //body.replace(/\r/g, '');;

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
                await this.fb.commit();
            }
            if (aRetYaml) {
                return outReturnYaml;
            }
        }
        catch (err) {
            throw new Error('Error generando procedimiento ' + procedureName + '. ' + err.message);
        }
    }

    async extractMetadataTables(objectName: string, aRetYaml: boolean = false, openTr: boolean = true): Promise<any> {
        let rTables: Array<any>;
        let rFields: Array<any>;
        let rIndexes: Array<any>;
        let rIndexesFld: Array<any>;
        let rCheckConst: Array<any>;

        let outTables: GlobalTypes.iTablesYamlType = GlobalTypes.emptyTablesYamlType();
        let outFields: GlobalTypes.iTablesFieldYamlType[] = [];
        let outFK: GlobalTypes.iTablesFKYamlType[] = [];
        let outCheck: GlobalTypes.iTablesCheckType[] = [];
        let outIndexes: GlobalTypes.iTablesIndexesType[] = [];
        let outforeignk: GlobalTypes.iTablesFKYamlType[] = [];
        let outcheck: GlobalTypes.iTablesCheckType[] = [];
        let outReturnYaml: Array<any> = [];

        let j_fld: number = 0;
        let j_idx: number = 0;
        let j_idx_fld: number = 0;
        let j_const: number = 0;
        let j_fkf: number = 0;

        let tableName: string = '';
        let txtAux: string = '';

        let ft: iFieldType = {}; // {AName:null, AType:null, ASubType:null, ALength:null, APrecision:null, AScale:null, ACharSet: null, ACollate:null, ADefault:null, ANotNull:null, AComputed:null};   

        let includeIndex: boolean = false;

        try {
            if (openTr) {
                await this.fb.startTransaction(true);
            }

            rTables = await this.fb.query(this.analyzeQuery(metadataQuerys.queryTablesView, objectName, GlobalTypes.ArrayobjectType[2]), []);
            rFields = await this.fb.query(this.analyzeQuery(metadataQuerys.queryTablesViewFields, objectName, GlobalTypes.ArrayobjectType[2]), []);
            rIndexes = await this.fb.query(this.analyzeQuery(metadataQuerys.queryTablesIndexes, objectName, GlobalTypes.ArrayobjectType[2]), []);
            rIndexesFld = await this.fb.query(this.analyzeQuery(metadataQuerys.queryTableIndexesField, objectName, GlobalTypes.ArrayobjectType[2]), []);
            rCheckConst = await this.fb.query(this.analyzeQuery(metadataQuerys.queryTableCheckConstraint, objectName, GlobalTypes.ArrayobjectType[2]), []);


            for (let i = 0; i < rTables.length; i++) {
                /*FIELDNAME, FTYPE, SUBTYPE, FLENGTH, FPRECISION, SCALE, CHARACTERSET,
                FCOLLATION, DEFSOURCE, FLAG, VALSOURCE, COMSOURCE, DESCRIPTION*/
                tableName = rTables[i].OBJECT_NAME.toLowerCase().trim();
                if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[2], tableName)) {
                    outTables.table.name = tableName;

                    if (rTables[i].RELTYPE === 5)
                        outTables.table.temporaryType = 'DELETE ROWS';
                    else if (rTables[i].RELTYPE === 4)
                        outTables.table.temporaryType = 'PRESERVE ROWS';

                    if (rTables[i].DESCRIPTION !== null) {
                        outTables.table.description = await fbClass.getBlob(rTables[i].DESCRIPTION, 'text');
                    }

                    //fields
                    j_fld = rFields.findIndex(aItem => (aItem.OBJECT_NAME.toLowerCase().trim() === rTables[i].OBJECT_NAME.toLowerCase().trim()));
                    if (j_fld !== -1) {
                        while ((j_fld < rFields.length) && (rFields[j_fld].OBJECT_NAME.toLowerCase().trim() == rTables[i].OBJECT_NAME.toLowerCase().trim())) {

                            if (globalFunction.includeObject(this.excludeObject, 'fields', rFields[j_fld].FIELDNAME.toLowerCase().trim())) {
                                outFields.push(GlobalTypes.emptyTablesFieldYamlType());

                                outFields[outFields.length - 1].column.name = rFields[j_fld].FIELDNAME.toLowerCase().trim();

                                if (rFields[j_fld].COMSOURCE !== null) {
                                    outFields[outFields.length - 1].column.computed = await fbClass.getBlob(rFields[j_fld].COMSOURCE, 'text');
                                    outFields[outFields.length - 1].column.computed = String(outFields[outFields.length - 1].column.computed).toLowerCase().trim();
                                }
                                else {
                                    if (rFields[j_fld].CHARACTERSET !== null && rFields[j_fld].CHARACTERSET.toLowerCase().trim() !== 'none')
                                        outFields[outFields.length - 1].column.charset = rFields[j_fld].CHARACTERSET.toLowerCase().trim();

                                    outFields[outFields.length - 1].column.nullable = rFields[j_fld].FLAG !== 1;

                                    ft.AType = rFields[j_fld].FTYPE;
                                    ft.ASubType = rFields[j_fld].SUBTYPE;
                                    ft.ALength = rFields[j_fld].FLENGTH;
                                    ft.APrecision = rFields[j_fld].FPRECISION;
                                    ft.AScale = rFields[j_fld].SCALE;

                                    if (rFields[j_fld].FCOLLATION !== null && rFields[j_fld].FCOLLATION.toLowerCase().trim() !== 'NONE')
                                        outFields[outFields.length - 1].column.collate = rFields[j_fld].FCOLLATION.toLowerCase().trim();

                                    if (rFields[j_fld].DESCRIPTION !== null) {
                                        outFields[outFields.length - 1].column.description = await fbClass.getBlob(rFields[j_fld].DESCRIPTION, 'text');
                                    }

                                    if (rFields[j_fld].DEFSOURCE !== null) {// al ser blob si es nulo no devuelve una funcion si no null
                                        txtAux = await fbClass.getBlob(rFields[j_fld].DEFSOURCE, 'text');
                                        outFields[outFields.length - 1].column.default = txtAux.replace('DEFAULT', '').trim();
                                    }

                                    outFields[outFields.length - 1].column.type = FieldType(ft);
                                }
                            }
                            j_fld++;
                        }
                    }
                    //indices
                    j_idx = rIndexes.findIndex(aItem => (aItem.OBJECT_NAME.toLowerCase().trim() === rTables[i].OBJECT_NAME.toLowerCase().trim()));
                    if (j_idx !== -1) {
                        while ((j_idx < rIndexes.length) && (rIndexes[j_idx].OBJECT_NAME.toLowerCase().trim() == rTables[i].OBJECT_NAME.toLowerCase().trim())) {
                            /*TABLENAME, INDEXNAME,  FUNIQUE, INACTIVE, TYPE, SOURCE,  DESCRIPTION*/

                            // ******* SOLAMENTE PARA VALIDAR CAMPOS, SI ALGUNO ESTA EN LA EXCLUSION, EXCLUYO EL INDICE */
                            includeIndex = true;
                            j_idx_fld = rIndexesFld.findIndex(aItem => (aItem.OBJECT_NAME.toLowerCase().trim() == rIndexes[j_idx].OBJECT_NAME.toLowerCase().trim()) && (aItem.INDEXNAME.toLowerCase().trim() == rIndexes[j_idx].INDEXNAME.toLowerCase().trim()));
                            if (j_idx_fld > -1) {
                                while ((j_idx_fld < rIndexesFld.length) && (rIndexesFld[j_idx_fld].OBJECT_NAME.toLowerCase().trim() == rIndexes[j_idx].OBJECT_NAME.toLowerCase().trim()) && (rIndexesFld[j_idx_fld].INDEXNAME.toLowerCase().trim() == rIndexes[j_idx].INDEXNAME.toLowerCase().trim())) {
                                    if (!globalFunction.includeObject(this.excludeObject, 'fields', rIndexesFld[j_idx_fld].FLDNAME.toLowerCase().trim())) {
                                        includeIndex = false;
                                        break;
                                    }
                                    j_idx_fld++;
                                }
                            }
                            //************************************* */
                            if (includeIndex) {
                                outIndexes.push(GlobalTypes.emptyTablesIndexesType());

                                outIndexes[outIndexes.length - 1].index.name = rIndexes[j_idx].INDEXNAME.toLowerCase().trim();

                                outIndexes[outIndexes.length - 1].index.active = rIndexes[j_idx].INACTIVE !== 1;

                                if (rIndexes[j_idx].SOURCE !== null) {
                                    outIndexes[outIndexes.length - 1].index.computedBy = await fbClass.getBlob(rIndexes[j_idx].SOURCE, 'text');
                                    outIndexes[outIndexes.length - 1].index.computedBy = String(outIndexes[outIndexes.length - 1].index.computedBy).toLowerCase().trim();
                                }
                                outIndexes[outIndexes.length - 1].index.unique = rIndexes[j_idx].FUNIQUE === 1;

                                outIndexes[outIndexes.length - 1].index.descending = rIndexes[j_idx].FTYPE === 1;

                                if (rIndexes[j_idx].DESCRIPTION !== null) {
                                    outIndexes[outIndexes.length - 1].index.description = await fbClass.getBlob(rIndexes[j_idx].DESCRIPTION, 'text');
                                }

                                j_idx_fld = rIndexesFld.findIndex(aItem => (aItem.OBJECT_NAME.toLowerCase().trim() == rIndexes[j_idx].OBJECT_NAME.toLowerCase().trim()) && (aItem.INDEXNAME.toLowerCase().trim() == rIndexes[j_idx].INDEXNAME.toLowerCase().trim()));
                                if (j_idx_fld > -1) {
                                    while ((j_idx_fld < rIndexesFld.length) && (rIndexesFld[j_idx_fld].OBJECT_NAME.toLowerCase().trim() == rIndexes[j_idx].OBJECT_NAME.toLowerCase().trim()) && (rIndexesFld[j_idx_fld].INDEXNAME.toLowerCase().trim() == rIndexes[j_idx].INDEXNAME.toLowerCase().trim())) {
                                        /*TABLENAME, INDEXNAME, FPOSITION, FLDNAME*/
                                        outIndexes[outIndexes.length - 1].index.columns.push(rIndexesFld[j_idx_fld].FLDNAME.toLowerCase().trim());
                                        j_idx_fld++;
                                    }
                                }
                            }

                            j_idx++;
                        }
                    }
                    /* TABLENAME,CONST_NAME,CONST_TYPE, INDEXNAME, INDEXTYPE, REF_TABLE, REF_INDEX, REF_UPDATE, 
                       REF_DELETE, DESCRIPTION, CHECK_SOURCE
                    */
                    j_const = rCheckConst.findIndex(aItem => (aItem.OBJECT_NAME.toLowerCase().trim() === rTables[i].OBJECT_NAME.toLowerCase().trim()));
                    if (j_const !== -1) {
                        while ((j_const < rCheckConst.length) && (rCheckConst[j_const].OBJECT_NAME.toLowerCase().trim() == rTables[i].OBJECT_NAME.toLowerCase().trim())) {
                            if (rCheckConst[j_const].CONST_TYPE.toString().trim().toLowerCase() === 'check') {
                                outcheck.push({ check: { name: '', expresion: '' } });

                                outcheck[outcheck.length - 1].check.name = rCheckConst[j_const].CONST_NAME.toLowerCase().trim();
                                outcheck[outcheck.length - 1].check.expresion = await fbClass.getBlob(rCheckConst[j_const].CHECK_SOURCE, 'text');
                                outcheck[outcheck.length - 1].check.expresion = String(outcheck[outcheck.length - 1].check.expresion).trim();
                                if (rCheckConst[j_const].DESCRIPTION !== null)
                                    outcheck[outcheck.length - 1].check.description = await fbClass.getBlob(rCheckConst[j_const].DESCRIPTION, 'text');
                            }
                            else if (rCheckConst[j_const].CONST_TYPE.toString().trim().toLowerCase() === 'foreign key') {
                                outforeignk.push({ foreignkey: { name: '' } });
                                outforeignk[outforeignk.length - 1].foreignkey.name = rCheckConst[j_const].CONST_NAME.toLowerCase().trim();

                                //busco el campo del indice de la FK en la tabla origen 
                                j_fkf = rIndexesFld.findIndex(aItem => (aItem.OBJECT_NAME.toLowerCase().trim() == rCheckConst[j_const].OBJECT_NAME.toLowerCase().trim()) && (aItem.INDEXNAME.toLowerCase().trim() == rCheckConst[j_const].INDEXNAME.toLowerCase().trim()));
                                if (j_fkf > -1) {
                                    outforeignk[outforeignk.length - 1].foreignkey.onColumn = rIndexesFld[j_fkf].FLDNAME.toLowerCase().trim();
                                }

                                outforeignk[outforeignk.length - 1].foreignkey.toTable = rCheckConst[j_const].REF_TABLE.toLowerCase().trim();
                                if (rCheckConst[j_const].DESCRIPTION !== null) {
                                    outforeignk[outforeignk.length - 1].foreignkey.description = await fbClass.getBlob(rCheckConst[j_const].DESCRIPTION, 'text');
                                }
                                //busco el campo del indice de la FK en la tabla destino
                                j_fkf = rIndexesFld.findIndex(aItem => (aItem.OBJECT_NAME.toLowerCase().trim() == rCheckConst[j_const].REF_TABLE.toLowerCase().trim()) && (aItem.INDEXNAME.toLowerCase().trim() == rCheckConst[j_const].REF_INDEX.toLowerCase().trim()));
                                if (j_fkf > -1) {
                                    outforeignk[outforeignk.length - 1].foreignkey.toColumn = rIndexesFld[j_fkf].FLDNAME.toLowerCase().trim();
                                }

                                if (rCheckConst[j_const].REF_UPDATE.toString().toLowerCase().trim() !== 'restrict') {
                                    outforeignk[outforeignk.length - 1].foreignkey.updateRole = rCheckConst[j_const].REF_UPDATE.toString().toLowerCase().trim();
                                }
                                if (rCheckConst[j_const].REF_DELETE.toString().toLowerCase().trim() !== 'restrict') {
                                    outforeignk[outforeignk.length - 1].foreignkey.deleteRole = rCheckConst[j_const].REF_DELETE.toString().toLowerCase().trim();
                                }
                            }
                            else if (rCheckConst[j_const].CONST_TYPE.toString().trim().toLowerCase() === 'primary key') {

                                outTables.table.constraint.primaryKey.name = rCheckConst[j_const].CONST_NAME.toLowerCase().trim();
                                if (rCheckConst[j_const].DESCRIPTION !== null) {
                                    outTables.table.constraint.primaryKey.description = await fbClass.getBlob(rCheckConst[j_const].DESCRIPTION, 'text');
                                }
                                //busco el/los campos de la clave primaria
                                j_fkf = rIndexesFld.findIndex(aItem => (aItem.OBJECT_NAME.toLowerCase().trim() == rCheckConst[j_const].OBJECT_NAME.toLowerCase().trim()) && (aItem.INDEXNAME.toLowerCase().trim() == rCheckConst[j_const].INDEXNAME.toLowerCase().trim()));
                                if (j_fkf > -1) {
                                    while ((j_fkf < rIndexesFld.length) && (rIndexesFld[j_fkf].OBJECT_NAME.toLowerCase().trim() == rCheckConst[j_const].OBJECT_NAME.toLowerCase().trim()) && (rIndexesFld[j_fkf].INDEXNAME.toLowerCase().trim() == rCheckConst[j_const].INDEXNAME.toLowerCase().trim())) {
                                        /*TABLENAME, INDEXNAME, FPOSITION, FLDNAME*/
                                        outTables.table.constraint.primaryKey.columns.push(rIndexesFld[j_fkf].FLDNAME.toLowerCase().trim())
                                        j_fkf++;
                                    }
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
                await this.fb.commit();
            }
            if (aRetYaml) {
                return outReturnYaml;
            }

        } catch (err) {
            throw new Error('Error generando tabla ' + tableName + '.' + err.message);
        }

    }

    async extractMetadataTriggers(objectName: string, aRetYaml: boolean = false, openTr: boolean = true): Promise<any> {
        /*NAME, TABLENAME, SOURCE, SEQUENCE, TTYPE, INACTIVE,  DESCRIPTION */
        let rTrigger: Array<any>;
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

            rTrigger = await this.fb.query(this.analyzeQuery(metadataQuerys.queryTrigger, objectName, GlobalTypes.ArrayobjectType[1]), []);

            for (let i = 0; i < rTrigger.length; i++) {

                triggerName = rTrigger[i].OBJECT_NAME.toLowerCase().trim();
                if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[1], triggerName)) {
                    outTrigger.triggerFunction.name = triggerName;

                    outTriggerTables.push({ trigger: { name: '', events: [] } });

                    outTriggerTables[outTriggerTables.length - 1].trigger.name = triggerName;
                    outTriggerTables[outTriggerTables.length - 1].trigger.table = rTrigger[i].TABLENAME.toLowerCase().trim();



                    outTriggerTables[outTriggerTables.length - 1].trigger.active = rTrigger[i].INACTIVE === 0;

                    if ([1, 3, 5, 17, 25, 27, 113].indexOf(rTrigger[i].TTYPE) !== -1) {
                        outTriggerTables[outTriggerTables.length - 1].trigger.fires = 'before';
                    }
                    else if ([2, 4, 6, 18, 26, 28, 114].indexOf(rTrigger[i].TTYPE) !== -1) {
                        outTriggerTables[outTriggerTables.length - 1].trigger.fires = 'after';
                    }
                    if ([1, 2, 17, 18, 25, 26, 113, 114].indexOf(rTrigger[i].TTYPE) !== -1) {
                        outTriggerTables[outTriggerTables.length - 1].trigger.events.push('insert');
                    }
                    if ([3, 4, 17, 18, 27, 28, 113, 114].indexOf(rTrigger[i].TTYPE) !== -1) {
                        outTriggerTables[outTriggerTables.length - 1].trigger.events.push('update');
                    }
                    if ([5, 6, 25, 26, 27, 28, 113, 114].indexOf(rTrigger[i].TTYPE) !== -1) {
                        outTriggerTables[outTriggerTables.length - 1].trigger.events.push('delete');
                    }

                    if (rTrigger[i].DESCRIPTION !== null) {
                        outTriggerTables[outTriggerTables.length - 1].trigger.description = await fbClass.getBlob(rTrigger[i].DESCRIPTION, 'text');
                    }

                    outTriggerTables[outTriggerTables.length - 1].trigger.position = rTrigger[i].SEQUENCE;

                    body = await fbClass.getBlob(rTrigger[i].SOURCE, 'text');

                    outTrigger.triggerFunction.function.body = body.replace(new RegExp(String.fromCharCode(9), 'g'), '    ').replace(/\r/g, '');
                    //body.replace(/\r/g, '');;

                    outTrigger.triggerFunction.triggers = outTriggerTables;

                    if (aRetYaml) {
                        outReturnYaml.push(outTrigger);
                    }
                    else {
                        this.saveToFile(outTrigger, GlobalTypes.ArrayobjectType[1], triggerName);
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
        }
    }

    async extractMetadataViews(objectName: string, aRetYaml: boolean = false, openTr: boolean = true): Promise<any> {
        let rViews: Array<any>;
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

            rViews = await this.fb.query(this.analyzeQuery(metadataQuerys.queryTablesView, objectName, GlobalTypes.ArrayobjectType[4]), []);
            rFields = await this.fb.query(this.analyzeQuery(metadataQuerys.queryTablesViewFields, objectName, GlobalTypes.ArrayobjectType[4]), []);


            for (let i = 0; i < rViews.length; i++) {
                /*FIELDNAME, FTYPE, SUBTYPE, FLENGTH, FPRECISION, SCALE, CHARACTERSET,
                FCOLLATION, DEFSOURCE, FLAG, VALSOURCE, COMSOURCE, DESCRIPTION*/
                viewName = rViews[i].OBJECT_NAME.toLowerCase().trim();
                if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[4], viewName)) {
                    outViews.view.name = viewName;

                    if (rViews[i].DESCRIPTION !== null) {
                        outViews.view.description = await fbClass.getBlob(rViews[i].DESCRIPTION, 'text');
                    }

                    if (rViews[i].SOURCE !== null)
                        body = await fbClass.getBlob(rViews[i].SOURCE, 'text');

                    outViews.view.body = body.replace(new RegExp(String.fromCharCode(9), 'g'), '    ').replace(/\r/g, '');
                    //body.replace(/\r/g, '');
                    //fields
                    j_fld = rFields.findIndex(aItem => (aItem.OBJECT_NAME.toLowerCase().trim() === viewName));
                    if (j_fld !== -1) {
                        while ((j_fld < rFields.length) && (rFields[j_fld].OBJECT_NAME.toLowerCase().trim() == viewName)) {
                            outViews.view.columns.push(rFields[j_fld].FIELDNAME.toLowerCase().trim());
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
                await this.fb.commit();
            }
            if (aRetYaml) {
                return outViewYalm;
            }
        } catch (err) {
            throw new Error('Error generando view ' + viewName + '.' + err.message);
        }

    }

    async extractMetadataGenerators(objectName: string, aRetYaml: boolean = false, openTr: boolean = true): Promise<any> {
        let rGenerator: Array<any>;
        let outGenerator: GlobalTypes.iGeneratorYamlType = { generator: { name: '' } };
        let genName: string = '';
        let outGeneratorYalm: Array<any> = [];

        let j: number = 0;

        try {
            if (openTr) {
                await this.fb.startTransaction(true);
            }

            rGenerator = await this.fb.query(this.analyzeQuery(metadataQuerys.queryGenerator, objectName, GlobalTypes.ArrayobjectType[3]), []);

            for (let i = 0; i < rGenerator.length; i++) {

                genName = rGenerator[i].OBJECT_NAME.toLowerCase().trim();
                if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[3], genName)) {
                    outGenerator.generator.name = genName;
                    outGenerator.generator.increment = rGenerator[i].INCREMENT;

                    if (rGenerator[i].DESCRIPTION !== null) {
                        outGenerator.generator.description = await fbClass.getBlob(rGenerator[i].DESCRIPTION, 'text');
                    }

                    if (aRetYaml) {
                        outGeneratorYalm.push(outGenerator);
                    }
                    else {
                        this.saveToFile(outGenerator, GlobalTypes.ArrayobjectType[3], genName);

                        console.log(('generado generator ' + genName + '.yaml').padEnd(70, '.') + 'OK');
                    }
                    outGenerator = { generator: { name: '' } };
                }
            }
            if (openTr) {
                await this.fb.commit();
            }
            if (aRetYaml)
                return outGeneratorYalm;
        }
        catch (err) {
            throw new Error('Error generando procedimiento ' + genName + '. ' + err.message);
        }
    }

    //****************************************************************** */
    //        D E C L A R A C I O N E S    P U B L I C A S
    //******************************************************************* */

    filesPath: string = '';
    excludeObject: any;
    excludeFrom: boolean = false;
    nofolders: boolean = false;

    constructor(aConnection: fbClass.fbConnection | undefined = undefined) {
        if (aConnection === undefined) {
            this.fb = new fbClass.fbConnection;
        }
        else {
            this.fb = aConnection;
        }
        this.sources = new sources.tSource;
    }

    public async writeYalm(ahostName: string, aportNumber: number, adatabase: string, adbUser: string, adbPassword: string, objectType: string, objectName: string) {

        this.fb.database = adatabase;
        this.fb.dbPassword = adbPassword;
        this.fb.dbUser = adbUser;
        this.fb.hostName = ahostName;
        this.fb.portNumber = aportNumber;

        try {

            await this.fb.connect();

            try {

                if (objectType === GlobalTypes.ArrayobjectType[0] || objectType === '') {
                    await this.extractMetadataProcedures(objectName);
                }
                if (objectType === GlobalTypes.ArrayobjectType[2] || objectType === '') {
                    await this.extractMetadataTables(objectName);
                }
                if (objectType === GlobalTypes.ArrayobjectType[1] || objectType === '') {
                    await this.extractMetadataTriggers(objectName);
                }
                if (objectType === GlobalTypes.ArrayobjectType[3] || objectType === '') {
                    await this.extractMetadataGenerators(objectName);
                }
                if (objectType === GlobalTypes.ArrayobjectType[4] || objectType === '') {
                    await this.extractMetadataViews(objectName);
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

function FieldType(aParam: iFieldType) {
    let ft: string = '';

    switch (aParam.AType) {
        case 7:
        case 8:
        case 16:
            aParam.AScale = -aParam.AScale;
            if (aParam.ASubType == 1)
                ft = GlobalTypes.convertDataType('numeric') + '(' + aParam.APrecision.toString() + ',' + aParam.AScale.toString() + ')'
            else if (aParam.ASubType == 2)
                ft = GlobalTypes.convertDataType('decimal') + '(' + aParam.APrecision.toString() + ',' + aParam.AScale.toString() + ')'
            else if (aParam.AType == 7)
                ft = GlobalTypes.convertDataType('smallint')
            else if (aParam.AType == 8)
                ft = GlobalTypes.convertDataType('integer')
            else
                ft = GlobalTypes.convertDataType('bigint');
            break;
        case 10:
            ft = GlobalTypes.convertDataType('float');
            break;
        case 12:
            ft = GlobalTypes.convertDataType('date');
            break;
        case 13:
            ft = GlobalTypes.convertDataType('time');
            break;
        case 14:
            ft = GlobalTypes.convertDataType('char') + '(' + aParam.ALength.toString() + ')';
            break;
        case 27:
            ft = GlobalTypes.convertDataType('double precision');
            break;
        case 35:
            ft = GlobalTypes.convertDataType('timestamp');
            break;
        case 37:
            ft = GlobalTypes.convertDataType('varchar') + '(' + aParam.ALength.toString() + ')';
            break;
        case 261:
            if (aParam.ASubType == 0)
                ft = 'blob sub_type 0'
            else if (aParam.ASubType == 1)
                ft = 'blob sub_type 1'
            else
                ft = 'unknown';
            ft = GlobalTypes.convertDataType(ft);
            break;
        default:
            ft = 'unknown';
    }

    if (['', null, 'NONE', undefined, 'none'].indexOf(aParam.ACharSet) == -1)
        ft = ft + ' character set ' + aParam.ACharSet;

    if (aParam.ADefault !== '' && aParam.ADefault !== null && aParam.ADefault !== undefined)
        ft = ft + ' ' + aParam.ADefault;

    if (aParam.AComputed !== '' && aParam.AComputed !== null && aParam.AComputed !== undefined)
        ft = ft + ' computed by ' + aParam.AComputed;

    if (aParam.ANotNull)
        ft = ft + ' not null';

    if (aParam.ACollate !== '' && aParam.ACollate !== null && aParam.ACollate !== undefined)
        ft = ft + ' collate ' + aParam.ACollate.toLowerCase().trim();

    return ft;
}

function extractVariablesForBody(aBody: string) {
    let variableName: string = '';
    let variableType: string = '';
    let ret: GlobalTypes.iProcedureVariable[] = [];
    let j: number = 0;
    let inCursor: boolean = false;
    let cursorString: string = '';

    aBody.split(/\r?\n/).forEach(function (line) {
        let txt: string = line.toUpperCase().trim();
        j++;
        if (txt.startsWith('DECLARE VARIABLE')) {
            variableName = '';
            variableType = '';
            //reveer esto por tema de cursores
            txt.split(' ').forEach(function (word) {
                if (['DECLARE', 'VARIABLE'].indexOf(word) === -1) { //si no es
                    if (variableName === '')
                        variableName = word;
                    else
                        variableType += word + ' ';
                }
            });
            //console.log('linea :'+j.toString()+' Name: '+variableName+ ' Type: '+variableType);
            ret.push({ var: { name: variableName, type: variableType.substr(0, variableType.length - 2) } });
        }
        else if ((txt.search(' CURSOR FOR ') > 1) || inCursor) {

            if (!inCursor) {
                variableType = 'CURSOR';
                variableName = txt.split(' ')[1];
                inCursor = true;
                if (txt.search('SELECT ') !== -1) {
                    cursorString += txt.substring(txt.search('SELECT '));
                }
            } else {

                if (txt.endsWith(');')) {
                    cursorString += txt.substr(0, line.trim().length - 2);
                    ret.push({ var: { name: variableName, type: variableType, cursor: cursorString } });
                    inCursor = false;
                    cursorString = '';
                }
                else {
                    cursorString += txt + String.fromCharCode(10);
                }
            }
        }
    });
    return ret;
}

function excludeVariablesForBody(aType: string, aBody: string) {
    let variableName: string = '';
    let variableType: string = '';
    let ret: string = '';
    let j: number = 0;
    aBody.split(/\r?\n/).forEach(function (line) {
        j++;
        if (!line.toUpperCase().trim().startsWith('DECLARE VARIABLE')) {
            if (!(aType === 'T' && line.toUpperCase().trim() === 'AS')) {
                ret += line + String.fromCharCode(10);
            }
        };
    });
    return ret;
}