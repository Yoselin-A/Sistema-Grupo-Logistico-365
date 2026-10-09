const hasModule = (auth, module) => Boolean(auth && (
  ["gerencia", "administrador"].includes(auth.role) ||
  (Array.isArray(auth.permissions) && auth.permissions.includes(module))
));

const AI_MODULES = {
  crm: "crm", finance: "facturacion", operations: "operaciones",
  logistics: "logistica", fleet: "flota", suppliers: "proveedores",
  routes: "rutas", users: "seguridad",
};

const KPI_MODULES = {
  crm: ["clientes", "cotizaciones", "oportunidades", "pipeline_total", "pipeline_ponderado"],
  facturacion: ["comprobantes", "total_facturado", "total_pagado", "saldo_por_cobrar", "saldo_vencido", "vencidas", "pendientes", "parciales", "pagadas"],
  operaciones: ["asignaciones", "ingreso_cliente", "costo_proveedor", "margen_operativo"],
  logistica: ["envios", "viajes_total", "viajes_activos", "viajes_finalizados", "alertas_activas", "alertas_retraso", "alertas_criticas", "viajes_entregados", "viajes_en_ruta", "alertas"],
  flota: ["vehiculos_total", "flota_disponible", "flota_en_uso", "flota_mantenimiento"],
  proveedores: ["proveedores"], rutas: ["rutas"], seguridad: ["usuarios"],
};
const SUMMARY_MODULES = {
  crm: ["clientes", "cotizaciones", "oportunidadesActivas", "pipelinePonderado"],
  facturacion: ["comprobantes", "saldoPorCobrar", "saldoVencido"],
  operaciones: ["asignaciones", "margenOperativo"],
  logistica: ["envios", "viajesTotal", "viajesActivos", "viajesRetraso", "viajesCriticos"],
  flota: ["vehiculos", "vehiculosDisponibles", "vehiculosMantenimiento"],
  proveedores: ["proveedores", "proveedoresRiesgo"], rutas: ["rutas"], seguridad: ["usuarios"],
};
const DATA_MODULES = {
  crm: ["crm", "commercial"], facturacion: ["finance", "cobranzaPendiente"],
  logistica: ["logistics", "topViajes", "alertas", "alertasRetraso"],
  flota: ["fleet", "flotaAtencion"], proveedores: ["suppliers", "proveedoresRiesgo"],
  rutas: ["routes", "rutasTop"],
};

// Reconstruye la respuesta con una lista permitida; nunca devuelve datos ocultos.
function scopeAiContext(ctx, auth) {
  const data = { kpis: {}, summary: { generatedAt: ctx.data.summary.generatedAt } };
  for (const [module, keys] of Object.entries(KPI_MODULES)) {
    if (hasModule(auth, module)) for (const key of keys) {
      if (key in ctx.data.kpis) data.kpis[key] = ctx.data.kpis[key];
    }
  }
  for (const [module, keys] of Object.entries(SUMMARY_MODULES)) {
    if (hasModule(auth, module)) for (const key of keys) {
      if (key in ctx.data.summary) data.summary[key] = ctx.data.summary[key];
    }
  }
  for (const [module, keys] of Object.entries(DATA_MODULES)) {
    if (hasModule(auth, module)) for (const key of keys) data[key] = ctx.data[key];
  }
  const modules = Object.keys(AI_MODULES).filter(key => hasModule(auth, AI_MODULES[key]));
  return { ...ctx, data, allowedModules: modules, restricted: modules.length < Object.keys(AI_MODULES).length,
    diagnostics: { counts: data.kpis, errors: [] } };
}

module.exports = { hasModule, AI_MODULES, scopeAiContext };
