const express = require("express");
const pool = require("../config/db");

const router = express.Router();

const T = {
  ruta: "ruta",
  ubicacion: "ubicacion",
  frecuenciaRuta: "frecuencia_ruta",
  estadoRuta: "estado_ruta",
  rutaHistorial: "ruta_historial",
  viaje: "viaje",
  asignacion: "asignacion",
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

const limpiarCodigo = (value, max = 20) =>
  limpiar(value)
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, max);

const limpiarTextoRuta = (value, max = 120) =>
  limpiar(value)
    .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s.,#&()'/-]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, max);

const limpiarPais = (value, max = 60) =>
  limpiar(value)
    .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'-]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, max);

const asId = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};

const asDecimal = (value, fallback = 0) => {
  const number = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(number) ? number : fallback;
};

const safeDelete = async (connection, sql, params = []) => {
  try {
    await connection.query(sql, params);
  } catch (error) {
    if (
      error?.code === "ER_NO_SUCH_TABLE" ||
      error?.code === "ER_BAD_TABLE_ERROR" ||
      error?.code === "ER_BAD_FIELD_ERROR"
    ) {
      return;
    }

    throw error;
  }
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

const nextCode = async (connection, table, field, prefix, pad = 3) => {
  const [rows] = await connection.query(
    `SELECT \`${field}\` AS codigo FROM \`${table}\` WHERE \`${field}\` IS NOT NULL`
  );

  let max = 0;

  rows.forEach((row) => {
    const match = String(row.codigo || "").match(/(\d+)(?!.*\d)/);
    if (match) max = Math.max(max, Number(match[1]));
  });

  return `${prefix}-${String(max + 1).padStart(pad, "0")}`;
};

const nextLocationCode = async (connection, nombre, pais) => {
  const base =
    limpiar(`${nombre} ${pais}`)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.slice(0, 3))
      .join("")
      .slice(0, 8) || "UBI";

  let code = base;
  let counter = 1;

  while (true) {
    const [[exists]] = await connection.query(
      `SELECT id FROM \`${T.ubicacion}\` WHERE codigo_ubicacion = ? LIMIT 1`,
      [code]
    );

    if (!exists) return code;

    counter += 1;
    code = `${base.slice(0, 6)}${String(counter).padStart(2, "0")}`;
  }
};

const getCatalogos = async () => {
  const [ubicaciones] = await pool.query(`
    SELECT id, codigo_ubicacion, nombre_ubicacion, pais, created_at
    FROM \`${T.ubicacion}\`
    ORDER BY nombre_ubicacion, pais, id
  `);

  const [frecuenciasRuta] = await pool.query(`
    SELECT id, codigo_frecuencia, nombre_frecuencia_ruta
    FROM \`${T.frecuenciaRuta}\`
    ORDER BY id
  `);

  const [estadosRuta] = await pool.query(`
    SELECT id, codigo_estado, nombre_estado_ruta
    FROM \`${T.estadoRuta}\`
    ORDER BY id
  `);

  return {
    ubicaciones,
    frecuenciasRuta,
    estadosRuta,
  };
};

const getHistorialRows = async (rutaId = null) => {
  const params = [];
  let where = "";

  if (rutaId) {
    where = "WHERE rh.ruta_id = ?";
    params.push(rutaId);
  }

  const [rows] = await pool.query(
    `
    SELECT
      rh.id,
      rh.ruta_id,
      rh.costo,
      DATE_FORMAT(rh.fecha, '%Y-%m-%d') AS fecha,
      r.codigo_ruta
    FROM \`${T.rutaHistorial}\` rh
    LEFT JOIN \`${T.ruta}\` r ON r.id = rh.ruta_id
    ${where}
    ORDER BY rh.fecha DESC, rh.id DESC
    `,
    params
  );

  return rows;
};

const getRutasRows = async () => {
  const [rows] = await pool.query(`
    SELECT
      r.id,
      r.codigo_ruta,
      r.nombre_ruta,
      r.origen_id,
      r.destino_id,
      r.distancia_km,
      r.tiempo,
      r.costo,
      r.frecuencia_id,
      r.estado_id,
      r.created_at,
      r.updated_at,

      uo.codigo_ubicacion AS origen_codigo,
      uo.nombre_ubicacion AS origen_nombre,
      uo.pais AS origen_pais,

      ud.codigo_ubicacion AS destino_codigo,
      ud.nombre_ubicacion AS destino_nombre,
      ud.pais AS destino_pais,

      fr.codigo_frecuencia,
      fr.nombre_frecuencia_ruta AS frecuencia,

      er.codigo_estado,
      er.nombre_estado_ruta AS estado
    FROM \`${T.ruta}\` r
    LEFT JOIN \`${T.ubicacion}\` uo ON uo.id = r.origen_id
    LEFT JOIN \`${T.ubicacion}\` ud ON ud.id = r.destino_id
    LEFT JOIN \`${T.frecuenciaRuta}\` fr ON fr.id = r.frecuencia_id
    LEFT JOIN \`${T.estadoRuta}\` er ON er.id = r.estado_id
    ORDER BY r.id DESC
  `);

  return rows.map((row) => ({
    ...row,
    ruta_texto:
      row.origen_nombre && row.destino_nombre
        ? `${row.origen_nombre} → ${row.destino_nombre}`
        : row.nombre_ruta,
  }));
};

const buildRouteName = async (connection, origenId, destinoId) => {
  const [rows] = await connection.query(
    `
    SELECT id, nombre_ubicacion
    FROM \`${T.ubicacion}\`
    WHERE id IN (?, ?)
    `,
    [origenId, destinoId]
  );

  const origen = rows.find((row) => Number(row.id) === Number(origenId));
  const destino = rows.find((row) => Number(row.id) === Number(destinoId));

  if (!origen || !destino) {
    throw new Error("El origen o destino seleccionado no existe.");
  }

  return `${origen.nombre_ubicacion} → ${destino.nombre_ubicacion}`;
};

const validateRutaPayload = async (connection, body) => {
  const origenId = asId(body.origen_id);
  const destinoId = asId(body.destino_id);
  const distanciaKm = asDecimal(body.distancia_km, -1);
  const tiempo = asDecimal(body.tiempo, -1);
  const costo = asDecimal(body.costo, -1);
  const frecuenciaId = asId(body.frecuencia_id);
  const estadoId = asId(body.estado_id);

  if (!origenId) throw new Error("Selecciona el origen.");
  if (!destinoId) throw new Error("Selecciona el destino.");
  if (origenId === destinoId) throw new Error("El destino debe ser diferente del origen.");

  if (distanciaKm <= 0) throw new Error("La distancia debe ser mayor a 0.");
  if (tiempo <= 0) throw new Error("El tiempo debe ser mayor a 0.");
  if (costo < 0) throw new Error("El costo no puede ser negativo.");

  if (!frecuenciaId) throw new Error("Selecciona la frecuencia.");
  if (!estadoId) throw new Error("Selecciona el estado.");

  const nombreRuta = await buildRouteName(connection, origenId, destinoId);

  return {
    origenId,
    destinoId,
    distanciaKm,
    tiempo,
    costo,
    frecuenciaId,
    estadoId,
    nombreRuta,
  };
};

const saveRuta = async (connection, body, id = null) => {
  const data = await validateRutaPayload(connection, body);

  if (id) {
    const [[actual]] = await connection.query(
      `SELECT id, costo FROM \`${T.ruta}\` WHERE id = ? LIMIT 1`,
      [id]
    );

    if (!actual) throw new Error("La ruta no existe.");

    if (Number(actual.costo || 0) !== Number(data.costo || 0)) {
      await connection.query(
        `
        INSERT INTO \`${T.rutaHistorial}\`
        (ruta_id, costo, fecha)
        VALUES (?, ?, CURDATE())
        `,
        [id, actual.costo || 0]
      );
    }

    await connection.query(
      `
      UPDATE \`${T.ruta}\`
      SET nombre_ruta = ?,
          origen_id = ?,
          destino_id = ?,
          distancia_km = ?,
          tiempo = ?,
          costo = ?,
          frecuencia_id = ?,
          estado_id = ?
      WHERE id = ?
      `,
      [
        data.nombreRuta,
        data.origenId,
        data.destinoId,
        data.distanciaKm,
        data.tiempo,
        data.costo,
        data.frecuenciaId,
        data.estadoId,
        id,
      ]
    );

    return { id };
  }

  const codigo = limpiarCodigo(body.codigo_ruta) || (await nextCode(connection, T.ruta, "codigo_ruta", "RUT", 3));

  const [[exists]] = await connection.query(
    `SELECT id FROM \`${T.ruta}\` WHERE codigo_ruta = ? LIMIT 1`,
    [codigo]
  );

  if (exists) {
    throw new Error("Ya existe una ruta con ese código.");
  }

  const [result] = await connection.query(
    `
    INSERT INTO \`${T.ruta}\`
    (codigo_ruta, nombre_ruta, origen_id, destino_id, distancia_km, tiempo, costo, frecuencia_id, estado_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      codigo,
      data.nombreRuta,
      data.origenId,
      data.destinoId,
      data.distanciaKm,
      data.tiempo,
      data.costo,
      data.frecuenciaId,
      data.estadoId,
    ]
  );

  return { id: result.insertId, codigo_ruta: codigo };
};

const rutaTieneRelaciones = async (connection, rutaId) => {
  const relaciones = [];

  if (await tableExists(T.viaje)) {
    const [[row]] = await connection.query(
      `SELECT COUNT(*) AS total FROM \`${T.viaje}\` WHERE ruta_id = ?`,
      [rutaId]
    );
    relaciones.push({ tabla: T.viaje, total: Number(row.total || 0) });
  }

  if (await tableExists(T.asignacion)) {
    const [[row]] = await connection.query(
      `SELECT COUNT(*) AS total FROM \`${T.asignacion}\` WHERE ruta_id = ?`,
      [rutaId]
    );
    relaciones.push({ tabla: T.asignacion, total: Number(row.total || 0) });
  }

  return relaciones.filter((item) => item.total > 0);
};

/* =====================================================
   Rutas API
===================================================== */

router.get("/rutas/bootstrap", async (req, res) => {
  try {
    const [catalogos, rutas, historial] = await Promise.all([
      getCatalogos(),
      getRutasRows(),
      getHistorialRows(),
    ]);

    return ok(res, {
      ...catalogos,
      rutas,
      historial,
    });
  } catch (error) {
    console.error("Error /rutas/bootstrap:", error);
    return fail(res, 500, "No se pudo cargar Rutas desde MySQL.", error);
  }
});

router.get("/rutas", async (req, res) => {
  try {
    return ok(res, await getRutasRows());
  } catch (error) {
    console.error("Error GET /rutas:", error);
    return fail(res, 500, "No se pudieron obtener las rutas.", error);
  }
});

router.post("/rutas", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const result = await saveRuta(connection, req.body);

    await connection.commit();

    return ok(res, result, "Ruta guardada correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error POST /rutas:", error);
    return fail(res, 500, "No se pudo guardar la ruta.", error);
  } finally {
    connection.release();
  }
});

router.put("/rutas/:id", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const id = asId(req.params.id);
    if (!id) return fail(res, 400, "ID de ruta inválido.");

    await connection.beginTransaction();

    const result = await saveRuta(connection, req.body, id);

    await connection.commit();

    return ok(res, result, "Ruta actualizada correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error PUT /rutas/:id:", error);
    return fail(res, 500, "No se pudo actualizar la ruta.", error);
  } finally {
    connection.release();
  }
});

router.delete("/rutas/:id", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const id = asId(req.params.id);
    if (!id) return fail(res, 400, "ID de ruta inválido.");

    await connection.beginTransaction();

    const relaciones = await rutaTieneRelaciones(connection, id);

    if (relaciones.length) {
      await connection.rollback();

      return fail(
        res,
        409,
        "No se puede eliminar esta ruta porque está relacionada con viajes o asignaciones. Cambia el estado a Inactiva en lugar de eliminarla.",
        { relaciones }
      );
    }

    await safeDelete(connection, `DELETE FROM \`${T.rutaHistorial}\` WHERE ruta_id = ?`, [id]);
    await connection.query(`DELETE FROM \`${T.ruta}\` WHERE id = ?`, [id]);

    await connection.commit();

    return ok(res, { id }, "Ruta eliminada correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error DELETE /rutas/:id:", error);
    return fail(res, 500, "No se pudo eliminar la ruta.", error);
  } finally {
    connection.release();
  }
});

router.post("/rutas/ubicaciones", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const nombre = limpiarTextoRuta(req.body.nombre_ubicacion || req.body.nombre, 120);
    const pais = limpiarPais(req.body.pais || "Guatemala", 60);
    const codigoManual = limpiarCodigo(req.body.codigo_ubicacion || req.body.codigo, 12);

    if (!nombre) return fail(res, 400, "Ingresa el nombre de la ubicación.");
    if (!pais) return fail(res, 400, "Ingresa el país.");

    await connection.beginTransaction();

    const codigo = codigoManual || (await nextLocationCode(connection, nombre, pais));

    const [[existsCode]] = await connection.query(
      `SELECT id FROM \`${T.ubicacion}\` WHERE codigo_ubicacion = ? LIMIT 1`,
      [codigo]
    );

    if (existsCode) {
      await connection.rollback();
      return fail(res, 409, "Ya existe una ubicación con ese código.");
    }

    const [[existsName]] = await connection.query(
      `
      SELECT id
      FROM \`${T.ubicacion}\`
      WHERE LOWER(TRIM(nombre_ubicacion)) = LOWER(TRIM(?))
        AND LOWER(TRIM(pais)) = LOWER(TRIM(?))
      LIMIT 1
      `,
      [nombre, pais]
    );

    if (existsName) {
      await connection.rollback();
      return fail(res, 409, "Ya existe una ubicación con ese nombre y país.");
    }

    const [result] = await connection.query(
      `
      INSERT INTO \`${T.ubicacion}\`
      (codigo_ubicacion, nombre_ubicacion, pais)
      VALUES (?, ?, ?)
      `,
      [codigo, nombre, pais]
    );

    await connection.commit();

    return ok(
      res,
      {
        id: result.insertId,
        codigo_ubicacion: codigo,
        nombre_ubicacion: nombre,
        pais,
      },
      "Ubicación guardada correctamente."
    );
  } catch (error) {
    await connection.rollback();
    console.error("Error POST /rutas/ubicaciones:", error);
    return fail(res, 500, "No se pudo guardar la ubicación.", error);
  } finally {
    connection.release();
  }
});

router.get("/rutas/:id/historial", async (req, res) => {
  try {
    const id = asId(req.params.id);
    if (!id) return fail(res, 400, "ID de ruta inválido.");

    return ok(res, await getHistorialRows(id));
  } catch (error) {
    console.error("Error GET /rutas/:id/historial:", error);
    return fail(res, 500, "No se pudo obtener el historial de la ruta.", error);
  }
});

module.exports = router;