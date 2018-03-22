import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as fbClass from './classFirebird';
import * as GlobalTypes from './globalTypes';
import * as fbExtractMetadata from './fbExtractMetadata';
import { globalAgent } from 'http';

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

function readDirectory(aPath:string, objectType: string, objectName:string) {
    if (objectName === '') {
        return fs.readdirSync(aPath+'/'+objectType+'/');
    }
    else {
        if (! fs.existsSync(aPath+'/'+objectType+'/'+objectName+'.yaml')) {
            throw 'el archivo '+objectName+', no existe';                            
        }    
        return [objectName+'.yaml'];
    }        
}

export class fbApplyMetadata {   
    private fb : fbClass.fbConnection;
    private fbExMe: fbExtractMetadata.fbExtractMetadata;   

    //****************************************************************** */
    //        P R O C E D U R E S
    //******************************************************************* */
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
            console.log('Error aplicando procedimiento '+procedureName+'. ', err.message+GlobalTypes.charCode+procedureBody);
        }  
    }        

    //****************************************************************** */
    //        T R I G G E R S
    //******************************************************************* */

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
            console.log('Error aplicando trigger '+triggerName+'. ', err.message);
        }      
    }

    //****************************************************************** */
    //        V I E W S
    //******************************************************************* */
    private async applyViews(files: Array<string>) {
        let viewYamltoString = (aYaml:any) => {
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
                
                viewBody= viewYamltoString(fileYaml);     
                if (j !== -1) {
                    viewInDb= viewYamltoString(dbYaml[j]);
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
            console.log('Error aplicando view '+viewName+'.', err.message);   
        } 

    }

    //****************************************************************** */
    //        G E N E R A T O R S
    //******************************************************************* */

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
            console.log('Error aplicando procedimiento '+genName+'. ', err.message);
        }  
    }
   
    //****************************************************************** */
    //        T A B L E S
    //******************************************************************* */
    private async applyTables(files: Array<string>) {
        let tableName:string = '';
        let dbYaml: Array<any> = [];
        let tableScript: string = '';
        let j:number = 0;


        try {
            await this.fb.startTransaction(false);

            dbYaml= await this.fbExMe.extractMetadataTables('',true,false);
            for (let i in files) {               
                const fileYaml = yaml.safeLoad(fs.readFileSync(this.filesPath+'/tables/'+files[i], GlobalTypes.yamlFileSaveOptions.encoding));
                tableName= fileYaml.table.name;
                
                j= dbYaml.findIndex(aItem => (aItem.table.name === tableName));

                if (j === -1) { //NO EXISTE TABLA
                    tableScript= this.newTableYamltoString(fileYaml.table);
                    /*
                    DESCRIPCIONES EN PROC APARTE
                    if (aFileColumnsYaml[j].column.description !== aDbColumnsYaml[i].column.description) {
                    retText += 'COMMENT ON COLUMN '+aTableName + '.' + aFileColumnsYaml[j].column.name +' IS '+aFileColumnsYaml[j].column.description+';'+GlobalTypes.charCode;
                    }
                    */
                }
                else {    
                    tableScript= this.getTableColumnDiferences(tableName,fileYaml.table.columns,dbYaml[j].table.columns)
                }    
            }
            await this.fb.commit();
        } catch(err) {
            console.log('Error aplicando tabla '+tableName+'.', err.message);   
        }        
        
    }

    newTableYamltoString(aYaml:any){ 
        let fieldCreate = (aField:any) => {       
            let retFld:string= '';
            retFld = aField.name + ' ' + aField.type;
            if ('default' in aField) {
                retFld += ' DEFAULT ' + aField.default;   
            }
            if ('computed' in aField) {
                retFld += ' COMPUTED BY ' + aField.computed;
            }
            if ('charset' in aField) {
                retFld += ' CHARACTER SET ' + aField.charset;
            }     
            if (aField.nullable === false) {
                aTable += ' NOT NULL';    
            }    
            return retFld;           
        }   

        let aTable:string = '';

        aTable= 'CREATE TABLE '+ aYaml.name+' ('+GlobalTypes.charCode;
        for (let j=0; j < aYaml.columns.length-1; j++){
            aTable += fieldCreate(aYaml.columns[j].column) + ',' + GlobalTypes.charCode;
        }

        aTable += fieldCreate(aYaml.columns[aYaml.columns.length-1].column) + ',' + GlobalTypes.charCode;
        
        aTable += GlobalTypes.charCode + ')';
        return aTable;
    }  

    getTableColumnDiferences(aTableName:string, aFileColumnsYaml: Array<any>, aDbColumnsYaml: Array<any>) {
        let i:number = 0;
        let retText:string = '';
        let retCmd:string = '';
        let retAux:string = '';
        
        for (let j=0; j < aFileColumnsYaml.length; j++){
            i= aDbColumnsYaml.findIndex(aItem => (aItem.column.name === aFileColumnsYaml[j].column.name));
            
            if (i === -1) { //no existe campo
                retText += 'ALTER TABLE ' + aTableName + ' ADD ' + aFileColumnsYaml[j].column.name + ' ' + aFileColumnsYaml[j].column.type;
                if (aFileColumnsYaml[j].column.nullable === false) {
                    retText += ' NOT NULL;';    
                }
                retText += GlobalTypes.charCode;       
            }
            else { //existe campo                 
                if (aFileColumnsYaml[j].column.type !== aDbColumnsYaml[i].column.type) {
                    retText += 'ALTER TABLE ' + aTableName +' ALTER COLUMN ' +  aFileColumnsYaml[j].column.name + ' TYPE ' + aFileColumnsYaml[j].column.type + ';' + GlobalTypes.charCode;
                }
                if (aFileColumnsYaml[j].column.default !== aDbColumnsYaml[i].column.default) {
                    retAux = 'ALTER TABLE ' + aTableName +' ALTER COLUMN ' +  aFileColumnsYaml[j].column.name + ' SET DEFAULT '+ aFileColumnsYaml[j].column.default+';'+GlobalTypes.charCode;
                }    
                if (aFileColumnsYaml[j].column.nullable !== aDbColumnsYaml[i].column.nullable) {                    
                    retAux = 'ALTER TABLE ' + aTableName +' ALTER COLUMN ' +  aFileColumnsYaml[j].column.name;
                    retCmd = '';

                    if (aFileColumnsYaml[j].column.nullable === false && aDbColumnsYaml[i].column.nullable === true) {
                        retCmd = 'UPDATE '+ aTableName +' SET ' +  aFileColumnsYaml[j].column.name + "='" + aFileColumnsYaml[j].column.nullableToNotNullValue + "' WHERE " + aFileColumnsYaml[j].column.name + ' IS NOT NULL;' + GlobalTypes.charCode; 
                        retAux +=  ' SET NOT NULL;'; //ver con que lo lleno al campo que seteo asi   
                    } 
                    else if (aFileColumnsYaml[j].column.nullable === true && aDbColumnsYaml[i].column.nullable === false) {
                        retAux += ' DROP NOT NULL;';
                    }
                    retText += retCmd + retAux + GlobalTypes.charCode;                    
                }
                if (aFileColumnsYaml[j].column.computed !== aDbColumnsYaml[i].column.computed) {
                    retText += 'ALTER TABLE ' + aTableName +' ALTER COLUMN ' +  aFileColumnsYaml[j].column.name + ' COMPUTED BY ' + aFileColumnsYaml[j].column.computed + ';' + GlobalTypes.charCode;
                }                		
		//present?: boolean
                if (i !== j) { //difiere posicion del campo
                    retText += 'ALTER TABLE ' + aTableName + ' ALTER COLUMN ' + aFileColumnsYaml[j].column.name + ' POSITION ' + (j+1) + ';' + GlobalTypes.charCode;
                }
            }
        }
        return retText;    
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
                    await this.applyProcedures(readDirectory(this.filesPath,'procedures',objectName));
                }
                if (objectType === 'tables' || objectType === '') {                                                 
                    await this.applyTables(readDirectory(this.filesPath,'tables',objectName));
                }
                if (objectType === 'triggers' || objectType === '') {                                             
                    await this.applyTriggers(readDirectory(this.filesPath,'triggers',objectName));
                }
                if (objectType === 'generators' || objectType === '') {                                              
                    await this.applyGenerators(readDirectory(this.filesPath,'generators',objectName));
                }
                if (objectType === 'views' || objectType === '') {                     
                    await this.applyViews(readDirectory(this.filesPath,'views',objectName));
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
