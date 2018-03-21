import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as fbClass from './classFirebird';
import * as GlobalTypes from './globalTypes';
import * as fbExtractMetadata from './fbExtractMetadata';

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

    private fb : fbClass.fbConnection;
    private fbExMe: fbExtractMetadata.fbExtractMetadata;   

    private async applyProcedures(files: Array<string>) {
        let procedureYamltoString = (aYaml: any) => {
            let paramString = (param:any, aExtra:string) => {
                let aText:string='';
    
                if (param.length > 0) {
                    for (let j=0; j < param.length-1; j++){                    
                        aText += param[j].param.name +' '+ param[j].param.type + ',' + GlobalTypes.charCode;
                    }
                    aText += param[j].param.name +' '+ param[j].param.type;
                    aText = aExtra + '(' + GlobalTypes.charCode + aText + ')';                        
                };
                return aText;
            };
    
            let aProc:string= '';
    
            aProc= 'CREATE OR ALTER PROCEDURE ' + aYaml.procedure.name;                                             
                    
            if ('inputs' in aYaml.procedure)
                aProc += paramString(aYaml.procedure.inputs,'');
            if ('outputs' in aYaml.procedure)    
                aProc += paramString(aYaml.procedure.outputs,'RETURNS');               
            
            aProc += GlobalTypes.charCode + 'AS' + GlobalTypes.charCode +aYaml.procedure.body;
            return aProc;        
        }

        let procedureName:string = '';        
        let fileYaml: any;
        let dbYaml: Array<any> = [];
        let procedureBody: string = '';
        let procedureParams: string = '';
        let procedureInDB: any;    
        let j:number = 0;

        

        try {           
            await this.fb.startTransaction(false);

            dbYaml = await this.fbExMe.extractMetadataProcedures('',true,false);
            
            for (let i in files) {
                
                const fileYaml = yaml.safeLoad(fs.readFileSync(this.filesPath+'/procedures/'+files[i], GlobalTypes.yamlFileSaveOptions.encoding));
                
                procedureName= fileYaml.procedure.name;
     
                j= dbYaml.findIndex(aItem => (aItem.procedure.name === procedureName));
                
                procedureBody= procedureYamltoString(fileYaml);
                if (j !== -1) {
                    procedureInDB= procedureYamltoString(dbYaml[j]);
                }    

                if (procedureInDB !== procedureBody) {
                    await this.fb.execute(procedureBody,[]);
                    console.log(('Aplicando procedure '+fileYaml.procedure.name).padEnd(70,'.')+'OK');
                }    

                procedureBody= '';
            }
            await this.fb.commit(); 
            console.log(Date.now());               
        }
        catch (err) {
            console.log('Error grabando procedimiento '+procedureName+'. ', err.message+GlobalTypes.charCode+procedureBody);
        }  
    }        

    private async applyTriggers(files: Array<string>) {
        let triggerYamltoString = (aYaml: any) => {
            let aProc:string= '';
    
            aProc= 'CREATE OR ALTER TRIGGER ' + aYaml.triggerFunction.name+ ' FOR ';                  
                    
            aProc+= aYaml.triggerFunction.triggers[0].trigger.table;
            if (aYaml.triggerFunction.triggers[0].trigger.active) {
                aProc+= ' ACTIVE ';
            }
            else {
                aProc+= ' INACTIVE ';
            }
    
            aProc+= aYaml.triggerFunction.triggers[0].trigger.fires+' ';
            aProc+= aYaml.triggerFunction.triggers[0].trigger.events[0];
            for (let j=1; j < aYaml.triggerFunction.triggers[0].trigger.events.length; j++){
                aProc+= ' OR ' + aYaml.triggerFunction.triggers[0].trigger.events[j];
            };
            aProc+= ' POSITION '+ aYaml.triggerFunction.triggers[0].trigger.position;
    
            aProc += GlobalTypes.charCode +aYaml.triggerFunction.function.body;
            return aProc;        
        };

        let triggerName:string = '';
        let dbYaml: Array<any> = [];
        let fileYaml: any;
        let triggerBody: string = '';        
        let triggerInDb: string = '';        
        let j:number = 0;

        try { 
            await this.fb.startTransaction(false);

            dbYaml = await this.fbExMe.extractMetadataTriggers('',true,false);
            
            for (let i in files) {
                
                const fileYaml = yaml.safeLoad(fs.readFileSync(this.filesPath+'/triggers/'+files[i], GlobalTypes.yamlFileSaveOptions.encoding));
                triggerName= fileYaml.triggerFunction.name;
                
                j= dbYaml.findIndex(aItem => (aItem.triggerFunction.name === triggerName));

                triggerBody= triggerYamltoString(fileYaml);
                if (j !== -1) {
                    triggerInDb= triggerYamltoString(dbYaml[j]);
                }    
                
                if (triggerBody !== triggerInDb) {
                    await this.fb.execute(triggerBody,[]);
                    console.log(('Aplicando trigger '+triggerName).padEnd(70,'.')+'OK');
                }    

                triggerBody= '';
                triggerInDb= '';               
                
            }
            await this.fb.commit();  
        }    
        catch (err) {
            console.log('Error generando trigger '+triggerName+'. ', err.message);
        }      
    }

    private async applyViews(files: Array<string>) {
        let triggerYamltoString = (aYaml:any) => {
            let aView:string = '';
            
            aView= 'CREATE OR ALTER VIEW ' + aYaml.view.name + '(' + GlobalTypes.charCode ;                  
                                
            for (let j=0; j < aYaml.view.columns.length-1; j++){
                aView+= aYaml.view.columns[j]+','+GlobalTypes.charCode;
            };
            aView+= aYaml.view.columns[aYaml.view.columns.length-1]+')'+GlobalTypes.charCode;

            aView += 'AS'+GlobalTypes.charCode +aYaml.view.body;
            
            return aView;
        };

        let dbYaml: Array<any> = [];
        let viewName:string = '';    
        let viewInDb:string = '';
        let j:number = 0;
        let fileYaml: any;
        let viewBody: string = '';        

        try {           
            await this.fb.startTransaction(false);
            dbYaml = await this.fbExMe.extractMetadataViews('',true,false);

            for (let i in files) {               
                const fileYaml = yaml.safeLoad(fs.readFileSync(this.filesPath+'/views/'+files[i], GlobalTypes.yamlFileSaveOptions.encoding));
                viewName= fileYaml.view.name;
                
                j= dbYaml.findIndex(aItem => (aItem.view.name === viewName));
                
                viewBody= triggerYamltoString(fileYaml);     
                if (j !== -1) {
                    viewInDb= triggerYamltoString(dbYaml[j]);
                }    

                if (viewBody !== viewInDb) {
                    await this.fb.execute(viewBody,[]);
                    console.log(('Aplicando view '+viewName).padEnd(70,'.')+'OK');
                }    
                viewBody='';                
                viewInDb='';
            } 
            await this.fb.commit();
        } catch(err) {
            console.log('Error generando view '+viewName+'.', err.message);   
        } 

    }

    private async applyGenerators(files: Array<string>) {
        let genName:string = '';
        let genBody: string = ''; 

        try {
            await this.fb.startTransaction(false);
            for (let i in files) {               
                const fileYaml = yaml.safeLoad(fs.readFileSync(this.filesPath+'/generators/'+files[i], GlobalTypes.yamlFileSaveOptions.encoding));
                genName= fileYaml.generator.name;
                genBody= 'CREATE SEQUENCE ' + fileYaml.generator.name;  
                                    
                if (!(await this.fb.validate('SELECT 1 FROM RDB$GENERATORS WHERE RDB$GENERATOR_NAME=?',[genName]))) {
                    await this.fb.execute(genBody,[]);
                    console.log(('Aplicando Generator '+genName).padEnd(70,'.')+'OK');
                }    
                
            }    
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

    private async applyTables(files: Array<string>) {
        let tableName:string = '';

        try {
            await this.fb.startTransaction(true);

            await this.fb.commit();
        } catch(err) {
            console.log('Error generando tabla '+tableName+'.', err.message);   
        }        
        
    }
    //****************************************************************** */
    //        D E C L A R A C I O N E S    P U B L I C A S
    //******************************************************************* */
    
    filesPath:string    = '';

    constructor() {
        this.fb = new fbClass.fbConnection;
        this.fbExMe= new fbExtractMetadata.fbExtractMetadata(this.fb);    
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
