const express = require("express");
const cors = require("cors");
require("dotenv").config();

const {
  autenticarToken,
  autorizarModulo,
} = require("./middleware/auth.middleware");

const authRoutes = require("./routes/auth.routes");
const crmRoutes = require("./routes/crm.routes");

// NUEVO: Proveedores ahora es un módulo independiente
const proveedoresRoutes = require("./routes/proveedores.routes");

const operacionesRoutes = require("./routes/operaciones.routes");
const logisticaRoutes = require("./routes/logistica.routes");
const flotaRoutes = require("./routes/flota.routes");
const pilotosRoutes = require("./routes/pilotos.routes");
const rutasRoutes = require("./routes/rutas.routes");
const comprobantesRoutes = require("./routes/comprobantes.routes");
const reportesRoutes = require("./routes/reportes.routes");
const iaRoutes = require("./routes/ia.routes");
const mantenimientoRoutes = require("./routes/mantenimiento.routes");
const auditoriaRoutes = require("./routes/auditoria.routes");

const { auditoriaGlobal } = require("./middleware/auditoriaGlobal.middleware");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Servidor GL365 funcionando",
  });
});

/*
  Auditoría global:
  - Registra CREAR / ACTUALIZAR / ELIMINAR en todos los módulos.
  - No registra GET.
  - No registra auth, auditoría, IA ni reportes.
  - El login correcto lo registra auth.routes.js.
*/
app.use(auditoriaGlobal);

/*
  LOGIN:
  Se montan las dos rutas para que funcione aunque el frontend use cualquiera:
  - http://localhost:3001/api/auth/login
  - http://localhost:3001/api/login
*/
app.use("/api/auth", authRoutes);
app.use("/api", authRoutes);

/*
  Desde este punto, toda la API requiere una
  sesión válida.
*/
app.use("/api", autenticarToken);

/*
  Seguridad dinámica por módulo.
  - Mantenimiento puede abrirse con permiso de mantenimiento o seguridad.
  - Auditoría pertenece al bloque de Seguridad.
*/
app.use(
  "/api/mantenimiento",
  autorizarModulo("mantenimiento", "seguridad")
);

app.use(
  "/api/auditoria",
  autorizarModulo("seguridad")
);

app.use("/api/auditoria", auditoriaRoutes);

/*
  IMPORTANTE:
  Mantenimiento se monta antes de las rutas generales porque
  operaciones.routes.js conserva endpoints antiguos con el prefijo
  /mantenimiento.
*/
app.use("/api/mantenimiento", mantenimientoRoutes);

/*
  ================================
  MÓDULOS PRINCIPALES
  ================================
*/

// CRM
app.use("/api", crmRoutes);

// PROVEEDORES
// Ahora funciona como módulo independiente.
app.use("/api", proveedoresRoutes);

// OPERACIONES
app.use("/api", operacionesRoutes);

// LOGÍSTICA
app.use("/api", logisticaRoutes);

// FLOTA
app.use("/api", flotaRoutes);

// PILOTOS
app.use("/api", pilotosRoutes);

// RUTAS
app.use("/api", rutasRoutes);

// COMPROBANTES
app.use("/api", comprobantesRoutes);

// REPORTES
app.use("/api", reportesRoutes);

// IA
app.use("/api/ia", autorizarModulo("ia"), iaRoutes);

/*
  ================================
  RUTA NO ENCONTRADA
  ================================
*/
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: "Ruta no encontrada.",
    ruta: req.originalUrl,
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(
    `Servidor GL365 corriendo en http://localhost:${PORT}`
  );
});