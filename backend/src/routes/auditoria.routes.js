const express = require("express");
const { insertAudit } = require("../middleware/auditoriaGlobal.middleware");

const router = express.Router();

router.post("/sesion/inicio", async (req, res) => {
  const usuario =
    req.body?.email ||
    req.body?.usuario ||
    req.body?.nombre_usuario ||
    req.headers?.["x-gl365-user-email"] ||
    "Usuario del sistema";

  await insertAudit(req, { ok: true }, {
    modulo: "Seguridad",
    tabla: "sesion",
    tipo_evento: "INICIO_SESION",
    accion: "Inicio de sesión",
    detalle: `Inicio de sesión en GL365 ERP · ${usuario}.`,
    usuario: usuario,
    usuario_id: req.body?.usuario_id || req.body?.id || null,
    rol: req.body?.rol || req.body?.role || "",
  });

  res.json({ ok: true, message: "Inicio de sesión registrado en auditoría." });
});

module.exports = router;