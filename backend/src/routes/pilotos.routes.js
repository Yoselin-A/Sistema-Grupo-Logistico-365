const express = require("express");
const pool = require("../config/db");
const { autorizarModulo } = require("../middleware/auth.middleware");
const router = express.Router();

// Acceso independiente, administrado desde Roles.
router.use("/pilotos", autorizarModulo("pilotos"));

const ok = (res, data=null, message="Operación realizada correctamente.") => res.json({ok:true,message,data});
const fail = (res,status,message,error=null) => res.status(status).json({ok:false,message,error:error?.message||error||null});
const txt=(v,max=80)=>String(v??"").trim().replace(/\s+/g," ").slice(0,max);
const date=(v)=>v instanceof Date && !Number.isNaN(v.getTime()) ? `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,"0")}-${String(v.getDate()).padStart(2,"0")}` : /^\d{4}-\d{2}-\d{2}/.test(String(v||""))?String(v).slice(0,10):null;
const id=(v)=>Number.isInteger(Number(v))&&Number(v)>0?Number(v):null;


function validarPiloto(b){
 const fn=date(b.fecha_nacimiento);
 if(fn){ const hoy=new Date(); const nac=new Date(fn+'T12:00:00'); let edad=hoy.getFullYear()-nac.getFullYear(); if(hoy.getMonth()<nac.getMonth()||(hoy.getMonth()===nac.getMonth()&&hoy.getDate()<nac.getDate())) edad--; if(edad<18) return 'El piloto debe ser mayor de 18 años.'; }
 const el=date(b.fecha_emision_licencia), vl=date(b.fecha_vencimiento_licencia); if(el&&vl&&el>=vl)return 'La fecha de vencimiento de licencia debe ser posterior a la emisión.';
 const ed=date(b.fecha_emision_dpi), vd=date(b.fecha_vencimiento_dpi); if(ed&&vd&&ed>=vd)return 'La fecha de vencimiento del DPI debe ser posterior a la emisión.';
 return null;
}

const fullName=`TRIM(CONCAT_WS(' ', p.primer_nombre, NULLIF(p.segundo_nombre,''), p.primer_apellido, NULLIF(p.segundo_apellido,'')))`;

async function nextCode(c){
  const [r]=await c.query("SELECT codigo_piloto FROM piloto WHERE codigo_piloto LIKE 'PIL-%'");
  let n=0; for(const x of r){const m=String(x.codigo_piloto||'').match(/^PIL-(\d+)$/i); if(m)n=Math.max(n,Number(m[1]));}
  return `PIL-${String(n+1).padStart(3,'0')}`;
}

router.get('/pilotos', async(req,res)=>{
 try{
  const [rows]=await pool.query(`SELECT p.id,p.codigo_piloto,p.primer_nombre,p.segundo_nombre,p.primer_apellido,p.segundo_apellido,
   p.licencia,p.dpi,p.nit,DATE_FORMAT(p.fecha_nacimiento,'%Y-%m-%d') fecha_nacimiento,
   DATE_FORMAT(p.fecha_emision_licencia,'%Y-%m-%d') fecha_emision_licencia,
   DATE_FORMAT(p.fecha_vencimiento_licencia,'%Y-%m-%d') fecha_vencimiento_licencia,
   DATE_FORMAT(p.fecha_emision_dpi,'%Y-%m-%d') fecha_emision_dpi,
   DATE_FORMAT(p.fecha_vencimiento_dpi,'%Y-%m-%d') fecha_vencimiento_dpi,
   ${fullName} nombre_piloto,
   DATEDIFF(p.fecha_vencimiento_licencia,CURDATE()) dias_licencia,
   DATEDIFF(p.fecha_vencimiento_dpi,CURDATE()) dias_dpi
   FROM piloto p ORDER BY p.id DESC`);
  const [history] = await pool.query("SELECT id,codigo_asignacion,tipo_asignacion,piloto_id,detalle_operativo_json FROM asignacion WHERE piloto_id IS NOT NULL ORDER BY id DESC");
  for (const p of rows) {
    p.expedientes = history.filter(a => Number(a.piloto_id)===Number(p.id)).map(a => {
      let d={}; try { d=typeof a.detalle_operativo_json==='string'?JSON.parse(a.detalle_operativo_json):a.detalle_operativo_json||{}; } catch {}
      // Solo documentos del piloto; no publica costos ni datos de otros módulos.
      return {codigo:a.codigo_asignacion,tipo:a.tipo_asignacion,licencia:d.licencia||null,dpi:d.dpi_piloto||null,
        nit:d.nit_piloto||null,fecha_nacimiento:date(d.fecha_nacimiento_piloto),pasaporte:d.pasaporte||null,pais:d.pais_piloto||d.nacionalidad||null};
    });
  }
  return ok(res,rows);
 }catch(e){return fail(res,500,'No se pudieron cargar los pilotos.',e)}
});

router.post('/pilotos', async(req,res)=>{
 const c=await pool.getConnection();
 try{await c.beginTransaction();
  const b=req.body||{}; const validacion=validarPiloto(b); if(validacion){await c.rollback(); return fail(res,400,validacion);} const licencia=txt(b.licencia,25).toUpperCase(); const dpi=txt(b.dpi,20); const nit=txt(b.nit,20);
  if(!txt(b.primer_nombre,30)||!txt(b.primer_apellido,35)||!licencia) { await c.rollback(); return fail(res,400,'Primer nombre, primer apellido y licencia son obligatorios.'); }
  const [dup]=await c.query('SELECT id FROM piloto WHERE licencia=? OR (?<>\'\' AND dpi=?) LIMIT 1',[licencia,dpi,dpi]);
  if(dup.length){await c.rollback(); return fail(res,409,'Ya existe un piloto con esa licencia o DPI.');}
  const codigo=await nextCode(c);
  const vals=[codigo,txt(b.primer_nombre,30),txt(b.segundo_nombre,30)||null,txt(b.primer_apellido,35),txt(b.segundo_apellido,35)||null,licencia,dpi||null,nit||null,date(b.fecha_nacimiento),date(b.fecha_emision_licencia),date(b.fecha_vencimiento_licencia),date(b.fecha_emision_dpi),date(b.fecha_vencimiento_dpi)];
  const [r]=await c.query(`INSERT INTO piloto (codigo_piloto,primer_nombre,segundo_nombre,primer_apellido,segundo_apellido,licencia,dpi,nit,fecha_nacimiento,fecha_emision_licencia,fecha_vencimiento_licencia,fecha_emision_dpi,fecha_vencimiento_dpi) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,vals);
  await c.commit(); return ok(res,{id:r.insertId,codigo_piloto:codigo},'Piloto registrado correctamente.');
 }catch(e){await c.rollback(); return fail(res,500,'No se pudo registrar el piloto.',e)} finally{c.release()}
});

router.put('/pilotos/:id', async(req,res)=>{
 try{const pid=id(req.params.id); if(!pid)return fail(res,400,'Piloto inválido.'); const [[existing]]=await pool.query('SELECT * FROM piloto WHERE id=?',[pid]);
  if(!existing)return fail(res,404,'El piloto no existe.');
  const b={...existing,...(req.body||{})}; const validacion=validarPiloto(b); if(validacion)return fail(res,400,validacion);
  if(!txt(b.primer_nombre,30)||!txt(b.primer_apellido,35)||!txt(b.licencia,25))return fail(res,400,'Primer nombre, primer apellido y licencia son obligatorios.');
  const [dup]=await pool.query("SELECT id FROM piloto WHERE id<>? AND (licencia=? OR (?<>'' AND dpi=?)) LIMIT 1",[pid,txt(b.licencia,25).toUpperCase(),txt(b.dpi,20),txt(b.dpi,20)]);
  if(dup.length)return fail(res,409,'Ya existe un piloto con esa licencia o DPI.');
  await pool.query(`UPDATE piloto SET primer_nombre=?,segundo_nombre=?,primer_apellido=?,segundo_apellido=?,licencia=?,dpi=?,nit=?,fecha_nacimiento=?,fecha_emision_licencia=?,fecha_vencimiento_licencia=?,fecha_emision_dpi=?,fecha_vencimiento_dpi=? WHERE id=?`,[
   txt(b.primer_nombre,30),txt(b.segundo_nombre,30)||null,txt(b.primer_apellido,35),txt(b.segundo_apellido,35)||null,txt(b.licencia,25).toUpperCase(),txt(b.dpi,20)||null,txt(b.nit,20)||null,date(b.fecha_nacimiento),date(b.fecha_emision_licencia),date(b.fecha_vencimiento_licencia),date(b.fecha_emision_dpi),date(b.fecha_vencimiento_dpi),pid]);
  return ok(res,null,'Piloto actualizado correctamente.');
 }catch(e){return fail(res,500,'No se pudo actualizar el piloto.',e)}
});

router.delete('/pilotos/:id', async(req,res)=>{
 try{const pid=id(req.params.id); if(!pid)return fail(res,400,'Piloto inválido.');
  const [[use]]=await pool.query('SELECT COUNT(*) total FROM asignacion WHERE piloto_id=?',[pid]);
  if(Number(use.total)>0)return fail(res,409,'No se puede eliminar: el piloto tiene asignaciones relacionadas.');
  await pool.query('DELETE FROM piloto WHERE id=?',[pid]); return ok(res,null,'Piloto eliminado correctamente.');
 }catch(e){return fail(res,500,'No se pudo eliminar el piloto.',e)}
});
module.exports=router;