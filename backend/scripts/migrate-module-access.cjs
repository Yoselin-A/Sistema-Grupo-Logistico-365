// Ejecutar desde backend: node scripts/migrate-module-access.cjs
require("dotenv").config();
const pool = require("../src/config/db");

async function migrate() {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    for (const [code, name, route, order] of [
      ["proveedores", "Pricing · Proveedores", "/proveedores", 35],
      ["pilotos", "Pricing · Pilotos", "/pilotos", 45],
    ]) {
      const [[existing]] = await c.query("SELECT id FROM modulo_sistema WHERE codigo_modulo=?", [code]);
      if (existing) continue; // No vuelve a conceder permisos que se hayan quitado.
      const [insert] = await c.query("INSERT INTO modulo_sistema (codigo_modulo,nombre_modulo,descripcion,ruta,orden,activo) VALUES (?,?,?,?,?,1)",
        [code, name, "Acceso independiente administrado desde Roles", route, order]);
      if (code === "pilotos") {
        await c.query(`INSERT IGNORE INTO role_modulo (role_id,modulo_id)
          SELECT rm.role_id, ? FROM role_modulo rm INNER JOIN modulo_sistema m ON m.id=rm.modulo_id WHERE m.codigo_modulo='flota'`, [insert.insertId]);
      }
      await c.query(`INSERT IGNORE INTO role_modulo (role_id,modulo_id)
        SELECT id,? FROM role WHERE LOWER(codigo_rol) IN ('ger','gerencia','adm','admin','administrador')`, [insert.insertId]);
    }
    // Recupera documentos ausentes únicamente cuando todos los expedientes coinciden.
    const [pilots] = await c.query("SELECT id,dpi,nit,DATE_FORMAT(fecha_nacimiento,'%Y-%m-%d') fecha_nacimiento FROM piloto");
    const [assignments] = await c.query("SELECT piloto_id,detalle_operativo_json FROM asignacion WHERE piloto_id IS NOT NULL");
    let recovered = 0;
    for (const p of pilots) {
      const docs = assignments.filter(a => Number(a.piloto_id) === Number(p.id)).map(a => {
        try { return typeof a.detalle_operativo_json === 'string' ? JSON.parse(a.detalle_operativo_json) : a.detalle_operativo_json || {}; } catch { return {}; }
      });
      for (const [column, field] of [["dpi","dpi_piloto"],["nit","nit_piloto"],["fecha_nacimiento","fecha_nacimiento_piloto"]]) {
        if (p[column]) continue;
        const values = [...new Set(docs.map(d => String(d[field] || '').trim()).filter(v => v && !/^(n\/a|null|undefined)$/i.test(v)))];
        if (values.length !== 1) continue;
        const value = values[0];
        if (column === 'fecha_nacimiento' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) continue;
        await c.query(`UPDATE piloto SET \`${column}\`=? WHERE id=? AND (\`${column}\` IS NULL${column === 'fecha_nacimiento' ? '' : ` OR \`${column}\`=''`})`, [value,p.id]);
        recovered++;
      }
    }
    await c.commit();
    console.log(`Permisos independientes configurados. Documentos recuperados: ${recovered}.`);
  } catch (e) { await c.rollback(); throw e; }
  finally { c.release(); await pool.end(); }
}
migrate().catch(e => { console.error(e.message); process.exitCode = 1; });
