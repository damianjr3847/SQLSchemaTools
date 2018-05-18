"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const GlobalTypes = require("./globalTypes");
const globalFunction = require("./globalFunction");
const metadataQuerys = require("./pgMetadataQuerys");
const pg = require("pg");
const defaultSchema = 'public';
function outFileScript(aFields, aData, aTable, filesPath) {
    const saveTo = 10000;
    let insertQuery = '';
    let contSaveTo = 0;
    let qQuery = [];
    let y = 0;
    for (let i = 0; i < aData.length; i++) {
        qQuery = [];
        y = aData[i].length;
        for (let j = 0; j < aFields.length; j++)
            qQuery.push(globalFunction.varToJSON(aData[i][aFields[j].AName], aFields[j].AType, 0));
        insertQuery += JSON.stringify(qQuery) + GlobalTypes.CR;
        if (contSaveTo < saveTo)
            contSaveTo++;
        else {
            fs.appendFileSync(filesPath + aTable + '.sql', insertQuery, 'utf8');
            contSaveTo = 0;
            insertQuery = '';
        }
    }
    fs.appendFileSync(filesPath + aTable + '.sql', insertQuery, 'utf8');
    contSaveTo = 0;
    insertQuery = '';
}
class pgExtractLoadData {
    constructor() {
        this.connectionString = {};
        this.dbRole = '';
        this.schema = defaultSchema;
        this.filesPath = '';
    }
    analyzeQuery(aQuery, aObjectName, aObjectType) {
        let aRet = aQuery;
        aRet = aRet.replace(new RegExp('{FILTER_SCHEMA}', 'g'), "'" + this.schema + "'");
        if (aObjectName !== '')
            aRet = aRet.replace('{FILTER_OBJECT}', "WHERE UPPER(TRIM(cc." + '"objectName")) = ' + "'" + aObjectName.toUpperCase().trim() + "'");
        else
            aRet = aRet.replace('{FILTER_OBJECT}', '');
        aRet = aRet.replace('{RELTYPE}', " AND relkind IN ('r','t','f') ");
        return aRet;
    }
    async loadData(ahostName, aportNumber, adatabase, adbUser, adbPassword, objectName, adbRole) {
        let tableName = '';
        let filesDirSource1 = [];
        let rQuery;
        let rTables = [];
        let rFields = [];
        let qFields = [];
        let query = '';
        //let queryValues: string = '';
        //let xCont: number = 0;
        //let xContGral: number = 0;
        let contline = 0;
        let j = 0;
        let rs;
        let filelines;
        let jsonline;
        let processLine = async (line) => {
            let aValues = [];
            if (contline === 0) {
                jsonline = JSON.parse(line);
                qFields = [];
                query = 'INSERT INTO ' + globalFunction.quotedString(tableName) + '( ';
                for (let z = 0; z < jsonline.length; z++) {
                    j = rFields.findIndex(aItem => (aItem.tableName.toLowerCase().trim() === tableName.toLowerCase().trim() && aItem.columnName.toUpperCase().trim() === jsonline[z].toUpperCase().trim()));
                    if (j !== -1) {
                        qFields.push({ AName: rFields[j].columnName, AType: rFields[j].type });
                        query += rFields[j].columnName + ',';
                    }
                    else
                        throw new Error('El campo ' + jsonline[z] + ' de la tabla ' + tableName + ', no existe');
                }
                query = query.substr(0, query.length - 1) + ') VALUES(';
                for (let z = 1; z < jsonline.length; z++) {
                    query += '$' + z.toString() + ',';
                }
                query += '$' + jsonline.length.toString() + ')';
            }
            else {
                if (line !== '') {
                    try {
                        jsonline = JSON.parse(line);
                        for (let z = 0; z < jsonline.length; z++) {
                            if (jsonline[z] === null)
                                aValues.push(null);
                            else if (typeof jsonline[z] === 'object') {
                                for (let jname in jsonline[z]) {
                                    if (jname === '$numberlong' || jname === '$numberint') {
                                        aValues.push(jsonline[z][jname]);
                                    }
                                    else if (jname === '$binary') {
                                        aValues.push(Buffer.from(jsonline[z][jname], 'base64'));
                                    }
                                    else if (jname === '$date') {
                                        aValues.push(jsonline[z][jname]);
                                    }
                                    else
                                        throw new Error(jname + ', tipo de dato no soportado');
                                }
                            }
                            else
                                aValues.push(jsonline[z]);
                        }
                        await this.pgDb.query(query, aValues);
                    }
                    catch (err) {
                        throw new Error('linea ' + contline.toString() + '. ' + err.message);
                    }
                }
            }
            contline += 1;
        };
        this.connectionString.host = ahostName;
        this.connectionString.database = adatabase;
        this.connectionString.password = adbPassword;
        this.connectionString.user = adbUser;
        this.connectionString.port = aportNumber;
        this.pgDb = new pg.Client(this.connectionString);
        try {
            if (!(this.filesPath.endsWith('/')))
                this.filesPath += '/';
            await this.pgDb.connect();
            await this.pgDb.query('SET ROLE ' + adbRole);
            this.dbRole = adbRole;
            try {
                await this.pgDb.query('BEGIN');
                rQuery = await this.pgDb.query(this.analyzeQuery(metadataQuerys.queryTablesView, objectName, GlobalTypes.ArrayobjectType[2]), []);
                rTables = rQuery.rows;
                rQuery = await this.pgDb.query(this.analyzeQuery(metadataQuerys.queryTablesViewFields, objectName, GlobalTypes.ArrayobjectType[5]), []);
                rFields = rQuery.rows;
                await this.pgDb.query('COMMIT');
                filesDirSource1 = globalFunction.readRecursiveDirectory(this.filesPath);
                for (let i = 0; i < filesDirSource1.length; i++) {
                    tableName = filesDirSource1[i].file;
                    tableName = tableName.substring(0, tableName.length - 4); //quito extension
                    if (globalFunction.includeObject(this.excludeObject, GlobalTypes.ArrayobjectType[2], tableName)) {
                        filelines = fs.readFileSync(filesDirSource1[i].path + filesDirSource1[i].file);
                        console.log(filesDirSource1[i].path + filesDirSource1[i].file);
                        contline = 0;
                        //for (let line in filelines.toString().split(String.fromCharCode(10))) {
                        try {
                            await this.pgDb.query('BEGIN');
                            await filelines.toString().split(/\r?\n/).forEach(async function (line) {
                                await processLine(line);
                            });
                            await this.pgDb.query('COMMIT');
                        }
                        catch (err) {
                            console.error('linea ' + contline + ' ' + err.message);
                            throw new Error(err.message);
                        }
                    }
                }
            }
            finally {
                await this.pgDb.end();
            }
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    }
    async loadDataStream(ahostName, aportNumber, adatabase, adbUser, adbPassword, objectName, adbRole) {
        let execute = (aStream, afileStream) => {
            return new Promise((resolve, reject) => {
                afileStream.pipe(aStream).on('finish', function () {
                    resolve();
                }).on('error', function (err) {
                    reject(err);
                });
            });
        };
        let tableName = '';
        let filesDirSource1 = [];
        let copyFrom = require('pg-copy-streams').from;
        filesDirSource1 = globalFunction.readRecursiveDirectory(this.filesPath);
        this.connectionString.host = ahostName;
        this.connectionString.database = adatabase;
        this.connectionString.password = adbPassword;
        this.connectionString.user = adbUser;
        this.connectionString.port = aportNumber;
        this.pgDb = new pg.Client(this.connectionString);
        //await this.pgDb.query('SET ROLE ' + adbRole);
        try {
            await this.pgDb.connect();
            try {
                for (let i = 0; i < filesDirSource1.length; i++) {
                    tableName = filesDirSource1[i].file;
                    tableName = tableName.substring(0, tableName.length - 4).toLowerCase(); //quito extension
                    console.log('Importando ' + tableName);
                    let stream = this.pgDb.query(copyFrom('COPY ' + globalFunction.quotedString(tableName) + ' FROM STDIN WITH CSV HEADER'));
                    let fileStream = fs.createReadStream(filesDirSource1[i].path + filesDirSource1[i].file);
                    await execute(stream, fileStream);
                }
            }
            finally {
                await this.pgDb.end();
            }
        }
        catch (err) {
            console.log(err.message);
        }
    }
}
exports.pgExtractLoadData = pgExtractLoadData;
/*
DELETE FROM public."$$$carga";
DELETE FROM public.age_reto;
DELETE FROM public.art_adic;
DELETE FROM public.art_arch;
DELETE FROM public.art_arch2;
DELETE FROM public.art_arch_eti;
DELETE FROM public.art_arch_impo;
DELETE FROM public.art_bloq;
DELETE FROM public.art_camb;
DELETE FROM public.art_ccom;
DELETE FROM public.art_cmbo;
DELETE FROM public.art_color;
DELETE FROM public.art_comb;

DELETE FROM public.art_fabr;
DELETE FROM public.art_form;
DELETE FROM public.art_form_aux;
DELETE FROM public.art_grup;
DELETE FROM public.art_impo_precios;
DELETE FROM public.art_line;
DELETE FROM public.art_lipr;
DELETE FROM public.art_obje;
DELETE FROM public.art_ofea;
DELETE FROM public.art_ofer;
DELETE FROM public.art_ofer_poli;
DELETE FROM public.art_plan;
DELETE FROM public.art_poli;
DELETE FROM public.art_poli_grup;
DELETE FROM public.art_poli_impo;
DELETE FROM public.art_reca_poli;
DELETE FROM public.art_rubr;
DELETE FROM public.art_rubr_impo;
DELETE FROM public.art_sets;
DELETE FROM public.art_suge;
DELETE FROM public.car_lug_entr;
DELETE FROM public.car_oc_asoc;
DELETE FROM public.che_dato;
DELETE FROM public.che_item;
DELETE FROM public.cli_adic;
DELETE FROM public.cli_agco;
DELETE FROM public.cli_arch;
DELETE FROM public.cli_artr;
DELETE FROM public.cli_arve;
DELETE FROM public.cli_camb;
DELETE FROM public.cli_cobr;
DELETE FROM public.cli_ctac;
DELETE FROM public.cli_ctac_tipo;
DELETE FROM public.cli_cuit;
DELETE FROM public.cli_ean;
DELETE FROM public.cli_grup;
DELETE FROM public.cli_impo_maestro;
DELETE FROM public.cli_obje;
DELETE FROM public.cli_palm;
DELETE FROM public.cli_perc;
DELETE FROM public.cli_perc_exc;
DELETE FROM public.cli_perc_impo;
DELETE FROM public.cli_perc_trz;
DELETE FROM public.cli_piib_cord;
DELETE FROM public.cli_piib_corr;
DELETE FROM public.cli_piib_tuc;
DELETE FROM public.cli_reor;
DELETE FROM public.cli_repa;
DELETE FROM public.cli_repa_dia;
DELETE FROM public.cli_repa_impo;
DELETE FROM public.cli_rubm;
DELETE FROM public.cli_rubr;
DELETE FROM public.cli_ruta;
DELETE FROM public.cli_sucu;
DELETE FROM public.cli_sucu_ean;
DELETE FROM public.cli_supe;
DELETE FROM public.cli_tran;
DELETE FROM public.cli_vend;
DELETE FROM public.cli_vend_impo;
DELETE FROM public.cli_zona;
DELETE FROM public.cloud_items;
DELETE FROM public.cloud_pedidos;
DELETE FROM public.cns_dato;
DELETE FROM public.cns_item;
DELETE FROM public.cob_reca;
DELETE FROM public.cob_reci;

DELETE FROM public.con_cgrp;
DELETE FROM public.con_chen;
DELETE FROM public.con_cheq;
DELETE FROM public.con_cheq_impo;
DELETE FROM public.con_cier;
DELETE FROM public.con_comp;
DELETE FROM public.con_conc;
DELETE FROM public.con_conc_ctas;
DELETE FROM public.con_conc_impo;
DELETE FROM public.con_conc_rela;
DELETE FROM public.con_conc_tmp;
DELETE FROM public.con_coti;

DELETE FROM public.con_deta;
DELETE FROM public.con_expo_cuen;
DELETE FROM public.con_expo_leye;
DELETE FROM public.con_grps;
DELETE FROM public.con_grup;
DELETE FROM public.con_impo_asie;
DELETE FROM public.con_impo_cuen;
DELETE FROM public.con_impu;
DELETE FROM public.con_inve;
DELETE FROM public.con_miem;
DELETE FROM public.con_mone;
DELETE FROM public.con_movi;
DELETE FROM public.con_obli;

DELETE FROM public.con_subx;
DELETE FROM public.cot_tbl_loca;
DELETE FROM public.cot_tbl_rubr;
DELETE FROM public.emp_afjp;
DELETE FROM public.emp_arch;
DELETE FROM public.emp_cate;
DELETE FROM public.emp_clas;
DELETE FROM public.emp_cond;
DELETE FROM public.emp_cont;
DELETE FROM public.emp_docu;
DELETE FROM public.emp_dpto;
DELETE FROM public.emp_eciv;
DELETE FROM public.emp_fami;
DELETE FROM public.emp_fpag;
DELETE FROM public.emp_osoc;
DELETE FROM public.emp_rela;
DELETE FROM public.emp_sexo;
DELETE FROM public.emp_sind;
DELETE FROM public.exp_ccu;
DELETE FROM public.exp_edi_clie;
DELETE FROM public.exp_irsa_cove;
DELETE FROM public.exp_irsa_vend;
DELETE FROM public.exp_unil;
DELETE FROM public.fac_caja;
DELETE FROM public.fac_camb;
DELETE FROM public.fac_cate;
DELETE FROM public.fac_dato;
DELETE FROM public.fac_estc;
DELETE FROM public.fac_impo_ctacte;
DELETE FROM public.fac_impu;
DELETE FROM public.fac_item;
DELETE FROM public.fac_moti;
DELETE FROM public.fac_pago;
DELETE FROM public.fac_pago_cajcob2;
DELETE FROM public.fac_pedi;
DELETE FROM public.fac_pedi_impo;
DELETE FROM public.fac_perc;
DELETE FROM public.fac_perc_cord;
DELETE FROM public.fac_perc_mzda;
DELETE FROM public.fac_perc_pol;
DELETE FROM public.fac_perc_trz;
DELETE FROM public.fac_perc_tuc_coef;
DELETE FROM public.fac_prev;
DELETE FROM public.fac_rapipago;
DELETE FROM public.fac_ruta;
DELETE FROM public.fyb_imp_cab_devol;
DELETE FROM public.fyb_imp_cab_ped;
DELETE FROM public.fyb_imp_cobr;
DELETE FROM public.fyb_imp_det_devol;
DELETE FROM public.fyb_imp_det_impues;
DELETE FROM public.fyb_imp_det_pago;
DELETE FROM public.fyb_imp_det_ped;
DELETE FROM public.fyb_imp_doc_imput;
DELETE FROM public.fyb_nocom;
DELETE FROM public.fyb_vzd;
DELETE FROM public.guia_dato;
DELETE FROM public.guia_item;
DELETE FROM public.guia_log;
DELETE FROM public.guia_prev;
DELETE FROM public.imp_cost;
DELETE FROM public.mail_cfg;
DELETE FROM public.map_call;
DELETE FROM public.map_capa;
DELETE FROM public.map_clzn;
DELETE FROM public.map_loca;
DELETE FROM public.maq_resp;
DELETE FROM public.mobiles_mens;
DELETE FROM public.mobiles_opc;
DELETE FROM public.mrs_vend;

DELETE FROM public.obj_item;
DELETE FROM public.ovw_foto;
DELETE FROM public.ovw_indi;
DELETE FROM public.ped_estc;
DELETE FROM public.ped_item;
DELETE FROM public.ped_palm;
DELETE FROM public.ped_palm_arch;
DELETE FROM public.ped_plan;
DELETE FROM public.ped_suge_dato;
DELETE FROM public.ped_suge_item;
DELETE FROM public.ped_tipo;
DELETE FROM public.ped_vada;
DELETE FROM public.ped_vait;
DELETE FROM public.ped_vend;
DELETE FROM public.ped_visi;
DELETE FROM public.pfl_clru;
DELETE FROM public.pfl_ruta;
DELETE FROM public.pos_cobr;
DELETE FROM public.pos_conf;
DELETE FROM public.pos_cove;
DELETE FROM public.prd_obje;
DELETE FROM public.pro_arca;
DELETE FROM public.pro_arch;
DELETE FROM public.pro_arch_impo;
DELETE FROM public.pro_caja;
DELETE FROM public.pro_copg;
DELETE FROM public.pro_cuot;
DELETE FROM public.pro_faca;
DELETE FROM public.pro_fada;
DELETE FROM public.pro_fait;
DELETE FROM public.pro_fasc;
DELETE FROM public.pro_impo_ctacte;
DELETE FROM public.pro_impo_poli;
DELETE FROM public.pro_impu;
DELETE FROM public.pro_ocda;
DELETE FROM public.pro_ocit;
DELETE FROM public.pro_ocsc;
DELETE FROM public.pro_octi;
DELETE FROM public.pro_pago;
DELETE FROM public.pro_pare;
DELETE FROM public.pro_pare_gan;
DELETE FROM public.pro_pare_pol;
DELETE FROM public.pro_pare_stafe;
DELETE FROM public.pro_poli;
DELETE FROM public.pro_ret_trz;
DELETE FROM public.pro_rete;
DELETE FROM public.pro_rete_comp;
DELETE FROM public.pro_rgar;
DELETE FROM public.pro_rgsu;
DELETE FROM public.pro_rgtb;
DELETE FROM public.pro_riib;
DELETE FROM public.pro_riib_er;
DELETE FROM public.pro_riib_mono;
DELETE FROM public.pro_riib_rn;
DELETE FROM public.pro_riib_sj;
DELETE FROM public.pro_riva;
DELETE FROM public.ps_art_cate;
DELETE FROM public.rep_deta;
DELETE FROM public.rep_item;
DELETE FROM public.rep_tipo;
DELETE FROM public.rpt_fisc;
DELETE FROM public.rpt_fisc_leye;
DELETE FROM public.rpt_maqu;
DELETE FROM public.sk2_barra;
DELETE FROM public.sk2_ped_tmp;
DELETE FROM public.sld_bcos;
DELETE FROM public.sld_bcos_conc;
DELETE FROM public.smt_art_prio;
DELETE FROM public.smt_art_suge;
DELETE FROM public.smt_cob_impu;
DELETE FROM public.smt_cob_pago;
DELETE FROM public.smt_cob_valo;
DELETE FROM public.smt_conf;
DELETE FROM public.smt_conf_mad;
DELETE FROM public.smt_fac_dato;
DELETE FROM public.smt_fac_item;
DELETE FROM public.smt_fac_perc;
DELETE FROM public.smt_imp_art_cmbo;
DELETE FROM public.smt_log;
DELETE FROM public.smt_msg;
DELETE FROM public.smt_valo;
DELETE FROM public.smt_ven_trak;
DELETE FROM public.spc_cierre;
DELETE FROM public.spc_replog;
DELETE FROM public.stk_cier;
DELETE FROM public.stk_comp;
DELETE FROM public.stk_cost;

DELETE FROM public.stk_deta;
DELETE FROM public.stk_line;
DELETE FROM public.stk_lote;
DELETE FROM public.stk_lote_calidad;
DELETE FROM public.stk_lote_impo;
DELETE FROM public.stk_movi;
DELETE FROM public.stk_movi_impo;
DELETE FROM public.stk_orda;
DELETE FROM public.stk_orit;
DELETE FROM public.stk_sald;
DELETE FROM public.stk_segu;
DELETE FROM public.tbl_afip;
DELETE FROM public.tbl_afip_act;
DELETE FROM public.tbl_afip_cp;
DELETE FROM public.tbl_bank;
DELETE FROM public.tbl_caea;
DELETE FROM public.tbl_cai;
DELETE FROM public.tbl_camio;
DELETE FROM public.tbl_chof;
DELETE FROM public.tbl_comp;
DELETE FROM public.tbl_cono;
DELETE FROM public.tbl_cove;
DELETE FROM public.tbl_cove_cta;
DELETE FROM public.tbl_ctac;
DELETE FROM public.tbl_dias;
DELETE FROM public.tbl_empr;
DELETE FROM public.tbl_errorcode;
DELETE FROM public.tbl_feri;
DELETE FROM public.tbl_fotc;
DELETE FROM public.tbl_foto;
DELETE FROM public.tbl_inc_ter;
DELETE FROM public.tbl_ipim;
DELETE FROM public.tbl_mes;
DELETE FROM public.tbl_nvis;
DELETE FROM public.tbl_pais;
DELETE FROM public.tbl_pcia;
DELETE FROM public.tbl_piva;
DELETE FROM public.tbl_plant;
DELETE FROM public.tbl_procai;
DELETE FROM public.tbl_ptvt;
DELETE FROM public.tbl_sucu;
DELETE FROM public.tbl_talo;
DELETE FROM public.tbl_tiva;
DELETE FROM public.tmp_calculo_mp;
DELETE FROM public.tmp_cashflow;
DELETE FROM public.tmp_cob_iibb;
DELETE FROM public.tmp_con_z002;
DELETE FROM public.tmp_consol;
DELETE FROM public.tmp_consol2;
DELETE FROM public.tmp_corrige_saldos;
DELETE FROM public.tmp_edi;
DELETE FROM public.tmp_iibb_bsas;
DELETE FROM public.tmp_iibb_cap;
DELETE FROM public.tmp_iibb_cord;
DELETE FROM public.tmp_iibb_mzda;
DELETE FROM public.tmp_iibb_tuc;
DELETE FROM public.tmp_impo_pedi;
DELETE FROM public.tmp_montos;
DELETE FROM public.tmp_pare_gan;
DELETE FROM public.tmp_ped_dias;
DELETE FROM public.tmp_ped_suge;
DELETE FROM public.tmp_rank;
DELETE FROM public.tmp_reca_poli;
DELETE FROM public.tmp_reservas_pedidos;
DELETE FROM public.tmp_sin_stok;
DELETE FROM public.tmp_vendfc;
DELETE FROM public.tmp_venn_cli;
DELETE FROM public.tmp_venn_comp;
DELETE FROM public.tmp_venn_grup;
DELETE FROM public.ubi_arch;
DELETE FROM public.ubi_arch_eti;
DELETE FROM public.ubi_arma_val;
DELETE FROM public.ubi_arma_val_dat;
DELETE FROM public.ubi_arq_tmp;
DELETE FROM public.ubi_arqu;
DELETE FROM public.ubi_comp;
DELETE FROM public.ubi_deta;
DELETE FROM public.ubi_falt;
DELETE FROM public.ubi_movi;
DELETE FROM public.ubi_movi_tmp;
DELETE FROM public.ubi_sald;
DELETE FROM public.ubi_sect;
DELETE FROM public.ubi_user;
DELETE FROM public.ubi_vend;
DELETE FROM public.ven_part;
DELETE FROM public.ven_part_it;
DELETE FROM public.wap_devmot;
DELETE FROM public.wap_devolu;
DELETE FROM public.wap_stkinv;
DELETE FROM public.wap_stkusr;
DELETE FROM public.web_user;
DELETE FROM public.web_user2;
DELETE FROM public.xxx_canje;
DELETE FROM public.xxx_cfgm;
DELETE FROM public.xxx_cfgp;
DELETE FROM public.xxx_cfgr;

DELETE FROM public.xxx_conf;
DELETE FROM public.xxx_cons;
DELETE FROM public.xxx_defs;
DELETE FROM public.xxx_grup;
DELETE FROM public.xxx_menu;
DELETE FROM public.xxx_perc;
DELETE FROM public.xxx_perm;
DELETE FROM public.xxx_segu;
DELETE FROM public.xxx_sk2_param;
DELETE FROM public.xxx_vers;
DELETE FROM public.zcb_cubo;
DELETE FROM public.zcf_lock;
DELETE FROM public.zcf_menu;
DELETE FROM public.zlg_expo;
DELETE FROM public.zlg_ingr;
DELETE FROM public.zlg_menu;
DELETE FROM public.zlg_metadata_log;
DELETE FROM public.zms_grup;
DELETE FROM public.zms_mens;
DELETE FROM public.zrp_serv;
DELETE FROM public.zrp_sync;

DELETE FROM public.art_divi;
DELETE FROM public.art_divi2;
DELETE FROM public.con_ccos;
DELETE FROM public.con_cuen;
DELETE FROM public.con_srng;
DELETE FROM public.obj_dato;
DELETE FROM public.stk_depo;
DELETE FROM public.xxx_clav;


*/ 
//# sourceMappingURL=pgExtractLoadData.js.map