const express = require("express");
const pool = require("../config/db");

const router = express.Router();

const sqlColumnExists = async (tableName, columnName) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      `,
      [tableName, columnName]
    );

    return Number(rows?.[0]?.total || 0) > 0;
  } catch {
    return false;
  }
};

const sqlTableExists = async (tableName) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      `,
      [tableName]
    );

    return Number(rows?.[0]?.total || 0) > 0;
  } catch {
    return false;
  }
};

const buildClienteExtraSelect = async () => {
  const select = [];

  const clienteEmail = await sqlColumnExists(T.cliente, "email");
  const clienteCorreo = await sqlColumnExists(T.cliente, "correo");
  const clienteTelefono = await sqlColumnExists(T.cliente, "telefono");
  const clienteDireccion = await sqlColumnExists(T.cliente, "direccion");

  if (clienteDireccion) {
    select.push("c.`direccion` AS cliente_direccion");
  } else {
    select.push("NULL AS cliente_direccion");
  }

  if (clienteEmail) {
    select.push("c.`email` AS cliente_email");
  } else if (clienteCorreo) {
    select.push("c.`correo` AS cliente_email");
  } else {
    select.push("NULL AS cliente_email");
  }

  if (clienteTelefono) {
    select.push("c.`telefono` AS cliente_telefono");
  } else if (await sqlTableExists("contacto_cliente")) {
    select.push(`(
      SELECT COALESCE(cc.email, cc.correo, cc.email_contacto, cc.correo_contacto, NULL)
      FROM \`contacto_cliente\` cc
      WHERE cc.cliente_id = c.id
      ORDER BY cc.id
      LIMIT 1
    ) AS cliente_email_contacto`);

    if (await sqlTableExists("telefono_contacto")) {
      select.push(`(
        SELECT
          CASE
            WHEN pt.prefijo IS NOT NULL AND pt.prefijo <> '' THEN CONCAT(pt.prefijo, ' ', tc.telefono)
            ELSE tc.telefono
          END
        FROM \`contacto_cliente\` cc
        INNER JOIN \`telefono_contacto\` tc ON tc.contacto_cliente_id = cc.id
        LEFT JOIN \`prefijo_telefonico\` pt ON pt.id = tc.prefijo_telefonico_id
        WHERE cc.cliente_id = c.id
        ORDER BY tc.id
        LIMIT 1
      ) AS cliente_telefono`);
    } else {
      select.push("NULL AS cliente_telefono");
    }
  } else {
    select.push("NULL AS cliente_telefono");
  }

  return select;
};



/*
  COMPROBANTES GL365 - Base nueva en singular

  Montaje en backend/src/server.js:
  const comprobantesRoutes = require("./routes/comprobantes.routes");
  app.use("/api", comprobantesRoutes);

  Rutas principales:
  GET    /api/comprobantes/bootstrap
  GET    /api/comprobantes
  POST   /api/comprobantes
  PUT    /api/comprobantes/:id
  DELETE /api/comprobantes/:id
  POST   /api/comprobantes/:id/pagos
  DELETE /api/comprobantes/:id/pagos/:pagoId

  Tablas usadas:
  - comprobante
  - detalle_comprobante
  - pago
  - cliente
  - usuario
  - estado_factura
  - forma_pago
*/

const T = {
  comprobante: "comprobante",
  detalle: "detalle_comprobante",
  pago: "pago",
  cliente: "cliente",
  usuario: "usuario",
  estadoFactura: "estado_factura",
  formaPago: "forma_pago",
};

const ok = (res, data = null, message = "Operación realizada correctamente.") =>
  res.json({ ok: true, message, data });

const fail = (res, status, message, error = null) =>
  res.status(status).json({
    ok: false,
    message,
    error: error?.message || error || null,
  });

const limpiar = (value) => String(value ?? "").trim();

const limpiarTexto = (value, max = 255) =>
  limpiar(value)
    .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s.,#&()'/:+\-]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, max);

const limpiarCodigo = (value, max = 20) =>
  limpiar(value)
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, max);

const asId = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};

const asDecimal = (value, fallback = 0) => {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : fallback;
};

const asDate = (value) => {
  const text = limpiar(value);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return null;
};

const round2 = (value) => Number((Number(value) || 0).toFixed(2));

const today = () => new Date().toISOString().slice(0, 10);

const addDays = (dateString, days) => {
  const date = dateString ? new Date(`${dateString}T12:00:00`) : new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const buildFullNameSql = (alias) => `TRIM(CONCAT_WS(' ', ${alias}.primer_nombre, ${alias}.segundo_nombre, ${alias}.primer_apellido, ${alias}.segundo_apellido))`;

const quoteId = (name) => `\`${String(name || "").replace(/`/g, "")}\``;

const getTableColumns = async (tableName) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      `,
      [tableName]
    );

    return rows.map((row) => row.COLUMN_NAME);
  } catch {
    return [];
  }
};

const pickColumn = (columns, options) => {
  const normalized = columns.map((column) => ({
    original: column,
    clean: String(column).toLowerCase(),
  }));

  for (const option of options) {
    const found = normalized.find((column) => column.clean === String(option).toLowerCase());
    if (found) return found.original;
  }

  return null;
};

const buildClienteContactPdfSql = async () => {
  const contactoCols = await getTableColumns("contacto_cliente");
  const telefonoCols = await getTableColumns("telefono_contacto");
  const prefijoCols = await getTableColumns("prefijo_telefonico");

  const contactoClienteIdCol = pickColumn(contactoCols, [
    "cliente_id",
    "id_cliente",
  ]);

  const contactoEmailCol = pickColumn(contactoCols, [
    "email",
    "correo",
    "correo_electronico",
    "email_contacto",
    "correo_contacto",
    "mail",
  ]);

  const telefonoContactoIdCol = pickColumn(telefonoCols, [
    "contacto_cliente_id",
    "contacto_id",
    "id_contacto_cliente",
  ]);

  const telefonoNumeroCol = pickColumn(telefonoCols, [
    "telefono",
    "numero_telefono",
    "telefono_contacto",
    "numero",
  ]);

  const telefonoPrefijoIdCol = pickColumn(telefonoCols, [
    "prefijo_telefonico_id",
    "prefijo_id",
    "id_prefijo_telefonico",
  ]);

  const prefijoIdCol = pickColumn(prefijoCols, ["id"]);
  const prefijoValorCol = pickColumn(prefijoCols, [
    "prefijo",
    "codigo_pais",
    "codigo_prefijo",
    "codigo",
  ]);

  const clienteEmailSql =
    contactoClienteIdCol && contactoEmailCol
      ? `(
        SELECT cc.${quoteId(contactoEmailCol)}
        FROM contacto_cliente cc
        WHERE cc.${quoteId(contactoClienteIdCol)} = cl.id
          AND cc.${quoteId(contactoEmailCol)} IS NOT NULL
          AND cc.${quoteId(contactoEmailCol)} <> ''
        ORDER BY cc.id ASC
        LIMIT 1
      ) AS cliente_email`
      : "NULL AS cliente_email";

  let clienteTelefonoSql = "NULL AS cliente_telefono";

  if (contactoClienteIdCol && telefonoContactoIdCol && telefonoNumeroCol) {
    const telefonoExpr =
      telefonoPrefijoIdCol && prefijoIdCol && prefijoValorCol
        ? `CASE
            WHEN pt.${quoteId(prefijoValorCol)} IS NOT NULL AND pt.${quoteId(prefijoValorCol)} <> ''
              THEN CONCAT(pt.${quoteId(prefijoValorCol)}, ' ', tc.${quoteId(telefonoNumeroCol)})
            ELSE tc.${quoteId(telefonoNumeroCol)}
          END`
        : `tc.${quoteId(telefonoNumeroCol)}`;

    const prefijoJoin =
      telefonoPrefijoIdCol && prefijoIdCol && prefijoValorCol
        ? `LEFT JOIN prefijo_telefonico pt ON pt.${quoteId(prefijoIdCol)} = tc.${quoteId(telefonoPrefijoIdCol)}`
        : "";

    clienteTelefonoSql = `(
        SELECT ${telefonoExpr}
        FROM contacto_cliente cc
        INNER JOIN telefono_contacto tc ON tc.${quoteId(telefonoContactoIdCol)} = cc.id
        ${prefijoJoin}
        WHERE cc.${quoteId(contactoClienteIdCol)} = cl.id
          AND tc.${quoteId(telefonoNumeroCol)} IS NOT NULL
          AND tc.${quoteId(telefonoNumeroCol)} <> ''
        ORDER BY cc.id ASC, tc.id ASC
        LIMIT 1
      ) AS cliente_telefono`;
  }

  return {
    clienteEmailSql,
    clienteTelefonoSql,
  };
};


const getCatalogos = async () => {
  const [clientes] = await pool.query(`
    SELECT id, codigo_cliente, nombre_empresa, nit, direccion, estado_cliente_id
    FROM \`${T.cliente}\`
    ORDER BY nombre_empresa ASC
  `);

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
      rol_id,
      ${buildFullNameSql("u")} AS nombre_completo
    FROM \`${T.usuario}\` u
    WHERE activo = 1
    ORDER BY primer_nombre ASC, primer_apellido ASC
  `);

  const [estadosFactura] = await pool.query(`
    SELECT id, codigo_estado, nombre_estado_factura
    FROM \`${T.estadoFactura}\`
    ORDER BY id ASC
  `);

  const [formasPago] = await pool.query(`
    SELECT id, codigo_forma_pago, nombre_forma_pago
    FROM \`${T.formaPago}\`
    ORDER BY id ASC
  `);

  return {
    clientes,
    usuarios,
    estadosFactura,
    formasPago,
  };
};

const getComprobantes = async () => {
  const { clienteEmailSql, clienteTelefonoSql } = await buildClienteContactPdfSql();

  const [rows] = await pool.query(`
    SELECT
      c.id,
      c.numero_comprobante,
      c.serie,
      c.cliente_id,
      c.usuario_id,
      DATE_FORMAT(c.fecha_emision, '%Y-%m-%d') AS fecha_emision,
      DATE_FORMAT(c.fecha_vencimiento, '%Y-%m-%d') AS fecha_vencimiento,
      COALESCE(c.subtotal, 0) AS subtotal,
      COALESCE(c.iva, 0) AS iva,
      COALESCE(c.total, 0) AS total,
      c.estado_id,
      c.forma_pago_id,
      c.observaciones,
      c.created_at,
      c.updated_at,

      cl.codigo_cliente,
      cl.nombre_empresa AS cliente,
      cl.nit AS cliente_nit,
      cl.direccion AS cliente_direccion,

      ${clienteEmailSql},
      ${clienteTelefonoSql},

      ${buildFullNameSql("u")} AS usuario,
      u.nombre_usuario,
      u.email AS usuario_email,

      ef.codigo_estado AS estado_codigo,
      ef.nombre_estado_factura AS estado,

      fp.codigo_forma_pago,
      fp.nombre_forma_pago AS forma_pago,

      COALESCE((
        SELECT SUM(p.monto)
        FROM \`${T.pago}\` p
        WHERE p.comprobante_id = c.id
      ), 0) AS pagado,

      GREATEST(COALESCE(c.total, 0) - COALESCE((
        SELECT SUM(p.monto)
        FROM \`${T.pago}\` p
        WHERE p.comprobante_id = c.id
      ), 0), 0) AS saldo
    FROM \`${T.comprobante}\` c
    LEFT JOIN \`${T.cliente}\` cl ON cl.id = c.cliente_id
    LEFT JOIN \`${T.usuario}\` u ON u.id = c.usuario_id
    LEFT JOIN \`${T.estadoFactura}\` ef ON ef.id = c.estado_id
    LEFT JOIN \`${T.formaPago}\` fp ON fp.id = c.forma_pago_id
    ORDER BY c.id DESC
  `);

  return rows;
};

const getDetalles = async (comprobanteId = null) => {
  const params = [];
  let where = "";

  if (comprobanteId) {
    where = "WHERE comprobante_id = ?";
    params.push(comprobanteId);
  }

  const [rows] = await pool.query(
    `
    SELECT
      id,
      comprobante_id,
      descripcion,
      cantidad,
      unidad,
      precio_unitario,
      impuesto,
      descuento,
      total
    FROM \`${T.detalle}\`
    ${where}
    ORDER BY id ASC
    `,
    params
  );

  return rows;
};

const getPagos = async (comprobanteId = null) => {
  const params = [];
  let where = "";

  if (comprobanteId) {
    where = "WHERE p.comprobante_id = ?";
    params.push(comprobanteId);
  }

  const [rows] = await pool.query(
    `
    SELECT
      p.id,
      p.comprobante_id,
      p.monto,
      DATE_FORMAT(p.fecha_pago, '%Y-%m-%d') AS fecha_pago,
      p.forma_pago_id,
      p.referencia,
      p.created_at,
      fp.nombre_forma_pago AS forma_pago
    FROM \`${T.pago}\` p
    LEFT JOIN \`${T.formaPago}\` fp ON fp.id = p.forma_pago_id
    ${where}
    ORDER BY p.fecha_pago DESC, p.id DESC
    `,
    params
  );

  return rows;
};

const findEstadoId = async (connection, codes = [], names = []) => {
  const codeList = codes.filter(Boolean).map((item) => String(item).toUpperCase());
  const nameList = names.filter(Boolean).map((item) => String(item).toLowerCase());

  if (codeList.length) {
    const [rows] = await connection.query(
      `SELECT id FROM \`${T.estadoFactura}\` WHERE UPPER(codigo_estado) IN (?) ORDER BY id LIMIT 1`,
      [codeList]
    );

    if (rows.length) return rows[0].id;
  }

  for (const name of nameList) {
    const [rows] = await connection.query(
      `SELECT id FROM \`${T.estadoFactura}\` WHERE LOWER(nombre_estado_factura) LIKE ? ORDER BY id LIMIT 1`,
      [`%${name}%`]
    );

    if (rows.length) return rows[0].id;
  }

  return null;
};

const nextComprobanteNumber = async (connection) => {
  const [rows] = await connection.query(
    `SELECT numero_comprobante FROM \`${T.comprobante}\``
  );

  let max = 0;

  rows.forEach((row) => {
    const match = String(row.numero_comprobante || "").match(/(\d+)$/);
    if (match) max = Math.max(max, Number(match[1]));
  });

  return String(max + 1).padStart(6, "0");
};

const normalizeDetail = (detail) => {
  const descripcion = limpiarTexto(detail.descripcion, 180);
  const cantidad = asDecimal(detail.cantidad, 0);
  const unidad = limpiarCodigo(detail.unidad || "UN", 20) || "UN";
  const precioUnitario = asDecimal(detail.precio_unitario, -1);
  const descuentoPorcentaje = Math.min(100, Math.max(0, asDecimal(detail.descuento_porcentaje, 0)));

  if (!descripcion) throw new Error("Cada línea debe tener descripción.");
  if (cantidad <= 0) throw new Error("Cada línea debe tener cantidad mayor a 0.");
  if (precioUnitario < 0) throw new Error("El precio unitario no puede ser negativo.");

  const bruto = round2(cantidad * precioUnitario);
  const descuento = round2(bruto * (descuentoPorcentaje / 100));
  const base = round2(bruto - descuento);
  const impuesto = round2(base * 0.12);
  const total = round2(base + impuesto);

  return {
    descripcion,
    cantidad,
    unidad,
    precio_unitario: precioUnitario,
    impuesto,
    descuento,
    total,
    bruto,
    base,
  };
};

const calcularTotales = (details = []) => {
  if (!Array.isArray(details) || details.length === 0) {
    throw new Error("Agrega al menos una línea de servicio al comprobante.");
  }

  const detalles = details.map(normalizeDetail);

  const subtotal = round2(detalles.reduce((sum, item) => sum + item.base, 0));
  const iva = round2(detalles.reduce((sum, item) => sum + item.impuesto, 0));
  const total = round2(detalles.reduce((sum, item) => sum + item.total, 0));
  const descuento = round2(detalles.reduce((sum, item) => sum + item.descuento, 0));
  const bruto = round2(detalles.reduce((sum, item) => sum + item.bruto, 0));

  return {
    detalles,
    subtotal,
    iva,
    total,
    descuento,
    bruto,
  };
};

const updateEstadoPorPagos = async (connection, comprobanteId) => {
  const [[row]] = await connection.query(
    `
    SELECT
      c.total,
      DATE_FORMAT(c.fecha_vencimiento, '%Y-%m-%d') AS fecha_vencimiento,
      COALESCE((SELECT SUM(p.monto) FROM \`${T.pago}\` p WHERE p.comprobante_id = c.id), 0) AS pagado
    FROM \`${T.comprobante}\` c
    WHERE c.id = ?
    LIMIT 1
    `,
    [comprobanteId]
  );

  if (!row) return null;

  const total = asDecimal(row.total, 0);
  const pagado = asDecimal(row.pagado, 0);
  const vencimiento = row.fecha_vencimiento;

  let estadoId = null;

  if (pagado >= total && total > 0) {
    estadoId = await findEstadoId(connection, ["PAG"], ["pagada"]);
  } else if (pagado > 0) {
    estadoId = await findEstadoId(connection, ["PARC"], ["parcial"]);
  } else if (vencimiento && vencimiento < today()) {
    estadoId = await findEstadoId(connection, ["VENC"], ["vencida"]);
  } else {
    estadoId = await findEstadoId(connection, ["PEND"], ["pendiente"]);
  }

  if (estadoId) {
    await connection.query(
      `UPDATE \`${T.comprobante}\` SET estado_id = ? WHERE id = ?`,
      [estadoId, comprobanteId]
    );
  }

  return estadoId;
};

const saveComprobante = async (connection, body, id = null) => {
  const serie = limpiarCodigo(body.serie || "GL365-A", 15) || "GL365-A";
  const clienteId = asId(body.cliente_id);
  const usuarioId = asId(body.usuario_id);
  const fechaEmision = asDate(body.fecha_emision) || today();
  const fechaVencimiento = asDate(body.fecha_vencimiento) || addDays(fechaEmision, 15);
  const formaPagoId = asId(body.forma_pago_id);
  const observaciones = limpiarTexto(body.observaciones, 255);
  const estadoId = asId(body.estado_id) || (await findEstadoId(connection, ["PEND"], ["pendiente"]));
  const numero = id ? limpiarCodigo(body.numero_comprobante, 20) : (limpiarCodigo(body.numero_comprobante, 20) || (await nextComprobanteNumber(connection)));
  const totals = calcularTotales(body.detalles || []);

  if (!clienteId) throw new Error("Selecciona un cliente.");
  if (!usuarioId) throw new Error("Selecciona un emisor.");
  if (!formaPagoId) throw new Error("Selecciona la forma de pago.");
  if (!estadoId) throw new Error("Selecciona el estado del comprobante.");

  const [[duplicate]] = await connection.query(
    `
    SELECT id
    FROM \`${T.comprobante}\`
    WHERE serie = ?
      AND numero_comprobante = ?
      ${id ? "AND id <> ?" : ""}
    LIMIT 1
    `,
    id ? [serie, numero, id] : [serie, numero]
  );

  if (duplicate) {
    throw new Error("Ya existe un comprobante con esa serie y número.");
  }

  let comprobanteId = id;

  if (id) {
    const [[current]] = await connection.query(
      `SELECT id FROM \`${T.comprobante}\` WHERE id = ? LIMIT 1`,
      [id]
    );

    if (!current) throw new Error("El comprobante no existe.");

    await connection.query(
      `
      UPDATE \`${T.comprobante}\`
      SET numero_comprobante = ?,
          serie = ?,
          cliente_id = ?,
          usuario_id = ?,
          fecha_emision = ?,
          fecha_vencimiento = ?,
          subtotal = ?,
          iva = ?,
          total = ?,
          estado_id = ?,
          forma_pago_id = ?,
          observaciones = ?
      WHERE id = ?
      `,
      [
        numero,
        serie,
        clienteId,
        usuarioId,
        fechaEmision,
        fechaVencimiento,
        totals.subtotal,
        totals.iva,
        totals.total,
        estadoId,
        formaPagoId,
        observaciones,
        id,
      ]
    );

    await connection.query(`DELETE FROM \`${T.detalle}\` WHERE comprobante_id = ?`, [id]);
  } else {
    const [result] = await connection.query(
      `
      INSERT INTO \`${T.comprobante}\`
      (numero_comprobante, serie, cliente_id, usuario_id, fecha_emision, fecha_vencimiento, subtotal, iva, total, estado_id, forma_pago_id, observaciones)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        numero,
        serie,
        clienteId,
        usuarioId,
        fechaEmision,
        fechaVencimiento,
        totals.subtotal,
        totals.iva,
        totals.total,
        estadoId,
        formaPagoId,
        observaciones,
      ]
    );

    comprobanteId = result.insertId;
  }

  for (const item of totals.detalles) {
    await connection.query(
      `
      INSERT INTO \`${T.detalle}\`
      (comprobante_id, descripcion, cantidad, unidad, precio_unitario, impuesto, descuento, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        comprobanteId,
        item.descripcion,
        item.cantidad,
        item.unidad,
        item.precio_unitario,
        item.impuesto,
        item.descuento,
        item.total,
      ]
    );
  }

  await updateEstadoPorPagos(connection, comprobanteId);

  return {
    id: comprobanteId,
    numero_comprobante: numero,
    serie,
    ...totals,
  };
};

router.get("/comprobantes/bootstrap", async (req, res) => {
  try {
    const [catalogos, comprobantes, detalles, pagos] = await Promise.all([
      getCatalogos(),
      getComprobantes(),
      getDetalles(),
      getPagos(),
    ]);

    return ok(res, {
      ...catalogos,
      comprobantes,
      detalles,
      pagos,
    });
  } catch (error) {
    console.error("Error /comprobantes/bootstrap:", error);
    return fail(res, 500, "No se pudo cargar Comprobantes desde MySQL.", error);
  }
});

router.get("/comprobantes", async (req, res) => {
  try {
    return ok(res, await getComprobantes());
  } catch (error) {
    console.error("Error GET /comprobantes:", error);
    return fail(res, 500, "No se pudieron obtener los comprobantes.", error);
  }
});

router.get("/comprobantes/:id", async (req, res) => {
  try {
    const id = asId(req.params.id);
    if (!id) return fail(res, 400, "ID de comprobante inválido.");

    const comprobantes = await getComprobantes();
    const comprobante = comprobantes.find((item) => Number(item.id) === Number(id));

    if (!comprobante) return fail(res, 404, "El comprobante no existe.");

    const [detalles, pagos] = await Promise.all([getDetalles(id), getPagos(id)]);

    return ok(res, { comprobante, detalles, pagos });
  } catch (error) {
    console.error("Error GET /comprobantes/:id:", error);
    return fail(res, 500, "No se pudo obtener el comprobante.", error);
  }
});

router.post("/comprobantes", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const result = await saveComprobante(connection, req.body);

    await connection.commit();

    return ok(res, result, "Comprobante guardado correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error POST /comprobantes:", error);
    const status = String(error?.message || "").includes("Ya existe") ? 409 : 500;
    return fail(res, status, error?.message || "No se pudo guardar el comprobante.", error);
  } finally {
    connection.release();
  }
});

router.put("/comprobantes/:id", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const id = asId(req.params.id);
    if (!id) return fail(res, 400, "ID de comprobante inválido.");

    await connection.beginTransaction();

    const result = await saveComprobante(connection, req.body, id);

    await connection.commit();

    return ok(res, result, "Comprobante actualizado correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error PUT /comprobantes/:id:", error);
    const status = String(error?.message || "").includes("Ya existe") ? 409 : 500;
    return fail(res, status, error?.message || "No se pudo actualizar el comprobante.", error);
  } finally {
    connection.release();
  }
});

router.delete("/comprobantes/:id", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const id = asId(req.params.id);
    if (!id) return fail(res, 400, "ID de comprobante inválido.");

    await connection.beginTransaction();

    await connection.query(`DELETE FROM \`${T.pago}\` WHERE comprobante_id = ?`, [id]);
    await connection.query(`DELETE FROM \`${T.detalle}\` WHERE comprobante_id = ?`, [id]);
    const [result] = await connection.query(`DELETE FROM \`${T.comprobante}\` WHERE id = ?`, [id]);

    if (!result.affectedRows) {
      await connection.rollback();
      return fail(res, 404, "El comprobante no existe.");
    }

    await connection.commit();

    return ok(res, { id }, "Comprobante eliminado correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error DELETE /comprobantes/:id:", error);
    return fail(res, 500, "No se pudo eliminar el comprobante.", error);
  } finally {
    connection.release();
  }
});

router.post("/comprobantes/:id/pagos", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const id = asId(req.params.id);
    if (!id) return fail(res, 400, "ID de comprobante inválido.");

    const monto = asDecimal(req.body.monto, -1);
    const fechaPago = asDate(req.body.fecha_pago) || today();
    const formaPagoId = asId(req.body.forma_pago_id);
    const referencia = limpiarTexto(req.body.referencia, 60);

    if (monto <= 0) throw new Error("El monto del pago debe ser mayor a 0.");
    if (!formaPagoId) throw new Error("Selecciona la forma de pago del abono.");

    await connection.beginTransaction();

    const [[comprobante]] = await connection.query(
      `SELECT id FROM \`${T.comprobante}\` WHERE id = ? LIMIT 1`,
      [id]
    );

    if (!comprobante) throw new Error("El comprobante no existe.");

    const [result] = await connection.query(
      `
      INSERT INTO \`${T.pago}\`
      (comprobante_id, monto, fecha_pago, forma_pago_id, referencia)
      VALUES (?, ?, ?, ?, ?)
      `,
      [id, monto, fechaPago, formaPagoId, referencia]
    );

    await updateEstadoPorPagos(connection, id);

    await connection.commit();

    return ok(res, { id: result.insertId, comprobante_id: id }, "Pago registrado correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error POST /comprobantes/:id/pagos:", error);
    return fail(res, 500, "No se pudo registrar el pago.", error);
  } finally {
    connection.release();
  }
});

router.delete("/comprobantes/:id/pagos/:pagoId", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const comprobanteId = asId(req.params.id);
    const pagoId = asId(req.params.pagoId);

    if (!comprobanteId || !pagoId) return fail(res, 400, "ID inválido.");

    await connection.beginTransaction();

    await connection.query(
      `DELETE FROM \`${T.pago}\` WHERE id = ? AND comprobante_id = ?`,
      [pagoId, comprobanteId]
    );

    await updateEstadoPorPagos(connection, comprobanteId);

    await connection.commit();

    return ok(res, { id: pagoId, comprobante_id: comprobanteId }, "Pago eliminado correctamente.");
  } catch (error) {
    await connection.rollback();
    console.error("Error DELETE pago comprobante:", error);
    return fail(res, 500, "No se pudo eliminar el pago.", error);
  } finally {
    connection.release();
  }
});

module.exports = router;