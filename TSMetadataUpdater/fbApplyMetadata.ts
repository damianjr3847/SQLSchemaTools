import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as fbClass from './classFirebird';
import * as GlobalTypes from './globalTypes';

const charCode:any = String.fromCharCode(10);

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


export class fbApplyMetadata {
    //****************************************************************** */
    //        D E C L A R A C I O N E S    P R I V A D A S
    //******************************************************************* */

    private  fb : fbClass.fbConnection;
    

    private async applyProcedures(files: Array<string>) {
        let paramString = (param:any, aExtra:string) => {
            let aText:string='';

            if (param.length > 0) {
                for (var j=0; j < param.length-1; j++){                    
                    aText += param[j].param.name +' '+ param[j].param.type + ',' + charCode;
                }
                aText += param[j].param.name +' '+ param[j].param.type;
                aText = aExtra + '(' + charCode + aText + ')' + charCode;                        
            };
            return aText;
        };

        let procedureName:string = '';        
        let fileYaml: any;
        let procedureBody: string = '';
        let procedureParams: string = '';
        try {           
            await this.fb.startTransaction(false);
            for (var i in files) {
                
                const fileYaml = yaml.safeLoad(fs.readFileSync(this.filesPath+'/procedures/'+files[i], GlobalTypes.yamlFileSaveOptions.encoding));
                procedureBody= 'CREATE OR ALTER PROCEDURE ' + fileYaml.procedure.name;                
                
                procedureParams= '';                  
                
                if ('inputs' in fileYaml.procedure)
                    procedureBody += paramString(fileYaml.procedure.inputs,'');
                if ('outputs' in fileYaml.procedure)    
                    procedureBody += paramString(fileYaml.procedure.outputs,'RETURNS ');               
                
                procedureBody += charCode + 'AS' + charCode +fileYaml.procedure.body;
                
                await this.fb.execute(procedureBody,[]);

                procedureBody= '';
                
                console.log(('Aplicando procedure '+fileYaml.procedure.name).padEnd(70,'.')+'OK');
            }
            await this.fb.commit();                
        }
        catch (err) {
            console.log('Error grabando procedimiento '+procedureName+'. ', err.message+charCode+procedureBody);
        }  
    }

    private async applyTables(files: Array<string>) {
        let tableName:string = '';

        try {
            await this.fb.startTransaction(true);

            await this.fb.commit();
        } catch(err) {
            console.log('Error generando tabla '+tableName+'.', err.message);   
        }        
        
    }
    
    private async applyTriggers(files: Array<string>) {
        let triggerName:string = '';

        try {
            await this.fb.startTransaction(true);
            await this.fb.commit();
        }
        catch (err) {
            console.log('Error generando trigger '+triggerName+'. ', err.message);
        }      
    }

    private async applyViews(files: Array<string>) {
        let viewName:string = '';

        try {
            await this.fb.startTransaction(true);

            
            await this.fb.commit();
        } catch(err) {
            console.log('Error generando view '+viewName+'.', err.message);   
        } 

    }

    private async applyGenerators(files: Array<string>) {
        let genName:string = '';

    
        try {
            await this.fb.startTransaction(true);
            
            await this.fb.commit();
        }
        catch (err) {
            console.log('Error generando procedimiento '+genName+'. ', err.message);
        }  
    }

    private readDirectory(objectType: string, objectName:string) {
        if (objectName === '') {
            return fs.readdirSync(this.filesPath+'/'+objectType+'/');
        }
        else {
            if (! fs.existsSync(this.filesPath+'/'+objectType+'/'+objectName+'.yaml')) {
                throw 'el archivo '+objectName+', no existe';                            
            }    
            return [objectName+'.yaml'];
        }        
    }
    //****************************************************************** */
    //        D E C L A R A C I O N E S    P U B L I C A S
    //******************************************************************* */
    
    filesPath:string    = '';

    constructor() {
        this.fb = new fbClass.fbConnection;    
    }

    public async applyYalm(ahostName:string, aportNumber:number, adatabase:string, adbUser:string, adbPassword:string, objectType:string, objectName:string)  {                

        this.fb.database     = adatabase;
        this.fb.dbPassword   = adbPassword;
        this.fb.dbUser       = adbUser;
        this.fb.hostName     = ahostName;
        this.fb.portNumber   = aportNumber;
    
        try {
    
            await this.fb.connect();
            try {
                
                if (objectType === 'procedures' || objectType === '') {
                    await this.applyProcedures(this.readDirectory('procedures',objectName));
                }
                if (objectType === 'tables' || objectType === '') {                                                 
                    await this.applyTables(this.readDirectory('tables',objectName));
                }
                if (objectType === 'triggers' || objectType === '') {                                             
                    await this.applyTriggers(this.readDirectory('triggers',objectName));
                }
                if (objectType === 'generators' || objectType === '') {                                              
                    await this.applyGenerators(this.readDirectory('generators',objectName));
                }
                if (objectType === 'views' || objectType === '') {                     
                    await this.applyViews(this.readDirectory('views',objectName));
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
