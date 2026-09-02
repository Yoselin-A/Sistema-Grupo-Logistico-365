const express = require("express");
const pool = require("../config/db");

const router = express.Router();

const BOOTSTRAP_SAMPLE_LIMIT = 15;
const MODULE_ROW_LIMIT = 30;
const DETAIL_ROW_LIMIT = 60;
const MAX_GROQ_CONTEXT_CHARS = 18000;
const MAX_QUESTION_CHARS = 1500;

const money = (value) =>
  `Q ${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const normalizeGroqModel = () => {
  const raw = String(process.env.GROQ_MODEL || "").trim();

  const deprecatedModels = new Set([
    "llama-3.1-8b-instant",
    "llama3-8b-8192",
    "llama3-70b-8192",
  ]);

  if (!raw || deprecatedModels.has(raw)) {
    return "openai/gpt-oss-20b";
  }

  return raw;
};

const GROQ_FALLBACK_MODELS = [
  normalizeGroqModel(),
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "qwen/qwen3.6-27b",
].filter(
  (model, index, arr) =>
    Boolean(model) && arr.indexOf(model) === index
);

const safeQuery = async (label, sql, params = []) => {
  try {
    const [rows] = await pool.query(sql, params);
    return {
      rows: Array.isArray(rows) ? rows : [],
      error: null,
    };
  } catch (error) {
    const message =
      error?.sqlMessage || error?.message || "Error desconocido";

    console.error(`Error IA GL365 · ${label}:`, message);

    return {
      rows: [],
      error: {
        tabla: label,
        error: message,
      },
    };
  }
};

const scalar = (rows, key, fallback = 0) =>
  Number(rows?.[0]?.[key] ?? fallback);

const clean = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const clip = (value, max = 250) => {
  const text = String(value ?? "");
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

const hasDelayText = (row) => {
  const text = clean(
    `${row.tipo || ""} ${row.descripcion || ""} ${
      row.nivel || ""
    }`
  );

  return (
    text.includes("retras") ||
    text.includes("demora") ||
    text.includes("tarde") ||
    text.includes("espera") ||
    text.includes("cierre parcial")
  );
};

const tableCache = new Map();
const columnCache = new Map();

const tableExists = async (tableName) => {
  if (tableCache.has(tableName)) {
    return tableCache.get(tableName);
  }

  const result = await safeQuery(
    `exists_${tableName}`,
    `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      LIMIT 1
    `,
    [tableName]
  );

  const exists = result.rows.length > 0;
  tableCache.set(tableName, exists);
  return exists;
};

const columnExists = async (tableName, columnName) => {
  const cacheKey = `${tableName}.${columnName}`;

  if (columnCache.has(cacheKey)) {
    return columnCache.get(cacheKey);
  }

  const result = await safeQuery(
    `column_${cacheKey}`,
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName]
  );

  const exists = result.rows.length > 0;
  columnCache.set(cacheKey, exists);
  return exists;
};

const makePlaceholders = (total) =>
  Array.from(
    { length: Number(total || 0) },
    (_, index) => ({ id: index + 1 })
  );

/* =========================================================
   SEGURIDAD DE CONTEXTO
========================================================= */

const SENSITIVE_KEY =
  /(password|contrasena|contraseña|hash|token|secret|api.?key|salt|refresh.?token|access.?token)/i;

const sanitizeForAI = (value) => {
  if (Array.isArray(value)) {
    return value.map(sanitizeForAI);
  }

  if (value && typeof value === "object") {
    const safe = {};

    Object.entries(value).forEach(([key, item]) => {
      if (SENSITIVE_KEY.test(key)) return;
      safe[key] = sanitizeForAI(item);
    });

    return safe;
  }

  if (typeof value === "string") {
    return clip(value, 500);
  }

  return value;
};

/* =========================================================
   DETECCIÓN DE INTENCIÓN
========================================================= */

const STOPWORDS = new Set(
  [
    "a",
    "al",
    "algo",
    "algun",
    "alguna",
    "algunas",
    "algunos",
    "analiza",
    "analizar",
    "analisis",
    "ante",
    "como",
    "con",
    "cual",
    "cuales",
    "cuando",
    "cuanto",
    "cuantos",
    "da",
    "dame",
    "de",
    "del",
    "desde",
    "dime",
    "donde",
    "el",
    "ella",
    "ellos",
    "en",
    "es",
    "esa",
    "ese",
    "eso",
    "esta",
    "estan",
    "este",
    "estos",
    "fecha",
    "hay",
    "hoy",
    "informacion",
    "informe",
    "la",
    "las",
    "lo",
    "los",
    "mas",
    "me",
    "mi",
    "muestra",
    "muestrame",
    "necesito",
    "para",
    "por",
    "que",
    "quien",
    "quienes",
    "quiero",
    "reporte",
    "resumen",
    "sistema",
    "su",
    "sus",
    "tiene",
    "tienen",
    "todo",
    "todos",
    "un",
    "una",
    "ver",
    "cualquiera",

    // palabras de dominio que no ayudan a buscar una entidad específica
    "cliente",
    "clientes",
    "contacto",
    "contactos",
    "cotizacion",
    "cotizaciones",
    "oportunidad",
    "oportunidades",
    "comprobante",
    "comprobantes",
    "factura",
    "facturas",
    "pago",
    "pagos",
    "saldo",
    "cobranza",
    "asignacion",
    "asignaciones",
    "operacion",
    "operaciones",
    "proveedor",
    "proveedores",
    "piloto",
    "pilotos",
    "viaje",
    "viajes",
    "envio",
    "envios",
    "alerta",
    "alertas",
    "tracking",
    "logistica",
    "vehiculo",
    "vehiculos",
    "flota",
    "mantenimiento",
    "ruta",
    "rutas",
    "ubicacion",
    "ubicaciones",
    "usuario",
    "usuarios",
    "rol",
    "roles",
    "estado",
    "estados",
    "detalle",
    "detalles",
    "codigo",
    "numero",
    "direccion",
    "telefono",
    "correo",
    "nit",
    "monto",
    "total",
    "valor",
    "facturado",
    "facturacion",
    "vencido",
    "vencidos",
    "pendiente",
    "pendientes",
    "activo",
    "activos",
    "disponible",
    "disponibles",
    "retraso",
    "retrasos",
    "critico",
    "criticos",
    "rentabilidad",
    "margen",
    "gerencial",
    "ejecutivo",
    "empresa",
  ].map(clean)
);

const extractSearchTerms = (question) => {
  const normalized = clean(question)
    .replace(/[^a-z0-9@._\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const terms = normalized
    .split(" ")
    .map((term) => term.trim())
    .filter(Boolean)
    .filter((term) => term.length >= 3)
    .filter((term) => !STOPWORDS.has(term))
    .filter((term) => !/^\d{1,2}$/.test(term));

  return [...new Set(terms)].slice(0, 6);
};

const containsAny = (question, words) => {
  const q = clean(question);
  return words.some((word) => q.includes(clean(word)));
};

const isRentabilidadQuestion = (question) =>
  containsAny(question, [
    "rentabilidad",
    "margen",
    "utilidad",
    "ganancia",
    "ganancias",
    "rentable",
    "rentables",
  ]);

const normalizeIncomingQuestion = (value) => {
  let text = String(value || "").trim();

  // Si el frontend usó "Mejorar PRO", nos quedamos con la consulta principal
  // para detectar correctamente el módulo y las entidades.
  const proMatch = text.match(/Consulta principal:\s*([^\n]+)/i);
  if (proMatch?.[1]) {
    return proMatch[1].trim();
  }

  // El frontend agrega instrucciones visuales después de la pregunta.
  // Esas instrucciones no deben convertirse en términos de búsqueda SQL.
  text = text.replace(
    /\n\nPresent[aá] la respuesta de forma profesional[\s\S]*$/i,
    ""
  );

  return text.trim();
};


const detectModules = (question) => {
  const q = clean(question);
  const modules = new Set();

  const general = containsAny(q, [
    "todo el sistema",
    "toda la informacion",
    "informacion completa",
    "informe completo",
    "informe gerencial",
    "resumen gerencial",
    "resumen general",
    "que requiere atencion",
    "situacion actual",
    "estado general",
    "analisis general",
    "gl365",
  ]);

  if (
    containsAny(q, [
      "cliente",
      "contacto",
      "cotizacion",
      "oportunidad",
      "pipeline",
      "venta",
      "ventas",
      "crm",
      "comercial",
      "ejecutivo",
    ])
  ) {
    modules.add("crm");
  }

  if (
    containsAny(q, [
      "comprobante",
      "factura",
      "facturacion",
      "pago",
      "cobranza",
      "saldo",
      "vencido",
      "forma de pago",
      "ingreso",
    ])
  ) {
    modules.add("finance");
  }

  if (
    containsAny(q, [
      "asignacion",
      "operacion",
      "costo proveedor",
      "cuadrilla",
      "piloto",
      "furgon",
      "unidad operacion",
      "factura asignacion",
    ])
  ) {
    modules.add("operations");
  }

  if (
    containsAny(q, [
      "viaje",
      "envio",
      "tracking",
      "alerta",
      "logistica",
      "eta",
      "retraso",
      "demora",
      "progreso",
    ])
  ) {
    modules.add("logistics");
  }

  if (
    containsAny(q, [
      "vehiculo",
      "flota",
      "mantenimiento",
      "kilometraje",
      "eficiencia",
      "cabezal",
      "contenedor",
    ])
  ) {
    modules.add("fleet");
  }

  if (
    containsAny(q, [
      "proveedor",
      "sat",
      "clinton",
      "cumplimiento",
      "desempeno",
      "rtu",
    ])
  ) {
    modules.add("suppliers");
    modules.add("operations");
  }

  if (
    containsAny(q, [
      "ruta",
      "ubicacion",
      "origen",
      "destino",
      "kilometro",
      "distancia",
      "frecuencia ruta",
    ])
  ) {
    modules.add("routes");
  }

  if (
    containsAny(q, [
      "usuario",
      "usuarios",
      "rol",
      "roles",
      "vendedor",
      "asesor",
    ])
  ) {
    modules.add("users");
  }

  // Cruces comunes
  if (q.includes("cliente") && containsAny(q, ["factur", "pago", "saldo"])) {
    modules.add("crm");
    modules.add("finance");
  }

  if (q.includes("cliente") && containsAny(q, ["viaje", "envio", "ruta"])) {
    modules.add("crm");
    modules.add("logistics");
    modules.add("routes");
  }

  if (containsAny(q, ["rentabilidad", "margen", "utilidad"])) {
    modules.add("operations");
    modules.add("finance");
  }

  if (general || modules.size === 0) {
    return [
      "crm",
      "finance",
      "operations",
      "logistics",
      "fleet",
      "suppliers",
      "routes",
    ];
  }

  return [...modules];
};

const buildTermFilter = (expression, terms) => {
  if (!terms.length) {
    return {
      sql: "",
      params: [],
    };
  }

  return {
    sql: `WHERE ${terms
      .map(() => `LOWER(${expression}) LIKE ?`)
      .join(" AND ")}`,
    params: terms.map((term) => `%${term}%`),
  };
};

const placeholdersForIds = (ids) => {
  if (!ids.length) return "NULL";
  return ids.map(() => "?").join(", ");
};

/* =========================================================
   CONTEXTO BASE / KPIs
========================================================= */

const getContextoCompacto = async () => {
  const cotizacionHasEstado = await columnExists(
    "cotizacion",
    "estado_ui"
  );

  const results = await Promise.all([
    safeQuery(
      "kpi_general",
      `
        SELECT
          (SELECT COUNT(*) FROM cliente) AS clientes,
          (SELECT COUNT(*) FROM ruta) AS rutas,
          (SELECT COUNT(*) FROM vehiculo) AS vehiculos,
          (SELECT COUNT(*) FROM proveedor) AS proveedores,
          (SELECT COUNT(*) FROM comprobante) AS comprobantes,
          (SELECT COUNT(*) FROM oportunidad) AS oportunidades,
          (SELECT COUNT(*) FROM cotizacion) AS cotizaciones,
          (SELECT COUNT(*) FROM asignacion) AS asignaciones,
          (SELECT COUNT(*) FROM viaje) AS viajes,
          (SELECT COUNT(*) FROM envio) AS envios
      `
    ),

    safeQuery(
      "kpi_logistica",
      `
        SELECT
          (SELECT COUNT(*) FROM viaje) AS total_viajes,
          (SELECT COUNT(*) FROM viaje
           WHERE COALESCE(progreso, 0) > 0
             AND COALESCE(progreso, 0) < 100) AS viajes_activos,
          (SELECT COUNT(*) FROM viaje
           WHERE COALESCE(progreso, 0) >= 100) AS viajes_finalizados,
          (SELECT COUNT(*) FROM alerta
           WHERE COALESCE(leida, 0) = 0) AS alertas_activas,
          (SELECT COUNT(*) FROM alerta
           WHERE COALESCE(leida, 0) = 0
             AND LOWER(COALESCE(nivel, '')) LIKE '%crit%') AS alertas_criticas,
          (SELECT COUNT(*)
           FROM alerta
           WHERE COALESCE(leida, 0) = 0
             AND (
               LOWER(COALESCE(tipo, '')) LIKE '%retras%'
               OR LOWER(COALESCE(descripcion, '')) LIKE '%retras%'
               OR LOWER(COALESCE(descripcion, '')) LIKE '%demora%'
               OR LOWER(COALESCE(descripcion, '')) LIKE '%espera%'
               OR LOWER(COALESCE(descripcion, '')) LIKE '%cierre parcial%'
             )
          ) AS alertas_retraso
      `
    ),

    safeQuery(
      "kpi_flota",
      `
        SELECT
          COUNT(*) AS total_vehiculos,
          SUM(CASE
            WHEN LOWER(COALESCE(ev.nombre_estado_vehiculo, '')) = 'disponible'
            THEN 1 ELSE 0 END) AS disponibles,
          SUM(CASE
            WHEN LOWER(COALESCE(ev.nombre_estado_vehiculo, '')) IN ('asignado', 'en ruta')
            THEN 1 ELSE 0 END) AS en_uso,
          SUM(CASE
            WHEN LOWER(COALESCE(ev.nombre_estado_vehiculo, '')) = 'mantenimiento'
            THEN 1 ELSE 0 END) AS mantenimiento
        FROM vehiculo v
        LEFT JOIN estado_vehiculo ev ON ev.id = v.estado_id
      `
    ),

    safeQuery(
      "kpi_cobranza",
      `
        SELECT
          COUNT(c.id) AS comprobantes,
          SUM(COALESCE(c.total, 0)) AS total_facturado,
          SUM(COALESCE(p.pagado, 0)) AS total_pagado,
          SUM(COALESCE(c.total, 0) - COALESCE(p.pagado, 0)) AS saldo_por_cobrar,
          SUM(CASE
            WHEN LOWER(COALESCE(ef.nombre_estado_factura, '')) = 'vencida'
            THEN COALESCE(c.total, 0) - COALESCE(p.pagado, 0)
            ELSE 0 END) AS saldo_vencido,
          SUM(CASE
            WHEN LOWER(COALESCE(ef.nombre_estado_factura, '')) = 'vencida'
            THEN 1 ELSE 0 END) AS vencidas,
          SUM(CASE
            WHEN LOWER(COALESCE(ef.nombre_estado_factura, '')) = 'pendiente'
            THEN 1 ELSE 0 END) AS pendientes,
          SUM(CASE
            WHEN LOWER(COALESCE(ef.nombre_estado_factura, '')) = 'parcial'
            THEN 1 ELSE 0 END) AS parciales,
          SUM(CASE
            WHEN LOWER(COALESCE(ef.nombre_estado_factura, '')) = 'pagada'
            THEN 1 ELSE 0 END) AS pagadas
        FROM comprobante c
        LEFT JOIN estado_factura ef ON ef.id = c.estado_id
        LEFT JOIN (
          SELECT comprobante_id, SUM(monto) AS pagado
          FROM pago
          GROUP BY comprobante_id
        ) p ON p.comprobante_id = c.id
      `
    ),

    safeQuery(
      "kpi_rentabilidad",
      `
        SELECT
          COUNT(DISTINCT a.id) AS asignaciones,
          SUM(COALESCE(fa.valor, 0)) AS ingreso_cliente,
          SUM(COALESCE(pa.total, 0)) AS costo_proveedor,
          SUM(COALESCE(fa.valor, 0) - COALESCE(pa.total, 0)) AS margen_operativo
        FROM asignacion a
        LEFT JOIN factura_asignacion fa ON fa.asignacion_id = a.id
        LEFT JOIN proveedor_asignacion pa ON pa.asignacion_id = a.id
      `
    ),

    safeQuery(
      "kpi_comercial",
      `
        SELECT
          COUNT(*) AS oportunidades,
          SUM(COALESCE(monto_estimado, 0)) AS pipeline_total,
          SUM(
            COALESCE(monto_estimado, 0)
            * COALESCE(probabilidad, 0)
            / 100
          ) AS pipeline_ponderado
        FROM oportunidad
      `
    ),

    safeQuery(
      "top_viajes",
      `
        SELECT
          v.id,
          v.codigo,
          COALESCE(cl.nombre_empresa, 'Sin cliente') AS cliente,
          COALESCE(r.nombre_ruta, r.codigo_ruta, 'Sin ruta') AS ruta,
          COALESCE(ee.nombre_estado_envio, 'Sin estado') AS estado,
          COALESCE(v.progreso, 0) AS progreso,
          DATE_FORMAT(v.fecha_salida, '%Y-%m-%d %H:%i') AS salida,
          DATE_FORMAT(v.eta, '%Y-%m-%d %H:%i') AS eta
        FROM viaje v
        LEFT JOIN cliente cl ON cl.id = v.cliente_id
        LEFT JOIN ruta r ON r.id = v.ruta_id
        LEFT JOIN envio e ON e.id = v.envio_id
        LEFT JOIN estado_envio ee ON ee.id = e.estado_id
        ORDER BY
          CASE
            WHEN COALESCE(v.progreso, 0) > 0
             AND COALESCE(v.progreso, 0) < 100 THEN 1
            ELSE 2
          END,
          v.id DESC
        LIMIT ?
      `,
      [BOOTSTRAP_SAMPLE_LIMIT]
    ),

    safeQuery(
      "alertas",
      `
        SELECT
          al.id,
          al.viaje_id,
          al.tipo,
          al.descripcion,
          al.nivel,
          al.leida,
          v.codigo AS viaje_codigo,
          COALESCE(cl.nombre_empresa, 'Sin cliente') AS cliente,
          COALESCE(r.nombre_ruta, r.codigo_ruta, 'Sin ruta') AS ruta,
          COALESCE(v.progreso, 0) AS progreso,
          DATE_FORMAT(al.created_at, '%Y-%m-%d %H:%i') AS fecha
        FROM alerta al
        LEFT JOIN viaje v ON v.id = al.viaje_id
        LEFT JOIN cliente cl ON cl.id = v.cliente_id
        LEFT JOIN ruta r ON r.id = v.ruta_id
        WHERE COALESCE(al.leida, 0) = 0
        ORDER BY
          CASE
            WHEN LOWER(COALESCE(al.nivel, '')) LIKE '%crit%' THEN 1
            WHEN LOWER(COALESCE(al.nivel, '')) LIKE '%alto%' THEN 2
            WHEN LOWER(COALESCE(al.nivel, '')) LIKE '%medio%' THEN 3
            ELSE 4
          END,
          al.created_at DESC
        LIMIT ?
      `,
      [BOOTSTRAP_SAMPLE_LIMIT]
    ),

    safeQuery(
      "cobranza_pendiente",
      `
        SELECT
          c.id,
          CONCAT(c.serie, '-', c.numero_comprobante) AS comprobante,
          cl.nombre_empresa AS cliente,
          ef.nombre_estado_factura AS estado,
          fp.nombre_forma_pago AS forma_pago,
          DATE_FORMAT(c.fecha_vencimiento, '%Y-%m-%d') AS vencimiento,
          COALESCE(c.total, 0) AS total,
          COALESCE(p.pagado, 0) AS pagado,
          COALESCE(c.total, 0) - COALESCE(p.pagado, 0) AS saldo
        FROM comprobante c
        LEFT JOIN cliente cl ON cl.id = c.cliente_id
        LEFT JOIN estado_factura ef ON ef.id = c.estado_id
        LEFT JOIN forma_pago fp ON fp.id = c.forma_pago_id
        LEFT JOIN (
          SELECT comprobante_id, SUM(monto) AS pagado
          FROM pago
          GROUP BY comprobante_id
        ) p ON p.comprobante_id = c.id
        WHERE COALESCE(c.total, 0) - COALESCE(p.pagado, 0) > 0
        ORDER BY
          CASE
            WHEN LOWER(COALESCE(ef.nombre_estado_factura, '')) = 'vencida'
            THEN 1 ELSE 2
          END,
          saldo DESC
        LIMIT ?
      `,
      [BOOTSTRAP_SAMPLE_LIMIT]
    ),

    safeQuery(
      "proveedores_riesgo",
      `
        SELECT
          p.id,
          p.codigo_proveedor,
          COALESCE(p.nombre_comercial, p.razon_social) AS proveedor,
          p.nit,
          p.correo,
          p.telefono,
          cp.estado_sat,
          cp.rtu_validado,
          cp.licencia_validada,
          cp.cuenta_validada,
          dp.nivel,
          dp.hallazgos
        FROM proveedor p
        LEFT JOIN cumplimiento_proveedor cp ON cp.proveedor_id = p.id
        LEFT JOIN desempeno_proveedor dp
          ON dp.id = (
            SELECT d2.id
            FROM desempeno_proveedor d2
            WHERE d2.proveedor_id = p.id
            ORDER BY d2.fecha DESC, d2.id DESC
            LIMIT 1
          )
        WHERE LOWER(COALESCE(cp.estado_sat, '')) LIKE '%no%'
           OR LOWER(COALESCE(dp.nivel, '')) IN ('rojo', 'amarillo')
        ORDER BY
          CASE
            WHEN LOWER(COALESCE(dp.nivel, '')) = 'rojo' THEN 1
            WHEN LOWER(COALESCE(cp.estado_sat, '')) LIKE '%no%' THEN 2
            WHEN LOWER(COALESCE(dp.nivel, '')) = 'amarillo' THEN 3
            ELSE 4
          END
        LIMIT ?
      `,
      [BOOTSTRAP_SAMPLE_LIMIT]
    ),

    safeQuery(
      "flota_atencion",
      `
        SELECT
          v.id,
          v.codigo,
          tv.nombre_tipo_vehiculo AS tipo,
          ev.nombre_estado_vehiculo AS estado,
          COALESCE(v.eficiencia, 0) AS eficiencia,
          COALESCE(v.kilometraje, 0) AS kilometraje,
          em.nombre_estado_mantenimiento AS mantenimiento,
          DATE_FORMAT(v.proximo_mantenimiento, '%Y-%m-%d') AS proximo_mantenimiento
        FROM vehiculo v
        LEFT JOIN tipo_vehiculo tv ON tv.id = v.tipo_id
        LEFT JOIN estado_vehiculo ev ON ev.id = v.estado_id
        LEFT JOIN estado_mantenimiento em
          ON em.id = v.estado_mantenimiento_id
        WHERE LOWER(COALESCE(ev.nombre_estado_vehiculo, '')) = 'mantenimiento'
           OR LOWER(COALESCE(em.nombre_estado_mantenimiento, '')) <> 'al dia'
           OR COALESCE(v.eficiencia, 100) < 80
        ORDER BY v.eficiencia ASC
        LIMIT ?
      `,
      [BOOTSTRAP_SAMPLE_LIMIT]
    ),

    safeQuery(
      "rutas_top",
      `
        SELECT
          r.id,
          r.codigo_ruta,
          r.nombre_ruta,
          uo.nombre_ubicacion AS origen,
          ud.nombre_ubicacion AS destino,
          COALESCE(r.distancia_km, 0) AS km,
          COALESCE(r.tiempo, 0) AS horas,
          COALESCE(r.costo, 0) AS costo
        FROM ruta r
        LEFT JOIN ubicacion uo ON uo.id = r.origen_id
        LEFT JOIN ubicacion ud ON ud.id = r.destino_id
        ORDER BY r.distancia_km DESC
        LIMIT ?
      `,
      [BOOTSTRAP_SAMPLE_LIMIT]
    ),

    safeQuery(
      "clientes_muestra",
      `
        SELECT
          c.id,
          c.codigo_cliente,
          c.nombre_empresa,
          c.nit,
          c.direccion,
          ec.nombre_estado_cliente AS estado
        FROM cliente c
        LEFT JOIN estado_cliente ec ON ec.id = c.estado_cliente_id
        ORDER BY c.id DESC
        LIMIT ?
      `,
      [BOOTSTRAP_SAMPLE_LIMIT]
    ),

    safeQuery(
      "vehiculos_muestra",
      `
        SELECT
          v.id,
          v.codigo,
          tv.nombre_tipo_vehiculo AS tipo,
          ev.nombre_estado_vehiculo AS estado,
          COALESCE(v.eficiencia, 0) AS eficiencia,
          COALESCE(v.kilometraje, 0) AS kilometraje,
          em.nombre_estado_mantenimiento AS mantenimiento,
          DATE_FORMAT(v.proximo_mantenimiento, '%Y-%m-%d') AS proximo_mantenimiento
        FROM vehiculo v
        LEFT JOIN tipo_vehiculo tv ON tv.id = v.tipo_id
        LEFT JOIN estado_vehiculo ev ON ev.id = v.estado_id
        LEFT JOIN estado_mantenimiento em
          ON em.id = v.estado_mantenimiento_id
        ORDER BY v.id DESC
        LIMIT ?
      `,
      [BOOTSTRAP_SAMPLE_LIMIT]
    ),

    safeQuery(
      "oportunidades_muestra",
      `
        SELECT
          o.id,
          o.codigo_oportunidad,
          o.nombre_oportunidad,
          c.nombre_empresa AS cliente,
          eo.nombre_estado_oportunidad AS estado,
          COALESCE(o.monto_estimado, 0) AS monto_estimado,
          COALESCE(o.probabilidad, 0) AS probabilidad,
          DATE_FORMAT(o.fecha_creacion, '%Y-%m-%d') AS fecha_creacion,
          DATE_FORMAT(o.fecha_cierre_estimada, '%Y-%m-%d') AS fecha_cierre_estimada
        FROM oportunidad o
        LEFT JOIN cliente c ON c.id = o.cliente_id
        LEFT JOIN estado_oportunidad eo ON eo.id = o.estado_id
        ORDER BY o.id DESC
        LIMIT ?
      `,
      [BOOTSTRAP_SAMPLE_LIMIT]
    ),

    safeQuery(
      "proveedores_muestra",
      `
        SELECT
          p.id,
          p.codigo_proveedor,
          p.razon_social,
          p.nombre_comercial,
          p.nit,
          p.correo,
          p.telefono,
          ep.nombre_estado_proveedor AS estado
        FROM proveedor p
        LEFT JOIN estado_proveedor ep ON ep.id = p.estado_id
        ORDER BY p.id DESC
        LIMIT ?
      `,
      [BOOTSTRAP_SAMPLE_LIMIT]
    ),

    safeQuery(
      "rutas_muestra",
      `
        SELECT
          r.id,
          r.codigo_ruta,
          r.nombre_ruta,
          uo.nombre_ubicacion AS origen,
          ud.nombre_ubicacion AS destino,
          COALESCE(r.distancia_km, 0) AS distancia_km,
          COALESCE(r.tiempo, 0) AS tiempo,
          COALESCE(r.costo, 0) AS costo
        FROM ruta r
        LEFT JOIN ubicacion uo ON uo.id = r.origen_id
        LEFT JOIN ubicacion ud ON ud.id = r.destino_id
        ORDER BY r.id DESC
        LIMIT ?
      `,
      [BOOTSTRAP_SAMPLE_LIMIT]
    ),

    safeQuery(
      "cotizaciones_muestra",
      `
        SELECT
          ct.id,
          ct.codigo_cotizacion,
          c.nombre_empresa AS cliente,
          COALESCE(SUM(cd.cantidad * cd.precio_unitario), 0) AS subtotal,
          COALESCE(SUM(cd.cantidad * cd.precio_unitario), 0) * 1.12 AS total,
          ${
            cotizacionHasEstado
              ? "ct.estado_ui AS estado"
              : "'Borrador' AS estado"
          }
        FROM cotizacion ct
        LEFT JOIN cliente c ON c.id = ct.cliente_id
        LEFT JOIN cotizacion_detalle cd ON cd.cotizacion_id = ct.id
        GROUP BY ct.id, ct.codigo_cotizacion, c.nombre_empresa${
          cotizacionHasEstado ? ", ct.estado_ui" : ""
        }
        ORDER BY ct.id DESC
        LIMIT ?
      `,
      [BOOTSTRAP_SAMPLE_LIMIT]
    ),
  ]);

  const [
    kpiGeneral,
    kpiLogistica,
    kpiFlota,
    kpiCobranza,
    kpiRentabilidad,
    kpiComercial,
    topViajes,
    alertas,
    cobranzaPendiente,
    proveedoresRiesgo,
    flotaAtencion,
    rutasTop,
    clientesMuestra,
    vehiculosMuestra,
    oportunidadesMuestra,
    proveedoresMuestra,
    rutasMuestra,
    cotizacionesMuestra,
  ] = results;

  const errors = results
    .map((result) => result.error)
    .filter(Boolean);

  const general = kpiGeneral.rows[0] || {};
  const delayAlerts = alertas.rows.filter(hasDelayText);

  const kpis = {
    viajes_total: scalar(kpiLogistica.rows, "total_viajes"),
    viajes_activos: scalar(kpiLogistica.rows, "viajes_activos"),
    viajes_finalizados: scalar(
      kpiLogistica.rows,
      "viajes_finalizados"
    ),
    alertas_activas: scalar(kpiLogistica.rows, "alertas_activas"),
    alertas_criticas: scalar(kpiLogistica.rows, "alertas_criticas"),
    alertas_retraso: Math.max(
      scalar(kpiLogistica.rows, "alertas_retraso"),
      delayAlerts.length
    ),

    vehiculos_total: scalar(kpiFlota.rows, "total_vehiculos"),
    flota_disponible: scalar(kpiFlota.rows, "disponibles"),
    flota_en_uso: scalar(kpiFlota.rows, "en_uso"),
    flota_mantenimiento: scalar(kpiFlota.rows, "mantenimiento"),

    comprobantes: scalar(kpiCobranza.rows, "comprobantes"),
    total_facturado: scalar(kpiCobranza.rows, "total_facturado"),
    total_pagado: scalar(kpiCobranza.rows, "total_pagado"),
    saldo_por_cobrar: scalar(
      kpiCobranza.rows,
      "saldo_por_cobrar"
    ),
    saldo_vencido: scalar(kpiCobranza.rows, "saldo_vencido"),
    vencidas: scalar(kpiCobranza.rows, "vencidas"),
    pendientes: scalar(kpiCobranza.rows, "pendientes"),
    parciales: scalar(kpiCobranza.rows, "parciales"),
    pagadas: scalar(kpiCobranza.rows, "pagadas"),

    asignaciones: scalar(kpiRentabilidad.rows, "asignaciones"),
    ingreso_cliente: scalar(kpiRentabilidad.rows, "ingreso_cliente"),
    costo_proveedor: scalar(kpiRentabilidad.rows, "costo_proveedor"),
    margen_operativo: scalar(kpiRentabilidad.rows, "margen_operativo"),

    oportunidades: scalar(kpiComercial.rows, "oportunidades"),
    pipeline_total: scalar(kpiComercial.rows, "pipeline_total"),
    pipeline_ponderado: scalar(
      kpiComercial.rows,
      "pipeline_ponderado"
    ),

    clientes: Number(general.clientes || 0),
    rutas: Number(general.rutas || 0),
    proveedores: Number(general.proveedores || 0),
    cotizaciones: Number(general.cotizaciones || 0),
    envios: Number(general.envios || 0),
  };

  const summary = {
    generatedAt: new Date().toISOString(),

    viajesTotal: kpis.viajes_total,
    viajesActivos: kpis.viajes_activos,
    viajesRetraso: kpis.alertas_retraso,
    viajesCriticos: kpis.alertas_criticas,

    vehiculosDisponibles: kpis.flota_disponible,
    vehiculosMantenimiento:
      kpis.flota_mantenimiento || flotaAtencion.rows.length,

    saldoPorCobrar: kpis.saldo_por_cobrar,
    saldoVencido: kpis.saldo_vencido,

    oportunidadesActivas: kpis.oportunidades,
    pipelinePonderado: kpis.pipeline_ponderado,
    proveedoresRiesgo: proveedoresRiesgo.rows.length,
    margenOperativo: kpis.margen_operativo,

    clientes: kpis.clientes,
    rutas: kpis.rutas,
    comprobantes: kpis.comprobantes,
    asignaciones: kpis.asignaciones,
    vehiculos: kpis.vehiculos_total,
    proveedores: kpis.proveedores,
    cotizaciones: kpis.cotizaciones,
    envios: kpis.envios,
  };

  const data = {
    summary,
    kpis,

    logistics: {
      viajes: topViajes.rows,
      alertas: alertas.rows,
      retrasos: delayAlerts,
    },

    fleet: {
      vehiculos:
        vehiculosMuestra.rows.length > 0
          ? vehiculosMuestra.rows
          : makePlaceholders(kpis.vehiculos_total),
      atencion: flotaAtencion.rows,
    },

    finance: {
      comprobantes:
        cobranzaPendiente.rows.length > 0
          ? cobranzaPendiente.rows
          : makePlaceholders(kpis.comprobantes),
      operaciones: cobranzaPendiente.rows,
    },

    commercial: {
      oportunidades:
        oportunidadesMuestra.rows.length > 0
          ? oportunidadesMuestra.rows
          : makePlaceholders(kpis.oportunidades),
      cotizaciones: cotizacionesMuestra.rows,
    },

    suppliers: {
      proveedores:
        proveedoresMuestra.rows.length > 0
          ? proveedoresMuestra.rows
          : makePlaceholders(kpis.proveedores),
      riesgo: proveedoresRiesgo.rows,
    },

    routes: {
      rutas:
        rutasMuestra.rows.length > 0
          ? rutasMuestra.rows
          : makePlaceholders(kpis.rutas),
      top: rutasTop.rows,
    },

    crm: {
      clientes: clientesMuestra.rows,
      oportunidades: oportunidadesMuestra.rows,
      cotizaciones: cotizacionesMuestra.rows,
    },

    topViajes: topViajes.rows,
    alertas: alertas.rows,
    alertasRetraso: delayAlerts,
    cobranzaPendiente: cobranzaPendiente.rows,
    proveedoresRiesgo: proveedoresRiesgo.rows,
    flotaAtencion: flotaAtencion.rows,
    rutasTop: rutasTop.rows,
  };

  return {
    ok: errors.length === 0,
    groqConfigured: Boolean(process.env.GROQ_API_KEY),
    model: normalizeGroqModel(),
    data,
    diagnostics: {
      errors,
      counts: {
        viajes: kpis.viajes_total,
        envios: kpis.envios,
        vehiculos: kpis.vehiculos_total,
        comprobantes: kpis.comprobantes,
        oportunidades: kpis.oportunidades,
        cotizaciones: kpis.cotizaciones,
        proveedores: kpis.proveedores,
        rutas: kpis.rutas,
        clientes: kpis.clientes,
        asignaciones: kpis.asignaciones,
      },
    },
  };
};

/* =========================================================
   CONSULTAS INTELIGENTES POR MÓDULO
========================================================= */

const getCrmContext = async (terms) => {
  const clienteFilter = buildTermFilter(
    `CONCAT_WS(' ', c.codigo_cliente, c.nombre_empresa, c.nit, c.direccion, ec.nombre_estado_cliente)`,
    terms
  );

  const contactoFilter = buildTermFilter(
    `CONCAT_WS(' ', c.nombre_empresa, c.codigo_cliente, cc.primer_nombre, cc.segundo_nombre, cc.primer_apellido, cc.segundo_apellido, cc.correo, tc.telefono)`,
    terms
  );

  const oportunidadFilter = buildTermFilter(
    `CONCAT_WS(' ', o.codigo_oportunidad, o.nombre_oportunidad, c.nombre_empresa, eo.nombre_estado_oportunidad, m.nombre_modalidad, u.nombre_usuario, u.email)`,
    terms
  );

  const cotizacionFilter = buildTermFilter(
    `CONCAT_WS(' ', ct.codigo_cotizacion, c.nombre_empresa, c.nit, cc.correo, u.nombre_usuario, m.nombre_modalidad, fp.nombre_forma_pago, uo.nombre_ubicacion, ud.nombre_ubicacion)`,
    terms
  );

  const hasEstadoUi = await columnExists("cotizacion", "estado_ui");

  const results = await Promise.all([
    safeQuery(
      "ia_crm_clientes",
      `
        SELECT
          c.id,
          c.codigo_cliente,
          c.nombre_empresa,
          c.nit,
          c.direccion,
          ec.nombre_estado_cliente AS estado,
          DATE_FORMAT(c.created_at, '%Y-%m-%d %H:%i') AS creado
        FROM cliente c
        LEFT JOIN estado_cliente ec ON ec.id = c.estado_cliente_id
        ${clienteFilter.sql}
        ORDER BY c.id DESC
        LIMIT ?
      `,
      [...clienteFilter.params, MODULE_ROW_LIMIT]
    ),

    safeQuery(
      "ia_crm_contactos",
      `
        SELECT
          cc.id,
          cc.cliente_id,
          c.codigo_cliente,
          c.nombre_empresa AS cliente,
          TRIM(CONCAT_WS(
            ' ',
            cc.primer_nombre,
            cc.segundo_nombre,
            cc.primer_apellido,
            cc.segundo_apellido
          )) AS contacto,
          cc.correo,
          cc.es_principal,
          GROUP_CONCAT(
            DISTINCT TRIM(CONCAT(COALESCE(pt.prefijo, ''), ' ', tc.telefono))
            ORDER BY tc.es_principal DESC, tc.id ASC
            SEPARATOR ' / '
          ) AS telefonos
        FROM contacto_cliente cc
        LEFT JOIN cliente c ON c.id = cc.cliente_id
        LEFT JOIN telefono_contacto tc ON tc.contacto_id = cc.id
        LEFT JOIN prefijo_telefonico pt ON pt.id = tc.prefijo_telefonico_id
        ${contactoFilter.sql}
        GROUP BY
          cc.id,
          cc.cliente_id,
          c.codigo_cliente,
          c.nombre_empresa,
          cc.primer_nombre,
          cc.segundo_nombre,
          cc.primer_apellido,
          cc.segundo_apellido,
          cc.correo,
          cc.es_principal
        ORDER BY cc.es_principal DESC, cc.id DESC
        LIMIT ?
      `,
      [...contactoFilter.params, MODULE_ROW_LIMIT]
    ),

    safeQuery(
      "ia_crm_oportunidades",
      `
        SELECT
          o.id,
          o.codigo_oportunidad,
          o.nombre_oportunidad,
          c.codigo_cliente,
          c.nombre_empresa AS cliente,
          TRIM(CONCAT_WS(
            ' ',
            u.primer_nombre,
            u.segundo_nombre,
            u.primer_apellido,
            u.segundo_apellido
          )) AS ejecutivo,
          m.nombre_modalidad AS modalidad,
          eo.nombre_estado_oportunidad AS estado,
          COALESCE(o.monto_estimado, 0) AS monto_estimado,
          COALESCE(o.probabilidad, 0) AS probabilidad,
          DATE_FORMAT(o.fecha_creacion, '%Y-%m-%d') AS fecha_creacion,
          DATE_FORMAT(o.fecha_cierre_estimada, '%Y-%m-%d') AS fecha_cierre_estimada
        FROM oportunidad o
        LEFT JOIN cliente c ON c.id = o.cliente_id
        LEFT JOIN usuario u ON u.id = o.ejecutivo_id
        LEFT JOIN modalidade m ON m.id = o.modalidad_id
        LEFT JOIN estado_oportunidad eo ON eo.id = o.estado_id
        ${oportunidadFilter.sql}
        ORDER BY o.id DESC
        LIMIT ?
      `,
      [...oportunidadFilter.params, MODULE_ROW_LIMIT]
    ),

    safeQuery(
      "ia_crm_cotizaciones",
      `
        SELECT
          ct.id,
          ct.codigo_cotizacion,
          c.codigo_cliente,
          c.nombre_empresa AS cliente,
          c.nit,
          TRIM(CONCAT_WS(
            ' ',
            cc.primer_nombre,
            cc.segundo_nombre,
            cc.primer_apellido,
            cc.segundo_apellido
          )) AS contacto,
          cc.correo AS contacto_correo,
          TRIM(CONCAT_WS(
            ' ',
            u.primer_nombre,
            u.segundo_nombre,
            u.primer_apellido,
            u.segundo_apellido
          )) AS ejecutivo,
          m.nombre_modalidad AS modalidad,
          fp.nombre_forma_pago AS forma_pago,
          uo.nombre_ubicacion AS origen,
          ud.nombre_ubicacion AS destino,
          COUNT(cd.id) AS lineas,
          COALESCE(SUM(cd.cantidad * cd.precio_unitario), 0) AS subtotal,
          COALESCE(SUM(cd.cantidad * cd.precio_unitario), 0) * 0.12 AS iva,
          COALESCE(SUM(cd.cantidad * cd.precio_unitario), 0) * 1.12 AS total,
          ${
            hasEstadoUi
              ? "ct.estado_ui AS estado"
              : "'Borrador' AS estado"
          }
        FROM cotizacion ct
        LEFT JOIN cliente c ON c.id = ct.cliente_id
        LEFT JOIN contacto_cliente cc ON cc.id = ct.contacto_id
        LEFT JOIN usuario u ON u.id = ct.ejecutivo_id
        LEFT JOIN modalidade m ON m.id = ct.modalidad_id
        LEFT JOIN forma_pago fp ON fp.id = ct.forma_pago_id
        LEFT JOIN ubicacion uo ON uo.id = ct.origen_id
        LEFT JOIN ubicacion ud ON ud.id = ct.destino_id
        LEFT JOIN cotizacion_detalle cd ON cd.cotizacion_id = ct.id
        ${cotizacionFilter.sql}
        GROUP BY
          ct.id,
          ct.codigo_cotizacion,
          c.codigo_cliente,
          c.nombre_empresa,
          c.nit,
          cc.primer_nombre,
          cc.segundo_nombre,
          cc.primer_apellido,
          cc.segundo_apellido,
          cc.correo,
          u.primer_nombre,
          u.segundo_nombre,
          u.primer_apellido,
          u.segundo_apellido,
          m.nombre_modalidad,
          fp.nombre_forma_pago,
          uo.nombre_ubicacion,
          ud.nombre_ubicacion${hasEstadoUi ? ", ct.estado_ui" : ""}
        ORDER BY ct.id DESC
        LIMIT ?
      `,
      [...cotizacionFilter.params, MODULE_ROW_LIMIT]
    ),
  ]);

  const [clientes, contactos, oportunidades, cotizaciones] = results;

  const quoteIds = cotizaciones.rows.map((row) => row.id).filter(Boolean);

  const detalles = quoteIds.length
    ? await safeQuery(
        "ia_crm_cotizacion_detalle",
        `
          SELECT
            cd.*,
            ct.codigo_cotizacion
          FROM cotizacion_detalle cd
          LEFT JOIN cotizacion ct ON ct.id = cd.cotizacion_id
          WHERE cd.cotizacion_id IN (${placeholdersForIds(quoteIds)})
          ORDER BY cd.cotizacion_id DESC, cd.id ASC
          LIMIT ?
        `,
        [...quoteIds, DETAIL_ROW_LIMIT]
      )
    : { rows: [], error: null };

  return {
    data: {
      clientes: clientes.rows,
      contactos: contactos.rows,
      oportunidades: oportunidades.rows,
      cotizaciones: cotizaciones.rows,
      cotizacion_detalle: detalles.rows,
    },
    errors: [...results, detalles]
      .map((result) => result.error)
      .filter(Boolean),
  };
};

const getFinanceContext = async (terms) => {
  const filter = buildTermFilter(
    `CONCAT_WS(' ', c.serie, c.numero_comprobante, cl.codigo_cliente, cl.nombre_empresa, ef.nombre_estado_factura, fp.nombre_forma_pago, c.observaciones)`,
    terms
  );

  const results = await Promise.all([
    safeQuery(
      "ia_finance_comprobantes",
      `
        SELECT
          c.id,
          CONCAT(c.serie, '-', c.numero_comprobante) AS comprobante,
          c.serie,
          c.numero_comprobante,
          cl.codigo_cliente,
          cl.nombre_empresa AS cliente,
          DATE_FORMAT(c.fecha_emision, '%Y-%m-%d') AS fecha_emision,
          DATE_FORMAT(c.fecha_vencimiento, '%Y-%m-%d') AS fecha_vencimiento,
          COALESCE(c.subtotal, 0) AS subtotal,
          COALESCE(c.iva, 0) AS iva,
          COALESCE(c.total, 0) AS total,
          COALESCE(p.pagado, 0) AS pagado,
          COALESCE(c.total, 0) - COALESCE(p.pagado, 0) AS saldo,
          ef.nombre_estado_factura AS estado,
          fp.nombre_forma_pago AS forma_pago,
          c.observaciones
        FROM comprobante c
        LEFT JOIN cliente cl ON cl.id = c.cliente_id
        LEFT JOIN estado_factura ef ON ef.id = c.estado_id
        LEFT JOIN forma_pago fp ON fp.id = c.forma_pago_id
        LEFT JOIN (
          SELECT comprobante_id, SUM(monto) AS pagado
          FROM pago
          GROUP BY comprobante_id
        ) p ON p.comprobante_id = c.id
        ${filter.sql}
        ORDER BY c.id DESC
        LIMIT ?
      `,
      [...filter.params, MODULE_ROW_LIMIT]
    ),

    safeQuery(
      "ia_finance_detalles_busqueda",
      `
        SELECT
          dc.id,
          dc.comprobante_id,
          CONCAT(c.serie, '-', c.numero_comprobante) AS comprobante,
          cl.nombre_empresa AS cliente,
          dc.descripcion,
          COALESCE(dc.cantidad, 0) AS cantidad,
          dc.unidad,
          COALESCE(dc.precio_unitario, 0) AS precio_unitario,
          COALESCE(dc.impuesto, 0) AS impuesto,
          COALESCE(dc.descuento, 0) AS descuento,
          COALESCE(dc.total, 0) AS total
        FROM detalle_comprobante dc
        LEFT JOIN comprobante c ON c.id = dc.comprobante_id
        LEFT JOIN cliente cl ON cl.id = c.cliente_id
        ${
          terms.length
            ? buildTermFilter(
                `CONCAT_WS(' ', dc.descripcion, c.serie, c.numero_comprobante, cl.nombre_empresa)`,
                terms
              ).sql
            : ""
        }
        ORDER BY dc.id DESC
        LIMIT ?
      `,
      [
        ...(
          terms.length
            ? buildTermFilter(
                `CONCAT_WS(' ', dc.descripcion, c.serie, c.numero_comprobante, cl.nombre_empresa)`,
                terms
              ).params
            : []
        ),
        DETAIL_ROW_LIMIT,
      ]
    ),
  ]);

  const [comprobantes, detallesBusqueda] = results;
  const ids = comprobantes.rows.map((row) => row.id).filter(Boolean);

  const pagos = ids.length
    ? await safeQuery(
        "ia_finance_pagos",
        `
          SELECT
            p.id,
            p.comprobante_id,
            CONCAT(c.serie, '-', c.numero_comprobante) AS comprobante,
            cl.nombre_empresa AS cliente,
            COALESCE(p.monto, 0) AS monto,
            DATE_FORMAT(p.fecha_pago, '%Y-%m-%d') AS fecha_pago,
            fp.nombre_forma_pago AS forma_pago,
            p.referencia
          FROM pago p
          LEFT JOIN comprobante c ON c.id = p.comprobante_id
          LEFT JOIN cliente cl ON cl.id = c.cliente_id
          LEFT JOIN forma_pago fp ON fp.id = p.forma_pago_id
          WHERE p.comprobante_id IN (${placeholdersForIds(ids)})
          ORDER BY p.fecha_pago DESC, p.id DESC
          LIMIT ?
        `,
        [...ids, DETAIL_ROW_LIMIT]
      )
    : { rows: [], error: null };

  return {
    data: {
      comprobantes: comprobantes.rows,
      detalle_comprobante: detallesBusqueda.rows,
      pagos: pagos.rows,
    },
    errors: [...results, pagos]
      .map((result) => result.error)
      .filter(Boolean),
  };
};

const getOperationsContext = async (terms) => {
  const asignacionFilter = buildTermFilter(
    `CONCAT_WS(' ', a.codigo_asignacion, c.codigo_cliente, c.nombre_empresa, r.codigo_ruta, r.nombre_ruta, vh.codigo, p.licencia, p.primer_nombre, p.primer_apellido, pr.codigo_proveedor, pr.nombre_comercial, pr.razon_social, ea.nombre_estado_asignacion)`,
    terms
  );

  const proveedorFilter = buildTermFilter(
    `CONCAT_WS(' ', p.codigo_proveedor, p.razon_social, p.nombre_comercial, p.nit, p.correo, p.telefono, ep.nombre_estado_proveedor, cp.estado_sat, dp.nivel, dp.hallazgos)`,
    terms
  );

  const results = await Promise.all([
    safeQuery(
      "ia_operations_asignaciones",
      `
        SELECT
          a.id,
          a.codigo_asignacion,
          c.codigo_cliente,
          c.nombre_empresa AS cliente,
          r.codigo_ruta,
          r.nombre_ruta AS ruta,
          uor.nombre_ubicacion AS origen,
          udr.nombre_ubicacion AS destino,
          vh.codigo AS vehiculo,
          tv.nombre_tipo_vehiculo AS tipo_vehiculo,
          TRIM(CONCAT_WS(
            ' ',
            p.primer_nombre,
            p.segundo_nombre,
            p.primer_apellido,
            p.segundo_apellido
          )) AS piloto,
          p.licencia,
          pr.codigo_proveedor,
          COALESCE(pr.nombre_comercial, pr.razon_social) AS proveedor,
          DATE_FORMAT(a.fecha_carga, '%Y-%m-%d') AS fecha_carga,
          DATE_FORMAT(a.fecha_descarga, '%Y-%m-%d') AS fecha_descarga,
          ea.nombre_estado_asignacion AS estado,
          COALESCE(ca.total, 0) AS costo_asignacion,
          COALESCE(pa.total, 0) AS costo_proveedor,
          COALESCE(fa.valor, 0) AS ingreso_cliente,
          COALESCE(fa.valor, 0) - COALESCE(pa.total, 0) AS margen,
          DATE_FORMAT(pa.fecha_pago, '%Y-%m-%d') AS fecha_pago_proveedor,
          DATE_FORMAT(fa.fecha_pago, '%Y-%m-%d') AS fecha_pago_cliente
        FROM asignacion a
        LEFT JOIN cliente c ON c.id = a.cliente_id
        LEFT JOIN ruta r ON r.id = a.ruta_id
        LEFT JOIN ubicacion uor ON uor.id = r.origen_id
        LEFT JOIN ubicacion udr ON udr.id = r.destino_id
        LEFT JOIN vehiculo vh ON vh.id = a.vehiculo_id
        LEFT JOIN tipo_vehiculo tv ON tv.id = vh.tipo_id
        LEFT JOIN piloto p ON p.id = a.piloto_id
        LEFT JOIN proveedor pr ON pr.id = a.proveedor_id
        LEFT JOIN estado_asignacion ea ON ea.id = a.estado_asignacion_id
        LEFT JOIN costo_asignacion ca ON ca.asignacion_id = a.id
        LEFT JOIN proveedor_asignacion pa
          ON pa.id = (
            SELECT pa2.id
            FROM proveedor_asignacion pa2
            WHERE pa2.asignacion_id = a.id
            ORDER BY pa2.id DESC
            LIMIT 1
          )
        LEFT JOIN factura_asignacion fa
          ON fa.id = (
            SELECT fa2.id
            FROM factura_asignacion fa2
            WHERE fa2.asignacion_id = a.id
            ORDER BY fa2.id DESC
            LIMIT 1
          )
        ${asignacionFilter.sql}
        ORDER BY a.id DESC
        LIMIT ?
      `,
      [...asignacionFilter.params, MODULE_ROW_LIMIT]
    ),

    safeQuery(
      "ia_operations_proveedores",
      `
        SELECT
          p.id,
          p.codigo_proveedor,
          p.razon_social,
          p.nombre_comercial,
          p.nit,
          p.correo,
          p.telefono,
          ep.nombre_estado_proveedor AS estado,
          COALESCE(sp.nombre_servicio_proveedor, 'Transporte') AS servicio,
          cp.estado_sat,
          cp.rtu_validado,
          cp.lista_clinton,
          cp.licencia_validada,
          cp.cuenta_validada,
          dp.nivel AS desempeno,
          dp.historial,
          dp.hallazgos,
          DATE_FORMAT(dp.fecha, '%Y-%m-%d') AS fecha_desempeno
        FROM proveedor p
        LEFT JOIN estado_proveedor ep ON ep.id = p.estado_id
        LEFT JOIN servicio_proveedor sp
          ON sp.id = (
            SELECT sp2.id
            FROM servicio_proveedor sp2
            WHERE sp2.proveedor_id = p.id
            ORDER BY sp2.es_principal DESC, sp2.id ASC
            LIMIT 1
          )
        LEFT JOIN cumplimiento_proveedor cp ON cp.proveedor_id = p.id
        LEFT JOIN desempeno_proveedor dp
          ON dp.id = (
            SELECT dp2.id
            FROM desempeno_proveedor dp2
            WHERE dp2.proveedor_id = p.id
            ORDER BY dp2.fecha DESC, dp2.id DESC
            LIMIT 1
          )
        ${proveedorFilter.sql}
        ORDER BY p.id DESC
        LIMIT ?
      `,
      [...proveedorFilter.params, MODULE_ROW_LIMIT]
    ),

    safeQuery(
      "ia_operations_pilotos",
      `
        SELECT
          p.id,
          p.codigo_piloto,
          TRIM(CONCAT_WS(
            ' ',
            p.primer_nombre,
            p.segundo_nombre,
            p.primer_apellido,
            p.segundo_apellido
          )) AS piloto,
          p.licencia
        FROM piloto p
        ${
          terms.length
            ? buildTermFilter(
                `CONCAT_WS(' ', p.codigo_piloto, p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido, p.licencia)`,
                terms
              ).sql
            : ""
        }
        ORDER BY p.id DESC
        LIMIT ?
      `,
      [
        ...(
          terms.length
            ? buildTermFilter(
                `CONCAT_WS(' ', p.codigo_piloto, p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido, p.licencia)`,
                terms
              ).params
            : []
        ),
        MODULE_ROW_LIMIT,
      ]
    ),
  ]);

  const [asignaciones, proveedores, pilotos] = results;
  const assignmentIds = asignaciones.rows
    .map((row) => row.id)
    .filter(Boolean);

  const pagosProveedor = assignmentIds.length
    ? await safeQuery(
        "ia_operations_pagos_proveedor",
        `
          SELECT
            pp.*
          FROM pago_proveedor pp
          WHERE pp.asignacion_id IN (${placeholdersForIds(
            assignmentIds
          )})
          ORDER BY pp.id DESC
          LIMIT ?
        `,
        [...assignmentIds, DETAIL_ROW_LIMIT]
      )
    : { rows: [], error: null };

  return {
    data: {
      asignaciones: asignaciones.rows,
      proveedores: proveedores.rows,
      pilotos: pilotos.rows,
      pagos_proveedor: pagosProveedor.rows,
    },
    errors: [...results, pagosProveedor]
      .map((result) => result.error)
      .filter(Boolean),
  };
};

const getLogisticsContext = async (terms) => {
  const tripFilter = buildTermFilter(
    `CONCAT_WS(' ', v.codigo, c.codigo_cliente, c.nombre_empresa, r.codigo_ruta, r.nombre_ruta, e.codigo, ee.nombre_estado_envio, p.licencia, p.primer_nombre, p.primer_apellido)`,
    terms
  );

  const shipmentFilter = buildTermFilter(
    `CONCAT_WS(' ', e.codigo, c.codigo_cliente, c.nombre_empresa, uo.nombre_ubicacion, ud.nombre_ubicacion, e.direccion, ee.nombre_estado_envio, e.observaciones)`,
    terms
  );

  const alertFilter = buildTermFilter(
    `CONCAT_WS(' ', al.tipo, al.descripcion, al.nivel, v.codigo, c.nombre_empresa, r.nombre_ruta)`,
    terms
  );

  const results = await Promise.all([
    safeQuery(
      "ia_logistics_viajes",
      `
        SELECT
          v.id,
          v.codigo,
          c.codigo_cliente,
          c.nombre_empresa AS cliente,
          e.codigo AS envio,
          r.codigo_ruta,
          r.nombre_ruta AS ruta,
          uo.nombre_ubicacion AS origen,
          ud.nombre_ubicacion AS destino,
          un.codigo AS unidad,
          TRIM(CONCAT_WS(
            ' ',
            p.primer_nombre,
            p.segundo_nombre,
            p.primer_apellido,
            p.segundo_apellido
          )) AS piloto,
          p.licencia,
          ee.nombre_estado_envio AS estado_envio,
          COALESCE(v.progreso, 0) AS progreso,
          DATE_FORMAT(v.fecha_salida, '%Y-%m-%d %H:%i') AS fecha_salida,
          DATE_FORMAT(v.eta, '%Y-%m-%d %H:%i') AS eta,
          (
            SELECT al2.nivel
            FROM alerta al2
            WHERE al2.viaje_id = v.id
              AND COALESCE(al2.leida, 0) = 0
            ORDER BY al2.created_at DESC, al2.id DESC
            LIMIT 1
          ) AS alerta_nivel,
          (
            SELECT al2.descripcion
            FROM alerta al2
            WHERE al2.viaje_id = v.id
              AND COALESCE(al2.leida, 0) = 0
            ORDER BY al2.created_at DESC, al2.id DESC
            LIMIT 1
          ) AS alerta_descripcion
        FROM viaje v
        LEFT JOIN cliente c ON c.id = v.cliente_id
        LEFT JOIN envio e ON e.id = v.envio_id
        LEFT JOIN estado_envio ee ON ee.id = e.estado_id
        LEFT JOIN ruta r ON r.id = v.ruta_id
        LEFT JOIN ubicacion uo ON uo.id = r.origen_id
        LEFT JOIN ubicacion ud ON ud.id = r.destino_id
        LEFT JOIN unidad un ON un.id = v.unidad_id
        LEFT JOIN piloto p ON p.id = v.piloto_id
        ${tripFilter.sql}
        ORDER BY v.id DESC
        LIMIT ?
      `,
      [...tripFilter.params, MODULE_ROW_LIMIT]
    ),

    safeQuery(
      "ia_logistics_envios",
      `
        SELECT
          e.id,
          e.codigo,
          c.codigo_cliente,
          c.nombre_empresa AS cliente,
          uo.nombre_ubicacion AS origen,
          uo.pais AS origen_pais,
          ud.nombre_ubicacion AS destino,
          ud.pais AS destino_pais,
          e.direccion,
          DATE_FORMAT(e.fecha, '%Y-%m-%d') AS fecha,
          ee.nombre_estado_envio AS estado,
          e.observaciones
        FROM envio e
        LEFT JOIN cliente c ON c.id = e.cliente_id
        LEFT JOIN ubicacion uo ON uo.id = e.origen_id
        LEFT JOIN ubicacion ud ON ud.id = e.destino_id
        LEFT JOIN estado_envio ee ON ee.id = e.estado_id
        ${shipmentFilter.sql}
        ORDER BY e.id DESC
        LIMIT ?
      `,
      [...shipmentFilter.params, MODULE_ROW_LIMIT]
    ),

    safeQuery(
      "ia_logistics_alertas",
      `
        SELECT
          al.id,
          al.viaje_id,
          v.codigo AS viaje,
          c.nombre_empresa AS cliente,
          r.nombre_ruta AS ruta,
          al.tipo,
          al.descripcion,
          al.nivel,
          al.leida,
          DATE_FORMAT(al.created_at, '%Y-%m-%d %H:%i') AS fecha
        FROM alerta al
        LEFT JOIN viaje v ON v.id = al.viaje_id
        LEFT JOIN cliente c ON c.id = v.cliente_id
        LEFT JOIN ruta r ON r.id = v.ruta_id
        ${alertFilter.sql}
        ORDER BY al.created_at DESC, al.id DESC
        LIMIT ?
      `,
      [...alertFilter.params, MODULE_ROW_LIMIT]
    ),
  ]);

  const [viajes, envios, alertas] = results;
  const tripIds = viajes.rows.map((row) => row.id).filter(Boolean);

  const tracking = tripIds.length
    ? await safeQuery(
        "ia_logistics_tracking",
        `
          SELECT
            tv.id,
            tv.viaje_id,
            v.codigo AS viaje,
            tv.latitud,
            tv.longitud,
            ee.nombre_estado_envio AS estado,
            COALESCE(tv.porcentaje, 0) AS porcentaje,
            DATE_FORMAT(tv.fecha, '%Y-%m-%d %H:%i') AS fecha
          FROM tracking_viaje tv
          LEFT JOIN viaje v ON v.id = tv.viaje_id
          LEFT JOIN estado_envio ee ON ee.id = tv.estado_id
          WHERE tv.viaje_id IN (${placeholdersForIds(tripIds)})
          ORDER BY tv.fecha DESC, tv.id DESC
          LIMIT ?
        `,
        [...tripIds, DETAIL_ROW_LIMIT]
      )
    : { rows: [], error: null };

  return {
    data: {
      viajes: viajes.rows,
      envios: envios.rows,
      alertas: alertas.rows,
      tracking: tracking.rows,
    },
    errors: [...results, tracking]
      .map((result) => result.error)
      .filter(Boolean),
  };
};

const getFleetContext = async (terms) => {
  const vehicleFilter = buildTermFilter(
    `CONCAT_WS(' ', v.codigo, tv.nombre_tipo_vehiculo, ev.nombre_estado_vehiculo, em.nombre_estado_mantenimiento)`,
    terms
  );

  const results = await Promise.all([
    safeQuery(
      "ia_fleet_vehiculos",
      `
        SELECT
          v.id,
          v.codigo,
          tv.nombre_tipo_vehiculo AS tipo,
          ev.nombre_estado_vehiculo AS estado,
          COALESCE(v.eficiencia, 0) AS eficiencia,
          COALESCE(v.kilometraje, 0) AS kilometraje,
          em.nombre_estado_mantenimiento AS mantenimiento,
          DATE_FORMAT(v.proximo_mantenimiento, '%Y-%m-%d') AS proximo_mantenimiento,
          lm.codigo_mantenimiento AS ultimo_mantenimiento_codigo,
          lm.tipo AS ultimo_mantenimiento_tipo,
          lm.descripcion AS ultimo_mantenimiento_descripcion,
          DATE_FORMAT(lm.fecha, '%Y-%m-%d') AS ultimo_mantenimiento_fecha,
          COALESCE(lm.costo, 0) AS ultimo_mantenimiento_costo
        FROM vehiculo v
        LEFT JOIN tipo_vehiculo tv ON tv.id = v.tipo_id
        LEFT JOIN estado_vehiculo ev ON ev.id = v.estado_id
        LEFT JOIN estado_mantenimiento em
          ON em.id = v.estado_mantenimiento_id
        LEFT JOIN mantenimiento lm
          ON lm.id = (
            SELECT m2.id
            FROM mantenimiento m2
            WHERE m2.vehiculo_id = v.id
            ORDER BY m2.fecha DESC, m2.id DESC
            LIMIT 1
          )
        ${vehicleFilter.sql}
        ORDER BY v.id DESC
        LIMIT ?
      `,
      [...vehicleFilter.params, MODULE_ROW_LIMIT]
    ),
  ]);

  const [vehiculos] = results;
  const ids = vehiculos.rows.map((row) => row.id).filter(Boolean);

  const mantenimientos = ids.length
    ? await safeQuery(
        "ia_fleet_mantenimientos",
        `
          SELECT
            m.id,
            m.codigo_mantenimiento,
            m.vehiculo_id,
            v.codigo AS vehiculo,
            m.tipo,
            m.descripcion,
            DATE_FORMAT(m.fecha, '%Y-%m-%d') AS fecha,
            DATE_FORMAT(m.proximo, '%Y-%m-%d') AS proximo,
            em.nombre_estado_mantenimiento AS estado,
            COALESCE(m.costo, 0) AS costo
          FROM mantenimiento m
          LEFT JOIN vehiculo v ON v.id = m.vehiculo_id
          LEFT JOIN estado_mantenimiento em ON em.id = m.estado_id
          WHERE m.vehiculo_id IN (${placeholdersForIds(ids)})
          ORDER BY m.fecha DESC, m.id DESC
          LIMIT ?
        `,
        [...ids, DETAIL_ROW_LIMIT]
      )
    : { rows: [], error: null };

  return {
    data: {
      vehiculos: vehiculos.rows,
      mantenimientos: mantenimientos.rows,
    },
    errors: [...results, mantenimientos]
      .map((result) => result.error)
      .filter(Boolean),
  };
};

const getSupplierContext = async (terms) => {
  const filter = buildTermFilter(
    `CONCAT_WS(' ', p.codigo_proveedor, p.razon_social, p.nombre_comercial, p.nit, p.correo, p.telefono, ep.nombre_estado_proveedor, cp.estado_sat, dp.nivel, dp.hallazgos, sp.nombre_servicio_proveedor)`,
    terms
  );

  const proveedores = await safeQuery(
    "ia_suppliers_proveedores",
    `
      SELECT
        p.id,
        p.codigo_proveedor,
        p.razon_social,
        p.nombre_comercial,
        p.nit,
        p.correo,
        p.telefono,
        ep.nombre_estado_proveedor AS estado,
        COALESCE(sp.nombre_servicio_proveedor, 'Transporte') AS servicio,
        cp.estado_sat,
        cp.rtu_validado,
        cp.lista_clinton,
        cp.licencia_validada,
        cp.cuenta_validada,
        dp.nivel AS desempeno,
        dp.historial,
        dp.hallazgos,
        DATE_FORMAT(dp.fecha, '%Y-%m-%d') AS fecha_desempeno
      FROM proveedor p
      LEFT JOIN estado_proveedor ep ON ep.id = p.estado_id
      LEFT JOIN servicio_proveedor sp
        ON sp.id = (
          SELECT sp2.id
          FROM servicio_proveedor sp2
          WHERE sp2.proveedor_id = p.id
          ORDER BY sp2.es_principal DESC, sp2.id ASC
          LIMIT 1
        )
      LEFT JOIN cumplimiento_proveedor cp ON cp.proveedor_id = p.id
      LEFT JOIN desempeno_proveedor dp
        ON dp.id = (
          SELECT dp2.id
          FROM desempeno_proveedor dp2
          WHERE dp2.proveedor_id = p.id
          ORDER BY dp2.fecha DESC, dp2.id DESC
          LIMIT 1
        )
      ${filter.sql}
      ORDER BY p.id DESC
      LIMIT ?
    `,
    [...filter.params, MODULE_ROW_LIMIT]
  );

  const ids = proveedores.rows.map((row) => row.id).filter(Boolean);

  const contactos = ids.length && (await tableExists("contacto_proveedor"))
    ? await safeQuery(
        "ia_suppliers_contactos",
        `
          SELECT *
          FROM contacto_proveedor
          WHERE proveedor_id IN (${placeholdersForIds(ids)})
          ORDER BY proveedor_id, id
          LIMIT ?
        `,
        [...ids, DETAIL_ROW_LIMIT]
      )
    : { rows: [], error: null };

  return {
    data: {
      proveedores: proveedores.rows,
      contactos: contactos.rows,
    },
    errors: [proveedores, contactos]
      .map((result) => result.error)
      .filter(Boolean),
  };
};

const getRoutesContext = async (terms) => {
  const routeFilter = buildTermFilter(
    `CONCAT_WS(' ', r.codigo_ruta, r.nombre_ruta, uo.nombre_ubicacion, uo.pais, ud.nombre_ubicacion, ud.pais, fr.nombre_frecuencia_ruta, er.nombre_estado_ruta)`,
    terms
  );

  const locationFilter = buildTermFilter(
    `CONCAT_WS(' ', u.codigo_ubicacion, u.nombre_ubicacion, u.pais)`,
    terms
  );

  const results = await Promise.all([
    safeQuery(
      "ia_routes_rutas",
      `
        SELECT
          r.id,
          r.codigo_ruta,
          r.nombre_ruta,
          uo.codigo_ubicacion AS origen_codigo,
          uo.nombre_ubicacion AS origen,
          uo.pais AS origen_pais,
          ud.codigo_ubicacion AS destino_codigo,
          ud.nombre_ubicacion AS destino,
          ud.pais AS destino_pais,
          COALESCE(r.distancia_km, 0) AS distancia_km,
          COALESCE(r.tiempo, 0) AS tiempo_horas,
          COALESCE(r.costo, 0) AS costo,
          fr.nombre_frecuencia_ruta AS frecuencia,
          er.nombre_estado_ruta AS estado
        FROM ruta r
        LEFT JOIN ubicacion uo ON uo.id = r.origen_id
        LEFT JOIN ubicacion ud ON ud.id = r.destino_id
        LEFT JOIN frecuencia_ruta fr ON fr.id = r.frecuencia_id
        LEFT JOIN estado_ruta er ON er.id = r.estado_id
        ${routeFilter.sql}
        ORDER BY r.id DESC
        LIMIT ?
      `,
      [...routeFilter.params, MODULE_ROW_LIMIT]
    ),

    safeQuery(
      "ia_routes_ubicaciones",
      `
        SELECT
          u.id,
          u.codigo_ubicacion,
          u.nombre_ubicacion,
          u.pais
        FROM ubicacion u
        ${locationFilter.sql}
        ORDER BY u.nombre_ubicacion, u.id
        LIMIT ?
      `,
      [...locationFilter.params, MODULE_ROW_LIMIT]
    ),
  ]);

  const [rutas, ubicaciones] = results;
  const ids = rutas.rows.map((row) => row.id).filter(Boolean);

  const historial = ids.length && (await tableExists("ruta_historial"))
    ? await safeQuery(
        "ia_routes_historial",
        `
          SELECT
            rh.id,
            rh.ruta_id,
            r.codigo_ruta,
            COALESCE(rh.costo, 0) AS costo,
            DATE_FORMAT(rh.fecha, '%Y-%m-%d') AS fecha
          FROM ruta_historial rh
          LEFT JOIN ruta r ON r.id = rh.ruta_id
          WHERE rh.ruta_id IN (${placeholdersForIds(ids)})
          ORDER BY rh.fecha DESC, rh.id DESC
          LIMIT ?
        `,
        [...ids, DETAIL_ROW_LIMIT]
      )
    : { rows: [], error: null };

  return {
    data: {
      rutas: rutas.rows,
      ubicaciones: ubicaciones.rows,
      historial_costos: historial.rows,
    },
    errors: [...results, historial]
      .map((result) => result.error)
      .filter(Boolean),
  };
};

const getUsersContext = async (terms) => {
  const filter = buildTermFilter(
    `CONCAT_WS(' ', u.primer_nombre, u.segundo_nombre, u.primer_apellido, u.segundo_apellido, u.nombre_usuario, u.email, r.nombre_rol)`,
    terms
  );

  const usuarios = await safeQuery(
    "ia_users_usuarios",
    `
      SELECT
        u.id,
        u.activo,
        TRIM(CONCAT_WS(
          ' ',
          u.primer_nombre,
          u.segundo_nombre,
          u.primer_apellido,
          u.segundo_apellido
        )) AS nombre_completo,
        u.nombre_usuario,
        u.email,
        r.nombre_rol AS rol
      FROM usuario u
      LEFT JOIN role r ON r.id = u.rol_id
      ${filter.sql}
      ORDER BY u.id DESC
      LIMIT ?
    `,
    [...filter.params, MODULE_ROW_LIMIT]
  );

  return {
    data: {
      usuarios: usuarios.rows,
    },
    errors: usuarios.error ? [usuarios.error] : [],
  };
};

const getRelevantContext = async (question) => {
  const base = await getContextoCompacto();
  const modules = detectModules(question);
  const terms = extractSearchTerms(question);

  const loaders = {
    crm: getCrmContext,
    finance: getFinanceContext,
    operations: getOperationsContext,
    logistics: getLogisticsContext,
    fleet: getFleetContext,
    suppliers: getSupplierContext,
    routes: getRoutesContext,
    users: getUsersContext,
  };

  const entries = await Promise.all(
    modules.map(async (moduleName) => {
      const loader = loaders[moduleName];
      if (!loader) return [moduleName, { data: {}, errors: [] }];

      try {
        return [moduleName, await loader(terms)];
      } catch (error) {
        return [
          moduleName,
          {
            data: {},
            errors: [
              {
                tabla: `modulo_${moduleName}`,
                error: error?.message || "Error cargando módulo",
              },
            ],
          },
        ];
      }
    })
  );

  const relevant = {};
  const errors = [...(base.diagnostics?.errors || [])];

  entries.forEach(([moduleName, result]) => {
    relevant[moduleName] = result.data;
    errors.push(...(result.errors || []));
  });

  return {
    ...base,
    question,
    terms,
    modules,
    relevant,
    diagnostics: {
      ...base.diagnostics,
      errors,
      ia: {
        modules,
        terms,
      },
    },
  };
};

/* =========================================================
   RESPUESTA LOCAL VERIFICADA
========================================================= */

const lineList = (
  rows,
  mapper,
  empty = "Sin registros relevantes."
) => {
  const lines = rows.slice(0, 8).map(mapper).filter(Boolean);
  return lines.length ? lines.join("\n") : empty;
};

const markdownTable = (headers, rows, maxRows = 8) => {
  if (!rows.length) return "";

  const safeHeaders = headers.map((item) => String(item));
  const body = rows.slice(0, maxRows);

  return [
    `| ${safeHeaders.join(" | ")} |`,
    `| ${safeHeaders.map(() => "---").join(" | ")} |`,
    ...body.map(
      (row) =>
        `| ${row
          .map((cell) =>
            String(cell ?? "-")
              .replace(/\|/g, "/")
              .replace(/\n/g, " ")
          )
          .join(" | ")} |`
    ),
  ].join("\n");
};

const buildLocalAnswer = (question, ctx) => {
  const q = clean(question);
  const { kpis } = ctx.data;
  const relevant = ctx.relevant || {};

  if (
    ctx.modules.length === 1 &&
    ctx.modules.includes("users")
  ) {
    const usuarios = relevant.users?.usuarios || [];

    return `# Usuarios y roles GL365\n\n${
      markdownTable(
        ["Nombre", "Usuario", "Correo", "Rol", "Activo"],
        usuarios.map((row) => [
          row.nombre_completo,
          row.nombre_usuario,
          row.email,
          row.rol,
          Number(row.activo) === 1 ? "Sí" : "No",
        ])
      ) || "No se encontraron usuarios con ese criterio."
    }\n\nLa IA no consulta ni expone contraseñas, hashes o tokens.`;
  }

  if (ctx.modules.includes("crm") && relevant.crm) {
    const crm = relevant.crm;
    const hasSpecificTerms = ctx.terms.length > 0;

    if (hasSpecificTerms) {
      const customerTable = markdownTable(
        ["Código", "Cliente", "NIT", "Dirección", "Estado"],
        (crm.clientes || []).map((row) => [
          row.codigo_cliente,
          row.nombre_empresa,
          row.nit,
          row.direccion,
          row.estado,
        ])
      );

      const contactTable = markdownTable(
        ["Cliente", "Contacto", "Correo", "Teléfonos"],
        (crm.contactos || []).map((row) => [
          row.cliente,
          row.contacto,
          row.correo,
          row.telefonos,
        ])
      );

      const quoteTable = markdownTable(
        ["Cotización", "Cliente", "Estado", "Total"],
        (crm.cotizaciones || []).map((row) => [
          row.codigo_cotizacion,
          row.cliente,
          row.estado,
          money(row.total),
        ])
      );

      return `# Consulta CRM GL365\n\n## Clientes encontrados\n${
        customerTable || "Sin coincidencias."
      }\n\n## Contactos\n${
        contactTable || "Sin contactos coincidentes."
      }\n\n## Cotizaciones relacionadas\n${
        quoteTable || "Sin cotizaciones coincidentes."
      }\n\n## Oportunidades\n${
        markdownTable(
          ["Código", "Oportunidad", "Cliente", "Estado", "Monto", "Prob."],
          (crm.oportunidades || []).map((row) => [
            row.codigo_oportunidad,
            row.nombre_oportunidad,
            row.cliente,
            row.estado,
            money(row.monto_estimado),
            `${row.probabilidad}%`,
          ])
        ) || "Sin oportunidades coincidentes."
      }`;
    }
  }

  if (
    ctx.modules.includes("finance") &&
    relevant.finance &&
    (q.includes("cobran") ||
      q.includes("saldo") ||
      q.includes("factur") ||
      q.includes("comprobante") ||
      q.includes("pago"))
  ) {
    const comprobantes = relevant.finance.comprobantes || [];

    return `# Análisis de facturación y cobranza\n\n## Resumen\n- Total facturado: ${money(
      kpis.total_facturado
    )}.\n- Total pagado: ${money(
      kpis.total_pagado
    )}.\n- Saldo por cobrar: ${money(
      kpis.saldo_por_cobrar
    )}.\n- Saldo vencido: ${money(
      kpis.saldo_vencido
    )}.\n\n## Comprobantes relevantes\n${
      markdownTable(
        ["Comprobante", "Cliente", "Estado", "Total", "Pagado", "Saldo"],
        comprobantes.map((row) => [
          row.comprobante,
          row.cliente,
          row.estado,
          money(row.total),
          money(row.pagado),
          money(row.saldo),
        ])
      ) || "Sin comprobantes coincidentes."
    }\n\n## Acción recomendada\n- Priorizar documentos vencidos y saldos de mayor monto.\n- Verificar pagos parciales antes de contactar al cliente.\n- Registrar la próxima gestión de cobro.`;
  }

  if (
    ctx.modules.includes("fleet") &&
    relevant.fleet &&
    (q.includes("flota") ||
      q.includes("vehicul") ||
      q.includes("mantenimiento"))
  ) {
    const vehiculos = relevant.fleet.vehiculos || [];

    return `# Flota GL365\n\n## Resumen\n- Vehículos registrados: ${
      kpis.vehiculos_total
    }.\n- Disponibles: ${
      kpis.flota_disponible
    }.\n- En uso: ${kpis.flota_en_uso}.\n- En mantenimiento: ${
      kpis.flota_mantenimiento
    }.\n\n## Unidades encontradas\n${
      markdownTable(
        ["Vehículo", "Tipo", "Estado", "Eficiencia", "Km", "Mantenimiento"],
        vehiculos.map((row) => [
          row.codigo,
          row.tipo,
          row.estado,
          `${row.eficiencia}%`,
          row.kilometraje,
          row.mantenimiento,
        ])
      ) || "Sin vehículos coincidentes."
    }`;
  }

  if (
    ctx.modules.includes("logistics") &&
    relevant.logistics &&
    (q.includes("viaje") ||
      q.includes("envio") ||
      q.includes("logistica") ||
      q.includes("retras") ||
      q.includes("alerta"))
  ) {
    const viajes = relevant.logistics.viajes || [];
    const alertas = relevant.logistics.alertas || [];

    return `# Atención logística GL365\n\n## Resumen\n- Viajes activos: ${
      kpis.viajes_activos
    }.\n- Alertas activas: ${
      kpis.alertas_activas
    }.\n- Alertas críticas: ${
      kpis.alertas_criticas
    }.\n- Alertas de retraso/demora: ${
      kpis.alertas_retraso
    }.\n\n## Viajes relevantes\n${
      markdownTable(
        ["Viaje", "Cliente", "Ruta", "Estado", "Progreso", "ETA"],
        viajes.map((row) => [
          row.codigo,
          row.cliente,
          row.ruta,
          row.estado_envio,
          `${row.progreso}%`,
          row.eta,
        ])
      ) || "Sin viajes coincidentes."
    }\n\n## Alertas\n${lineList(
      alertas,
      (row) =>
        `- ${row.nivel || "Sin nivel"} · ${row.tipo || "Alerta"}: ${
          row.descripcion || "Sin descripción"
        }${row.viaje ? ` (${row.viaje})` : ""}`
    )}`;
  }

  if (
    ctx.modules.includes("suppliers") &&
    relevant.suppliers
  ) {
    const proveedores = relevant.suppliers.proveedores || [];

    if (q.includes("proveedor") || q.includes("sat") || q.includes("desempen")) {
      return `# Proveedores GL365\n\n${
        markdownTable(
          ["Código", "Proveedor", "Servicio", "SAT", "Desempeño", "Estado"],
          proveedores.map((row) => [
            row.codigo_proveedor,
            row.nombre_comercial || row.razon_social,
            row.servicio,
            row.estado_sat,
            row.desempeno,
            row.estado,
          ])
        ) || "No se encontraron proveedores con ese criterio."
      }\n\n## Recomendación\n- Revisar SAT, RTU y desempeño antes de asignaciones sensibles.\n- Priorizar proveedores con documentación vigente y desempeño estable.`;
    }
  }

  if (ctx.modules.includes("routes") && relevant.routes && q.includes("ruta")) {
    const rutas = relevant.routes.rutas || [];

    return `# Rutas GL365\n\n${
      markdownTable(
        ["Código", "Origen", "Destino", "Km", "Horas", "Costo", "Estado"],
        rutas.map((row) => [
          row.codigo_ruta,
          row.origen,
          row.destino,
          row.distancia_km,
          row.tiempo_horas,
          money(row.costo),
          row.estado,
        ])
      ) || "No se encontraron rutas con ese criterio."
    }`;
  }

  if (
    ctx.modules.includes("operations") &&
    relevant.operations &&
    (q.includes("asignacion") ||
      q.includes("rentabilidad") ||
      q.includes("margen") ||
      q.includes("operacion"))
  ) {
    const asignaciones = relevant.operations.asignaciones || [];
    const margenPct =
      kpis.ingreso_cliente > 0
        ? (kpis.margen_operativo / kpis.ingreso_cliente) * 100
        : 0;

    return `# Operaciones y rentabilidad GL365\n\n## Resumen\n- Ingreso cliente: ${money(
      kpis.ingreso_cliente
    )}.\n- Costo proveedor: ${money(
      kpis.costo_proveedor
    )}.\n- Margen operativo: ${money(
      kpis.margen_operativo
    )}.\n- Margen aproximado: ${margenPct.toFixed(
      1
    )}%.\n\n## Asignaciones relevantes\n${
      markdownTable(
        ["Asignación", "Cliente", "Ruta", "Proveedor", "Estado", "Margen"],
        asignaciones.map((row) => [
          row.codigo_asignacion,
          row.cliente,
          row.ruta,
          row.proveedor,
          row.estado,
          money(row.margen),
        ])
      ) || "Sin asignaciones coincidentes."
    }`;
  }

  return `# Resumen gerencial de GL365\n\n## Situación actual\n- Clientes: ${
    kpis.clientes
  }.\n- Viajes activos: ${
    kpis.viajes_activos
  }.\n- Vehículos disponibles: ${
    kpis.flota_disponible
  }.\n- Saldo por cobrar: ${money(
    kpis.saldo_por_cobrar
  )}.\n- Saldo vencido: ${money(
    kpis.saldo_vencido
  )}.\n- Pipeline ponderado: ${money(
    kpis.pipeline_ponderado
  )}.\n- Margen operativo: ${money(
    kpis.margen_operativo
  )}.\n- Proveedores: ${kpis.proveedores}.\n- Rutas: ${
    kpis.rutas
  }.\n\n## Prioridades\n- Alertas críticas logísticas: ${
    kpis.alertas_criticas
  }.\n- Alertas de retraso/demora: ${
    kpis.alertas_retraso
  }.\n- Vehículos en mantenimiento: ${
    kpis.flota_mantenimiento
  }.\n- Comprobantes vencidos: ${
    kpis.vencidas
  }.\n\n## Acciones recomendadas\n- Atender primero alertas críticas y retrasos.\n- Dar seguimiento a cobranza vencida y pagos parciales.\n- Revisar proveedores con riesgo documental o desempeño bajo.\n- Proteger el margen antes de aprobar nuevas operaciones.`;
};

/* =========================================================
   GROQ
========================================================= */

const buildRentabilidadGroqContext = (ctx) => {
  const kpis = ctx?.data?.kpis || {};
  const asignaciones = Array.isArray(
    ctx?.relevant?.operations?.asignaciones
  )
    ? ctx.relevant.operations.asignaciones
    : [];

  // Tomamos únicamente los campos que realmente sirven para analizar
  // rentabilidad. No enviamos teléfonos, licencias, contactos,
  // mantenimientos, datos documentales, etc.
  const operaciones = asignaciones
    .map((row) => ({
      asignacion: row.codigo_asignacion || "-",
      cliente: row.cliente || "-",
      ruta: row.ruta || "-",
      proveedor: row.proveedor || "-",
      estado: row.estado || "-",
      ingreso_cliente: Number(row.ingreso_cliente || 0),
      costo_proveedor: Number(row.costo_proveedor || 0),
      costo_asignacion: Number(row.costo_asignacion || 0),
      margen: Number(row.margen || 0),
    }))
    .sort((a, b) => b.margen - a.margen);

  const conIngreso = operaciones.filter(
    (row) => row.ingreso_cliente > 0
  );

  const totalIngreso = Number(kpis.ingreso_cliente || 0);
  const totalCosto = Number(kpis.costo_proveedor || 0);
  const margenTotal = Number(kpis.margen_operativo || 0);

  const margenPorcentaje =
    totalIngreso > 0
      ? Number(
          ((margenTotal / totalIngreso) * 100).toFixed(2)
        )
      : 0;

  const rentables = operaciones.filter(
    (row) => row.margen > 0
  ).length;

  const sinMargen = operaciones.filter(
    (row) => row.margen === 0
  ).length;

  const conPerdida = operaciones.filter(
    (row) => row.margen < 0
  ).length;

  const topRentables = operaciones
    .filter((row) => row.margen > 0)
    .slice(0, 6);

  const menorMargen = [...operaciones]
    .sort((a, b) => a.margen - b.margen)
    .slice(0, 6);

  return sanitizeForAI({
    resumen_financiero: {
      ingreso_cliente: totalIngreso,
      costo_proveedor: totalCosto,
      margen_operativo: margenTotal,
      margen_porcentaje: margenPorcentaje,
      asignaciones_analizadas: operaciones.length,
      asignaciones_con_ingreso: conIngreso.length,
      operaciones_rentables: rentables,
      operaciones_sin_margen: sinMargen,
      operaciones_con_perdida: conPerdida,
    },
    operaciones_mas_rentables: topRentables,
    operaciones_menor_margen: menorMargen,
  });
};

const buildRentabilidadPrompt = (
  question,
  ctx,
  verifiedAnswer
) => {
  const compactContext = JSON.stringify(
    buildRentabilidadGroqContext(ctx)
  );

  return [
    {
      role: "system",
      content:
        "Eres GL365 Intelligence, analista de rentabilidad del ERP Grupo Logístico 365. " +
        "Responde en español de Guatemala, claro, profesional y ejecutivo. " +
        "Usa únicamente las cifras reales de MySQL entregadas. " +
        "No inventes ingresos, costos, márgenes, clientes, proveedores o rutas. " +
        "No confundas facturación general con ingreso de una asignación. " +
        "Cuando muestres operaciones usa una tabla Markdown compacta de máximo 6 filas.",
    },
    {
      role: "user",
      content:
        `Pregunta del usuario:\n${String(
          question || ""
        ).slice(0, 1000)}\n\n` +
        `Resumen local verificado:\n${String(
          verifiedAnswer || ""
        ).slice(0, 2400)}\n\n` +
        `Contexto compacto de rentabilidad:\n${compactContext}\n\n` +
        "Entrega la respuesta con estas secciones: " +
        "Resumen ejecutivo, Indicadores de rentabilidad, " +
        "Operaciones destacadas, Riesgos/Prioridades y Acciones recomendadas. " +
        "Mantén las cifras exactas y evita texto innecesario.",
    },
  ];
};

const buildGroqContext = (ctx) => {
  const safe = sanitizeForAI({
    resumen: ctx.data.summary,
    kpis: ctx.data.kpis,
    modulos_consultados: ctx.modules,
    terminos_busqueda: ctx.terms,
    informacion_relevante: ctx.relevant,
  });

  const serialized = JSON.stringify(safe);

  return serialized.length > MAX_GROQ_CONTEXT_CHARS
    ? serialized.slice(0, MAX_GROQ_CONTEXT_CHARS)
    : serialized;
};

const buildGroqPrompt = (question, ctx, verifiedAnswer) => {
  if (isRentabilidadQuestion(question)) {
    return buildRentabilidadPrompt(
      question,
      ctx,
      verifiedAnswer
    );
  }

  const contextText = buildGroqContext(ctx);

  return [
    {
      role: "system",
      content:
        "Eres GL365 Intelligence, el asistente gerencial del ERP Grupo Logístico 365. " +
        "Responde en español de Guatemala, claro, profesional y accionable. " +
        "Utiliza únicamente la información real de MySQL entregada en el contexto. " +
        "No inventes registros, fechas, estados, montos, nombres, teléfonos ni direcciones. " +
        "Si no hay coincidencias suficientes, dilo claramente. " +
        "Cuando compares registros usa una tabla Markdown de pocas columnas. " +
        "Para análisis usa secciones y viñetas. " +
        "Nunca pidas ni reveles contraseñas, hashes, tokens o credenciales.",
    },
    {
      role: "user",
      content:
        `Pregunta del usuario:\n${String(question || "").slice(
          0,
          MAX_QUESTION_CHARS
        )}\n\n` +
        `Borrador local verificado con MySQL:\n${verifiedAnswer.slice(
          0,
          5000
        )}\n\n` +
        `Contexto real relevante de MySQL:\n${contextText}\n\n` +
        "Redacta la mejor respuesta posible. Conserva las cifras exactas del contexto. " +
        "Si la pregunta pide un dato puntual, responde primero ese dato y luego agrega contexto breve. " +
        "Si pide informe, usa: Resumen ejecutivo, Hallazgos, Riesgos/Prioridades, Acciones recomendadas y Conclusión.",
    },
  ];
};

const askGroq = async (question, ctx) => {
  const verifiedAnswer = buildLocalAnswer(question, ctx);

  if (!process.env.GROQ_API_KEY) {
    return {
      provider: {
        name: "local",
        used: false,
        groqConfigured: false,
        model: ctx.model,
        warning:
          "Groq no está configurado. Se usó análisis local verificado.",
      },
      answer: verifiedAnswer,
    };
  }

  const messages = buildGroqPrompt(
    question,
    ctx,
    verifiedAnswer
  );

  let lastError = null;

  for (const model of GROQ_FALLBACK_MODELS) {
    try {
      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.1,
            // Rentabilidad usa un contexto mucho más compacto,
            // por eso también reservamos menos tokens de salida.
            // Las demás consultas mantienen el comportamiento anterior.
            max_tokens: isRentabilidadQuestion(question)
              ? 850
              : 1500,
          }),
        }
      );

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        lastError =
          payload?.error?.message ||
          `Groq respondió ${response.status}`;

        console.error("Error Groq IA:", payload);
        continue;
      }

      const answer = String(
        payload?.choices?.[0]?.message?.content || ""
      ).trim();

      return {
        provider: {
          name: "groq",
          used: true,
          groqConfigured: true,
          model,
          warning: null,
        },
        answer: answer || verifiedAnswer,
      };
    } catch (error) {
      lastError = error?.message || "Error conectando con Groq";
      console.error("Error Groq IA:", error);
    }
  }

  return {
    provider: {
      name: "local",
      used: false,
      groqConfigured: true,
      model: ctx.model,
      warning: isRentabilidadQuestion(question)
        ? "Groq alcanzó temporalmente su límite al analizar rentabilidad. Se mostró el análisis local verificado con datos reales de MySQL."
        : lastError
        ? `Groq no respondió correctamente: ${lastError}. Se usó análisis local verificado.`
        : "Groq no respondió correctamente. Se usó análisis local verificado.",
    },
    answer: verifiedAnswer,
  };
};

/* =========================================================
   ENDPOINTS
========================================================= */

router.get("/bootstrap", async (_req, res) => {
  try {
    const ctx = await getContextoCompacto();

    return res.json({
      ok: true,
      groqConfigured: ctx.groqConfigured,
      model: ctx.model,
      provider: {
        name: ctx.groqConfigured ? "groq" : "local",
        used: false,
        groqConfigured: ctx.groqConfigured,
        model: ctx.model,
      },
      capabilities: [
        "CRM: clientes, contactos, oportunidades y cotizaciones",
        "Facturación: comprobantes, detalles, pagos y saldos",
        "Operaciones: asignaciones, costos, pilotos y proveedores",
        "Logística: viajes, envíos, tracking y alertas",
        "Flota: vehículos y mantenimientos",
        "Proveedores: cumplimiento, SAT y desempeño",
        "Rutas: ubicaciones, distancias, tiempos y costos",
        "Usuarios y roles sin datos sensibles",
      ],
      data: ctx.data,
      summary: ctx.data.summary,
      diagnostics: ctx.diagnostics,
    });
  } catch (error) {
    console.error("Error GET /bootstrap:", error);

    return res.status(500).json({
      ok: false,
      message: "No se pudo cargar el contexto de GL365 Intelligence.",
      error: error?.message || "Error desconocido",
    });
  }
});

const handleQuestion = async (req, res) => {
  const rawQuestion = String(
    req.body?.question ||
      req.body?.pregunta ||
      req.body?.message ||
      ""
  )
    .trim()
    .slice(0, MAX_QUESTION_CHARS);

  const question = normalizeIncomingQuestion(rawQuestion);

  if (!question) {
    return res.status(400).json({
      ok: false,
      message: "Escribí una pregunta para la IA.",
    });
  }

  try {
    const ctx = await getRelevantContext(question);
    const result = await askGroq(question, ctx);

    return res.json({
      ok: true,
      provider: result.provider,
      model: result.provider.model || ctx.model,
      answer: result.answer,
      warning: result.provider.warning || null,
      summary: ctx.data.summary,
      data: ctx.data,
      contextUsed: {
        modules: ctx.modules,
        searchTerms: ctx.terms,
      },
      diagnostics: ctx.diagnostics,
    });
  } catch (error) {
    console.error("Error POST /chat:", error);

    return res.status(500).json({
      ok: false,
      message: "No se pudo procesar la consulta de IA.",
      error: error?.message || "Error desconocido",
    });
  }
};

router.post("/ask", handleQuestion);
router.post("/chat", handleQuestion);

module.exports = router;