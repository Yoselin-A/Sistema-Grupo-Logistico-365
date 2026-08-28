const express = require("express");
const pool = require("../config/db");

const router = express.Router();

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
].filter((model, index, arr) => Boolean(model) && arr.indexOf(model) === index);

const safeQuery = async (label, sql, params = []) => {
  try {
    const [rows] = await pool.query(sql, params);
    return { rows, error: null };
  } catch (error) {
    const message = error?.sqlMessage || error?.message || "Error desconocido";
    console.error(`Error IA Logistica · ${label}:`, message);
    return { rows: [], error: { tabla: label, error: message } };
  }
};

const scalar = (rows, key, fallback = 0) => Number(rows?.[0]?.[key] ?? fallback);
const makePlaceholders = (total) => Array.from({ length: Number(total || 0) }, (_, index) => ({ id: index + 1 }));

const clean = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const hasDelayText = (row) => {
  const text = clean(`${row.tipo || ""} ${row.descripcion || ""} ${row.nivel || ""}`);
  return (
    text.includes("retras") ||
    text.includes("demora") ||
    text.includes("tarde") ||
    text.includes("espera") ||
    text.includes("cierre parcial")
  );
};

const getContextoCompacto = async () => {
  const results = await Promise.all([
    safeQuery("kpi_general", `
      SELECT
        (SELECT COUNT(*) FROM cliente) AS clientes,
        (SELECT COUNT(*) FROM ruta) AS rutas,
        (SELECT COUNT(*) FROM vehiculo) AS vehiculos,
        (SELECT COUNT(*) FROM proveedor) AS proveedores,
        (SELECT COUNT(*) FROM comprobante) AS comprobantes,
        (SELECT COUNT(*) FROM oportunidad) AS oportunidades,
        (SELECT COUNT(*) FROM cotizacion) AS cotizaciones,
        (SELECT COUNT(*) FROM asignacion) AS asignaciones,
        (SELECT COUNT(*) FROM viaje) AS viajes
    `),

    safeQuery("kpi_logistica", `
      SELECT
        (SELECT COUNT(*) FROM viaje) AS total_viajes,
        (SELECT COUNT(*) FROM viaje WHERE COALESCE(progreso, 0) > 0 AND COALESCE(progreso, 0) < 100) AS viajes_activos,
        (SELECT COUNT(*) FROM viaje WHERE COALESCE(progreso, 0) >= 100) AS viajes_finalizados,
        (SELECT COUNT(*) FROM alerta WHERE COALESCE(leida, 0) = 0) AS alertas_activas,
        (SELECT COUNT(*) FROM alerta WHERE COALESCE(leida, 0) = 0 AND LOWER(COALESCE(nivel, '')) LIKE '%crit%') AS alertas_criticas,
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
    `),

    safeQuery("kpi_flota", `
      SELECT
        COUNT(*) AS total_vehiculos,
        SUM(CASE WHEN ev.nombre_estado_vehiculo = 'Disponible' THEN 1 ELSE 0 END) AS disponibles,
        SUM(CASE WHEN ev.nombre_estado_vehiculo IN ('Asignado', 'En ruta') THEN 1 ELSE 0 END) AS en_uso,
        SUM(CASE WHEN ev.nombre_estado_vehiculo = 'Mantenimiento' THEN 1 ELSE 0 END) AS mantenimiento
      FROM vehiculo v
      LEFT JOIN estado_vehiculo ev ON ev.id = v.estado_id
    `),

    safeQuery("kpi_cobranza", `
      SELECT
        COUNT(c.id) AS comprobantes,
        SUM(COALESCE(c.total, 0)) AS total_facturado,
        SUM(COALESCE(p.pagado, 0)) AS total_pagado,
        SUM(COALESCE(c.total, 0) - COALESCE(p.pagado, 0)) AS saldo_por_cobrar,
        SUM(CASE WHEN ef.nombre_estado_factura = 'Vencida' THEN COALESCE(c.total, 0) - COALESCE(p.pagado, 0) ELSE 0 END) AS saldo_vencido,
        SUM(CASE WHEN ef.nombre_estado_factura = 'Vencida' THEN 1 ELSE 0 END) AS vencidas,
        SUM(CASE WHEN ef.nombre_estado_factura = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN ef.nombre_estado_factura = 'Parcial' THEN 1 ELSE 0 END) AS parciales,
        SUM(CASE WHEN ef.nombre_estado_factura = 'Pagada' THEN 1 ELSE 0 END) AS pagadas
      FROM comprobante c
      LEFT JOIN estado_factura ef ON ef.id = c.estado_id
      LEFT JOIN (
        SELECT comprobante_id, SUM(monto) AS pagado
        FROM pago
        GROUP BY comprobante_id
      ) p ON p.comprobante_id = c.id
    `),

    safeQuery("kpi_rentabilidad", `
      SELECT
        COUNT(a.id) AS asignaciones,
        SUM(COALESCE(fa.valor, 0)) AS ingreso_cliente,
        SUM(COALESCE(pa.total, 0)) AS costo_proveedor,
        SUM(COALESCE(fa.valor, 0) - COALESCE(pa.total, 0)) AS margen_operativo
      FROM asignacion a
      LEFT JOIN factura_asignacion fa ON fa.asignacion_id = a.id
      LEFT JOIN proveedor_asignacion pa ON pa.asignacion_id = a.id
    `),

    safeQuery("kpi_comercial", `
      SELECT
        COUNT(*) AS oportunidades,
        SUM(COALESCE(monto_estimado, 0)) AS pipeline_total,
        SUM(COALESCE(monto_estimado, 0) * COALESCE(probabilidad, 0) / 100) AS pipeline_ponderado
      FROM oportunidad
    `),

    safeQuery("top_viajes", `
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
      WHERE COALESCE(v.progreso, 0) < 100
      ORDER BY v.id DESC
      LIMIT 10
    `),

    safeQuery("alertas", `
      SELECT
        al.id,
        al.viaje_id,
        al.tipo,
        al.descripcion,
        al.nivel,
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
      LIMIT 10
    `),

    safeQuery("cobranza_pendiente", `
      SELECT
        c.id,
        CONCAT(c.serie, '-', c.numero_comprobante) AS comprobante,
        cl.nombre_empresa AS cliente,
        ef.nombre_estado_factura AS estado,
        DATE_FORMAT(c.fecha_vencimiento, '%Y-%m-%d') AS vencimiento,
        COALESCE(c.total, 0) AS total,
        COALESCE(p.pagado, 0) AS pagado,
        COALESCE(c.total, 0) - COALESCE(p.pagado, 0) AS saldo
      FROM comprobante c
      LEFT JOIN cliente cl ON cl.id = c.cliente_id
      LEFT JOIN estado_factura ef ON ef.id = c.estado_id
      LEFT JOIN (
        SELECT comprobante_id, SUM(monto) AS pagado
        FROM pago
        GROUP BY comprobante_id
      ) p ON p.comprobante_id = c.id
      WHERE COALESCE(c.total, 0) - COALESCE(p.pagado, 0) > 0
      ORDER BY
        CASE WHEN ef.nombre_estado_factura = 'Vencida' THEN 1 ELSE 2 END,
        saldo DESC
      LIMIT 10
    `),

    safeQuery("proveedores_riesgo", `
      SELECT
        p.id,
        p.codigo_proveedor,
        COALESCE(p.nombre_comercial, p.razon_social) AS proveedor,
        cp.estado_sat,
        dp.nivel,
        dp.hallazgos
      FROM proveedor p
      LEFT JOIN cumplimiento_proveedor cp ON cp.proveedor_id = p.id
      LEFT JOIN desempeno_proveedor dp ON dp.proveedor_id = p.id
      WHERE LOWER(COALESCE(cp.estado_sat, '')) LIKE '%no%'
         OR LOWER(COALESCE(dp.nivel, '')) IN ('rojo', 'amarillo')
      ORDER BY
        CASE
          WHEN LOWER(COALESCE(dp.nivel, '')) = 'rojo' THEN 1
          WHEN LOWER(COALESCE(cp.estado_sat, '')) LIKE '%no%' THEN 2
          WHEN LOWER(COALESCE(dp.nivel, '')) = 'amarillo' THEN 3
          ELSE 4
        END
      LIMIT 10
    `),

    safeQuery("flota_atencion", `
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
      LEFT JOIN estado_mantenimiento em ON em.id = v.estado_mantenimiento_id
      WHERE ev.nombre_estado_vehiculo = 'Mantenimiento'
         OR em.nombre_estado_mantenimiento <> 'Al día'
         OR COALESCE(v.eficiencia, 100) < 80
      ORDER BY v.eficiencia ASC
      LIMIT 10
    `),

    safeQuery("rutas_top", `
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
      LIMIT 10
    `),
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
  ] = results;

  const errors = results.map((result) => result.error).filter(Boolean);

  const general = kpiGeneral.rows[0] || {};
  const delayAlerts = alertas.rows.filter(hasDelayText);

  const kpis = {
    viajes_total: scalar(kpiLogistica.rows, "total_viajes"),
    viajes_activos: scalar(kpiLogistica.rows, "viajes_activos"),
    viajes_finalizados: scalar(kpiLogistica.rows, "viajes_finalizados"),
    alertas_activas: scalar(kpiLogistica.rows, "alertas_activas"),
    alertas_criticas: scalar(kpiLogistica.rows, "alertas_criticas"),
    alertas_retraso: Math.max(scalar(kpiLogistica.rows, "alertas_retraso"), delayAlerts.length),

    vehiculos_total: scalar(kpiFlota.rows, "total_vehiculos"),
    flota_disponible: scalar(kpiFlota.rows, "disponibles"),
    flota_en_uso: scalar(kpiFlota.rows, "en_uso"),
    flota_mantenimiento: scalar(kpiFlota.rows, "mantenimiento"),

    comprobantes: scalar(kpiCobranza.rows, "comprobantes"),
    total_facturado: scalar(kpiCobranza.rows, "total_facturado"),
    total_pagado: scalar(kpiCobranza.rows, "total_pagado"),
    saldo_por_cobrar: scalar(kpiCobranza.rows, "saldo_por_cobrar"),
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
    pipeline_ponderado: scalar(kpiComercial.rows, "pipeline_ponderado"),

    clientes: Number(general.clientes || 0),
    rutas: Number(general.rutas || 0),
    proveedores: Number(general.proveedores || 0),
    cotizaciones: Number(general.cotizaciones || 0),
  };

  const summary = {
    generatedAt: new Date().toISOString(),

    viajesTotal: kpis.viajes_total,
    viajesActivos: kpis.viajes_activos,
    viajesRetraso: kpis.alertas_retraso,
    viajesCriticos: kpis.alertas_criticas,

    vehiculosDisponibles: kpis.flota_disponible,
    vehiculosMantenimiento: kpis.flota_mantenimiento || flotaAtencion.rows.length,

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
      vehiculos: makePlaceholders(kpis.vehiculos_total),
      atencion: flotaAtencion.rows,
    },
    finance: {
      comprobantes: makePlaceholders(kpis.comprobantes),
      operaciones: cobranzaPendiente.rows,
    },
    commercial: {
      oportunidades: makePlaceholders(kpis.oportunidades),
    },
    suppliers: {
      proveedores: makePlaceholders(kpis.proveedores),
      riesgo: proveedoresRiesgo.rows,
    },
    routes: {
      rutas: makePlaceholders(kpis.rutas),
      top: rutasTop.rows,
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
        vehiculos: kpis.vehiculos_total,
        comprobantes: kpis.comprobantes,
        oportunidades: kpis.oportunidades,
        proveedores: kpis.proveedores,
        rutas: kpis.rutas,
        clientes: kpis.clientes,
      },
    },
  };
};

const lineList = (rows, mapper, empty = "Sin registros relevantes.") => {
  const lines = rows.slice(0, 6).map(mapper).filter(Boolean);
  return lines.length ? lines.join("\n") : empty;
};

const buildVerifiedAnswer = (question, ctx) => {
  const q = clean(question);
  const { kpis } = ctx.data;
  const cobranzaPendiente = ctx.data.cobranzaPendiente || [];
  const topViajes = ctx.data.topViajes || [];
  const alertas = ctx.data.alertas || [];
  const alertasRetraso = ctx.data.alertasRetraso || [];
  const proveedoresRiesgo = ctx.data.proveedoresRiesgo || [];
  const flotaAtencion = ctx.data.flotaAtencion || [];
  const rutasTop = ctx.data.rutasTop || [];

  if (q.includes("cobranza") || q.includes("clientes") || q.includes("cobrar") || q.includes("saldo")) {
    const vencidos = cobranzaPendiente.filter((row) => clean(row.estado).includes("vencida"));
    const parciales = cobranzaPendiente.filter((row) => clean(row.estado).includes("parcial"));
    const pendientes = cobranzaPendiente.filter((row) => clean(row.estado).includes("pendiente"));

    return `Análisis de cobranza GL365

Resumen
• Saldo por cobrar: ${money(kpis.saldo_por_cobrar)}.
• Saldo vencido oficial: ${money(kpis.saldo_vencido)}.
• Estados: ${kpis.pagadas} pagados, ${kpis.pendientes} pendientes, ${kpis.parciales} parciales y ${kpis.vencidas} vencidos.

Clientes/documentos que necesitan seguimiento
${lineList(cobranzaPendiente, (row) => `• ${row.comprobante} · ${row.cliente}: saldo ${money(row.saldo)} (${row.estado}, vence ${row.vencimiento || "sin fecha"})`)}

Lectura gerencial
• Prioridad 1: ${vencidos.length} documento(s) vencido(s), porque ya representan mora oficial.
• Prioridad 2: ${parciales.length} documento(s) parcial(es), porque tienen abono pero saldo abierto.
• Prioridad 3: ${pendientes.length} documento(s) pendiente(s), para evitar que pasen a vencidos.

Acciones recomendadas
• Contactar primero al cliente con saldo vencido mayor.
• Registrar compromiso de pago o próximo seguimiento.
• Validar que los pagos parciales queden aplicados para no duplicar gestiones.`;
  }

  if (q.includes("proveedor")) {
    return `Análisis de proveedores GL365

Resumen
• Proveedores registrados: ${kpis.proveedores}.
• Proveedores con revisión sugerida: ${proveedoresRiesgo.length}.

Proveedores a revisar
${lineList(proveedoresRiesgo, (row) => `• ${row.codigo_proveedor} · ${row.proveedor}: SAT ${row.estado_sat || "sin dato"}, desempeño ${row.nivel || "sin dato"}`)}

Lectura gerencial
• Los proveedores con SAT no vigente o desempeño amarillo/rojo deben revisarse antes de asignaciones críticas.
• Esta revisión ayuda a reducir riesgo operativo, documental y de cumplimiento.

Acciones recomendadas
• Solicitar actualización de SAT/RTU cuando aplique.
• Priorizar proveedores con mejor desempeño en rutas sensibles.
• Dejar observación en expediente del proveedor cuando se detecte incumplimiento.`;
  }

  if (q.includes("flota") || q.includes("vehiculo") || q.includes("vehículo") || q.includes("mantenimiento")) {
    return `Análisis de flota GL365

Resumen
• Vehículos registrados: ${kpis.vehiculos_total}.
• Disponibles: ${kpis.flota_disponible}.
• En uso: ${kpis.flota_en_uso}.
• En mantenimiento: ${kpis.flota_mantenimiento}.

Unidades con atención
${lineList(flotaAtencion, (row) => `• ${row.codigo} · ${row.tipo || "sin tipo"}: ${row.estado || "sin estado"}, mantenimiento ${row.mantenimiento || "sin dato"}, eficiencia ${row.eficiencia}%`)}

Lectura gerencial
• La disponibilidad actual permite operar, pero las unidades con mantenimiento o eficiencia baja deben reservarse solo si no hay alternativa.
• Una unidad en mantenimiento puede afectar asignaciones próximas si no se planifica sustitución.

Acciones recomendadas
• Revisar próximas asignaciones contra vehículos disponibles.
• Programar mantenimiento preventivo antes de rutas largas.
• No asignar vehículos con eficiencia baja a viajes críticos.`;
  }

  if (q.includes("ruta")) {
    return `Análisis de rutas GL365

Resumen
• Rutas registradas: ${kpis.rutas}.
• Viajes activos relacionados a operación logística: ${kpis.viajes_activos}.

Rutas de mayor distancia/costo
${lineList(rutasTop, (row) => `• ${row.codigo_ruta} · ${row.origen || "origen"} → ${row.destino || "destino"}: ${row.km} km, ${row.horas} horas, costo ${money(row.costo)}`)}

Lectura gerencial
• Las rutas de mayor distancia requieren mayor control de ETA, combustible, proveedor y comunicación con cliente.
• Conviene revisar costos para detectar si el margen operativo se mantiene rentable.

Acciones recomendadas
• Validar tiempos estimados antes de confirmar servicio.
• Revisar costo real vs. tarifa al cliente.
• Priorizar seguimiento en rutas internacionales o de mayor kilometraje.`;
  }

  if (q.includes("viaje") || q.includes("logistica") || q.includes("logística") || q.includes("atencion") || q.includes("atención") || q.includes("retraso") || q.includes("critico") || q.includes("crítico")) {
    const useDelay = q.includes("retraso") || q.includes("demora");
    const selectedAlerts = useDelay ? alertasRetraso : alertas;

    return `Atención logística GL365

Resumen
• Viajes activos: ${kpis.viajes_activos}.
• Alertas activas: ${kpis.alertas_activas}.
• Alertas críticas: ${kpis.alertas_criticas}.
• Alertas relacionadas con retraso/demora: ${kpis.alertas_retraso}.

Viajes a revisar
${lineList(topViajes, (row) => `• ${row.codigo} · ${row.cliente}: ${row.ruta}, estado ${row.estado || "sin estado"}, progreso ${row.progreso}%`)}

Alertas relevantes
${lineList(selectedAlerts, (row) => `• ${row.nivel || "Sin nivel"} · ${row.tipo}: ${row.descripcion}${row.viaje_codigo ? ` (${row.viaje_codigo})` : ""}`)}

Lectura gerencial
• No todos los viajes activos son necesariamente retrasos; los retrasos se identifican por alertas de demora, espera, cierre parcial o incidencias.
• El seguimiento debe enfocarse primero en alerta crítica y luego en alertas de demora.

Acciones recomendadas
• Actualizar ETA de los viajes con progreso abierto.
• Confirmar con proveedor/piloto el estado real del servicio.
• Comunicar al cliente cualquier cambio de horario o incidencia.`;
  }

  if (q.includes("rentabilidad") || q.includes("margen") || q.includes("utilidad")) {
    const margenPct = kpis.ingreso_cliente > 0 ? (kpis.margen_operativo / kpis.ingreso_cliente) * 100 : 0;

    return `Análisis de rentabilidad GL365

Resumen
• Ingreso facturado a cliente en asignaciones: ${money(kpis.ingreso_cliente)}.
• Costo proveedor registrado: ${money(kpis.costo_proveedor)}.
• Margen operativo: ${money(kpis.margen_operativo)}.
• Margen porcentual aproximado: ${margenPct.toFixed(1)}%.

Lectura gerencial
• La operación mantiene margen positivo, pero debe revisarse por ruta/proveedor para evitar servicios con baja rentabilidad.
• El margen depende de que factura de cliente y costo de proveedor estén correctamente registrados.

Acciones recomendadas
• Revisar asignaciones con margen bajo o negativo.
• Validar que todas las facturas de proveedor estén completas.
• Comparar rutas frecuentes contra tarifa cliente para ajustar precios cuando sea necesario.`;
  }

  return `Resumen gerencial de GL365

Situación actual
• Viajes activos: ${kpis.viajes_activos}.
• Vehículos disponibles: ${kpis.flota_disponible}.
• Saldo por cobrar: ${money(kpis.saldo_por_cobrar)}.
• Pipeline ponderado: ${money(kpis.pipeline_ponderado)}.
• Margen operativo: ${money(kpis.margen_operativo)}.

Hallazgos
• Logística: ${kpis.alertas_criticas} alerta(s) crítica(s) y ${kpis.alertas_retraso} alerta(s) relacionadas con retraso/demora.
• Cobranza: ${money(kpis.saldo_vencido)} vencido oficialmente por estado de factura.
• Proveedores: ${proveedoresRiesgo.length} proveedor(es) requieren revisión de cumplimiento o desempeño.
• Flota: ${flotaAtencion.length} unidad(es) requieren atención.
• Comercial: pipeline ponderado de ${money(kpis.pipeline_ponderado)} en ${kpis.oportunidades} oportunidad(es).

Acciones recomendadas
• Atender primero la alerta crítica logística.
• Dar seguimiento al saldo vencido y documentos parciales.
• Revisar proveedores con SAT no vigente o desempeño amarillo/rojo.
• Mantener disponibilidad de flota para viajes activos y rutas largas.`;
};

const buildGroqPrompt = (question, ctx, verifiedAnswer) => {
  const compactContext = {
    kpis: ctx.data.kpis,
    viajes_prioritarios: ctx.data.topViajes.slice(0, 6),
    alertas: ctx.data.alertas.slice(0, 6),
    alertas_retraso: ctx.data.alertasRetraso.slice(0, 6),
    cobranza_pendiente: ctx.data.cobranzaPendiente.slice(0, 6),
    proveedores_riesgo: ctx.data.proveedoresRiesgo.slice(0, 6),
    flota_atencion: ctx.data.flotaAtencion.slice(0, 6),
  };

  return [
    {
      role: "system",
      content:
        "Eres el asistente gerencial de GL365 ERP. Responde en español claro, profesional y accionable. Usa únicamente los datos entregados. No inventes. No digas que falta información si el borrador verificado ya trae datos. No uses negritas con asteriscos.",
    },
    {
      role: "user",
      content:
        `Pregunta: ${String(question || "").slice(0, 500)}\n\n` +
        `Borrador verificado con datos reales de MySQL, no cambies las cifras:\n${verifiedAnswer.slice(0, 2800)}\n\n` +
        `Contexto compacto adicional:\n${JSON.stringify(compactContext).slice(0, 3000)}\n\n` +
        "Mejorá la redacción como informe ejecutivo breve. Conservá cifras y acciones.",
    },
  ];
};

const askGroq = async (question, ctx) => {
  const verifiedAnswer = buildVerifiedAnswer(question, ctx);

  if (!process.env.GROQ_API_KEY) {
    return {
      provider: {
        name: "local",
        used: false,
        groqConfigured: false,
        model: ctx.model,
        warning: "Groq no está configurado. Se usó análisis local verificado.",
      },
      answer: verifiedAnswer,
    };
  }

  const messages = buildGroqPrompt(question, ctx, verifiedAnswer);
  let lastError = null;

  for (const model of GROQ_FALLBACK_MODELS) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.15,
          max_tokens: 700,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        lastError = payload?.error?.message || `Groq respondió ${response.status}`;
        console.error("Error Groq IA:", payload);
        continue;
      }

      const answer = String(payload?.choices?.[0]?.message?.content || "").trim();

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
      lastError = error.message;
      console.error("Error Groq IA:", error);
    }
  }

  return {
    provider: {
      name: "local",
      used: false,
      groqConfigured: true,
      model: ctx.model,
      warning: lastError
        ? `Groq no respondió correctamente: ${lastError}. Se usó análisis local verificado.`
        : "Groq no respondió correctamente. Se usó análisis local verificado.",
    },
    answer: verifiedAnswer,
  };
};

router.get("/bootstrap", async (_req, res) => {
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
    data: ctx.data,
    summary: ctx.data.summary,
    diagnostics: ctx.diagnostics,
  });
});

const handleQuestion = async (req, res) => {
  const question = String(req.body?.question || req.body?.pregunta || req.body?.message || "").trim();

  if (!question) {
    return res.status(400).json({
      ok: false,
      message: "Escribí una pregunta para la IA.",
    });
  }

  const ctx = await getContextoCompacto();
  const result = await askGroq(question, ctx);

  return res.json({
    ok: true,
    provider: result.provider,
    model: result.provider.model || ctx.model,
    answer: result.answer,
    warning: result.provider.warning || null,
    data: ctx.data,
    summary: ctx.data.summary,
    diagnostics: ctx.diagnostics,
  });
};

router.post("/ask", handleQuestion);
router.post("/chat", handleQuestion);

module.exports = router;