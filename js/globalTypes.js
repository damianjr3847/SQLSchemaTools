"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArrayDbDriver = ['pg', 'fb'];
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
    return {
        table: {
            name: '',
            columns: [],
            constraint: { primaryKey: { columns: [] } }
        }
    };
}
exports.emptyTablesYamlType = emptyTablesYamlType;
;
function emptyTablesFieldYamlType() {
    return {
        column: {
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
/**************************************************************************************** */
/**********                 D A T A   T Y P E S                                           */
/**************************************************************************************** */
function convertDataType(aName) {
    let ft = '';
    switch (aName.toLowerCase()) {
        case 'bit':
        case 'bit varying':
            ft = 'bit';
            break;
        //tipo de datos string
        case 'character':
        case 'char':
            ft = 'char';
            break;
        case 'character varying':
        case 'varchar':
            ft = 'varchar';
            break;
        case 'blob sub_type 1':
        case 'text':
            ft = 'blob text';
            break;
        //numericos con decimales
        case 'numeric':
            ft = 'numeric';
            break;
        case 'decimal':
            ft = 'decimal';
            break;
        case 'float':
        case 'double precision':
        case 'float8':
            ft = 'double precision';
            break;
        case 'real':
        case 'float4':
            ft = 'real';
            break;
        //monetarios
        case 'money':
            ft = 'money';
            break;
        //enteros
        case 'bigint':
        case 'int8':
            ft = 'bigint';
            break;
        case 'bigserial':
        case 'serial8':
            ft = 'bigserial';
            break;
        case 'integer':
        case 'int':
        case 'int4':
            ft = 'integer';
            break;
        case 'smallint':
        case 'int2':
            ft = 'smallint';
            break;
        case 'smallserial':
        case 'serial2':
            ft = 'smallserial';
            break;
        case 'serial':
        case 'serial4':
            ft = 'serial';
            break;
        //network
        case 'inet': //direcciones ip v4 y v6
        case 'cidr': //hostname
        case 'macaddr':
        case 'macaddr8':
            ft = aName;
            break;
        //fecha y hora
        case 'timestamp':
        case 'timestamp without time zone':
            ft = 'timestamp';
            break;
        case 'timestamp with time zone':
        case 'timestamptz':
            ft = aName;
            break;
        case 'date':
            ft = 'date';
            break;
        case 'time':
        case 'time without time zone':
            ft = 'time';
            break;
        case 'time with time zone':
        case 'timetz':
            ft = aName;
            break;
        case 'interval':
            ft = 'interval';
            break;
        //binarios 
        case 'blob sub_type 0':
        case 'bytea':
            ft = 'blob binary';
            break;
        //booleanos     
        case 'boolean':
        case 'bool':
            ft = 'boolean';
            break;
        //geometricos
        case 'box':
        case 'circle':
        case 'polygon':
        case 'line':
        case 'lseg':
        case 'point':
        case 'path':
            ft = aName;
            break;
        //otros    	 	    	
        case 'tsquery':
        case 'tsvector':
        case 'txid_snapshot':
        case 'uuid':
        case 'json':
        case 'xml':
            ft = aName;
            break;
        default:
            ft = aName; //throw new Error('tipo de dato desconocido ' + aName)
    }
    return ft;
}
exports.convertDataType = convertDataType;
//# sourceMappingURL=globalTypes.js.map