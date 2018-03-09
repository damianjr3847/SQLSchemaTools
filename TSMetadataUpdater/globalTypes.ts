
export const ArrayDbDriver:string[] = ['ps','fb'];

export const ArrayobjectType:string[] = ['procedures','triggers','tables','generators'];

export const ArrayVariableType:string[] = ['NUMERIC', 'DECIMAL', 'SMALLINT', 'INTEGER', 'BIGINT', 'FLOAT', 'DATE', 'TIME', 'CHAR', 'DOUBLE PRECISION', 'TIMESTAMP', 'VARCHAR', 'BLOB'];

export const yamlExportOptions = {
	indent: 4,
	skipInvalid: false,
	flowLevel: -1,
	sortKeys: false, 
	lineWidth:80, 
	noRefs: false, 
	noCompatMode: false, 
	condenseFlow: false
};

export const yamlFileSaveOptions = {
	encoding: "utf8"/*,
	mode:0,
	flag: "w"*/
};

/**************************************************************************************** */
/**********             P R O C E D U R E     I N T E R F A C E                           */
/***************************************************************************************** */

export interface iProcedureParameter{
    name:string,
    type:string
};

export interface iProcedureYamlType {
    procedure: {
        name:string,
        input?: Array<iProcedureParameter>,    
		output?: Array<iProcedureParameter>,
		variables?: Array<iProcedureParameter>,
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
			body?:string
		}	  
		fb:{body:string}
    }
};
 
export function emptyProcedureYamlType () {
	return { 
	procedure:{
		name:"",
		pg: {
			language:"plpgsql",
			resultType:"TABLE",
			options: {
				optimization:{
					type:"STABLE",
					returnNullonNullInput:false
				}	
			},	
			executionCost:100,
			resultRows:1000,
			body:""
		},
		fb:{
			body:""
		}
	}
	}
};

/**************************************************************************************** */
/**********             T A B L E      I N T E R F A C E                                  */
/***************************************************************************************** */
export interface iTablesFieldYamlType {
	charset?: string,
	collate?: string,
	computed?: string,
	description?: string,
	default?:string,
	name: string,
	nullable: boolean,	
	type: string,
	present?: boolean
};

export interface iTablesFKYamlType {
	name?: string,
	onField?: string,
	toTable?: string,
	toTield?: string,
	updateRole?: string,
	deleteRole?: string
};

export interface iTablesCheckType {
	name?:string,
	expresion?: string
}

export interface iTablesIndexesType {
	active: boolean,
	computedBy?: string,
	fields: Array<string>,		  
	name: string,
	unique: boolean,
	primaryKey?: boolean;	
};

export interface iTablesYamlType {
	table: {
		name: string,
		temporaryType?: string,
		fields: Array<iTablesFieldYamlType>,
		description?: string,	
		constraint?: { 
			foreignkey?: Array<iTablesFKYamlType>,
			check?: Array<iTablesCheckType>
		},
		indexes?: Array<iTablesIndexesType>
	}
};

export function emptyTablesYamlType() {
	return {table: {
					name: '',
					fields: []		
					}
			}
};

export function emptyTablesFieldYamlType() {	
	return {name: '',
			nullable: true,
			primaryKey: false	
			}
};

export function emptyTablesIndexesType() {
	return {
		active: true,
		fields: [],		  
		name: '',
		unique: false,
		primaryKey: false	
	};
};