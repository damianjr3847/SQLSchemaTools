import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as fbClass from './classFirebird';
import * as GlobalTypes from './globalTypes';

const queryProcedure:string = 
    `SELECT TRIM(RDB$PROCEDURE_NAME) AS NAME,
     RDB$PROCEDURE_SOURCE AS SOURCE,
     RDB$DESCRIPTION AS DESCRIPTION
     FROM RDB$PROCEDURES
     WHERE RDB$SYSTEM_FLAG=0 AND (RDB$PROCEDURE_NAME=? OR ?=CAST('' AS CHAR(31)))
     ORDER BY RDB$PROCEDURE_NAME`;

const queryProcedureParameters:string = 
    `SELECT 
     TRIM(PPA.RDB$PROCEDURE_NAME) AS PROCEDURE_NAME, 
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
     WHERE PPA.RDB$PROCEDURE_NAME=? OR ?=CAST('' AS CHAR(31))
     ORDER BY PPA.RDB$PROCEDURE_NAME, PPA.RDB$PARAMETER_TYPE, PPA.RDB$PARAMETER_NUMBER`;

const queryTablesView:string = 
     `SELECT  REL.RDB$RELATION_NAME AS NAME, REL.RDB$VIEW_SOURCE AS SOURCE, REL.RDB$DESCRIPTION AS DESCRIPTION, REL.RDB$RELATION_TYPE AS RELTYPE
     FROM RDB$RELATIONS REL
     WHERE REL.RDB$SYSTEM_FLAG=0 AND (REL.RDB$RELATION_NAME=? OR ?=CAST('' AS CHAR(31))) AND REL.RDB$RELATION_NAME NOT STARTING 'IBE$' AND {$$RELTYPE} 
     ORDER BY REL.RDB$RELATION_NAME`;

const queryTablesViewFields:string =
    `SELECT  
     RFR.RDB$RELATION_NAME AS TABLENAME, RFR.RDB$FIELD_NAME AS FIELDNAME, FLD.RDB$FIELD_TYPE AS FTYPE, 
     FLD.RDB$FIELD_SUB_TYPE AS SUBTYPE, FLD.RDB$CHARACTER_LENGTH AS FLENGTH,
     FLD.RDB$FIELD_PRECISION AS FPRECISION, FLD.RDB$FIELD_SCALE AS SCALE, CHR.RDB$CHARACTER_SET_NAME AS CHARACTERSET,
     COL.RDB$COLLATION_NAME AS FCOLLATION, 
     RFR.RDB$DEFAULT_SOURCE AS DEFSOURCE, RFR.RDB$NULL_FLAG AS FLAG, FLD.RDB$VALIDATION_SOURCE AS VALSOURCE, 
     FLD.RDB$COMPUTED_SOURCE AS COMSOURCE, FLD.RDB$DESCRIPTION AS DESCRIPTION
    FROM RDB$RELATIONS REL
    LEFT OUTER JOIN RDB$RELATION_FIELDS RFR ON RFR.RDB$RELATION_NAME=REL.RDB$RELATION_NAME
    LEFT OUTER JOIN RDB$FIELDS FLD ON FLD.RDB$FIELD_NAME = RFR.RDB$FIELD_SOURCE
    LEFT OUTER JOIN RDB$CHARACTER_SETS CHR ON CHR.RDB$CHARACTER_SET_ID = FLD.RDB$CHARACTER_SET_ID  
    LEFT OUTER JOIN RDB$COLLATIONS COL ON COL.RDB$COLLATION_ID = COALESCE(RFR.RDB$COLLATION_ID, FLD.RDB$COLLATION_ID) AND COL.RDB$CHARACTER_SET_ID = FLD.RDB$CHARACTER_SET_ID
    WHERE REL.RDB$SYSTEM_FLAG=0 AND (REL.RDB$RELATION_NAME=? OR ?=CAST('' AS CHAR(31))) AND REL.RDB$RELATION_NAME NOT STARTING 'IBE$' AND {$$RELTYPE} 
    ORDER BY RFR.RDB$RELATION_NAME, RFR.RDB$FIELD_POSITION, RFR.RDB$FIELD_NAME`    

const queryTablesIndexes:string =
    `SELECT  IDX.RDB$RELATION_NAME AS TABLENAME, IDX.RDB$INDEX_NAME AS INDEXNAME, IDX.RDB$UNIQUE_FLAG AS FUNIQUE, 
             IDX.RDB$INDEX_INACTIVE AS INACTIVE,
             IDX.RDB$INDEX_TYPE AS FTYPE,IDX.RDB$EXPRESSION_SOURCE AS SOURCE, IDX.RDB$DESCRIPTION AS DESCRIPTION
    FROM RDB$INDICES IDX
    LEFT OUTER JOIN RDB$RELATION_CONSTRAINTS CON ON CON.RDB$INDEX_NAME = IDX.RDB$INDEX_NAME
    WHERE IDX.RDB$SYSTEM_FLAG=0 AND CON.RDB$INDEX_NAME IS NULL AND (IDX.RDB$RELATION_NAME=? OR ?=CAST('' AS CHAR(31))) AND IDX.RDB$RELATION_NAME NOT STARTING 'IBE$' 
    ORDER BY IDX.RDB$RELATION_NAME, IDX.RDB$INDEX_NAME`;

const queryTableIndexesField:string =
    `SELECT IDX.RDB$RELATION_NAME AS TABLENAME, IDX.RDB$INDEX_NAME AS INDEXNAME, SEG.RDB$FIELD_POSITION AS FPOSITION, SEG.RDB$FIELD_NAME FLDNAME
     FROM RDB$INDICES IDX
     INNER JOIN RDB$INDEX_SEGMENTS SEG ON SEG.RDB$INDEX_NAME=IDX.RDB$INDEX_NAME
     WHERE IDX.RDB$SYSTEM_FLAG=0 AND (IDX.RDB$RELATION_NAME=? OR ?=CAST('' AS CHAR(31))) AND IDX.RDB$RELATION_NAME NOT STARTING 'IBE$'
           /*AND NOT EXISTS(SELECT 1 FROM RDB$RELATION_CONSTRAINTS CON WHERE CON.RDB$CONSTRAINT_NAME=IDX.RDB$INDEX_NAME) /*PARA QUE NO TRAIGA LOS CAMPOS DE LAS CLAVES PRIMARIAS*/
     ORDER BY SEG.RDB$INDEX_NAME, SEG.RDB$FIELD_POSITION`;

const queryTableCheckConstraint:string =
    `SELECT CON.RDB$RELATION_NAME AS TABLENAME, CON.RDB$CONSTRAINT_NAME AS CONST_NAME, CON.RDB$CONSTRAINT_TYPE AS CONST_TYPE, 
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
           AND (CON.RDB$RELATION_NAME=? OR ?=CAST('' AS CHAR(31)))
     ORDER BY CON.RDB$RELATION_NAME, CON.RDB$CONSTRAINT_TYPE, CON.RDB$CONSTRAINT_NAME;`;

const queryGenerator:string = 
    `SELECT RDB$GENERATOR_NAME AS GNAME, RDB$DESCRIPTION AS DESCRIPTION
     FROM RDB$GENERATORS 
     WHERE RDB$SYSTEM_FLAG = 0 AND (RDB$GENERATOR_NAME=? OR ?=CAST('' AS CHAR(31)))
     ORDER BY RDB$GENERATOR_NAME `;

const queryTrigger:string = 
    `SELECT  TRG.RDB$TRIGGER_NAME AS NAME, TRG.RDB$RELATION_NAME AS TABLENAME, TRG.RDB$TRIGGER_SOURCE AS SOURCE, 
             TRG.RDB$TRIGGER_SEQUENCE AS SEQUENCE,
             TRG.RDB$TRIGGER_TYPE AS TTYPE, TRG.RDB$TRIGGER_INACTIVE AS INACTIVE, TRG.RDB$DESCRIPTION AS DESCRIPTION
     FROM RDB$TRIGGERS TRG
     LEFT OUTER JOIN RDB$CHECK_CONSTRAINTS CON ON (CON.RDB$TRIGGER_NAME = TRG.RDB$TRIGGER_NAME)
     WHERE ((TRG.RDB$SYSTEM_FLAG = 0) OR (TRG.RDB$SYSTEM_FLAG IS NULL)) AND (CON.RDB$TRIGGER_NAME IS NULL)
     ORDER BY TRG.RDB$TRIGGER_NAME`;

interface iFieldType {
    AName?:         string  | any;
    AType?:         number  | any,
    ASubType?:      number  | any, 
    ALength?:       number  | any, 
    APrecision?:    number  | any, 
    AScale?:        number  | any, 
    ACharSet?:      string  | any, 
    ACollate?:      string  | any, 
    ADefault?:      string  | any, 
    ANotNull?:      boolean | any, 
    AComputed?:     string  | any,
    ADescription?:  string  | any,
    AValidation?:   string  | any
};


export class fbExtractMetadata {
    //****************************************************************** */
    //        D E C L A R A C I O N E S    P R I V A D A S
    //******************************************************************* */

    private  fb : fbClass.fbConnection;            
    
    async extractMetadataProcedures(objectName:string, aRetYaml:boolean=false, openTr:boolean=true):Promise<any> {
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

            rProcedures = await this.fb.query(queryProcedure,[objectName,objectName]);
            rParamater  = await this.fb.query(queryProcedureParameters,[objectName,objectName]);
                        
            for (let i=0; i < rProcedures.length; i++){
                
                procedureName= rProcedures[i].NAME; 
                outProcedure.procedure.name= procedureName; 

                while ((j< rParamater.length) && (rParamater[j].PROCEDURE_NAME == rProcedures[i].NAME)) {
                    ft.AName        = rParamater[j].PARAMATER_NAME;
                    ft.AType        = rParamater[j].FTYPE;                    
                    ft.ASubType     = rParamater[j].FSUB_TYPE;
                    ft.ALength      = rParamater[j].FLENGTH; 
                    ft.APrecision   = rParamater[j].FPRECISION;
                    ft.AScale       = rParamater[j].FSCALE;
                    ft.ACharSet     = null;
                    ft.ACollate     = rParamater[j].FCOLLATION_NAME;
                    if (rParamater[j].FSOURCE !== null) // al ser blob si es nulo no devuelve una funcion si no null
                        ft.ADefault = await this.fb.getBlobAsString(rParamater[j].FSOURCE);
                    else
                        ft.ADefault = rParamater[j].FSOURCE;
                    ft.ANotNull     = rParamater[j].FLAG
                    ft.AComputed    = null;

                    if (rParamater[j].PARAMATER_TYPE == 0) {
                        outProcedureParameterInput.push({param:{name:"",type:""}});
                        outProcedureParameterInput[outProcedureParameterInput.length-1].param.name = rParamater[j].PARAMATER_NAME;                        
                        outProcedureParameterInput[outProcedureParameterInput.length-1].param.type = FieldType(ft);  
                    }
                    else if (rParamater[j].PARAMATER_TYPE == 1) {
                        outProcedureParameterOutput.push({param:{name:"",type:""}});
                        outProcedureParameterOutput[outProcedureParameterOutput.length-1].param.name = rParamater[j].PARAMATER_NAME;
                        outProcedureParameterOutput[outProcedureParameterOutput.length-1].param.type = FieldType(ft);
                    }           
                    j++;
                }                     
                            
                body = await this.fb.getBlobAsString(rProcedures[i].SOURCE);                                            
                
                outProcedure.procedure.body= body.replace(/\r/g,'');;

                if (outProcedureParameterInput.length > 0) 
                    outProcedure.procedure.inputs=outProcedureParameterInput;

                if (outProcedureParameterOutput.length > 0)     
                    outProcedure.procedure.outputs=outProcedureParameterOutput; 
               
                if (aRetYaml) {    
                    outReturnYaml.push(outProcedure);
                }
                else {
                    fs.writeFileSync(this.filesPath+'procedures/'+outProcedure.procedure.name+'.yaml',yaml.safeDump(outProcedure, GlobalTypes.yamlExportOptions), GlobalTypes.yamlFileSaveOptions); 
                    console.log(('generado procedimiento '+outProcedure.procedure.name+'.yaml').padEnd(70,'.')+'OK');
                }
                
                outProcedure = GlobalTypes.emptyProcedureYamlType();
                outProcedureParameterInput    = [];
                outProcedureParameterOutput   = [];                
            }
            if (openTr) {
                await this.fb.commit();
            }
            if (aRetYaml) {    
                return outReturnYaml;
            }    
        }
        catch (err) {
            console.log('Error generando procedimiento '+procedureName+'. ', err.message);
        }  
    }

    async extractMetadataTables(objectName:string, aRetYaml:boolean=false, openTr:boolean=true):Promise<any> {
        let rTables      : Array<any>;
        let rFields      : Array<any>;
        let rIndexes     : Array<any>;
        let rIndexesFld  : Array<any>;
        let rCheckConst  : Array<any>;

        let outTables    : GlobalTypes.iTablesYamlType = GlobalTypes.emptyTablesYamlType(); 
        let outFields    : GlobalTypes.iTablesFieldYamlType[] = [];
        let outFK        : GlobalTypes.iTablesFKYamlType[] = [];
        let outCheck     : GlobalTypes.iTablesCheckType[] = [];
        let outIndexes   : GlobalTypes.iTablesIndexesType[] = [];
        let outforeignk  : GlobalTypes.iTablesFKYamlType[] = [];
		let outcheck     : GlobalTypes.iTablesCheckType[] = [];
        let outReturnYaml: Array<any> = [];

        let j_fld        : number = 0;
        let j_idx        : number = 0;
        let j_idx_fld    : number = 0;
        let j_const      : number = 0;
        let j_fkf        : number = 0;

        let tableName   : string = '';
        let txtAux      : string = '';

        let ft: iFieldType = {}; // {AName:null, AType:null, ASubType:null, ALength:null, APrecision:null, AScale:null, ACharSet: null, ACollate:null, ADefault:null, ANotNull:null, AComputed:null};   
       
        try {
            if (openTr) {   
                await this.fb.startTransaction(true);
            }    

            rTables  = await this.fb.query(queryTablesView.replace('{$$RELTYPE}','(REL.RDB$RELATION_TYPE<>1 OR REL.RDB$RELATION_TYPE IS NULL)') ,[objectName,objectName]);
            rFields  = await this.fb.query(queryTablesViewFields.replace('{$$RELTYPE}','(REL.RDB$RELATION_TYPE<>1 OR REL.RDB$RELATION_TYPE IS NULL)'),[objectName,objectName]);
            rIndexes = await this.fb.query(queryTablesIndexes,[objectName,objectName]);
            rIndexesFld = await this.fb.query(queryTableIndexesField,[objectName,objectName]);
            rCheckConst = await this.fb.query(queryTableCheckConstraint,[objectName,objectName]);
            
            
            for (let i=0; i < rTables.length; i++){
                    /*FIELDNAME, FTYPE, SUBTYPE, FLENGTH, FPRECISION, SCALE, CHARACTERSET,
                    FCOLLATION, DEFSOURCE, FLAG, VALSOURCE, COMSOURCE, DESCRIPTION*/
                    tableName= rTables[i].NAME.trim();
                    outTables.table.name= tableName;
                                        
                    if (rTables[i].RELTYPE === 5) 
                        outTables.table.temporaryType= 'DELETE ROWS';
                    else if (rTables[i].RELTYPE === 4) 
                        outTables.table.temporaryType= 'PRESERVE ROWS';      
                    
                    if (rTables[i].DESCRIPTION !== null)
                        outTables.table.description = await this.fb.getBlobAsString(rTables[i].DESCRIPTION);                    

                    //fields
                    while ((j_fld< rFields.length) && (rFields[j_fld].TABLENAME.trim() == rTables[i].NAME.trim())) {
                        
                        outFields.push(GlobalTypes.emptyTablesFieldYamlType());

                        outFields[outFields.length-1].column.name      = rFields[j_fld].FIELDNAME.trim();
                        
                        if (rFields[j_fld].COMSOURCE !== null)
                            outFields[outFields.length-1].column.computed    = await this.fb.getBlobAsString(rFields[j_fld].COMSOURCE);
                        else {
                            if (rFields[j_fld].CHARACTERSET !== null && rFields[j_fld].CHARACTERSET.trim() !== 'NONE')
                                outFields[outFields.length-1].column.charset   = rFields[j_fld].CHARACTERSET.trim();
                                                
                            outFields[outFields.length-1].column.nullable  = rFields[j_fld].FLAG !== 1;

                            ft.AType        = rFields[j_fld].FTYPE;
                            ft.ASubType     = rFields[j_fld].SUBTYPE;
                            ft.ALength      = rFields[j_fld].FLENGTH;
                            ft.APrecision   = rFields[j_fld].FPRECISION;
                            ft.AScale       = rFields[j_fld].SCALE;                                             

                            if (rFields[j_fld].FCOLLATION !== null && rFields[j_fld].FCOLLATION.trim() !== 'NONE')
                                outFields[outFields.length-1].column.collate     = rFields[j_fld].FCOLLATION.trim();
                        
                            if (rFields[j_fld].DESCRIPTION !== null)
                                outFields[outFields.length-1].column.description = await this.fb.getBlobAsString(rFields[j_fld].DESCRIPTION);                    

                            if (rFields[j_fld].DEFSOURCE !== null) {// al ser blob si es nulo no devuelve una funcion si no null
                                outFields[outFields.length-1].column.default  = await this.fb.getBlobAsString(rFields[j_fld].DEFSOURCE);
                                //outFields[outFields.length-1].column.default = txtAux.trim();//.replace('DEFAULT','');                           
                            }
                            
                            outFields[outFields.length-1].column.type=  FieldType(ft);
                        }    

                        j_fld++;
                    }
                    //indices                    
                    while ((j_idx< rIndexes.length) && (rIndexes[j_idx].TABLENAME.trim() == rTables[i].NAME.trim())) {
                        /*TABLENAME, INDEXNAME,  FUNIQUE, INACTIVE, TYPE, SOURCE,  DESCRIPTION*/    
                        outIndexes.push(GlobalTypes.emptyTablesIndexesType());
                        
                        outIndexes[outIndexes.length-1].index.name= rIndexes[j_idx].INDEXNAME.trim();
                        
                        outIndexes[outIndexes.length-1].index.active= rIndexes[j_idx].INACTIVE !== 1;

                        if (rIndexes[j_idx].SOURCE !== null) 
                            outIndexes[outIndexes.length-1].index.computedBy= await this.fb.getBlobAsString(rIndexes[j_idx].SOURCE);
                                                
                        outIndexes[outIndexes.length-1].index.unique= rIndexes[j_idx].FUNIQUE === 1;
                        
                        outIndexes[outIndexes.length-1].index.descending= rIndexes[j_idx].FTYPE === 1;

                        j_idx_fld = rIndexesFld.findIndex(aItem => (aItem.TABLENAME.trim() == rIndexes[j_idx].TABLENAME.trim()) && (aItem.INDEXNAME.trim() == rIndexes[j_idx].INDEXNAME.trim()));
                        if (j_idx_fld > -1) {
                            while ((j_idx_fld < rIndexesFld.length) && (rIndexesFld[j_idx_fld].TABLENAME.trim() == rIndexes[j_idx].TABLENAME.trim()) && (rIndexesFld[j_idx_fld].INDEXNAME.trim() == rIndexes[j_idx].INDEXNAME.trim())) {    
                                /*TABLENAME, INDEXNAME, FPOSITION, FLDNAME*/
                                outIndexes[outIndexes.length-1].index.columns.push(rIndexesFld[j_idx_fld].FLDNAME.trim());
                                j_idx_fld++;
                            }    
                        }                        
                        
                        j_idx++;
                    }

                    /* TABLENAME,CONST_NAME,CONST_TYPE, INDEXNAME, INDEXTYPE, REF_TABLE, REF_INDEX, REF_UPDATE, 
                       REF_DELETE, DESCRIPTION, CHECK_SOURCE
                    */    
                    while ((j_const< rCheckConst.length) && (rCheckConst[j_const].TABLENAME.trim() == rTables[i].NAME.trim())) {
                        if (rCheckConst[j_const].CONST_TYPE.toString().trim().toUpperCase() === 'CHECK') {
                            outcheck.push({check:{name:'', expresion:''}});

                            outcheck[outcheck.length-1].check.name = rCheckConst[j_const].CONST_NAME.trim();
                            outcheck[outcheck.length-1].check.expresion = await this.fb.getBlobAsString(rCheckConst[j_const].CHECK_SOURCE);
                        }
                        else if (rCheckConst[j_const].CONST_TYPE.toString().trim().toUpperCase() === 'FOREIGN KEY') {
                            outforeignk.push({foreignkey:{name:''}});
                            outforeignk[outforeignk.length-1].foreignkey.name= rCheckConst[j_const].CONST_NAME.trim();
                            
                            //busco el campo del indice de la FK en la tabla origen 
                            j_fkf= rIndexesFld.findIndex(aItem => (aItem.TABLENAME.trim()==rCheckConst[j_const].TABLENAME.trim()) && (aItem.INDEXNAME.trim() == rCheckConst[j_const].INDEXNAME.trim()));
                            if (j_fkf > -1) {
                                outforeignk[outforeignk.length-1].foreignkey.onColumn= rIndexesFld[j_fkf].FLDNAME.trim();
                            } 

                            outforeignk[outforeignk.length-1].foreignkey.toTable= rCheckConst[j_const].REF_TABLE.trim();

                            //busco el campo del indice de la FK en la tabla destino
                            j_fkf= rIndexesFld.findIndex(aItem => (aItem.TABLENAME.trim()==rCheckConst[j_const].REF_TABLE.trim()) && (aItem.INDEXNAME.trim() == rCheckConst[j_const].REF_INDEX.trim()));
                            if (j_fkf > -1) {
                                outforeignk[outforeignk.length-1].foreignkey.toColumn= rIndexesFld[j_fkf].FLDNAME.trim();
                            } 
                            
                            if (rCheckConst[j_const].REF_UPDATE.toString().trim() !== 'RESTRICT') { 
                                outforeignk[outforeignk.length-1].foreignkey.updateRole= rCheckConst[j_const].REF_UPDATE.toString().trim();
                            } 
                            if (rCheckConst[j_const].REF_DELETE.toString().trim() !== 'RESTRICT') {
                                outforeignk[outforeignk.length-1].foreignkey.deleteRole= rCheckConst[j_const].REF_DELETE.toString().trim();
                            }    
                        }
                        else if (rCheckConst[j_const].CONST_TYPE.toString().trim().toUpperCase() === 'PRIMARY KEY') {

                            outTables.table.constraint.primaryKey.name = rCheckConst[j_const].CONST_NAME.trim(); 
                            //busco el/los campos de la clave primaria
                            j_fkf= rIndexesFld.findIndex(aItem => (aItem.TABLENAME.trim()==rCheckConst[j_const].TABLENAME.trim()) && (aItem.INDEXNAME.trim() == rCheckConst[j_const].INDEXNAME.trim()));
                            if (j_fkf > -1) {
                                while ((j_fkf < rIndexesFld.length) && (rIndexesFld[j_fkf].TABLENAME.trim() == rCheckConst[j_const].TABLENAME.trim()) && (rIndexesFld[j_fkf].INDEXNAME.trim() == rCheckConst[j_const].INDEXNAME.trim())) {    
                                    /*TABLENAME, INDEXNAME, FPOSITION, FLDNAME*/
                                    outTables.table.constraint.primaryKey.columns.push(rIndexesFld[j_fkf].FLDNAME.trim())
                                    j_fkf++;
                                }      
                            }                              
                        }
                        j_const++;
                    }

                    outTables.table.columns= outFields; 
                    if (outIndexes.length > 0) {
                        outTables.table.indexes= outIndexes;
                    }
                    if (outforeignk.length > 0) {   
                        outTables.table.constraint.foreignkeys= outforeignk;
                    }
                    if (outcheck.length > 0) {    
                        outTables.table.constraint.checks= outcheck; 
                    }    
                    
                    if (aRetYaml) {
                        outReturnYaml.push(outTables);
                    }
                    else {
                        fs.writeFileSync(this.filesPath+'tables/'+outTables.table.name+'.yaml',yaml.safeDump(outTables, GlobalTypes.yamlExportOptions), GlobalTypes.yamlFileSaveOptions); 
                        console.log(('generado tabla '+outTables.table.name+'.yaml').padEnd(70,'.')+'OK');
                    }                    
                    outTables = GlobalTypes.emptyTablesYamlType();
                    outFields= [];
                    outIndexes= [];
                    outcheck=[];
                    outforeignk=[];

            }
            if (openTr) {
                await this.fb.commit();
            }
            if (aRetYaml) {
                return outReturnYaml;
            } 

        } catch(err) {
            console.log('Error generando tabla '+tableName+'.', err.message);   
        }        
        
    }
    
    async extractMetadataTriggers(objectName:string, aRetYaml:boolean=false, openTr:boolean=true):Promise<any> {
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

            rTrigger = await this.fb.query(queryTrigger,[objectName,objectName]);            
                        
            for (let i=0; i < rTrigger.length; i++){
                
                triggerName= rTrigger[i].NAME.trim(); 
                outTrigger.triggerFunction.name= triggerName; 
                
                outTriggerTables.push({trigger:{name:'',events:[]}});

                outTriggerTables[outTriggerTables.length-1].trigger.name=triggerName;
                outTriggerTables[outTriggerTables.length-1].trigger.table= rTrigger[i].TABLENAME.trim();                
                
                

                outTriggerTables[outTriggerTables.length-1].trigger.active=  rTrigger[i].INACTIVE === 0;
                               
                if ([1,3,5,17,25,27,113].indexOf(rTrigger[i].TTYPE) !== -1 ) {
                    outTriggerTables[outTriggerTables.length-1].trigger.fires= 'BEFORE';
                }
                else if ([2,4,6,18,26,28,114].indexOf(rTrigger[i].TTYPE) !== -1 ) {
                    outTriggerTables[outTriggerTables.length-1].trigger.fires= 'AFTER';
                }
                if ([1,2,17,18,25,26,113,114].indexOf(rTrigger[i].TTYPE) !== -1 ) {
                    outTriggerTables[outTriggerTables.length-1].trigger.events.push('INSERT');
                }
                if ([3,4,17,18,27,28,113,114].indexOf(rTrigger[i].TTYPE) !== -1 ) {
                    outTriggerTables[outTriggerTables.length-1].trigger.events.push('UPDATE');
                }
                if ([5,6,25,26,27,28,113,114].indexOf(rTrigger[i].TTYPE) !== -1 ) {
                    outTriggerTables[outTriggerTables.length-1].trigger.events.push('DELETE');
                }       

                if (rTrigger[i].DESCRIPTION !== null) {
                    outTriggerTables[outTriggerTables.length-1].trigger.description= await this.fb.getBlobAsString(rTrigger[i].DESCRIPTION);        
                }

                outTriggerTables[outTriggerTables.length-1].trigger.position= rTrigger[i].SEQUENCE;

                body = await this.fb.getBlobAsString(rTrigger[i].SOURCE);
                
                outTrigger.triggerFunction.function.body= body.replace(/\r/g,'');;
                                
                outTrigger.triggerFunction.triggers= outTriggerTables;

                if (aRetYaml) {    
                    outReturnYaml.push(outTrigger);
                }    
                else {
                    fs.writeFileSync(this.filesPath+'triggers/'+triggerName+'.yaml',yaml.safeDump(outTrigger, GlobalTypes.yamlExportOptions), GlobalTypes.yamlFileSaveOptions);                 
                    console.log(('generado trigger '+triggerName+'.yaml').padEnd(70,'.')+'OK');
                }  

                outTrigger = GlobalTypes.emptyTriggerYamlType();               
                outTriggerTables = [];               
            }
            if (openTr) {
                await this.fb.commit();
            }    
            if (aRetYaml) {    
                return outReturnYaml;
            }    
        }
        catch (err) {
            console.log('Error generando trigger '+triggerName+'. ', err.message);
        }      
    }

    async extractMetadataViews(objectName:string, aRetYaml:boolean=false, openTr:boolean=true):Promise<any> {
        let rViews      : Array<any>;
        let rFields     : Array<any>;        

        let outViewYalm : Array<any> = [];
        let outViews    : GlobalTypes.iViewYamlType = GlobalTypes.emptyViewYamlType(); 

        let j_fld       : number = 0;
        
        let viewName    : string = '';
        let body        : string = '';
       
        try {
            if (openTr) {    
                await this.fb.startTransaction(true);
            }    

            rViews  = await this.fb.query(queryTablesView.replace('{$$RELTYPE}','(REL.RDB$RELATION_TYPE=1)') ,[objectName,objectName]);
            rFields  = await this.fb.query(queryTablesViewFields.replace('{$$RELTYPE}','(REL.RDB$RELATION_TYPE=1)'),[objectName,objectName]);           
            
            
            for (let i=0; i < rViews.length; i++){
                    /*FIELDNAME, FTYPE, SUBTYPE, FLENGTH, FPRECISION, SCALE, CHARACTERSET,
                    FCOLLATION, DEFSOURCE, FLAG, VALSOURCE, COMSOURCE, DESCRIPTION*/
                    viewName= rViews[i].NAME.trim();
                    outViews.view.name= viewName;                                                                
                    
                    if (rViews[i].DESCRIPTION !== null)
                        outViews.view.description = await this.fb.getBlobAsString(rViews[i].DESCRIPTION);                    

                    if (rViews[i].SOURCE !== null)
                        body = await this.fb.getBlobAsString(rViews[i].SOURCE);
                    
                    outViews.view.body= body.replace(/\r/g,'');
                    //fields
                    while ((j_fld< rFields.length) && (rFields[j_fld].TABLENAME.trim() == rViews[i].NAME.trim())) {
                        outViews.view.columns.push(rFields[j_fld].FIELDNAME.trim());                                
                        j_fld++;
                    }
                    
                    if (aRetYaml) {
                        outViewYalm.push(outViews);
                    }
                    else {
                        fs.writeFileSync(this.filesPath+'views/'+viewName+'.yaml',yaml.safeDump(outViews, GlobalTypes.yamlExportOptions), GlobalTypes.yamlFileSaveOptions); 
                        console.log(('generado view '+viewName+'.yaml').padEnd(70,'.')+'OK');
                    }    
                    outViews = GlobalTypes.emptyViewYamlType();                    

            }   
            if (openTr) { 
                await this.fb.commit();
            }
            if (aRetYaml) {
                return outViewYalm;
            }
        } catch(err) {
            console.log('Error generando view '+viewName+'.', err.message);   
        } 

    }

    private async extractMetadataGenerators(objectName:string) {
        let rGenerator: Array<any>;        
        let outGenerator: GlobalTypes.iGeneratorYamlType = {generator:{name:''}}; 
        let genName:string= '';
        
        let j: number = 0; 
    
        try {
            await this.fb.startTransaction(true);

            rGenerator = await this.fb.query(queryGenerator,[objectName,objectName]);            
                        
            for (let i=0; i < rGenerator.length; i++){
                
                genName= rGenerator[i].GNAME.trim(); 
                outGenerator.generator.name= genName;                                   
                            
                if (rGenerator[i].DESCRIPTION !== null) {
                    outGenerator.generator.description = await this.fb.getBlobAsString(rGenerator[i].DESCRIPTION);
                }
                
                fs.writeFileSync(this.filesPath+'generators/'+genName+'.yaml',yaml.safeDump(outGenerator, GlobalTypes.yamlExportOptions), GlobalTypes.yamlFileSaveOptions); 
                
                console.log(('generado generator '+genName+'.yaml').padEnd(70,'.')+'OK');
                outGenerator = {generator:{name:''}};                          
            }
            await this.fb.commit();
        }
        catch (err) {
            console.log('Error generando procedimiento '+genName+'. ', err.message);
        }  
    }

    //****************************************************************** */
    //        D E C L A R A C I O N E S    P U B L I C A S
    //******************************************************************* */
    
    filesPath:string    = '';

    constructor(aConnection:fbClass.fbConnection | undefined = undefined) {
        if (aConnection === undefined) {
            this.fb = new fbClass.fbConnection;  
        }
        else {
            this.fb = aConnection;     
        }
    }

    public async writeYalm(ahostName:string, aportNumber:number, adatabase:string, adbUser:string, adbPassword:string, objectType:string, objectName:string)  {        
                
        this.fb.database     = adatabase;
        this.fb.dbPassword   = adbPassword;
        this.fb.dbUser       = adbUser;
        this.fb.hostName     = ahostName;
        this.fb.portNumber   = aportNumber;
    
        try {

            await this.fb.connect();
             
            try {
                
                if (objectType === 'procedures' || objectType === '') {
                    if (! fs.existsSync(this.filesPath+'procedures/')) {
                        fs.mkdirSync(this.filesPath+'procedures')        
                    }    
                    await this.extractMetadataProcedures(objectName);
                }
                if (objectType === 'tables' || objectType === '') {
                    if (! fs.existsSync(this.filesPath+'tables/')) {
                        fs.mkdirSync(this.filesPath+'tables')        
                    } 
                    await this.extractMetadataTables(objectName);
                }
                if (objectType === 'triggers' || objectType === '') {
                    if (! fs.existsSync(this.filesPath+'triggers/')) {
                        fs.mkdirSync(this.filesPath+'triggers')        
                    } 
                    await this.extractMetadataTriggers(objectName);
                }
                if (objectType === 'generator' || objectType === '') {
                    if (! fs.existsSync(this.filesPath+'generators/')) {
                        fs.mkdirSync(this.filesPath+'generators')        
                    } 
                    await this.extractMetadataGenerators(objectName);
                }
                if (objectType === 'views' || objectType === '') {
                    if (! fs.existsSync(this.filesPath+'views/')) {
                        fs.mkdirSync(this.filesPath+'views')        
                    } 
                    await this.extractMetadataViews(objectName);
                }                                       
               
            }
            finally {
                await this.fb.disconnect();
            }
        }
        catch (err) {
            console.log('Error: ', err.message);
        }
    
    }    
}

function FieldType(aParam: iFieldType) {
    let ft:string = '';

    switch (aParam.AType) {
        case 7:
        case 8:
        case 16:
            aParam.AScale = -aParam.AScale;
            if (aParam.ASubType == 1) 
                ft = 'NUMERIC('+aParam.APrecision.toString()+','+aParam.AScale.toString()+')'
            else if (aParam.ASubType == 2) 
                ft = 'DECIMAL('+aParam.APrecision.toString()+','+aParam.AScale.toString()+')'
            else if (aParam.AType == 7)
                ft = 'SMALLINT'
            else if (aParam.AType == 8) 
                ft = 'INTEGER'
            else
                ft = 'BIGINT';
            break;    
        case 10: 
            ft = 'FLOAT';
            break;
        case 12: 
            ft = 'DATE';
            break;
        case 13: 
            ft = 'TIME';
            break;
        case 14: 
            ft = 'CHAR('+aParam.ALength.toString()+')';
            break;
        case 27: 
            ft = 'DOUBLE PRECISION';
            break;
        case 35: 
            ft = 'TIMESTAMP';
            break;
        case 37: 
            ft = 'VARCHAR('+aParam.ALength.toString()+')';
            break;
        case 261: 
            if (aParam.ASubType == 0)
                ft = 'BLOB SUB_TYPE 0'
            else if (aParam.ASubType == 1)
                ft = 'BLOB SUB_TYPE 1'
            else
                ft = 'UNKNOWN';
            break;
        default:
            ft = 'UNKNOWN';
    }
  
    if ( ['',null,'NONE', undefined].indexOf(aParam.ACharSet) == -1)
        ft = ft + ' CHARACTER SET '+aParam.ACharSet;
  
    if (aParam.ADefault !== '' && aParam.ADefault !== null && aParam.ADefault !== undefined)
        ft = ft + ' ' + aParam.ADefault;
  
    if (aParam.AComputed !== '' && aParam.AComputed !== null && aParam.AComputed !== undefined)
        ft = ft + ' COMPUTED BY '+aParam.AComputed;
  
    if (aParam.ANotNull) 
        ft = ft + ' NOT NULL';
  
    if (aParam.ACollate !== '' && aParam.ACollate !== null && aParam.ACollate !== undefined)
        ft = ft + ' COLLATE '+aParam.ACollate;
    
    return ft;      
}  

function extractVariablesForBody (aBody:string){
    let variableName:string = '';
    let variableType:string = '';
    let ret: GlobalTypes.iProcedureVariable[] = [];
    let j: number = 0;
    let inCursor:boolean = false;        
    let cursorString:string = '';

    aBody.split(/\r?\n/).forEach(function(line) {
        let txt:string = line.toUpperCase().trim(); 
        j++;
        if (txt.startsWith('DECLARE VARIABLE')) {
            variableName = '';
            variableType = '';
            //reveer esto por tema de cursores
            txt.split(' ').forEach(function(word) {
                if (['DECLARE','VARIABLE'].indexOf(word) === -1) { //si no es
                    if (variableName === '') 
                        variableName = word;
                    else    
                        variableType += word + ' ';
                }         
            });
            //console.log('linea :'+j.toString()+' Name: '+variableName+ ' Type: '+variableType);
            ret.push({var:{name:variableName,type:variableType.substr(0,variableType.length-2)}});                           
        }
        else if ((txt.search(' CURSOR FOR ') > 1) || inCursor) {
            
            if (! inCursor) {
                variableType= 'CURSOR';                    
                variableName= txt.split(' ')[1];
                inCursor= true;
                if (txt.search('SELECT ') !== -1) {
                    cursorString += txt.substring(txt.search('SELECT '));
                }                    
            } else {     
                
                if (txt.endsWith(');')) {
                    cursorString += txt.substr(0,line.trim().length-2);
                    ret.push({var:{name:variableName,type:variableType,cursor:cursorString}});
                    inCursor=false;
                    cursorString='';
                }
                else {
                    cursorString += txt + String.fromCharCode(10);
                }
            }   
        }    
    });    
    return ret;
}

function excludeVariablesForBody (aType:string, aBody:string){
    let variableName:string = '';
    let variableType:string = '';
    let ret:string = '';
    let j: number = 0;        
    aBody.split(/\r?\n/).forEach(function(line) {
        j++;            
        if  (! line.toUpperCase().trim().startsWith('DECLARE VARIABLE')) {
            if (!(aType === 'T'  && line.toUpperCase().trim() === 'AS')) {
                ret += line + String.fromCharCode(10);                             
            }    
        };
    });    
    return ret;
}