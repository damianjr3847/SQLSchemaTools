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

import * as fbExtractMetadata from './fbExtractMetadata';
import * as fbApplyMetadata from './fbApplyMetadata';

import * as GlobalTypes from './globalTypes';

let actionYalm:string   = 'read';
let source1:string     = './export/';
let source2:string     = './source2/';

let pathSave:string     = './export/';
let dbDriver:string     = 'fb';
let dbPath:string       = '/pool/testing/demo.gdb';
let dbHost:string       = 'srv-01.sig2k.com';
let dbPort:number       = 3050;
let dbUser:string       = 'SYSDBA';
let dbPass:string       = 'masterkey';
let objectType:string   = '';
let objectName:string   = '';
let pathfilescript:string   = './export/script.sql';

/*params.version('1.0.0');

params.option('-r, --readyalm', 'Lee el directorio o archivo en el parametro -yalm para aplicar cambios');

params.option('--source1 <source1>', 'Path del directorio a leer');
params.option('--source2 <source2>', 'Path del directorio a leer');

params.option('-w, --writeyalm', 'Genera los archivos yalm en el directorio especificado -yalm');

params.option('--pathsave <pathsave>', 'Path del directorio donde se guardaran los archivos');

params.option('-d, --dbdriver <dbdriver>', 'Driver de la DB ps=PostgreSql fb=Firebird');
params.option('-h, --dbhost <dbhost>', 'Host DB');
params.option('-o, --dbport <dbport>', 'puerto DB');
params.option('-c, --dbpath <dbpath>', 'path DB');
params.option('-u, --dbuser <dbuser>', 'User DB');
params.option('-p, --dbpass <dbpass>', 'Password DB');

params.option('-t, --objecttype <objecttype>', 'opcional, especifica que tipo de cambios se aplican (procedures,triggers,tables,generators');
params.option('-n, --objectname <objectname>', 'opcional, nombre particular del ObjectType (ot) que se desea aplicar');
params.option('--outscript <pathfilescript>', 'opcional, devuelve un archivo con las sentencias sql');

//console.log(process.argv);

params.parse(process.argv);

// validacion de parametros

if (params.writeyalm && params.readyalm) {
    console.log('Debe elegir -r o -w no ambos');
    process.exit(1);    
}    
else if (params.writeyalm){ 
    actionYalm = 'write';
}
else if (params.readyalm){ 
    actionYalm = 'read';
}
else {
    console.log('debe haber -r o -w para continuar');
    process.exit(1);
}

if (params.dbdriver) {
    if (GlobalTypes.ArrayDbDriver.indexOf(params.dbdriver) !== -1) {   
        dbDriver = params.dbdriver;
    }
    else {
        console.log('dbdriver puede ser ps=PostgreSql o fb=firebird');
        process.exit(1);    
    }    
}
else {
    console.log('debe especificar un driver de base de datos');    
    process.exit(1);        
}

if (params.pathsave) {
    if (! fs.existsSync(params.pathsave)) {
        console.log('el path %j no existe', params.pathsave);
        process.exit(1);
    }
    pathSave= params.pathsave;
}
else {
    console.log('debe haber un Path del archivo y directorio de los archivos yalm');    
    process.exit(1);
}

if (params.source1) {
    if (! fs.existsSync(params.source1)) {
        console.log('el path source1 %j no existe', params.source1);
        process.exit(1);
    }
    source1= params.source1;
}
else {
    console.log('debe haber un path en source1');    
    process.exit(1);
}

if (params.source2) {
    if (! fs.existsSync(params.source2)) {
        console.log('el path source2 %j no existe', params.source2);
        process.exit(1);
    }
    source2= params.source2;
}


if (params.dbuser) {
    dbUser = params.dbuser; 
}
else {
    console.log('falta dbuser');
    process.exit(1);
}

if (params.dbpass) {
    dbPass = params.dbpass; 
}
else {
    console.log('falta dbpass');
    process.exit(1);
}

if (params.dbhost ) {
    dbHost = params.dbhost; 
}
else {
    console.log('falta dbhost');
    process.exit(1);
}

if (params.dbport ) {
    dbPort = params.dbport; 
}
else {
    console.log('falta dbport');
    process.exit(1);
}

if (params.dbpath ) {
    dbPath = params.dbpath; 
}
else {
    console.log('falta dbpath');
    process.exit(1);
}

if (params.objecttype) {
    if (GlobalTypes.ArrayobjectType.indexOf(params.objecttype) !== -1) {
        objectType = params.objecttype;
    }
    else {
        console.log('objecType solo pueden ser (procedures,triggers,tables,generators)');
        process.exit(1);
    }
}

if (params.objectname) {
    if (objectType = '') {
        console.log('debe haber un objecttype');
        process.exit(1);
    }
}

if (params.pathfilescript) {
    pathfilescript= params.pathfilescript;
}

console.log('actionYalm: %j',actionYalm);
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
*/

(async () => {
    let fbem: fbExtractMetadata.fbExtractMetadata;  
    let fbam: fbApplyMetadata.fbApplyMetadata;

    if (dbDriver === 'fb') {                

        if (actionYalm === 'write') {
            fbem = new fbExtractMetadata.fbExtractMetadata;
            fbem.filesPath = pathSave;
            await fbem.writeYalm(dbHost,dbPort,dbPath,dbUser,dbPass, objectType, objectName);    
        }
        else if (actionYalm === 'read') {
            fbam = new fbApplyMetadata.fbApplyMetadata;
            fbam.pathSource1 = source1;
            fbam.pathSource2 = source2;
            fbam.pathFileScript= pathfilescript;
            if (pathfilescript !== '')
                if (fs.existsSync(pathfilescript)) {
                    fs.unlinkSync(pathfilescript);
                }
            await fbam.applyYalm(dbHost,dbPort,dbPath,dbUser,dbPass, objectType, objectName);    
        }      
        
    }    

})();  

