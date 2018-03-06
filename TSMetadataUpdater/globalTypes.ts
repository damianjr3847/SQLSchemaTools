
export const ArrayDbDriver:string[] = ['ps','fb'];

export const ArrayobjectType:string[] = ['procedures','triggers','tables','generators'];

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

export interface iProcedureParameter{
    name?:string,
    type?:string
};

export interface iProcedureYamlType {
    procedure: {
        name?:string,
        input: iProcedureParameter[],    
		output: iProcedureParameter[],
		pg: { 
        	language?: string,
        	resultType?: string,
        	options: {
          		optimization:{
            		type?: string;
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
 
export const emptyProcedureYamlType = {
	procedure:{
		name:"",
		input:[],
		output:[],
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
};
