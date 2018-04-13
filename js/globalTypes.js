"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArrayDbDriver = ['ps', 'fb'];
exports.ArrayobjectType = ['procedures', 'triggers', 'tables', 'generators', 'views', 'fields'];
//export const ArrayVariableType:string[] = ['NUMERIC', 'DECIMAL', 'SMALLINT', 'INTEGER', 'BIGINT', 'FLOAT', 'DATE', 'TIME', 'CHAR', 'DOUBLE PRECISION', 'TIMESTAMP', 'VARCHAR', 'BLOB'];
exports.saveToLog_Table = 'ZLG_META_UPD';
exports.yamlExportOptions = {
    indent: 2,
    skipInvalid: false,
    flowLevel: -1,
    sortKeys: false,
    lineWidth: 180,
    noRefs: false,
    noCompatMode: false,
    condenseFlow: false
};
exports.yamlFileSaveOptions = {
    encoding: 'utf8' /*,
    mode:0,
    flag: 'w'*/
};
exports.CR = String.fromCharCode(10);
exports.TAB = String.fromCharCode(9);
;
;
function emptyTriggerYamlType() {
    return {
        triggerFunction: {
            name: '',
            ensure: '',
            triggers: [],
            function: {
                language: 'plpgsql',
                resultType: 'TABLE',
                options: {
                    optimization: {
                        type: 'STABLE',
                        returnNullonNullInput: false
                    }
                },
                executionCost: 100,
                resultRows: 1000,
                body: ''
            }
        }
    };
}
exports.emptyTriggerYamlType = emptyTriggerYamlType;
;
;
;
;
function emptyProcedureYamlType() {
    return {
        procedure: {
            name: '',
            ensure: '',
            pg: {
                language: 'plpgsql',
                resultType: 'TABLE',
                options: {
                    optimization: {
                        type: 'STABLE',
                        returnNullonNullInput: false
                    }
                },
                executionCost: 100,
                resultRows: 1000
            },
            body: ''
        }
    };
}
exports.emptyProcedureYamlType = emptyProcedureYamlType;
;
;
;
;
;
function emptyTablesYamlType() {
    return { table: {
            name: '',
            columns: [],
            constraint: { primaryKey: { columns: [] } }
        }
    };
}
exports.emptyTablesYamlType = emptyTablesYamlType;
;
function emptyTablesFieldYamlType() {
    return { column: {
            name: ''
        }
    };
}
exports.emptyTablesFieldYamlType = emptyTablesFieldYamlType;
;
function emptyTablesIndexesType() {
    return {
        index: {
            active: true,
            columns: [],
            name: '',
            unique: false
        }
    };
}
exports.emptyTablesIndexesType = emptyTablesIndexesType;
;
;
;
function emptyViewYamlType() {
    return {
        view: {
            name: '',
            columns: []
        }
    };
}
exports.emptyViewYamlType = emptyViewYamlType;
;
//# sourceMappingURL=globalTypes.js.map