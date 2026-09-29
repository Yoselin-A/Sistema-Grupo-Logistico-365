const express = require("express");
const cors = require("cors");
require("dotenv").config();

const {
  autenticarToken,
  autorizarModulo,
} = require("./middleware/auth.middleware");

const authRoutes = require("./routes/auth.routes");
const crmRoutes = require("./routes/crm.routes");
const operacionesRoutes = require("./routes/operaciones.routes");
const logisticaRoutes = require("./routes/logistica.routes");
const flotaRoutes = require("./routes/flota.routes");
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
  La validación fina de tablas sensibles se realiza también dentro de
  mantenimiento.routes.js.
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
  /mantenimiento. De esta forma, el módulo usa siempre la lógica
  específica de mantenimiento (normalización de fechas, hash de
  contraseñas y validaciones de seguridad).
*/
app.use("/api/mantenimiento", mantenimientoRoutes);

app.use("/api", crmRoutes);
app.use("/api", operacionesRoutes);
app.use("/api", logisticaRoutes);
app.use("/api", flotaRoutes);
app.use("/api", rutasRoutes);
app.use("/api", comprobantesRoutes);
app.use("/api", reportesRoutes);

app.use("/api/ia", autorizarModulo("ia"), iaRoutes);

// RUTA NO ENCONTRADA
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: "Ruta no encontrada.",
    ruta: req.originalUrl,
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Servidor GL365 corriendo en http://localhost:${PORT}`);
});