import * as fs                  from 'fs';
import * as fbClass             from './classFirebird';
import * as GlobalTypes         from './globalTypes';
import * as globalFunction      from './globalFunction';
import * as fbExtractMetadata   from './fbExtractMetadata';

function  outFileScript(aFields:Array<fbExtractMetadata.iFieldType>, aData:Array<any>, aTable:string, filesPath:string, fb:any) {        
    const saveTo:number = 6000;
    const insertQuery:string = 'INSERT INTO '+globalFunction.quotedString(aTable)+ '('+globalFunction.arrayToString(aFields,',','AName')+')'+GlobalTypes.CR + ' VALUES(';
    
    let contSaveTo:number = 0;
    let qQuery:string = '';
    let scriptQuery:string = '';
    let blobValue: string = '';
    let y:number = 0;

    if (aData.length>0) {
        for (let i=0; i < aData.length; i++) {
            //process.stdout.write("registros :"+i.toString());
            qQuery= insertQuery;            
            for(let j in aData[i]) {
                y = aFields.findIndex(aItem => (aItem.AName === globalFunction.quotedString(j)));
                if (y === -1) 
                    throw new Error(y+'. Field no encontrado');
                /*if (aData[i][j] === undefined)
                   y=1;*/                    
                qQuery += globalFunction.varToSql(aData[i][j],aFields[y].AType, aFields[y].ASubType, fb)+',';
            }
            //saco ultima coma
            qQuery = qQuery.substr(0,qQuery.length-1) + ');'+GlobalTypes.CR;
            if (contSaveTo < saveTo) {   
                scriptQuery += qQuery
                contSaveTo++;
            }    
            else {
                fs.appendFileSync(filesPath+aTable+'.sql', scriptQuery, 'utf8');
                contSaveTo=0;
                scriptQuery='';
            }    
                
        }
        fs.appendFileSync(filesPath+aTable+'.sql', scriptQuery, 'utf8');
        contSaveTo=0;
        scriptQuery='';
    }    
    
}

export class fbExtractLoadData {
    
    public fb: fbClass.fbConnection;

    filesPath: string = '';
    excludeObject: any;
 
    constructor() {
        this.fb = new fbClass.fbConnection;
    }

    private analyzeQuery(aQuery: string, aObjectName: string, aObjectType:string) {        
        let aRet:string = aQuery;        

        if (aObjectName !== '')
            aRet= aRet.replace('{FILTER_OBJECT}', "WHERE UPPER(TRIM(OBJECT_NAME)) = '" + aObjectName.toUpperCase() + "'");
        else
            aRet= aRet.replace('{FILTER_OBJECT}', '');

        if (aObjectType === GlobalTypes.ArrayobjectType[5]) { //field  COMPUTED_SOURCE campos calculados
            aRet= aRet.replace('SELECT *','SELECT OBJECT_NAME, FIELDNAME, FTYPE, SUBTYPE ');
            aRet= aRet.replace('{RELTYPE}', ' AND (REL.RDB$RELATION_TYPE<>1 OR REL.RDB$RELATION_TYPE IS NULL) AND FLD.RDB$COMPUTED_SOURCE IS NULL');
        }
        else //table RELATION_TYPE teporales 
            aRet= aRet.replace('{RELTYPE}', ' AND (REL.RDB$RELATION_TYPE NOT IN (1,5,4) OR REL.RDB$RELATION_TYPE IS NULL)');

        return aRet;
    }

    public async extractData(ahostName: string, aportNumber: number, adatabase: string, adbUser: string, adbPassword: string, objectName: string) {
        let filepath:string = this.filesPath; //para poder llamarlo en el callback
        let fb:any = this.fb;

        let tableName:string = '';
        let filesDirSource1:Array<any> = [];
        let rTables:        Array<any> = [];
        let rFields:        Array<any> = [];
        let rData:          Array<any> = [];
        let iField:         fbExtractMetadata.iFieldType = {};
        let qFields:        Array<fbExtractMetadata.iFieldType> = [];
        let query:string = '';
        let xCont:number = 0;
        let xContGral:number = 0;
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
                        tableName= rTables[i].OBJECT_NAME.trim();

                        if (fs.existsSync(this.filesPath+tableName+'.sql')) {
                            fs.unlinkSync(this.filesPath+tableName+'.sql');
                        }

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
                            rData=[];
                            xCont=0;
                            xContGral=0;
                            console.log(i.toString()+'/'+rTables.length.toString()+' - extract '+tableName);

                            await this.fb.sequentially(query, [], async function(row:any, index:any) {                                
                                
                                rData.push(row);
                                
                                xCont++;
                                //console.log(xCont.toString());
                                if (xCont >= 5000) {
                                    outFileScript(qFields,rData,tableName, filepath, fb);
                                    xContGral += xCont;
                                    console.log('   Registros: '+xContGral.toString());
                                    rData=[];
                                    xCont=0;
                                }
                            });
                            xContGral += xCont; 
                            console.log('   Registros: '+xContGral.toString());                           
                            outFileScript(qFields,rData,tableName, filepath, fb);                            
                            
                            
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


