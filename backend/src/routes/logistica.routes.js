const express = require("express");
const pool = require("../config/db");

const router = express.Router();

const T = {
  cliente: "cliente",
  envio: "envio",
  viaje: "viaje",
  deposito: "deposito",
  trackingViaje: "tracking_viaje",
  alerta: "alerta",
  ruta: "ruta",
  ubicacion: "ubicacion",
  unidad: "unidad",
  piloto: "piloto",
  estadoEnvio: "estado_envio",
  tipoDeposito: "tipo_deposito",
};

const ok = (res, data = null, message = "Operación realizada correctamente.") =>
  res.json({ ok: true, message, data });

const fail = (res, status, message, error = null) =>
  res.status(status).json({
    ok: false,
    message,
    error: error?.message || error || null,
  });

const limpiar = (valor) => String(valor ?? "").trim();

const textoComercial = (valor, max = 160) =>
  limpiar(valor)
    .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s.,#&()'/-]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, max);

const soloNumero = (valor, max = 12) =>
  limpiar(valor).replace(/[^0-9]/g, "").slice(0, max);

const numeroDecimal = (valor, fallback = 0) => {
  const n = Number(String(valor ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : fallback;
};

const asId = (valor) => {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const asDate = (valor) => {
  const v = limpiar(valor);
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return null;
};

const asDateTime = (valor) => {
  const v = limpiar(valor);
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return v.replace("T", " ").slice(0, 16) + ":00";
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(v)) return v.slice(0, 19);
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10) + " 00:00:00";
  return null;
};

const normalizarEtaDateTime = (eta, fechaSalida) => {
  const valor = limpiar(eta);

  if (!valor) return null;

  // Si viene completa desde el frontend: 2026-08-22T16:00
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(valor)) {
    return valor.replace("T", " ").slice(0, 16) + ":00";
  }

  // Si viene completa desde MySQL o texto: 2026-08-22 16:00
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(valor)) {
    return valor.slice(0, 16) + ":00";
  }

  // Si el formulario manda solo hora: 16:00,
  // se combina con la fecha de salida porque la columna eta es DATETIME.
  if (/^\d{2}:\d{2}$/.test(valor)) {
    const fechaBase = limpiar(fechaSalida).slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaBase)) {
      return null;
    }

    return `${fechaBase} ${valor}:00`;
  }

  return null;
};

const fullNameSQL = (alias) =>
  `CONCAT_WS(' ', ${alias}.primer_nombre, ${alias}.segundo_nombre, ${alias}.primer_apellido, ${alias}.segundo_apellido)`;

const tableExists = async (tabla) => {
  const [rows] = await pool.query(
    `
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
    LIMIT 1
    `,
    [tabla]
  );
  return rows.length > 0;
};

const nextCode = async (connection, tabla, campo, prefijo, pad = 3) => {
  const [rows] = await connection.query(
    `SELECT \`${campo}\` AS codigo FROM \`${tabla}\` WHERE \`${campo}\` LIKE ?`,
    [`${prefijo}-%`]
  );

  let max = 0;

  rows.forEach((row) => {
    const m = String(row.codigo || "").match(/(\d+)(?!.*\d)/);
    if (m) max = Math.max(max, Number(m[1]));
  });

  return `${prefijo}-${String(max + 1).padStart(pad, "0")}`;
};

const getEstadosEnvio = async (connection = pool) => {
  const [rows] = await connection.query(
    `SELECT id, codigo_estado, nombre_estado_envio FROM \`${T.estadoEnvio}\` ORDER BY id`
  );
  return rows;
};

const estadoIdDesdeVisual = async (connection, estadoVisual) => {
  const estados = await getEstadosEnvio(connection);
  const text = limpiar(estadoVisual).toLowerCase();

  const findByName = (...terms) =>
    estados.find((e) =>
      terms.some((term) => String(e.nombre_estado_envio || "").toLowerCase().includes(term))
    )?.id;

  if (text.includes("entregado")) return findByName("entregado") || estados[0]?.id || 1;
  if (text.includes("destino")) return findByName("destino") || estados[0]?.id || 1;
  if (
    text.includes("ruta") ||
    text.includes("tránsito") ||
    text.includes("transito") ||
    text.includes("retraso") ||
    text.includes("crítico") ||
    text.includes("critico")
  ) {
    return findByName("ruta") || estados[0]?.id || 1;
  }

  return findByName("recolección", "recoleccion", "pendiente") || estados[0]?.id || 1;
};

const normalizarEstadoEnvio = (nombre) => {
  const value = limpiar(nombre);
  if (!value) return "Pendiente";
  if (value.toLowerCase().includes("recole")) return "Pendiente";
  return value;
};

const normalizarEstadoViaje = (row) => {
  const alertaNivel = limpiar(row.alerta_nivel).toLowerCase();
  const alertaTipo = limpiar(row.alerta_tipo).toLowerCase();

  if (Number(row.alerta_leida) === 0) {
    if (alertaNivel.includes("crítico") || alertaNivel.includes("critico") || alertaTipo.includes("crítica") || alertaTipo.includes("critica")) {
      return "Crítico";
    }
    if (alertaTipo.includes("retraso") || alertaNivel.includes("medio") || alertaNivel.includes("alto")) {
      return "Retraso";
    }
  }

  const base = normalizarEstadoEnvio(row.nombre_estado_envio);
  if (base === "En ruta") return "En tránsito";
  return base;
};

const queryCatalogos = async () => {
  const [clientes] = await pool.query(`
    SELECT id, codigo_cliente, nombre_empresa, nit, direccion, estado_cliente_id
    FROM \`${T.cliente}\`
    ORDER BY nombre_empresa
  `);

  const [ubicaciones] = await pool.query(`
    SELECT id, codigo_ubicacion, nombre_ubicacion, pais
    FROM \`${T.ubicacion}\`
    ORDER BY nombre_ubicacion, pais
  `);

  const [rutas] = await pool.query(`
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
      uo.nombre_ubicacion AS origen,
      uo.pais AS origen_pais,
      ud.nombre_ubicacion AS destino,
      ud.pais AS destino_pais,
      CONCAT(uo.nombre_ubicacion, ' → ', ud.nombre_ubicacion) AS ruta_texto
    FROM \`${T.ruta}\` r
    LEFT JOIN \`${T.ubicacion}\` uo ON uo.id = r.origen_id
    LEFT JOIN \`${T.ubicacion}\` ud ON ud.id = r.destino_id
    ORDER BY r.id DESC
  `);

  const [unidades] = await pool.query(`
    SELECT id, codigo, tipo
    FROM \`${T.unidad}\`
    ORDER BY codigo
  `);

  const [pilotos] = await pool.query(`
    SELECT
      id,
      codigo_piloto,
      primer_nombre,
      segundo_nombre,
      primer_apellido,
      segundo_apellido,
      licencia,
      ${fullNameSQL("p")} AS nombre_piloto
    FROM \`${T.piloto}\` p
    ORDER BY primer_nombre, primer_apellido
  `);

  const [estadosEnvio] = await pool.query(`
    SELECT id, codigo_estado, nombre_estado_envio
    FROM \`${T.estadoEnvio}\`
    ORDER BY id
  `);

  const [tiposDeposito] = await pool.query(`
    SELECT id, codigo_tipo_deposito, nombre_tipo_deposito
    FROM \`${T.tipoDeposito}\`
    ORDER BY id
  `);

  return {
    clientes,
    ubicaciones,
    rutas,
    unidades,
    pilotos,
    estadosEnvio,
    tiposDeposito,
  };
};

const getEnviosRows = async () => {
  const [rows] = await pool.query(`
    SELECT
      e.id,
      e.codigo,
      e.cliente_id,
      e.origen_id,
      e.destino_id,
      e.direccion,
      e.fecha,
      e.estado_id,
      e.observaciones,
      e.created_at,
      c.codigo_cliente,
      c.nombre_empresa AS cliente,
      uo.nombre_ubicacion AS origen,
      uo.pais AS origen_pais,
      ud.nombre_ubicacion AS destino,
      ud.pais AS destino_pais,
      ee.nombre_estado_envio
    FROM \`${T.envio}\` e
    LEFT JOIN \`${T.cliente}\` c ON c.id = e.cliente_id
    LEFT JOIN \`${T.ubicacion}\` uo ON uo.id = e.origen_id
    LEFT JOIN \`${T.ubicacion}\` ud ON ud.id = e.destino_id
    LEFT JOIN \`${T.estadoEnvio}\` ee ON ee.id = e.estado_id
    ORDER BY e.id DESC
  `);

  return rows.map((row) => ({
    ...row,
    estado: normalizarEstadoEnvio(row.nombre_estado_envio),
  }));
};

const getViajesRows = async () => {
  const [rows] = await pool.query(`
    SELECT
      v.id,
      v.codigo,
      v.cliente_id,
      v.ruta_id,
      v.unidad_id,
      v.piloto_id,
      v.envio_id,
      v.fecha_salida,
      DATE_FORMAT(v.eta, '%H:%i') AS eta,
      v.eta AS eta_datetime,
      v.progreso AS viaje_progreso,
      v.created_at,

      c.codigo_cliente,
      c.nombre_empresa AS cliente,

      e.codigo AS envio_codigo,

      r.codigo_ruta,
      r.nombre_ruta,
      r.distancia_km,
      uo.nombre_ubicacion AS origen,
      uo.pais AS origen_pais,
      ud.nombre_ubicacion AS destino,
      ud.pais AS destino_pais,

      un.codigo AS unidad,
      un.tipo AS unidad_tipo,

      p.codigo_piloto,
      ${fullNameSQL("p")} AS piloto,
      p.licencia,

      tv.estado_id,
      tv.porcentaje,
      tv.fecha AS tracking_fecha,
      ee.nombre_estado_envio,

      al.id AS alerta_id,
      al.tipo AS alerta_tipo,
      al.descripcion AS alerta_descripcion,
      al.nivel AS alerta_nivel,
      al.leida AS alerta_leida
    FROM \`${T.viaje}\` v
    LEFT JOIN \`${T.cliente}\` c ON c.id = v.cliente_id
    LEFT JOIN \`${T.envio}\` e ON e.id = v.envio_id
    LEFT JOIN \`${T.ruta}\` r ON r.id = v.ruta_id
    LEFT JOIN \`${T.ubicacion}\` uo ON uo.id = r.origen_id
    LEFT JOIN \`${T.ubicacion}\` ud ON ud.id = r.destino_id
    LEFT JOIN \`${T.unidad}\` un ON un.id = v.unidad_id
    LEFT JOIN \`${T.piloto}\` p ON p.id = v.piloto_id
    LEFT JOIN \`${T.trackingViaje}\` tv
      ON tv.id = (
        SELECT x.id
        FROM \`${T.trackingViaje}\` x
        WHERE x.viaje_id = v.id
        ORDER BY x.fecha DESC, x.id DESC
        LIMIT 1
      )
    LEFT JOIN \`${T.estadoEnvio}\` ee ON ee.id = tv.estado_id
    LEFT JOIN \`${T.alerta}\` al
      ON al.id = (
        SELECT a.id
        FROM \`${T.alerta}\` a
        WHERE a.viaje_id = v.id
          AND COALESCE(a.leida, 0) = 0
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT 1
      )
    ORDER BY v.id DESC
  `);

  return rows.map((row) => {
    const estado = normalizarEstadoViaje(row);
    const progreso =
      row.porcentaje !== null && row.porcentaje !== undefined
        ? Number(row.porcentaje)
        : Number(row.viaje_progreso || 0);

    return {
      ...row,
      ruta: row.origen && row.destino ? `${row.origen} → ${row.destino}` : row.nombre_ruta,
      fechaSalida: row.fecha_salida,
      estado,
      progreso,
    };
  });
};

const getDepositosRows = async () => {
  const [rows] = await pool.query(`
    SELECT
      d.id,
      d.codigo,
      d.nombre_deposito,
      d.ubicacion_id,
      d.direccion,
      d.capacidad,
      d.unidad_medida,
      d.tipo_id,
      d.activo,
      d.created_at,
      u.nombre_ubicacion,
      u.pais,
      td.nombre_tipo_deposito,
      td.codigo_tipo_deposito
    FROM \`${T.deposito}\` d
    LEFT JOIN \`${T.ubicacion}\` u ON u.id = d.ubicacion_id
    LEFT JOIN \`${T.tipoDeposito}\` td ON td.id = d.tipo_id
    ORDER BY d.id DESC
  `);

  return rows.map((row) => ({
    ...row,
    nombre: row.nombre_deposito,
    ubicacion: row.nombre_ubicacion
      ? `${row.nombre_ubicacion}, ${row.pais || ""}`.replace(/,\s*$/, "")
      : row.direccion || "",
    tipo: row.nombre_tipo_deposito,
    estado: Number(row.activo) === 1 ? "Activo" : "Inactivo",
  }));
};

const syncAlertaOperativa = async (connection, viajeId, codigo, estadoVisual) => {
  await connection.query(
    `
    UPDATE \`${T.alerta}\`
    SET leida = 1
    WHERE viaje_id = ?
      AND COALESCE(leida, 0) = 0
      AND (tipo LIKE '%Retraso%' OR tipo LIKE '%crítica%' OR tipo LIKE '%crítica%' OR nivel IN ('Medio','Alto','Crítico'))
    `,
    [viajeId]
  );

  const estado = limpiar(estadoVisual);

  if (estado !== "Retraso" && estado !== "Crítico") return;

  const tipo = estado === "Crítico" ? "Situación crítica" : "Retraso de viaje";
  const nivel = estado === "Crítico" ? "Crítico" : "Medio";
  const descripcion =
    estado === "Crítico"
      ? `El viaje ${codigo} fue marcado como crítico y requiere atención inmediata.`
      : `El viaje ${codigo} fue marcado con retraso respecto a la planificación.`;

  await connection.query(
    `
    INSERT INTO \`${T.alerta}\`
    (viaje_id, tipo, descripcion, nivel, leida)
    VALUES (?, ?, ?, ?, 0)
    `,
    [viajeId, tipo, descripcion, nivel]
  );
};

const registrarTracking = async (connection, viajeId, estadoId, porcentaje) => {
  await connection.query(
    `
    INSERT INTO \`${T.trackingViaje}\`
    (viaje_id, latitud, longitud, estado_id, porcentaje)
    VALUES (?, NULL, NULL, ?, ?)
    `,
    [viajeId, estadoId, Math.max(0, Math.min(100, numeroDecimal(porcentaje, 0)))]
  );
};

const saveEnvio = async (connection, body, id = null) => {
  const clienteId = asId(body.cliente_id);
  const origenId = asId(body.origen_id);
  const destinoId = asId(body.destino_id);

  if (!clienteId) throw new Error("Selecciona un cliente.");
  if (!origenId) throw new Error("Selecciona el origen.");
  if (!destinoId) throw new Error("Selecciona el destino.");
  if (origenId === destinoId) throw new Error("El destino debe ser diferente del origen.");

  const fecha = asDate(body.fecha);
  if (!fecha) throw new Error("Selecciona la fecha del envío.");

  const estadoId = asId(body.estado_id) || (await estadoIdDesdeVisual(connection, body.estado || "Pendiente"));

  const payload = [
    clienteId,
    origenId,
    destinoId,
    textoComercial(body.direccion, 180),
    fecha,
    estadoId,
    textoComercial(body.observaciones, 250) || null,
  ];

  if (id) {
    await connection.query(
      `
      UPDATE \`${T.envio}\`
      SET cliente_id = ?,
          origen_id = ?,
          destino_id = ?,
          direccion = ?,
          fecha = ?,
          estado_id = ?,
          observaciones = ?
      WHERE id = ?
      `,
      [...payload, id]
    );

    return { id };
  }

  const codigo = limpiar(body.codigo) || (await nextCode(connection, T.envio, "codigo", "ENV", 4));

  const [result] = await connection.query(
    `
    INSERT INTO \`${T.envio}\`
    (codigo, cliente_id, origen_id, destino_id, direccion, fecha, estado_id, observaciones)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [codigo, ...payload]
  );

  return { id: result.insertId, codigo };
};

const saveViaje = async (connection, body, id = null) => {
  const clienteId = asId(body.cliente_id);
  const envioId = asId(body.envio_id);
  const rutaId = asId(body.ruta_id);
  const unidadId = asId(body.unidad_id);
  const pilotoId = asId(body.piloto_id);
  const fechaSalida = asDateTime(body.fecha_salida || body.fechaSalida);

  if (!clienteId) throw new Error("Selecciona un cliente.");
  if (!envioId) {
    throw new Error("Para guardar un viaje primero debés seleccionar un envío relacionado. Si el cliente no tiene envíos, registrá el envío y luego regresá a Nuevo Viaje.");
  }
  if (!rutaId) throw new Error("Selecciona una ruta.");
  if (!unidadId) throw new Error("Selecciona una unidad.");
  if (!pilotoId) throw new Error("Selecciona un piloto.");
  if (!fechaSalida) throw new Error("Selecciona fecha y hora de salida.");

  const [[envio]] = await connection.query(
    `SELECT cliente_id FROM \`${T.envio}\` WHERE id = ? LIMIT 1`,
    [envioId]
  );

  if (!envio) throw new Error("El envío relacionado no existe.");
  if (Number(envio.cliente_id) !== Number(clienteId)) {
    throw new Error("El envío seleccionado pertenece a otro cliente.");
  }

  const eta = normalizarEtaDateTime(body.eta, fechaSalida);
  if (!eta) throw new Error("Ingresa una ETA válida.");

  const progreso = Math.max(0, Math.min(100, numeroDecimal(body.progreso, 0)));
  const estadoVisual = limpiar(body.estado || "Pendiente");
  const estadoId = await estadoIdDesdeVisual(connection, estadoVisual);

  if (id) {
    const [[actual]] = await connection.query(
      `SELECT codigo FROM \`${T.viaje}\` WHERE id = ? LIMIT 1`,
      [id]
    );

    if (!actual) throw new Error("El viaje no existe.");

    await connection.query(
      `
      UPDATE \`${T.viaje}\`
      SET cliente_id = ?,
          ruta_id = ?,
          unidad_id = ?,
          piloto_id = ?,
          fecha_salida = ?,
          eta = ?,
          progreso = ?,
          envio_id = ?
      WHERE id = ?
      `,
      [clienteId, rutaId, unidadId, pilotoId, fechaSalida, eta || null, progreso, envioId, id]
    );

    await registrarTracking(connection, id, estadoId, progreso);
    await syncAlertaOperativa(connection, id, actual.codigo, estadoVisual);

    return { id, codigo: actual.codigo };
  }

  const codigo = limpiar(body.codigo) || (await nextCode(connection, T.viaje, "codigo", "VJ", 3));

  const [result] = await connection.query(
    `
    INSERT INTO \`${T.viaje}\`
    (codigo, cliente_id, ruta_id, unidad_id, piloto_id, fecha_salida, eta, progreso, envio_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [codigo, clienteId, rutaId, unidadId, pilotoId, fechaSalida, eta || null, progreso, envioId]
  );

  const viajeId = result.insertId;

  await registrarTracking(connection, viajeId, estadoId, progreso);
  await syncAlertaOperativa(connection, viajeId, codigo, estadoVisual);

  return { id: viajeId, codigo };
};

const saveDeposito = async (connection, body, id = null) => {
  const nombre = textoComercial(body.nombre_deposito || body.nombre, 120);
  const ubicacionId = asId(body.ubicacion_id);
  const tipoId = asId(body.tipo_id);

  if (!nombre) throw new Error("Ingresa el nombre del depósito.");
  if (!ubicacionId) throw new Error("Selecciona la ubicación.");
  if (!tipoId) throw new Error("Selecciona el tipo de depósito.");

  const capacidad = numeroDecimal(body.capacidad, 0);
  if (capacidad <= 0) throw new Error("Ingresa una capacidad válida.");

  const unidadMedida = limpiar(body.unidad_medida || "m³").slice(0, 20);
  const activo = body.activo === false || body.estado === "Inactivo" ? 0 : 1;
  const direccion = textoComercial(body.direccion, 180) || null;

  const payload = [nombre, ubicacionId, direccion, capacidad, unidadMedida, tipoId, activo];

  if (id) {
    await connection.query(
      `
      UPDATE \`${T.deposito}\`
      SET nombre_deposito = ?,
          ubicacion_id = ?,
          direccion = ?,
          capacidad = ?,
          unidad_medida = ?,
          tipo_id = ?,
          activo = ?
      WHERE id = ?
      `,
      [...payload, id]
    );

    return { id };
  }

  const codigo = limpiar(body.codigo) || (await nextCode(connection, T.deposito, "codigo", "DEP", 3));

  const [result] = await connection.query(
    `
    INSERT INTO \`${T.deposito}\`
    (codigo, nombre_deposito, ubicacion_id, direccion, capacidad, unidad_medida, tipo_id, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [codigo, ...payload]
  );

  return { id: result.insertId, codigo };
};

const safeDelete = async (connection, sql, params = []) => {
  try {
    await connection.query(sql, params);
  } catch (error) {
    // Algunas tablas pueden no existir según la versión de la base.
    // Si no existen, no detenemos el borrado del viaje.
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

/* =====================================================
   Rutas
===================================================== */

router.get("/logistica/bootstrap", async (req, res) => {
  try {
    const [catalogos, envios, viajes, depositos] = await Promise.all([
      queryCatalogos(),
      getEnviosRows(),
      getViajesRows(),
      getDepositosRows(),
    ]);

    return ok(res, {
      ...catalogos,
      envios,
      viajes,
      depositos,
    });
  } catch (error) {
    console.error("Error /logistica/bootstrap:", error);
    return fail(res, 500, "No se pudo cargar Logística.", error);
  }
});

router.get("/logistica/catalogos", async (req, res) => {
  try {
    return ok(res, await queryCatalogos());
  } catch (error) {
    console.error("Error /logistica/catalogos:", error);
    return fail(res, 500, "No se pudieron cargar los catálogos de logística.", error);
  }
});

router.get("/logistica/envios", async (req, res) => {
  try {
    return ok(res, await getEnviosRows());
  } catch (error) {
    console.error("Error GET envios:", error);
    return fail(res, 500, "No se pudieron obtener los envíos.", error);
  }
});

router.post("/logistica/envios", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await saveEnvio(connection, req.body);
    await connection.commit();
    return ok(res, result, "Envío guardado correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error POST envio:", error);
    return fail(res, 500, "No se pudo guardar el envío.", error);
  } finally {
    connection.release();
  }
});

router.put("/logistica/envios/:id", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const id = asId(req.params.id);
    if (!id) return fail(res, 400, "ID de envío inválido.");

    await connection.beginTransaction();
    const result = await saveEnvio(connection, req.body, id);
    await connection.commit();
    return ok(res, result, "Envío actualizado correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error PUT envio:", error);
    return fail(res, 500, "No se pudo actualizar el envío.", error);
  } finally {
    connection.release();
  }
});

router.delete("/logistica/envios/:id", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const id = asId(req.params.id);
    if (!id) return fail(res, 400, "ID de envío inválido.");

    await connection.beginTransaction();

    const [[rel]] = await connection.query(
      `SELECT COUNT(*) AS total FROM \`${T.viaje}\` WHERE envio_id = ?`,
      [id]
    );

    if (Number(rel.total || 0) > 0) {
      await connection.rollback();
      return fail(
        res,
        409,
        "No se puede eliminar este envío porque ya está relacionado con uno o más viajes. Si necesitás ocultarlo, cambiá su estado en lugar de borrarlo."
      );
    }

    await connection.query(`DELETE FROM \`${T.envio}\` WHERE id = ?`, [id]);
    await connection.commit();

    return ok(res, { id }, "Envío eliminado correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error DELETE envio:", error);
    return fail(res, 500, "No se pudo eliminar el envío.", error);
  } finally {
    connection.release();
  }
});

router.get("/logistica/viajes", async (req, res) => {
  try {
    return ok(res, await getViajesRows());
  } catch (error) {
    console.error("Error GET viajes:", error);
    return fail(res, 500, "No se pudieron obtener los viajes.", error);
  }
});

router.post("/logistica/viajes", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await saveViaje(connection, req.body);
    await connection.commit();
    return ok(res, result, "Viaje guardado correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error POST viaje:", error);
    return fail(res, 500, "No se pudo guardar el viaje.", error);
  } finally {
    connection.release();
  }
});

router.put("/logistica/viajes/:id", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const id = asId(req.params.id);
    if (!id) return fail(res, 400, "ID de viaje inválido.");

    await connection.beginTransaction();
    const result = await saveViaje(connection, req.body, id);
    await connection.commit();
    return ok(res, result, "Viaje actualizado correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error PUT viaje:", error);
    return fail(res, 500, "No se pudo actualizar el viaje.", error);
  } finally {
    connection.release();
  }
});

router.put("/logistica/viajes/:id/estado", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const id = asId(req.params.id);
    if (!id) return fail(res, 400, "ID de viaje inválido.");

    const [[viaje]] = await connection.query(
      `SELECT id, codigo, progreso FROM \`${T.viaje}\` WHERE id = ? LIMIT 1`,
      [id]
    );

    if (!viaje) return fail(res, 404, "El viaje no existe.");

    await connection.beginTransaction();

    const estado = limpiar(req.body.estado || "En tránsito");
    const progreso = Math.max(0, Math.min(100, numeroDecimal(req.body.progreso, 0)));
    const estadoId = await estadoIdDesdeVisual(connection, estado);

    await connection.query(
      `UPDATE \`${T.viaje}\` SET progreso = ? WHERE id = ?`,
      [progreso, id]
    );

    await registrarTracking(connection, id, estadoId, progreso);
    await syncAlertaOperativa(connection, id, viaje.codigo, estado);

    await connection.commit();

    return ok(res, { id, estado, progreso }, "Estado del viaje actualizado correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error estado viaje:", error);
    return fail(res, 500, "No se pudo actualizar el estado del viaje.", error);
  } finally {
    connection.release();
  }
});

router.delete("/logistica/viajes/:id", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const id = asId(req.params.id);
    if (!id) return fail(res, 400, "ID de viaje inválido.");

    await connection.beginTransaction();

    /*
      El viaje puede estar relacionado con tablas hijas.
      Se eliminan primero para evitar:
      ER_ROW_IS_REFERENCED_2 / fk_vehiculo_asignacion_viajes1
    */
    await safeDelete(connection, `DELETE FROM vehiculo_asignacion WHERE viaje_id = ?`, [id]);
    await safeDelete(connection, `DELETE FROM viaje_asignaciones WHERE viaje_id = ?`, [id]);
    await safeDelete(connection, `DELETE FROM \`${T.trackingViaje}\` WHERE viaje_id = ?`, [id]);
    await safeDelete(connection, `DELETE FROM \`${T.alerta}\` WHERE viaje_id = ?`, [id]);

    await connection.query(`DELETE FROM \`${T.viaje}\` WHERE id = ?`, [id]);

    await connection.commit();

    return ok(res, { id }, "Viaje eliminado correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error DELETE viaje:", error);
    return fail(res, 500, "No se pudo eliminar el viaje.", error);
  } finally {
    connection.release();
  }
});

router.get("/logistica/depositos", async (req, res) => {
  try {
    return ok(res, await getDepositosRows());
  } catch (error) {
    console.error("Error GET depositos:", error);
    return fail(res, 500, "No se pudieron obtener los depósitos.", error);
  }
});

router.post("/logistica/depositos", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await saveDeposito(connection, req.body);
    await connection.commit();
    return ok(res, result, "Depósito guardado correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error POST deposito:", error);
    return fail(res, 500, "No se pudo guardar el depósito.", error);
  } finally {
    connection.release();
  }
});

router.put("/logistica/depositos/:id", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const id = asId(req.params.id);
    if (!id) return fail(res, 400, "ID de depósito inválido.");

    await connection.beginTransaction();
    const result = await saveDeposito(connection, req.body, id);
    await connection.commit();
    return ok(res, result, "Depósito actualizado correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error PUT deposito:", error);
    return fail(res, 500, "No se pudo actualizar el depósito.", error);
  } finally {
    connection.release();
  }
});

router.delete("/logistica/depositos/:id", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const id = asId(req.params.id);
    if (!id) return fail(res, 400, "ID de depósito inválido.");

    await connection.beginTransaction();

    // Se inactiva para evitar problemas si hay relaciones futuras.
    await connection.query(`UPDATE \`${T.deposito}\` SET activo = 0 WHERE id = ?`, [id]);

    await connection.commit();

    return ok(res, { id, inactivado: true }, "Depósito inactivado correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error DELETE deposito:", error);
    return fail(res, 500, "No se pudo inactivar el depósito.", error);
  } finally {
    connection.release();
  }
});

module.exports = router;