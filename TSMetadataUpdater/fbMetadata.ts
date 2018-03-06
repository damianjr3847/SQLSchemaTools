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


let fb : fbClass.fbConnection;
const queryProcedure:string = 'SELECT TRIM(RDB$PROCEDURE_NAME) AS NAME, '+
                              'RDB$PROCEDURE_SOURCE AS SOURCE, '+
                              'RDB$DESCRIPTION AS DESCRIPTION ' +
                              'FROM RDB$PROCEDURES ' +
                              'WHERE RDB$SYSTEM_FLAG=0 AND (RDB$PROCEDURE_NAME=? OR ? IS NULL) '+
                              'ORDER BY RDB$PROCEDURE_NAME';

const queryProcedureParameters:string = 'SELECT ' +
                                    'TRIM(PPA.RDB$PROCEDURE_NAME) AS PROCEDURE_NAME, ' +
                                    'TRIM(PPA.RDB$PARAMETER_NAME) AS PARAMATER_NAME, ' +
                                    'FLD.RDB$FIELD_TYPE AS FTYPE, ' +
                                    'FLD.RDB$FIELD_SUB_TYPE AS FSUB_TYPE, ' +
                                    'FLD.RDB$FIELD_LENGTH AS FLENGTH, ' +
                                    'FLD.RDB$FIELD_PRECISION AS FPRECISION, ' +
                                    'FLD.RDB$FIELD_SCALE AS FSCALE, ' +
                                    'TRIM(COL.RDB$COLLATION_NAME) AS FCOLLATION_NAME, ' +       // COLLATE
                                    'PPA.RDB$DEFAULT_SOURCE AS FSOURCE, ' +       // DEFAULT
                                    'PPA.RDB$NULL_FLAG  AS FLAG, ' +            // NULLABLE
                                    'FLD.RDB$DESCRIPTION AS DESCRIPTION, ' +
                                    'PPA.RDB$PARAMETER_TYPE AS PARAMATER_TYPE ' +        // input / output
                                    'FROM RDB$PROCEDURE_PARAMETERS PPA ' +
                                    'LEFT OUTER JOIN RDB$FIELDS FLD ON FLD.RDB$FIELD_NAME = PPA.RDB$FIELD_SOURCE ' +
                                    'LEFT OUTER JOIN RDB$COLLATIONS COL ON (PPA.RDB$COLLATION_ID = COL.RDB$COLLATION_ID AND FLD.RDB$CHARACTER_SET_ID = COL.RDB$CHARACTER_SET_ID) ' +
                                    'WHERE PPA.RDB$PROCEDURE_NAME=? OR ? IS NULL '+
                                    'ORDER BY PPA.RDB$PROCEDURE_NAME, PPA.RDB$PARAMETER_TYPE, PPA.RDB$PARAMETER_NUMBER';

interface iFieldType {
    AName:      string  | any;
    AType:      number  | any,
    ASubType:   number  | any, 
    ALength:    number  | any, 
    APrecision: number  | any, 
    AScale:     number  | any, 
    ACharSet:   string  | any, 
    ACollate:   string  | any, 
    ADefault:   string  | any, 
    ANotNull:   boolean | any, 
    AComputed:  string  | any
};

export async function writeYalm(ahostName:string, aportNumber:number, adatabase:string, adbUser:string, adbPassword:string)  {
    let rProcedures: Array<any>;
    let rParamater: Array<any>;
    let xProcedure: GlobalTypes.iProcedureYamlType = GlobalTypes.emptyProcedureYamlType;
    let xProcedureParameterInput: GlobalTypes.iProcedureParameter[] = [];
    let xProcedureParameterOutput: GlobalTypes.iProcedureParameter[] = [];
    let j:number = 0; 
    let body: string = '';
    let ft: iFieldType = {AName:null, AType:null, ASubType:null, ALength:null, APrecision:null, AScale:null, ACharSet: null, ACollate:null, ADefault:null, ANotNull:null, AComputed:null};   

    fb = new fbClass.fbConnection();    

    fb.database = adatabase;
    fb.dbPassword = adbPassword;
    fb.dbUser = adbUser;
    fb.hostName = ahostName;
    fb.portNumber = aportNumber;

    try {

        await fb.connect();
        try {
            await fb.startTransaction(true);        
            rProcedures = await fb.query(queryProcedure,[null,null]);
            rParamater = await fb.query(queryProcedureParameters,[null,null]);
                        
            for (var i=0; i < rProcedures.length; i++){
                
                xProcedure.procedure.name  = rProcedures[i].NAME;              
                
                if (rProcedures[i].NAME=='REP_CONSOLIDA_FACTS')
                    console.log('xx');

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
                        ft.ADefault     = await fb.getBlobAsString(rParamater[j].FSOURCE);
                    else
                        ft.ADefault     = rParamater[j].FSOURCE;
                    ft.ANotNull     = rParamater[j].FLAG
                    ft.AComputed    = null;

                    if (rParamater[j].PARAMATER_TYPE == 0) {
                        xProcedureParameterInput.push({name:"",type:""});
                        xProcedureParameterInput[xProcedureParameterInput.length-1].name = rParamater[j].PARAMATER_NAME;                        
                        xProcedureParameterInput[xProcedureParameterInput.length-1].type = FieldType(ft);  
                    }
                    else if (rParamater[j].PARAMATER_TYPE == 1) {
                        xProcedureParameterOutput.push({name:"",type:""});
                        xProcedureParameterOutput[xProcedureParameterOutput.length-1].name = rParamater[j].PARAMATER_NAME;
                        xProcedureParameterOutput[xProcedureParameterOutput.length-1].type = FieldType(ft);
                    }           
                    j++;
                }

                xProcedure.procedure.input=xProcedureParameterInput;
                xProcedure.procedure.output=xProcedureParameterOutput;      
                            
                body = await fb.getBlobAsString(rProcedures[i].SOURCE);

                xProcedure.procedure.fb.body= body;
                xProcedure.procedure.pg.body= body;

                
                fs.writeFileSync('./procedures/'+xProcedure.procedure.name+'.yaml',yaml.safeDump(xProcedure, GlobalTypes.yamlExportOptions), GlobalTypes.yamlFileSaveOptions); 
                
                console.log('generado '+xProcedure.procedure.name+'.yaml......... ok');
                xProcedure = GlobalTypes.emptyProcedureYamlType;
                xProcedureParameterInput= [];
                xProcedureParameterOutput= [];
            }                       
            
           await fb.commit();
        }
        finally {
            await fb.disconnect();
        }
    }
    catch (err) {
        console.log('Error: ', err.message);
    }

}

export function readYalm() {

}


const FieldType=function (aParam: iFieldType) {
    let ft:string = '';

    switch (aParam.AType) {
        case 7:
        case 8:
        case 16: 
            if (aParam.ASubType == 1)  
                ft = 'NUMERIC('+aParam.APrecision+','+(-aParam.AScale)+')'
            else if (aParam.ASubType == 2) 
                ft = 'DECIMAL('+aParam.APrecision+','+(-aParam.AScale)+')'
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
            ft = 'CHAR('+aParam.ALength+')';
            break;
        case 27: 
            ft = 'DOUBLE PRECISION';
            break;
        case 35: 
            ft = 'TIMESTAMP';
            break;
        case 37: 
            ft = 'VARCHAR('+aParam.ALength+')';
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
