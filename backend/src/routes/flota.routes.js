const express = require("express");
const pool = require("../config/db");

const router = express.Router();

const T = {
  vehiculo: "vehiculo",
  tipoVehiculo: "tipo_vehiculo",
  estadoVehiculo: "estado_vehiculo",
  estadoMantenimiento: "estado_mantenimiento",
  mantenimiento: "mantenimiento",
  asignacion: "asignacion",
  vehiculoAsignacion: "vehiculo_asignacion",
};

const ok = (res, data = null, message = "Operación realizada correctamente.") =>
  res.json({ ok: true, message, data });

const fail = (res, status, message, error = null) =>
  res.status(status).json({
    ok: false,
    message,
    error: error?.message || error || null,
  });

const limpiar = (value) => String(value ?? "").trim();

const limpiarCodigo = (value, max = 15) =>
  limpiar(value)
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, max);

const asId = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};

const asInt = (value, fallback = 0) => {
  const number = Number(String(value ?? "").replace(/\D/g, ""));
  return Number.isFinite(number) ? number : fallback;
};

const asDecimal = (value, fallback = 0) => {
  const number = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(number) ? number : fallback;
};

const asDate = (value) => {
  const text = limpiar(value);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return null;
};

const tableExists = async (tableName) => {
  const [rows] = await pool.query(
    `
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
    LIMIT 1
    `,
    [tableName]
  );

  return rows.length > 0;
};

const nextFleetCode = async (connection) => {
  const [rows] = await connection.query(
    `SELECT codigo FROM \`${T.vehiculo}\` WHERE codigo LIKE 'FL-%'`
  );

  let max = 0;

  rows.forEach((row) => {
    const match = String(row.codigo || "").match(/^FL-(\d+)$/i);
    if (match) max = Math.max(max, Number(match[1]));
  });

  return `FL-${String(max + 1).padStart(3, "0")}`;
};

const getFlotaCatalogos = async () => {
  const [tiposVehiculo] = await pool.query(`
    SELECT id, codigo_tipo_vehiculo, nombre_tipo_vehiculo
    FROM \`${T.tipoVehiculo}\`
    ORDER BY id
  `);

  const [estadosVehiculo] = await pool.query(`
    SELECT id, codigo_estado, nombre_estado_vehiculo
    FROM \`${T.estadoVehiculo}\`
    ORDER BY id
  `);

  const [estadosMantenimiento] = await pool.query(`
    SELECT id, codigo_estado, nombre_estado_mantenimiento
    FROM \`${T.estadoMantenimiento}\`
    ORDER BY id
  `);

  return {
    tiposVehiculo,
    estadosVehiculo,
    estadosMantenimiento,
  };
};

const getVehiculosRows = async () => {
  const [rows] = await pool.query(`
    SELECT
      v.id,
      v.codigo,
      v.tipo_id,
      v.estado_id,
      v.eficiencia,
      v.kilometraje,
      v.estado_mantenimiento_id,
      v.estado_mantenimiento_id AS estados_mantenimiento_id,
      DATE_FORMAT(v.proximo_mantenimiento, '%Y-%m-%d') AS proximo_mantenimiento,
      v.created_at,
      v.updated_at,

      tv.codigo_tipo_vehiculo,
      tv.nombre_tipo_vehiculo AS tipo,

      ev.codigo_estado AS codigo_estado_vehiculo,
      ev.nombre_estado_vehiculo AS estado,

      em.codigo_estado AS codigo_estado_mantenimiento,
      em.nombre_estado_mantenimiento AS mantenimiento,

      m.id AS ultimo_mantenimiento_id,
      m.codigo_mantenimiento AS ultimo_codigo_mantenimiento,
      m.tipo AS ultimo_tipo_mantenimiento,
      m.descripcion AS ultimo_descripcion_mantenimiento,
      DATE_FORMAT(m.fecha, '%Y-%m-%d') AS ultimo_fecha_mantenimiento,
      DATE_FORMAT(m.proximo, '%Y-%m-%d') AS ultimo_proximo_mantenimiento,
      m.costo AS ultimo_costo_mantenimiento
    FROM \`${T.vehiculo}\` v
    LEFT JOIN \`${T.tipoVehiculo}\` tv ON tv.id = v.tipo_id
    LEFT JOIN \`${T.estadoVehiculo}\` ev ON ev.id = v.estado_id
    LEFT JOIN \`${T.estadoMantenimiento}\` em ON em.id = v.estado_mantenimiento_id
    LEFT JOIN \`${T.mantenimiento}\` m
      ON m.id = (
        SELECT x.id
        FROM \`${T.mantenimiento}\` x
        WHERE x.vehiculo_id = v.id
        ORDER BY COALESCE(x.fecha, '1900-01-01') DESC, x.id DESC
        LIMIT 1
      )
    ORDER BY v.id DESC
  `);

  return rows;
};


const nextMaintenanceCode = async (connection) => {
  const [rows] = await connection.query(
    `SELECT codigo_mantenimiento AS codigo FROM \`${T.mantenimiento}\` WHERE codigo_mantenimiento LIKE 'MANT-%'`
  );

  let max = 0;

  rows.forEach((row) => {
    const match = String(row.codigo || "").match(/^MANT-(\d+)$/i);
    if (match) max = Math.max(max, Number(match[1]));
  });

  return `MANT-${String(max + 1).padStart(3, "0")}`;
};

const limpiarTextoMantenimiento = (value, max = 180) =>
  limpiar(value)
    .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s.,#&()'/-]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, max);

const saveMantenimientoVehiculo = async (connection, body) => {
  const vehiculoId = asId(body.vehiculo_id);
  const tipo = limpiarTextoMantenimiento(body.tipo, 60);
  const descripcion = limpiarTextoMantenimiento(body.descripcion, 250);
  const fecha = asDate(body.fecha);
  const proximo = asDate(body.proximo);
  const costo = asDecimal(body.costo, -1);
  const estadoMantenimientoId = asId(body.estado_mantenimiento_id || body.estados_mantenimiento_id);

  if (!vehiculoId) throw new Error("Selecciona un vehículo.");
  if (!tipo) throw new Error("Ingresa el tipo de mantenimiento.");
  if (!descripcion) throw new Error("Ingresa la descripción del mantenimiento.");
  if (!fecha) throw new Error("Selecciona la fecha del mantenimiento.");
  if (!proximo) throw new Error("Selecciona la fecha del próximo mantenimiento.");
  if (costo < 0) throw new Error("Ingresa un costo válido.");
  if (!estadoMantenimientoId) throw new Error("Selecciona el estado de mantenimiento.");

  const [[vehiculo]] = await connection.query(
    `SELECT id, codigo FROM \`${T.vehiculo}\` WHERE id = ? LIMIT 1`,
    [vehiculoId]
  );

  if (!vehiculo) throw new Error("El vehículo seleccionado no existe.");

  const codigo = limpiarCodigo(body.codigo_mantenimiento || body.codigo, 20) || (await nextMaintenanceCode(connection));

  const [[exists]] = await connection.query(
    `SELECT id FROM \`${T.mantenimiento}\` WHERE codigo_mantenimiento = ? LIMIT 1`,
    [codigo]
  );

  if (exists) {
    throw new Error("Ya existe un mantenimiento con ese código.");
  }

  const [result] = await connection.query(
    `
    INSERT INTO \`${T.mantenimiento}\`
    (codigo_mantenimiento, vehiculo_id, tipo, descripcion, fecha, proximo, costo)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [codigo, vehiculoId, tipo, descripcion, fecha, proximo, costo]
  );

  await connection.query(
    `
    UPDATE \`${T.vehiculo}\`
    SET estado_mantenimiento_id = ?,
        proximo_mantenimiento = ?
    WHERE id = ?
    `,
    [estadoMantenimientoId, proximo, vehiculoId]
  );

  return {
    id: result.insertId,
    codigo_mantenimiento: codigo,
    vehiculo_id: vehiculoId,
  };
};


const validateVehiclePayload = (body, isUpdate = false) => {
  const codigo = limpiarCodigo(body.codigo);
  const tipoId = asId(body.tipo_id);
  const estadoId = asId(body.estado_id);
  const eficiencia = asInt(body.eficiencia, -1);
  const kilometraje = asDecimal(body.kilometraje, -1);
  const estadoMantenimientoId = asId(body.estado_mantenimiento_id || body.estados_mantenimiento_id);
  const proximoMantenimiento = asDate(body.proximo_mantenimiento);

  if (isUpdate && !codigo) {
    throw new Error("Ingresa un código o placa válida para el vehículo.");
  }

  if (!tipoId) throw new Error("Selecciona el tipo de vehículo.");
  if (!estadoId) throw new Error("Selecciona el estado del vehículo.");

  if (eficiencia < 0 || eficiencia > 100) {
    throw new Error("La eficiencia debe estar entre 0 y 100.");
  }

  if (kilometraje < 0) {
    throw new Error("El kilometraje debe ser un número válido.");
  }

  if (!estadoMantenimientoId) {
    throw new Error("Selecciona el estado de mantenimiento.");
  }

  if (!proximoMantenimiento) {
    throw new Error("Selecciona la fecha del próximo mantenimiento.");
  }

  return {
    codigo,
    tipoId,
    estadoId,
    eficiencia,
    kilometraje,
    estadoMantenimientoId,
    proximoMantenimiento,
  };
};

const hasVehicleRelations = async (connection, vehiculoId) => {
  const checks = [];

  if (await tableExists(T.asignacion)) {
    const [[row]] = await connection.query(
      `SELECT COUNT(*) AS total FROM \`${T.asignacion}\` WHERE vehiculo_id = ?`,
      [vehiculoId]
    );
    checks.push({ tabla: T.asignacion, total: Number(row.total || 0) });
  }

  if (await tableExists(T.vehiculoAsignacion)) {
    const [[row]] = await connection.query(
      `
      SELECT COUNT(*) AS total
      FROM \`${T.vehiculoAsignacion}\`
      WHERE vehiculo_id = ?
        AND COALESCE(estado, 'activo') = 'activo'
      `,
      [vehiculoId]
    );
    checks.push({ tabla: T.vehiculoAsignacion, total: Number(row.total || 0) });
  }

  return checks;
};

router.get("/flota/bootstrap", async (req, res) => {
  try {
    const [catalogos, vehiculos] = await Promise.all([
      getFlotaCatalogos(),
      getVehiculosRows(),
    ]);

    return ok(res, {
      ...catalogos,
      vehiculos,
    });
  } catch (error) {
    console.error("Error /flota/bootstrap:", error);
    return fail(res, 500, "No se pudo cargar Flota desde MySQL.", error);
  }
});

router.get("/flota/vehiculos", async (req, res) => {
  try {
    return ok(res, await getVehiculosRows());
  } catch (error) {
    console.error("Error GET /flota/vehiculos:", error);
    return fail(res, 500, "No se pudieron obtener los vehículos.", error);
  }
});

router.post("/flota/vehiculos", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const data = validateVehiclePayload(req.body, false);

    await connection.beginTransaction();

    const codigo = data.codigo || (await nextFleetCode(connection));

    const [[exists]] = await connection.query(
      `SELECT id FROM \`${T.vehiculo}\` WHERE codigo = ? LIMIT 1`,
      [codigo]
    );

    if (exists) {
      await connection.rollback();
      return fail(res, 409, "Ya existe un vehículo con ese código.");
    }

    const [result] = await connection.query(
      `
      INSERT INTO \`${T.vehiculo}\`
      (codigo, tipo_id, estado_id, eficiencia, kilometraje, estado_mantenimiento_id, proximo_mantenimiento)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        codigo,
        data.tipoId,
        data.estadoId,
        data.eficiencia,
        data.kilometraje,
        data.estadoMantenimientoId,
        data.proximoMantenimiento,
      ]
    );

    await connection.commit();

    return ok(res, { id: result.insertId, codigo }, "Vehículo guardado correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error POST /flota/vehiculos:", error);
    return fail(res, 500, "No se pudo guardar el vehículo.", error);
  } finally {
    connection.release();
  }
});

router.put("/flota/vehiculos/:id", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const id = asId(req.params.id);
    if (!id) return fail(res, 400, "ID de vehículo inválido.");

    const data = validateVehiclePayload(req.body, true);

    await connection.beginTransaction();

    const [[current]] = await connection.query(
      `SELECT id FROM \`${T.vehiculo}\` WHERE id = ? LIMIT 1`,
      [id]
    );

    if (!current) {
      await connection.rollback();
      return fail(res, 404, "El vehículo no existe.");
    }

    const [[exists]] = await connection.query(
      `SELECT id FROM \`${T.vehiculo}\` WHERE codigo = ? AND id <> ? LIMIT 1`,
      [data.codigo, id]
    );

    if (exists) {
      await connection.rollback();
      return fail(res, 409, "Ya existe otro vehículo con ese código.");
    }

    await connection.query(
      `
      UPDATE \`${T.vehiculo}\`
      SET codigo = ?,
          tipo_id = ?,
          estado_id = ?,
          eficiencia = ?,
          kilometraje = ?,
          estado_mantenimiento_id = ?,
          proximo_mantenimiento = ?
      WHERE id = ?
      `,
      [
        data.codigo,
        data.tipoId,
        data.estadoId,
        data.eficiencia,
        data.kilometraje,
        data.estadoMantenimientoId,
        data.proximoMantenimiento,
        id,
      ]
    );

    await connection.commit();

    return ok(res, { id }, "Vehículo actualizado correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error PUT /flota/vehiculos:", error);
    return fail(res, 500, "No se pudo actualizar el vehículo.", error);
  } finally {
    connection.release();
  }
});

router.delete("/flota/vehiculos/:id", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const id = asId(req.params.id);
    if (!id) return fail(res, 400, "ID de vehículo inválido.");

    await connection.beginTransaction();

    const relations = await hasVehicleRelations(connection, id);
    const blocked = relations.filter((item) => item.total > 0);

    if (blocked.length) {
      await connection.rollback();

      return fail(
        res,
        409,
        "No se puede eliminar este vehículo porque está relacionado con asignaciones o viajes. Cambia su estado a Mantenimiento o En uso en lugar de eliminarlo.",
        { relations: blocked }
      );
    }

    await connection.query(`DELETE FROM \`${T.mantenimiento}\` WHERE vehiculo_id = ?`, [id]);
    await connection.query(`DELETE FROM \`${T.vehiculo}\` WHERE id = ?`, [id]);

    await connection.commit();

    return ok(res, { id }, "Vehículo eliminado correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error DELETE /flota/vehiculos:", error);
    return fail(res, 500, "No se pudo eliminar el vehículo.", error);
  } finally {
    connection.release();
  }
});


router.get("/flota/vehiculos/:id/mantenimientos", async (req, res) => {
  try {
    const id = asId(req.params.id);
    if (!id) return fail(res, 400, "ID de vehículo inválido.");

    const [rows] = await pool.query(
      `
      SELECT
        id,
        codigo_mantenimiento,
        vehiculo_id,
        tipo,
        descripcion,
        DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
        DATE_FORMAT(proximo, '%Y-%m-%d') AS proximo,
        costo
      FROM \`${T.mantenimiento}\`
      WHERE vehiculo_id = ?
      ORDER BY fecha DESC, id DESC
      `,
      [id]
    );

    return ok(res, rows);
  } catch (error) {
    console.error("Error GET /flota/vehiculos/:id/mantenimientos:", error);
    return fail(res, 500, "No se pudieron obtener los mantenimientos del vehículo.", error);
  }
});

router.post("/flota/mantenimientos", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const result = await saveMantenimientoVehiculo(connection, req.body);

    await connection.commit();

    return ok(res, result, "Mantenimiento registrado correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error POST /flota/mantenimientos:", error);
    return fail(res, 500, "No se pudo registrar el mantenimiento.", error);
  } finally {
    connection.release();
  }
});


module.exports = router;