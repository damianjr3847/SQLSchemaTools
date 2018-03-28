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


function readRecursiveDirectory(dir:string):Array<any> {
    var retArrayFile:Array<any> = [];
    var files:any;
    var fStat:any;
    if (!(dir.endsWith('/') || dir.endsWith('\\'))) 
        dir+='/';

    files= fs.readdirSync(dir);
    for(var i in files) {
        fStat= fs.statSync(dir+files[i]);    
        if (fStat && fStat.isDirectory())
            retArrayFile= retArrayFile.concat(readRecursiveDirectory(dir+files[i]));
        else
            retArrayFile.push(dir+files[i]);
    }
    return retArrayFile;  
};

export class fbApplyMetadata {   
    private fb : fbClass.fbConnection;
    private fbExMe: fbExtractMetadata.fbExtractMetadata;   
    private tablesArrayYaml: Array<any>      = [];
    private proceduresArrayYaml: Array<any>  = [];
    private triggersArrayYaml: Array<any>    = [];
    private generatorsArrayYaml: Array<any>   = [];
    private viewsArrayYaml: Array<any>       = [];

    public pathFileScript: string   = '';
    public pathSource1: string      = '';
    public pathSource2: string      = '';    

    constructor() {
        this.fb = new fbClass.fbConnection;
        this.fbExMe= new fbExtractMetadata.fbExtractMetadata(this.fb);            
    }

    private readSource(objectType: string, objectName:string) {
        let loadArrayYaml = (dirSource:Array<any>) => {
            let ym:any;
            let j:number = 0;

            for (var i in dirSource) {
                ym= yaml.safeLoad(fs.readFileSync(dirSource[i], GlobalTypes.yamlFileSaveOptions.encoding));            
                if ('table' in ym && (objectType === '' || objectType === 'tables')) { 
                    if (objectName === '' || ym.table.name === objectName) {
                        j= this.tablesArrayYaml.findIndex((aItem) => (String(aItem.table.name).trim().toUpperCase() === String(ym.table.name).trim().toUpperCase()));
                        if (j === -1)
                            this.tablesArrayYaml.push(ym);
                        else 
                            throw new Error('tables: no puede haber objetos duplicados en source1 o source2');
                    }    
                }    
                else if ('procedure' in ym && (objectType === '' || objectType === 'procedures')) {
                    if (objectName === '' || ym.procedure.name === objectName) {
                        j= this.proceduresArrayYaml.findIndex((aItem) => (String(aItem.procedure.name).trim().toUpperCase() === String(ym.procedure.name).trim().toUpperCase()));
                        if (j === -1)
                            this.proceduresArrayYaml.push(ym);
                        else 
                            throw new Error('procedure: no puede haber objetos duplicados en source1 o source2');
                    }        
                }    
                else if ('generator' in ym && (objectType === '' || objectType === 'generators')) {
                    if (objectName === '' || ym.generator.name === objectName) {   
                        j= this.generatorsArrayYaml.findIndex((aItem) => (String(aItem.generator.name).trim().toUpperCase() === String(ym.generator.name).trim().toUpperCase()));
                        if (j === -1)
                            this.generatorsArrayYaml.push(ym);       
                        else 
                            throw new Error('generator: no puede haber objetos duplicados en source1 o source2');
                    }    
                }
                else if ('view' in ym && (objectType === '' || objectType === 'views')) {
                    if (objectName === '' || ym.view.name === objectName) {
                        j= this.viewsArrayYaml.findIndex((aItem) => (String(aItem.view.name).trim().toUpperCase() === String(ym.view.name).trim().toUpperCase()));
                        if (j === -1)
                            this.viewsArrayYaml.push(ym);
                        else
                            throw new Error('view: no puede haber objetos duplicados en source1 o source2');
                    }    
                }
                else if ('triggerFunction' in ym && (objectType === '' || objectType === 'triggers')) {
                    if (objectName === '' || ym.triggerFunction.name === objectName) {
                        j= this.triggersArrayYaml.findIndex((aItem) => (String(aItem.triggerFunction.name).trim().toUpperCase() === String(ym.triggerFunction.name).trim().toUpperCase()));
                        if (j === -1)
                            this.triggersArrayYaml.push(ym);
                        else
                            throw new Error('trigger: no puede haber objetos duplicados en source1 o source2');    
                    }    
                }    
            }
        };     
        let filesDirSource1:Array<any> = [];
        let filesDirSource2:Array<any> = [];        

        this.tablesArrayYaml        = [];
        this.proceduresArrayYaml    = [];
        this.triggersArrayYaml      = [];
        this.generatorsArrayYaml    = [];
        this.viewsArrayYaml         = [];       

        filesDirSource1= readRecursiveDirectory(this.pathSource1);
        loadArrayYaml(filesDirSource1);

        if (this.pathSource2 !== '') {
            filesDirSource2= readRecursiveDirectory(this.pathSource2);
            loadArrayYaml(filesDirSource2);
        }               
    }

    private outFileScript(aType:string, aScript:Array<any> | string) {        
        switch (aType) {
            case 'tables':
                if (aScript.length>0) {
                    fs.appendFileSync(this.pathFileScript, GlobalTypes.CR , 'utf8'); 
                    for (let i=0; i < aScript.length; i++){
                        fs.appendFileSync(this.pathFileScript, aScript[i] + GlobalTypes.CR, 'utf8');
                    }
                }
                break;
            case 'procedures':
            case 'triggers':
            case 'views':
                fs.appendFileSync(this.pathFileScript, GlobalTypes.CR + 'SET TERM ^;' + GlobalTypes.CR, 'utf8');                    
                fs.appendFileSync(this.pathFileScript,  aScript, 'utf8');    
                fs.appendFileSync(this.pathFileScript, GlobalTypes.CR + 'SET TERM ;^' + GlobalTypes.CR, 'utf8');                
                break;
            case 'generators':
                fs.appendFileSync(this.pathFileScript, GlobalTypes.CR , 'utf8'); 
                fs.appendFileSync(this.pathFileScript,  aScript, 'utf8'); 
                break;
        }    
    }

    //****************************************************************** */
    //        P R O C E D U R E S
    //******************************************************************* */
    private async applyProcedures() {
        let procedureYamltoString = (aYaml: any) => {
            let paramString = (param:any, aExtra:string) => {
                let aText:string='';
    
                if (param.length > 0) {
                    for (let j=0; j < param.length-1; j++){                    
                        aText += param[j].param.name +' '+ param[j].param.type + ',' + GlobalTypes.CR;
                    }
                    aText += param[param.length-1].param.name +' '+ param[param.length-1].param.type;
                    aText = aExtra + '(' + GlobalTypes.CR + aText + ')';                        
                };
                return aText;
            };
    
            let aProc:string= '';
    
            aProc= 'CREATE OR ALTER PROCEDURE ' + aYaml.procedure.name;                                             
                    
            if ('inputs' in aYaml.procedure)
                aProc += paramString(aYaml.procedure.inputs,'');
            if ('outputs' in aYaml.procedure)    
                aProc += paramString(aYaml.procedure.outputs,'RETURNS');               
            
            aProc += GlobalTypes.CR + 'AS' + GlobalTypes.CR +aYaml.procedure.body;
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
            
            for (let i in this.proceduresArrayYaml) {
                
                fileYaml = this.proceduresArrayYaml[i];
                
                procedureName= fileYaml.procedure.name;
     
                j= dbYaml.findIndex(aItem => (aItem.procedure.name === procedureName));
                
                procedureBody= procedureYamltoString(fileYaml);
                if (j !== -1) {
                    procedureInDB= procedureYamltoString(dbYaml[j]);
                }    

                if (procedureInDB !== procedureBody) {
                    if (this.pathFileScript === '') {
                        await this.fb.execute(procedureBody,[]);
                        console.log(('Aplicando procedure '+fileYaml.procedure.name).padEnd(70,'.')+'OK');
                    }
                    else 
                        this.outFileScript('procedures',procedureBody);    
                }    

                procedureBody= '';
            }
            await this.fb.commit(); 
            console.log(Date.now());               
        }
        catch (err) {
            console.error('Error aplicando procedimiento '+procedureName+'. ', err.message+GlobalTypes.CR+procedureBody);
        }  
    }        

    //****************************************************************** */
    //        T R I G G E R S
    //******************************************************************* */

    private async applyTriggers() {
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
    
            aProc += GlobalTypes.CR +aYaml.triggerFunction.function.body;
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
            
            for (let i in this.triggersArrayYaml) {
                
                fileYaml = this.triggersArrayYaml[i];

                triggerName= fileYaml.triggerFunction.name;
                
                j= dbYaml.findIndex(aItem => (aItem.triggerFunction.name === triggerName));

                triggerBody= triggerYamltoString(fileYaml);
                if (j !== -1) {
                    triggerInDb= triggerYamltoString(dbYaml[j]);
                }    
                
                if (triggerBody !== triggerInDb) {
                    if (this.pathFileScript === '') {
                        await this.fb.execute(triggerBody,[]);
                        console.log(('Aplicando trigger '+triggerName).padEnd(70,'.')+'OK');
                    }
                    else {
                        this.outFileScript('triggers',triggerBody);
                    }    
                }    

                triggerBody= '';
                triggerInDb= '';               
                
            }
            await this.fb.commit();  
        }    
        catch (err) {
            console.error('Error aplicando trigger '+triggerName+'. ', err.message);
        }      
    }

    //****************************************************************** */
    //        V I E W S
    //******************************************************************* */
    private async applyViews() {
        let viewYamltoString = (aYaml:any) => {
            let aView:string = '';
            
            aView= 'CREATE OR ALTER VIEW ' + aYaml.view.name + '(' + GlobalTypes.CR ;                  
                                
            for (let j=0; j < aYaml.view.columns.length-1; j++){
                aView+= aYaml.view.columns[j]+','+GlobalTypes.CR;
            };
            aView+= aYaml.view.columns[aYaml.view.columns.length-1]+')'+GlobalTypes.CR;

            aView += 'AS'+GlobalTypes.CR +aYaml.view.body;
            
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

            for (let i in this.viewsArrayYaml) {               
                fileYaml = this.viewsArrayYaml[i];
                
                viewName= fileYaml.view.name;
                
                j= dbYaml.findIndex(aItem => (aItem.view.name === viewName));
                
                viewBody= viewYamltoString(fileYaml);     
                if (j !== -1) {
                    viewInDb= viewYamltoString(dbYaml[j]);
                }    

                if (viewBody !== viewInDb) {
                    if (this.pathFileScript === '') {
                        await this.fb.execute(viewBody,[]);
                        console.log(('Aplicando view '+viewName).padEnd(70,'.')+'OK');
                    }
                    else {
                        this.outFileScript('views',viewBody);
                    }    
                }    
                viewBody='';                
                viewInDb='';
            } 
            await this.fb.commit();
        } catch(err) {
            console.error('Error aplicando view '+viewName+'.', err.message);   
        } 

    }

    //****************************************************************** */
    //        G E N E R A T O R S
    //******************************************************************* */

    private async applyGenerators() {
        let genName:string = '';
        let genBody: string = ''; 
        let fileYaml:any;

        try {
            await this.fb.startTransaction(false);
            for (let i in this.generatorsArrayYaml) {               
                fileYaml = this.generatorsArrayYaml[i];
                genName= fileYaml.generator.name;
                genBody= 'CREATE SEQUENCE ' + fileYaml.generator.name;  
                                    
                if (!(await this.fb.validate('SELECT 1 FROM RDB$GENERATORS WHERE RDB$GENERATOR_NAME=?',[genName]))) {
                    if (this.pathFileScript === '') {
                        await this.fb.execute(genBody,[]);
                        console.log(('Aplicando Generator '+genName).padEnd(70,'.')+'OK');
                    }
                    else {
                        this.outFileScript('generators',genBody);
                    }    
                }    
                
            }    
            await this.fb.commit();
        }
        catch (err) {
            console.error('Error aplicando procedimiento '+genName+'. ', err.message);
        }  
    }
   
    //****************************************************************** */
    //        T A B L E S
    //******************************************************************* */
    private async applyTables() {
        let tableName:string = '';
        let dbYaml: Array<any> = [];
        let tableScript: Array<string> = [];
        let j:number = 0;
        let fileYaml: any;    

        try {
            await this.fb.startTransaction(true);

            dbYaml= await this.fbExMe.extractMetadataTables('',true,false);
            
            if (dbYaml === undefined) {
                throw 'no se pudo extraer el metadata de la base';
            }
            await this.fb.commit();

            for (let i in this.tablesArrayYaml) {               
                fileYaml = this.tablesArrayYaml[i];

                tableName= fileYaml.table.name;
                
                j= dbYaml.findIndex(aItem => (aItem.table.name === tableName));
                tableScript= [];

                if (j === -1) { //NO EXISTE TABLA
                    tableScript.push(this.newTableYamltoString(fileYaml.table));                    
                }
                else {    
                    tableScript= tableScript.concat(this.getTableColumnDiferences(tableName,fileYaml.table.columns,dbYaml[j].table.columns));
                    tableScript= tableScript.concat(this.getTableConstraintDiferences(tableName,fileYaml.table.constraint,dbYaml[j].table.constraint));
                    tableScript= tableScript.concat(this.getTableDescriptionDiferences(tableName,fileYaml.table,dbYaml[j].table));
                    tableScript= tableScript.concat(this.getTableIndexesDiferences(tableName,fileYaml.table,dbYaml[j].table));
                }
        
                if (this.pathFileScript === '') {
                    await this.fb.startTransaction(false);
                    for (let i=0; i < tableScript.length; i++){                    
                        await this.fb.execute(tableScript[i],[]);
                        console.log('aplicando cambios en tablas. '+tableScript[i]);
                    }
                    await this.fb.commit();    
                }
                else 
                    this.outFileScript('tables',tableScript);    
            }            

        } catch(err) {
            console.error('Error aplicando tabla '+tableName+'.', err.message);   
        }        
        
    }

    newTableYamltoString(aYaml:any){                 
        let aTable:string = '';
        let aText:string = '';

        aTable= 'CREATE TABLE '+ aYaml.name+' ('+GlobalTypes.CR;
        for (let j=0; j < aYaml.columns.length-1; j++){
            aTable += GlobalTypes.TAB +fieldToSql(aYaml.columns[j].column) + ',' + GlobalTypes.CR;
        }

        aTable += GlobalTypes.TAB +fieldToSql(aYaml.columns[aYaml.columns.length-1].column) + ');' + GlobalTypes.CR;
    
        if ('constraint' in aYaml) {
            if ('foreignkeys' in aYaml.constraint)                 
                aTable += arrayToString(foreignkeysToSql(aYaml.name, aYaml.constraint.foreignkeys));               
            
            if ('checks' in aYaml.constraint)                 
                aTable += arrayToString(checkToSql(aYaml.name, aYaml.constraint.checks));
            
            if ('primaryKey' in aYaml.constraint) 
                aTable += primaryKeyToSql(aYaml.name, aYaml.constraint.primaryKey);   
        }
        if ('indexes' in aYaml) 
            aTable += arrayToString(indexesToSql(aYaml.name, aYaml.indexes));      
        
        if ('description' in aYaml) 
            aTable += "COMMENT ON TABLE "+aYaml.name+" IS '"+aYaml.description+"';"+GlobalTypes.CR;
        
        for (let j=0; j < aYaml.columns.length; j++){
            if ('description' in aYaml.columns[j].column && aYaml.columns[j].column.description !== '')     
                aTable += "COMMENT ON COLUMN "+aYaml.name+"."+aYaml.columns[j].column.name+" IS '"+aYaml.columns[j].column.description+"';"+GlobalTypes.CR;
        }                
        return aTable;
    }  

    getTableColumnDiferences(aTableName:string, aFileColumnsYaml: Array<any>, aDbColumnsYaml: Array<any>):Array<string> {
        let i:number = 0;
        let retText:string = '';
        let retArray: Array<string> = [];
        let retCmd:string = '';
        let retAux:string = '';
        
        for (let j=0; j < aFileColumnsYaml.length; j++){
            i= aDbColumnsYaml.findIndex(aItem => (aItem.column.name === aFileColumnsYaml[j].column.name));
            
            if (i === -1) { //no existe campo
                retArray.push('ALTER TABLE ' + aTableName + ' ADD ' + fieldToSql(aFileColumnsYaml[j].column)+';');
            }
            else { //existe campo 
                if (!("computed" in aFileColumnsYaml[j].column)) {                                 
                    if (aFileColumnsYaml[j].column.type.toUpperCase() !== aDbColumnsYaml[i].column.type.toUpperCase()) {
                        retArray.push('ALTER TABLE ' + aTableName +' ALTER COLUMN ' +  aFileColumnsYaml[j].column.name + ' TYPE ' + aFileColumnsYaml[j].column.type + ';');
                    }
                }    
                if (aFileColumnsYaml[j].column.default !== aDbColumnsYaml[i].column.default) {
                    if (aFileColumnsYaml[j].column.default !== '') 
                        retArray.push('ALTER TABLE ' + aTableName +' ALTER COLUMN ' +  aFileColumnsYaml[j].column.name + ' SET DEFAULT '+ aFileColumnsYaml[j].column.default+';');
                    else
                        retArray.push('ALTER TABLE ' + aTableName +' ALTER COLUMN ' +  aFileColumnsYaml[j].column.name + ' DROP DEFAULT;');     
                }    
                if (aFileColumnsYaml[j].column.nullable !== aDbColumnsYaml[i].column.nullable) {                    
                    retAux = 'ALTER TABLE ' + aTableName +' ALTER COLUMN ' +  aFileColumnsYaml[j].column.name+';';
                    retCmd = '';

                    if (aFileColumnsYaml[j].column.nullable === false && aDbColumnsYaml[i].column.nullable === true) {
                        retCmd = 'UPDATE '+ aTableName +' SET ' +  aFileColumnsYaml[j].column.name + "='" + aFileColumnsYaml[j].column.nullableToNotNullValue + "' WHERE " + aFileColumnsYaml[j].column.name + ' IS NOT NULL;'; 
                        retAux +=  ' SET NOT NULL;'; //ver con que lo lleno al campo que seteo asi   
                    } 
                    else if (aFileColumnsYaml[j].column.nullable === true && aDbColumnsYaml[i].column.nullable === false) {
                        retAux += ' DROP NOT NULL;';
                    }
                    if (retCmd !== '') 
                        retArray.push(retCmd);

                    retArray.push(retAux);
                }                
                if (aFileColumnsYaml[j].column.computed !== aDbColumnsYaml[i].column.computed) {
                    retArray.push('ALTER TABLE ' + aTableName +' ALTER COLUMN ' +  aFileColumnsYaml[j].column.name + ' COMPUTED BY ' + aFileColumnsYaml[j].column.computed + ';');
                }                		
		//present?: boolean
                if (i !== j) { //difiere posicion del campo
                    retArray.push('ALTER TABLE ' + aTableName + ' ALTER COLUMN ' + aFileColumnsYaml[j].column.name + ' POSITION ' + (j+1) + ';');
                }
            }
        }
        return retArray;    
    }

    getTableConstraintDiferences(aTableName:string, aFileConstraintYaml: any, aDbConstraintYaml: any):Array<string> {
        let retArray: Array<string> = [];
        let iDB:number=0;
        let pkDB:string = '';
        let pkFY:string = '';
        let arrayAux:Array<any> = [];


        if ('foreignkeys' in aFileConstraintYaml) {
            arrayAux= aDbConstraintYaml.foreignkeys;
            for (let j=0; j < aFileConstraintYaml.foreignkeys.length; j++) {    
                iDB= arrayAux.findIndex(aItem => (aItem.foreignkey.name === aFileConstraintYaml.foreignkeys[j].foreignkey.name));
                if (iDB === -1) 
                    retArray.push(arrayToString(foreignkeysToSql(aTableName, Array(aFileConstraintYaml.foreignkeys[j]))));
                else { /* || or && and*/
                    if (String(aFileConstraintYaml.foreignkeys[j].foreignkey.onColumn).trim().toUpperCase()   !== String(aDbConstraintYaml.foreignkeys[iDB].foreignkey.onColumn).trim().toUpperCase()   ||
                        String(aFileConstraintYaml.foreignkeys[j].foreignkey.toTable).trim().toUpperCase()    !== String(aDbConstraintYaml.foreignkeys[iDB].foreignkey.toTable).trim().toUpperCase()    ||
                        String(aFileConstraintYaml.foreignkeys[j].foreignkey.toColumn).trim().toUpperCase()   !== String(aDbConstraintYaml.foreignkeys[iDB].foreignkey.toColumn).trim().toUpperCase()   ||
                        String(aFileConstraintYaml.foreignkeys[j].foreignkey.updateRole).trim().toUpperCase() !== String(aDbConstraintYaml.foreignkeys[iDB].foreignkey.updateRole).trim().toUpperCase() || 
                        String(aFileConstraintYaml.foreignkeys[j].foreignkey.deleteRole).trim().toUpperCase() !== String(aDbConstraintYaml.foreignkeys[iDB].foreignkey.deleteRole).trim().toUpperCase()) {
                        
                            retArray.push('ALTER TABLE '+aTableName+' DROP CONSTRAINT '+aFileConstraintYaml.foreignkeys[j].foreignkey.name+';'+GlobalTypes.CR);
                            retArray.push(arrayToString(foreignkeysToSql(aTableName, Array(aFileConstraintYaml.foreignkeys[j]))));
                    }
                }
            }    
        }    

        if ('checks' in aFileConstraintYaml) { 
            arrayAux=aDbConstraintYaml.checks;
            for (let j=0; j < aFileConstraintYaml.checks.length; j++) {    
                iDB= arrayAux.findIndex(aItem => (aItem.check.name === aFileConstraintYaml.checks[j].check.name));
                if (iDB === -1) 
                    retArray.push(arrayToString(checkToSql(aTableName, Array(aFileConstraintYaml.checks[j]))));
                else { /* || or && and*/
                    if (String(aFileConstraintYaml.checks[j].expresion).trim().toUpperCase() !== String(aDbConstraintYaml.checks[iDB].expresion).trim().toUpperCase()) {                        
                            retArray.push('ALTER TABLE '+aTableName+' DROP CONSTRAINT '+aFileConstraintYaml[j].foreignkey.name+';'+GlobalTypes.CR);
                            retArray.push(arrayToString(checkToSql(aTableName, Array(aFileConstraintYaml.foreignkeys[j]))));
                    }
                }
            }                           
        }

        if ('primaryKey' in aFileConstraintYaml) {
            pkFY=primaryKeyToSql(aTableName, aFileConstraintYaml.primaryKey); 
            pkDB=primaryKeyToSql(aTableName, aDbConstraintYaml.primaryKey); 
            if (pkFY.trim().toUpperCase() !== pkDB.trim().toUpperCase()) {
                if (pkDB !== '') 
                    retArray.push('ALTER TABLE '+aTableName+' DROP CONSTRAINT '+aDbConstraintYaml.primaryKey.name);
                        
                retArray.push(pkFY);
            }    
        }            

        return retArray;
    } 
    
    getTableIndexesDiferences(aTableName:string, aFileIdxYaml: any, aDbIdxYaml: any):Array<string> {
        let retArray: Array<string> = [];
        let iDB:number = 0;
        let arrayAux: Array<any> = [];
        let idxYL:string = '';
        let idxDB:string = '';

        if ('indexes' in aFileIdxYaml) { 
            arrayAux= aDbIdxYaml.indexes;    
            for (let j=0; j < aFileIdxYaml.indexes.length; j++){
                iDB= arrayAux.findIndex(aItem => (aItem.index.name === aFileIdxYaml.indexes[j].index.name));
                idxYL=indexesToSql(aTableName, Array(aFileIdxYaml.indexes[j]))[0]; 
                if (iDB === -1) 
                    retArray.push(idxYL);
                else {
                    idxDB=indexesToSql(aTableName, Array(aDbIdxYaml.indexes[iDB]))[0];   
                    if (idxDB.trim().toUpperCase() !== idxYL.trim().toUpperCase()) {
                        retArray.push('DROP INDEX '+aFileIdxYaml.indexes[j].index.name+';'+GlobalTypes.CR); 
                        retArray.push(idxYL);    
                    }    
                }
            }
        }        
        return retArray;
    }

    getTableDescriptionDiferences(aTableName:string, aFileYaml: any, aDbYaml: any):Array<string> {
        let setDescription=(aFY:any, aDB:any, aStartQuery:string):string => {
            let aText:string = ''; 
            if ('description' in aFY) {
                if ('description' in aDB) {
                    if (aFY.description !== aDB.description) 
                    aText = 'COMMENT ON '+aStartQuery+" IS '"+aFY.description+"';"+GlobalTypes.CR;
                }
                else
                    aText = 'COMMENT ON '+aStartQuery+" IS '"+aFY.description+"';"+GlobalTypes.CR; 
            }
            else if ('description' in aDB)
                aText = 'COMMENT ON '+aStartQuery+" IS NULL;"+GlobalTypes.CR;
            
            return aText;    
        }

        let retArray: Array<string> = [];
        let iDB:number=0;
        let arrayAux:Array<any> = [];

        if (setDescription(aFileYaml,aDbYaml,'TABLE '+aTableName) !== '')
            retArray.push(setDescription(aFileYaml,aDbYaml,'TABLE '+aTableName));

        arrayAux= aDbYaml.columns;

        for (let j=0; j < aFileYaml.columns.length; j++){
            iDB= arrayAux.findIndex(aItem => (aItem.column.name === aFileYaml.columns[j].column.name));
            if (iDB !== -1 && setDescription(aFileYaml.columns[j].column,aDbYaml.columns[iDB].column,'COLUMN '+aTableName+'.'+aFileYaml.columns[j].column.name) !== '') 
                retArray.push(setDescription(aFileYaml.columns[j].column,aDbYaml.columns[iDB].column,'COLUMN '+aTableName+'.'+aFileYaml.columns[j].column.name));
        }

        return retArray;
    }    

    //****************************************************************** */
    //        D E C L A R A C I O N E S    P U B L I C A S
    //******************************************************************* */

    public async applyYalm(ahostName:string, aportNumber:number, adatabase:string, adbUser:string, adbPassword:string, objectType:string, objectName:string)  {                

        this.fb.database     = adatabase;
        this.fb.dbPassword   = adbPassword;
        this.fb.dbUser       = adbUser;
        this.fb.hostName     = ahostName;
        this.fb.portNumber   = aportNumber;
    
        try {
    
            await this.fb.connect();
            try {
                this.readSource(objectType,objectName);
                if (objectType === '' || objectType === 'generators')
                    await this.applyGenerators();
                if (objectType === '' || objectType === 'tables')
                    await this.applyTables();
                if (objectType === '' || objectType === 'views')    
                    await this.applyViews();
                if (objectType === '' || objectType === 'triggers')
                    await this.applyTriggers();
                if (objectType === '' || objectType === 'procedures')
                    await this.applyProcedures();
                
               
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


function fieldToSql(aField:any) {
    let retFld:string = '';

    retFld = aField.name + ' ' ;
    if ('computed' in aField) {
        retFld += ' COMPUTED BY ' + aField.computed;
    }
    else {
        retFld += aField.type;
        if ('default' in aField) {
            if (!String(aField.default).toUpperCase().startsWith('DEFAULT')) 
                retFld += ' DEFAULT ' + aField.default;
            else 
                retFld += ' ' + aField.default;    
        }                
        if ('charset' in aField) {
            retFld += ' CHARACTER SET ' + aField.charset;
        }     
        if (aField.nullable === false) {
            retFld += ' NOT NULL';    
        }
    }
    return retFld;        
}

function foreignkeysToSql(aTableName:string, aForeinKey:any):Array<string> {
    //name,onColumn,toTable,toColumn,updateRole,deleteRole
    //ALTER TABLE ART_ARCH ADD CONSTRAINT FK_ART_ARCH_CUECOM FOREIGN KEY (FCUECOM) REFERENCES CON_CUEN (FCUENTA) ON UPDATE CASCADE;
    let aRet: Array<string> = [];
    let aText: string = '';
    
    for (let j=0; j < aForeinKey.length; j++) {
        aText ='ALTER TABLE '+aTableName+' ADD CONSTRAINT '+aForeinKey[j].foreignkey.name+ ' FOREIGN KEY ('+aForeinKey[j].foreignkey.onColumn+') REFERENCES '+aForeinKey[j].foreignkey.toTable+' ('+aForeinKey[j].foreignkey.toColumn+')';
        if ('updateRole' in aForeinKey[j].foreignkey) {
            aText += ' ON UPDATE '+aForeinKey[j].foreignkey.updateRole+';'+GlobalTypes.CR
        }
        if ('deleteRole' in aForeinKey[j].foreignkey) {
            aText += ' ON DELETE '+aForeinKey[j].foreignkey.deleteRole+';'+GlobalTypes.CR    
        }
        aRet.push(aText);
    }
    return aRet;
}

function checkToSql(aTableName:string, aCheck:any):Array<string> {
    //name, expresion
    //ALTER TABLE ART_ARCH ADD CONSTRAINT ART_ARCH_UXD CHECK (FUXD>0);
    let aRet: Array<string> = [];
    let aText: string = '';            
    for (let j=0; j < aCheck.length; j++) {
        aText = 'ALTER TABLE '+aTableName+' ADD CONSTRAINT '+aCheck[j].check.name;
        if (aCheck[j].check.expresion.trim().toUpperCase().startsWith('CHECK')) {
            aText += ' '+aCheck[j].check.expresion.trim()+';'+GlobalTypes.CR;  
        }
        else {
            aText += ' CHECK '+aCheck[j].check.expresion.trim()+';'+GlobalTypes.CR;
        }
        aRet.push(aText);   
    } 
    return aRet;                  
}

function primaryKeyToSql(aTableName:string, aPk:any):string {
    //ALTER TABLE ART_ARCH ADD CONSTRAINT ART_ARCH_PK PRIMARY KEY (FCODINT);    
    let aText: string = '';
    aText += 'ALTER TABLE '+aTableName+' ADD CONSTRAINT '+aPk.name+' PRIMARY KEY (';                
    for (let j=0; j < aPk.columns.length-1; j++) {
        aText += aPk.columns[j] + ',';
    }
    aText += aPk.columns[aPk.columns.length-1] + ');'+GlobalTypes.CR;    
    return aText;   
}    

function indexesToSql(aTableName:string, aIdx:any):Array<string> {
    //active,computedBy,columns,name,unique,descending
    //CREATE UNIQUE INDEX ART_ARCH_CODIGO ON ART_ARCH (FCODIGO);
    //CREATE INDEX ART_ARCH_CODMAD ON ART_ARCH (FCODMAD);
    //CREATE INDEX ART_ARCH_IDX2 ON ART_ARCH COMPUTED BY (TRIM(FCODIGO))
    let aRet: Array<string> = [];
    let aText: string = '';  
    for (let j=0; j < aIdx.length; j++) {
        aText='';
        if (aIdx[j].index.unique == true) 
            aText = ' UNIQUE ';
        if (aIdx[j].index.descending == true) 
            aText = ' DESCENDING ';                                    
        if ('computedBy' in aIdx[j].index) 
            aText = 'CREATE '+ aText +' INDEX '+aIdx[j].index.name+ ' ON '+aTableName+' COMPUTED BY ('+aIdx[j].index.computedBy+')';
        else {
            aText = 'CREATE '+ aText +' INDEX '+aIdx[j].index.name+ ' ON '+aTableName+'(';
            for (let i=0; i < aIdx[j].index.columns.length-1; i++) {
                aText+= aIdx[j].index.columns[i]+',';
            }                    
            aText+= aIdx[j].index.columns[aIdx[j].index.columns.length-1]+')'
        }
        aRet.push(aText+';'+GlobalTypes.CR);   
    } 
    return aRet;
}            
function arrayToString(aArray:Array<any>) {
    let aText:string = '';    
    for (let j=0; j < aArray.length; j++) {
        aText += aArray[j]; 
    } 
    return aText;   
}