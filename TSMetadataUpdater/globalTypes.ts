
export const ArrayDbDriver:string[] = ['ps','fb'];

export const ArrayobjectType:string[] = ['procedures','triggers','tables','generators'];

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
