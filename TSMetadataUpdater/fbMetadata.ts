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
                                    'CAST(PPA.RDB$DEFAULT_SOURCE AS VARCHAR(3000)) AS FSOURCE, ' +       // DEFAULT
                                    'PPA.RDB$NULL_FLAG  AS FLAG, ' +            // NULLABLE
                                    'CAST(FLD.RDB$DESCRIPTION AS VARCHAR(3000)) AS DESCRIPTION, ' +
                                    'PPA.RDB$PARAMETER_TYPE AS PARAMATER_TYPE ' +        // input / output
                                    'FROM RDB$PROCEDURES PRO ' +
                                    'LEFT OUTER JOIN RDB$PROCEDURE_PARAMETERS PPA ON PPA.RDB$PROCEDURE_NAME = PRO.RDB$PROCEDURE_NAME ' +
                                    'LEFT OUTER JOIN RDB$FIELDS FLD ON FLD.RDB$FIELD_NAME = PPA.RDB$FIELD_SOURCE ' +
                                    'LEFT OUTER JOIN RDB$COLLATIONS COL ON (PPA.RDB$COLLATION_ID = COL.RDB$COLLATION_ID AND FLD.RDB$CHARACTER_SET_ID = COL.RDB$CHARACTER_SET_ID) ' +
                                    'WHERE PRO.RDB$PROCEDURE_NAME=? OR ? IS NULL '+
                                    'ORDER BY PRO.RDB$PROCEDURE_NAME, PPA.RDB$PARAMETER_TYPE, PPA.RDB$PARAMETER_NUMBER';

export async function writeYalm(ahostName:string, aportNumber:number, adatabase:string, adbUser:string, adbPassword:string)  {
    let rProcedures, rParamater;    
    let xProcedure: GlobalTypes.iProcedureYamlType = GlobalTypes.emptyProcedureYamlType;
    let xProcedureParameterInput: GlobalTypes.iProcedureParameter[] = [];
    let xProcedureParameterOutput: GlobalTypes.iProcedureParameter[] = [];
    let j:number = 0;    

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
                
                while ((j< rParamater.length) && (rParamater[j].PROCEDURE_NAME == rProcedures[i].NAME)) {
                    if (rParamater[j].PARAMATER_TYPE == 0) {
                        xProcedureParameterInput.push({name:"",type:""});
                        xProcedureParameterInput[xProcedureParameterInput.length-1].name = rParamater[j].PARAMATER_NAME;
                        xProcedureParameterInput[xProcedureParameterInput.length-1].type = rParamater[j].PARAMATER_TYPE;  
                    }
                    else if (rParamater[j].PARAMATER_TYPE == 1) {
                        xProcedureParameterOutput.push({name:"",type:""});
                        xProcedureParameterOutput[xProcedureParameterOutput.length-1].name = rParamater[j].PARAMATER_NAME;
                        xProcedureParameterOutput[xProcedureParameterOutput.length-1].type = rParamater[j].PARAMATER_TYPE;
                    }           
                    j++;
                }

                xProcedure.procedure.input=xProcedureParameterInput;
                xProcedure.procedure.output=xProcedureParameterOutput;      
               
                xProcedure.procedure.fb.body=rProcedures[i].SOURCE;
                xProcedure.procedure.pg.body=rProcedures[i].SOURCE;

                fs.writeFileSync('./procedures/'+xProcedure.procedure.name+'.yaml',yaml.safeDump(xProcedure, GlobalTypes.yamlExportOptions), GlobalTypes.yamlFileSaveOptions); 
                
                
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

