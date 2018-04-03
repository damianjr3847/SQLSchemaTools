import * as fs from 'fs';

export function includeObject(aObjExclude:any, aType:string, aName:string) {
    var element:string = '';
    var ret:boolean = false;    

    if (aObjExclude == undefined && aType in aObjExclude) {        
        for(var i in aObjExclude[aType]) {
            element= aObjExclude[aType][i];
            if (element.endsWith('*'))
                ret= aName.toUpperCase().startsWith(element.replace('*','').toUpperCase());
            else 
                ret= aName.trim().toUpperCase() === element.trim().toUpperCase();
            
            if (ret) 
                break;
        }
        return !ret;        
    }
    else {
        return !ret;
    }
    
}

export function arrayToString(aArray:Array<any>) {
    let aText:string = '';    
    for (let j=0; j < aArray.length; j++) {
        aText += aArray[j]; 
    } 
    return aText;   
}

export function readRecursiveDirectory(dir:string):Array<any> {
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
