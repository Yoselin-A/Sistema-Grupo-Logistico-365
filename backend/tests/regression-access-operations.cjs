// Base local de pruebas. Crea registros propios y los elimina al terminar.
require("dotenv").config();
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../src/config/db");
const { autenticarToken } = require("../src/middleware/auth.middleware");
const app = express();
app.use(express.json());
app.use(autenticarToken);
for (const module of ["proveedores", "pilotos", "operaciones", "comprobantes", "reportes"]) app.use(require(`../src/routes/${module}.routes`));
app.use("/ia", require("../src/routes/ia.routes"));
app.use("/mantenimiento", require("../src/routes/mantenimiento.routes"));
const fixture = { assignments: [], pilots: [], receipts: [], user: null, role: null };
const requestFetch = global.fetch;
let externalCalls = 0;
global.fetch = () => { externalCalls++; throw new Error("No se permite llamar a proveedores de IA"); };
process.env.GROQ_API_KEY = "configured-but-not-used";

async function main() {
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const admin = jwt.sign({ sub: "1" }, process.env.JWT_SECRET, { expiresIn: "10m" });
  async function call(url, method = "GET", body, token = admin) {
    const response = await requestFetch(base + url, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, json: await response.json() };
  }
  const pass = label => console.log("PASS: " + label);
  try {
    const melissa = jwt.sign({ sub: "7" }, process.env.JWT_SECRET, { expiresIn: "10m" });
    assert.equal((await call("/proveedores", "GET", undefined, melissa)).status, 403);
    pass("Melissa no accede a Proveedores mediante URL/API");
    const [role] = await pool.query("INSERT INTO role (codigo_rol,nombre_rol) VALUES ('TSTGL365','Prueba temporal GL365')"); fixture.role = role.insertId;
    const [user] = await pool.query("INSERT INTO usuario (primer_nombre,primer_apellido,nombre_usuario,email,password_hash,rol_id) VALUES ('Prueba','Temporal','test-gl365-permisos','test-gl365@example.invalid','unused',?)", [fixture.role]); fixture.user = user.insertId;
    const token = jwt.sign({ sub: String(fixture.user) }, process.env.JWT_SECRET, { expiresIn: "10m" });
    for (const permissions of [["crm","ia","reportes"], ["proveedores","pilotos","ia","reportes"], ["crm","ia","reportes"]]) {
      const saved = await call(`/mantenimiento/roles/${fixture.role}/permisos`, "PUT", { permissions });
      assert.equal(saved.status, 200, JSON.stringify(saved.json));
      assert.equal((await call("/proveedores", "GET", undefined, token)).status, permissions.includes("proveedores") ? 200 : 403);
      assert.equal((await call("/pilotos", "GET", undefined, token)).status, permissions.includes("pilotos") ? 200 : 403);
    }
    pass("Mantenimiento concede y revoca permisos con el mismo JWT, sin volver a iniciar sesión");
    const report = await call("/reportes/bootstrap", "GET", undefined, token);
    assert.equal(report.status,200); assert.equal(report.json.data.proveedores.length,0); assert.equal(report.json.data.asignaciones.length,0); assert.ok(report.json.data.clientes.length > 0);
    const boot = await call("/ia/bootstrap", "GET", undefined, token);
    assert.equal(boot.status,200); assert.ok(!("proveedores" in boot.json.data.kpis)); assert.ok(!("suppliers" in boot.json.data));
    assert.equal((await call("/ia/ask","POST",{question:"Cuántos proveedores hay"},token)).status,403);
    const restricted = await call("/ia/ask","POST",{question:"Resumen general"},token);
    assert.equal(restricted.status,200); assert.ok(!/proveedores|saldo por cobrar/i.test(restricted.json.answer));
    for (const question of ["Información del sistema","Cuántos clientes hay","Saldo por cobrar","Rutas","Flota disponible","Viajes con retraso","Rentabilidad","Cuántos pilotos hay"]) {
      const reply=await call("/ia/ask","POST",{question});
      assert.equal(reply.status,200,JSON.stringify(reply.json)); assert.equal(reply.json.provider.used,false); assert.ok(reply.json.answer.length>25);
    }
    assert.equal(externalCalls,0);
    pass("Reportes e IA respetan permisos; ocho consultas responden sin llamadas externas ni créditos");
    const pilot = await call("/operaciones/catalogos/pilotos","POST",{piloto:"Prueba Temporal",licencia:"TEST-GL365-2609",dpi:"9999999999991",nit:"TEST-2609",fecha_nacimiento:"1985-04-23"});
    assert.equal(pilot.status,200,JSON.stringify(pilot.json)); fixture.pilots.push(pilot.json.data.id);
    assert.equal(String(pilot.json.data.fecha_nacimiento).slice(0,10),"1985-04-23"); assert.equal(pilot.json.data.dpi,"9999999999991");
    const pilotId=pilot.json.data.id;
    const update=await call(`/pilotos/${pilotId}`,"PUT",{segundo_nombre:"Conservado"}); assert.equal(update.status,200);
    const masters=await call("/pilotos"); const master=masters.json.data.find(p=>p.id===pilotId);
    assert.equal(master.fecha_nacimiento,"1985-04-23"); assert.equal(master.dpi,"9999999999991");
    pass("Alta de Operaciones guarda DPI/NIT/nacimiento y edición parcial de Pilotos conserva documentos");
    const [[state]]=await pool.query("SELECT id FROM estado_asignacion WHERE LOWER(nombre_estado_asignacion) NOT LIKE '%final%' ORDER BY id LIMIT 1");
    const [[client]]=await pool.query("SELECT id FROM cliente ORDER BY id LIMIT 1");
    const [[route]]=await pool.query("SELECT id FROM ruta ORDER BY id LIMIT 1");
    for (const [index,type] of ["fiduca","centroamerica"].entries()) {
      const snapshot={tipo_asignacion:type,placa_piloto:"TEST-01",empresa_transporte:"Prueba",nit_transportista:"TEST",caat:"TEST",numero_economico:"TEST",fianza:"N/A",codigo_aduanero:"N/A",pasaporte:"N/A",cabezal:"TEST-01",furgon:"N/A",codigo_equipo:"N/A",tamano_equipo:"40",fecha_posicionamiento:"2026-10-09",fecha_nacimiento_piloto:"1985-04-23"};
      const [created]=await pool.query("INSERT INTO asignacion (codigo_asignacion,tipo_asignacion,detalle_operativo_json,cliente_id,ruta_id,piloto_id,fecha_carga,fecha_descarga,estado_asignacion_id) VALUES (?,?,?,?,?,?,'2026-10-09','2026-10-09',?)",[`TSTGL365-${index}`,type,JSON.stringify(snapshot),client.id,route.id,pilotId,state.id]);
      const id=created.insertId; fixture.assignments.push(id);
      const edit=await call(`/operaciones/asignaciones/${id}`,"PUT",{tipo_asignacion:type,piloto_id:pilotId,cliente_id:client.id,ruta_id:route.id,estado_asignacion_id:state.id,fecha_carga:"2026-10-09",fecha_descarga:"2026-10-09",detalle_operativo_json:JSON.stringify({...snapshot,fecha_nacimiento_piloto:null,dpi_piloto:null})});
      assert.equal(edit.status,200,JSON.stringify(edit.json));
      const [[saved]]=await pool.query("SELECT detalle_operativo_json FROM asignacion WHERE id=?",[id]); const docs=typeof saved.detalle_operativo_json==='string'?JSON.parse(saved.detalle_operativo_json):saved.detalle_operativo_json;
      assert.equal(docs.fecha_nacimiento_piloto,"1985-04-23"); assert.equal(docs.dpi_piloto,"9999999999991");
      // Simula un expediente histórico sin DPI y sin vínculo al maestro.
      await pool.query("UPDATE asignacion SET piloto_id=NULL,detalle_operativo_json=? WHERE id=?",[JSON.stringify({...docs,dpi_piloto:null}),id]);
      assert.equal((await call(`/operaciones/asignaciones/${id}/finalizar`,"PATCH")).status,200);
      const [[before]]=await pool.query("SELECT detalle_operativo_json FROM asignacion WHERE id=?",[id]);
      assert.equal((await call(`/operaciones/asignaciones/${id}/reabrir`,"PATCH",{})).status,200);
      const [[after]]=await pool.query("SELECT estado_asignacion_id,detalle_operativo_json FROM asignacion WHERE id=?",[id]);
      assert.equal(after.estado_asignacion_id,state.id); assert.deepEqual(after.detalle_operativo_json,before.detalle_operativo_json);
      pass(`${type}: editar conserva nacimiento; finalizar/regresar funciona sin DPI y sin alterar documentos`);
    }
    const [[pay]]=await pool.query("SELECT id FROM forma_pago ORDER BY id LIMIT 1");
    const receipt=await call("/comprobantes","POST",{serie:"TST-2026",numero_comprobante:"SERIE-001",cliente_id:client.id,usuario_id:1,forma_pago_id:pay.id,fecha_emision:"2026-10-09",fecha_vencimiento:"2026-10-20",moneda:"GTQ",detalles:[{descripcion:"Prueba temporal",cantidad:1,unidad:"SERV",precio_unitario:100}]});
    assert.equal(receipt.status,200,JSON.stringify(receipt.json)); fixture.receipts.push(receipt.json.data.id);
    const [[receiptRow]]=await pool.query("SELECT serie,numero_comprobante FROM comprobante WHERE id=?",[receipt.json.data.id]);
    assert.equal(receiptRow.serie,"TST-2026"); assert.equal(receiptRow.numero_comprobante,"SERIE-001");
    pass("Comprobante guarda la serie y número manual en MySQL");
  } finally {
    for (const id of fixture.receipts) { await pool.query("DELETE FROM detalle_comprobante WHERE comprobante_id=?",[id]); await pool.query("DELETE FROM comprobante WHERE id=?",[id]); }
    for (const id of fixture.assignments) {
      for (const table of ["unidad_operacion","costo_asignacion","proveedor_asignacion","factura_asignacion"]) await pool.query(`DELETE FROM ${table} WHERE asignacion_id=?`,[id]);
      await pool.query("DELETE FROM asignacion WHERE id=?",[id]);
    }
    for (const id of fixture.pilots) await pool.query("DELETE FROM piloto WHERE id=?",[id]);
    if (fixture.user) await pool.query("DELETE FROM usuario WHERE id=?",[fixture.user]);
    if (fixture.role) { await pool.query("DELETE FROM role_modulo WHERE role_id=?",[fixture.role]); await pool.query("DELETE FROM role WHERE id=?",[fixture.role]); }
    server.close(); await pool.end(); global.fetch=requestFetch;
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});

