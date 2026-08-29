const jwt = require("jsonwebtoken");
const pool = require("../config/db");

let tablasAuthCache = null;

const q = (name) => `\`${String(name).replace(/`/g, "``")}\``;

/* =========================================================
   RESOLVER TABLAS
========================================================= */
const resolverTablasAuth = async () => {
  if (tablasAuthCache) return tablasAuthCache;

  const [rows] = await pool.query(`
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN (
        'usuario',
        'usuarios',
        'role',
        'rol',
        'roles'
      )
  `);

  const tablas = new Set(
    rows.map((row) => String(row.TABLE_NAME))
  );

  const usuario = tablas.has("usuario")
    ? "usuario"
    : tablas.has("usuarios")
    ? "usuarios"
    : null;

  const rol = tablas.has("role")
    ? "role"
    : tablas.has("rol")
    ? "rol"
    : tablas.has("roles")
    ? "roles"
    : null;

  if (!usuario || !rol) {
    console.error(
      "Tablas encontradas para autenticación:",
      Array.from(tablas)
    );

    throw new Error(
      "No se encontraron las tablas de usuarios y roles."
    );
  }

  tablasAuthCache = {
    usuario,
    rol,
  };

  return tablasAuthCache;
};

/* =========================================================
   NORMALIZAR ROL
========================================================= */
const resolverRole = (usuario) => {
  const codigo = String(usuario.codigo_rol || "")
    .trim()
    .toUpperCase();

  const nombre = String(usuario.nombre_rol || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (codigo === "GER" || nombre.includes("gerencia")) {
    return "gerencia";
  }

  if (codigo === "FIN" || nombre.includes("finanza")) {
    return "finanzas";
  }

  if (
    codigo === "FACT" ||
    codigo === "CONT" ||
    nombre.includes("factur") ||
    nombre.includes("contab")
  ) {
    return "facturacion";
  }

  if (codigo === "COMP" || nombre.includes("compra")) {
    return "compras";
  }

  if (codigo === "LOG" || nombre.includes("logistica")) {
    return "logistica";
  }

  if (
    codigo === "MSG" ||
    nombre.includes("mensajeria")
  ) {
    return "mensajeria";
  }

  if (codigo === "VENT" || nombre.includes("venta")) {
    return "ventas";
  }

  if (
    codigo === "OP" ||
    nombre.includes("operacion")
  ) {
    return "operaciones";
  }

  return "sin_rol";
};

/* =========================================================
   OBTENER TOKEN
========================================================= */
const obtenerToken = (req) => {
  // 1. Cookie HttpOnly
  const cookies = String(req.headers.cookie || "")
    .split(";")
    .map((cookie) => cookie.trim());

  const cookieToken = cookies.find((cookie) =>
    cookie.startsWith("gl365_token=")
  );

  if (cookieToken) {
    return decodeURIComponent(
      cookieToken.substring("gl365_token=".length)
    );
  }

  // 2. Bearer Token como respaldo
  const authorization = String(
    req.headers.authorization || ""
  );

  if (authorization.startsWith("Bearer ")) {
    return authorization.substring(7).trim();
  }

  return null;
};

/* =========================================================
   AUTENTICAR
========================================================= */
const autenticarToken = async (req, res, next) => {
  try {
    const token = obtenerToken(req);

    if (!token) {
      return res.status(401).json({
        ok: false,
        message: "Debes iniciar sesión para continuar.",
      });
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error("JWT_SECRET no está configurado.");

      return res.status(500).json({
        ok: false,
        message: "La seguridad del servidor no está configurada.",
      });
    }

    const payload = jwt.verify(token, secret);

    const usuarioId = Number(
      payload.sub || payload.id
    );

    if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
      return res.status(401).json({
        ok: false,
        message: "Sesión inválida.",
      });
    }

    const tablas = await resolverTablasAuth();

    /*
      IMPORTANTE:
      No confiamos solamente en el rol guardado en el token.
      Consultamos MySQL en cada petición protegida.
    */
    const [rows] = await pool.query(
      `
      SELECT
        u.id,
        u.activo,
        u.nombre_usuario,
        u.email,
        u.rol_id,
        r.codigo_rol,
        r.nombre_rol
      FROM ${q(tablas.usuario)} u
      LEFT JOIN ${q(tablas.rol)} r
        ON r.id = u.rol_id
      WHERE u.id = ?
      LIMIT 1
      `,
      [usuarioId]
    );

    if (!rows.length) {
      return res.status(401).json({
        ok: false,
        message: "El usuario de la sesión ya no existe.",
      });
    }

    const usuario = rows[0];

    const estaActivo =
      usuario.activo === 1 ||
      usuario.activo === true ||
      String(usuario.activo) === "1";

    if (!estaActivo) {
      return res.status(403).json({
        ok: false,
        message:
          "La cuenta se encuentra inactiva. Comunícate con Gerencia.",
      });
    }

    req.auth = {
      id: usuario.id,
      nombre_usuario: usuario.nombre_usuario,
      email: usuario.email,
      rol_id: usuario.rol_id,
      role: resolverRole(usuario),
      codigo_rol: usuario.codigo_rol,
      nombre_rol: usuario.nombre_rol,
    };

    // También lo dejamos disponible para otros middleware.
    req.user = req.auth;

    next();
  } catch (error) {
    if (error?.name === "TokenExpiredError") {
      return res.status(401).json({
        ok: false,
        message:
          "La sesión ha expirado. Inicia sesión nuevamente.",
      });
    }

    if (error?.name === "JsonWebTokenError") {
      return res.status(401).json({
        ok: false,
        message: "La sesión no es válida.",
      });
    }

    console.error("Error autenticando sesión:", error);

    return res.status(500).json({
      ok: false,
      message: "No se pudo validar la sesión.",
    });
  }
};

/* =========================================================
   AUTORIZACIÓN POR ROL
========================================================= */
const autorizarRoles = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({
        ok: false,
        message: "Debes iniciar sesión.",
      });
    }

    if (!rolesPermitidos.includes(req.auth.role)) {
      return res.status(403).json({
        ok: false,
        message:
          "No tienes permisos para acceder a este módulo.",
      });
    }

    next();
  };
};

module.exports = {
  autenticarToken,
  autorizarRoles,
};