const express = require("express");
const pool = require("../config/db");
const { autorizarModulo } = require("../middleware/auth.middleware");
const router = express.Router();
router.use("/recibos", autorizarModulo("recibos", "facturacion"));

const ok = (res,data,message="Correcto") => res.json({ok:true,data,message});
const fail = (res,code,message) => res.status(code).json({ok:false,message});
const num = n => Number.isFinite(Number(n)) ? Number(n) : 0;
const id = v => Number.isSafeInteger(Number(v)) && Number(v)>0 ? Number(v) : null;
const text = (v,max=250) => String(v ?? "").trim().slice(0,max);
const safeImage = value => {
  if (!value) return null;
  const s=String(value);
  if(s.length>500000 || !/^data:image\/(png|jpeg);base64,[a-z0-9+/=]+$/i.test(s)) throw Error("Firma o sello inválido o demasiado grande (máx. 375 KB).");
  return s;
};

router.get("/recibos/bootstrap",async (_req,res)=>{
 try{
   const [recibos] = await pool.query(`SELECT r.id,r.numero,r.serie,r.lugar,r.fecha,r.monto_total,r.moneda,r.concepto,r.forma_pago,r.banco,r.referencia,r.observaciones,r.firma_cobrador,
    r.cliente_id,r.cotizacion_id,r.asignacion_id, c.nombre_empresa, co.codigo_cotizacion,
    r.firma_imagen,r.sello_imagen
    FROM recibo_caja r JOIN cliente c ON c.id=r.cliente_id LEFT JOIN cotizacion co ON co.id=r.cotizacion_id ORDER BY r.id DESC`);
   const [clientes] = await pool.query(`SELECT id,codigo_cliente,nombre_empresa,nit FROM cliente ORDER BY nombre_empresa`);
   const [cotizaciones] = await pool.query(`SELECT co.id,co.codigo_cotizacion,co.cliente_id,co.moneda_ui, a.id AS asignacion_id,
    COALESCE(SUM(d.cantidad*d.precio_unitario),0) * IF(co.aplica_iva=1,1.12,1) AS total
    FROM cotizacion co JOIN asignacion a ON a.cotizacion_id=co.id
    LEFT JOIN cotizacion_detalle d ON d.cotizacion_id=co.id
    WHERE LOWER(co.estado_ui)='aprobada'
      AND NOT EXISTS (SELECT 1 FROM recibo_caja r WHERE r.cotizacion_id = co.id)
    GROUP BY co.id,a.id ORDER BY co.id DESC`);
   const [detalles] = await pool.query(`SELECT * FROM recibo_caja_detalle ORDER BY id`);
   return ok(res,{recibos,clientes,cotizaciones,detalles});
 }catch(e){console.error(e);return fail(res,500,"No se pudieron cargar los recibos. Verifica la migración SQL.");}
});
router.post("/recibos",async(req,res)=>{
 const con=await pool.getConnection();
 try{
  const b=req.body||{};const cliente=id(b.cliente_id);
  if(!cliente)return fail(res,400,"Selecciona un cliente.");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(b.fecha||'')))return fail(res,400,"Fecha inválida.");
  const detalles=Array.isArray(b.detalles)?b.detalles:[];
  const forma=['cheque','efectivo','transferencia','otros'].includes(b.forma_pago)?b.forma_pago:'transferencia';
  const monto=Number(b.monto_total);
  if(!Number.isFinite(monto)||monto<0) return fail(res,400,"Monto total inválido.");
  const firma=safeImage(b.firma_imagen),sello=safeImage(b.sello_imagen);
  await con.beginTransaction();
  if(id(b.cotizacion_id)){
    const [[existe]]=await con.query(`SELECT id FROM recibo_caja WHERE cotizacion_id=? LIMIT 1 FOR UPDATE`,[id(b.cotizacion_id)]);
    if(existe)throw Error('Esta cotización ya cuenta con un recibo de caja. No puede duplicarse.');
    const [[vinculo]]=await con.query(`SELECT ct.id,ct.cliente_id,a.id AS asignacion_id
       FROM cotizacion ct JOIN asignacion a ON a.cotizacion_id=ct.id
       WHERE ct.id=? AND LOWER(ct.estado_ui)='aprobada' LIMIT 1`,[id(b.cotizacion_id)]);
    if(!vinculo || Number(vinculo.cliente_id)!==cliente || (id(b.asignacion_id) && Number(vinculo.asignacion_id)!==id(b.asignacion_id))){
      throw Error('La cotización y asignación deben estar aprobadas y corresponder al cliente indicado.');
    }
  }
  const [ins]=await con.query(`INSERT INTO recibo_caja
   (numero,serie,cotizacion_id,asignacion_id,cliente_id,fecha,monto_total,moneda,concepto,forma_pago,banco,referencia,observaciones,firma_cobrador,firma_imagen,sello_imagen,lugar)
   VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[
    text(b.numero,25),text(b.serie||'A',10),id(b.cotizacion_id),id(b.asignacion_id),cliente,b.fecha,
    monto,b.moneda==='USD'?'USD':'GTQ',text(b.concepto),forma,text(b.banco,120),text(b.referencia,90),text(b.observaciones,5000),text(b.firma_cobrador,150),firma,sello,text(b.lugar||"Guatemala",120)
   ]);
  if(!String(b.numero||'').trim())throw Error('El número del recibo es obligatorio.');
  for(const d of detalles){
   await con.query(`INSERT INTO recibo_caja_detalle(recibo_id,factura,valor,retencion) VALUES(?,?,?,?)`,[
    ins.insertId,text(d.factura,50),Math.max(0,num(d.valor)),Math.max(0,num(d.retencion))
   ]);
  }
  await con.commit();return ok(res,{id:ins.insertId},'Recibo de caja guardado.');
 }catch(e){await con.rollback();console.error(e);return fail(res,400,e.code==='ER_DUP_ENTRY'?'Ya existe ese número de recibo.':e.message||'Error al guardar.');}
 finally{con.release();}
});
// Edición transaccional: conserva el ID y sustituye sus detalles, sin duplicar facturas.
router.put('/recibos/:id',async(req,res)=>{
 const rid=id(req.params.id);if(!rid)return fail(res,400,'Recibo inválido.');
 const con=await pool.getConnection();
 try{
  const b=req.body||{};const cliente=id(b.cliente_id);
  if(!cliente || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.fecha||'')))return fail(res,400,'Cliente y fecha válidos son obligatorios.');
  if(!String(b.numero||'').trim())return fail(res,400,'El número del recibo es obligatorio.');
  const monto=Number(b.monto_total);
  if(!Number.isFinite(monto)||monto<0)return fail(res,400,'Monto inválido.');
  const forma=['cheque','efectivo','transferencia','otros'].includes(b.forma_pago)?b.forma_pago:'transferencia';
  const firma=safeImage(b.firma_imagen);
  await con.beginTransaction();
  const [[actual]]=await con.query('SELECT id FROM recibo_caja WHERE id=? FOR UPDATE',[rid]);
  if(!actual)throw Error('El recibo ya no existe.');
  if(id(b.cotizacion_id)){
    const [[duplicado]]=await con.query('SELECT id FROM recibo_caja WHERE cotizacion_id=? AND id<>? LIMIT 1 FOR UPDATE',[id(b.cotizacion_id),rid]);
    if(duplicado)throw Error('Esta cotización ya está vinculada con otro recibo.');
    const [[vinculo]]=await con.query(`SELECT co.cliente_id,a.id AS asignacion_id FROM cotizacion co
      JOIN asignacion a ON a.cotizacion_id=co.id WHERE co.id=? AND LOWER(co.estado_ui)='aprobada' LIMIT 1`,[id(b.cotizacion_id)]);
    if(!vinculo||Number(vinculo.cliente_id)!==cliente)throw Error('La cotización no corresponde al cliente o no está aprobada.');
  }
  await con.query(`UPDATE recibo_caja SET numero=?,serie=?,cotizacion_id=?,asignacion_id=?,cliente_id=?,fecha=?,
    monto_total=?,moneda=?,concepto=?,forma_pago=?,banco=?,referencia=?,observaciones=?,firma_cobrador=?,firma_imagen=?,sello_imagen=NULL,lugar=? WHERE id=?`,[
    text(b.numero,25),text(b.serie||'A',10),id(b.cotizacion_id),id(b.asignacion_id),cliente,b.fecha,
    monto,b.moneda==='USD'?'USD':'GTQ',text(b.concepto),forma,text(b.banco,120),text(b.referencia,90),
    text(b.observaciones,5000),text(b.firma_cobrador,150),firma,text(b.lugar||'Guatemala',120),rid
  ]);
  await con.query('DELETE FROM recibo_caja_detalle WHERE recibo_id=?',[rid]);
  for(const d of Array.isArray(b.detalles)?b.detalles:[]){
    const v=Number(d.valor||0),r=Number(d.retencion||0);
    if(!Number.isFinite(v)||!Number.isFinite(r)||v<0||r<0)throw Error('El valor y la retención deben ser positivos.');
    await con.query('INSERT INTO recibo_caja_detalle(recibo_id,factura,valor,retencion) VALUES(?,?,?,?)',[
      rid,text(d.factura,50),v,r
    ]);
  }
  await con.commit();return ok(res,{id:rid},'Recibo actualizado correctamente.');
 }catch(e){await con.rollback();console.error(e);return fail(res,400,e.code==='ER_DUP_ENTRY'?'Ya existe ese número o cotización.':e.message||'No se pudo actualizar.');}
 finally{con.release();}
});

router.delete('/recibos/:id',async(req,res)=>{
 try{
  const [r]=await pool.query(`DELETE FROM recibo_caja WHERE id=?`,[id(req.params.id)]);
  return r.affectedRows?ok(res,{id:id(req.params.id)},'Recibo eliminado.'):fail(res,404,'Recibo no encontrado.');
 }catch(e){return fail(res,500,'No se pudo eliminar.');}
});
module.exports=router;
