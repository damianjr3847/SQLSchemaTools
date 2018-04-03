
export const ArrayDbDriver:string[] = ['ps','fb'];

export const ArrayobjectType:string[] = ['procedures','triggers','tables','generators','views','fields'];

//export const ArrayVariableType:string[] = ['NUMERIC', 'DECIMAL', 'SMALLINT', 'INTEGER', 'BIGINT', 'FLOAT', 'DATE', 'TIME', 'CHAR', 'DOUBLE PRECISION', 'TIMESTAMP', 'VARCHAR', 'BLOB'];

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

export const CR:any = String.fromCharCode(10);
export const TAB:any = String.fromCharCode(9);

/**************************************************************************************** */
/**********             T R I G G E R S      I N T E R F A C E                           */
/***************************************************************************************** */

export interface iTriggerTable {
	trigger: {
		name:string,
		table?:string,
		fires?:string,
		events:Array<string>,			
		active?:boolean,
		position?:number,
		description?:string
	}	
};
			  
export interface iTriggerYamlType {
    triggerFunction: {
		name:string,
		ensure?: string, //present: crea si no esta pero no actualisa, absent: si es lo borra, latest: que este la ultima version 
		triggers: Array<iTriggerTable>,		
		function: { 
        	language?: string,
        	resultType?: string,
        	options: {
          		optimization?:{
            		type?: string,
					returnNullonNullInput?: boolean
				  }	
			},	
          	executionCost?:number,
			resultRows?:number,
			body?:string
		}		
    }
};

export function emptyTriggerYamlType () {
	return { 
		triggerFunction: {
			name:'',
			ensure: '',
			triggers: [],		
			function: {
				language:'plpgsql',
				resultType:'TABLE',
				options: {
					optimization:{
						type:'STABLE',
						returnNullonNullInput:false
					}	
				},	
				executionCost:100,
				resultRows:1000,
				body:''			
			}		
		}
	}
};

/**************************************************************************************** */
/**********             P R O C E D U R E     I N T E R F A C E                           */
/***************************************************************************************** */

export interface iProcedureParameter{
	param:{
		name:string,
		type:string
	}
};

export interface iProcedureVariable{
	var:{
		name:string,
		type:string,
		cursor?:string
	}
};

export interface iProcedureYamlType {
    procedure: {
        name:string,
        inputs?: Array<iProcedureParameter>,    
		outputs?: Array<iProcedureParameter>,
		ensure?: string, //present: crea si no esta pero no actualisa, absent: si es lo borra, latest: que este la ultima version 
		pg: { 
        	language?: string,
        	resultType?: string,
        	options: {
          		optimization?:{
            		type?: string,
					returnNullonNullInput?: boolean
				  }	
			},	
          	executionCost?:number,
			resultRows?:number,			
		},	  		
		body?:string
    }
};
 
export function emptyProcedureYamlType () {
	return { 
		procedure:{
			name:'',
			ensure:'', 
			pg: {
				language:'plpgsql',
				resultType:'TABLE',
				options: {
					optimization:{
						type:'STABLE',
						returnNullonNullInput:false
					}	
				},	
				executionCost:100,
				resultRows:1000			
			},
			body:''
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
		default?:string,
		name: string,
		nullable?: boolean,	
		type?: string,
		present?: boolean
	}	
};

export interface iTablesFKYamlType {
	foreignkey:{
		name: string,
		onColumn?: string,
		toTable?: string,
		toColumn?: string,
		updateRole?: string,
		deleteRole?: string
	}	
};

export interface iTablesCheckType {
	check:{
		name?:string,
		expresion?: string
	}	
}

export interface iTablesIndexesType {
	index:{
		active: boolean,
		computedBy?: string,
		columns: Array<string>,		  
		name: string,
		unique: boolean,
		descending?: boolean;
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
				columns: Array<string>
			}
		},
		indexes?: Array<iTablesIndexesType>
	}
};

export function emptyTablesYamlType() {
	return {table: {
					name: '',
					columns: [],
					constraint: {primaryKey:{columns:[]}}		
					}
			}
};

export function emptyTablesFieldYamlType() {	
	return { column:{
				name: ''
				}
			}
};

export function emptyTablesIndexesType() {
	return {
		index:{
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
		description?: string
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