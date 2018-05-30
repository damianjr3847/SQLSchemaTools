"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const GlobalTypes = require("./globalTypes");
//esta funcion devuelve falso si el valor de aName esta dentro de los objetos a excluir
//devuelve true si se puede aplicar el cambio
function includeObject(aObjExclude, aType, aName) {
    var element = '';
    var ret = false;
    if (aObjExclude !== undefined && aType in aObjExclude) {
        for (var i in aObjExclude[aType]) {
            element = aObjExclude[aType][i];
            if (element.endsWith('*'))
                ret = aName.toUpperCase().startsWith(element.replace('*', function (x) { return ''; }).toUpperCase());
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
exports.includeObject = includeObject;
function arrayToString(aArray, aSeparated = '', aSubValue = '') {
    let aText = '';
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
exports.arrayToString = arrayToString;
function readRecursiveDirectory(dir, aExtension = '') {
    var retArrayFile = [];
    var files;
    var fStat;
    if (!(dir.endsWith('/') || dir.endsWith('\\')))
        dir += '/';
    files = fs.readdirSync(dir);
    for (var i in files) {
        fStat = fs.statSync(dir + files[i]);
        if (fStat && fStat.isDirectory())
            retArrayFile = retArrayFile.concat(readRecursiveDirectory(dir + files[i], aExtension));
        else {
            if (aExtension === '' || String(files[i]).endsWith(aExtension))
                retArrayFile.push({ path: dir, file: files[i], ctime: fStat.ctime, atime: fStat.atime, mtime: fStat.mtime, ctimeMs: fStat.ctimeMs, atimeMs: fStat.atimeMs, mtimeMs: fStat.mtimeMs });
        }
    }
    return retArrayFile;
}
exports.readRecursiveDirectory = readRecursiveDirectory;
;
function varToSql(aValue, AType, ASubType) {
    let ft = '';
    let aDate = '';
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
            case 14://varchar-char
                if (aValue === undefined)
                    ft = "''";
                else
                    ft = "'" + aValue.replace("'", "''") + "'";
                break;
            case 261://blob
                if (ASubType === 1) {
                    if (aValue === undefined)
                        ft = "''";
                    else {
                        ft = "'" + aValue.replace("'", "''") + "'";
                    }
                }
                else {
                    ft = "'" + aValue.replace("'", "''") + "'";
                }
                break;
            case 12://date
                aDate = new Date(aValue).toJSON();
                ft = "'" + aDate.substr(0, aDate.indexOf('T')) + "'";
                break;
            case 13://time
                aDate = new Date(aValue).toJSON();
                ft = "'" + aDate.substr(aDate.indexOf('T') + 1).replace('Z', '') + "'";
                break;
            case 35://timestamp 
                aDate = new Date(aValue).toJSON();
                ft = "'" + aDate.replace('T', ' ').replace('Z', '') + "'";
                break;
            default:
                throw new Error(AType + ' tipo de dato no reconocido');
        }
    }
    return ft;
}
exports.varToSql = varToSql;
function varToJSON(aValue, AType, ASubType) {
    let ft;
    let aDate = '';
    if (aValue === null)
        ft = null;
    else {
        switch (AType) {
            case 7:
            case 8:
            case 16:
                if (ASubType == 1)
                    ft = aValue;
                else if (ASubType == 2)
                    ft = aValue;
                else if (ASubType == 7)
                    ft = { $numberint: aValue };
                else if (ASubType == 8)
                    ft = { $numberint: aValue };
                else
                    ft = { $numberlong: aValue };
                break;
            case 10: //float
            case 27://double precision
                ft = aValue;
                break;
            case 37:
            case 14://varchar-char
                if (aValue === undefined)
                    ft = '';
                else
                    ft = aValue.toString('binary');
                break;
            case 261://blob
                if (ASubType === 1) {
                    if (aValue === undefined)
                        ft = '';
                    else {
                        ft = aValue.toString('binary');
                    }
                }
                else {
                    ft = { $binary: aValue.toString() };
                }
                break;
            case 12://date
                aDate = new Date(aValue).toLocaleDateString();
                ft = aDate;
                break;
            case 13://time 
                aDate = new Date(aValue).toLocaleString();
                ft = aDate.substr(aDate.indexOf(' ') + 1);
                break;
            /*case 12: //date
            case 13: //time    */
            case 35://timestamp 
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
exports.varToJSON = varToJSON;
function quotedCSV(aValue) {
    let ft = '';
    //va con RegExp porque el replace cambia solo la primer ocurrencia.        
    aValue = aValue.replace(new RegExp('"', 'g'), '""');
    //aValue = aValue.replace(new RegExp(String.fromCharCode(13), 'g'), '\\r');
    //aValue = aValue.replace(new RegExp(String.fromCharCode(10), 'g'), '\\n');
    //aValue = aValue.replace(new RegExp(String.fromCharCode(9), 'g'), '\\t');
    if (aValue.indexOf(',') !== -1 ||
        aValue.indexOf('"') !== -1 ||
        aValue.indexOf(String.fromCharCode(13)) !== -1 ||
        aValue.indexOf(String.fromCharCode(10)) !== -1 ||
        aValue.indexOf(String.fromCharCode(9)) !== -1 ||
        aValue.trim() === '')
        ft = '"' + aValue + '"';
    else
        ft = aValue;
    return ft;
}
function varToCSV(aValue, AType, ASubType) {
    let ft;
    let aDate = '';
    let aux;
    if (aValue === null)
        ft = '';
    else if (aValue === undefined)
        ft = '""';
    else {
        switch (AType) {
            case 7:
            case 8:
            case 16:
                if (ASubType == 1)
                    ft = aValue;
                else if (ASubType == 2)
                    ft = String(aValue).replace(',', '.');
                else if (ASubType == 7)
                    ft = String(aValue).replace(',', '.');
                else if (ASubType == 8)
                    ft = String(aValue).replace(',', '.');
                else
                    ft = String(aValue).replace(',', '.');
                break;
            case 10: //float
            case 27://double precision
                ft = String(aValue).replace(',', '.');
                break;
            case 37:
            case 14://varchar-char
                if (aValue === undefined)
                    ft = '';
                else
                    ft = quotedCSV(aValue.toString('binary')); //por la Ñ
                break;
            case 261://blob
                if (ASubType === 1) {
                    if (aValue === undefined)
                        ft = '';
                    else {
                        ft = quotedCSV(aValue.toString('binary')); //por la Ñ
                    }
                }
                else {
                    ft = '\\x' + aValue.toString();
                }
                break;
            case 12://date
                aDate = new Date(aValue).toLocaleDateString();
                ft = aDate;
                break;
            case 13://time 
                //aDate = new Date(aValue).toLocaleString();
                aux = aValue.getHours() + ':';
                aux += aValue.getMinutes() + ':';
                aux += aValue.getSeconds() + '.';
                aux += aValue.getMilliseconds();
                //aux = new Date(aValue).getTime();
                //ft = aDate.substr(aDate.indexOf(' ') + 1);
                ft = aux;
                break;
            /*case 12: //date
            case 13: //time    */
            case 35://timestamp 
                ft = new Date(aValue).toJSON();
                break;
            default:
                throw new Error(AType + ' tipo de dato no reconocido');
        }
    }
    if (ft !== null || String(ft).indexOf('ACEITE') !== -1)
        aValue = aValue;
    return ft;
}
exports.varToCSV = varToCSV;
function quotedString(aValue) {
    let x = false;
    // x=/[^A-Z_0-9]/.test(aValue);
    // x=/[^A-Z_^a-z_0-9]/.test(aValue);
    if (/[^A-Z_^a-z_0-9]/.test(aValue[0]))
        return '"' + aValue + '"';
    else
        return aValue;
}
exports.quotedString = quotedString;
function ifThen(aCondition, aTrue, aFalse) {
    if (aCondition)
        return aTrue;
    else
        return aFalse;
}
exports.ifThen = ifThen;
function outFileScript(aType, aScript, pathFileScript) {
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
exports.outFileScript = outFileScript;
function isChange(aFileToApply, aOriginalMetadata, aType) {
    let j = 0;
    let ret = false;
    if (aOriginalMetadata.length === 0)
        ret = true;
    else {
        j = -1;
        switch (aType) {
            case GlobalTypes.ArrayobjectType[0]://procedures
                j = aOriginalMetadata.findIndex(aitem => (aitem.contentFile.procedure.name.toLowerCase().trim() === aFileToApply.contentFile.procedure.name.toLowerCase().trim()));
                break;
            case GlobalTypes.ArrayobjectType[1]://trigger
                j = aOriginalMetadata.findIndex(aitem => (aitem.contentFile.triggerFunction.name.toLowerCase().trim() === aFileToApply.contentFile.triggerFunction.name.toLowerCase().trim()));
                break;
            case GlobalTypes.ArrayobjectType[2]://tables
                j = aOriginalMetadata.findIndex(aitem => (aitem.contentFile.table.name.toLowerCase().trim() === aFileToApply.contentFile.table.name.toLowerCase().trim()));
                break;
            case GlobalTypes.ArrayobjectType[3]://generator
                j = aOriginalMetadata.findIndex(aitem => (aitem.contentFile.generator.name.toLowerCase().trim() === aFileToApply.contentFile.generator.name.toLowerCase().trim()));
                break;
            case GlobalTypes.ArrayobjectType[4]://views
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
exports.isChange = isChange;
//# sourceMappingURL=globalFunction.js.map