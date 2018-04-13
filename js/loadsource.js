"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globalFunction = require("./globalFunction");
const fs = require("fs");
const yaml = require("js-yaml");
const GlobalTypes = require("./globalTypes");
class tSource {
    constructor() {
        this.tablesArrayYaml = [];
        this.proceduresArrayYaml = [];
        this.triggersArrayYaml = [];
        this.generatorsArrayYaml = [];
        this.viewsArrayYaml = [];
        this.pathSource1 = '';
        this.pathSource2 = '';
        this.loadYaml = false;
    }
    loadArrayYaml(dirSource, aObjectType, aObjectName) {
        let ym;
        let j = 0;
        let nameFile = '';
        try {
            for (let i in dirSource) {
                nameFile = dirSource[i];
                ym = yaml.safeLoad(fs.readFileSync(dirSource[i], GlobalTypes.yamlFileSaveOptions.encoding));
                if ('table' in ym && (aObjectType === '' || aObjectType === GlobalTypes.ArrayobjectType[2])) {
                    if (aObjectName === '' || ym.table.name === aObjectName) {
                        j = this.tablesArrayYaml.findIndex((aItem) => (String(aItem.table.name).trim().toUpperCase() === String(ym.table.name).trim().toUpperCase()));
                        if (j === -1)
                            this.tablesArrayYaml.push(ym);
                        else
                            throw new Error('tables: no puede haber objetos duplicados en source1 y source2');
                    }
                }
                else if ('procedure' in ym && (aObjectType === '' || aObjectType === GlobalTypes.ArrayobjectType[0])) {
                    if (aObjectName === '' || ym.procedure.name === aObjectName) {
                        j = this.proceduresArrayYaml.findIndex((aItem) => (String(aItem.procedure.name).trim().toUpperCase() === String(ym.procedure.name).trim().toUpperCase()));
                        if (j === -1)
                            this.proceduresArrayYaml.push(ym);
                        else
                            throw new Error('procedure: no puede haber objetos duplicados en source1 y source2');
                    }
                }
                else if ('generator' in ym && (aObjectType === '' || aObjectType === GlobalTypes.ArrayobjectType[3])) {
                    if (aObjectName === '' || ym.generator.name === aObjectName) {
                        j = this.generatorsArrayYaml.findIndex((aItem) => (String(aItem.generator.name).trim().toUpperCase() === String(ym.generator.name).trim().toUpperCase()));
                        if (j === -1)
                            this.generatorsArrayYaml.push(ym);
                        else
                            throw new Error('generator: no puede haber objetos duplicados en source1 y source2');
                    }
                }
                else if ('view' in ym && (aObjectType === '' || aObjectType === GlobalTypes.ArrayobjectType[4])) {
                    if (aObjectName === '' || ym.view.name === aObjectName) {
                        j = this.viewsArrayYaml.findIndex((aItem) => (String(aItem.view.name).trim().toUpperCase() === String(ym.view.name).trim().toUpperCase()));
                        if (j === -1)
                            this.viewsArrayYaml.push(ym);
                        else
                            throw new Error('view: no puede haber objetos duplicados en source1 y source2');
                    }
                }
                else if ('triggerFunction' in ym && (aObjectType === '' || aObjectType === GlobalTypes.ArrayobjectType[1])) {
                    if (aObjectName === '' || ym.triggerFunction.name === aObjectName) {
                        j = this.triggersArrayYaml.findIndex((aItem) => (String(aItem.triggerFunction.name).trim().toUpperCase() === String(ym.triggerFunction.name).trim().toUpperCase()));
                        if (j === -1)
                            this.triggersArrayYaml.push(ym);
                        else
                            throw new Error('trigger: no puede haber objetos duplicados en source1 y source2');
                    }
                }
            }
        }
        catch (err) {
            throw new Error('Archivo: ' + nameFile + ' ' + err.message);
        }
    }
    ;
    readSource(aObjectType, aObjectName) {
        let filesDirSource1 = [];
        let filesDirSource2 = [];
        this.tablesArrayYaml = [];
        this.proceduresArrayYaml = [];
        this.triggersArrayYaml = [];
        this.generatorsArrayYaml = [];
        this.viewsArrayYaml = [];
        filesDirSource1 = globalFunction.readRecursiveDirectory(this.pathSource1);
        this.loadArrayYaml(filesDirSource1, aObjectType, aObjectName);
        if (this.pathSource2 !== '') {
            filesDirSource2 = globalFunction.readRecursiveDirectory(this.pathSource2);
            this.loadArrayYaml(filesDirSource2, aObjectType, aObjectName);
        }
        this.loadYaml = true;
    }
}
exports.tSource = tSource;
//# sourceMappingURL=loadsource.js.map