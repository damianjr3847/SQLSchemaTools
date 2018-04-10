import * as fs                  from 'fs';
import * as fbClass             from './classFirebird';
import * as GlobalTypes         from './globalTypes';
import * as globalFunction      from './globalFunction';
import * as fbExtractMetadata   from './fbExtractMetadata';


export class fbExtractLoadData {
    
    private fb: fbClass.fbConnection;

    filesPath: string = '';
    excludeObject: any;
 
    constructor() {
        this.fb = new fbClass.fbConnection;
    }

    private async outFileScript(aFields:Array<fbExtractMetadata.iFieldType>, aData:Array<any>, aTable:string) {        
        const saveTo:number = 1000;
        let contSaveTo:number = 0;
        let qQuery:string = '';
        let scriptQuery:string = '';
        let blobValue: string = '';
        let y:number = 0;

        if (aData.length>0) {
            for (let i=0; i < aData.length; i++) {
                //process.stdout.write("registros :"+i.toString());
                qQuery='INSERT INTO '+globalFunction.quotedString(aTable)+ '('+globalFunction.arrayToString(aFields,',','AName')+')'+GlobalTypes.CR + ' VALUES(';
                for(let j in aData[i]) {
                    y = aFields.findIndex(aItem => (aItem.AName === globalFunction.quotedString(j)));
                    if (y === -1) 
                        throw new Error(y+'. Field no encontrado');
                    if (aData[i][j] === undefined)
                       y=1;                    
                    qQuery += await globalFunction.varToSql(aData[i][j],aFields[y].AType, aFields[y].ASubType)+',';
                }
                //saco ultima coma
                qQuery = qQuery.substr(0,qQuery.length-1) + ');'+GlobalTypes.CR;
                if (contSaveTo < saveTo) {   
                    scriptQuery += qQuery
                    contSaveTo++;
                }    
                else {
                    fs.appendFileSync(this.filesPath+aTable+'.sql', scriptQuery, 'utf8');
                    contSaveTo=0;
                    scriptQuery='';
                }    
                    
            }
            fs.appendFileSync(this.filesPath+aTable+'.sql', scriptQuery, 'utf8');
            contSaveTo=0;
            scriptQuery='';
        }    
        
    }

    private analyzeQuery(aQuery: string, aObjectName: string, aObjectType:string) {        
        let aRet:string = aQuery;        

        if (aObjectName !== '')
            aRet= aRet.replace('{FILTER_OBJECT}', "WHERE UPPER(TRIM(OBJECT_NAME)) = '" + aObjectName.toUpperCase() + "'")
        
      
        if (aObjectName === GlobalTypes.ArrayobjectType[5]) { //field  COMPUTED_SOURCE campos calculados
            aRet= aRet.replace('SELECT *','SELECT OBJECT_NAME, FIELDNAME, FTYPE, SUBTYPE ');
            aRet= aRet.replace('{RELTYPE}', ' AND (REL.RDB$RELATION_TYPE<>1 OR REL.RDB$RELATION_TYPE IS NULL) AND FLD.RDB$COMPUTED_SOURCE IS NULL');
        }
        else //table RELATION_TYPE teporales 
            aRet= aRet.replace('{RELTYPE}', ' AND (REL.RDB$RELATION_TYPE NOT IN (1,5,4) OR REL.RDB$RELATION_TYPE IS NULL)');

        return aRet;
    }

    public async extractData(ahostName: string, aportNumber: number, adatabase: string, adbUser: string, adbPassword: string, objectName: string) {
        let filesDirSource1:Array<any> = [];
        let rTables:        Array<any> = [];
        let rFields:        Array<any> = [];
        let rData:          Array<any> = [];
        let iField:         fbExtractMetadata.iFieldType = {};
        let qFields:        Array<fbExtractMetadata.iFieldType> = [];
        let query:string = '';

        let j:number = 0;

        this.fb.database    = adatabase;
        this.fb.dbPassword  = adbPassword;
        this.fb.dbUser      = adbUser;
        this.fb.hostName    = ahostName;
        this.fb.portNumber  = aportNumber;

        try {
            if (!(this.filesPath.endsWith('/'))) 
                this.filesPath += '/';

            await this.fb.connect();               

            try {
                await this.fb.startTransaction(true);

                rTables = await this.fb.query(this.analyzeQuery(fbExtractMetadata.queryTablesView, objectName,GlobalTypes.ArrayobjectType[2]), []);
                rFields = await this.fb.query(this.analyzeQuery(fbExtractMetadata.queryTablesViewFields, objectName,GlobalTypes.ArrayobjectType[5]), []);
                
                await this.fb.commit();

                for(let i=0; i < rTables.length; i++){
                    if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[2], rTables[i].OBJECT_NAME)) {
                        j= rFields.findIndex( aItem => (aItem.OBJECT_NAME.trim() === rTables[i].OBJECT_NAME.trim()));
                        qFields= [];
                        if (j !== -1) {
                            while ((j < rFields.length) && (rFields[j].OBJECT_NAME.trim() === rTables[i].OBJECT_NAME.trim())) { 
                                if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[5], rFields[j].FIELDNAME)) {
                                    iField={};
                                    iField.AName= globalFunction.quotedString(rFields[j].FIELDNAME.trim());
                                    iField.AType= rFields[j].FTYPE;
                                    iField.ASubType= rFields[j].SUBTYPE; 
                                    qFields.push(iField);                                    
                                }    
                                j++;
                            }
                            await this.fb.startTransaction(true);
                            
                            query=  'SELECT '+globalFunction.arrayToString(qFields,',','AName')+' FROM '+globalFunction.quotedString(rTables[i].OBJECT_NAME.trim());
                            rData = await this.fb.query(query, []);
                            
                            console.log(i.toString()+'/'+rTables.length.toString()+' - extract '+rTables[i].OBJECT_NAME.trim());
                            
                            await this.outFileScript(qFields,rData,rTables[i].OBJECT_NAME.trim());
                            await this.fb.commit();
                        }
                    }
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


