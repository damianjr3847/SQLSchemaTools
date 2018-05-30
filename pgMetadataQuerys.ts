export const queryProcedureTrigger: string =
    `SELECT * 
     FROM (select 
            ns.nspname										as "schema", 
            p.proname										as "functionName",
            p.proname										as "objectName",
            l.lanname										as "languageName", 
            p.procost 										as "cost", 
            p.prorows 										as "rows",
            p.proisstrict 									as "isStrict",
            t.typname										as "returnType",
            case p.provolatile when 'i' then 'immutable'
                               when 's' then 'stable'
                               when 'v' then 'volatile'	
            end 											as "volatility",
            p.prosrc										as "source",
            pg_catalog.obj_description(p.oid, 'pg_proc')    AS "description",
		    case p.proparallel when 's' then 'safe'
                               when 'u' then 'unsafe'
                               when 'r' then 'restricted'   
		                       else ''
            end 											as "parallelMode",
            p.oid                                           as oid
            
        from pg_namespace ns
        left outer join pg_proc p on p.pronamespace = ns.oid
        left outer join pg_language l on p.prolang = l.oid
        left outer join pg_type t on t.oid=p.prorettype
        where ns.nspname = {FILTER_SCHEMA}  {RELTYPE}) cc
    {FILTER_OBJECT}
    order by cc.schema, cc."functionName" `;

export const queryProcedureParameters: string =
    `SELECT *
    FROM (select 
        ns.nspname										as "schema", 
        p.proname										as "functionName",
        p.proname										as "objectName",
        case param.proargmodes
            when 'i' then 'in'
            when 'o' then 'out' 
            when 'b' then 'inout'
            when 'v' then 'variadic'
            when 't' then 'table' end 					as "proArgModes",
        param.proallargtypes							as "proArgType",
        param.proargnames								as "proArgNames",
        format_type(param.proallargtypes,null)			as "proArgTypeName",
        array_position(p.proargnames, param.proargnames) as "proArgPosition"
    from pg_namespace ns
    left outer join pg_proc p on p.pronamespace = ns.oid
    inner join (select oid, pronamespace, unnest(proargmodes) as proargmodes,unnest(proallargtypes) as proallargtypes,unnest(proargnames) as proargnames
                from pg_proc where proallargtypes is not null) param on param.pronamespace=p.pronamespace and p.oid=param.oid
    where ns.nspname = {FILTER_SCHEMA}) cc
    {FILTER_OBJECT} 
    order by cc.schema, cc."functionName", cc."proArgModes", cc."proArgPosition"`;

export const queryTablesView: string =
    `SELECT * 
    FROM (SELECT
        CONCAT(table_catalog, '.', table_schema)                    AS "parent",
        table_catalog                                               AS "catalog",
        table_schema                                                AS "schema",
        table_name                                                  AS "tableName",
        table_name                                                  AS "objectName",
        CONCAT(table_schema, '.', table_name)                       AS "fullname",
        CONCAT(table_catalog, '.', table_schema, '.', table_name)   AS "fullCatalogName",
        pg_catalog.obj_description(c.oid, 'pg_class')               AS "description",
        relkind                                                     AS "type",
		pg_get_viewdef(c.oid)										AS "view_source"
        --r = ordinary table, i = index, S = sequence, v = view, m = materialized view, c = composite type, t = TOAST table, f = foreign table
    FROM information_schema.tables x
    INNER JOIN pg_catalog.pg_class c ON c.relname = table_name
    WHERE table_schema = {FILTER_SCHEMA} {RELTYPE}
    ORDER BY table_catalog, table_schema, table_name) AS CC
    {FILTER_OBJECT}`;

export const queryTablesViewFields: string =
    `SELECT * 
    FROM (SELECT
            CONCAT(table_catalog, '.', table_schema, '.', table_name)          AS "parent",
            table_catalog                                                      AS "catalog",
            table_schema                                                       AS "schema",
            table_name                                                         AS "tableName",
            table_name                                                         AS "objectName",            
            column_name                                                        AS "columnName",
            CONCAT(table_schema, '.', table_name, '.', column_name)            AS "fullName",
            CONCAT(table_catalog, '.', table_schema, '.', table_name, '.', column_name) AS "fullCatalogName",
            column_default                                                     AS "defaultWithTypeCast",
            CASE WHEN column_default ILIKE 'nextval%' THEN TRUE ELSE FALSE END AS "isAutoIncrement",
            CAST(is_nullable AS BOOLEAN)                                       AS "allowNull",
            NOT CAST(is_nullable AS BOOLEAN)                                   AS "notNull",
            CASE WHEN udt_name = 'hstore' THEN udt_name
            ELSE LOWER(data_type) END                                          AS "type",
            t.typcategory                                                      AS "typeCategory", -- See http://www.postgresql.org/docs/current/static/catalog-pg-type.html
            CASE WHEN t.typcategory = 'E' THEN
                (SELECT Array_agg(e.enumlabel)
                FROM pg_catalog.pg_type t JOIN pg_catalog.pg_enum e ON t.oid = e.enumtypid
                WHERE t.typname = udt_name)
            ELSE NULL END                                                      AS "enumValues",
            CASE WHEN LOWER(data_type) = 'array' THEN information_schema._pg_char_max_length(arraytype.oid, a.atttypmod)
            ELSE character_maximum_length END                                  AS "length",
            CASE WHEN LOWER(data_type) = 'array' THEN COALESCE(
                information_schema._pg_datetime_precision(arraytype.oid, a.atttypmod),
                information_schema._pg_numeric_precision(arraytype.oid, a.atttypmod))
            WHEN datetime_precision IS NULL THEN numeric_precision
            ELSE datetime_precision END                                        AS "precision",
            CASE WHEN LOWER(data_type) = 'array' THEN information_schema._pg_numeric_scale(arraytype.oid, a.atttypmod)
            ELSE numeric_scale END                                             AS "scale",
            CASE WHEN LEFT(udt_name, 1) = '_' THEN LEFT(format_type(a.atttypid, NULL), -2)
            ELSE NULL END                                                      AS "arrayType",
            a.attndims                                                         AS "arrayDimension",
            domain_catalog                                                     AS "domainCatalog",
            domain_schema                                                      AS "domainSchema",
            domain_name                                                        AS "domainName",
            CASE WHEN domain_name IS NOT NULL THEN CONCAT(domain_schema, '.', domain_name)
            ELSE NULL END                                                      AS "domainFullName",
            CASE WHEN t.typcategory IN ('E', 'C') THEN format_type(a.atttypid, NULL)
            ELSE NULL END                                                      AS "userDefinedType",
            udt_name                                                           AS "udtName",      -- User Defined Types such as composite, enumerated etc.
            ordinal_position                                                   AS "position",
            pg_catalog.col_description(c.oid, columns.ordinal_position :: INT) AS "description"
        FROM information_schema.columns
            INNER JOIN pg_catalog.pg_attribute a ON a.attname = column_name
            INNER JOIN pg_catalog.pg_class c ON c.oid = a.attrelid AND c.relname = table_name
            LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace AND pg_catalog.pg_table_is_visible(c.oid)
            LEFT JOIN pg_catalog.pg_type arraytype ON arraytype.typname = RIGHT(udt_name, -1)
            INNER JOIN pg_type t ON a.atttypid = t.oid
        WHERE table_schema = {FILTER_SCHEMA} {RELTYPE}    
        ORDER BY table_schema, table_name, ordinal_position) CC
    {FILTER_OBJECT}`;
/*
-- NOTE: I tried to avoid joins by using information_schema.columns views's content as CTE after adding below selections.
-- However performance of CTE seems much worse then view with joins. 550 ms vs 80 ms.

-- OID of array's elements' type. (NOT array type itself):
--COLAESCE(bt.typelem, t.typelem)

-- Array's elements' character length:
--information_schema._pg_char_max_length(COALESCE(bt.typelem, t.typelem), a.atttypmod) AS "array_character_maximum_length",

-- Array's elements' precision:
--COALESCE(
--    information_schema._pg_datetime_precision(COALESCE(bt.typelem, t.typelem), a.atttypmod),
--    information_schema._pg_numeric_precision(COALESCE(bt.typelem, t.typelem), a.atttypmod)
--) as "array_precision",

-- Array's elements' scale:
--information_schema._pg_numeric_scale(COALESCE(bt.typelem, t.typelem), a.atttypmod) AS "array_scale",

--Array's elements' type. LEFT(.., -2) removes [] from end of data type such as integer[].
--CASE WHEN RIGHT(format_type(a.atttypid, NULL), 2) = '[]' THEN LEFT(format_type(a.atttypid, NULL), -2) ELSE NULL END AS "array_data_type",

-- Array dimesnion:
--CASE WHEN a.attndims = 0 THEN NULL ELSE a.attndims END as "array_dimension",

-- Column description at position attnum:
--pg_catalog.col_description(c.oid, a.attnum::information_schema.cardinal_number) AS "description",

-- Enum values
--(SELECT Array_agg(e.enumlabel) FROM pg_catalog.pg_enum e WHERE t.oid = e.enumtypid) AS "enum_values",
*/

export const queryTablesIndexes: string =
    `SELECT * 
    FROM (SELECT
                current_database()                                                          AS "catalog",
                ns.nspname                                                                  AS "schema",
                CONCAT(ns.nspname, '.', i.relname) 				                            AS "fullName",
                CONCAT(current_database(), '.', ns.nspname, '.', i.relname) 				AS "fullCatalogName",
                CONCAT(current_database(), '.', ns.nspname, '.', t.relname) 				AS "tableFullCatalogName",
                current_database() 															AS "tableCatalog",
                ns.nspname 																	AS "tableSchema",
                t.relname 																	AS "tableName",                
                t.relname 																	AS "objectName",
                i.relname 																	AS "name",
                ix.indisunique 																AS "isUnique",
                ix.indisprimary																AS "isPrimaryKey",	
                pg_get_expr(ix.indexprs, t.oid, true)                                       AS "expresion",
                pg_catalog.obj_description(i.oid, 'pg_class')                               AS "description" 	
            FROM pg_index ix
            INNER JOIN pg_class t ON (t.oid = ix.indrelid AND t.relkind = 'r')	-- Tables only from pg_class, r: ordinary table
            INNER JOIN pg_class i ON (i.oid = ix.indexrelid AND i.relkind = 'i')	-- Indexes only from pg_class, i: indexes
            INNER JOIN pg_namespace ns ON (ns.oid = t.relnamespace)
            WHERE ns.nspname = {FILTER_SCHEMA}
            ORDER BY t.relname,i.relname) CC
    {FILTER_OBJECT}`;

export const queryTableIndexesField: string =
    `SELECT * 
    FROM (SELECT
                CONCAT(current_database(), '.', ns.nspname, '.', t.relname, '.', a.attname) AS "columnFullCatalogName",
                CONCAT(current_database(), '.', ns.nspname, '.', i.relname) 				AS "indexFullCatalogName",
                CONCAT(current_database(), '.', ns.nspname, '.', t.relname) 				AS "tableFullCatalogName",
                current_database() 															AS "tableCatalog",
                ns.nspname 																	AS "tableSchema",
                t.relname 																	AS "tableName",
                t.relname 																	AS "objectName",
                a.attname 																	AS "columnName",
                i.relname 																	AS "indexName",
                ix.indisunique 																AS "isUnique",
                ix.indisprimary																AS "isPrimaryKey",
                CASE WHEN (ix.indoption[(SELECT MIN(CASE WHEN ix.indkey[i] = a.attnum THEN i ELSE NULL END)::int
                    FROM generate_series(ARRAY_LOWER(ix.indkey, 1), ARRAY_UPPER(ix.indkey, 1)) i)]) & 1 = 1 THEN 'DESC' ELSE 'ASC' END AS "descasc",
					
				CASE WHEN (ix.indoption[(SELECT MIN(CASE WHEN ix.indkey[i] = a.attnum THEN i ELSE NULL END)::int
                    FROM generate_series(ARRAY_LOWER(ix.indkey, 1), ARRAY_UPPER(ix.indkey, 1)) i)])	& 2 = 2 THEN 'NULLS FIRST' ELSE 'NULLS LAST' END  as "nulls",
                (SELECT MIN(CASE WHEN ix.indkey[i] = a.attnum THEN i ELSE NULL END)::int
                    FROM generate_series(ARRAY_LOWER(ix.indkey, 1), ARRAY_UPPER(ix.indkey, 1)) i) AS "position"
            
            FROM pg_index ix
            INNER JOIN pg_class t ON (t.oid = ix.indrelid AND t.relkind = 'r')	-- Tables only from pg_class, r: ordinary table
            INNER JOIN pg_class i ON (i.oid = ix.indexrelid AND i.relkind = 'i')	-- Indexes only from pg_class, i: indexes
            INNER JOIN pg_attribute a ON (a.attrelid = t.oid AND a.attnum = ANY(ix.indkey))
            INNER JOIN pg_namespace ns ON (ns.oid = t.relnamespace)
            WHERE ns.nspname = {FILTER_SCHEMA}
            ORDER BY t.relname,i.relname, 11, 14) CC
    {FILTER_OBJECT}`; 

export const queryTableCheckConstraint: string =
    `SELECT *
    FROM (WITH base AS (
            SELECT
                r.oid                                                                                   AS r_oid,
                r.relname                                                                               AS r_relname,
                r.relowner                                                                              AS r_relowner,
                r.relkind                                                                               AS r_relkind,
                r.relnamespace                                                                          AS r_relnamespace,
                nr.nspname                                                                              AS nr_nspname,
                nr.oid                                                                                  AS nr_oid,
                c.oid                                                                                   AS c_oid,
                c.conname                                                                               AS c_conname,
                c.contype                                                                               AS c_contype,
                c.conindid                                                                              AS c_conindid,
                c.confkey                                                                               AS c_confkey,
                c.confrelid                                                                             AS c_confrelid,
                c.condeferrable                                                                         AS c_condeferrable,
                c.condeferred                                                                           AS c_condeferred,
                c.connamespace                                                                          AS c_connamespace,
                c.confmatchtype                                                                         AS c_confmatchtype,
                c.confupdtype                                                                           AS c_confupdtype,
                c.confdeltype                                                                           AS c_confdeltype,
                c.conkey                                                                                AS c_conkey,
                c.consrc																				AS c_consrc
        
            FROM
                pg_namespace nr,
                pg_class r,
                pg_constraint c
        
            WHERE
                r.oid = c.conrelid
        ),
        
        layer2 AS (
            SELECT
                base.*,
                nc.nspname                                                                              AS nc_nspname,
                nc.oid                                                                                  AS nc_oid
            FROM
                base,
                pg_namespace nc
        
            WHERE
                base.nr_oid = base.r_relnamespace AND
                nc.oid = base.c_connamespace AND
                base.r_relkind = 'r'::"char" AND
                NOT pg_is_other_temp_schema(base.nr_oid)
        ),
        
        table_constraints AS (
            SELECT
                layer2.c_oid                                                                            AS constraint_oid,  -- Extra
                current_database()::information_schema.sql_identifier                                   AS constraint_catalog,
                layer2.nc_nspname::information_schema.sql_identifier 								    AS constraint_schema,
                layer2.c_conname::information_schema.sql_identifier 						            AS constraint_name,
                current_database()::information_schema.sql_identifier                                   AS table_catalog,
                layer2.nr_nspname::information_schema.sql_identifier                                    AS table_schema,
                layer2.r_relname::information_schema.sql_identifier                                     AS table_name,
                CASE c_contype
                    WHEN 'c'::"char" THEN 'CHECK'::text
                    WHEN 'f'::"char" THEN 'FOREIGN KEY'::text
                    WHEN 'p'::"char" THEN 'PRIMARY KEY'::text
                    WHEN 'u'::"char" THEN 'UNIQUE'::text
                    ELSE NULL::text
                END::information_schema.character_data                                                  AS constraint_type,
                CASE
                    WHEN c_condeferrable THEN 'YES'::text
                    ELSE 'NO'::text
                END::information_schema.yes_or_no                                                       AS is_deferrable,
                CASE
                    WHEN c_condeferred THEN 'YES'::text
                    ELSE 'NO'::text
                END::information_schema.yes_or_no                                                       AS initially_deferred,
                layer2.c_consrc																			AS source_check
            FROM
                layer2
        
            WHERE
                (c_contype <> ALL (ARRAY [ 't'::"char", 'x'::"char" ])) AND
                (pg_has_role(r_relowner, 'USAGE'::text) OR
                has_table_privilege(r_oid,
                'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'::text) OR
                has_any_column_privilege(r_oid, 'INSERT, UPDATE, REFERENCES'::text))
        
        /* not null de campos
            UNION ALL
                SELECT
                    nr.oid                                                                              AS constraint_oid,  -- Extra
                    current_database()::information_schema.sql_identifier 								AS constraint_catalog,
                    nr.nspname::information_schema.sql_identifier 										AS constraint_schema,
                    (((((nr.oid::text || '_'::text) || r.oid::text) || '_'::text) || a.attnum::text)
                        || '_not_null'::text)::information_schema.sql_identifier 						AS constraint_name,
                    current_database()::information_schema.sql_identifier 								AS table_catalog,
                    nr.nspname::information_schema.sql_identifier 										AS table_schema,
                    r.relname::information_schema.sql_identifier 										AS table_name,
                    'CHECK'::character varying::information_schema.character_data 						AS constraint_type,
                    'NO'::character varying::information_schema.yes_or_no 							    AS is_deferrable,
                    'NO'::character varying::information_schema.yes_or_no 							    AS initially_deferred,
                    null::text																			AS source_check
                FROM
                    pg_namespace nr,
                    pg_class r,
                    pg_attribute a
                WHERE
                    nr.oid = r.relnamespace AND
                    r.oid = a.attrelid AND
                    a.attnotnull AND
                    a.attnum > 0 AND
                    NOT a.attisdropped AND
                    r.relkind = 'r'::"char" AND
                    NOT pg_is_other_temp_schema(nr.oid) AND
                    (pg_has_role(r.relowner, 'USAGE'::text) OR
                    has_table_privilege(r.oid,
                    'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'::text) OR
                    has_any_column_privilege(r.oid, 'INSERT, UPDATE, REFERENCES'::text))*/
        
        ),
        
        key_column_usage AS (
            SELECT
                ss.c_oid																				AS constraint_oid, -- Extra
                current_database()::information_schema.sql_identifier                                   AS constraint_catalog,
                ss.nc_nspname::information_schema.sql_identifier                                        AS constraint_schema,
                ss.c_conname::information_schema.sql_identifier                                         AS constraint_name,
                current_database()::information_schema.sql_identifier                                   AS table_catalog,
                ss.nr_nspname::information_schema.sql_identifier                                        AS table_schema,
                ss.r_relname::information_schema.sql_identifier                                         AS table_name,
                a.attname::information_schema.sql_identifier                                            AS column_name,
                (x) . n::information_schema.cardinal_number                                             AS ordinal_position,
                CASE
                    WHEN ss.c_contype = 'f'::"char"
                        THEN information_schema._pg_index_position(ss.c_conindid, ss.c_confkey [(ss.x) . n ])
                    ELSE NULL::integer
                    END::information_schema.cardinal_number                                             AS position_in_unique_constraint
        
            FROM
                pg_attribute a,
                (SELECT *, information_schema._pg_expandarray(c_conkey) AS x
                    FROM layer2 WHERE (c_contype = ANY (ARRAY [ 'p'::"char", 'u'::"char", 'f'::"char" ]))) ss
        
            WHERE
        
                ss.r_oid = a.attrelid AND
                a.attnum = (ss.x) . x AND
                NOT a.attisdropped AND
                (pg_has_role(ss.r_relowner, 'USAGE'::text) OR
                has_column_privilege(ss.r_oid, a.attnum, 'SELECT, INSERT, UPDATE, REFERENCES'::text))
        
        
        
        
        ),
        
        referential_constraints AS (
            SELECT
                base.c_oid                                                                              AS constraint_oid,
                current_database()::information_schema.sql_identifier                                   AS constraint_catalog,
                base.nr_nspname::information_schema.sql_identifier                                      AS constraint_schema,
                base.c_conname::information_schema.sql_identifier                                       AS constraint_name,
                CASE
                WHEN npkc.nspname IS NULL THEN NULL::name
                ELSE current_database()
                END::information_schema.sql_identifier                                                  AS unique_constraint_catalog,
                npkc.nspname::information_schema.sql_identifier                                         AS unique_constraint_schema,
                pkc.conname::information_schema.sql_identifier                                          AS unique_constraint_name,
                CASE base.c_confmatchtype
                    WHEN 'f'::"char" THEN 'FULL'::text
                    WHEN 'p'::"char" THEN 'PARTIAL'::text
                    WHEN 's'::"char" THEN 'NONE'::text
                    ELSE NULL::text
                END::information_schema.character_data                                                  AS match_option,
                CASE base.c_confupdtype
                    WHEN 'c'::"char" THEN 'CASCADE'::text
                    WHEN 'n'::"char" THEN 'SET NULL'::text
                    WHEN 'd'::"char" THEN 'SET DEFAULT'::text
                    WHEN 'r'::"char" THEN 'RESTRICT'::text
                    WHEN 'a'::"char" THEN 'NO ACTION'::text
                    ELSE NULL::text
                END::information_schema.character_data                                                  AS update_rule,
                CASE base.c_confdeltype
                    WHEN 'c'::"char" THEN 'CASCADE'::text
                    WHEN 'n'::"char" THEN 'SET NULL'::text
                    WHEN 'd'::"char" THEN 'SET DEFAULT'::text
                    WHEN 'r'::"char" THEN 'RESTRICT'::text
                    WHEN 'a'::"char" THEN 'NO ACTION'::text
                    ELSE NULL::text
                END::information_schema.character_data                                                  AS delete_rule
        
            FROM
                base
                LEFT JOIN pg_depend d1 ON d1.objid = base.c_oid AND d1.classid = 'pg_constraint'::regclass::oid AND
                    d1.refclassid = 'pg_class'::regclass::oid AND d1.refobjsubid = 0
                LEFT JOIN pg_depend d2 ON d2.refclassid = 'pg_constraint'::regclass::oid AND
                    d2.classid = 'pg_class'::regclass::oid AND d2.objid = d1.refobjid AND
                    d2.objsubid = 0 AND d2.deptype = 'i'::"char"
                LEFT JOIN pg_constraint pkc ON pkc.oid = d2.refobjid AND
                    (pkc.contype = ANY (ARRAY [ 'p'::"char", 'u'::"char" ]))AND pkc.conrelid = base.c_confrelid
                LEFT JOIN pg_namespace npkc ON pkc.connamespace = npkc.oid
        
            WHERE
                base.nr_oid = base.c_connamespace AND
                base.c_contype = 'f'::"char" AND
                (
                    pg_has_role(base.r_relowner, 'USAGE'::text) OR
                    has_table_privilege(base.r_oid, 'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'::text) OR
                has_any_column_privilege(base.r_oid, 'INSERT, UPDATE, REFERENCES'::text)
                )
        )
        
        SELECT
            tc.constraint_schema                                            AS "constraintSchema",
            tc.constraint_name                                              AS "constraintName",
            tc.constraint_type                                              AS "constraintType",
            pg_catalog.obj_description(tc.constraint_oid, 'pg_constraint')  AS "constraintDescription",
            kcu.column_name                                                 AS "columnName",
            tc.table_schema                                                 AS "tableSchema",
            tc.table_name                                                   AS "tableName",
            tc.table_name                                                   AS "objectName",
            kcu.ordinal_position                                            AS "position",
            kcu.position_in_unique_constraint                               AS "uniqueConstraintPosition",
            tc.is_deferrable                                                AS "isDeferrable",
            tc.initially_deferred                                           AS "initiallyDeferred",
            rc.match_option                                                 AS "matchOption",
            rc.update_rule                                                  AS "updateRule",
            rc.delete_rule                                                  AS "deleteRule",
            pg_catalog.obj_description(tc.constraint_oid, 'pg_constraint')  AS "description",
            -- REFERENCED COLUMN DETAILS
            kcu2.table_schema                                               AS "referencedTableSchema",
            kcu2.table_name                                                 AS "referencedTableName",
            kcu2.column_name                                                AS "referencedColumnName",
            tc.source_check													AS "check_source"
        
        FROM
            table_constraints tc
            LEFT JOIN key_column_usage kcu
                ON tc.constraint_oid = kcu.constraint_oid
                    AND tc.constraint_catalog = kcu.constraint_catalog
                    AND tc.constraint_schema = kcu.constraint_schema
                    AND tc.constraint_name = kcu.constraint_name
            LEFT JOIN referential_constraints rc
                ON tc.constraint_oid = rc.constraint_oid
                    AND kcu.constraint_name = rc.constraint_name
                    AND kcu.constraint_catalog = rc.constraint_catalog
                    AND kcu.constraint_schema = rc.constraint_schema
            LEFT JOIN key_column_usage kcu2
                ON kcu2.ordinal_position = kcu.position_in_unique_constraint
                    AND kcu2.constraint_name = rc.unique_constraint_name
                    AND kcu.constraint_catalog = rc.constraint_catalog
                    AND kcu.constraint_schema = rc.constraint_schema
        
        
        WHERE
            tc.constraint_schema = {FILTER_SCHEMA}
            AND (kcu.table_schema = {FILTER_SCHEMA} OR kcu.table_schema IS NULL)
            AND (kcu2.table_schema = {FILTER_SCHEMA} OR kcu2.table_schema IS NULL)    -- IF NO REFERNCED COLUMN EXISTS. ie. Unique Index etc.
            AND tc.constraint_type IN ('CHECK','FOREIGN KEY','UNIQUE')

        ORDER BY
            tc.table_schema,
            tc.table_name,
            tc.constraint_name,
            kcu.ordinal_position,
            kcu.position_in_unique_constraint) CC
    {FILTER_OBJECT}`;

export const queryGenerator: string =
    `SELECT *
     FROM (SELECT
            current_database()                                                          AS "catalog",
            ns.nspname                                                                  AS "schema",
            CONCAT(ns.nspname, '.', t.relname) 				                            AS "fullName",
            CONCAT(current_database(), '.', ns.nspname, '.', t.relname) 				AS "fullCatalogName",                
            current_database() 															AS "tableCatalog",
            ns.nspname 																	AS "tableSchema",
            t.relname 																	AS "sequenceName",                
            t.relname 																	AS "objectName",                
            pg_catalog.obj_description(sq.seqrelid, 'pg_class')                         AS "description",
            sq.seqincrement																AS "increment" 	
        FROM pg_catalog.pg_sequence sq
        INNER JOIN pg_class t ON (t.oid = sq.seqrelid AND t.relkind = 'S')	
        INNER JOIN pg_namespace ns ON (ns.oid = t.relnamespace)
        WHERE ns.nspname = {FILTER_SCHEMA} ) CC
     {FILTER_OBJECT}`;

export const queryTrigger: string =
    `SELECT *
    FROM (select    trg.oid											as oid, 
                    trg.tgname										as "triggerName",
                    trg.tgname										as "objectName",
                    CASE trg.tgtype::integer & 66
                        WHEN 2 THEN 'BEFORE'
                        WHEN 64 THEN 'INSTEAD OF'
                        ELSE 'AFTER'
                    end 											as "triggerFire",
                    case trg.tgtype::integer & cast(28 as int2)
                        when 16 then 'UPDATE'
                        when  8 then 'DELETE'
                        when  4 then 'INSERT'
                        when 20 then 'INSERT, UPDATE'
                        when 28 then 'INSERT, UPDATE, DELETE'
                        when 24 then 'UPDATE, DELETE'
                        when 12 then 'INSERT, DELETE'
                    end 											as "triggerEvent",
                    pgpr.proname									as "functionName",
                    ns.nspname 									    as "schema",
                    ns.nspname||'.'||tbl.relname				    as "fullTableName",
                    tbl.relname 									as "tableName",
                    obj_description(trg.oid) 					    as "description",
                    case
                    when trg.tgenabled='O' then true
                        else false
                    end 										    as "enabled",
                    case trg.tgtype::integer & 1
                    when 1 then 'row'::text
                    else 'statement'::text
                    end 										    as "triggerLevel"
            FROM pg_trigger trg
            INNER JOIN pg_class tbl on trg.tgrelid = tbl.oid
            INNER JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
            INNER JOIN pg_proc pgpr on pgpr.oid=trg.tgfoid 
            WHERE trg.tgisinternal = false and ns.nspname = {FILTER_SCHEMA}
        order by pgpr.proname ) cc
    {FILTER_OBJECT}
    order by cc.schema, cc."functionName"`;

export const queryCheckIndexes = `WITH indexes AS (
    SELECT
      tnsp.nspname AS schema_name,
      trel.relname AS table_name,
      irel.relname AS index_name,
      string_agg(a.attname, ', ' ORDER BY c.ordinality) AS columns
    FROM pg_index AS i
    JOIN pg_class AS trel ON trel.oid = i.indrelid
    JOIN pg_namespace AS tnsp ON trel.relnamespace = tnsp.oid
    JOIN pg_class AS irel ON irel.oid = i.indexrelid
    JOIN pg_attribute AS a ON trel.oid = a.attrelid
    JOIN LATERAL unnest(i.indkey) 
      WITH ORDINALITY AS c(colnum, ordinality)
        ON a.attnum = c.colnum
    WHERE i.indisprimary = false and tnsp.nspname = {FILTER_SCHEMA}
    GROUP BY i, tnsp.nspname, trel.relname, irel.relname
  )
  SELECT
    i.table_name,
    i.index_name AS "Deletioncandidateindex",
    i.columns AS "Deletioncandidatecolumns",
    j.index_name AS "Existingindex",
    j.columns AS "Existingcolumns"
  FROM indexes i
  JOIN indexes j
    ON i.schema_name = j.schema_name
    AND i.table_name = j.table_name
    AND j.columns LIKE i.columns || ',%';`   


 