const express = require("express");
const pool = require("../config/db");

const router = express.Router();

/*
  OPERACIONES GL365 - Base nueva en singular
  Montaje recomendado en src/server.js:

  const operacionesRoutes = require("./routes/operaciones.routes");
  app.use("/api", operacionesRoutes);

  Este archivo reemplaza rutas viejas que buscaban tablas en plural:
  asignaciones, proveedores, envios, viajes, rutas, clientes, vehiculos, pilotos, etc.

  La base nueva usa:
  asignacion, proveedor, envio, viaje, ruta, cliente, vehiculo, piloto, etc.
*/

const T = {
  asignacion: "asignacion",
  costoAsignacion: "costo_asignacion",
  unidadOperacion: "unidad_operacion",
  proveedorAsignacion: "proveedor_asignacion",
  facturaAsignacion: "factura_asignacion",
  pagoProveedor: "pago_proveedor",

  cliente: "cliente",
  estadoCliente: "estado_cliente",
  proveedor: "proveedor",
  contactoProveedor: "contacto_proveedor",
  servicioProveedor: "servicio_proveedor",
  cumplimientoProveedor: "cumplimiento_proveedor",
  desempenoProveedor: "desempeno_proveedor",
  estadoProveedor: "estado_proveedor",

  envio: "envio",
  viaje: "viaje",
  ruta: "ruta",
  ubicacion: "ubicacion",

  unidad: "unidad",
  vehiculo: "vehiculo",
  tipoVehiculo: "tipo_vehiculo",
  estadoVehiculo: "estado_vehiculo",
  piloto: "piloto",
  estadoAsignacion: "estado_asignacion",
  usuario: "usuario",
};

const TABLE_MAP = {
  asignaciones: T.asignacion,
  asignacion: T.asignacion,

  costos_asignacion: T.costoAsignacion,
  costo_asignacion: T.costoAsignacion,

  unidades_operacion: T.unidadOperacion,
  unidad_operacion: T.unidadOperacion,

  proveedor_asignacion: T.proveedorAsignacion,
  proveedores_asignacion: T.proveedorAsignacion,

  factura_asignacion: T.facturaAsignacion,

  pagos_proveedor: T.pagoProveedor,
  pago_proveedor: T.pagoProveedor,

  clientes: T.cliente,
  cliente: T.cliente,

  proveedores: T.proveedor,
  proveedor: T.proveedor,

  contactos_proveedor: T.contactoProveedor,
  contacto_proveedor: T.contactoProveedor,

  servicios_proveedor: T.servicioProveedor,
  servicio_proveedor: T.servicioProveedor,

  cumplimiento_proveedor: T.cumplimientoProveedor,
  desempeno_proveedor: T.desempenoProveedor,

  envios: T.envio,
  envio: T.envio,

  viajes: T.viaje,
  viaje: T.viaje,

  rutas: T.ruta,
  ruta: T.ruta,

  ubicaciones: T.ubicacion,
  ubicacion: T.ubicacion,

  unidades: T.unidad,
  unidad: T.unidad,

  vehiculos: T.vehiculo,
  vehiculo: T.vehiculo,

  pilotos: T.piloto,
  piloto: T.piloto,

  tipos_vehiculo: T.tipoVehiculo,
  tipo_vehiculo: T.tipoVehiculo,

  estados_asignacion: T.estadoAsignacion,
  estado_asignacion: T.estadoAsignacion,

  estados_proveedor: T.estadoProveedor,
  estado_proveedor: T.estadoProveedor,
};

const EXTRA_COLUMNS = {
  asignaciones: [
    "pilotos_id",
    "clienteId",
    "rutaId",
    "vehiculoId",
    "pilotoId",
    "proveedorId",
    "cliente",
    "ruta",
    "vehiculo",
    "piloto",
    "proveedor",
    "carga",
    "descarga",
    "marchamo",
    "licencia",
    "cabezal",
    "furgon",
    "tipo",
    "origen",
    "destino",
    "auxiliar",
    "km",
    "doc",
    "vendedor",
    "flete",
    "paradaAdicional",
    "parada_adicional",
    "movFalso",
    "movimiento_falso",
    "estadia",
    "viajeDoble",
    "viaje_doble",
    "otros",
    "total",
    "fechaProveedor",
    "serieProveedor",
    "numeroProveedor",
    "fleteProveedor",
    "cuadrilla",
    "estadiaProveedor",
    "totalProveedor",
    "fechaPagoProveedor",
    "fechaFactura",
    "serieFactura",
    "numeroFactura",
    "valorFactura",
    "fechaPagoFactura",
  ],
  proveedores: [
    "name",
    "nombre_proveedor",
    "nombre_empresa",
    "proveedor",
    "service",
    "servicio",
    "tipo_servicio",
    "contact",
    "contacto",
    "rtuValidated",
    "rtu_validado",
    "satStatus",
    "estado_sat",
    "clintonInvestigation",
    "investigacion_clinton",
    "pilotLicenseValidated",
    "licencia_validada",
    "bankAccountValidated",
    "cuenta_bancaria_validada",
    "performance",
    "desempeno",
    "evaluacion",
    "history",
    "historial",
    "findings",
    "hallazgos",
    "status",
    "estado",
    "estado_proveedor_id",
  ],
  pilotos: ["nombre_piloto", "nombre", "numero_licencia"],
  vehiculos: ["placa", "tipo", "tipo_vehiculo", "nombre_tipo_vehiculo"],
  rutas: ["nombre", "distancia"],
  ubicaciones: ["nombre"],
  clientes: ["name", "representante"],
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


const extraerCorreo = (valor) => {
  const match = String(valor || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : "";
};

const extraerTelefono = (valor, max = 15) => {
  const text = String(valor || "");

  const parts = text
    .split(/[\/,;|]+/)
    .map((part) => part.replace(/\D/g, ""))
    .filter((part) => part.length >= 7);

  if (parts[0]) return parts[0].slice(0, max);

  const all = text.replace(/\D/g, "");
  return all.length >= 7 ? all.slice(0, max) : "";
};

const asId = (valor) => {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const asMoney = (valor) => {
  const n = Number(String(valor ?? 0).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const asDate = (valor) => {
  const v = limpiar(valor);
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);

  const parts = v.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${String(y).padStart(4, "20")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  return null;
};

const fullNameSQL = (alias) =>
  `CONCAT_WS(' ', ${alias}.primer_nombre, ${alias}.segundo_nombre, ${alias}.primer_apellido, ${alias}.segundo_apellido)`;

const splitPersona = (nombre, fallbackNombre = "Registro", fallbackApellido = "Operativo") => {
  const parts = limpiar(nombre).split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return {
      primer_nombre: fallbackNombre,
      segundo_nombre: null,
      primer_apellido: fallbackApellido,
      segundo_apellido: null,
    };
  }

  if (parts.length === 1) {
    return {
      primer_nombre: parts[0],
      segundo_nombre: null,
      primer_apellido: fallbackApellido,
      segundo_apellido: null,
    };
  }

  if (parts.length === 2) {
    return {
      primer_nombre: parts[0],
      segundo_nombre: null,
      primer_apellido: parts[1],
      segundo_apellido: null,
    };
  }

  return {
    primer_nombre: parts[0],
    segundo_nombre: parts.length > 3 ? parts.slice(1, -2).join(" ") : null,
    primer_apellido: parts[parts.length - 2],
    segundo_apellido: parts[parts.length - 1],
  };
};

const slug = (texto, prefijo, max = 15) => {
  const clean = limpiar(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "")
    .toUpperCase()
    .slice(0, Math.max(1, max - prefijo.length - 1));

  return `${prefijo}-${clean || Date.now().toString().slice(-5)}`.slice(0, max);
};

const tableName = (name) => TABLE_MAP[String(name || "").trim()] || String(name || "").trim();

const getColumns = async (tabla) => {
  const [rows] = await pool.query(
    `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
    ORDER BY ORDINAL_POSITION
    `,
    [tabla]
  );

  return rows.map((r) => r.COLUMN_NAME);
};

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

const nextCode = async (connection, tabla, campo, prefijo) => {
  const [rows] = await connection.query(
    `SELECT \`${campo}\` AS codigo FROM \`${tabla}\` WHERE \`${campo}\` LIKE ?`,
    [`${prefijo}-%`]
  );

  let max = 0;

  rows.forEach((row) => {
    const m = String(row.codigo || "").match(/(\d+)(?!.*\d)/);
    if (m) max = Math.max(max, Number(m[1]));
  });

  return `${prefijo}-${String(max + 1).padStart(3, "0")}`;
};

const firstId = async (connection, tabla, order = "id") => {
  const [rows] = await connection.query(
    `SELECT id FROM \`${tabla}\` ORDER BY \`${order}\` LIMIT 1`
  );
  return rows[0]?.id || null;
};

const mapPayloadForTable = (tableKey, payload) => {
  const p = { ...payload };

  if (tableKey === "asignaciones" || tableKey === "asignacion") {
    if (p.pilotos_id && !p.piloto_id) p.piloto_id = p.pilotos_id;
    if (p.carga && !p.fecha_carga) p.fecha_carga = asDate(p.carga);
    if (p.descarga && !p.fecha_descarga) p.fecha_descarga = asDate(p.descarga);
  }

  if (tableKey === "clientes" || tableKey === "cliente") {
    if (p.name && !p.nombre_empresa) p.nombre_empresa = p.name;
  }

  if (tableKey === "rutas" || tableKey === "ruta") {
    if (p.nombre && !p.nombre_ruta) p.nombre_ruta = p.nombre;
    if (p.distancia && !p.distancia_km) p.distancia_km = p.distancia;
  }

  if (tableKey === "ubicaciones" || tableKey === "ubicacion") {
    if (p.nombre && !p.nombre_ubicacion) p.nombre_ubicacion = p.nombre;
  }

  if (tableKey === "vehiculos" || tableKey === "vehiculo") {
    if (p.placa && !p.codigo) p.codigo = p.placa;
  }

  return p;
};

const filterActualColumns = async (tabla, payload) => {
  const columns = await getColumns(tabla);
  const allowed = new Set(columns);

  const clean = {};

  Object.entries(payload).forEach(([key, value]) => {
    if (key === "id") return;
    if (!allowed.has(key)) return;
    if (value === undefined) return;
    clean[key] = value;
  });

  return clean;
};

const insertGeneric = async (connection, tabla, payload) => {
  const data = await filterActualColumns(tabla, payload);

  if (Object.keys(data).length === 0) {
    throw new Error("No hay campos válidos para guardar.");
  }

  const columns = Object.keys(data);
  const values = Object.values(data);

  const [result] = await connection.query(
    `
    INSERT INTO \`${tabla}\`
    (${columns.map((c) => `\`${c}\``).join(", ")})
    VALUES (${columns.map(() => "?").join(", ")})
    `,
    values
  );

  return result.insertId;
};

const updateGeneric = async (connection, tabla, id, payload) => {
  const data = await filterActualColumns(tabla, payload);

  if (Object.keys(data).length === 0) {
    return;
  }

  const columns = Object.keys(data);
  const values = Object.values(data);

  await connection.query(
    `
    UPDATE \`${tabla}\`
    SET ${columns.map((c) => `\`${c}\` = ?`).join(", ")}
    WHERE id = ?
    `,
    [...values, id]
  );
};

const upsertByAsignacion = async (connection, tabla, asignacionId, data) => {
  const clean = await filterActualColumns(tabla, data);
  if (Object.keys(clean).length === 0) return;

  const [[existing]] = await connection.query(
    `SELECT id FROM \`${tabla}\` WHERE asignacion_id = ? LIMIT 1`,
    [asignacionId]
  );

  if (existing?.id) {
    await updateGeneric(connection, tabla, existing.id, clean);
  } else {
    clean.asignacion_id = asignacionId;
    await insertGeneric(connection, tabla, clean);
  }
};

const findOrCreateCliente = async (connection, body) => {
  const direct = asId(body.cliente_id || body.clienteId);
  if (direct) return direct;

  const nombre = limpiar(body.cliente || body.nombre_empresa || body.name);
  if (!nombre) return await firstId(connection, T.cliente);

  const [rows] = await connection.query(
    `
    SELECT id
    FROM \`${T.cliente}\`
    WHERE LOWER(nombre_empresa) = LOWER(?)
    ORDER BY id
    LIMIT 1
    `,
    [nombre]
  );

  if (rows[0]?.id) return rows[0].id;

  const codigo = await nextCode(connection, T.cliente, "codigo_cliente", "CLI");

  const [insert] = await connection.query(
    `
    INSERT INTO \`${T.cliente}\`
    (codigo_cliente, nombre_empresa, nit, direccion, estado_cliente_id)
    VALUES (?, ?, ?, ?, 1)
    `,
    [codigo, nombre, `CF-${Date.now().toString().slice(-8)}`, "Guatemala"]
  );

  return insert.insertId;
};

const findOrCreateUbicacion = async (connection, text) => {
  const direct = asId(text);
  if (direct) return direct;

  const nombre = limpiar(text);
  if (!nombre) return await firstId(connection, T.ubicacion);

  const [rows] = await connection.query(
    `
    SELECT id
    FROM \`${T.ubicacion}\`
    WHERE LOWER(nombre_ubicacion) = LOWER(?)
       OR LOWER(codigo_ubicacion) = LOWER(?)
    LIMIT 1
    `,
    [nombre, nombre]
  );

  if (rows[0]?.id) return rows[0].id;

  const codigo = slug(nombre, "UB", 15);

  const [insert] = await connection.query(
    `
    INSERT INTO \`${T.ubicacion}\`
    (codigo_ubicacion, nombre_ubicacion, pais)
    VALUES (?, ?, 'Guatemala')
    `,
    [codigo, nombre]
  );

  return insert.insertId;
};

const findOrCreateRuta = async (connection, body) => {
  const direct = asId(body.ruta_id || body.rutaId);
  if (direct) return direct;

  const origenTexto = limpiar(body.origen);
  const destinoTexto = limpiar(body.destino);

  if (!origenTexto && !destinoTexto) {
    return await firstId(connection, T.ruta);
  }

  const origenId = await findOrCreateUbicacion(connection, origenTexto || "Origen");
  const destinoId = await findOrCreateUbicacion(connection, destinoTexto || "Destino");
  const nombreRuta = `${origenTexto || "Origen"} - ${destinoTexto || "Destino"}`;

  const [rows] = await connection.query(
    `
    SELECT id
    FROM \`${T.ruta}\`
    WHERE origen_id = ?
      AND destino_id = ?
    LIMIT 1
    `,
    [origenId, destinoId]
  );

  if (rows[0]?.id) return rows[0].id;

  const codigo = await nextCode(connection, T.ruta, "codigo_ruta", "RUT");

  const frecuenciaId = await firstId(connection, "frecuencia_ruta");
  const estadoId = await firstId(connection, "estado_ruta");

  const [insert] = await connection.query(
    `
    INSERT INTO \`${T.ruta}\`
    (codigo_ruta, nombre_ruta, origen_id, destino_id, distancia_km, tiempo, costo, frecuencia_id, estado_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      codigo,
      nombreRuta.slice(0, 80),
      origenId,
      destinoId,
      asMoney(body.km),
      1,
      asMoney(body.total),
      frecuenciaId || 1,
      estadoId || 1,
    ]
  );

  return insert.insertId;
};

const findTipoVehiculo = async (connection, tipoTexto) => {
  const tipo = limpiar(tipoTexto);

  if (tipo) {
    const [rows] = await connection.query(
      `
      SELECT id
      FROM \`${T.tipoVehiculo}\`
      WHERE LOWER(codigo_tipo_vehiculo) = LOWER(?)
         OR LOWER(nombre_tipo_vehiculo) LIKE LOWER(?)
      ORDER BY id
      LIMIT 1
      `,
      [tipo, `%${tipo}%`]
    );

    if (rows[0]?.id) return rows[0].id;
  }

  return await firstId(connection, T.tipoVehiculo);
};

const findOrCreateVehiculo = async (connection, body) => {
  const direct = asId(body.vehiculo_id || body.vehiculoId);
  if (direct) return direct;

  const codigo = limpiar(body.cabezal || body.vehiculo || body.codigo || body.placa);
  if (!codigo) return await firstId(connection, T.vehiculo);

  const [rows] = await connection.query(
    `
    SELECT id
    FROM \`${T.vehiculo}\`
    WHERE LOWER(codigo) = LOWER(?)
    LIMIT 1
    `,
    [codigo]
  );

  if (rows[0]?.id) return rows[0].id;

  const tipoId = await findTipoVehiculo(connection, body.tipo);
  const estadoId = await firstId(connection, T.estadoVehiculo);
  const estadoMantenimientoId = await firstId(connection, "estado_mantenimiento");

  const [insert] = await connection.query(
    `
    INSERT INTO \`${T.vehiculo}\`
    (codigo, tipo_id, estado_id, eficiencia, kilometraje, estado_mantenimiento_id, proximo_mantenimiento)
    VALUES (?, ?, ?, 85, 0, ?, DATE_ADD(CURDATE(), INTERVAL 60 DAY))
    `,
    [codigo, tipoId || 1, estadoId || 1, estadoMantenimientoId || 1]
  );

  return insert.insertId;
};

const findOrCreatePiloto = async (connection, body) => {
  const direct = asId(body.piloto_id || body.pilotoId || body.pilotos_id);
  if (direct) return direct;

  const licencia = limpiar(body.licencia);
  const nombre = limpiar(body.piloto || body.nombre_piloto || body.nombre);

  if (licencia) {
    const [rows] = await connection.query(
      `SELECT id FROM \`${T.piloto}\` WHERE LOWER(licencia) = LOWER(?) LIMIT 1`,
      [licencia]
    );

    if (rows[0]?.id) return rows[0].id;
  }

  if (nombre) {
    const [rows] = await connection.query(
      `
      SELECT id
      FROM \`${T.piloto}\`
      WHERE LOWER(CONCAT_WS(' ', primer_nombre, segundo_nombre, primer_apellido, segundo_apellido)) = LOWER(?)
      LIMIT 1
      `,
      [nombre]
    );

    if (rows[0]?.id) return rows[0].id;
  }

  if (!nombre && !licencia) return await firstId(connection, T.piloto);

  const partes = splitPersona(nombre || "Piloto Operativo", "Piloto", "Operativo");
  const codigo = await nextCode(connection, T.piloto, "codigo_piloto", "PIL");

  const [insert] = await connection.query(
    `
    INSERT INTO \`${T.piloto}\`
    (codigo_piloto, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, licencia)
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      codigo,
      partes.primer_nombre,
      partes.segundo_nombre,
      partes.primer_apellido,
      partes.segundo_apellido,
      licencia || `PEND-${Date.now().toString().slice(-6)}`,
    ]
  );

  return insert.insertId;
};

const findOrCreateProveedor = async (connection, body) => {
  const direct = asId(body.proveedor_id || body.proveedorId);
  if (direct) return direct;

  const nombre = limpiar(
    body.razon_social ||
      body.proveedor ||
      body.nombre_proveedor ||
      body.nombre_empresa ||
      body.name
  );

  const nombreComercial = limpiar(
    body.nombre_comercial ||
      body.nombreComercial ||
      body.name ||
      nombre
  );

  if (!nombre) return await firstId(connection, T.proveedor);

  const [rows] = await connection.query(
    `
    SELECT id
    FROM \`${T.proveedor}\`
    WHERE LOWER(razon_social) = LOWER(?)
       OR LOWER(nombre_comercial) = LOWER(?)
    ORDER BY id
    LIMIT 1
    `,
    [nombre, nombre]
  );

  if (rows[0]?.id) return rows[0].id;

  const codigo = await nextCode(connection, T.proveedor, "codigo_proveedor", "PROV");
  const estadoId = await firstId(connection, T.estadoProveedor);
  const contacto = limpiar(body.contact || body.contacto);
  const correo = extraerCorreo(body.correo || contacto);
  const telefono = extraerTelefono(body.telefono || contacto);

  const [insert] = await connection.query(
    `
    INSERT INTO \`${T.proveedor}\`
    (codigo_proveedor, razon_social, nombre_comercial, nit, estado_id, correo, telefono)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      codigo,
      nombre,
      nombreComercial,
      limpiar(body.nit) || `CF-${Date.now().toString().slice(-8)}`,
      estadoId || 1,
      correo || null,
      telefono || null,
    ]
  );

  return insert.insertId;
};

const resolveUsuario = async (connection, value) => {
  const direct = asId(value);
  if (direct) return direct;

  const text = limpiar(value);
  if (text) {
    const [rows] = await connection.query(
      `
      SELECT id
      FROM \`${T.usuario}\`
      WHERE LOWER(nombre_usuario) = LOWER(?)
         OR LOWER(email) = LOWER(?)
         OR LOWER(CONCAT_WS(' ', primer_nombre, segundo_nombre, primer_apellido, segundo_apellido)) LIKE LOWER(?)
      ORDER BY id
      LIMIT 1
      `,
      [text, text, `%${text}%`]
    );

    if (rows[0]?.id) return rows[0].id;
  }

  return await firstId(connection, T.usuario);
};

const ensureProviderRelated = async (connection, proveedorId, body) => {
  const servicio = limpiar(body.service || body.servicio || body.tipo_servicio);
  if (servicio) {
    const [[existing]] = await connection.query(
      `SELECT id FROM \`${T.servicioProveedor}\` WHERE proveedor_id = ? ORDER BY es_principal DESC, id LIMIT 1`,
      [proveedorId]
    );

    if (existing?.id) {
      await connection.query(
        `
        UPDATE \`${T.servicioProveedor}\`
        SET nombre_servicio_proveedor = ?, es_principal = 1
        WHERE id = ?
        `,
        [servicio, existing.id]
      );
    } else {
      const codigo = await nextCode(connection, T.servicioProveedor, "codigo_servicio", "SRV");
      await connection.query(
        `
        INSERT INTO \`${T.servicioProveedor}\`
        (codigo_servicio, es_principal, nombre_servicio_proveedor, proveedor_id)
        VALUES (?, 1, ?, ?)
        `,
        [codigo, servicio, proveedorId]
      );
    }
  }

  const contacto = limpiar(body.contact || body.contacto);
  const correoContacto = extraerCorreo(body.correo || contacto);
  const telefonoContacto = extraerTelefono(body.telefono || contacto);

  if (correoContacto || telefonoContacto) {
    await connection.query(
      `
      UPDATE \`${T.proveedor}\`
      SET correo = COALESCE(NULLIF(?, ''), correo),
          telefono = COALESCE(NULLIF(?, ''), telefono)
      WHERE id = ?
      `,
      [correoContacto, telefonoContacto, proveedorId]
    );
  }

  const satStatus = limpiar(body.satStatus || body.estado_sat || "Pendiente").toLowerCase();
  const estadoSat =
    satStatus.includes("omiso") || satStatus.includes("no")
      ? "no_vigente"
      : satStatus.includes("solvente") || satStatus.includes("vigente")
      ? "vigente"
      : "pendiente";

  const listaClintonRaw = limpiar(body.clintonInvestigation || body.investigacion_clinton || "Aprobado").toLowerCase();
  const listaClinton = listaClintonRaw.includes("rechaz") ? 0 : 1;

  const [[cum]] = await connection.query(
    `SELECT id FROM \`${T.cumplimientoProveedor}\` WHERE proveedor_id = ? LIMIT 1`,
    [proveedorId]
  );

  const cumPayload = {
    proveedor_id: proveedorId,
    estado_sat: estadoSat,
    lista_clinton: listaClinton,
    rtu_validado: body.rtuValidated || body.rtu_validado ? 1 : 0,
    licencia_validada: body.pilotLicenseValidated || body.licencia_validada ? 1 : 0,
    cuenta_validada: body.bankAccountValidated || body.cuenta_bancaria_validada || body.cuenta_validada ? 1 : 0,
  };

  if (cum?.id) {
    await updateGeneric(connection, T.cumplimientoProveedor, cum.id, cumPayload);
  } else {
    await insertGeneric(connection, T.cumplimientoProveedor, cumPayload);
  }

  const nivelRaw = limpiar(body.performance || body.desempeno || body.evaluacion || "Amarillo");
  const nivel = nivelRaw.toLowerCase().includes("roj")
    ? "Rojo"
    : nivelRaw.toLowerCase().includes("verd")
    ? "Verde"
    : "Amarillo";

  const [[des]] = await connection.query(
    `SELECT id FROM \`${T.desempenoProveedor}\` WHERE proveedor_id = ? ORDER BY id DESC LIMIT 1`,
    [proveedorId]
  );

  const desPayload = {
    proveedor_id: proveedorId,
    nivel,
    historial: limpiar(body.history || body.historial) || null,
    hallazgos: limpiar(body.findings || body.hallazgos) || null,
    fecha: new Date().toISOString().slice(0, 10),
  };

  if (des?.id) {
    await updateGeneric(connection, T.desempenoProveedor, des.id, desPayload);
  } else {
    await insertGeneric(connection, T.desempenoProveedor, desPayload);
  }
};

const saveProvider = async (connection, body, id = null) => {
  /*
    Razón social y nombre comercial son campos diferentes.
    No usar body.name como primera opción para razon_social,
    porque el frontend lo puede usar como nombre de visualización.
  */
  const razonSocial = limpiar(
    body.razon_social ||
      body.nombre_proveedor ||
      body.nombre_empresa ||
      body.proveedor ||
      body.name
  );

  const nombreComercial = limpiar(
    body.nombre_comercial ||
      body.nombreComercial ||
      body.name ||
      razonSocial
  );

  if (!razonSocial) {
    throw new Error("La razón social del proveedor es obligatoria.");
  }

  const contacto = limpiar(body.contact || body.contacto);
  const correo = extraerCorreo(body.correo || contacto);
  const telefono = extraerTelefono(body.telefono || contacto);

  const estadoTxt = limpiar(body.status || body.estado).toLowerCase();
  const estadoId =
    asId(body.estado_id || body.estado_proveedor_id) ||
    (estadoTxt.includes("inactivo") ? 2 : 1);

  let proveedorId = asId(id || body.id);

  if (proveedorId) {
    await connection.query(
      `
      UPDATE \`${T.proveedor}\`
      SET razon_social = ?,
          nombre_comercial = ?,
          nit = COALESCE(NULLIF(?, ''), nit),
          estado_id = ?,
          correo = ?,
          telefono = ?
      WHERE id = ?
      `,
      [
        razonSocial,
        nombreComercial,
        limpiar(body.nit),
        estadoId,
        correo || null,
        telefono || null,
        proveedorId,
      ]
    );
  } else {
    const codigo = limpiar(body.codigo_proveedor) || (await nextCode(connection, T.proveedor, "codigo_proveedor", "PROV"));

    const [insert] = await connection.query(
      `
      INSERT INTO \`${T.proveedor}\`
      (codigo_proveedor, razon_social, nombre_comercial, nit, estado_id, correo, telefono)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        codigo,
        razonSocial,
        nombreComercial,
        limpiar(body.nit) || `CF-${Date.now().toString().slice(-8)}`,
        estadoId,
        correo || null,
        telefono || null,
      ]
    );

    proveedorId = insert.insertId;
  }

  await ensureProviderRelated(connection, proveedorId, body);
  return proveedorId;
};

const saveAssignment = async (connection, body, id = null) => {
  const asignacionIdEdit = asId(id || body.id);

  const clienteId = await findOrCreateCliente(connection, body);
  const rutaId = await findOrCreateRuta(connection, body);
  const vehiculoId = await findOrCreateVehiculo(connection, body);
  const pilotoId = await findOrCreatePiloto(connection, body);
  const proveedorId = await findOrCreateProveedor(connection, body);
  const estadoId = asId(body.estado_asignacion_id || body.estado_id) || 1;

  const fechaCarga = asDate(body.fecha_carga || body.carga) || new Date().toISOString().slice(0, 10);
  const fechaDescarga = asDate(body.fecha_descarga || body.descarga) || fechaCarga;

  let asignacionId = asignacionIdEdit;
  let codigo = limpiar(body.codigo_asignacion);

  if (asignacionId) {
    const [[actual]] = await connection.query(
      `SELECT codigo_asignacion FROM \`${T.asignacion}\` WHERE id = ?`,
      [asignacionId]
    );

    codigo = codigo || actual?.codigo_asignacion || (await nextCode(connection, T.asignacion, "codigo_asignacion", "ASG"));

    await connection.query(
      `
      UPDATE \`${T.asignacion}\`
      SET codigo_asignacion = ?,
          cliente_id = ?,
          ruta_id = ?,
          vehiculo_id = ?,
          piloto_id = ?,
          proveedor_id = ?,
          fecha_carga = ?,
          fecha_descarga = ?,
          estado_asignacion_id = ?
      WHERE id = ?
      `,
      [
        codigo,
        clienteId,
        rutaId,
        vehiculoId,
        pilotoId,
        proveedorId,
        fechaCarga,
        fechaDescarga,
        estadoId,
        asignacionId,
      ]
    );
  } else {
    codigo = codigo || (await nextCode(connection, T.asignacion, "codigo_asignacion", "ASG"));

    const [insert] = await connection.query(
      `
      INSERT INTO \`${T.asignacion}\`
      (codigo_asignacion, cliente_id, ruta_id, vehiculo_id, piloto_id, proveedor_id, fecha_carga, fecha_descarga, estado_asignacion_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        codigo,
        clienteId,
        rutaId,
        vehiculoId,
        pilotoId,
        proveedorId,
        fechaCarga,
        fechaDescarga,
        estadoId,
      ]
    );

    asignacionId = insert.insertId;
  }

  await upsertByAsignacion(connection, T.costoAsignacion, asignacionId, {
    asignacion_id: asignacionId,
    flete: asMoney(body.flete),
    parada_adicional: asMoney(body.paradaAdicional || body.parada_adicional),
    movimiento_falso: asMoney(body.movFalso || body.movimiento_falso),
    estadia: asMoney(body.estadia),
    viaje_doble: asMoney(body.viajeDoble || body.viaje_doble),
    otros: asMoney(body.otros),
    total:
      asMoney(body.total) ||
      asMoney(body.flete) +
        asMoney(body.paradaAdicional || body.parada_adicional) +
        asMoney(body.movFalso || body.movimiento_falso) +
        asMoney(body.estadia) +
        asMoney(body.viajeDoble || body.viaje_doble) +
        asMoney(body.otros),
  });

  const vendedorId = await resolveUsuario(connection, body.vendedor || body.vendedor_id);
  const licencia =
    limpiar(body.licencia) ||
    (
      await connection.query(`SELECT licencia FROM \`${T.piloto}\` WHERE id = ? LIMIT 1`, [pilotoId])
    )[0]?.[0]?.licencia ||
    null;

  const cabezal =
    limpiar(body.cabezal) ||
    (
      await connection.query(`SELECT codigo FROM \`${T.vehiculo}\` WHERE id = ? LIMIT 1`, [vehiculoId])
    )[0]?.[0]?.codigo ||
    null;

  await upsertByAsignacion(connection, T.unidadOperacion, asignacionId, {
    asignacion_id: asignacionId,
    licencia,
    cabezal,
    furgon: limpiar(body.furgon) || null,
    auxiliar_id: asId(body.auxiliar_id),
    km: asMoney(body.km),
    documentos: limpiar(body.doc || body.documentos) || "Pendiente",
    vendedor_id: vendedorId,
  });

  await upsertByAsignacion(connection, T.proveedorAsignacion, asignacionId, {
    asignacion_id: asignacionId,
    proveedor_id: proveedorId,
    fecha: asDate(body.fechaProveedor || body.fecha_proveedor) || fechaCarga,
    serie: limpiar(body.serieProveedor || body.serie_proveedor) || null,
    numero: limpiar(body.numeroProveedor || body.numero_proveedor) || null,
    flete: asMoney(body.fleteProveedor || body.flete_proveedor),
    cuadrilla: asMoney(body.cuadrilla),
    estadia: asMoney(body.estadiaProveedor || body.estadia_proveedor),
    total:
      asMoney(body.totalProveedor || body.total_proveedor) ||
      asMoney(body.fleteProveedor || body.flete_proveedor) +
        asMoney(body.cuadrilla) +
        asMoney(body.estadiaProveedor || body.estadia_proveedor),
    fecha_pago: asDate(body.fechaPagoProveedor || body.fecha_pago_proveedor),
  });

  await upsertByAsignacion(connection, T.facturaAsignacion, asignacionId, {
    asignacion_id: asignacionId,
    fecha: asDate(body.fechaFactura || body.fecha_factura),
    serie: limpiar(body.serieFactura || body.serie_factura) || null,
    numero: limpiar(body.numeroFactura || body.numero_factura) || null,
    valor: asMoney(body.valorFactura || body.valor_factura || body.total),
    fecha_pago: asDate(body.fechaPagoFactura || body.fecha_pago_factura),
  });

  return { id: asignacionId, codigo_asignacion: codigo };
};

const deleteAssignment = async (connection, id) => {
  await connection.query(`DELETE FROM \`${T.costoAsignacion}\` WHERE asignacion_id = ?`, [id]);
  await connection.query(`DELETE FROM \`${T.unidadOperacion}\` WHERE asignacion_id = ?`, [id]);
  await connection.query(`DELETE FROM \`${T.proveedorAsignacion}\` WHERE asignacion_id = ?`, [id]);
  await connection.query(`DELETE FROM \`${T.facturaAsignacion}\` WHERE asignacion_id = ?`, [id]);
  await connection.query(`DELETE FROM \`${T.pagoProveedor}\` WHERE asignacion_id = ?`, [id]).catch(() => {});
  await connection.query(`DELETE FROM viaje_asignaciones WHERE asignacion_id = ?`, [id]).catch(() => {});
  await connection.query(`DELETE FROM vehiculo_asignacion WHERE viaje_id IN (SELECT id FROM \`${T.viaje}\` WHERE codigo LIKE ?)`, [`%${id}%`]).catch(() => {});
  await connection.query(`DELETE FROM \`${T.asignacion}\` WHERE id = ?`, [id]);
};

const deleteProvider = async (connection, id) => {
  const [[rel]] = await connection.query(
    `SELECT COUNT(*) AS total FROM \`${T.asignacion}\` WHERE proveedor_id = ?`,
    [id]
  );

  if (Number(rel?.total || 0) > 0) {
    await connection.query(`UPDATE \`${T.proveedor}\` SET estado_id = 2 WHERE id = ?`, [id]);
    return { inactivado: true };
  }

  await connection.query(`DELETE FROM \`${T.contactoProveedor}\` WHERE proveedor_id = ?`, [id]).catch(() => {});
  await connection.query(`DELETE FROM \`${T.servicioProveedor}\` WHERE proveedor_id = ?`, [id]).catch(() => {});
  await connection.query(`DELETE FROM \`${T.cumplimientoProveedor}\` WHERE proveedor_id = ?`, [id]).catch(() => {});
  await connection.query(`DELETE FROM \`${T.desempenoProveedor}\` WHERE proveedor_id = ?`, [id]).catch(() => {});
  await connection.query(`DELETE FROM \`${T.proveedor}\` WHERE id = ?`, [id]);
  return { inactivado: false };
};

/* =====================================================
   SELECTS principales
===================================================== */

const queryAsignaciones = `
  SELECT
    a.id,
    a.codigo_asignacion,
    a.cliente_id,
    a.ruta_id,
    a.vehiculo_id,
    a.piloto_id,
    a.piloto_id AS pilotos_id,
    a.proveedor_id,
    a.fecha_carga,
    a.fecha_carga AS carga,
    a.fecha_descarga,
    a.fecha_descarga AS descarga,
    a.estado_asignacion_id,

    c.nombre_empresa AS cliente,
    c.nombre_empresa,
    c.codigo_cliente,

    r.nombre_ruta AS ruta,
    r.distancia_km,
    uo_r.nombre_ubicacion AS origen,
    ud_r.nombre_ubicacion AS destino,

    vh.codigo AS cabezal,
    tv.nombre_tipo_vehiculo AS tipo,

    ${fullNameSQL("p")} AS piloto,
    p.licencia AS licencia,

    uo.furgon,
    uo.auxiliar_id,
    uo.km,
    uo.documentos AS doc,
    uv.nombre_usuario AS vendedor,
    ${fullNameSQL("uv")} AS vendedor_nombre,

    ca.flete,
    ca.parada_adicional,
    ca.movimiento_falso,
    ca.estadia,
    ca.viaje_doble,
    ca.otros,
    ca.total,

    pr.nombre_comercial AS proveedor,
    pr.razon_social AS proveedor_razon_social,
    pr.codigo_proveedor,

    pa.fecha AS fechaProveedor,
    pa.serie AS serieProveedor,
    pa.numero AS numeroProveedor,
    pa.flete AS fleteProveedor,
    pa.cuadrilla,
    pa.estadia AS estadiaProveedor,
    pa.total AS totalProveedor,
    pa.fecha_pago AS fechaPagoProveedor,

    fa.fecha AS fechaFactura,
    fa.serie AS serieFactura,
    fa.numero AS numeroFactura,
    fa.valor AS valorFactura,
    fa.fecha_pago AS fechaPagoFactura,

    ea.nombre_estado_asignacion AS estado
  FROM \`${T.asignacion}\` a
  LEFT JOIN \`${T.cliente}\` c ON c.id = a.cliente_id
  LEFT JOIN \`${T.ruta}\` r ON r.id = a.ruta_id
  LEFT JOIN \`${T.ubicacion}\` uo_r ON uo_r.id = r.origen_id
  LEFT JOIN \`${T.ubicacion}\` ud_r ON ud_r.id = r.destino_id
  LEFT JOIN \`${T.vehiculo}\` vh ON vh.id = a.vehiculo_id
  LEFT JOIN \`${T.tipoVehiculo}\` tv ON tv.id = vh.tipo_id
  LEFT JOIN \`${T.piloto}\` p ON p.id = a.piloto_id
  LEFT JOIN \`${T.proveedor}\` pr ON pr.id = a.proveedor_id
  LEFT JOIN \`${T.estadoAsignacion}\` ea ON ea.id = a.estado_asignacion_id
  LEFT JOIN \`${T.costoAsignacion}\` ca ON ca.asignacion_id = a.id
  LEFT JOIN \`${T.unidadOperacion}\` uo ON uo.asignacion_id = a.id
  LEFT JOIN \`${T.usuario}\` uv ON uv.id = uo.vendedor_id
  LEFT JOIN \`${T.proveedorAsignacion}\` pa ON pa.asignacion_id = a.id
  LEFT JOIN \`${T.facturaAsignacion}\` fa ON fa.asignacion_id = a.id
`;

const queryProveedores = `
  SELECT
    p.id,
    p.codigo_proveedor,
    p.razon_social,
    p.nombre_comercial,
    p.nit,
    p.estado_id,
    p.correo,
    p.telefono,

    COALESCE(p.nombre_comercial, p.razon_social) AS name,
    p.razon_social AS nombre_proveedor,
    p.razon_social AS nombre_empresa,

    COALESCE(sp.nombre_servicio_proveedor, 'Transporte') AS service,
    COALESCE(sp.nombre_servicio_proveedor, 'Transporte') AS servicio,
    COALESCE(sp.nombre_servicio_proveedor, 'Transporte') AS tipo_servicio,

    TRIM(CONCAT(
      COALESCE(p.correo, ''),
      CASE WHEN p.correo IS NOT NULL AND p.correo <> '' AND p.telefono IS NOT NULL AND p.telefono <> '' THEN ' / ' ELSE '' END,
      COALESCE(p.telefono, '')
    )) AS contact,
    TRIM(CONCAT(
      COALESCE(p.correo, ''),
      CASE WHEN p.correo IS NOT NULL AND p.correo <> '' AND p.telefono IS NOT NULL AND p.telefono <> '' THEN ' / ' ELSE '' END,
      COALESCE(p.telefono, '')
    )) AS contacto,

    CASE WHEN cp.rtu_validado = 1 THEN true ELSE false END AS rtuValidated,
    cp.rtu_validado,

    CASE
      WHEN cp.estado_sat = 'vigente' THEN 'Solvente'
      WHEN cp.estado_sat = 'no_vigente' THEN 'Omiso'
      ELSE 'Pendiente'
    END AS satStatus,
    cp.estado_sat,

    CASE WHEN cp.lista_clinton = 1 THEN 'Aprobado' ELSE 'Rechazado' END AS clintonInvestigation,
    CASE WHEN cp.licencia_validada = 1 THEN true ELSE false END AS pilotLicenseValidated,
    CASE WHEN cp.cuenta_validada = 1 THEN true ELSE false END AS bankAccountValidated,
    cp.licencia_validada,
    cp.cuenta_validada,

    COALESCE(dp.nivel, 'Amarillo') AS performance,
    COALESCE(dp.nivel, 'Amarillo') AS desempeno,
    COALESCE(dp.historial, '') AS history,
    COALESCE(dp.historial, '') AS historial,
    COALESCE(dp.hallazgos, '') AS findings,
    COALESCE(dp.hallazgos, '') AS hallazgos,

    COALESCE(ep.nombre_estado_proveedor, 'Activo') AS status,
    COALESCE(ep.nombre_estado_proveedor, 'Activo') AS estado,
    ep.nombre_estado_proveedor
  FROM \`${T.proveedor}\` p
  LEFT JOIN \`${T.estadoProveedor}\` ep ON ep.id = p.estado_id
  LEFT JOIN \`${T.servicioProveedor}\` sp
    ON sp.id = (
      SELECT x.id
      FROM \`${T.servicioProveedor}\` x
      WHERE x.proveedor_id = p.id
      ORDER BY x.es_principal DESC, x.id ASC
      LIMIT 1
    )
  LEFT JOIN \`${T.cumplimientoProveedor}\` cp ON cp.proveedor_id = p.id
  LEFT JOIN \`${T.desempenoProveedor}\` dp
    ON dp.id = (
      SELECT x.id
      FROM \`${T.desempenoProveedor}\` x
      WHERE x.proveedor_id = p.id
      ORDER BY x.fecha DESC, x.id DESC
      LIMIT 1
    )
`;

const queryRutas = `
  SELECT
    r.*,
    uo.nombre_ubicacion AS origen,
    ud.nombre_ubicacion AS destino,
    CONCAT(uo.nombre_ubicacion, ' - ', ud.nombre_ubicacion) AS nombre
  FROM \`${T.ruta}\` r
  LEFT JOIN \`${T.ubicacion}\` uo ON uo.id = r.origen_id
  LEFT JOIN \`${T.ubicacion}\` ud ON ud.id = r.destino_id
`;

const queryVehiculos = `
  SELECT
    v.*,
    v.codigo AS placa,
    tv.nombre_tipo_vehiculo AS tipo,
    tv.nombre_tipo_vehiculo AS tipo_vehiculo,
    tv.nombre_tipo_vehiculo
  FROM \`${T.vehiculo}\` v
  LEFT JOIN \`${T.tipoVehiculo}\` tv ON tv.id = v.tipo_id
`;

const queryPilotos = `
  SELECT
    p.*,
    ${fullNameSQL("p")} AS nombre_piloto,
    ${fullNameSQL("p")} AS nombre,
    p.licencia AS numero_licencia
  FROM \`${T.piloto}\` p
`;

router.get("/operaciones/bootstrap", async (req, res) => {
  try {
    const [asignaciones] = await pool.query(`${queryAsignaciones} ORDER BY a.id DESC`);
    const [proveedores] = await pool.query(`${queryProveedores} ORDER BY p.id DESC`);
    const [envios] = await pool.query(`
      SELECT e.*, c.nombre_empresa, ee.nombre_estado_envio
      FROM \`${T.envio}\` e
      LEFT JOIN \`${T.cliente}\` c ON c.id = e.cliente_id
      LEFT JOIN estado_envio ee ON ee.id = e.estado_id
      ORDER BY e.id DESC
    `);
    const [viajes] = await pool.query(`
      SELECT v.*
      FROM \`${T.viaje}\` v
      ORDER BY v.id DESC
    `);
    const [rutas] = await pool.query(`${queryRutas} ORDER BY r.id DESC`);
    const [ubicaciones] = await pool.query(`SELECT * FROM \`${T.ubicacion}\` ORDER BY id DESC`);
    const [unidades] = await pool.query(`SELECT * FROM \`${T.unidad}\` ORDER BY id DESC`);
    const [vehiculos] = await pool.query(`${queryVehiculos} ORDER BY v.id DESC`);
    const [pilotos] = await pool.query(`${queryPilotos} ORDER BY p.id DESC`);
    const [costosAsignacion] = await pool.query(`SELECT * FROM \`${T.costoAsignacion}\` ORDER BY id DESC`);
    const [facturaAsignacion] = await pool.query(`SELECT * FROM \`${T.facturaAsignacion}\` ORDER BY id DESC`);
    const [pagosProveedor] = await pool.query(`SELECT * FROM \`${T.pagoProveedor}\` ORDER BY id DESC`);

    return ok(res, {
      asignaciones,
      proveedores,
      envios,
      viajes,
      rutas,
      ubicaciones,
      unidades,
      vehiculos,
      pilotos,
      costosAsignacion,
      facturaAsignacion,
      pagosProveedor,
    });
  } catch (error) {
    console.error("Error en /operaciones/bootstrap:", error);
    return fail(res, 500, "No se pudo cargar Operaciones.", error);
  }
});

router.get("/operaciones/asignaciones", async (req, res) => {
  try {
    const [rows] = await pool.query(`${queryAsignaciones} ORDER BY a.id DESC`);
    return ok(res, rows);
  } catch (error) {
    console.error("Error asignaciones:", error);
    return fail(res, 500, "No se pudieron obtener las asignaciones.", error);
  }
});

router.post("/operaciones/asignaciones", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await saveAssignment(connection, req.body);
    await connection.commit();
    return ok(res, result, "Asignación guardada correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error al guardar asignación:", error);
    return fail(res, 500, "No se pudo guardar la asignación.", error);
  } finally {
    connection.release();
  }
});

router.put("/operaciones/asignaciones/:id", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await saveAssignment(connection, req.body, req.params.id);
    await connection.commit();
    return ok(res, result, "Asignación actualizada correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error al actualizar asignación:", error);
    return fail(res, 500, "No se pudo actualizar la asignación.", error);
  } finally {
    connection.release();
  }
});

router.patch("/operaciones/asignaciones/:id", async (req, res) => {
  req.method = "PUT";
  return router.handle(req, res);
});

router.delete("/operaciones/asignaciones/:id", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const id = asId(req.params.id);

    if (!id) {
      await connection.rollback();
      return fail(res, 400, "ID de asignación inválido.");
    }

    await deleteAssignment(connection, id);
    await connection.commit();

    return ok(res, { id }, "Asignación eliminada correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error al eliminar asignación:", error);
    return fail(res, 500, "No se pudo eliminar la asignación.", error);
  } finally {
    connection.release();
  }
});

router.get("/operaciones/proveedores", async (req, res) => {
  try {
    const [rows] = await pool.query(`${queryProveedores} ORDER BY p.id DESC`);
    return ok(res, rows);
  } catch (error) {
    console.error("Error proveedores:", error);
    return fail(res, 500, "No se pudieron obtener los proveedores.", error);
  }
});

router.post("/operaciones/proveedores", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const id = await saveProvider(connection, req.body);
    await connection.commit();
    return ok(res, { id }, "Proveedor guardado correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error al guardar proveedor:", error);
    return fail(res, 500, "No se pudo guardar el proveedor.", error);
  } finally {
    connection.release();
  }
});

router.put("/operaciones/proveedores/:id", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const id = await saveProvider(connection, req.body, req.params.id);
    await connection.commit();
    return ok(res, { id }, "Proveedor actualizado correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error al actualizar proveedor:", error);
    return fail(res, 500, "No se pudo actualizar el proveedor.", error);
  } finally {
    connection.release();
  }
});

router.delete("/operaciones/proveedores/:id", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const id = asId(req.params.id);
    if (!id) {
      await connection.rollback();
      return fail(res, 400, "ID de proveedor inválido.");
    }

    const result = await deleteProvider(connection, id);
    await connection.commit();

    return ok(
      res,
      { id, ...result },
      result.inactivado
        ? "El proveedor tiene asignaciones, por eso se marcó como Inactivo."
        : "Proveedor eliminado correctamente."
    );
  } catch (error) {
    await connection.rollback();
    console.error("Error al eliminar proveedor:", error);
    return fail(res, 500, "No se pudo eliminar el proveedor.", error);
  } finally {
    connection.release();
  }
});

/* =====================================================
   Compatibilidad con rutas usadas por el frontend actual
===================================================== */

router.get("/logistica/envios", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT e.*, c.nombre_empresa, ee.nombre_estado_envio
      FROM \`${T.envio}\` e
      LEFT JOIN \`${T.cliente}\` c ON c.id = e.cliente_id
      LEFT JOIN estado_envio ee ON ee.id = e.estado_id
      ORDER BY e.id DESC
    `);
    return ok(res, rows);
  } catch (error) {
    console.error("Error envíos:", error);
    return fail(res, 500, "No se pudieron obtener los envíos.", error);
  }
});

router.get("/logistica/viajes", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT v.*
      FROM \`${T.viaje}\` v
      ORDER BY v.id DESC
    `);
    return ok(res, rows);
  } catch (error) {
    console.error("Error viajes:", error);
    return fail(res, 500, "No se pudieron obtener los viajes.", error);
  }
});

router.get("/logistica/rutas", async (req, res) => {
  try {
    const [rows] = await pool.query(`${queryRutas} ORDER BY r.id DESC`);
    return ok(res, rows);
  } catch (error) {
    console.error("Error rutas:", error);
    return fail(res, 500, "No se pudieron obtener las rutas.", error);
  }
});

router.get("/mantenimiento/tablas/:tabla/columnas", async (req, res) => {
  try {
    const key = String(req.params.tabla || "").trim();
    const tabla = tableName(key);

    if (!(await tableExists(tabla))) {
      return fail(res, 404, `No existe la tabla ${tabla}.`);
    }

    const actual = await getColumns(tabla);
    const extras = EXTRA_COLUMNS[key] || EXTRA_COLUMNS[tabla] || [];
    const all = [...new Set([...actual, ...extras])];

    return ok(res, {
      tabla,
      columnas: all.map((nombre) => ({ nombre, COLUMN_NAME: nombre, name: nombre })),
    });
  } catch (error) {
    console.error("Error columnas mantenimiento:", error);
    return fail(res, 500, "No se pudieron obtener las columnas.", error);
  }
});

router.get("/mantenimiento/tablas/:tabla/registros", async (req, res) => {
  try {
    const key = String(req.params.tabla || "").trim();
    const tabla = tableName(key);
    const limit = Math.min(Number(req.query.limit || 300) || 300, 1000);

    if (!(await tableExists(tabla))) {
      return fail(res, 404, `No existe la tabla ${tabla}.`);
    }

    let sql = `SELECT * FROM \`${tabla}\` ORDER BY id DESC LIMIT ?`;

    if (tabla === T.ruta) sql = `${queryRutas} ORDER BY r.id DESC LIMIT ?`;
    if (tabla === T.vehiculo) sql = `${queryVehiculos} ORDER BY v.id DESC LIMIT ?`;
    if (tabla === T.piloto) sql = `${queryPilotos} ORDER BY p.id DESC LIMIT ?`;
    if (tabla === T.proveedor) sql = `${queryProveedores} ORDER BY p.id DESC LIMIT ?`;

    const [rows] = await pool.query(sql, [limit]);
    return ok(res, rows);
  } catch (error) {
    console.error("Error registros mantenimiento:", error);
    return fail(res, 500, "No se pudieron obtener los registros.", error);
  }
});

router.post("/mantenimiento/tablas/:tabla/registros", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const key = String(req.params.tabla || "").trim();
    const tabla = tableName(key);

    let id;

    if (tabla === T.asignacion) {
      const saved = await saveAssignment(connection, req.body);
      id = saved.id;
    } else if (tabla === T.proveedor) {
      id = await saveProvider(connection, req.body);
    } else {
      const payload = mapPayloadForTable(key, req.body);
      id = await insertGeneric(connection, tabla, payload);
    }

    await connection.commit();

    return ok(res, { id }, "Registro guardado correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error guardar mantenimiento:", error);
    return fail(res, 500, "No se pudo guardar el registro.", error);
  } finally {
    connection.release();
  }
});

const updateMaintenanceRecord = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const key = String(req.params.tabla || "").trim();
    const tabla = tableName(key);
    const id = asId(req.params.id);

    if (!id) {
      await connection.rollback();
      return fail(res, 400, "ID inválido.");
    }

    if (tabla === T.asignacion) {
      await saveAssignment(connection, req.body, id);
    } else if (tabla === T.proveedor) {
      await saveProvider(connection, req.body, id);
    } else {
      const payload = mapPayloadForTable(key, req.body);
      await updateGeneric(connection, tabla, id, payload);
    }

    await connection.commit();

    return ok(
      res,
      { id },
      "Registro actualizado correctamente."
    );
  } catch (error) {
    await connection.rollback();

    console.error(
      "Error actualizar mantenimiento:",
      error
    );

    return fail(
      res,
      500,
      "No se pudo actualizar el registro.",
      error
    );
  } finally {
    connection.release();
  }
};

router.put(
  "/mantenimiento/tablas/:tabla/registros/:id",
  updateMaintenanceRecord
);

router.patch(
  "/mantenimiento/tablas/:tabla/registros/:id",
  updateMaintenanceRecord
);

router.delete("/mantenimiento/tablas/:tabla/registros/:id", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const key = String(req.params.tabla || "").trim();
    const tabla = tableName(key);
    const id = asId(req.params.id);

    if (!id) {
      await connection.rollback();
      return fail(res, 400, "ID inválido.");
    }

    if (tabla === T.asignacion) {
      await deleteAssignment(connection, id);
    } else if (tabla === T.proveedor) {
      await deleteProvider(connection, id);
    } else {
      await connection.query(`DELETE FROM \`${tabla}\` WHERE id = ?`, [id]);
    }

    await connection.commit();

    return ok(res, { id }, "Registro eliminado correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error eliminar mantenimiento:", error);
    return fail(res, 500, "No se pudo eliminar el registro.", error);
  } finally {
    connection.release();
  }
});

module.exports = router;