
export const ArrayDbDriver: string[] = ['pg', 'fb'];

export const ArrayobjectType: string[] = ['procedures', 'triggers', 'tables', 'generators', 'views', 'fields', 'indexes'];

//export const ArrayVariableType:string[] = ['NUMERIC', 'DECIMAL', 'SMALLINT', 'INTEGER', 'BIGINT', 'FLOAT', 'DATE', 'TIME', 'CHAR', 'DOUBLE PRECISION', 'TIMESTAMP', 'VARCHAR', 'BLOB'];

export const ArrayPgFunctionParallelMode: string[] = ['safe', 'unsafe', 'restricted'];

export const ArrayPgFunctionLenguage: string[] = ['plpython3u', 'c', 'sql', 'plpgsql'];

export const saveToLog_Table = 'ZLG_META_UPD';

export const yamlExportOptions = {
	indent: 2,
	skipInvalid: false,
	flowLevel: -1,
	sortKeys: false,
	lineWidth: 180,
	noRefs: false,
	noCompatMode: false,
	condenseFlow: false
};

export const yamlFileSaveOptions = {
	encoding: 'utf8'/*,
	mode:0,
	flag: 'w'*/
};

export const CR: any = String.fromCharCode(10);
export const TAB: any = String.fromCharCode(9);

/**************************************************************************************** */
/**********             T R I G G E R S      I N T E R F A C E                           */
/***************************************************************************************** */

export interface iTriggerTable {
	trigger: {
		name: string,
		table?: string,
		fires?: string,
		events: Array<string>,
		active?: boolean,
		position?: number,
		description?: string
	}
};

export interface iTriggerYamlType {
	triggerFunction: {
		name: string,
		ensure?: string, //present: crea si no esta pero no actualisa, absent: si es lo borra, latest: que este la ultima version 
		triggers: Array<iTriggerTable>,
		function: {
			language?: string,
			options: {
				optimization: {
					type?: string
				}
			},
			executionCost?: number,
			description?: string, //solo se llena en postgre si la hay
			body?: string
		}
	}
};

export function emptyTriggerYamlType() {
	return {
		triggerFunction: {
			name: '',
			ensure: '',
			triggers: [],
			function: {
				language: 'plpgsql',
				options: {
					optimization: {
						type: 'STABLE'
					}
				},
				executionCost: 100,
				body: ''
			}
		}
	}
};

/**************************************************************************************** */
/**********             P R O C E D U R E     I N T E R F A C E                           */
/***************************************************************************************** */

export interface iProcedureParameter {
	param: {
		name: string,
		type: string
	}
};

export interface iProcedureVariable {
	var: {
		name: string,
		type: string,
		cursor?: string
	}
};

export interface iProcedureYamlType {
	procedure: {
		name: string,
		description?: string,
		inputs?: Array<iProcedureParameter>,
		outputs?: Array<iProcedureParameter>,
		ensure?: string, //present: crea si no esta pero no actualiza, absent: si es lo borra, latest: que este la ultima version 
		pg: {
			language?: string,
			resultType?: string,
			options: {
				optimization: {
					type?: string,
					parallelMode?: string,
					returnNullonNullInput?: boolean
				}
			},
			executionCost?: number,
			resultRows?: number,
		},
		body?: string
	}
};

export function emptyProcedureYamlType() {
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
						parallelMode: 'UNSAFE',
						returnNullonNullInput: false
					}
				},
				executionCost: 100,
				resultRows: 1000
			},
			body: ''
		}
	}
};

/**************************************************************************************** */
/**********             T A B L E      I N T E R F A C E                                  */
/******************************************************************************************/
export interface iTablesFieldYamlType {
	column: {
		charset?: string,
		collate?: string,
		computed?: string,
		description?: string,
		default?: string,
		name: string,
		nullable?: boolean,
		type?: string,
		present?: boolean
	}
};

export interface iTablesFKYamlType {
	foreignkey: {
		name: string,
		onColumn?: string,
		toTable?: string,
		toColumn?: string,
		updateRole?: string,
		deleteRole?: string,
		description?: string
	}
};

export interface iTablesCheckType {
	check: {
		name: string,
		expresion: string,
		description?: string
	}
}

export interface iTablesIndexesType {
	index: {
		active: boolean,
		computedBy?: string,
		columns: Array<any | string>,
		name: string,
		unique: boolean,
		descending?: boolean;
		description?: string
	}
};

export interface iTablesYamlType {
	table: {
		name: string,
		temporaryType?: string,
		columns: Array<iTablesFieldYamlType>,
		description?: string,
		constraint: {
			foreignkeys?: Array<iTablesFKYamlType>,
			checks?: Array<iTablesCheckType>
			primaryKey: {
				name?: string,
				columns: Array<string>,
				description?: string
			}
		},
		indexes?: Array<iTablesIndexesType>
	}
};

export function emptyTablesYamlType() {
	return {
		table: {
			name: '',
			columns: [],
			constraint: { primaryKey: { columns: [] } }
		}
	}
};

export function emptyTablesFieldYamlType() {
	return {
		column: {
			name: ''
		}
	}
};

export function emptyTablesIndexesType() {
	return {
		index: {
			active: true,
			columns: [],
			name: '',
			unique: false
		}
	};
};

/**************************************************************************************** */
/**********                          G E N E R A T O R S                                  */
/**************************************************************************************** */

export interface iGeneratorYamlType {
	generator: {
		name: string,
		description?: string,
		increment?: number
	}
};

/**************************************************************************************** */
/**********                              V I E W S                                        */
/**************************************************************************************** */

export interface iViewYamlType {
	view: {
		name: string,
		columns: Array<string>,
		description?: string,
		body?: string
	}
};

export function emptyViewYamlType() {
	return {
		view: {
			name: '',
			columns: []
		}
	};
};

/**************************************************************************************** */
/**********                 D A T A   T Y P E S                                           */
/**************************************************************************************** */

export function convertDataType(aName: string): string {
	let ft: string = '';

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
		case 'decimal':
			ft = 'numeric';
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

export function convertDataTypeToPG(aName: string, isProc: boolean = false): string {
	let ft: string = '';
	let aLen: string = '';

	if (aName.indexOf('(') > 0) {
		aLen = aName.substr(aName.indexOf('('));
		aName = aName.substr(0, aName.indexOf('('));
	}

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
		case 'blob text':
			ft = 'text';
			break;
		//numericos con decimales
		case 'numeric':
		case 'decimal':
			ft = 'numeric';
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
		case 'blob binary':
			ft = 'bytea';
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
	if (isProc)
		return ft;
	else
		return ft + aLen;
}

export function convertDataTypeToFB(aName: string): string {
	let ft: string = '';
	let aLen: string = '';

	if (aName.indexOf('(') > 0) {
		aLen = aName.substr(aName.indexOf('('));
		aName = aName.substr(0, aName.indexOf('('));
	}

	switch (aName.toLowerCase()) {
		//tipo de datos string
		case 'character':
		case 'char':
			ft = 'char';
			break;
		case 'character varying':
		case 'varchar':
			ft = 'varchar';
			break;
		case 'blob text':
		case 'blob sub_type 1':
		case 'text':
			ft = 'blob sub_type 1';
			break;
		//numericos con decimales
		case 'numeric':
			ft = 'numeric';
			break;
		case 'decimal':
			ft = 'decimal';
			break;
		case 'float':
			ft = 'float';
			break;
		case 'double precision':
		case 'float8':
		case 'real':
		case 'float4':
		case 'money':
			ft = 'double precision';
			break;
		//enteros
		case 'bigint':
		case 'int8':
			ft = 'bigint';
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
		//fecha y hora
		case 'timestamp':
		case 'timestamp without time zone':
		case 'timestamp with time zone':
		case 'timestamptz':
			ft = 'timestamp';
			break;
		case 'date':
			ft = 'date';
			break;
		case 'time':
		case 'time without time zone':
		case 'time with time zone':
		case 'timetz':
			ft = 'time';
			break;
		//binarios 
		case 'blob sub_type 0':
		case 'blob binary':
		case 'bytea':
			ft = 'blob sub_type 0';
			break;
		//booleanos     
		case 'boolean':
		case 'bool':
			ft = 'boolean';
			break;
		case 'interval':
		case 'smallserial':
		case 'serial2':
		case 'serial':
		case 'serial4':
		//network
		case 'inet': //direcciones ip v4 y v6
		case 'cidr': //hostname
		case 'macaddr':
		case 'macaddr8':
		//geometricos
		case 'box':
		case 'circle':
		case 'polygon':
		case 'line':
		case 'lseg':
		case 'point':
		case 'path':
		//otros    	 	    	
		case 'tsquery':
		case 'tsvector':
		case 'txid_snapshot':
		case 'uuid':
		case 'json':
		case 'xml':
		case 'bigserial':
		case 'serial8':
		case 'bit':
		case 'bit varying':
			throw new Error('tipo de dato desconocido ' + aName);
		default:
			ft = aName; //throw new Error('tipo de dato desconocido ' + aName)
	}
	return ft + aLen;
}