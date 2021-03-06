#!/usr/bin/env node

//SQL schema declarative manager

/*
https://codeburst.io/how-to-build-a-command-line-app-in-node-js-using-typescript-google-cloud-functions-and-firebase-4c13b1699a27
https://developer.atlassian.com/blog/2015/11/scripting-with-node/


******** M A N U A L E S   ***********
https://www.typescriptlang.org/

******** L I B R E R I A S ***********
https://www.npmjs.com/package/fs-extra
https://www.npmjs.com/package/@types/fs-extra
https://www.npmjs.com/package/commander
https://www.npmjs.com/package/node-firebird
https://github.com/hgourvest/node-firebird

*/

import * as fs from 'fs';
import * as params from 'commander';
import * as fbExtractMetadata from './firebird/fbExtractMetadata';
import * as fbApplyMetadata from './firebird/fbApplyMetadata';
import * as GlobalTypes from './common/globalTypes';
import * as fbExtractLoadData from './firebird/fbExtractLoadData';
import * as fbCheckMetadata from './firebird/fbCheckMetadata';
import * as pgApplyMetadata from './postgre/pgApplyMetadata';
import * as pgExtractMetadata from './postgre/pgExtractMetadata';
import * as pgExtractLoadData from './postgre/pgExtractLoadData';
import * as pgCheckMetadata from './postgre/pgCheckMetadata';

let operation: string = '';
let source1: string = '';
let source2: string = '';

let pathSave: string = '';
let dbDriver: string = '';
let dbPath: string = '';
let dbHost: string = '';
let dbPort: number = 0;
let dbUser: string = '';
let dbPass: string = '';
let objectType: string = '';
let objectName: string = '';
let pathfilescript: string = '';
let excludeObject: any;
let excludeObjectStr: string = '';
let saveToLog: string = 'X';
let excludefrom: string = '';

let object: string = '';
let elements: string = '';
let nofolders: boolean = false;
let fileconf: string = '';
let aParam: string = '';
let aValue: string = '';
let beginTime: any;
let endTime: any;
let textTime: string = '';
let dbRole: string = '';
let saveafterapply: string = '';
let deletedata: boolean = false;

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

params.option('--operation <>', '<readmetadata/writemetadata/extractdata/importdata/checkmetadata>');

params.option('--source1 <source1>', 'Path del directorio a leer');
params.option('--source2 <source2>', 'Path del directorio a leer');


params.option('-x, --pathsave <pathsave>', 'Path del directorio donde se guardaran los archivos');
params.option('--nofolders', 'cuando genera los archivos no los separa en carpetas');

params.option('-d, --dbdriver <dbdriver>', 'Driver de la DB pg=PostgreSql fb=Firebird');
params.option('-h, --dbhost <dbhost>', 'Host DB');
params.option('-o, --dbport <dbport>', 'puerto DB');
params.option('-c, --dbpath <dbpath>', 'path DB');
params.option('-u, --dbuser <dbuser>', 'User DB');
params.option('-p, --dbpass <dbpass>', 'Password DB');
params.option('--dbrole <dbrole>', 'Role DB solo para Postgres');

params.option('-t, --objecttype <objecttype>', 'opcional, especifica que tipo de cambios se aplican (procedures,triggers,tables,generators,views)');
params.option('-n, --objectname <objectname>', 'opcional, nombre particular del ObjectType que se desea aplicar');
params.option('-s, --outscript <pathfilescript>', 'opcional, devuelve un archivo con las sentencias sql en vez de ejecutarlas en la base de datos');

params.option('-e, --exclude <excludeobject>', 'opcional, filtros de objetos a excluir ejemplo: table:usr$*,rpl$*; *:rpl$*')

params.option('--excludefrom <pathexclude>', 'opcional, generar matadata exluyendo objetos de dicho path');

params.option('-l, --savetolog <tabla>', 'seguido de la tabla, guarda en la db el log de los querys ejecutados');

params.option('--conf <archivoconf>', 'archivo de configuracion');
params.option('--saveafterapply <pathsave>', 'Path del directorio donde se guardaran los archivos despues de aplicar cambios en el metadata solo PG');

params.option('--deletedata', 'operacion=importdata. Borra el contenido de las tablas antes de importar');


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
            case 'dbrole':
                dbRole = aValue;
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
            case 'saveafterapply':
                saveafterapply = aValue;
                break;
            case 'deletedata':
                if (aValue.toUpperCase() === 'TRUE')
                    deletedata = true;
                else
                    deletedata = false;
                break;
        }
    });

}

if (params.operation)
    operation = params.operation;

if (!(operation === 'readmetadata' || operation === 'writemetadata' || operation === 'extractdata' || operation === 'importdata' || operation === 'checkmetadata')) {
    console.log('debe haber una operacion valida para continuar <readmetadata/writemetadata/extractdata/importdata/checkmetadata>');
    process.exit(1);
}

if (params.dbdriver)
    dbDriver = params.dbdriver;

if (dbDriver !== '') {
    if (GlobalTypes.ArrayDbDriver.indexOf(dbDriver) === -1) {
        console.log('dbdriver puede ser pg=PostgreSql o fb=firebird');
        process.exit(1);
    }
}
else {
    console.log('debe especificar un driver de base de datos');
    process.exit(1);
}

if (params.dbrole)
    dbRole = params.dbrole;

if (dbDriver === 'pg') {
    if (dbRole === '') {
        console.log('debe haber un dbrole si el dbDriver es postgres');
        process.exit(1);
    }
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

/*if (dbPass === '') {
    console.log('falta dbpass');
    process.exit(1);
}*/

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

    excludeObject = { tables: [], procedures: [], triggers: [], views: [], fields: [], generators: [] };

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
        })
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

if (saveafterapply !== '') {
    if (!(saveafterapply.endsWith('/')))
        saveafterapply += '/';
    if (!fs.existsSync(saveafterapply)) {
        console.log('el path saveafterapply %j no existe', saveafterapply);
        process.exit(1);
    }
}

if (params.nofolders)
    nofolders = true;

if (params.deletedata)
    deletedata = true;

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
    let fbem: fbExtractMetadata.fbExtractMetadata;
    let fbam: fbApplyMetadata.fbApplyMetadata;
    let fbdata: fbExtractLoadData.fbExtractLoadData;
    let fbCheck: fbCheckMetadata.fbCheckMetadata;

    let pgam: pgApplyMetadata.pgApplyMetadata;
    let pgem: pgExtractMetadata.pgExtractMetadata;
    let pgdata: pgExtractLoadData.pgExtractLoadData;
    let pgcheck: pgCheckMetadata.pgCheckMetadata;

    beginTime = new Date();

    if (!(pathSave.endsWith('/')))
        pathSave += '/';

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
            fbdata.formatExport = 'csv';

            await fbdata.extractData(dbHost, dbPort, dbPath, dbUser, dbPass, objectName);
        }
        else if (operation === 'checkmetadata') {
            fbCheck = new fbCheckMetadata.fbCheckMetadata;

            await fbCheck.check(dbHost, dbPort, dbPath, dbUser, dbPass, objectType, objectName);

        }

    }
    else {
        if (operation === 'writemetadata') {
            pgem = new pgExtractMetadata.pgExtractMetadata;
            pgem.filesPath = pathSave;
            pgem.excludeObject = excludeObject;
            pgem.nofolders = nofolders;

            if (excludefrom !== '') {
                pgem.sources.pathSource1 = excludefrom;
                pgem.excludeFrom = true;
            }
            await pgem.writeYalm(dbHost, dbPort, dbPath, dbUser, dbPass, objectType, objectName);
        }
        else if (operation === 'readmetadata') {
            pgam = new pgApplyMetadata.pgApplyMetadata;
            pgam.sources.pathSource1 = source1;
            pgam.sources.pathSource2 = source2;
            pgam.pathFileScript = pathfilescript;
            pgam.saveafterapply = saveafterapply;
            pgam.excludeObject = excludeObject;
            pgam.saveToLog = saveToLog.toLowerCase();
            if (pathfilescript !== '')
                if (fs.existsSync(pathfilescript)) {
                    fs.unlinkSync(pathfilescript);
                }
            await pgam.applyYalm(dbHost, dbPort, dbPath, dbUser, dbPass, dbRole, objectType, objectName);
        }
        else if (operation === 'checkmetadata') {
            pgcheck = new pgCheckMetadata.pgCheckMetadata;

            await pgcheck.check(dbHost, dbPort, dbPath, dbUser, dbPass, dbRole, objectType, objectName);

        }
        else if (operation === 'importdata') {
            pgdata = new pgExtractLoadData.pgExtractLoadData;
            pgdata.filesPath = source1;
            pgdata.excludeObject = excludeObject;
            pgdata.deletedata = deletedata;
            await pgdata.loadDataStream(dbHost, dbPort, dbPath, dbUser, dbPass, objectName, dbRole);
        }


    }
    endTime = new Date();
    textTime = new Date(endTime - beginTime).toJSON();
    console.log('Tiempo total: ' + textTime.substr(textTime.indexOf('T') + 1).replace('Z', ''));
})();

