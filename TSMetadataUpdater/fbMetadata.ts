/*
******* E X A M P L E   P R O C E D U R E    Y A M L  *******
procedure:
      name: WEB_QGET
      input:
        - parameter:
          name: QSTRING 
          type: VARCHAR(100)
        - parameter:
          name: PARAME 
          type: VARCHAR(100)
      output:
        - parameter:
          name: VALOR
          type: VARCHAR(100)   
      pg:
        language: plpgsql
        resultType: Table
        options:
          optimization:
            type: STABLE
            returnNullonNullInput: false
          executionCost: 100
          resultRows: 1000
        body: |
          
      fb:
        body: |
*/        
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
     `SELECT  REL.RDB$RELATION_NAME AS NAME, REL.RDB$VIEW_SOURCE AS SOURCE, REL.RDB$DESCRIPTION AS DESCRIPTION
     FROM RDB$RELATIONS REL
     WHERE REL.RDB$SYSTEM_FLAG=0 AND (REL.RDB$RELATION_NAME=? OR ?=CAST('' AS CHAR(31)))
     ORDER BY REL.RDB$RELATION_NAME`;

const queryTablesFieldsView:string =
    `SELECT  
     RFR.RDB$RELATION_NAME AS TABLENAME, RFR.RDB$FIELD_NAME AS FIELDNAME, FLD.RDB$FIELD_TYPE AS FTYPE, 
     FLD.RDB$FIELD_SUB_TYPE AS SUBTYPE, FLD.RDB$CHARACTER_LENGTH AS FLENGTH,
     FLD.RDB$FIELD_PRECISION AS FPRECISION, FLD.RDB$FIELD_SCALE AS SCALE, CHR.RDB$CHARACTER_SET_NAME AS CHARACTERSET,
     COL.RDB$COLLATION_NAME FCOLLATION, 
     RFR.RDB$DEFAULT_SOURCE AS DSOURCE, RFR.RDB$NULL_FLAG AS FLAG, FLD.RDB$VALIDATION_SOURCE AS VSOURCE, 
     FLD.RDB$COMPUTED_SOURCE AS CSOURCE, FLD.RDB$DESCRIPTION AS DESCRIPTION
    FROM RDB$RELATIONS REL
    LEFT OUTER JOIN RDB$RELATION_FIELDS RFR ON RFR.RDB$RELATION_NAME=REL.RDB$RELATION_NAME
    LEFT OUTER JOIN RDB$FIELDS FLD ON FLD.RDB$FIELD_NAME = RFR.RDB$FIELD_SOURCE
    LEFT OUTER JOIN RDB$CHARACTER_SETS CHR ON CHR.RDB$CHARACTER_SET_ID = FLD.RDB$CHARACTER_SET_ID  
    LEFT OUTER JOIN RDB$COLLATIONS COL ON COL.RDB$COLLATION_ID = COALESCE(RFR.RDB$COLLATION_ID, FLD.RDB$COLLATION_ID) AND COL.RDB$CHARACTER_SET_ID = FLD.RDB$CHARACTER_SET_ID
    WHERE REL.RDB$SYSTEM_FLAG=0 AND (REL.RDB$RELATION_NAME=? OR ?=CAST('' AS CHAR(31)))
    ORDER BY RFR.RDB$RELATION_NAME, RFR.RDB$FIELD_POSITION, RFR.RDB$FIELD_NAME`

interface iFieldType {
    AName?:      string  | any;
    AType?:      number  | any,
    ASubType?:   number  | any, 
    ALength?:    number  | any, 
    APrecision?: number  | any, 
    AScale?:     number  | any, 
    ACharSet?:   string  | any, 
    ACollate?:   string  | any, 
    ADefault?:   string  | any, 
    ANotNull?:   boolean | any, 
    AComputed?:  string  | any
};


export class fbExtractMetadata {
    //****************************************************************** */
    //        D E C L A R A C I O N E S    P R I V A D A S
    //******************************************************************* */

    private  fb : fbClass.fbConnection;

    private FieldType(aParam: iFieldType) {
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
      
        if ( ['',null,'NONE'].indexOf(aParam.ACharSet) == -1)
            ft = ft + ' CHARACTER SET '+aParam.ACharSet;
      
        if (aParam.ADefault !== '' && aParam.ADefault !== null)
            ft = ft + ' ' + aParam.ADefault;
      
        if (aParam.AComputed !== '' && aParam.AComputed !== null)
            ft = ft + ' COMPUTED BY '+aParam.AComputed;
      
        if (aParam.ANotNull) 
            ft = ft + ' NOT NULL';
      
        if (aParam.ACollate !== '' && aParam.ACollate !== null)
            ft = ft + ' COLLATE '+aParam.ACollate;
        
        return ft;      
    }  

    private extractProcedureVariables = function(aBody:string){
        let variableName:string = '';
        let variableType:string = '';
        let ret: GlobalTypes.iProcedureParameter[] = [];
        let j: number = 0;        

        aBody.split(/\r?\n/).forEach(function(line) {
            j++;
            if (line.toUpperCase().trim().startsWith('DECLARE VARIABLE')) {
                variableName = '';
                variableType = '';
                //reveer esto por tema de cursores
                line.toUpperCase().trim().split(' ').forEach(function(word) {
                    if (['DECLARE','VARIABLE'].indexOf(word) === -1) { //si no es
                        if (variableName === '') 
                            variableName = word;
                        else    
                            variableType = word.substr(0,word.length-1);
                    }         
                });
                //console.log('linea :'+j.toString()+' Name: '+variableName+ ' Type: '+variableType);
                ret.push({name:variableName,type:variableType});                           
            };
        });    
        return ret;
    }

    private excludeProcedureVariables = function(aBody:string){
        let variableName:string = '';
        let variableType:string = '';
        let ret:string = '';
        let j: number = 0;        
        aBody.split(/\r?\n/).forEach(function(line) {
            j++;
            if  (! line.toUpperCase().trim().startsWith('DECLARE VARIABLE')) {
                ret += line + String.fromCharCode(10);                             
            };
        });    
        return ret;
    }

    private async extractProcedures(objectName:string) {
        let rProcedures: Array<any>;
        let rParamater: Array<any>;
        let outProcedure: GlobalTypes.iProcedureYamlType = GlobalTypes.emptyProcedureYamlType; 
        let outProcedureParameterInput: GlobalTypes.iProcedureParameter[] = [];
        let outProcedureParameterOutput: GlobalTypes.iProcedureParameter[] = [];
        let outProcedureParameterVariable: GlobalTypes.iProcedureParameter[] = [];
        let j: number = 0; 
        let body: string = '';
        let ft: iFieldType = {}; //AName:null, AType:null, ASubType:null, ALength:null, APrecision:null, AScale:null, ACharSet: null, ACollate:null, ADefault:null, ANotNull:null, AComputed:null};   
       
        try {
            await this.fb.startTransaction(true);

            rProcedures = await this.fb.query(queryProcedure,[objectName,objectName]);
            rParamater  = await this.fb.query(queryProcedureParameters,[objectName,objectName]);
                        
            for (var i=0; i < rProcedures.length; i++){
                
                outProcedure.procedure.name  = rProcedures[i].NAME;              

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
                        ft.ADefault     = await this.fb.getBlobAsString(rParamater[j].FSOURCE);
                    else
                        ft.ADefault     = rParamater[j].FSOURCE;
                    ft.ANotNull     = rParamater[j].FLAG
                    ft.AComputed    = null;

                    if (rParamater[j].PARAMATER_TYPE == 0) {
                        outProcedureParameterInput.push({name:"",type:""});
                        outProcedureParameterInput[outProcedureParameterInput.length-1].name = rParamater[j].PARAMATER_NAME;                        
                        outProcedureParameterInput[outProcedureParameterInput.length-1].type = this.FieldType(ft);  
                    }
                    else if (rParamater[j].PARAMATER_TYPE == 1) {
                        outProcedureParameterOutput.push({name:"",type:""});
                        outProcedureParameterOutput[outProcedureParameterOutput.length-1].name = rParamater[j].PARAMATER_NAME;
                        outProcedureParameterOutput[outProcedureParameterOutput.length-1].type = this.FieldType(ft);
                    }           
                    j++;
                }                     
                            
                body = await this.fb.getBlobAsString(rProcedures[i].SOURCE);

                outProcedureParameterVariable= this.extractProcedureVariables(body);
                
                body= this.excludeProcedureVariables(body); 

                outProcedure.procedure.fb.body= body;
                outProcedure.procedure.pg.body= body;

                if (outProcedureParameterInput.length > 0) 
                    outProcedure.procedure.input=outProcedureParameterInput;

                if (outProcedureParameterOutput.length > 0)     
                    outProcedure.procedure.output=outProcedureParameterOutput; 

                if (outProcedureParameterVariable.length > 0) 
                    outProcedure.procedure.variables=outProcedureParameterVariable;

                fs.writeFileSync(this.filesPath+outProcedure.procedure.name+'.yaml',yaml.safeDump(outProcedure, GlobalTypes.yamlExportOptions), GlobalTypes.yamlFileSaveOptions); 
                
                console.log(('generado '+outProcedure.procedure.name+'.yaml').padEnd(50,'.')+'OK');
                outProcedure = GlobalTypes.emptyProcedureYamlType;
                outProcedureParameterInput= [];
                outProcedureParameterOutput= [];
                outProcedureParameterVariable= [];               
            }
            await this.fb.commit();
        }
        catch (err) {
            console.log('Error generando procedimientos: ', err.message);
        }  
    }

    private async extractTables(objectName:string) {
        let rTables: Array<any>;
        let rFields: Array<any>;
        let outTables: GlobalTypes.iTablesYamlType = GlobalTypes.emptyTablesYamlType; 

        let outFields: GlobalTypes.iTablesFieldYamlType[] = [];
        let outFK: GlobalTypes.iTablesFKYamlType[] = [];
        let outCheck: GlobalTypes.iTablesCheckType[] = [];
        let outIndexes: GlobalTypes.iTablesIndexesType[] = [];
    
        let ft: iFieldType = {}; // {AName:null, AType:null, ASubType:null, ALength:null, APrecision:null, AScale:null, ACharSet: null, ACollate:null, ADefault:null, ANotNull:null, AComputed:null};   
       
        try {
            await this.fb.startTransaction(true);

            rTables = await this.fb.query(queryTablesView,[objectName,objectName]);
            rFields  = await this.fb.query(queryTablesFieldsView,[objectName,objectName]);
                        
            for (var i=0; i < rTables.length; i++){
                outTables.table.name= rTables[i].name;
            
            }
            await this.fb.commit();
        } catch(err) {
            console.log('Error generando tablas: ', err.message);   
        }        
        
    }
    
    private async extractTriggers(objectName:string) {
    }

    private async extractGenerators(objectName:string) {
    }

    //****************************************************************** */
    //        D E C L A R A C I O N E S    P U B L I C A S
    //******************************************************************* */
    filesPath:string    = '';

    constructor() {
        this.fb = new fbClass.fbConnection;    
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
                    await this.extractProcedures(objectName);
                }
                if (objectType === 'tables' || objectType === '') {
                    await this.extractTables(objectName);
                }
                if (objectType === 'triggers' || objectType === '') {
                    await this.extractTriggers(objectName);
                }
                if (objectType === 'generator' || objectType === '') {
                    await this.extractGenerators(objectName);
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
    
    public async readYalm() {
    
    }

}
