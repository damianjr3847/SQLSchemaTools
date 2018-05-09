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
function readRecursiveDirectory(dir) {
    var retArrayFile = [];
    var files;
    var fStat;
    if (!(dir.endsWith('/') || dir.endsWith('\\')))
        dir += '/';
    files = fs.readdirSync(dir);
    for (var i in files) {
        fStat = fs.statSync(dir + files[i]);
        if (fStat && fStat.isDirectory())
            retArrayFile = retArrayFile.concat(readRecursiveDirectory(dir + files[i]));
        else
            retArrayFile.push(dir + files[i]);
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
                    ft = aValue.toString();
                break;
            case 261://blob
                if (ASubType === 1) {
                    if (aValue === undefined)
                        ft = '';
                    else {
                        ft = aValue.toString();
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
    return ft;
}
exports.varToJSON = varToJSON;
function quotedString(aValue) {
    let x = false;
    x = /[^A-Z_0-9]/.test(aValue);
    x = /[^A-Z_^a-z_0-9]/.test(aValue);
    if (/[^A-Z_^a-z_0-9]/.test(aValue))
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
//# sourceMappingURL=globalFunction.js.map