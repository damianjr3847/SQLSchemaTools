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
import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import * as fbClass from './classFirebird';
import * as GlobalTypes from './globalTypes';


let fb : fbClass.fbConnection;

export async function writeYalm(ahostName:string, aportNumber:number, adatabase:string, adbUser:string, adbPassword:string)  {
    let rProcedures, rParamater;    
    let xProcedure: GlobalTypes.iProcedureYamlType = GlobalTypes.emptyProcedureYamlType;
    let xProcedureParameterInput: GlobalTypes.iProcedureParameter[] = [];
    let xProcedureParameterOutput: GlobalTypes.iProcedureParameter[] = [];
    let xxx:string="";
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

            rProcedures = await fb.query('SELECT first 1 trim(RDB$PROCEDURE_NAME) AS NAME, RDB$PROCEDURE_INPUTS AS INPUTS, RDB$PROCEDURE_OUTPUTS  AS OUTPUTS, RDB$DESCRIPTION AS DESCRIPTION, CAST(RDB$PROCEDURE_SOURCE AS VARCHAR(8000)) AS CONTENIDO FROM RDB$PROCEDURES',[]);
            
            //console.log(rProcedures);
            for (var i=0; i < rProcedures.length; i++){
                
                xProcedure.procedure.name  = rProcedures[i].NAME;
                
                rParamater = await fb.query('select trim(RDB$PARAMETER_NAME) AS NAME, RDB$PARAMETER_TYPE AS XTYPE from RDB$PROCEDURE_PARAMETERS WHERE RDB$PROCEDURE_NAME=? AND RDB$PARAMETER_TYPE=0 ORDER BY RDB$PARAMETER_NUMBER',['XXX_TBL_COMP_NUENUM']);
                
                for (var j=0; j < rParamater.length; j++){
                    xProcedureParameterInput.push({name:"",type:""});
                    xProcedureParameterInput[j].name = rParamater[j].NAME;
                    xProcedureParameterInput[j].type = rParamater[j].XTYPE;
                         
                };
                xProcedure.procedure.input=xProcedureParameterInput;

                rParamater = await fb.query('select trim(RDB$PARAMETER_NAME) AS NAME, RDB$PARAMETER_TYPE AS XTYPE from RDB$PROCEDURE_PARAMETERS WHERE RDB$PROCEDURE_NAME=? AND RDB$PARAMETER_TYPE=1 ORDER BY RDB$PARAMETER_NUMBER',['XXX_TBL_COMP_NUENUM']);
                
                for (var j=0; j < rParamater.length; j++){
                    xProcedureParameterOutput.push({name:"",type:""});
                    xProcedureParameterOutput[j].name = rParamater[j].NAME;
                    xProcedureParameterOutput[j].type = rParamater[j].XTYPE;
                        
                };
               xProcedure.procedure.output=xProcedureParameterOutput);      
               xProcedure.procedure.fb.body=rProcedures[i].CONTENIDO;
               xProcedure.procedure.pg.body=rProcedures[i].CONTENIDO;
            }
            //fs.writeFileSync(yaml.safeDump(xProcedure),'./pepe.yaml');
           // xxx=xProcedure

           console.log(yaml.safeDump(xProcedure, {indent:4,skipInvalid: false,flowLevel: -1,sortKeys:false,lineWidth:80,noRefs: false,noCompatMode: false,condenseFlow: false}));
            

            //console.log(xx.toString);
           /* rProcedures.forEach( function(row){
                console.log( ab2str(row.NAME), ab2str(row.INPUTS));
            });*/      
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

