#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs_extra_1 = require("fs-extra");
var params = require("commander");
var fbMetadata = require("./fbMetadata");
var GlobalTypes = require("./globalTypes");
var actionYalm = '';
var pathYalm = '';
var dbDriver = '';
var dbPath = '';
var dbHost = '';
var dbPort = 0;
var dbUser = '';
var dbPass = '';
var objectType = '';
var objectName = '';
params.version('1.0.0');
params.option('-r, --readyalm', 'Lee el directorio o archivo en el parametro -yalm para aplicar cambios');
params.option('-w, --writeyalm', 'Genera los archivos yalm en el directorio especificado -yalm');
params.option('-y, --yalm <pathyalm>', 'Path del directorio o archivo Yalm a leer');
params.option('-d, --dbdriver <dbdriver>', 'Driver de la DB ps=PostgreSql fb=Firebird');
params.option('-h, --dbhost <dbhost>', 'Host DB');
params.option('-o, --dbport <dbport>', 'puerto DB');
params.option('-c, --dbpath <dbpath>', 'path DB');
params.option('-u, --dbuser <dbuser>', 'User DB');
params.option('-p, --dbpass <dbpass>', 'Password DB');
params.option('-t, --objecttype <objecttype>', 'especifica que tipo de cambios se aplican (procedures,triggers,tables,generators');
params.option('-n, --objectname <objectname>', 'nombre particular del ObjectType (ot) que se desea aplicar');
//console.log(process.argv);
params.parse(process.argv);
// validacion de parametros
if (params.writeyalm && params.readyalm) {
    console.log('Debe elegir -r o -w no ambos');
    process.exit();
}
else if (params.writeyalm) {
    actionYalm = 'write';
}
else if (params.readyalm) {
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
    if (!fs_extra_1.existsSync(params.yalm)) {
        console.log('el path %j no existe', params.yalm);
        process.exit();
    }
    pathYalm = params.yalm;
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
if (params.dbhost) {
    dbHost = params.dbhost;
}
else {
    console.log('falta dbhost');
    process.exit();
}
if (params.dbport) {
    dbPort = params.dbport;
}
else {
    console.log('falta dbport');
    process.exit();
}
if (params.dbpath) {
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
if (actionYalm === 'write') {
    fbMetadata.writeYalm(dbHost, dbPort, dbPath, dbUser, dbPass);
}
