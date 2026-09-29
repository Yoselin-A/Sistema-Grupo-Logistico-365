const jwt = require("jsonwebtoken");
const pool = require("../config/db");

let tablasAuthCache = null;
let permisosTablesCache = null;

const q = (name) => `\`${String(name).replace(/`/g, "``")}\``;

const normalizarTexto = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const normalizarCodigoRol = (value) =>
  normalizarTexto(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

/* =========================================================
   RESOLVER TABLAS DE AUTENTICACIÓN
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

  const tablas = new Set(rows.map((row) => String(row.TABLE_NAME)));

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
    console.error("Tablas encontradas para autenticación:", Array.from(tablas));
    throw new Error("No se encontraron las tablas de usuarios y roles.");
  }

  tablasAuthCache = { usuario, rol };
  return tablasAuthCache;
};

/* =========================================================
   TABLAS DE PERMISOS
========================================================= */
const resolverTablasPermisos = async () => {
  if (permisosTablesCache !== null) return permisosTablesCache;

  const [rows] = await pool.query(`
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('modulo_sistema', 'role_modulo')
  `);

  const tablas = new Set(rows.map((row) => String(row.TABLE_NAME)));
  permisosTablesCache =
    tablas.has("modulo_sistema") && tablas.has("role_modulo")
      ? { modulo: "modulo_sistema", roleModulo: "role_modulo" }
      : false;

  return permisosTablesCache;
};

/* =========================================================
   NORMALIZAR ROL
========================================================= */
const resolverRole = (usuario) => {
  const codigoOriginal = String(usuario?.codigo_rol || "").trim();
  const codigoNormalizado = normalizarCodigoRol(codigoOriginal);
  const nombre = normalizarTexto(usuario?.nombre_rol);

  const codigosConocidos = {
    adm: "administrador",
    admin: "administrador",
    administrador: "administrador",
    administracion: "administrador",
    ger: "gerencia",
    gerencia: "gerencia",
    fin: "finanzas",
    finanzas: "finanzas",
    fact: "facturacion",
    factura: "facturacion",
    facturacion: "facturacion",
    cont: "facturacion",
    contabilidad: "facturacion",
    comp: "compras",
    compra: "compras",
    compras: "compras",
    log: "logistica",
    logistica: "logistica",
    msg: "mensajeria",
    mensajeria: "mensajeria",
    vent: "ventas",
    venta: "ventas",
    ventas: "ventas",
    op: "operaciones",
    operacion: "operaciones",
    operaciones: "operaciones",
  };

  if (codigosConocidos[codigoNormalizado]) {
    return codigosConocidos[codigoNormalizado];
  }

  // Si existe un código propio (por ejemplo SUPLOG), se respeta como identidad
  // del rol personalizado. Sus accesos provienen de role_modulo, no del nombre.
  if (
    codigoNormalizado &&
    !/^\d+$/.test(codigoNormalizado) &&
    !/^rol_?\d*$/.test(codigoNormalizado)
  ) {
    return codigoNormalizado;
  }

  // Compatibilidad para bases antiguas donde el código no identifica bien el rol.
  if (nombre.includes("administrador") || nombre.includes("administracion")) return "administrador";
  if (nombre.includes("gerencia")) return "gerencia";
  if (nombre.includes("finanza")) return "finanzas";
  if (nombre.includes("factur") || nombre.includes("contab")) return "facturacion";
  if (nombre.includes("compra")) return "compras";
  if (nombre.includes("logistica")) return "logistica";
  if (nombre.includes("mensajeria")) return "mensajeria";
  if (nombre.includes("venta")) return "ventas";
  if (nombre.includes("operacion")) return "operaciones";

  return normalizarCodigoRol(usuario?.nombre_rol) || "sin_rol";
};

/* =========================================================
   PERMISOS DEL ROL
========================================================= */
const permisosLegacy = (role) => {
  const map = {
    administrador: [
      "crm",
      "operaciones",
      "logistica",
      "flota",
      "rutas",
      "facturacion",
      "reportes",
      "ia",
      "mantenimiento",
      "seguridad",
    ],
    gerencia: [
      "crm",
      "operaciones",
      "logistica",
      "flota",
      "rutas",
      "facturacion",
      "reportes",
      "ia",
      "mantenimiento",
      "seguridad",
    ],
    ventas: ["crm", "reportes", "ia"],
    operaciones: ["operaciones", "reportes", "ia"],
    compras: ["operaciones", "reportes", "ia"],
    logistica: ["logistica", "flota", "rutas", "reportes", "ia"],
    facturacion: ["facturacion", "reportes", "ia"],
    finanzas: ["facturacion", "reportes", "ia"],
    mensajeria: [],
  };

  return map[String(role || "")] || [];
};

const obtenerPermisosRol = async (rolId, roleFallback = null) => {
  const id = Number(rolId);
  if (!Number.isInteger(id) || id <= 0) return permisosLegacy(roleFallback);

  try {
    const tablas = await resolverTablasPermisos();
    if (!tablas) return permisosLegacy(roleFallback);

    const [rows] = await pool.query(
      `
      SELECT m.codigo_modulo
      FROM ${q(tablas.roleModulo)} rm
      INNER JOIN ${q(tablas.modulo)} m
        ON m.id = rm.modulo_id
      WHERE rm.role_id = ?
        AND m.activo = 1
      ORDER BY m.orden, m.id
      `,
      [id]
    );

    return rows
      .map((row) => String(row.codigo_modulo || "").trim().toLowerCase())
      .filter(Boolean);
  } catch (error) {
    console.warn(
      "No se pudieron leer los permisos dinámicos; se usará compatibilidad por rol:",
      error.message
    );
    return permisosLegacy(roleFallback);
  }
};

/* =========================================================
   OBTENER TOKEN
========================================================= */
const obtenerToken = (req) => {
  const cookies = String(req.headers.cookie || "")
    .split(";")
    .map((cookie) => cookie.trim());

  const cookieToken = cookies.find((cookie) => cookie.startsWith("gl365_token="));
  if (cookieToken) {
    return decodeURIComponent(cookieToken.substring("gl365_token=".length));
  }

  const authorization = String(req.headers.authorization || "");
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
    const usuarioId = Number(payload.sub || payload.id);

    if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
      return res.status(401).json({ ok: false, message: "Sesión inválida." });
    }

    const tablas = await resolverTablasAuth();

    // El rol y sus permisos se consultan en MySQL en cada petición protegida.
    // Así, un cambio realizado por Gerencia entra en vigor sin emitir otro JWT.
    const [rows] = await pool.query(
      `
      SELECT
        u.id,
        u.activo,
        u.primer_nombre,
        u.segundo_nombre,
        u.primer_apellido,
        u.segundo_apellido,
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
        message: "La cuenta se encuentra inactiva. Comunícate con Gerencia.",
      });
    }

    const role = resolverRole(usuario);
    const permissions = await obtenerPermisosRol(usuario.rol_id, role);
    const nombreCompleto = [
      usuario.primer_nombre,
      usuario.segundo_nombre,
      usuario.primer_apellido,
      usuario.segundo_apellido,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    req.auth = {
      id: usuario.id,
      nombre_usuario: usuario.nombre_usuario,
      nombre_completo: nombreCompleto || usuario.nombre_usuario,
      email: usuario.email,
      rol_id: usuario.rol_id,
      role,
      codigo_rol: usuario.codigo_rol,
      nombre_rol: usuario.nombre_rol,
      permissions,
    };

    req.user = req.auth;
    next();
  } catch (error) {
    if (error?.name === "TokenExpiredError") {
      return res.status(401).json({
        ok: false,
        message: "La sesión ha expirado. Inicia sesión nuevamente.",
      });
    }

    if (error?.name === "JsonWebTokenError") {
      return res.status(401).json({ ok: false, message: "La sesión no es válida." });
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
  const allowed = rolesPermitidos.map((role) => normalizarTexto(role));

  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({ ok: false, message: "Debes iniciar sesión." });
    }

    if (!allowed.includes(normalizarTexto(req.auth.role))) {
      return res.status(403).json({
        ok: false,
        message: "No tienes permisos para acceder a este módulo.",
      });
    }

    next();
  };
};

/* =========================================================
   AUTORIZACIÓN DINÁMICA POR MÓDULO
========================================================= */
const autorizarModulo = (...modulosPermitidos) => {
  const modulos = modulosPermitidos
    .flat()
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean);

  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({ ok: false, message: "Debes iniciar sesión." });
    }

    // Gerencia y administrador conservan acceso total para evitar bloqueos
    // accidentales de la administración del sistema.
    if (["gerencia", "administrador"].includes(req.auth.role)) return next();

    const permisos = Array.isArray(req.auth.permissions)
      ? req.auth.permissions.map((item) => String(item).toLowerCase())
      : [];

    if (!modulos.some((modulo) => permisos.includes(modulo))) {
      return res.status(403).json({
        ok: false,
        message: "No tienes permisos para acceder a este módulo.",
      });
    }

    next();
  };
};

module.exports = {
  autenticarToken,
  autorizarRoles,
  autorizarModulo,
  resolverRole,
  obtenerPermisosRol,
};