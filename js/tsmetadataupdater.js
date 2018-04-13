#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const params = require("commander");
const fbExtractMetadata = require("./fbExtractMetadata");
const fbApplyMetadata = require("./fbApplyMetadata");
const GlobalTypes = require("./globalTypes");
const fbExtractLoadData = require("./fbExtractLoadData");
let operation = '';
let source1 = '';
let source2 = '';
let pathSave = '';
let dbDriver = '';
let dbPath = '';
let dbHost = '';
let dbPort = 0;
let dbUser = '';
let dbPass = '';
let objectType = '';
let objectName = '';
let pathfilescript = '';
let excludeObject;
let excludeObjectStr = '';
let saveToLog = 'X';
let excludefrom = '';
let object = '';
let elements = '';
let nofolders = false;
let fileconf = '';
let aParam = '';
let aValue = '';
/**********para pruebas */
/*let actionYalm:string       = 'write';
let source1:string          = './export/';
let source2:string          = './source2/';

let pathSave:string         = './export/';
let dbDriver:string         = 'fb';
let dbPath:string           = '/pool/testing/demo.gdb';
let dbHost= aValue;:string           = 'srv-01.sig2k.com';
let dbPort:number           = 3050;
let dbUser:string           = 'SYSDBA';
let dbPass:string           = 'masterkey';
let objectType:string       = '';
let objectName:string       = '';
let pathfilescript:string   = '';//'./export/script.sql';
let excludeObject:any;
let excludeObjectStr:string = '{"tables":["usr$*","rpl$*"],"fields":["rpl$*","usr$*"],"procedures":["usr$*"],"triggers":["rpl$*"]}';
let saveToLog: boolean      = true;
let excludefrom: string     = './export/';

excludeObject= JSON.parse(excludeObjectStr);
*/
params.version('1.0.0');
params.option('--operation', '<readmetadata/writemetadata/extractdata/importdata>');
params.option('--source1 <source1>', 'Path del directorio a leer');
params.option('--source2 <source2>', 'Path del directorio a leer');
params.option('-x, --pathsave <pathsave>', 'Path del directorio donde se guardaran los archivos');
params.option('--nofolders', 'cuando genera los archivos no los separa en carpetas');
params.option('-d, --dbdriver <dbdriver>', 'Driver de la DB ps=PostgreSql fb=Firebird');
params.option('-h, --dbhost <dbhost>', 'Host DB');
params.option('-o, --dbport <dbport>', 'puerto DB');
params.option('-c, --dbpath <dbpath>', 'path DB');
params.option('-u, --dbuser <dbuser>', 'User DB');
params.option('-p, --dbpass <dbpass>', 'Password DB');
params.option('-t, --objecttype <objecttype>', 'opcional, especifica que tipo de cambios se aplican (procedures,triggers,tables,generators,views)');
params.option('-n, --objectname <objectname>', 'opcional, nombre particular del ObjectType que se desea aplicar');
params.option('-s, --outscript <pathfilescript>', 'opcional, devuelve un archivo con las sentencias sql en vez de ejecutarlas en la base de datos');
params.option('-e, --exclude <excludeobject>', 'opcional, filtros de objetos a excluir ejemplo: table:usr$*,rpl$*; *:rpl$*');
params.option('--excludefrom <pathexclude>', 'opcional, generar matadata exluyendo objetos de dicho path');
params.option('-l, --savetolog <tabla>', 'seguido de la tabla, guarda en la db el log de los querys ejecutados');
params.option('--conf <archivoconf>', 'archivo de configuracion');
params.parse(process.argv);
// validacion de parametros
if (params.conf) {
    if (!fs.existsSync(params.conf)) {
        console.log('el archivo conf no existe');
        process.exit(1);
    }
    fileconf = fs.readFileSync(params.conf, GlobalTypes.yamlFileSaveOptions.encoding);
    fileconf.split(/\r?\n/).forEach(function (line) {
        aParam = line.substr(0, line.indexOf('=')).trim().toLowerCase();
        aValue = line.substr(line.indexOf('=') + 1);
        switch (aParam) {
            case 'operation':
                operation = aValue;
                break;
            case 'source1':
                source1 = aValue;
                break;
            case 'source2':
                source2 = aValue;
                break;
            case 'pathsave':
                pathSave = aValue;
                break;
            case 'nofolders':
                nofolders = true;
                break;
            case 'dbdriver':
                dbDriver = aValue;
                break;
            case 'dbhost':
                dbHost = aValue;
                break;
            case 'dbport':
                dbPort = parseInt(aValue);
                break;
            case 'dbpath':
                dbPath = aValue;
                break;
            case 'dbuser':
                dbUser = aValue;
                break;
            case 'dbpass':
                dbPass = aValue;
                break;
            case 'objecttype':
                objectType = aValue;
                break;
            case 'objectname':
                objectName = aValue;
                break;
            case 'outscript':
                pathfilescript = aValue;
                break;
            case 'exclude':
                excludeObjectStr = aValue;
                break;
            case 'excludefrom':
                excludefrom = aValue;
                break;
            case 'savetolog':
                saveToLog = aValue;
                break;
        }
    });
}
if (params.operation)
    operation = params.operation;
if (!(operation === 'readmetadata' || operation === 'writemetadata' || operation === 'extractdata' || operation === 'importdata')) {
    console.log('debe haber una operacion valida para continuar <readmetadata/writemetadata/extractdata/importdata>');
    process.exit(1);
}
if (params.dbdriver)
    dbDriver = params.dbdriver;
if (dbDriver !== '') {
    if (GlobalTypes.ArrayDbDriver.indexOf(dbDriver) === -1) {
        console.log('dbdriver puede ser ps=PostgreSql o fb=firebird');
        process.exit(1);
    }
}
else {
    console.log('debe especificar un driver de base de datos');
    process.exit(1);
}
if (params.pathsave)
    pathSave = params.pathsave;
if (pathSave !== '') {
    if (!fs.existsSync(pathSave)) {
        console.log('el path %j no existe', pathSave);
        process.exit(1);
    }
}
else if (operation === 'writemetadata' || operation === 'extractdata') {
    console.log('debe haber un Path de salida');
    process.exit(1);
}
if (params.source1)
    source1 = params.source1;
if (source1 !== '') {
    if (!fs.existsSync(source1)) {
        console.log('el path source1 %j no existe', source1);
        process.exit(1);
    }
}
else if (operation === 'readmetadata' || operation === 'importdata') {
    console.log('si usa readmetadata debe haber un path en source1');
    process.exit(1);
}
if (params.source2)
    source2 = params.source2;
if (source2 !== '') {
    if (!fs.existsSync(source2)) {
        console.log('el path source2 %j no existe', source2);
        process.exit(1);
    }
}
if (params.dbuser)
    dbUser = params.dbuser;
if (dbUser === '') {
    console.log('falta dbuser');
    process.exit(1);
}
if (params.dbpass)
    dbPass = params.dbpass;
if (dbPass === '') {
    console.log('falta dbpass');
    process.exit(1);
}
if (params.dbhost)
    dbHost = params.dbhost;
if (dbHost === '') {
    console.log('falta dbhost');
    process.exit(1);
}
if (params.dbport)
    dbPort = params.dbport;
if (dbPort === 0) {
    console.log('falta dbport');
    process.exit(1);
}
if (params.dbpath)
    dbPath = params.dbpath;
if (dbPath === '') {
    console.log('falta dbpath');
    process.exit(1);
}
if (params.objecttype)
    objectType = params.objecttype;
if (objectType !== '') {
    if (GlobalTypes.ArrayobjectType.indexOf(objectType) === -1) {
        console.log('objecType solo pueden ser (procedures,triggers,tables,generators,views)');
        process.exit(1);
    }
    if (operation === 'extractdata' && objectType !== 'tables') {
        console.log('si utiliza extractdata el objectType valido es tables');
        process.exit(1);
    }
}
if (params.objectname)
    objectName = params.objectname;
if (objectName !== '') {
    if (objectType === '') {
        console.log('si usa objectname debe haber un objecttype');
        process.exit(1);
    }
}
if (params.outscript)
    pathfilescript = params.outscript;
if (params.exclude)
    excludeObjectStr = params.exclude;
if (excludeObjectStr !== '') {
    excludeObject = { tables: [], procedures: [], triggers: [], views: [], fields: [] };
    excludeObjectStr.split(';').forEach(function (line) {
        object = line.substr(0, line.indexOf(':')).trim();
        elements = line.substr(line.indexOf(':') + 1).trim();
        elements.split(',').forEach(function (element) {
            if (object !== '*') {
                excludeObject[object].push(element);
            }
            else {
                for (let i in excludeObject) {
                    excludeObject[i].push(element);
                }
            }
        });
    });
}
if (params.savetolog)
    saveToLog = params.savetolog.trim().toUpperCase();
if (operation === 'writemetdata' || saveToLog === '') {
    console.log('savetolog debe estar acompañado del nombre de tabla');
    process.exit(1);
}
else if (saveToLog === 'X')
    saveToLog = '';
if (params.excludefrom)
    excludefrom = params.excludefrom;
if (excludefrom !== '') {
    if (!fs.existsSync(excludefrom)) {
        console.log('el path excludefrom %j no existe', excludefrom);
        process.exit(1);
    }
}
if (params.nofolders)
    nofolders = true;
/*console.log('actionYalm: %j',actionYalm);
console.log('pathYalm: %j',pathSave);
console.log('source1: %j',source1);
console.log('source2: %j',source2);
console.log('dbDriver: %j', dbDriver);
console.log('connectionString: %j',dbHost+':'+dbPath);
console.log('dbPort: %j', dbPort);
console.log('dbUser: %j', dbUser);
console.log('dbPass: %j',dbPass);
console.log('objectType: %j', objectType);
console.log('objectName: %j', objectName);
console.log('e '+params.exclude+' '+excludeObject.pepe)
console.log('p '+params.outscript)
*/
(async () => {
    let fbem;
    let fbam;
    let fbdata;
    if (dbDriver === 'fb') {
        if (operation === 'writemetadata') {
            fbem = new fbExtractMetadata.fbExtractMetadata;
            fbem.filesPath = pathSave;
            fbem.excludeObject = excludeObject;
            fbem.nofolders = nofolders;
            if (excludefrom !== '') {
                fbem.sources.pathSource1 = excludefrom;
                fbem.excludeFrom = true;
            }
            await fbem.writeYalm(dbHost, dbPort, dbPath, dbUser, dbPass, objectType, objectName);
        }
        else if (operation === 'readmetadata') {
            fbam = new fbApplyMetadata.fbApplyMetadata;
            fbam.sources.pathSource1 = source1;
            fbam.sources.pathSource2 = source2;
            fbam.pathFileScript = pathfilescript;
            fbam.excludeObject = excludeObject;
            fbam.saveToLog = saveToLog;
            if (pathfilescript !== '')
                if (fs.existsSync(pathfilescript)) {
                    fs.unlinkSync(pathfilescript);
                }
            await fbam.applyYalm(dbHost, dbPort, dbPath, dbUser, dbPass, objectType, objectName);
        }
        else if (operation === 'extractdata') {
            fbdata = new fbExtractLoadData.fbExtractLoadData;
            fbdata.filesPath = pathSave;
            fbdata.excludeObject = excludeObject;
            await fbdata.extractData(dbHost, dbPort, dbPath, dbUser, dbPass, objectName);
        }
    }
})();
//# sourceMappingURL=tsmetadataupdater.js.map