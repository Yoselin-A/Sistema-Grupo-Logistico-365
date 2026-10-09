// Consultas deterministas de los botones. Sus instrucciones no son nombres
// de clientes ni filtros SQL. Todas las consultas siguen los permisos del rol.
const presets = {
  "Información del sistema": { modules: null, question: "Información del sistema" },
  "Informe PRO": { modules: null, question: "Informe ejecutivo" },
  "Plan de acción": { modules: null, question: "Plan de acción" },
  "Resumen gerencial": { modules: null, question: "Resumen gerencial" },
  "Riesgos de hoy": { modules: null, question: "Qué requiere atención hoy" },
  "Viajes con retraso": { modules: ["logistics"], question: "Viajes con retraso", filter: "delay" },
  "Viajes críticos": { modules: ["logistics"], question: "Viajes críticos", filter: "critical" },
  "Flota disponible": { modules: ["fleet"], question: "Vehículos disponibles", filter: "available" },
  "Mantenimiento": { modules: ["fleet"], question: "Vehículos requieren mantenimiento", filter: "maintenance" },
  "Cobranza": { modules: ["finance"], question: "Cobranza y saldos vencidos", filter: "balance" },
  "Rentabilidad": { modules: ["operations"], question: "Rentabilidad de operaciones" },
  "Pipeline comercial": { modules: ["crm"], question: "Oportunidades comerciales" },
  "Proveedores": { modules: ["suppliers"], question: "Proveedores requieren revisión" },
  "Clientes": { modules: ["crm"], question: "Clientes registrados" },
  "Cotizaciones": { modules: ["crm"], question: "Cotizaciones registradas" },
  "Oportunidades": { modules: ["crm"], question: "Oportunidades comerciales activas" },
  "Servicios de transporte": { modules: ["logistics"], question: "Servicios de transporte" },
  "Rutas": { modules: ["routes"], question: "Rutas registradas" },
  "Facturación vencida": { modules: ["finance"], question: "Facturación vencida", filter: "overdue" },
  "Costos operativos": { modules: ["operations"], question: "Costos operativos de las operaciones" },
  "Márgenes bajos": { modules: ["operations"], question: "Operaciones con margen bajo o negativo", filter: "margin" },
  "Operaciones finalizadas": { modules: ["operations"], question: "Operaciones finalizadas", filter: "finished" },
  "Usuarios": { modules: ["users"], question: "Usuarios y roles registrados" },
  "Estado SAT": { modules: ["suppliers"], question: "Estado SAT de proveedores" },
};
module.exports = { presets };
