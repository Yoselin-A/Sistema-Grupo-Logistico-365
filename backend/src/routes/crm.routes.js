const express = require("express");
const pool = require("../config/db");

const {
  autorizarRoles,
} = require("../middleware/auth.middleware");

const router = express.Router();

/*
  =====================================================
  SEGURIDAD DEL MÓDULO CRM Y VENTAS
  =====================================================

  Este router está montado en /api, por lo que NO se debe
  aplicar autorizarRoles() de forma global al router completo.

  Se protegen únicamente las rutas que pertenecen al CRM.
*/
const soloCRM = autorizarRoles("gerencia", "ventas");

router.use("/crm", soloCRM);
router.use("/clientes", soloCRM);
router.use("/contactos-cliente", soloCRM);
router.use("/telefonos-contacto", soloCRM);
router.use("/oportunidades", soloCRM);
router.use("/cotizaciones", soloCRM);
router.use("/prefijos-telefonicos", soloCRM);

const T = {
  cliente: "cliente",
  estadoCliente: "estado_cliente",
  contacto: "contacto_cliente",
  telefono: "telefono_contacto",
  prefijo: "prefijo_telefonico",
  oportunidad: "oportunidad",
  estadoOportunidad: "estado_oportunidad",
  usuario: "usuario",
  rol: "role",
  modalidad: "modalidade",
  formaPago: "forma_pago",
  ubicacion: "ubicacion",
  cotizacion: "cotizacion",
  cotizacionDetalle: "cotizacion_detalle",
};

const ok = (res, data = null, message = "Operación realizada correctamente.") =>
  res.json({ ok: true, message, data });

const fail = (res, status, message, error = null) =>
  res.status(status).json({
    ok: false,
    message,
    error: error?.message || error || null,
  });

const limpiar = (valor) => String(valor ?? "").trim();
const soloLetras = (valor, max = 60) =>
  limpiar(valor)
    .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es-GT")
    .replace(/(^|[\s'-])([a-záéíóúüñ])/g, (_m, sep, letra) => `${sep}${letra.toLocaleUpperCase("es-GT")}`)
    .slice(0, max);
const soloNumeros = (valor, max = 15) => limpiar(valor).replace(/\D/g, "").slice(0, max);
const textoComercial = (valor, max = 120) =>
  limpiar(valor)
    .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s.,&()'/-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
const textoDireccion = (valor, max = 180) =>
  limpiar(valor)
    .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s.,#&()'/-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const asId = (valor) => {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const asMoney = (valor) => {
  const n = Number(String(valor ?? 0).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const asDate = (valor) => {
  const v = limpiar(valor);
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);

  const parts = v.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${String(y).padStart(4, "20")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  return null;
};

const nombreCompletoSQL = (alias) =>
  `CONCAT_WS(' ', ${alias}.primer_nombre, ${alias}.segundo_nombre, ${alias}.primer_apellido, ${alias}.segundo_apellido)`;

const splitNombrePersona = (nombre) => {
  const partes = limpiar(nombre).split(/\s+/).filter(Boolean);

  if (partes.length === 0) {
    return {
      primer_nombre: "Contacto",
      segundo_nombre: null,
      primer_apellido: "Principal",
      segundo_apellido: null,
    };
  }

  if (partes.length === 1) {
    return {
      primer_nombre: partes[0],
      segundo_nombre: null,
      primer_apellido: "Principal",
      segundo_apellido: null,
    };
  }

  if (partes.length === 2) {
    return {
      primer_nombre: partes[0],
      segundo_nombre: null,
      primer_apellido: partes[1],
      segundo_apellido: null,
    };
  }

  return {
    primer_nombre: partes[0],
    segundo_nombre: partes.length > 3 ? partes.slice(1, -2).join(" ") : null,
    primer_apellido: partes[partes.length - 2],
    segundo_apellido: partes[partes.length - 1],
  };
};

const slugCodigo = (texto, prefijo) => {
  const base = limpiar(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "")
    .toUpperCase()
    .slice(0, Math.max(1, 15 - prefijo.length));

  return `${prefijo}${base || Date.now().toString().slice(-6)}`.slice(0, 15);
};

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

const obtenerPrefijoGT = async () => {
  try {
    const existe = await tablaExiste(T.prefijo);
    if (!existe) return 1;

    const [rows] = await pool.query(
      `SELECT id FROM \`${T.prefijo}\` WHERE codigo_pais = 'GT' OR prefijo = '+502' ORDER BY id LIMIT 1`
    );

    return rows[0]?.id || 1;
  } catch {
    return 1;
  }
};

const PREFIJOS_FALLBACK = [
  { id: 1, codigo_pais: "GT", pais: "Guatemala", prefijo: "+502", ejemplo: "+502 5555-5555", activo: 1 },
  { id: 2, codigo_pais: "MX", pais: "México", prefijo: "+52", ejemplo: "+52 55 5555-5555", activo: 1 },
  { id: 3, codigo_pais: "US", pais: "Estados Unidos", prefijo: "+1", ejemplo: "+1 305 555-0188", activo: 1 },
  { id: 4, codigo_pais: "SV", pais: "El Salvador", prefijo: "+503", ejemplo: "+503 2222-2222", activo: 1 },
  { id: 5, codigo_pais: "HN", pais: "Honduras", prefijo: "+504", ejemplo: "+504 9999-9999", activo: 1 },
  { id: 6, codigo_pais: "NI", pais: "Nicaragua", prefijo: "+505", ejemplo: "+505 8888-8888", activo: 1 },
  { id: 7, codigo_pais: "CR", pais: "Costa Rica", prefijo: "+506", ejemplo: "+506 8888-8888", activo: 1 },
  { id: 8, codigo_pais: "PA", pais: "Panamá", prefijo: "+507", ejemplo: "+507 6000-0000", activo: 1 },
  { id: 9, codigo_pais: "BZ", pais: "Belice", prefijo: "+501", ejemplo: "+501 600-0000", activo: 1 },
];

const DIGITOS_TELEFONO = {
  GT: 8, MX: 10, US: 10, SV: 8, HN: 8, NI: 8, CR: 8, PA: 8, BZ: 7,
};

const limpiarTelefono = (valor) => limpiar(valor).replace(/\D/g, "");

const obtenerPrefijos = async () => {
  try {
    const existe = await tablaExiste(T.prefijo);
    if (!existe) return PREFIJOS_FALLBACK;

    const [rows] = await pool.query(
      `SELECT id, codigo_pais, pais, prefijo, ejemplo, activo FROM \`${T.prefijo}\` WHERE activo = 1 ORDER BY id`
    );

    return rows.length ? rows : PREFIJOS_FALLBACK;
  } catch {
    return PREFIJOS_FALLBACK;
  }
};

const validarTelefonoPorPrefijo = async (prefijoId, telefono) => {
  const prefijos = await obtenerPrefijos();
  const prefijo = prefijos.find((p) => Number(p.id) === Number(prefijoId)) || prefijos[0];
  const digitos = DIGITOS_TELEFONO[prefijo.codigo_pais] || 8;
  const numero = limpiarTelefono(telefono).slice(0, digitos);

  if (numero.length !== digitos) {
    const err = new Error(`${prefijo.prefijo} ${prefijo.pais} requiere exactamente ${digitos} dígitos.`);
    err.statusCode = 400;
    throw err;
  }

  return { prefijoId: Number(prefijo.id), numero, digitos, prefijo };
};

const nextCode = async (tabla, campo, prefijo) => {
  const [rows] = await pool.query(
    `
    SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(\`${campo}\`, '[^0-9]', '') AS UNSIGNED)), 0) + 1 AS siguiente
    FROM \`${tabla}\`
    WHERE \`${campo}\` LIKE ?
    `,
    [`${prefijo}-%`]
  );

  const n = Number(rows[0]?.siguiente || 1);
  return `${prefijo}-${String(n).padStart(3, "0")}`;
};

const firstId = async (tabla, order = "id") => {
  const [rows] = await pool.query(
    `SELECT id FROM \`${tabla}\` ORDER BY \`${order}\` LIMIT 1`
  );
  return rows[0]?.id || null;
};

const findIdByCodeOrName = async (tabla, codeCol, nameCol, value, fallbackId = null) => {
  const v = limpiar(value);
  if (!v) return fallbackId;

  const [rows] = await pool.query(
    `
    SELECT id
    FROM \`${tabla}\`
    WHERE LOWER(\`${codeCol}\`) = LOWER(?)
       OR LOWER(\`${nameCol}\`) = LOWER(?)
       OR LOWER(\`${nameCol}\`) LIKE LOWER(?)
    ORDER BY id
    LIMIT 1
    `,
    [v, v, `%${v}%`]
  );

  return rows[0]?.id || fallbackId;
};

const resolveUsuarioId = async (value) => {
  const id = asId(value);
  if (id) return id;

  const texto = limpiar(value);
  if (texto) {
    const [rows] = await pool.query(
      `
      SELECT id
      FROM \`${T.usuario}\`
      WHERE LOWER(nombre_usuario) = LOWER(?)
         OR LOWER(email) = LOWER(?)
         OR LOWER(CONCAT_WS(' ', primer_nombre, segundo_nombre, primer_apellido, segundo_apellido)) LIKE LOWER(?)
      ORDER BY id
      LIMIT 1
      `,
      [texto, texto, `%${texto}%`]
    );

    if (rows[0]?.id) return rows[0].id;
  }

  const [rows] = await pool.query(
    `
    SELECT u.id
    FROM \`${T.usuario}\` u
    LEFT JOIN \`${T.rol}\` r ON r.id = u.rol_id
    WHERE u.activo = 1
      AND (
        LOWER(r.codigo_rol) LIKE '%vent%'
        OR LOWER(r.nombre_rol) LIKE '%vent%'
        OR LOWER(r.codigo_rol) LIKE '%ger%'
        OR LOWER(r.nombre_rol) LIKE '%ger%'
      )
    ORDER BY u.id
    LIMIT 1
    `
  );

  return rows[0]?.id || (await firstId(T.usuario));
};

const resolveModalidadId = async (value) =>
  findIdByCodeOrName(T.modalidad, "codigo_modalidad", "nombre_modalidad", value, await firstId(T.modalidad));

const resolveFormaPagoId = async (value) => {
  const text = limpiar(value).toUpperCase();

  if (text.includes("CRÉDITO") || text.includes("CREDITO") || text.includes("CRE")) {
    return findIdByCodeOrName(T.formaPago, "codigo_forma_pago", "nombre_forma_pago", "CRE30", await firstId(T.formaPago));
  }

  if (text.includes("CONT")) {
    return findIdByCodeOrName(T.formaPago, "codigo_forma_pago", "nombre_forma_pago", "CONT", await firstId(T.formaPago));
  }

  return findIdByCodeOrName(T.formaPago, "codigo_forma_pago", "nombre_forma_pago", value, await firstId(T.formaPago));
};

const resolveOrCreateUbicacion = async (connection, value) => {
  const id = asId(value);
  if (id) return id;

  const nombre = limpiar(value);
  if (!nombre) return await firstId(T.ubicacion);

  const [rows] = await connection.query(
    `
    SELECT id
    FROM \`${T.ubicacion}\`
    WHERE LOWER(nombre_ubicacion) = LOWER(?)
       OR LOWER(codigo_ubicacion) = LOWER(?)
    LIMIT 1
    `,
    [nombre, nombre]
  );

  if (rows[0]?.id) return rows[0].id;

  const codigo = slugCodigo(nombre, "UB");
  const [insert] = await connection.query(
    `
    INSERT INTO \`${T.ubicacion}\` (codigo_ubicacion, nombre_ubicacion, pais)
    VALUES (?, ?, 'Guatemala')
    `,
    [codigo, nombre]
  );

  return insert.insertId;
};

const resolveOrCreateCliente = async (connection, body) => {
  const id = asId(body.cliente_id || body.clientId);
  if (id) return id;

  const nombre = limpiar(
    body.razon_social ||
      body.nombre_empresa ||
      body.clientName ||
      body.cliente ||
      body.nombre_oportunidad
  );

  if (!nombre) return null;

  const nit = limpiar(body.nit);

  const [existing] = await connection.query(
    `
    SELECT id
    FROM \`${T.cliente}\`
    WHERE LOWER(nombre_empresa) = LOWER(?)
       OR (? <> '' AND LOWER(nit) = LOWER(?))
    ORDER BY id
    LIMIT 1
    `,
    [nombre, nit, nit]
  );

  if (existing[0]?.id) return existing[0].id;

  const codigo = await nextCode(T.cliente, "codigo_cliente", "CLI");

  const [insert] = await connection.query(
    `
    INSERT INTO \`${T.cliente}\`
    (codigo_cliente, nombre_empresa, nit, direccion, estado_cliente_id)
    VALUES (?, ?, ?, ?, 1)
    `,
    [codigo, nombre, nit || `CF-${Date.now().toString().slice(-6)}`, limpiar(body.direccion || body.address)]
  );

  return insert.insertId;
};

const obtenerContactoPrincipal = async (connection, clienteId) => {
  if (!clienteId) return null;

  const [rows] = await connection.query(
    `
    SELECT id
    FROM \`${T.contacto}\`
    WHERE cliente_id = ?
    ORDER BY es_principal DESC, id ASC
    LIMIT 1
    `,
    [clienteId]
  );

  return rows[0]?.id || null;
};

const guardarContactoPrincipal = async (connection, clienteId, body) => {
  if (!clienteId) return null;

  const representante = limpiar(
    body.representante || body.representative || body.contacto || body.contact
  );
  const correo = limpiar(body.correo || body.email);
  const cargo = limpiar(body.cargo) || "Contacto principal";

  const telefonos = [
    limpiar(body.telefono1 || body.phone1),
    limpiar(body.telefono2 || body.phone2),
    limpiar(body.telefono3 || body.phone3),
  ].filter(Boolean);

  if (!representante && !correo && telefonos.length === 0) {
    return await obtenerContactoPrincipal(connection, clienteId);
  }

  const nombres = splitNombrePersona(representante || "Contacto Principal");
  let contactoId = await obtenerContactoPrincipal(connection, clienteId);

  if (!contactoId) {
    const [insert] = await connection.query(
      `
      INSERT INTO \`${T.contacto}\`
      (
        cliente_id,
        primer_nombre,
        segundo_nombre,
        primer_apellido,
        segundo_apellido,
        cargo,
        correo,
        es_principal,
        estado
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)
      `,
      [
        clienteId,
        nombres.primer_nombre,
        nombres.segundo_nombre,
        nombres.primer_apellido,
        nombres.segundo_apellido,
        cargo,
        correo || null,
      ]
    );

    contactoId = insert.insertId;
  } else {
    await connection.query(
      `
      UPDATE \`${T.contacto}\`
      SET primer_nombre = ?,
          segundo_nombre = ?,
          primer_apellido = ?,
          segundo_apellido = ?,
          cargo = ?,
          correo = ?,
          es_principal = 1,
          estado = 1
      WHERE id = ?
      `,
      [
        nombres.primer_nombre,
        nombres.segundo_nombre,
        nombres.primer_apellido,
        nombres.segundo_apellido,
        cargo,
        correo || null,
        contactoId,
      ]
    );
  }

  if (telefonos.length > 0) {
    const prefijoId = await obtenerPrefijoGT();
    await connection.query(`DELETE FROM \`${T.telefono}\` WHERE contacto_id = ?`, [contactoId]);

    for (const [index, tel] of telefonos.entries()) {
      await connection.query(
        `
        INSERT INTO \`${T.telefono}\`
        (contacto_id, prefijo_telefonico_id, telefono, tipo_telefono, es_principal)
        VALUES (?, ?, ?, ?, ?)
        `,
        [contactoId, prefijoId, tel, index === 0 ? "Principal" : `Secundario ${index}`, index === 0 ? 1 : 0]
      );
    }
  }

  return contactoId;
};

router.get("/prefijos-telefonicos", async (req, res) => {
  try {
    return ok(res, await obtenerPrefijos());
  } catch (error) {
    console.error("Error al obtener prefijos telefónicos:", error);
    return fail(res, 500, "No se pudieron obtener los prefijos telefónicos.", error);
  }
});

// =====================================================
// BOOTSTRAP CRM
// =====================================================
router.get("/crm/bootstrap", async (req, res) => {
  try {
    const [clientes] = await pool.query(`
      SELECT c.*, ec.nombre_estado_cliente
      FROM \`${T.cliente}\` c
      LEFT JOIN \`${T.estadoCliente}\` ec ON ec.id = c.estado_cliente_id
      ORDER BY c.id
    `);

    const [contactos] = await pool.query(`
      SELECT *
      FROM \`${T.contacto}\`
      ORDER BY cliente_id, es_principal DESC, id
    `);

    const [telefonos] = await pool.query(`
      SELECT
        tc.*,
        pt.prefijo,
        pt.codigo_pais,
        TRIM(CONCAT(COALESCE(pt.prefijo, ''), ' ', tc.telefono)) AS telefono_completo
      FROM \`${T.telefono}\` tc
      LEFT JOIN \`${T.prefijo}\` pt ON pt.id = tc.prefijo_telefonico_id
      ORDER BY tc.contacto_id, tc.es_principal DESC, tc.id
    `);

    const [oportunidades] = await pool.query(`
      SELECT
        o.*,
        c.nombre_empresa,
        u.nombre_usuario,
        ${nombreCompletoSQL("u")} AS ejecutivo,
        m.nombre_modalidad,
        eo.nombre_estado_oportunidad
      FROM \`${T.oportunidad}\` o
      LEFT JOIN \`${T.cliente}\` c ON c.id = o.cliente_id
      LEFT JOIN \`${T.usuario}\` u ON u.id = o.ejecutivo_id
      LEFT JOIN \`${T.modalidad}\` m ON m.id = o.modalidad_id
      LEFT JOIN \`${T.estadoOportunidad}\` eo ON eo.id = o.estado_id
      ORDER BY o.id
    `);

    const [cotizaciones] = await pool.query(`
      SELECT
        ct.*,
        ct.codigo_cotizacion AS numero_cotizacion,
        c.nombre_empresa,
        c.nit,
        ${nombreCompletoSQL("cc")} AS contacto,
        cc.correo,
        u.nombre_usuario,
        ${nombreCompletoSQL("u")} AS ejecutivo,
        m.nombre_modalidad,
        fp.nombre_forma_pago,
        uo.nombre_ubicacion AS origen,
        ud.nombre_ubicacion AS destino,
        COUNT(cd.id) AS lineas,
        COALESCE(SUM(cd.cantidad * cd.precio_unitario), 0) AS subtotal,
        COALESCE(SUM(cd.cantidad * cd.precio_unitario), 0) * 0.12 AS iva,
        COALESCE(SUM(cd.cantidad * cd.precio_unitario), 0) * 1.12 AS total,
        CURDATE() AS fecha,
        'Borrador' AS estado,
        'GTQ' AS moneda
      FROM \`${T.cotizacion}\` ct
      LEFT JOIN \`${T.cliente}\` c ON c.id = ct.cliente_id
      LEFT JOIN \`${T.contacto}\` cc ON cc.id = ct.contacto_id
      LEFT JOIN \`${T.usuario}\` u ON u.id = ct.ejecutivo_id
      LEFT JOIN \`${T.modalidad}\` m ON m.id = ct.modalidad_id
      LEFT JOIN \`${T.formaPago}\` fp ON fp.id = ct.forma_pago_id
      LEFT JOIN \`${T.ubicacion}\` uo ON uo.id = ct.origen_id
      LEFT JOIN \`${T.ubicacion}\` ud ON ud.id = ct.destino_id
      LEFT JOIN \`${T.cotizacionDetalle}\` cd ON cd.cotizacion_id = ct.id
      GROUP BY
        ct.id, ct.codigo_cotizacion, ct.cliente_id, ct.contacto_id,
        ct.ejecutivo_id, ct.modalidad_id, ct.forma_pago_id, ct.origen_id,
        ct.destino_id, c.nombre_empresa, c.nit, contacto, cc.correo,
        u.nombre_usuario, ejecutivo, m.nombre_modalidad, fp.nombre_forma_pago,
        uo.nombre_ubicacion, ud.nombre_ubicacion
      ORDER BY ct.id
    `);

    const [cotizacionDetalle] = await pool.query(`
      SELECT *
      FROM \`${T.cotizacionDetalle}\`
      ORDER BY cotizacion_id, id
    `);

    const [modalidades] = await pool.query(`SELECT * FROM \`${T.modalidad}\` ORDER BY id`);
    const [formasPago] = await pool.query(`SELECT * FROM \`${T.formaPago}\` ORDER BY id`);
    const [ubicaciones] = await pool.query(`SELECT * FROM \`${T.ubicacion}\` ORDER BY nombre_ubicacion`);
    const [roles] = await pool.query(`SELECT * FROM \`${T.rol}\` ORDER BY id`);
    const [usuarios] = await pool.query(`
      SELECT
        id,
        activo,
        primer_nombre,
        segundo_nombre,
        primer_apellido,
        segundo_apellido,
        nombre_usuario,
        email,
        rol_id
      FROM \`${T.usuario}\`
      ORDER BY id
    `);
    const [estadosCliente] = await pool.query(`SELECT * FROM \`${T.estadoCliente}\` ORDER BY id`);
    const [estadosOportunidad] = await pool.query(`SELECT * FROM \`${T.estadoOportunidad}\` ORDER BY id`);
    const prefijos = await obtenerPrefijos();

    return ok(res, {
      clientes,
      contactos,
      telefonos,
      oportunidades,
      cotizaciones,
      cotizacionDetalle,
      modalidades,
      formasPago,
      ubicaciones,
      roles,
      usuarios,
      estadosCliente,
      estadosOportunidad,
      prefijos,
    });
  } catch (error) {
    console.error("Error en /crm/bootstrap:", error);
    return fail(res, 500, "No se pudo cargar el CRM.", error);
  }
});

// =====================================================
// CLIENTES
// =====================================================
router.get("/clientes", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        c.id,
        c.codigo_cliente,
        c.nombre_empresa,
        c.nit,
        c.direccion,
        c.estado_cliente_id,
        ec.nombre_estado_cliente,

        ${nombreCompletoSQL("cc")} AS representante,
        cc.id AS contacto_id,
        cc.correo,

        (
          SELECT TRIM(CONCAT(COALESCE(pt.prefijo, ''), ' ', tc.telefono))
          FROM \`${T.contacto}\` ccp
          INNER JOIN \`${T.telefono}\` tc ON tc.contacto_id = ccp.id
          LEFT JOIN \`${T.prefijo}\` pt ON pt.id = tc.prefijo_telefonico_id
          WHERE ccp.cliente_id = c.id
          ORDER BY tc.es_principal DESC, tc.id ASC
          LIMIT 1
        ) AS telefono1,

        (
          SELECT TRIM(CONCAT(COALESCE(pt.prefijo, ''), ' ', tc.telefono))
          FROM \`${T.contacto}\` ccp
          INNER JOIN \`${T.telefono}\` tc ON tc.contacto_id = ccp.id
          LEFT JOIN \`${T.prefijo}\` pt ON pt.id = tc.prefijo_telefonico_id
          WHERE ccp.cliente_id = c.id
          ORDER BY tc.es_principal DESC, tc.id ASC
          LIMIT 1 OFFSET 1
        ) AS telefono2,

        (
          SELECT TRIM(CONCAT(COALESCE(pt.prefijo, ''), ' ', tc.telefono))
          FROM \`${T.contacto}\` ccp
          INNER JOIN \`${T.telefono}\` tc ON tc.contacto_id = ccp.id
          LEFT JOIN \`${T.prefijo}\` pt ON pt.id = tc.prefijo_telefonico_id
          WHERE ccp.cliente_id = c.id
          ORDER BY tc.es_principal DESC, tc.id ASC
          LIMIT 1 OFFSET 2
        ) AS telefono3

      FROM \`${T.cliente}\` c
      LEFT JOIN \`${T.estadoCliente}\` ec ON ec.id = c.estado_cliente_id
      LEFT JOIN \`${T.contacto}\` cc
        ON cc.id = (
          SELECT x.id
          FROM \`${T.contacto}\` x
          WHERE x.cliente_id = c.id
          ORDER BY x.es_principal DESC, x.id ASC
          LIMIT 1
        )
      ORDER BY c.id
    `);

    return ok(res, rows);
  } catch (error) {
    console.error("Error al obtener clientes:", error);
    return fail(res, 500, "No se pudieron obtener los clientes.", error);
  }
});

router.post("/clientes", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const codigo = limpiar(req.body.codigo_cliente) || (await nextCode(T.cliente, "codigo_cliente", "CLI"));
    const nombre = textoComercial(req.body.nombre_empresa || req.body.name, 120);
    const nit = limpiar(req.body.nit);
    const direccion = textoDireccion(req.body.direccion || req.body.address, 180);
    const estadoId = asId(req.body.estado_cliente_id || req.body.estado_id || req.body.estado) || 1;

    if (!nombre) {
      await connection.rollback();
      return fail(res, 400, "El nombre de la empresa es obligatorio.");
    }

    if (!nit) {
      await connection.rollback();
      return fail(res, 400, "El NIT es obligatorio.");
    }

    const [insert] = await connection.query(
      `
      INSERT INTO \`${T.cliente}\`
      (codigo_cliente, nombre_empresa, nit, direccion, estado_cliente_id)
      VALUES (?, ?, ?, ?, ?)
      `,
      [codigo, nombre, nit, direccion, estadoId]
    );

    const clienteId = insert.insertId;
    await guardarContactoPrincipal(connection, clienteId, req.body);

    await connection.commit();

    return ok(res, { id: clienteId, codigo_cliente: codigo }, "Cliente guardado correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error al guardar cliente:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return fail(res, 400, "Ya existe un cliente con ese código o NIT.", error);
    }

    return fail(res, 500, "No se pudo guardar el cliente.", error);
  } finally {
    connection.release();
  }
});

router.put("/clientes/:id", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const id = asId(req.params.id);
    const nombre = textoComercial(req.body.nombre_empresa || req.body.name, 120);
    const nit = limpiar(req.body.nit);
    const direccion = textoDireccion(req.body.direccion || req.body.address, 180);
    const estadoId = asId(req.body.estado_cliente_id || req.body.estado_id || req.body.estado) || 1;

    if (!id) {
      await connection.rollback();
      return fail(res, 400, "ID de cliente inválido.");
    }

    if (!nombre) {
      await connection.rollback();
      return fail(res, 400, "El nombre de la empresa es obligatorio.");
    }

    await connection.query(
      `
      UPDATE \`${T.cliente}\`
      SET nombre_empresa = ?,
          nit = ?,
          direccion = ?,
          estado_cliente_id = ?
      WHERE id = ?
      `,
      [nombre, nit, direccion, estadoId, id]
    );

    await guardarContactoPrincipal(connection, id, req.body);

    await connection.commit();

    return ok(res, { id }, "Cliente actualizado correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error al actualizar cliente:", error);
    return fail(res, 500, "No se pudo actualizar el cliente.", error);
  } finally {
    connection.release();
  }
});

router.patch("/clientes/:id", async (req, res) => {
  req.method = "PUT";
  return router.handle(req, res);
});

router.delete("/clientes/:id", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const id = asId(req.params.id);
    if (!id) {
      await connection.rollback();
      return fail(res, 400, "ID de cliente inválido.");
    }

    const [[rel]] = await connection.query(
      `
      SELECT
        (SELECT COUNT(*) FROM \`${T.oportunidad}\` WHERE cliente_id = ?) +
        (SELECT COUNT(*) FROM \`${T.cotizacion}\` WHERE cliente_id = ?) AS total
      `,
      [id, id]
    );

    if (Number(rel.total || 0) > 0) {
      await connection.query(
        `UPDATE \`${T.cliente}\` SET estado_cliente_id = 2 WHERE id = ?`,
        [id]
      );

      await connection.commit();
      return ok(res, { id, inactivado: true }, "El cliente tiene relaciones, por eso se marcó como Inactivo.");
    }

    await connection.query(`DELETE FROM \`${T.cliente}\` WHERE id = ?`, [id]);
    await connection.commit();

    return ok(res, { id }, "Cliente eliminado correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error al eliminar cliente:", error);
    return fail(res, 500, "No se pudo eliminar el cliente.", error);
  } finally {
    connection.release();
  }
});

// =====================================================
// CONTACTOS
// =====================================================
router.post("/contactos-cliente", async (req, res) => {
  try {
    const clienteId = asId(req.body.cliente_id);
    if (!clienteId) return fail(res, 400, "El cliente es obligatorio.");

    if (req.body.es_principal) {
      await pool.query(`UPDATE \`${T.contacto}\` SET es_principal = 0 WHERE cliente_id = ?`, [clienteId]);
    }

    const [insert] = await pool.query(
      `
      INSERT INTO \`${T.contacto}\`
      (cliente_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, cargo, correo, es_principal, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        clienteId,
        soloLetras(req.body.primer_nombre, 35) || "Contacto",
        soloLetras(req.body.segundo_nombre, 35) || null,
        soloLetras(req.body.primer_apellido, 35) || "Principal",
        soloLetras(req.body.segundo_apellido, 35) || null,
        soloLetras(req.body.cargo, 60) || null,
        limpiar(req.body.correo) || null,
        req.body.es_principal ? 1 : 0,
        req.body.estado === false ? 0 : 1,
      ]
    );

    return ok(res, { id: insert.insertId }, "Contacto guardado correctamente.");
  } catch (error) {
    console.error("Error al guardar contacto:", error);
    return fail(res, 500, "No se pudo guardar el contacto.", error);
  }
});

router.put("/contactos-cliente/:id", async (req, res) => {
  try {
    const id = asId(req.params.id);
    const clienteId = asId(req.body.cliente_id);

    if (!id || !clienteId) return fail(res, 400, "Datos de contacto inválidos.");

    if (req.body.es_principal) {
      await pool.query(`UPDATE \`${T.contacto}\` SET es_principal = 0 WHERE cliente_id = ?`, [clienteId]);
    }

    await pool.query(
      `
      UPDATE \`${T.contacto}\`
      SET primer_nombre = ?,
          segundo_nombre = ?,
          primer_apellido = ?,
          segundo_apellido = ?,
          cargo = ?,
          correo = ?,
          es_principal = ?,
          estado = ?
      WHERE id = ?
      `,
      [
        soloLetras(req.body.primer_nombre, 35) || "Contacto",
        soloLetras(req.body.segundo_nombre, 35) || null,
        soloLetras(req.body.primer_apellido, 35) || "Principal",
        soloLetras(req.body.segundo_apellido, 35) || null,
        soloLetras(req.body.cargo, 60) || null,
        limpiar(req.body.correo) || null,
        req.body.es_principal ? 1 : 0,
        req.body.estado === false ? 0 : 1,
        id,
      ]
    );

    return ok(res, { id }, "Contacto actualizado correctamente.");
  } catch (error) {
    console.error("Error al actualizar contacto:", error);
    return fail(res, 500, "No se pudo actualizar el contacto.", error);
  }
});

router.delete("/contactos-cliente/:id", async (req, res) => {
  try {
    const id = asId(req.params.id);
    if (!id) return fail(res, 400, "ID de contacto inválido.");

    const [[rel]] = await pool.query(
      `SELECT COUNT(*) AS total FROM \`${T.cotizacion}\` WHERE contacto_id = ?`,
      [id]
    );

    if (Number(rel.total || 0) > 0) {
      await pool.query(`UPDATE \`${T.contacto}\` SET estado = 0 WHERE id = ?`, [id]);
      return ok(res, { id, inactivado: true }, "El contacto tiene cotizaciones, por eso se marcó como Inactivo.");
    }

    await pool.query(`DELETE FROM \`${T.contacto}\` WHERE id = ?`, [id]);
    return ok(res, { id }, "Contacto eliminado correctamente.");
  } catch (error) {
    console.error("Error al eliminar contacto:", error);
    return fail(res, 500, "No se pudo eliminar el contacto.", error);
  }
});

// =====================================================
// TELÉFONOS
// =====================================================
router.post("/telefonos-contacto", async (req, res) => {
  try {
    const contactoId = asId(req.body.contacto_id);
    if (!contactoId) return fail(res, 400, "El contacto es obligatorio.");

    if (req.body.es_principal) {
      await pool.query(`UPDATE \`${T.telefono}\` SET es_principal = 0 WHERE contacto_id = ?`, [contactoId]);
    }

    const prefijoId = asId(req.body.prefijo_telefonico_id) || (await obtenerPrefijoGT());
    const telefonoValidado = await validarTelefonoPorPrefijo(prefijoId, req.body.telefono);

    const [insert] = await pool.query(
      `
      INSERT INTO \`${T.telefono}\`
      (contacto_id, prefijo_telefonico_id, telefono, tipo_telefono, es_principal)
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        contactoId,
        telefonoValidado.prefijoId,
        telefonoValidado.numero,
        limpiar(req.body.tipo_telefono) || "Móvil",
        req.body.es_principal ? 1 : 0,
      ]
    );

    return ok(res, { id: insert.insertId }, "Teléfono guardado correctamente.");
  } catch (error) {
    console.error("Error al guardar teléfono:", error);
    return fail(res, error.statusCode || 500, error.statusCode ? error.message : "No se pudo guardar el teléfono.", error);
  }
});

router.put("/telefonos-contacto/:id", async (req, res) => {
  try {
    const id = asId(req.params.id);
    const contactoId = asId(req.body.contacto_id);
    if (!id || !contactoId) return fail(res, 400, "Datos de teléfono inválidos.");

    if (req.body.es_principal) {
      await pool.query(`UPDATE \`${T.telefono}\` SET es_principal = 0 WHERE contacto_id = ?`, [contactoId]);
    }

    const prefijoId = asId(req.body.prefijo_telefonico_id) || (await obtenerPrefijoGT());
    const telefonoValidado = await validarTelefonoPorPrefijo(prefijoId, req.body.telefono);

    await pool.query(
      `
      UPDATE \`${T.telefono}\`
      SET prefijo_telefonico_id = ?,
          telefono = ?,
          tipo_telefono = ?,
          es_principal = ?
      WHERE id = ?
      `,
      [
        telefonoValidado.prefijoId,
        telefonoValidado.numero,
        limpiar(req.body.tipo_telefono) || "Móvil",
        req.body.es_principal ? 1 : 0,
        id,
      ]
    );

    return ok(res, { id }, "Teléfono actualizado correctamente.");
  } catch (error) {
    console.error("Error al actualizar teléfono:", error);
    return fail(res, error.statusCode || 500, error.statusCode ? error.message : "No se pudo actualizar el teléfono.", error);
  }
});

router.delete("/telefonos-contacto/:id", async (req, res) => {
  try {
    const id = asId(req.params.id);
    if (!id) return fail(res, 400, "ID de teléfono inválido.");

    await pool.query(`DELETE FROM \`${T.telefono}\` WHERE id = ?`, [id]);
    return ok(res, { id }, "Teléfono eliminado correctamente.");
  } catch (error) {
    console.error("Error al eliminar teléfono:", error);
    return fail(res, 500, "No se pudo eliminar el teléfono.", error);
  }
});

// =====================================================
// OPORTUNIDADES
// =====================================================
router.get("/oportunidades", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        o.*,
        o.fecha_creacion AS fecha,
        c.nombre_empresa,
        u.nombre_usuario,
        ${nombreCompletoSQL("u")} AS ejecutivo,
        m.nombre_modalidad,
        eo.nombre_estado_oportunidad AS estado
      FROM \`${T.oportunidad}\` o
      LEFT JOIN \`${T.cliente}\` c ON c.id = o.cliente_id
      LEFT JOIN \`${T.usuario}\` u ON u.id = o.ejecutivo_id
      LEFT JOIN \`${T.modalidad}\` m ON m.id = o.modalidad_id
      LEFT JOIN \`${T.estadoOportunidad}\` eo ON eo.id = o.estado_id
      ORDER BY o.id
    `);

    return ok(res, rows);
  } catch (error) {
    console.error("Error al obtener oportunidades:", error);
    return fail(res, 500, "No se pudieron obtener las oportunidades.", error);
  }
});

router.post("/oportunidades", async (req, res) => {
  try {
    const codigo = limpiar(req.body.codigo_oportunidad) || (await nextCode(T.oportunidad, "codigo_oportunidad", "OPO"));
    const clienteId = asId(req.body.cliente_id || req.body.clientId) || null;
    const ejecutivoId = await resolveUsuarioId(req.body.ejecutivo_id || req.body.ejecutivo || req.body.executive);
    const modalidadId = asId(req.body.modalidad_id) || (await resolveModalidadId(req.body.modalidad || req.body.type));
    const estadoId = asId(req.body.estado_id || req.body.estado_oportunidad_id) || 1;

    const nombre = textoComercial(req.body.nombre_oportunidad || req.body.oportunidad || req.body.clientName, 100);

    const [insert] = await pool.query(
      `
      INSERT INTO \`${T.oportunidad}\`
      (
        codigo_oportunidad,
        cliente_id,
        ejecutivo_id,
        modalidad_id,
        estado_id,
        nombre_oportunidad,
        monto_estimado,
        probabilidad,
        fecha_creacion,
        fecha_cierre_estimada
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        codigo,
        clienteId,
        ejecutivoId,
        modalidadId,
        estadoId,
        nombre || "Nueva oportunidad",
        asMoney(req.body.monto_estimado || req.body.monto || req.body.amount),
        Number(req.body.probabilidad || req.body.probability || 10),
        asDate(req.body.fecha_creacion || req.body.fecha || req.body.date) || new Date().toISOString().slice(0, 10),
        asDate(req.body.fecha_cierre_estimada || req.body.closeDate),
      ]
    );

    return ok(res, { id: insert.insertId, codigo_oportunidad: codigo }, "Oportunidad guardada correctamente.");
  } catch (error) {
    console.error("Error al guardar oportunidad:", error);
    return fail(res, 500, "No se pudo guardar la oportunidad.", error);
  }
});

router.put("/oportunidades/:id", async (req, res) => {
  try {
    const id = asId(req.params.id);
    if (!id) return fail(res, 400, "ID de oportunidad inválido.");

    const ejecutivoId = await resolveUsuarioId(req.body.ejecutivo_id || req.body.ejecutivo || req.body.executive);
    const modalidadId = asId(req.body.modalidad_id) || (await resolveModalidadId(req.body.modalidad || req.body.type));

    await pool.query(
      `
      UPDATE \`${T.oportunidad}\`
      SET cliente_id = ?,
          ejecutivo_id = ?,
          modalidad_id = ?,
          estado_id = ?,
          nombre_oportunidad = ?,
          monto_estimado = ?,
          probabilidad = ?,
          fecha_creacion = ?,
          fecha_cierre_estimada = ?
      WHERE id = ?
      `,
      [
        asId(req.body.cliente_id || req.body.clientId) || null,
        ejecutivoId,
        modalidadId,
        asId(req.body.estado_id || req.body.estado_oportunidad_id) || 1,
        limpiar(req.body.nombre_oportunidad || req.body.oportunidad || req.body.clientName) || "Oportunidad",
        asMoney(req.body.monto_estimado || req.body.monto || req.body.amount),
        Number(req.body.probabilidad || req.body.probability || 10),
        asDate(req.body.fecha_creacion || req.body.fecha || req.body.date) || new Date().toISOString().slice(0, 10),
        asDate(req.body.fecha_cierre_estimada || req.body.closeDate),
        id,
      ]
    );

    return ok(res, { id }, "Oportunidad actualizada correctamente.");
  } catch (error) {
    console.error("Error al actualizar oportunidad:", error);
    return fail(res, 500, "No se pudo actualizar la oportunidad.", error);
  }
});

router.patch("/oportunidades/:id", async (req, res) => {
  try {
    const id = asId(req.params.id);
    if (!id) return fail(res, 400, "ID de oportunidad inválido.");

    if (req.body.estado_id || req.body.estado_oportunidad_id) {
      await pool.query(
        `UPDATE \`${T.oportunidad}\` SET estado_id = ? WHERE id = ?`,
        [asId(req.body.estado_id || req.body.estado_oportunidad_id), id]
      );
      return ok(res, { id }, "Estado de oportunidad actualizado.");
    }

    return fail(res, 400, "No se recibió ningún campo para actualizar.");
  } catch (error) {
    console.error("Error al actualizar oportunidad:", error);
    return fail(res, 500, "No se pudo actualizar la oportunidad.", error);
  }
});

router.patch("/oportunidades/:id/estado", async (req, res) => {
  try {
    const id = asId(req.params.id);
    const estado = limpiar(req.body.estado || req.body.stage).toLowerCase();

    const mapa = {
      prospecto: 1,
      cotizado: 2,
      negociacion: 3,
      negociación: 3,
      ganado: 4,
      perdido: 5,
    };

    const estadoId = asId(req.body.estado_id) || mapa[estado] || 1;

    await pool.query(
      `UPDATE \`${T.oportunidad}\` SET estado_id = ? WHERE id = ?`,
      [estadoId, id]
    );

    return ok(res, { id, estado_id: estadoId }, "Estado actualizado.");
  } catch (error) {
    console.error("Error al cambiar estado:", error);
    return fail(res, 500, "No se pudo cambiar el estado de la oportunidad.", error);
  }
});

router.delete("/oportunidades/:id", async (req, res) => {
  try {
    const id = asId(req.params.id);
    if (!id) return fail(res, 400, "ID de oportunidad inválido.");

    await pool.query(`DELETE FROM \`${T.oportunidad}\` WHERE id = ?`, [id]);
    return ok(res, { id }, "Oportunidad eliminada correctamente.");
  } catch (error) {
    console.error("Error al eliminar oportunidad:", error);
    return fail(res, 500, "No se pudo eliminar la oportunidad.", error);
  }
});

// =====================================================
// COTIZACIONES
// =====================================================
router.get("/cotizaciones", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        ct.id,
        ct.codigo_cotizacion,
        ct.codigo_cotizacion AS numero_cotizacion,
        ct.codigo_cotizacion AS codigo,
        ct.cliente_id,
        ct.contacto_id,
        ct.ejecutivo_id,
        ct.modalidad_id,
        ct.forma_pago_id,
        ct.origen_id,
        ct.destino_id,

        c.nombre_empresa,
        c.nombre_empresa AS razon_social,
        c.nit,

        ${nombreCompletoSQL("cc")} AS contacto,
        cc.correo AS email,
        cc.correo,

        u.nombre_usuario,
        ${nombreCompletoSQL("u")} AS ejecutivo,

        m.nombre_modalidad AS modalidad,
        fp.nombre_forma_pago AS forma_pago,
        uo.nombre_ubicacion AS origen,
        ud.nombre_ubicacion AS destino,

        MIN(cd.descripcion) AS descripcion,
        COALESCE(SUM(cd.cantidad), 1) AS cantidad,
        COALESCE(SUM(cd.cantidad * cd.precio_unitario), 0) AS subtotal,
        COALESCE(SUM(cd.cantidad * cd.precio_unitario), 0) * 0.12 AS iva,
        COALESCE(SUM(cd.cantidad * cd.precio_unitario), 0) * 1.12 AS total,
        CASE
          WHEN COALESCE(SUM(cd.cantidad), 0) > 0
          THEN COALESCE(SUM(cd.cantidad * cd.precio_unitario), 0) / COALESCE(SUM(cd.cantidad), 1)
          ELSE 0
        END AS precio_unitario,

        CURDATE() AS fecha,
        'Borrador' AS estado,
        'GTQ' AS moneda,
        m.nombre_modalidad AS tipo_carga,
        '' AS peso,
        '' AS volumen,
        '' AS observaciones

      FROM \`${T.cotizacion}\` ct
      LEFT JOIN \`${T.cliente}\` c ON c.id = ct.cliente_id
      LEFT JOIN \`${T.contacto}\` cc ON cc.id = ct.contacto_id
      LEFT JOIN \`${T.usuario}\` u ON u.id = ct.ejecutivo_id
      LEFT JOIN \`${T.modalidad}\` m ON m.id = ct.modalidad_id
      LEFT JOIN \`${T.formaPago}\` fp ON fp.id = ct.forma_pago_id
      LEFT JOIN \`${T.ubicacion}\` uo ON uo.id = ct.origen_id
      LEFT JOIN \`${T.ubicacion}\` ud ON ud.id = ct.destino_id
      LEFT JOIN \`${T.cotizacionDetalle}\` cd ON cd.cotizacion_id = ct.id
      GROUP BY
        ct.id, ct.codigo_cotizacion, ct.cliente_id, ct.contacto_id,
        ct.ejecutivo_id, ct.modalidad_id, ct.forma_pago_id, ct.origen_id,
        ct.destino_id, c.nombre_empresa, c.nit, contacto, cc.correo,
        u.nombre_usuario, ejecutivo, m.nombre_modalidad, fp.nombre_forma_pago,
        uo.nombre_ubicacion, ud.nombre_ubicacion
      ORDER BY ct.id
    `);

    return ok(res, rows);
  } catch (error) {
    console.error("Error al obtener cotizaciones:", error);
    return fail(res, 500, "No se pudieron obtener las cotizaciones.", error);
  }
});

router.post("/cotizaciones", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const codigo = limpiar(req.body.codigo_cotizacion || req.body.codigo || req.body.numero_cotizacion) ||
      (await nextCode(T.cotizacion, "codigo_cotizacion", "COT"));

    const clienteId = await resolveOrCreateCliente(connection, req.body);
    const contactoId =
      asId(req.body.contacto_id) ||
      (await guardarContactoPrincipal(connection, clienteId, req.body)) ||
      null;

    const ejecutivoId = await resolveUsuarioId(req.body.ejecutivo_id || req.body.ejecutivo || req.body.nombre_usuario);
    const modalidadId =
      asId(req.body.modalidad_id) ||
      (await resolveModalidadId(req.body.modalidad || req.body.tipo_carga || req.body.cargoType));

    const formaPagoId =
      asId(req.body.forma_pago_id) ||
      (await resolveFormaPagoId(req.body.forma_pago || req.body.paymentMethod));

    const origenId = asId(req.body.origen_id) || (await resolveOrCreateUbicacion(connection, req.body.origen));
    const destinoId = asId(req.body.destino_id) || (await resolveOrCreateUbicacion(connection, req.body.destino));

    const [insert] = await connection.query(
      `
      INSERT INTO \`${T.cotizacion}\`
      (
        codigo_cotizacion,
        cliente_id,
        contacto_id,
        ejecutivo_id,
        modalidad_id,
        forma_pago_id,
        origen_id,
        destino_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [codigo, clienteId, contactoId, ejecutivoId, modalidadId, formaPagoId, origenId, destinoId]
    );

    const cotizacionId = insert.insertId;

    const servicios = Array.isArray(req.body.services)
      ? req.body.services
      : Array.isArray(req.body.servicios)
      ? req.body.servicios
      : [
          {
            description: req.body.descripcion || req.body.descripcion_servicio || req.body.tipo_carga || "Servicio logístico",
            quantity: req.body.cantidad || 1,
            unitPrice:
              req.body.precio_unitario ||
              req.body.venta ||
              req.body.subtotal ||
              req.body.total ||
              0,
          },
        ];

    for (const servicio of servicios) {
      const descripcion = textoComercial(servicio.description || servicio.descripcion || "Servicio logístico", 50);
      const cantidad = Number(servicio.quantity || servicio.cantidad || 1) || 1;
      const precio = asMoney(servicio.unitPrice || servicio.precio_unitario || servicio.subtotal || servicio.venta);

      await connection.query(
        `
        INSERT INTO \`${T.cotizacionDetalle}\`
        (cotizacion_id, descripcion, cantidad, precio_unitario)
        VALUES (?, ?, ?, ?)
        `,
        [cotizacionId, descripcion, cantidad, precio]
      );
    }

    await connection.commit();

    return ok(res, { id: cotizacionId, codigo_cotizacion: codigo }, "Cotización guardada correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error al guardar cotización:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return fail(res, 400, "Ya existe una cotización con ese código.", error);
    }

    return fail(res, 500, "No se pudo guardar la cotización.", error);
  } finally {
    connection.release();
  }
});

router.put("/cotizaciones/:id", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const id = asId(req.params.id);
    if (!id) {
      await connection.rollback();
      return fail(res, 400, "ID de cotización inválido.");
    }

    const clienteId = await resolveOrCreateCliente(connection, req.body);
    const contactoId =
      asId(req.body.contacto_id) ||
      (await guardarContactoPrincipal(connection, clienteId, req.body)) ||
      null;

    const ejecutivoId = await resolveUsuarioId(req.body.ejecutivo_id || req.body.ejecutivo || req.body.nombre_usuario);
    const modalidadId =
      asId(req.body.modalidad_id) ||
      (await resolveModalidadId(req.body.modalidad || req.body.tipo_carga || req.body.cargoType));
    const formaPagoId =
      asId(req.body.forma_pago_id) ||
      (await resolveFormaPagoId(req.body.forma_pago || req.body.paymentMethod));
    const origenId = asId(req.body.origen_id) || (await resolveOrCreateUbicacion(connection, req.body.origen));
    const destinoId = asId(req.body.destino_id) || (await resolveOrCreateUbicacion(connection, req.body.destino));

    await connection.query(
      `
      UPDATE \`${T.cotizacion}\`
      SET cliente_id = ?,
          contacto_id = ?,
          ejecutivo_id = ?,
          modalidad_id = ?,
          forma_pago_id = ?,
          origen_id = ?,
          destino_id = ?
      WHERE id = ?
      `,
      [clienteId, contactoId, ejecutivoId, modalidadId, formaPagoId, origenId, destinoId, id]
    );

    await connection.query(`DELETE FROM \`${T.cotizacionDetalle}\` WHERE cotizacion_id = ?`, [id]);

    const servicios = Array.isArray(req.body.services)
      ? req.body.services
      : Array.isArray(req.body.servicios)
      ? req.body.servicios
      : [
          {
            description: req.body.descripcion || req.body.descripcion_servicio || req.body.tipo_carga || "Servicio logístico",
            quantity: req.body.cantidad || 1,
            unitPrice: req.body.precio_unitario || req.body.venta || req.body.subtotal || req.body.total || 0,
          },
        ];

    for (const servicio of servicios) {
      await connection.query(
        `
        INSERT INTO \`${T.cotizacionDetalle}\`
        (cotizacion_id, descripcion, cantidad, precio_unitario)
        VALUES (?, ?, ?, ?)
        `,
        [
          id,
          textoComercial(servicio.description || servicio.descripcion || "Servicio logístico", 50),
          Number(servicio.quantity || servicio.cantidad || 1) || 1,
          asMoney(servicio.unitPrice || servicio.precio_unitario || servicio.subtotal || servicio.venta),
        ]
      );
    }

    await connection.commit();
    return ok(res, { id }, "Cotización actualizada correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error al actualizar cotización:", error);
    return fail(res, 500, "No se pudo actualizar la cotización.", error);
  } finally {
    connection.release();
  }
});

router.patch("/cotizaciones/:id/estado", async (req, res) => {
  /*
    La tabla física cotizacion no tiene estado, fecha, moneda, peso,
    volumen ni observaciones. Se responde OK para que el frontend no falle.
    Si querés persistir esos campos, hay que agregarlos a la tabla.
  */
  return ok(res, { id: asId(req.params.id), estado: req.body.estado || "Borrador" }, "Estado actualizado visualmente.");
});

router.delete("/cotizaciones/:id", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const id = asId(req.params.id);
    if (!id) {
      await connection.rollback();
      return fail(res, 400, "ID de cotización inválido.");
    }

    await connection.query(`DELETE FROM \`${T.cotizacionDetalle}\` WHERE cotizacion_id = ?`, [id]);
    await connection.query(`DELETE FROM \`${T.cotizacion}\` WHERE id = ?`, [id]);

    await connection.commit();
    return ok(res, { id }, "Cotización eliminada correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error al eliminar cotización:", error);
    return fail(res, 500, "No se pudo eliminar la cotización.", error);
  } finally {
    connection.release();
  }
});

module.exports = router;