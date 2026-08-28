const express = require("express");
const pool = require("../config/db");
const bcrypt = require("bcryptjs");

const router = express.Router();

const VALID_NAME = /^[a-zA-Z0-9_]+$/;
const MAX_LIMIT = 5000;

const q = (value) => `\`${String(value).replace(/`/g, "``")}\``;
const isValidName = (value) => VALID_NAME.test(String(value || ""));

const READ_ONLY_MAINTENANCE_TABLES = new Set(["auditoria"]);

const TABLE_META = {

  estado_cliente: { title: "Estados de cliente", category: "Catálogos", color: "blue", description: "Estados administrativos para clientes." },
  estados_cliente: { title: "Estados de cliente", category: "Catálogos", color: "blue", description: "Estados administrativos para clientes." },
  rol: { title: "Roles", category: "Seguridad", color: "indigo", description: "Roles de acceso del sistema.", adminOnly: true },
  roles: { title: "Roles", category: "Seguridad", color: "indigo", description: "Roles de acceso del sistema.", adminOnly: true },
  usuarios: { title: "Usuarios", category: "Seguridad", color: "indigo", description: "Control de usuarios activos, de baja, roles y accesos.", adminOnly: true },
  solicitudes_credenciales: { title: "Solicitudes de credenciales", category: "Seguridad", color: "indigo", description: "Solicitudes de cambio o recuperación de contraseña.", adminOnly: true },
  alerta: { title: "Alertas", category: "Logística", color: "red", description: "Alertas e incidencias relacionadas con los viajes." },
  asignacion: { title: "Asignaciones", category: "Operaciones", color: "orange", description: "Asignaciones de cliente, ruta, vehículo, piloto y proveedor." },
  auditoria: { title: "Auditoría", category: "Seguridad", color: "indigo", description: "Bitácora de acciones realizadas por usuarios." },
  cliente: { title: "Clientes", category: "CRM y ventas", color: "purple", description: "Empresas clientes registradas en el sistema." },
  contacto_cliente: { title: "Contactos de cliente", category: "CRM y ventas", color: "purple", description: "Personas de contacto asociadas a clientes." },
  telefono_contacto: { title: "Teléfonos de contacto", category: "CRM y ventas", color: "purple", description: "Teléfonos asociados a contactos de cliente." },
  prefijo_telefonico: { title: "Prefijos telefónicos", category: "Catálogos", color: "blue", description: "Catálogo de prefijos por país para teléfonos." },
  cotizacion: { title: "Cotizaciones", category: "CRM y ventas", color: "purple", description: "Cabecera de cotizaciones comerciales." },
  cotizacion_detalle: { title: "Detalle de cotización", category: "CRM y ventas", color: "purple", description: "Servicios y precios dentro de cotizaciones." },
  oportunidad: { title: "Oportunidades", category: "CRM y ventas", color: "purple", description: "Pipeline de oportunidades comerciales." },
  estado_oportunidad: { title: "Estados de oportunidad", category: "Catálogos", color: "blue", description: "Etapas del pipeline comercial." },
  modalidade: { title: "Modalidades", category: "Catálogos", color: "blue", description: "Modalidades logísticas disponibles." },
  forma_pago: { title: "Formas de pago", category: "Catálogos", color: "blue", description: "Condiciones y métodos de pago." },
  ubicacion: { title: "Ubicaciones", category: "Rutas y ubicaciones", color: "green", description: "Ciudades, puntos y ubicaciones usadas como origen o destino." },
  ruta: { title: "Rutas", category: "Rutas y ubicaciones", color: "green", description: "Rutas operativas con distancia, tiempo, costo y estado." },
  ruta_historial: { title: "Historial de ruta", category: "Rutas y ubicaciones", color: "green", description: "Historial de costos por ruta." },
  estado_ruta: { title: "Estados de ruta", category: "Catálogos", color: "blue", description: "Estados para rutas." },
  frecuencia_ruta: { title: "Frecuencias de ruta", category: "Catálogos", color: "blue", description: "Frecuencias configuradas para rutas." },
  envio: { title: "Envíos", category: "Logística", color: "green", description: "Envíos registrados y sus estados." },
  viaje: { title: "Viajes", category: "Logística", color: "green", description: "Viajes relacionados con cliente, ruta, unidad y piloto." },
  tracking_viaje: { title: "Tracking de viaje", category: "Logística", color: "green", description: "Puntos de seguimiento y avance del viaje." },
  estado_envio: { title: "Estados de envío", category: "Catálogos", color: "blue", description: "Flujo operativo del envío." },
  piloto: { title: "Pilotos", category: "Flota", color: "orange", description: "Pilotos y licencias registradas." },
  unidad: { title: "Unidades", category: "Flota", color: "orange", description: "Unidades utilizadas en viajes." },
  vehiculo: { title: "Vehículos", category: "Flota", color: "orange", description: "Flota vehicular con estado, eficiencia y kilometraje." },
  vehiculo_asignacion: { title: "Vehículo por viaje", category: "Flota", color: "orange", description: "Relación de vehículos asignados a viajes." },
  tipo_vehiculo: { title: "Tipos de vehículo", category: "Catálogos", color: "blue", description: "Catálogo de tipos de vehículos." },
  estado_vehiculo: { title: "Estados de vehículo", category: "Catálogos", color: "blue", description: "Estados operativos de la flota." },
  estado_mantenimiento: { title: "Estados de mantenimiento", category: "Catálogos", color: "blue", description: "Estados usados en mantenimiento vehicular." },
  mantenimiento: { title: "Mantenimientos", category: "Flota", color: "orange", description: "Historial y programación de mantenimientos." },
  proveedor: { title: "Proveedores", category: "Proveedores", color: "orange", description: "Empresas proveedoras registradas." },
  contacto_proveedor: { title: "Contactos de proveedor", category: "Proveedores", color: "orange", description: "Contactos asociados a proveedores." },
  servicio_proveedor: { title: "Servicios de proveedor", category: "Proveedores", color: "orange", description: "Servicios ofrecidos por proveedores." },
  cumplimiento_proveedor: { title: "Cumplimiento proveedor", category: "Proveedores", color: "orange", description: "Validación SAT, RTU, licencias y cuenta bancaria." },
  desempeno_proveedor: { title: "Desempeño proveedor", category: "Proveedores", color: "orange", description: "Evaluación verde, amarillo o rojo del proveedor." },
  estado_proveedor: { title: "Estados de proveedor", category: "Catálogos", color: "blue", description: "Estados administrativos para proveedores." },
  proveedor_asignacion: { title: "Proveedor por asignación", category: "Operaciones", color: "orange", description: "Costo/documento de proveedor ligado a una asignación." },
  pago_proveedor: { title: "Pagos a proveedor", category: "Operaciones", color: "orange", description: "Documentos y pagos realizados a proveedores." },
  asignacion: { title: "Asignaciones", category: "Operaciones", color: "orange", description: "Asignaciones operativas registradas." },
  estado_asignacion: { title: "Estados de asignación", category: "Catálogos", color: "blue", description: "Estados del proceso de asignación." },
  costo_asignacion: { title: "Costos de asignación", category: "Operaciones", color: "orange", description: "Desglose de costos por asignación." },
  viaje_asignaciones: { title: "Datos de viaje por asignación", category: "Operaciones", color: "orange", description: "Carga, descarga, marchamo y tipo de carga." },
  unidad_operacion: { title: "Unidades de operación", category: "Operaciones", color: "orange", description: "Cabezal, furgón, auxiliar, kilómetros y documentos." },
  factura_asignacion: { title: "Factura por asignación", category: "Operaciones", color: "orange", description: "Facturación al cliente asociada a asignaciones." },
  comprobante: { title: "Comprobantes", category: "Facturación", color: "green", description: "Comprobantes emitidos a clientes." },
  detalle_comprobante: { title: "Detalle de comprobante", category: "Facturación", color: "green", description: "Líneas de servicio de los comprobantes." },
  pago: { title: "Pagos", category: "Facturación", color: "green", description: "Pagos recibidos de clientes." },
  estado_factura: { title: "Estados de comprobante", category: "Catálogos", color: "blue", description: "Estados de facturación y cobranza." },
  deposito: { title: "Depósitos", category: "Bodega", color: "indigo", description: "Depósitos y bodegas disponibles." },
  tipo_deposito: { title: "Tipos de depósito", category: "Catálogos", color: "blue", description: "Tipos de depósito o bodega." },
  usuario: { title: "Usuarios", category: "Seguridad", color: "indigo", description: "Usuarios con acceso al sistema.", adminOnly: true },
  role: { title: "Roles", category: "Seguridad", color: "indigo", description: "Roles de acceso del sistema.", adminOnly: true },
  solicitud_credencial: { title: "Solicitudes de credenciales", category: "Seguridad", color: "indigo", description: "Solicitudes de cambio o recuperación de contraseña.", adminOnly: true },
};

const CATEGORY_ORDER = [
  "Catálogos",
  "CRM y ventas",
  "Operaciones",
  "Logística",
  "Flota",
  "Proveedores",
  "Facturación",
  "Rutas y ubicaciones",
  "Bodega",
  "Seguridad",
  "Otros",
];

const PREFERRED_ORDER = [
  "estado_cliente", "estados_cliente", "estado_envio", "estados_envio", "estado_factura", "estados_factura", "estado_mantenimiento", "estados_mantenimiento", "estado_proveedor", "estados_proveedor", "estado_ruta", "estados_ruta", "estado_vehiculo", "estados_vehiculo", "estado_oportunidad", "estados_oportunidad", "estado_asignacion", "estados_asignacion", "forma_pago", "formas_pago", "frecuencia_ruta", "frecuencias_ruta", "modalidade", "modalidades", "tipo_deposito", "tipos_deposito", "tipo_vehiculo", "tipos_vehiculo", "prefijo_telefonico",
  "cliente", "contacto_cliente", "telefono_contacto", "oportunidad", "cotizacion", "cotizacion_detalle",
  "asignacion", "costo_asignacion", "viaje_asignaciones", "unidad_operacion", "proveedor_asignacion", "factura_asignacion", "pago_proveedor",
  "envio", "viaje", "tracking_viaje", "alerta",
  "piloto", "unidad", "vehiculo", "vehiculo_asignacion", "mantenimiento",
  "proveedor", "contacto_proveedor", "servicio_proveedor", "cumplimiento_proveedor", "desempeno_proveedor",
  "comprobante", "detalle_comprobante", "pago",
  "ubicacion", "ruta", "ruta_historial",
  "deposito", "depositos", "usuario", "usuarios", "rol", "role", "roles", "solicitud_credencial", "solicitudes_credenciales", "auditoria",
];

function humanizeName(name) {
  return String(name || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function getDbName() {
  if (process.env.DB_NAME) return process.env.DB_NAME;
  const [rows] = await pool.query("SELECT DATABASE() AS db");
  return rows[0]?.db;
}

function parseEnum(columnType) {
  const raw = String(columnType || "");
  if (!raw.toLowerCase().startsWith("enum(")) return [];
  const inside = raw.slice(5, -1);
  const result = [];
  let current = "";
  let inQuote = false;
  for (let i = 0; i < inside.length; i += 1) {
    const ch = inside[i];
    if (ch === "'" && inside[i - 1] !== "\\") {
      inQuote = !inQuote;
      continue;
    }
    if (ch === "," && !inQuote) {
      result.push(current.replace(/\\'/g, "'").trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current) result.push(current.replace(/\\'/g, "'").trim());
  return result.filter(Boolean);
}

async function getTables() {
  const dbName = await getDbName();
  const [rows] = await pool.query(
    `
    SELECT TABLE_NAME AS name
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = ?
      AND TABLE_TYPE = 'BASE TABLE'
    `,
    [dbName]
  );
  const order = new Map(PREFERRED_ORDER.map((name, index) => [name, index]));
  return rows
    .map((row) => row.name)
    .filter(Boolean)
    .sort((a, b) => {
      const oa = order.has(a) ? order.get(a) : 999;
      const ob = order.has(b) ? order.get(b) : 999;
      if (oa !== ob) return oa - ob;
      return a.localeCompare(b);
    });
}

async function assertTable(table) {
  if (!isValidName(table)) {
    const err = new Error("Nombre de tabla inválido.");
    err.status = 400;
    throw err;
  }
  const tables = await getTables();
  if (!tables.includes(table)) {
    const err = new Error(`La tabla ${table} no existe en la base de datos.`);
    err.status = 404;
    throw err;
  }
}

async function getColumns(table) {
  await assertTable(table);
  const dbName = await getDbName();
  const [rows] = await pool.query(
    `
    SELECT
      COLUMN_NAME AS name,
      DATA_TYPE AS type,
      COLUMN_TYPE AS columnType,
      IS_NULLABLE AS nullable,
      COLUMN_KEY AS columnKey,
      COLUMN_DEFAULT AS defaultValue,
      EXTRA AS extra,
      CHARACTER_MAXIMUM_LENGTH AS maxLength,
      NUMERIC_PRECISION AS numericPrecision,
      NUMERIC_SCALE AS numericScale,
      DATETIME_PRECISION AS datetimePrecision,
      ORDINAL_POSITION AS ordinalPosition
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = ?
    ORDER BY ORDINAL_POSITION
    `,
    [dbName, table]
  );

  const foreignKeys = await getForeignKeys(table);
  const fkByColumn = new Map(foreignKeys.map((fk) => [fk.column, fk]));

  return rows.map((row) => ({
    ...row,
    nullable: row.nullable === "YES",
    required: row.nullable === "NO" && !String(row.extra || "").toLowerCase().includes("auto_increment") && row.defaultValue === null,
    auto: String(row.extra || "").toLowerCase().includes("auto_increment"),
    readonly:
      String(row.extra || "").toLowerCase().includes("auto_increment") ||
      ["created_at", "updated_at"].includes(row.name) ||
      (String(row.type || "").includes("timestamp") && String(row.defaultValue || "").toUpperCase().includes("CURRENT_TIMESTAMP")),
    enumOptions: parseEnum(row.columnType),
    ref: fkByColumn.get(row.name) || null,
  }));
}

async function getPrimaryKey(table) {
  const columns = await getColumns(table);
  return columns.find((column) => column.columnKey === "PRI")?.name || "id";
}

async function getForeignKeys(table) {
  const dbName = await getDbName();
  const [rows] = await pool.query(
    `
    SELECT
      kcu.COLUMN_NAME AS columnName,
      kcu.REFERENCED_TABLE_NAME AS referencedTable,
      kcu.REFERENCED_COLUMN_NAME AS referencedColumn,
      kcu.CONSTRAINT_NAME AS constraintName
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
    WHERE kcu.TABLE_SCHEMA = ?
      AND kcu.TABLE_NAME = ?
      AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
    ORDER BY kcu.ORDINAL_POSITION
    `,
    [dbName, table]
  );

  return rows.map((row) => ({
    column: row.columnName,
    referencedTable: row.referencedTable,
    referencedColumn: row.referencedColumn,
    constraintName: row.constraintName,
  }));
}

async function getUniqueIndexes(table) {
  const dbName = await getDbName();
  const [rows] = await pool.query(
    `
    SELECT INDEX_NAME AS indexName, COLUMN_NAME AS columnName, SEQ_IN_INDEX AS seq
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = ?
      AND NON_UNIQUE = 0
      AND INDEX_NAME <> 'PRIMARY'
    ORDER BY INDEX_NAME, SEQ_IN_INDEX
    `,
    [dbName, table]
  );
  const groups = new Map();
  rows.forEach((row) => {
    if (!groups.has(row.indexName)) groups.set(row.indexName, []);
    groups.get(row.indexName).push(row.columnName);
  });
  return Array.from(groups, ([name, columns]) => ({ name, columns }));
}

function cleanLimit(value, fallback = 1000) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

function cleanOffset(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function normalizeDateLike(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString().slice(0, 19).replace("T", " ");
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return `${raw.replace("T", " ")}:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(raw)) return raw.replace("T", " ");
  return raw;
}

function normalizeValue(value, column) {
  if (value === undefined) return undefined;
  if (value === "") return null;
  if (value === null) return null;

  const type = String(column.type || "").toLowerCase();
  const name = String(column.name || "").toLowerCase();

  if (["int", "bigint", "smallint", "mediumint", "tinyint"].includes(type)) {
    if (type === "tinyint" && (value === true || value === false)) return value ? 1 : 0;
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }

  if (["decimal", "double", "float"].includes(type)) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  if (["date", "datetime", "timestamp"].includes(type) || name.endsWith("_at")) {
    return normalizeDateLike(value);
  }

  return value;
}

function buildPayload(body, columns, { partial = false } = {}) {
  const payload = {};

  columns.forEach((column) => {
    if (column.readonly || column.auto || column.columnKey === "PRI") return;
    if (!Object.prototype.hasOwnProperty.call(body, column.name)) return;

    const value = normalizeValue(body[column.name], column);
    if (value === undefined) return;

    payload[column.name] = value;
  });

  if (!partial) {
    columns.forEach((column) => {
      if (column.readonly || column.auto || column.columnKey === "PRI") return;
      if (!column.required) return;
      if (!Object.prototype.hasOwnProperty.call(payload, column.name) || payload[column.name] === null) {
        const err = new Error(`El campo ${column.name} es obligatorio.`);
        err.status = 400;
        throw err;
      }
    });
  }

  return payload;
}

async function protectPasswordPayload(table, payload) {
  const tableName = String(table || "").toLowerCase();
  const passwordColumns = ["password_hash", "nueva_password_hash"];

  for (const column of passwordColumns) {
    if (!Object.prototype.hasOwnProperty.call(payload, column)) continue;
    const value = payload[column];

    if (value === null || value === undefined || String(value).trim() === "") {
      delete payload[column];
      continue;
    }

    const text = String(value);
    const alreadyHashed = /^\$2[aby]\$\d{2}\$/.test(text);
    if (!alreadyHashed && ["usuario", "usuarios", "solicitud_credencial", "solicitudes_credenciales"].includes(tableName)) {
      payload[column] = await bcrypt.hash(text, 10);
    }
  }

  return payload;
}

function getHeader(req, names) {
  for (const name of names) {
    const value = req.headers[String(name).toLowerCase()];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function mysqlNow() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function valueForDateColumn(column) {
  const now = mysqlNow();
  return String(column.type || "").toLowerCase() === "date" ? now.slice(0, 10) : now;
}

function trimToColumn(value, column) {
  const text = String(value ?? "");
  const max = Number(column.maxLength || 0);
  if (max > 0 && text.length > max) return text.slice(0, max);
  return text;
}

function findColumn(columns, names) {
  const lowered = names.map((name) => String(name).toLowerCase());
  return columns.find((column) => lowered.includes(String(column.name).toLowerCase()));
}

function putAuditValue(payload, columns, names, value) {
  const column = findColumn(columns, names);
  if (!column || column.auto) return;
  if (column.columnKey === "PRI") return;
  if (value === undefined || value === null || String(value).trim() === "") return;

  const type = String(column.type || "").toLowerCase();
  if (["int", "bigint", "smallint", "mediumint", "tinyint"].includes(type)) {
    const n = Number(value);
    if (Number.isFinite(n)) payload[column.name] = Math.trunc(n);
    return;
  }

  if (["decimal", "double", "float"].includes(type)) {
    const n = Number(value);
    if (Number.isFinite(n)) payload[column.name] = n;
    return;
  }

  if (["date", "datetime", "timestamp"].includes(type) || String(column.name).toLowerCase().includes("fecha")) {
    payload[column.name] = valueForDateColumn(column);
    return;
  }

  payload[column.name] = trimToColumn(value, column);
}

function requiredFallback(column) {
  const type = String(column.type || "").toLowerCase();
  if (["date", "datetime", "timestamp"].includes(type) || String(column.name).toLowerCase().includes("fecha")) {
    return valueForDateColumn(column);
  }
  if (["int", "bigint", "smallint", "mediumint", "tinyint"].includes(type)) return 0;
  if (["decimal", "double", "float"].includes(type)) return 0;
  return "-";
}

function getAuditUser(req) {
  const id = getHeader(req, ["x-gl365-user-id", "x-user-id", "x-usuario-id"]);
  const name = getHeader(req, ["x-gl365-user-name", "x-user-name", "x-usuario"]);
  const email = getHeader(req, ["x-gl365-user-email", "x-user-email", "x-email"]);
  const role = getHeader(req, ["x-gl365-user-role", "x-user-role", "x-rol"]);

  const display = email || name || "Usuario del sistema";
  return {
    id,
    name: name || display,
    email,
    role,
    display: role ? `${display} (${role})` : display,
  };
}

async function getRowLabelById(table, primaryKey, id) {
  try {
    const [rows] = await pool.query(`SELECT * FROM ${q(table)} WHERE ${q(primaryKey)} = ? LIMIT 1`, [id]);
    if (!rows.length) return `${humanizeName(table)} #${id}`;
    return rowLabel(table, rows[0]);
  } catch {
    return `${humanizeName(table)} #${id}`;
  }
}

async function logAutomaticAudit(req, { action, table, recordId, rowTitle, fields = [] }) {
  if (table === "auditoria") return;

  try {
    await assertTable("auditoria");
    const columns = await getColumns("auditoria");
    const payload = {};
    const user = getAuditUser(req);
    const meta = getMeta(table);
    const now = mysqlNow();

    const auditEvent =
      action === "crear"
        ? "CREAR"
        : action === "editar"
        ? "ACTUALIZAR"
        : action === "eliminar"
        ? "ELIMINAR"
        : String(action || "CAMBIO").toUpperCase();

    const actionLabel =
      action === "crear"
        ? "Nuevo registro"
        : action === "editar"
        ? "Actualización de registro"
        : action === "eliminar"
        ? "Eliminación de registro"
        : "Cambio de registro";

    const fieldText = fields.length ? ` Campos modificados: ${fields.join(", ")}.` : "";
    const detail = `${actionLabel} en ${meta.title} (${table})${recordId ? ` · ID ${recordId}` : ""}${rowTitle ? ` · ${rowTitle}` : ""}.${fieldText}`;

    putAuditValue(payload, columns, ["fecha", "fecha_hora", "fecha_accion", "created_at"], now);
    putAuditValue(payload, columns, ["usuario_id", "id_usuario", "user_id"], user.id || 1);
    putAuditValue(payload, columns, ["usuario", "nombre_usuario", "correo_usuario", "email_usuario", "usuario_accion"], user.display);
    putAuditValue(payload, columns, ["modulo", "modulo_sistema", "seccion"], "Mantenimiento");
    putAuditValue(payload, columns, ["accion"], actionLabel);
    putAuditValue(payload, columns, ["detalle", "descripcion", "observacion", "comentario"], detail);
    putAuditValue(payload, columns, ["tabla", "tabla_afectada", "entidad"], table);
    putAuditValue(payload, columns, ["registro_id", "id_registro", "referencia_id"], recordId);
    putAuditValue(payload, columns, ["tipo_evento", "tipo_accion", "tipo", "evento"], auditEvent);

    columns.forEach((column) => {
      if (column.auto || column.columnKey === "PRI") return;
      if (!column.required) return;
      if (payload[column.name] !== undefined && payload[column.name] !== null) return;
      payload[column.name] = trimToColumn(requiredFallback(column), column);
    });

    const keys = Object.keys(payload);
    if (!keys.length) return;

    await pool.query(
      `INSERT INTO ${q("auditoria")} (${keys.map(q).join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`,
      keys.map((key) => payload[key])
    );
  } catch (error) {
    console.error("No se pudo registrar auditoría automática:", error?.sqlMessage || error?.message || error);
  }
}

function getMeta(table) {
  const meta = TABLE_META[table] || {};
  return {
    title: meta.title || humanizeName(table),
    description: meta.description || `Administración de registros de ${humanizeName(table).toLowerCase()}.`,
    category: meta.category || "Otros",
    color: meta.color || "blue",
    adminOnly: Boolean(meta.adminOnly),
  };
}

function pickFirst(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== "") return row[name];
  }
  return null;
}

function rowLabel(table, row) {
  const codigo = pickFirst(row, [
    "codigo", "codigo_cliente", "codigo_proveedor", "codigo_ruta", "codigo_estado", "codigo_mantenimiento",
    "codigo_piloto", "codigo_tipo_vehiculo", "codigo_tipo_deposito", "codigo_forma_pago", "codigo_modalidad",
    "codigo_oportunidad", "codigo_cotizacion", "codigo_servicio", "codigo_rol", "codigo_ubicacion", "numero_comprobante",
  ]);

  let name = pickFirst(row, [
    "nombre_empresa", "razon_social", "nombre_comercial", "nombre_ruta", "nombre_ubicacion", "nombre_estado_cliente",
    "nombre_estado_envio", "nombre_estado_factura", "nombre_estado_mantenimiento", "nombre_estado_proveedor",
    "nombre_estado_ruta", "nombre_estado_vehiculo", "nombre_estado_oportunidad", "nombre_estado_asignacion",
    "nombre_forma_pago", "nombre_frecuencia_ruta", "nombre_modalidad", "nombre_tipo_deposito", "nombre_tipo_vehiculo",
    "nombre_servicio_proveedor", "nombre_deposito", "nombre_oportunidad", "tipo", "descripcion", "pais", "email", "correo",
  ]);

  if (!name && (row.primer_nombre || row.primer_apellido)) {
    name = [row.primer_nombre, row.segundo_nombre, row.primer_apellido, row.segundo_apellido]
      .filter(Boolean)
      .join(" ");
  }

  if (!name && table === "telefono_contacto") {
    name = [row.prefijo || row.prefijo_telefonico || "", row.telefono || ""].join(" ").trim();
  }

  if (!name && table === "ruta_historial") name = `${row.fecha || "Fecha"} · Q ${row.costo || 0}`;
  if (!name && table === "tracking_viaje") name = `${row.fecha || "Tracking"} · ${row.porcentaje || 0}%`;

  const parts = [];
  if (codigo) parts.push(String(codigo));
  if (name) parts.push(String(name));
  if (!parts.length) parts.push(`${humanizeName(table)} #${row.id ?? ""}`.trim());

  return parts.join(" · ");
}

async function getOptions(table, limit = 500) {
  await assertTable(table);
  const pk = await getPrimaryKey(table);
  const [rows] = await pool.query(
    `SELECT * FROM ${q(table)} ORDER BY ${q(pk)} DESC LIMIT ${cleanLimit(limit, 500)}`
  );

  return rows.map((row) => ({
    value: row[pk],
    label: rowLabel(table, row),
    row,
  }));
}

async function getReferenceUsages(table, id) {
  await assertTable(table);
  const dbName = await getDbName();
  const pk = await getPrimaryKey(table);

  const [refs] = await pool.query(
    `
    SELECT
      TABLE_NAME AS tableName,
      COLUMN_NAME AS columnName,
      CONSTRAINT_NAME AS constraintName
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = ?
      AND REFERENCED_TABLE_NAME = ?
      AND REFERENCED_COLUMN_NAME = ?
    `,
    [dbName, table, pk]
  );

  const usages = [];
  for (const ref of refs) {
    if (!isValidName(ref.tableName) || !isValidName(ref.columnName)) continue;
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM ${q(ref.tableName)} WHERE ${q(ref.columnName)} = ?`,
      [id]
    );
    const total = Number(countRows[0]?.total || 0);
    if (total > 0) {
      usages.push({
        table: ref.tableName,
        column: ref.columnName,
        constraint: ref.constraintName,
        count: total,
        title: getMeta(ref.tableName).title,
      });
    }
  }
  return usages;
}

function sqlErrorMessage(error) {
  if (error?.code === "ER_DUP_ENTRY") return "Ya existe un registro con ese valor único.";
  if (error?.code === "ER_NO_REFERENCED_ROW_2") return "El registro relacionado seleccionado no existe.";
  if (error?.code === "ER_ROW_IS_REFERENCED_2") return "No se puede eliminar porque el registro tiene información relacionada.";
  if (error?.code === "ER_BAD_NULL_ERROR") return "Hay campos obligatorios sin completar.";
  if (error?.code === "ER_TRUNCATED_WRONG_VALUE") return "Uno de los valores no tiene el formato correcto.";
  return error?.message || "Error interno del servidor.";
}

router.get("/bootstrap", async (req, res) => {
  try {
    const tables = await getTables();
    const tableData = [];
    const schemas = {};
    const options = {};
    const fkReferencedTables = new Set();

    for (const table of tables) {
      const columns = await getColumns(table);
      const foreignKeys = await getForeignKeys(table);
      const uniqueIndexes = await getUniqueIndexes(table);
      const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM ${q(table)}`);

      foreignKeys.forEach((fk) => fkReferencedTables.add(fk.referencedTable));

      schemas[table] = { columns, foreignKeys, uniqueIndexes, primaryKey: columns.find((c) => c.columnKey === "PRI")?.name || "id" };
      tableData.push({ name: table, records: Number(countRows[0]?.total || 0), ...getMeta(table), columns: columns.length });
    }

    for (const table of fkReferencedTables) {
      try {
        options[table] = await getOptions(table, 600);
      } catch (err) {
        options[table] = [];
      }
    }

    res.json({
      ok: true,
      message: "Mantenimiento cargado desde MySQL.",
      data: {
        tables: tableData,
        schemas,
        options,
        categories: CATEGORY_ORDER,
      },
    });
  } catch (error) {
    console.error("Error GET /mantenimiento/bootstrap:", error);
    res.status(500).json({ ok: false, message: "No se pudo cargar mantenimiento.", error: sqlErrorMessage(error) });
  }
});

router.get("/tablas", async (req, res) => {
  try {
    const tables = await getTables();
    const data = [];
    for (const table of tables) {
      const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM ${q(table)}`);
      data.push({ name: table, nombre: table, records: Number(countRows[0]?.total || 0), registros: Number(countRows[0]?.total || 0), ...getMeta(table) });
    }
    res.json({ ok: true, data });
  } catch (error) {
    console.error("Error GET /mantenimiento/tablas:", error);
    res.status(500).json({ ok: false, message: "No se pudieron listar las tablas.", error: sqlErrorMessage(error) });
  }
});

router.get("/tablas/:tabla/columnas", async (req, res) => {
  try {
    const { tabla } = req.params;
    const columns = await getColumns(tabla);
    const foreignKeys = await getForeignKeys(tabla);
    const uniqueIndexes = await getUniqueIndexes(tabla);
    res.json({ ok: true, data: { columnas: columns, columns, foreignKeys, uniqueIndexes, primaryKey: columns.find((c) => c.columnKey === "PRI")?.name || "id" } });
  } catch (error) {
    console.error("Error GET /mantenimiento/tablas/:tabla/columnas:", error);
    res.status(error.status || 500).json({ ok: false, message: "No se pudieron obtener las columnas.", error: sqlErrorMessage(error) });
  }
});

router.get("/opciones/:tabla", async (req, res) => {
  try {
    const data = await getOptions(req.params.tabla, req.query.limit || 600);
    res.json({ ok: true, data });
  } catch (error) {
    console.error("Error GET /mantenimiento/opciones:", error);
    res.status(error.status || 500).json({ ok: false, message: "No se pudieron obtener las opciones.", error: sqlErrorMessage(error) });
  }
});

router.get("/tablas/:tabla/registros", async (req, res) => {
  try {
    const { tabla } = req.params;
    const columns = await getColumns(tabla);
    const primaryKey = columns.find((c) => c.columnKey === "PRI")?.name || "id";
    const limit = cleanLimit(req.query.limit, 1000);
    const offset = cleanOffset(req.query.offset);
    const search = String(req.query.search || "").trim();

    let where = "";
    const params = [];
    if (search) {
      const searchable = columns.filter((c) => ["char", "varchar", "text", "mediumtext", "longtext", "enum"].includes(String(c.type).toLowerCase()));
      if (searchable.length) {
        where = "WHERE " + searchable.map((c) => `CAST(${q(c.name)} AS CHAR) LIKE ?`).join(" OR ");
        searchable.forEach(() => params.push(`%${search}%`));
      }
    }

    const orderColumn = tabla === "auditoria" && columns.some((column) => column.name === "fecha") ? "fecha" : primaryKey;

    const [records] = await pool.query(
      `SELECT * FROM ${q(tabla)} ${where} ORDER BY ${q(orderColumn)} DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM ${q(tabla)} ${where}`, params);

    res.json({
      ok: true,
      data: {
        registros: records,
        records,
        columnas: columns,
        columns,
        llavePrimaria: primaryKey,
        primaryKey,
        total: Number(countRows[0]?.total || 0),
      },
    });
  } catch (error) {
    console.error("Error GET /mantenimiento/tablas/:tabla/registros:", error);
    res.status(error.status || 500).json({ ok: false, message: "No se pudieron obtener los registros.", error: sqlErrorMessage(error) });
  }
});

router.get("/tablas/:tabla/referencias/:id", async (req, res) => {
  try {
    const usages = await getReferenceUsages(req.params.tabla, req.params.id);
    res.json({ ok: true, data: usages });
  } catch (error) {
    console.error("Error GET referencias:", error);
    res.status(error.status || 500).json({ ok: false, message: "No se pudieron validar las relaciones.", error: sqlErrorMessage(error) });
  }
});

router.post("/tablas/:tabla/registros", async (req, res) => {
  try {
    const { tabla } = req.params;

    if (READ_ONLY_MAINTENANCE_TABLES.has(tabla)) {
      return res.status(403).json({
        ok: false,
        message: "Auditoría se genera automáticamente con las acciones del sistema. No se permite ingresarla manualmente.",
      });
    }

    const columns = await getColumns(tabla);
    const payload = await protectPasswordPayload(tabla, buildPayload(req.body || {}, columns));
    const keys = Object.keys(payload);
    if (!keys.length) return res.status(400).json({ ok: false, message: "No hay campos válidos para guardar." });

    const [result] = await pool.query(
      `INSERT INTO ${q(tabla)} (${keys.map(q).join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`,
      keys.map((key) => payload[key])
    );

    const primaryKey = await getPrimaryKey(tabla);
    const recordId = result.insertId || payload[primaryKey] || null;
    const rowTitle = recordId ? await getRowLabelById(tabla, primaryKey, recordId) : "";
    await logAutomaticAudit(req, {
      action: "crear",
      table: tabla,
      recordId,
      rowTitle,
      fields: keys,
    });

    res.json({ ok: true, message: "Registro creado correctamente.", id: result.insertId });
  } catch (error) {
    console.error("Error POST /mantenimiento:", error);
    res.status(error.status || 500).json({ ok: false, message: sqlErrorMessage(error), error: error.message });
  }
});

async function updateRecord(req, res) {
  try {
    const { tabla, id } = req.params;

    if (READ_ONLY_MAINTENANCE_TABLES.has(tabla)) {
      return res.status(403).json({
        ok: false,
        message: "Auditoría es solo de consulta y se actualiza automáticamente.",
      });
    }

    const columns = await getColumns(tabla);
    const primaryKey = columns.find((c) => c.columnKey === "PRI")?.name || "id";
    const payload = await protectPasswordPayload(tabla, buildPayload(req.body || {}, columns, { partial: true }));
    const keys = Object.keys(payload);
    if (!keys.length) return res.status(400).json({ ok: false, message: "No hay campos válidos para actualizar." });

    const [result] = await pool.query(
      `UPDATE ${q(tabla)} SET ${keys.map((key) => `${q(key)} = ?`).join(", ")} WHERE ${q(primaryKey)} = ?`,
      [...keys.map((key) => payload[key]), id]
    );

    if (result.affectedRows) {
      const rowTitle = await getRowLabelById(tabla, primaryKey, id);
      await logAutomaticAudit(req, {
        action: "editar",
        table: tabla,
        recordId: id,
        rowTitle,
        fields: keys,
      });
    }

    res.json({ ok: true, message: "Registro actualizado correctamente.", affectedRows: result.affectedRows });
  } catch (error) {
    console.error("Error PUT/PATCH /mantenimiento:", error);
    res.status(error.status || 500).json({ ok: false, message: sqlErrorMessage(error), error: error.message });
  }
}

router.put("/tablas/:tabla/registros/:id", updateRecord);
router.patch("/tablas/:tabla/registros/:id", updateRecord);

router.delete("/tablas/:tabla/registros/:id", async (req, res) => {
  try {
    const { tabla, id } = req.params;

    if (READ_ONLY_MAINTENANCE_TABLES.has(tabla)) {
      return res.status(403).json({
        ok: false,
        message: "Auditoría se genera automáticamente y no debe eliminarse desde mantenimiento.",
      });
    }

    await assertTable(tabla);
    const primaryKey = await getPrimaryKey(tabla);
    const rowTitle = await getRowLabelById(tabla, primaryKey, id);
    const usages = await getReferenceUsages(tabla, id);

    if (usages.length) {
      return res.status(409).json({
        ok: false,
        message: `No se puede eliminar porque está relacionado con ${usages.slice(0, 4).map((u) => `${u.title} (${u.count})`).join(", ")}${usages.length > 4 ? " y otras tablas" : ""}.`,
        data: usages,
      });
    }

    const [result] = await pool.query(`DELETE FROM ${q(tabla)} WHERE ${q(primaryKey)} = ?`, [id]);

    if (result.affectedRows) {
      await logAutomaticAudit(req, {
        action: "eliminar",
        table: tabla,
        recordId: id,
        rowTitle,
        fields: [],
      });
    }

    res.json({ ok: true, message: "Registro eliminado correctamente.", affectedRows: result.affectedRows });
  } catch (error) {
    console.error("Error DELETE /mantenimiento:", error);
    res.status(error.status || 500).json({ ok: false, message: sqlErrorMessage(error), error: error.message });
  }
});

module.exports = router;