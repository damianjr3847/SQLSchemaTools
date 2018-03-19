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

import * as fsexistsSync from 'fs';
import * as params from 'commander';

import * as fbExtractMetadata from './fbExtractMetadata';
import * as fbApplyMetadata from './fbApplyMetadata';

import * as GlobalTypes from './globalTypes';

let actionYalm:string   = 'read';
let pathYalm:string     = './export/';
let dbDriver:string     = 'fb';
let dbPath:string       = '/pool/testing/demo.gdb';
let dbHost:string       = 'srv-01.sig2k.com';
let dbPort:number       = 3050;
let dbUser:string       = 'SYSDBA';
let dbPass:string       = 'masterkey';
let objectType:string   = 'generators';
let objectName:string   = '';
//let objectName:string   = '';

/*params.version('1.0.0');

params.option('-r, --readyalm', 'Lee el directorio o archivo en el parametro -yalm para aplicar cambios');
params.option('-w, --writeyalm', 'Genera los archivos yalm en el directorio especificado -yalm');

params.option('-y, --yalm <pathyalm>', 'Path del directorio o archivo Yalm a leer o escribir');

params.option('-d, --dbdriver <dbdriver>', 'Driver de la DB ps=PostgreSql fb=Firebird');
params.option('-h, --dbhost <dbhost>', 'Host DB');
params.option('-o, --dbport <dbport>', 'puerto DB');
params.option('-c, --dbpath <dbpath>', 'path DB');
params.option('-u, --dbuser <dbuser>', 'User DB');
params.option('-p, --dbpass <dbpass>', 'Password DB');

params.option('-t, --objecttype <objecttype>', 'opcional, especifica que tipo de cambios se aplican (procedures,triggers,tables,generators');
params.option('-n, --objectname <objectname>', 'opcional, nombre particular del ObjectType (ot) que se desea aplicar');
//console.log(process.argv);

params.parse(process.argv);

// validacion de parametros

if (params.writeyalm && params.readyalm) {
    console.log('Debe elegir -r o -w no ambos');
    process.exit();    
}    
else if (params.writeyalm){ 
    actionYalm = 'write';
}
else if (params.readyalm){ 
    actionYalm = 'read';
}
else {
    console.log('debe haber -r o -w para continuar');
    process.exit();
}

if (params.dbdriver) {
    if (GlobalTypes.ArrayDbDriver.indexOf(params.dbdriver) !== -1) {   
        dbDriver = params.dbdriver;
    }
    else {
        console.log('dbdriver puede ser ps=PostgreSql o fb=firebird');
        process.exit();    
    }    
}
else {
    console.log('debe especificar un driver de base de datos');    
    process.exit();        
}

if (params.yalm) {
    if (! fsexistsSync.existsSync(params.yalm)) {
        console.log('el path %j no existe', params.yalm);
        process.exit();
    }
    pathYalm= params.yalm;
}
else {
    console.log('debe haber un Path del archivo y directorio de los archivos yalm');    
    process.exit();
}

if (params.dbuser) {
    dbUser = params.dbuser; 
}
else {
    console.log('falta dbuser');
    process.exit();
}

if (params.dbpass) {
    dbPass = params.dbpass; 
}
else {
    console.log('falta dbpass');
    process.exit();
}

if (params.dbhost ) {
    dbHost = params.dbhost; 
}
else {
    console.log('falta dbhost');
    process.exit();
}

if (params.dbport ) {
    dbPort = params.dbport; 
}
else {
    console.log('falta dbport');
    process.exit();
}

if (params.dbpath ) {
    dbPath = params.dbpath; 
}
else {
    console.log('falta dbpath');
    process.exit();
}

if (params.objecttype) {
    if (GlobalTypes.ArrayobjectType.indexOf(params.objecttype) !== -1) {
        objectType = params.objecttype;
    }
    else {
        console.log('objecType solo pueden ser (procedures,triggers,tables,generators)');
        process.exit();
    }
}

if (params.objectname) {
    if (objectType = '') {
        console.log('debe haber un objecttype');
        process.exit();
    }
}

/*console.log('actionYalm: %j',actionYalm);
console.log('pathYalm: %j',pathYalm);
console.log('dbDriver: %j', dbDriver);
console.log('connectionString: %j',dbHost+':'+dbPath);
console.log('dbPort: %j', dbPort);
console.log('dbUser: %j', dbUser);
console.log('dbPass: %j',dbPass);
console.log('objectType: %j', objectType);
console.log('objectName: %j', objectName);*/

(async () => {
    let fbem: fbExtractMetadata.fbExtractMetadata;  
    let fbam: fbApplyMetadata.fbApplyMetadata;

    if (dbDriver === 'fb') {                

        if (actionYalm === 'write') {
            fbem = new fbExtractMetadata.fbExtractMetadata;
            fbem.filesPath = pathYalm;
            await fbem.writeYalm(dbHost,dbPort,dbPath,dbUser,dbPass, objectType, objectName);    
        }
        else if (actionYalm === 'read') {
            fbam = new fbApplyMetadata.fbApplyMetadata;
            fbam.filesPath = pathYalm;
            await fbam.applyYalm(dbHost,dbPort,dbPath,dbUser,dbPass, objectType, objectName);    
        }      
        
    }    

})();  

