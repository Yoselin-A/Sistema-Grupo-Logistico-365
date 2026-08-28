const pool = require("../config/db");

const q = (name) => `\`${String(name).replace(/`/g, "``")}\``;

const MYSQL_DATETIME_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/Guatemala",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function mysqlNowGuatemala() {
  return MYSQL_DATETIME_FORMATTER.format(new Date()).replace(" ", " ");
}

function clean(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function getHeader(req, names) {
  for (const name of names) {
    const value = req.headers?.[name];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return "";
}

async function tableExists(table) {
  const [rows] = await pool.query(
    `
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
    LIMIT 1
    `,
    [table]
  );

  return rows.length > 0;
}

async function getColumns(table) {
  const [rows] = await pool.query(`SHOW COLUMNS FROM ${q(table)}`);

  return rows.map((row) => ({
    name: row.Field,
    type: String(row.Type || "").toLowerCase(),
    nullable: String(row.Null || "").toUpperCase() === "YES",
    key: row.Key,
    extra: String(row.Extra || "").toLowerCase(),
  }));
}

function trimForColumn(value, column) {
  if (value === undefined || value === null) return value;

  const match = String(column.type || "").match(/(?:varchar|char)\((\d+)\)/i);
  if (!match) return value;

  return String(value).slice(0, Number(match[1]));
}

function setFirst(payload, columns, names, value) {
  if (value === undefined || value === null) return false;

  for (const name of names) {
    const column = columns.find((item) => item.name === name);
    if (!column) continue;

    payload[name] = trimForColumn(value, column);
    return true;
  }

  return false;
}

function fallbackRequiredValue(column) {
  const type = String(column.type || "");

  if (
    type.includes("int") ||
    type.includes("decimal") ||
    type.includes("float") ||
    type.includes("double")
  ) {
    return 0;
  }

  if (type.includes("date") || type.includes("time") || type.includes("timestamp")) {
    return mysqlNowGuatemala();
  }

  return "-";
}

function getAuditUser(req, event = {}) {
  const body = req.body || {};
  const user = body.user || body.usuario || {};

  const id =
    event.usuario_id ||
    event.user_id ||
    body.usuario_id ||
    body.user_id ||
    body.creado_por ||
    body.actualizado_por ||
    user.id ||
    getHeader(req, ["x-gl365-user-id", "x-user-id", "x-usuario-id"]);

  const email =
    event.email ||
    event.correo ||
    body.email ||
    body.correo ||
    user.email ||
    getHeader(req, ["x-gl365-user-email", "x-user-email", "x-email"]);

  const name =
    event.usuario ||
    event.nombre_usuario ||
    body.nombre_usuario ||
    body.usuario_nombre ||
    body.userName ||
    user.nombre_usuario ||
    user.name ||
    getHeader(req, ["x-gl365-user-name", "x-user-name", "x-usuario"]);

  const role =
    event.rol ||
    event.role ||
    body.rol ||
    body.role ||
    user.role ||
    getHeader(req, ["x-gl365-user-role", "x-user-role", "x-rol"]);

  const display = clean(email || name, "Usuario del sistema");

  return {
    id: id ? Number(id) || null : null,
    display: role ? `${display} (${role})` : display,
    role: clean(role),
  };
}

function requestIsSuccessful(res) {
  return res.statusCode >= 200 && res.statusCode < 400;
}

function methodToAuditEvent(method) {
  const value = String(method || "").toUpperCase();

  if (value === "POST") return { tipo_evento: "CREAR", accion: "Nuevo registro" };
  if (value === "PUT" || value === "PATCH") return { tipo_evento: "ACTUALIZAR", accion: "Actualización de registro" };
  if (value === "DELETE") return { tipo_evento: "ELIMINAR", accion: "Eliminación de registro" };

  return null;
}

function shouldAuditRequest(req) {
  const method = String(req.method || "").toUpperCase();
  const path = String(req.originalUrl || req.url || "").toLowerCase();

  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return false;

  /*
    No se auditan estas rutas desde el middleware global:
    - /api/auth: el inicio de sesión se registra dentro de auth.routes.js.
    - /api/auditoria: evita que auditoría se audite a sí misma.
    - /api/ia: chat de IA no es CRUD.
    - /api/reportes: exportar o consultar reportes no es CRUD.
  */
  if (path.startsWith("/api/auth")) return false;
  if (path.startsWith("/api/auditoria")) return false;
  if (path.startsWith("/api/ia")) return false;
  if (path.startsWith("/api/reportes")) return false;

  return true;
}

function detectModule(originalUrl) {
  const path = String(originalUrl || "").toLowerCase();

  if (path.includes("crm") || path.includes("cliente") || path.includes("oportunidad") || path.includes("cotizacion")) return "CRM";
  if (path.includes("operaciones") || path.includes("asignacion") || path.includes("proveedor")) return "Operaciones";
  if (path.includes("logistica") || path.includes("envio") || path.includes("viaje") || path.includes("deposito")) return "Logística";
  if (path.includes("flota") || path.includes("vehiculo") || path.includes("piloto") || path.includes("unidad")) return "Flota";
  if (path.includes("rutas") || path.includes("ruta")) return "Rutas";
  if (path.includes("comprobante") || path.includes("factura") || path.includes("pago")) return "Comprobantes";
  if (path.includes("mantenimiento")) return "Mantenimiento";

  return "Sistema";
}

function detectTable(originalUrl) {
  const path = String(originalUrl || "").toLowerCase();

  const matchers = [
    ["cliente", "cliente"],
    ["oportunidad", "oportunidad"],
    ["cotizacion", "cotizacion"],
    ["asignacion", "asignacion"],
    ["proveedor", "proveedor"],
    ["envio", "envio"],
    ["viaje", "viaje"],
    ["deposito", "deposito"],
    ["vehiculo", "vehiculo"],
    ["piloto", "piloto"],
    ["unidad", "unidad"],
    ["ruta", "ruta"],
    ["comprobante", "comprobante"],
    ["factura", "comprobante"],
    ["pago", "pago"],
    ["mantenimiento", "mantenimiento"],
  ];

  const found = matchers.find(([needle]) => path.includes(needle));
  if (found) return found[1];

  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] || "registro";
}

function detectRecordId(req) {
  return (
    req.params?.id ||
    req.body?.id ||
    req.body?.registro_id ||
    req.body?.cliente_id ||
    req.body?.viaje_id ||
    req.body?.envio_id ||
    req.body?.comprobante_id ||
    req.body?.asignacion_id ||
    null
  );
}

function detectRowTitle(req) {
  const body = req.body || {};

  return clean(
    body.codigo ||
      body.codigo_cliente ||
      body.codigo_envio ||
      body.codigo_viaje ||
      body.codigo_ruta ||
      body.codigo_asignacion ||
      body.codigo_comprobante ||
      body.nombre ||
      body.nombre_empresa ||
      body.razon_social ||
      body.nombre_usuario ||
      body.email ||
      ""
  );
}

function buildDetail(req, event, modulo, tabla, recordId, rowTitle) {
  const method = String(req.method || "").toUpperCase();
  const route = String(req.originalUrl || req.url || "");

  const titleText = rowTitle ? ` · ${rowTitle}` : "";
  const idText = recordId ? ` · ID ${recordId}` : "";

  return `${event.accion} en ${modulo} · tabla ${tabla}${idText}${titleText}. Método ${method} · ruta ${route}.`;
}

async function insertAudit(req, result = { ok: true }, event = {}) {
  try {
    const exists = await tableExists("auditoria");
    if (!exists) return;

    const columns = await getColumns("auditoria");
    const payload = {};
    const user = getAuditUser(req, event);

    const tipoEvento = clean(event.tipo_evento || event.tipo_accion || event.evento, "CAMBIO");
    const accion = clean(event.accion, tipoEvento);
    const detalle = clean(event.detalle || event.descripcion, accion);

    setFirst(payload, columns, ["fecha", "fecha_hora", "fecha_accion", "created_at"], mysqlNowGuatemala());
    setFirst(payload, columns, ["usuario_id", "id_usuario", "user_id"], user.id || 1);
    setFirst(payload, columns, ["usuario", "nombre_usuario", "correo_usuario", "email_usuario", "usuario_accion"], user.display);
    setFirst(payload, columns, ["modulo", "modulo_sistema", "seccion"], clean(event.modulo, "Sistema"));
    setFirst(payload, columns, ["accion"], accion);
    setFirst(payload, columns, ["detalle", "descripcion", "observacion", "comentario"], detalle);
    setFirst(payload, columns, ["tipo_evento", "tipo_accion", "tipo", "evento"], tipoEvento);
    setFirst(payload, columns, ["tabla", "tabla_afectada", "entidad"], clean(event.tabla || event.tabla_afectada, "-"));
    setFirst(payload, columns, ["registro_id", "id_registro", "referencia_id"], event.registro_id || event.recordId || null);
    setFirst(payload, columns, ["ip", "direccion_ip", "ip_address"], req.ip || req.socket?.remoteAddress || "");
    setFirst(payload, columns, ["user_agent", "navegador"], req.headers?.["user-agent"] || "");
    setFirst(payload, columns, ["resultado", "estado_resultado"], result?.ok === false ? "ERROR" : "OK");

    columns.forEach((column) => {
      if (column.extra.includes("auto_increment") || column.key === "PRI") return;
      if (payload[column.name] !== undefined && payload[column.name] !== null) return;
      if (column.nullable) return;

      payload[column.name] = trimForColumn(fallbackRequiredValue(column), column);
    });

    const keys = Object.keys(payload);
    if (!keys.length) return;

    await pool.query(
      `INSERT INTO ${q("auditoria")} (${keys.map(q).join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`,
      keys.map((key) => payload[key])
    );

    /*
      Evita registros duplicados:
      Si una ruta registra auditoría manualmente, el middleware global ya no vuelve a registrar esa misma petición.
    */
    req._gl365AuditAlreadyInserted = true;
  } catch (error) {
    console.error("Error insertando auditoría:", error?.sqlMessage || error?.message || error);
  }
}

function auditoriaGlobal(req, res, next) {
  const shouldAudit = shouldAuditRequest(req);
  const startedAt = Date.now();

  res.on("finish", async () => {
    try {
      if (!shouldAudit) return;
      if (req._gl365AuditAlreadyInserted) return;
      if (!requestIsSuccessful(res)) return;

      const event = methodToAuditEvent(req.method);
      if (!event) return;

      const modulo = detectModule(req.originalUrl);
      const tabla = detectTable(req.originalUrl);
      const recordId = detectRecordId(req);
      const rowTitle = detectRowTitle(req);

      await insertAudit(req, { ok: true }, {
        modulo,
        tabla,
        tipo_evento: event.tipo_evento,
        accion: event.accion,
        detalle: buildDetail(req, event, modulo, tabla, recordId, rowTitle),
        registro_id: recordId,
        duracion_ms: Date.now() - startedAt,
      });
    } catch (error) {
      console.error("Error en auditoriaGlobal:", error?.message || error);
    }
  });

  next();
}

module.exports = {
  auditoriaGlobal,
  insertAudit,
};