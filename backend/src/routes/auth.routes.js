const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { insertAudit } = require("../middleware/auditoriaGlobal.middleware");

const router = express.Router();

/* ===============================
   ROLES DEL SISTEMA
================================ */
const rolesPorId = {
  1: "gerencia",
  2: "facturacion",
  3: "facturacion",
  4: "facturacion",
  5: "compras",
  6: "logistica",
  7: "mensajeria",
  8: "ventas",
};

const cargoPorRol = {
  gerencia: "Gerente General",
  facturacion: "Comprobantes / Área Contable",
  compras: "Encargado de Compras",
  logistica: "Encargado de Logística",
  mensajeria: "Mensajería Externa",
  ventas: "Asesor de Ventas",
  operaciones: "Operaciones",
};

/* ===============================
   UTILIDADES
================================ */
const limpiarTexto = (valor) => String(valor || "").trim();

const q = (name) => `\`${String(name).replace(/`/g, "``")}\``;

const esCorreoValido = (correo) => {
  const valor = limpiarTexto(correo);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
};

const esPasswordCifrada = (password) => {
  const value = String(password || "");
  return value.startsWith("$2a$") || value.startsWith("$2b$") || value.startsWith("$2y$");
};

const validarPasswordSegura = (password) => {
  const value = String(password || "");

  return {
    longitud: value.length >= 8,
    mayuscula: /[A-Z]/.test(value),
    minuscula: /[a-z]/.test(value),
    numero: /[0-9]/.test(value),
    especial: /[^A-Za-z0-9]/.test(value),
  };
};

const passwordCumpleReglas = (password) => {
  const reglas = validarPasswordSegura(password);
  return Object.values(reglas).every(Boolean);
};

const obtenerIdONull = (valor) => {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
};

const enviarError = (res, status, message, error = null) => {
  return res.status(status).json({
    ok: false,
    message,
    ...(error ? { error: error.message || String(error) } : {}),
  });
};

/* ===============================
   DETECTAR TABLAS REALES
================================ */
const tablaExiste = async (tabla) => {
  const [rows] = await pool.query(
    `
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
    LIMIT 1
    `,
    [tabla]
  );

  return rows.length > 0;
};

const resolverTabla = async (opciones, nombreVisible) => {
  for (const tabla of opciones) {
    if (await tablaExiste(tabla)) return tabla;
  }

  throw new Error(`No se encontró la tabla de ${nombreVisible}. Revisá si está en singular o plural.`);
};

const obtenerTablasAuth = async () => {
  const usuario = await resolverTabla(["usuario", "usuarios"], "usuarios");
  const rol = await resolverTabla(["rol", "roles", "role"], "roles");

  return {
    usuario,
    rol,
    solicitud: (await tablaExiste("solicitud_credencial"))
      ? "solicitud_credencial"
      : "solicitudes_credenciales",
  };
};

const obtenerColumnas = async (tabla) => {
  const [rows] = await pool.query(
    `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
    `,
    [tabla]
  );

  return new Set(rows.map((row) => row.COLUMN_NAME));
};

/* ===============================
   ASEGURAR SOLICITUDES
================================ */
const asegurarTablaSolicitudes = async () => {
  const tablas = await obtenerTablasAuth();

  if (await tablaExiste(tablas.solicitud)) return tablas.solicitud;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${q(tablas.solicitud)} (
      id INT NOT NULL AUTO_INCREMENT,
      estado_solicitud ENUM('pendiente','autorizada','denegada') NOT NULL DEFAULT 'pendiente',
      usuario_id INT NOT NULL,
      tipo ENUM('cambio_password','recuperacion_password') NOT NULL DEFAULT 'cambio_password',
      nueva_password_hash VARCHAR(255) NOT NULL,
      solicitado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      revisado_en TIMESTAMP NULL,
      revisado_por INT NULL,
      observacion VARCHAR(180) NULL,
      PRIMARY KEY (id),
      INDEX idx_solicitud_usuario (usuario_id),
      INDEX idx_solicitud_revisor (revisado_por),
      CONSTRAINT fk_solicitud_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES ${q(tablas.usuario)}(id)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION,
      CONSTRAINT fk_solicitud_revisor
        FOREIGN KEY (revisado_por)
        REFERENCES ${q(tablas.usuario)}(id)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION
    )
  `);

  return tablas.solicitud;
};

const asegurarCampoPassword = async () => {
  const tablas = await obtenerTablasAuth();
  const columnas = await obtenerColumnas(tablas.usuario);

  if (!columnas.has("password_hash")) {
    throw new Error(`La tabla ${tablas.usuario} necesita la columna password_hash.`);
  }

  try {
    await pool.query(`
      ALTER TABLE ${q(tablas.usuario)}
      MODIFY COLUMN password_hash VARCHAR(255) NOT NULL
    `);
  } catch (error) {
    console.warn("No se pudo modificar password_hash:", error.message);
  }

  return tablas;
};

/* ===============================
   RESOLVER ROL PARA FRONTEND
================================ */
const resolverRole = (usuario) => {
  const codigoRol = limpiarTexto(usuario.codigo_rol).toLowerCase();
  const nombreRol = limpiarTexto(usuario.nombre_rol).toLowerCase();
  const textoRol = `${codigoRol} ${nombreRol}`;

  if (textoRol.includes("ger") || textoRol.includes("gerencia")) return "gerencia";

  if (
    textoRol.includes("fin") ||
    textoRol.includes("finanza") ||
    textoRol.includes("cont") ||
    textoRol.includes("contabilidad") ||
    textoRol.includes("fact") ||
    textoRol.includes("factura") ||
    textoRol.includes("comprobante")
  ) {
    return "facturacion";
  }

  if (textoRol.includes("compra")) return "compras";
  if (textoRol.includes("log") || textoRol.includes("logistica") || textoRol.includes("logística")) return "logistica";
  if (textoRol.includes("msg") || textoRol.includes("mensaje") || textoRol.includes("mensajeria") || textoRol.includes("mensajería")) return "mensajeria";
  if (textoRol.includes("vent") || textoRol.includes("venta")) return "ventas";
  if (textoRol.includes("op") || textoRol.includes("operacion") || textoRol.includes("operación") || textoRol.includes("operaciones")) return "operaciones";

  return rolesPorId[Number(usuario.rol_id)] || "gerencia";
};

const obtenerNombreCompleto = (usuario) => {
  const nombreCompleto = [
    usuario.primer_nombre,
    usuario.segundo_nombre,
    usuario.primer_apellido,
    usuario.segundo_apellido,
  ]
    .filter((parte) => limpiarTexto(parte))
    .join(" ")
    .trim();

  return nombreCompleto || limpiarTexto(usuario.nombre_usuario) || "Usuario";
};

const crearPayloadUsuario = (usuario) => {
  const role = resolverRole(usuario);
  const nombreCompleto = obtenerNombreCompleto(usuario);

  return {
    id: usuario.id,
    name: nombreCompleto,
    nombre_usuario: usuario.nombre_usuario,
    email: usuario.email,
    role,
    rol_id: usuario.rol_id,
    codigo_rol: usuario.codigo_rol,
    nombre_rol: usuario.nombre_rol,
    cargo: cargoPorRol[role] || "Usuario del sistema",
  };
};

/* ===============================
   AUDITORÍA LOGIN
================================ */
const registrarInicioSesion = async (req, usuarioPayload) => {
  try {
    await insertAudit(req, { ok: true }, {
      modulo: "Seguridad",
      tabla: "sesion",
      tipo_evento: "INICIO_SESION",
      accion: "Inicio de sesión",
      detalle: `Inicio de sesión correcto en GL365 ERP · ${usuarioPayload.email || usuarioPayload.nombre_usuario}.`,
      usuario: usuarioPayload.email || usuarioPayload.nombre_usuario,
      usuario_id: usuarioPayload.id,
      rol: usuarioPayload.role,
    });
  } catch (error) {
    console.warn("No se pudo registrar inicio de sesión en auditoría:", error.message);
  }
};

/* ===============================
   OBTENER USUARIO
================================ */
const obtenerUsuarioPorIdentificador = async (identificador) => {
  const tablas = await obtenerTablasAuth();

  const valor = limpiarTexto(identificador);
  const valorLower = valor.toLowerCase();
  const idNumerico = obtenerIdONull(valor);

  const whereParts = ["LOWER(u.nombre_usuario) = ?", "LOWER(u.email) = ?"];
  const params = [valorLower, valorLower];

  if (idNumerico) {
    whereParts.push("u.id = ?");
    params.push(idNumerico);
  }

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
      u.password_hash AS password_valor,
      u.rol_id,
      r.codigo_rol,
      r.nombre_rol
    FROM ${q(tablas.usuario)} u
    LEFT JOIN ${q(tablas.rol)} r
      ON r.id = u.rol_id
    WHERE ${whereParts.join(" OR ")}
    LIMIT 1
    `,
    params
  );

  return rows[0] || null;
};

const actualizarPasswordUsuario = async (connection, usuarioId, hash) => {
  const tablas = await obtenerTablasAuth();

  await connection.query(
    `
    UPDATE ${q(tablas.usuario)}
    SET password_hash = ?
    WHERE id = ?
    `,
    [hash, usuarioId]
  );
};

/* ===============================
   LOGIN
================================ */
router.post("/login", async (req, res) => {
  try {
    await asegurarCampoPassword();

    const usuarioTexto = limpiarTexto(req.body.identificador || req.body.usuario || req.body.email);
    const password = String(req.body.password || "");

    if (!usuarioTexto || !password) {
      return enviarError(res, 400, "Debes ingresar usuario o correo y contraseña.");
    }

    if (usuarioTexto.includes("@") && !esCorreoValido(usuarioTexto)) {
      return enviarError(res, 400, "Ingresa un correo electrónico válido.");
    }

    const usuario = await obtenerUsuarioPorIdentificador(usuarioTexto);

    if (!usuario) {
      return enviarError(res, 401, "Usuario, correo o contraseña incorrectos.");
    }

    if (
      usuario.activo === 0 ||
      usuario.activo === false ||
      String(usuario.activo).toLowerCase() === "false"
    ) {
      return enviarError(res, 403, "La cuenta se encuentra inactiva. Comunícate con Gerencia.");
    }

    const passwordGuardada = String(usuario.password_valor || "");
    let passwordCorrecta = false;

    if (esPasswordCifrada(passwordGuardada)) {
      passwordCorrecta = await bcrypt.compare(password, passwordGuardada);
    } else {
      passwordCorrecta = password === passwordGuardada;

      if (passwordCorrecta) {
        const hash = await bcrypt.hash(password, 10);
        const connection = await pool.getConnection();

        try {
          await actualizarPasswordUsuario(connection, usuario.id, hash);
        } finally {
          connection.release();
        }
      }
    }

    if (!passwordCorrecta) {
      return enviarError(res, 401, "Usuario, correo o contraseña incorrectos.");
    }

    const user = crearPayloadUsuario(usuario);

    await registrarInicioSesion(req, user);

    return res.json({
      ok: true,
      message: "Inicio de sesión correcto.",
      user,
    });
  } catch (error) {
    console.error("Error en login:", error);
    return enviarError(res, 500, "Error al iniciar sesión.", error);
  }
});

/* ===============================
   SOLICITAR CAMBIO DE CONTRASEÑA
================================ */
router.post("/solicitar-cambio-password", async (req, res) => {
  try {
    const tablas = await asegurarCampoPassword();
    const tablaSolicitud = await asegurarTablaSolicitudes();

    const usuarioTexto = limpiarTexto(req.body.identificador || req.body.usuario || req.body.email);
    const nuevaPassword = String(req.body.nuevaPassword || "").trim();

    if (!usuarioTexto || !nuevaPassword) {
      return enviarError(res, 400, "Debes ingresar usuario o correo y nueva contraseña.");
    }

    if (usuarioTexto.includes("@") && !esCorreoValido(usuarioTexto)) {
      return enviarError(res, 400, "Ingresa un correo electrónico válido.");
    }

    if (!passwordCumpleReglas(nuevaPassword)) {
      return enviarError(
        res,
        400,
        "La contraseña debe tener mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial."
      );
    }

    const usuario = await obtenerUsuarioPorIdentificador(usuarioTexto);

    if (!usuario) {
      return enviarError(res, 404, "No existe una cuenta registrada con ese usuario o correo.");
    }

    if (
      usuario.activo === 0 ||
      usuario.activo === false ||
      String(usuario.activo).toLowerCase() === "false"
    ) {
      return enviarError(res, 403, "La cuenta se encuentra inactiva. Comunícate con Gerencia.");
    }

    const [pendientes] = await pool.query(
      `
      SELECT id
      FROM ${q(tablaSolicitud)}
      WHERE usuario_id = ?
        AND estado_solicitud = 'pendiente'
      LIMIT 1
      `,
      [usuario.id]
    );

    if (pendientes.length > 0) {
      return enviarError(res, 400, "Ya existe una solicitud pendiente de autorización para este usuario.");
    }

    const hash = await bcrypt.hash(nuevaPassword, 10);

    await pool.query(
      `
      INSERT INTO ${q(tablaSolicitud)}
      (
        estado_solicitud,
        usuario_id,
        tipo,
        nueva_password_hash,
        solicitado_en,
        revisado_en,
        revisado_por,
        observacion
      )
      VALUES
      (
        'pendiente',
        ?,
        'cambio_password',
        ?,
        NOW(),
        NULL,
        NULL,
        NULL
      )
      `,
      [usuario.id, hash]
    );

    return res.json({
      ok: true,
      message: "Solicitud enviada a Gerencia para aprobación.",
    });
  } catch (error) {
    console.error("Error al solicitar cambio:", error);
    return enviarError(res, 500, "Error al solicitar cambio de contraseña.", error);
  }
});

/* ===============================
   VER SOLICITUDES PENDIENTES
================================ */
router.get("/solicitudes-credenciales", async (req, res) => {
  try {
    const tablas = await obtenerTablasAuth();
    const tablaSolicitud = await asegurarTablaSolicitudes();

    const [rows] = await pool.query(
      `
      SELECT
        s.id,
        s.usuario_id,
        u.nombre_usuario,
        u.email,
        CONCAT_WS(' ', u.primer_nombre, u.segundo_nombre, u.primer_apellido, u.segundo_apellido) AS nombre_completo,
        s.tipo,
        s.estado_solicitud,
        s.solicitado_en,
        s.revisado_en,
        s.revisado_por,
        s.observacion
      FROM ${q(tablaSolicitud)} s
      INNER JOIN ${q(tablas.usuario)} u
        ON u.id = s.usuario_id
      WHERE s.estado_solicitud = 'pendiente'
      ORDER BY s.solicitado_en DESC, s.id DESC
      `
    );

    const data = rows.map((row) => ({
      ...row,
      estado: "Pendiente",
      estado_solicitud: row.estado_solicitud || "pendiente",
    }));

    return res.json({
      ok: true,
      data,
    });
  } catch (error) {
    console.error("Error al obtener solicitudes:", error);
    return enviarError(res, 500, "Error al obtener solicitudes.", error);
  }
});

/* ===============================
   APROBAR SOLICITUD
================================ */
router.put("/solicitudes-credenciales/:id/aprobar", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await asegurarCampoPassword();
    const tablaSolicitud = await asegurarTablaSolicitudes();

    await connection.beginTransaction();

    const { id } = req.params;
    const revisadoPor = obtenerIdONull(req.body.revisadoPor);

    const [rows] = await connection.query(
      `
      SELECT
        id,
        usuario_id,
        nueva_password_hash,
        estado_solicitud
      FROM ${q(tablaSolicitud)}
      WHERE id = ?
        AND estado_solicitud = 'pendiente'
      LIMIT 1
      `,
      [id]
    );

    const solicitud = rows[0];

    if (!solicitud) {
      await connection.rollback();
      return enviarError(res, 404, "Solicitud no encontrada o ya revisada.");
    }

    if (!solicitud.nueva_password_hash) {
      await connection.rollback();
      return enviarError(res, 400, "La solicitud no tiene contraseña nueva registrada.");
    }

    await actualizarPasswordUsuario(connection, solicitud.usuario_id, solicitud.nueva_password_hash);

    await connection.query(
      `
      UPDATE ${q(tablaSolicitud)}
      SET estado_solicitud = 'autorizada',
          revisado_en = NOW(),
          revisado_por = ?
      WHERE id = ?
      `,
      [revisadoPor, id]
    );

    await connection.commit();

    return res.json({
      ok: true,
      message: "Cambio de contraseña autorizado correctamente.",
    });
  } catch (error) {
    await connection.rollback();

    console.error("Error al aprobar solicitud:", error);
    return enviarError(res, 500, "Error al aprobar solicitud.", error);
  } finally {
    connection.release();
  }
});

/* ===============================
   DENEGAR SOLICITUD
================================ */
router.put("/solicitudes-credenciales/:id/denegar", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const tablaSolicitud = await asegurarTablaSolicitudes();

    await connection.beginTransaction();

    const { id } = req.params;
    const revisadoPor = obtenerIdONull(req.body.revisadoPor);
    const observacion = limpiarTexto(req.body.observacion);

    const [result] = await connection.query(
      `
      UPDATE ${q(tablaSolicitud)}
      SET estado_solicitud = 'denegada',
          revisado_en = NOW(),
          revisado_por = ?,
          observacion = ?
      WHERE id = ?
        AND estado_solicitud = 'pendiente'
      `,
      [revisadoPor, observacion || null, id]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return enviarError(res, 404, "Solicitud no encontrada o ya revisada.");
    }

    await connection.commit();

    return res.json({
      ok: true,
      message: "Solicitud denegada correctamente.",
    });
  } catch (error) {
    await connection.rollback();

    console.error("Error al denegar solicitud:", error);
    return enviarError(res, 500, "Error al denegar solicitud.", error);
  } finally {
    connection.release();
  }
});

module.exports = router;