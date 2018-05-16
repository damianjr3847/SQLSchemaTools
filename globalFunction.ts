import * as fs from 'fs';
import * as fbClass from './classFirebird';
import * as GlobalTypes from './globalTypes';
import * as loadsource from './loadsource';

//esta funcion devuelve falso si el valor de aName esta dentro de los objetos a excluir
//devuelve true si se puede aplicar el cambio
export function includeObject(aObjExclude: any, aType: string, aName: string) {
    var element: string = '';
    var ret: boolean = false;
    if (aObjExclude !== undefined && aType in aObjExclude) {
        for (var i in aObjExclude[aType]) {
            element = aObjExclude[aType][i];
            if (element.endsWith('*'))
                ret = aName.toUpperCase().startsWith(element.replace('*', function (x: string) { return '' }).toUpperCase());
            else
                ret = aName.trim().toUpperCase() === element.trim().toUpperCase();

            if (ret)
                break;
        }
        return !ret;
    }
    else {
        return !ret;
    }
}

export function arrayToString(aArray: Array<any>, aSeparated: string = '', aSubValue: string = '') {
    let aText: string = '';
    for (let j = 0; j < aArray.length - 1; j++) {
        if (aSubValue === '')
            aText += aArray[j] + aSeparated;
        else
            aText += aArray[j][aSubValue] + aSeparated;
    }
    if (aSubValue === '')
        aText += aArray[aArray.length - 1];
    else
        aText += aArray[aArray.length - 1][aSubValue];
    return aText;
}

export function readRecursiveDirectory(dir: string): Array<any> {
    var retArrayFile: Array<any> = [];
    var files: any;
    var fStat: any;
    if (!(dir.endsWith('/') || dir.endsWith('\\')))
        dir += '/';

    files = fs.readdirSync(dir);
    for (var i in files) {
        fStat = fs.statSync(dir + files[i]);
        if (fStat && fStat.isDirectory())
            retArrayFile = retArrayFile.concat(readRecursiveDirectory(dir + files[i]));
        else
            retArrayFile.push({ path: dir, file: files[i], ctime: fStat.ctime, atime: fStat.atime, mtime: fStat.mtime, ctimeMs: fStat.ctimeMs, atimeMs: fStat.atimeMs, mtimeMs: fStat.mtimeMs });
    }
    return retArrayFile;
};


export function varToSql(aValue: any, AType: number, ASubType: number) {
    let ft: string = '';
    let aDate: string = '';

    if (aValue === null)
        ft = 'NULL';
    else {
        switch (AType) {
            case 7: //numericos
            case 8:
            case 16:
            case 10:
            case 27:
                ft = aValue.toString().replace(',', '.');
                break;
            case 37:
            case 14: //varchar-char
                if (aValue === undefined) //manda esto cuando el dato generalmente es vacio
                    ft = "''";
                else
                    ft = "'" + aValue.replace("'", "''") + "'";

                break;
            case 261: //blob
                if (ASubType === 1) {
                    if (aValue === undefined) //manda esto cuando el dato generalmente es vacio
                        ft = "''";
                    else {
                        ft = "'" + aValue.replace("'", "''") + "'";
                    }
                }
                else {
                    ft = "'" + aValue.replace("'", "''") + "'";
                }
                break;
            case 12: //date
                aDate = new Date(aValue).toJSON();
                ft = "'" + aDate.substr(0, aDate.indexOf('T')) + "'";
                break;
            case 13: //time
                aDate = new Date(aValue).toJSON();
                ft = "'" + aDate.substr(aDate.indexOf('T') + 1).replace('Z', '') + "'";
                break;
            case 35: //timestamp 
                aDate = new Date(aValue).toJSON();
                ft = "'" + aDate.replace('T', ' ').replace('Z', '') + "'";
                break;
            default:
                throw new Error(AType + ' tipo de dato no reconocido');
        }
    }
    return ft;
}

export function varToJSON(aValue: any, AType: number, ASubType: number) {
    let ft: any;
    let aDate: string = '';

    if (aValue === null)
        ft = null;
    else {
        switch (AType) {
            case 7:
            case 8:
            case 16:
                if (ASubType == 1) //numeric
                    ft = aValue;
                else if (ASubType == 2) //decimal
                    ft = aValue;
                else if (ASubType == 7) //small
                    ft = { $numberint: aValue };
                else if (ASubType == 8) //int
                    ft = { $numberint: aValue };
                else
                    ft = { $numberlong: aValue };
                break;
            case 10: //float
            case 27: //double precision
                ft = aValue;
                break;
            case 37:
            case 14: //varchar-char
                if (aValue === undefined) //manda esto cuando el dato generalmente es vacio
                    ft = '';
                else
                    ft = aValue.toString('binary');
                break;
            case 261: //blob
                if (ASubType === 1) {
                    if (aValue === undefined) //manda esto cuando el dato generalmente es vacio
                        ft = ''
                    else {
                        ft = aValue.toString('binary');
                    }
                }
                else {
                    ft = { $binary: aValue.toString() };
                }
                break;
            case 12: //date
                aDate = new Date(aValue).toLocaleDateString();
                ft = aDate;
                break;
            case 13: //time 
                aDate = new Date(aValue).toLocaleString();
                ft = aDate.substr(aDate.indexOf(' ') + 1);
                break;
            /*case 12: //date 
            case 13: //time    */
            case 35: //timestamp 
                ft = { $date: new Date(aValue).toJSON() };
                break;
            default:
                throw new Error(AType + ' tipo de dato no reconocido');
        }
    }
    if (ft !== null || String(ft).indexOf('ACEITE') !== -1)
        aValue = aValue;
    return ft;
}
export function quotedString(aValue: string): string {
    let x: boolean = false;
    // x=/[^A-Z_0-9]/.test(aValue);
    // x=/[^A-Z_^a-z_0-9]/.test(aValue);


    if (/[^A-Z_^a-z_0-9]/.test(aValue[0]))
        return '"' + aValue + '"'
    else
        return aValue
}

export function ifThen(aCondition: boolean, aTrue: any, aFalse: any) {
    if (aCondition)
        return aTrue;
    else
        return aFalse;
}

export function outFileScript(aType: string, aScript: Array<any> | string, pathFileScript: string) {
    switch (aType) {
        case GlobalTypes.ArrayobjectType[2]:
            if (aScript.length > 0) {
                fs.appendFileSync(pathFileScript, GlobalTypes.CR, 'utf8');
                for (let i = 0; i < aScript.length; i++) {
                    fs.appendFileSync(pathFileScript, aScript[i] + GlobalTypes.CR, 'utf8');
                }
            }
            break;
        case GlobalTypes.ArrayobjectType[0]:
        case GlobalTypes.ArrayobjectType[1]:
        case GlobalTypes.ArrayobjectType[4]:
            fs.appendFileSync(pathFileScript, GlobalTypes.CR + 'SET TERM ^;' + GlobalTypes.CR, 'utf8');
            fs.appendFileSync(pathFileScript, aScript, 'utf8');
            fs.appendFileSync(pathFileScript, GlobalTypes.CR + 'SET TERM ;^' + GlobalTypes.CR, 'utf8');
            break;
        case GlobalTypes.ArrayobjectType[3]:
            if (aScript instanceof String) {
                fs.appendFileSync(pathFileScript, GlobalTypes.CR, 'utf8');
                fs.appendFileSync(pathFileScript, aScript, 'utf8');
                fs.appendFileSync(pathFileScript, GlobalTypes.CR, 'utf8');
            }
            else {
                for (let i = 0; i < aScript.length; i++) {
                    fs.appendFileSync(pathFileScript, GlobalTypes.CR, 'utf8');
                    fs.appendFileSync(pathFileScript, aScript[i], 'utf8');
                    fs.appendFileSync(pathFileScript, GlobalTypes.CR, 'utf8');
                }
            }
            break;
    }
}

export function isChange(aFileToApply: loadsource.ifile, aOriginalMetadata: Array<any>, aType: string) {
    let j: number = 0;
    let ret: boolean = false;

    if (aOriginalMetadata.length === 0)
        ret = true;
    else {
        j = -1;
        switch (aType) {
            case GlobalTypes.ArrayobjectType[0]: //procedures
                j = aOriginalMetadata.findIndex(aitem => (aitem.contentFile.procedure.name.toLowerCase().trim() === aFileToApply.contentFile.procedure.name.toLowerCase().trim()));
                break;
            case GlobalTypes.ArrayobjectType[1]: //trigger
                j = aOriginalMetadata.findIndex(aitem => (aitem.contentFile.triggerFunction.name.toLowerCase().trim() === aFileToApply.contentFile.triggerFunction.name.toLowerCase().trim()));
                break;
            case GlobalTypes.ArrayobjectType[2]: //tables
                j = aOriginalMetadata.findIndex(aitem => (aitem.contentFile.table.name.toLowerCase().trim() === aFileToApply.contentFile.table.name.toLowerCase().trim()));
                break;
            case GlobalTypes.ArrayobjectType[3]: //generator
                j = aOriginalMetadata.findIndex(aitem => (aitem.contentFile.generator.name.toLowerCase().trim() === aFileToApply.contentFile.generator.name.toLowerCase().trim()));
                break;
            case GlobalTypes.ArrayobjectType[4]: //views
                j = aOriginalMetadata.findIndex(aitem => (aitem.contentFile.view.name.toLowerCase().trim() === aFileToApply.contentFile.view.name.toLowerCase().trim()));
                break;
        }
        if (j === -1)
            ret = true;
        else {  
            if (aFileToApply.ctime > aOriginalMetadata[j].ctime)
                ret = true;
        }
    }

    return ret;
}