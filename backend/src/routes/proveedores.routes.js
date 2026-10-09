const express = require("express");
const pool = require("../config/db");
const { autorizarModulo } = require("../middleware/auth.middleware");

const router = express.Router();

// El permiso de CRM no concede acceso al directorio de proveedores.
const soloProveedores = autorizarModulo("proveedores");
router.use("/proveedores", soloProveedores);

const T = {
  proveedor: "proveedor",
  contactoProveedor: "contacto_proveedor",
  servicioProveedor: "servicio_proveedor",
  cumplimientoProveedor: "cumplimiento_proveedor",
  desempenoProveedor: "desempeno_proveedor",
  estadoProveedor: "estado_proveedor",
  asignacion: "asignacion",
  proveedorAsignacion: "proveedor_asignacion",
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

const primeraMayuscula = (valor) => {
  const texto = String(valor ?? "");
  return texto.replace(
    /(^\s*)([a-záéíóúüñ])/i,
    (_m, espacios, letra) =>
      `${espacios}${String(letra).toLocaleUpperCase("es-GT")}`
  );
};

const soloLetras = (valor, max = 60) =>
  limpiar(valor)
    .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es-GT")
    .replace(
      /(^|[\s'-])([a-záéíóúüñ])/g,
      (_m, sep, letra) => `${sep}${letra.toLocaleUpperCase("es-GT")}`
    )
    .slice(0, max);

const soloNumeros = (valor, max = 15) =>
  limpiar(valor).replace(/\D/g, "").slice(0, max);

const textoComercial = (valor, max = 120) =>
  primeraMayuscula(
    limpiar(valor)
      .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s.,&()'/-]/g, "")
      .replace(/\s+/g, " ")
      .trim()
  ).slice(0, max);

const asId = (valor) => {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const asDate = (valor) => {
  const v = limpiar(valor);
  if (!v) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    return v.slice(0, 10);
  }

  const parts = v.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${String(y).padStart(4, "20")}-${String(m).padStart(
      2,
      "0"
    )}-${String(d).padStart(2, "0")}`;
  }

  return null;
};

/*
  Genera el siguiente código global de una tabla.
  Para servicios NO se reutiliza el código enviado por el frontend.
*/
const nextCode = async (connection, tabla, campo, prefijo) => {
  const [rows] = await connection.query(
    `
      SELECT
        COALESCE(
          MAX(
            CAST(
              REGEXP_REPLACE(\`${campo}\`, '[^0-9]', '')
              AS UNSIGNED
            )
          ),
          0
        ) + 1 AS siguiente
      FROM \`${tabla}\`
      WHERE \`${campo}\` LIKE ?
    `,
    [`${prefijo}-%`]
  );

  const n = Number(rows[0]?.siguiente || 1);
  return `${prefijo}-${String(n).padStart(3, "0")}`;
};

const queryProveedores = `
  SELECT
    p.id,
    p.codigo_proveedor,
    p.razon_social,
    p.nombre_comercial,
    p.nit,
    p.estado_id,
    p.correo,
    p.telefono,

    COALESCE(ep.nombre_estado_proveedor, 'Activo') AS estado,
    COALESCE(ep.nombre_estado_proveedor, 'Activo') AS nombre_estado_proveedor,

    COALESCE(sp.nombre_servicio_proveedor, '') AS servicio_principal,

    COALESCE(dp.nivel, 'Amarillo') AS desempeno,
    COALESCE(dp.historial, '') AS historial,
    COALESCE(dp.hallazgos, '') AS hallazgos,
    dp.fecha AS fecha_evaluacion,

    COALESCE(cp.estado_sat, 'pendiente') AS estado_sat,
    COALESCE(cp.lista_clinton, 0) AS lista_clinton,
    COALESCE(cp.rtu_validado, 0) AS rtu_validado,
    COALESCE(cp.licencia_validada, 0) AS licencia_validada,
    COALESCE(cp.cuenta_validada, 0) AS cuenta_validada

  FROM \`${T.proveedor}\` p

  LEFT JOIN \`${T.estadoProveedor}\` ep
    ON ep.id = p.estado_id

  LEFT JOIN \`${T.servicioProveedor}\` sp
    ON sp.id = (
      SELECT x.id
      FROM \`${T.servicioProveedor}\` x
      WHERE x.proveedor_id = p.id
      ORDER BY x.es_principal DESC, x.id ASC
      LIMIT 1
    )

  LEFT JOIN \`${T.cumplimientoProveedor}\` cp
    ON cp.id = (
      SELECT x.id
      FROM \`${T.cumplimientoProveedor}\` x
      WHERE x.proveedor_id = p.id
      ORDER BY x.id DESC
      LIMIT 1
    )

  LEFT JOIN \`${T.desempenoProveedor}\` dp
    ON dp.id = (
      SELECT x.id
      FROM \`${T.desempenoProveedor}\` x
      WHERE x.proveedor_id = p.id
      ORDER BY x.fecha DESC, x.id DESC
      LIMIT 1
    )
`;

const obtenerDatosProveedores = async (connection = pool) => {
  const [proveedores] = await connection.query(
    `${queryProveedores} ORDER BY p.id DESC`
  );

  const [contactosProveedor] = await connection.query(
    `SELECT *
     FROM \`${T.contactoProveedor}\`
     ORDER BY proveedor_id, es_principal DESC, id DESC`
  );

  const [serviciosProveedor] = await connection.query(
    `SELECT *
     FROM \`${T.servicioProveedor}\`
     ORDER BY proveedor_id, es_principal DESC, id ASC`
  );

  const [cumplimientosProveedor] = await connection.query(
    `SELECT *
     FROM \`${T.cumplimientoProveedor}\`
     ORDER BY proveedor_id, id DESC`
  );

  const [desempenosProveedor] = await connection.query(
    `SELECT *
     FROM \`${T.desempenoProveedor}\`
     ORDER BY proveedor_id, fecha DESC, id DESC`
  );

  const [estadosProveedor] = await connection.query(
    `SELECT *
     FROM \`${T.estadoProveedor}\`
     ORDER BY id`
  );

  return {
    proveedores,
    contactosProveedor,
    serviciosProveedor,
    cumplimientosProveedor,
    desempenosProveedor,
    estadosProveedor,
  };
};

const guardarProveedor = async (connection, body, proveedorId = null) => {
  const razonSocial = textoComercial(
    body.razon_social ||
      body.nombre_proveedor ||
      body.nombre_empresa ||
      body.proveedor,
    140
  );

  const nombreComercial = textoComercial(
    body.nombre_comercial ||
      body.nombreComercial ||
      razonSocial,
    120
  );

  const nit = limpiar(body.nit);
  const correo = limpiar(body.correo).toLowerCase() || null;
  const telefono = soloNumeros(body.telefono, 15) || null;

  const estadoId =
    asId(body.estado_id || body.estado_proveedor_id) ||
    (limpiar(body.estado).toLowerCase().includes("inactivo") ? 2 : 1);

  if (!razonSocial) {
    const error = new Error(
      "La razón social del proveedor es obligatoria."
    );
    error.statusCode = 400;
    throw error;
  }

  if (!nit) {
    const error = new Error(
      "El NIT del proveedor es obligatorio."
    );
    error.statusCode = 400;
    throw error;
  }

  const [duplicados] = await connection.query(
    `
      SELECT id
      FROM \`${T.proveedor}\`
      WHERE LOWER(nit) = LOWER(?)
        AND id <> COALESCE(?, 0)
      LIMIT 1
    `,
    [nit, asId(proveedorId)]
  );

  if (duplicados.length) {
    const error = new Error(
      "Ya existe otro proveedor con ese NIT."
    );
    error.statusCode = 400;
    throw error;
  }

  let id = asId(proveedorId);

  // =====================================================
  // PROVEEDOR
  // =====================================================
  if (id) {
    const [result] = await connection.query(
      `
        UPDATE \`${T.proveedor}\`
        SET razon_social = ?,
            nombre_comercial = ?,
            nit = ?,
            estado_id = ?,
            correo = ?,
            telefono = ?
        WHERE id = ?
      `,
      [
        razonSocial,
        nombreComercial || null,
        nit,
        estadoId,
        correo,
        telefono,
        id,
      ]
    );

    if (!result.affectedRows) {
      const error = new Error(
        "No se encontró el proveedor."
      );
      error.statusCode = 404;
      throw error;
    }
  } else {
    const codigo =
      limpiar(body.codigo_proveedor) ||
      (await nextCode(
        connection,
        T.proveedor,
        "codigo_proveedor",
        "PROV"
      ));

    const [insert] = await connection.query(
      `
        INSERT INTO \`${T.proveedor}\`
        (
          codigo_proveedor,
          razon_social,
          nombre_comercial,
          nit,
          estado_id,
          correo,
          telefono
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        codigo,
        razonSocial,
        nombreComercial || null,
        nit,
        estadoId,
        correo,
        telefono,
      ]
    );

    id = insert.insertId;
  }

  // =====================================================
  // CONTACTOS
  // =====================================================
  if (Array.isArray(body.contactos)) {
    await connection.query(
      `DELETE FROM \`${T.contactoProveedor}\`
       WHERE proveedor_id = ?`,
      [id]
    );

    const contactos = body.contactos.filter(
      (c) =>
        limpiar(c.primer_nombre) ||
        limpiar(c.primer_apellido)
    );

    for (
      let index = 0;
      index < contactos.length;
      index += 1
    ) {
      const c = contactos[index];

      await connection.query(
        `
          INSERT INTO \`${T.contactoProveedor}\`
          (
            proveedor_id,
            primer_nombre,
            segundo_nombre,
            primer_apellido,
            segundo_apellido,
            cargo,
            correo,
            telefono,
            es_principal,
            estado
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          id,
          soloLetras(c.primer_nombre, 35) || "Contacto",
          soloLetras(c.segundo_nombre, 35) || null,
          soloLetras(c.primer_apellido, 35) || "Principal",
          soloLetras(c.segundo_apellido, 35) || null,
          textoComercial(c.cargo, 60) || null,
          limpiar(c.correo).toLowerCase() || null,
          soloNumeros(c.telefono, 15) || null,
          c.es_principal || index === 0 ? 1 : 0,
          c.estado === false ? 0 : 1,
        ]
      );
    }
  }

  // =====================================================
  // SERVICIOS
  // CORRECCIÓN DEL ERROR Duplicate entry SRV-xxx
  // =====================================================
  if (Array.isArray(body.servicios)) {
    await connection.query(
      `DELETE FROM \`${T.servicioProveedor}\`
       WHERE proveedor_id = ?`,
      [id]
    );

    const servicios = body.servicios.filter((s) =>
      limpiar(s.nombre_servicio_proveedor)
    );

    for (
      let index = 0;
      index < servicios.length;
      index += 1
    ) {
      const s = servicios[index];

      /*
        IMPORTANTE:
        No se utiliza s.codigo_servicio recibido del frontend.

        Siempre se calcula el siguiente código GLOBAL disponible
        en servicio_proveedor. Esto evita reutilizar SRV-042,
        SRV-043, etc.
      */
      const codigo = await nextCode(
        connection,
        T.servicioProveedor,
        "codigo_servicio",
        "SRV"
      );

      await connection.query(
        `
          INSERT INTO \`${T.servicioProveedor}\`
          (
            codigo_servicio,
            es_principal,
            nombre_servicio_proveedor,
            proveedor_id
          )
          VALUES (?, ?, ?, ?)
        `,
        [
          codigo,
          s.es_principal || index === 0 ? 1 : 0,
          textoComercial(
            s.nombre_servicio_proveedor,
            100
          ),
          id,
        ]
      );
    }
  }

  // =====================================================
  // CUMPLIMIENTO
  // =====================================================
  const cumplimiento = body.cumplimiento || {};

  const estadoSatRaw = limpiar(
    cumplimiento.estado_sat ||
      body.estado_sat ||
      "pendiente"
  ).toLowerCase();

  const estadoSat = estadoSatRaw.includes("no")
    ? "no_vigente"
    : estadoSatRaw.includes("vig")
    ? "vigente"
    : "pendiente";

  const [[cumActual]] = await connection.query(
    `
      SELECT id
      FROM \`${T.cumplimientoProveedor}\`
      WHERE proveedor_id = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [id]
  );

  const cumValues = [
    estadoSat,
    cumplimiento.lista_clinton ? 1 : 0,
    cumplimiento.rtu_validado ? 1 : 0,
    cumplimiento.licencia_validada ? 1 : 0,
    cumplimiento.cuenta_validada ? 1 : 0,
  ];

  if (cumActual?.id) {
    await connection.query(
      `
        UPDATE \`${T.cumplimientoProveedor}\`
        SET estado_sat = ?,
            lista_clinton = ?,
            rtu_validado = ?,
            licencia_validada = ?,
            cuenta_validada = ?
        WHERE id = ?
      `,
      [...cumValues, cumActual.id]
    );
  } else {
    await connection.query(
      `
        INSERT INTO \`${T.cumplimientoProveedor}\`
        (
          proveedor_id,
          estado_sat,
          lista_clinton,
          rtu_validado,
          licencia_validada,
          cuenta_validada
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [id, ...cumValues]
    );
  }

  // =====================================================
  // DESEMPEÑO
  // =====================================================
  const desempeno =
    body.desempeno ||
    body.desempenio ||
    {};

  const nivelRaw = limpiar(
    desempeno.nivel ||
      body.nivel ||
      "Amarillo"
  ).toLowerCase();

  const nivel = nivelRaw.includes("verd")
    ? "Verde"
    : nivelRaw.includes("roj")
    ? "Rojo"
    : "Amarillo";

  const [[desActual]] = await connection.query(
    `
      SELECT id
      FROM \`${T.desempenoProveedor}\`
      WHERE proveedor_id = ?
      ORDER BY fecha DESC, id DESC
      LIMIT 1
    `,
    [id]
  );

  const desValues = [
    nivel,
    limpiar(
      desempeno.historial ||
        body.historial
    ) || null,
    limpiar(
      desempeno.hallazgos ||
        body.hallazgos
    ) || null,
    asDate(
      desempeno.fecha ||
        body.fecha_evaluacion
    ) ||
      new Date().toISOString().slice(0, 10),
  ];

  if (desActual?.id) {
    await connection.query(
      `
        UPDATE \`${T.desempenoProveedor}\`
        SET nivel = ?,
            historial = ?,
            hallazgos = ?,
            fecha = ?
        WHERE id = ?
      `,
      [...desValues, desActual.id]
    );
  } else {
    await connection.query(
      `
        INSERT INTO \`${T.desempenoProveedor}\`
        (
          proveedor_id,
          nivel,
          historial,
          hallazgos,
          fecha
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [id, ...desValues]
    );
  }

  return id;
};

// =====================================================
// GET - CARGAR PROVEEDORES
// =====================================================
router.get("/proveedores", async (req, res) => {
  try {
    return ok(
      res,
      await obtenerDatosProveedores()
    );
  } catch (error) {
    console.error(
      "Error al obtener proveedores:",
      error
    );

    return fail(
      res,
      500,
      "No se pudieron obtener los proveedores.",
      error
    );
  }
});

// =====================================================
// POST - CREAR PROVEEDOR
// =====================================================
router.post("/proveedores", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const id = await guardarProveedor(
      connection,
      req.body
    );

    await connection.commit();

    return ok(
      res,
      { id },
      "Proveedor guardado correctamente."
    );
  } catch (error) {
    await connection.rollback();

    console.error(
      "Error al guardar proveedor:",
      error
    );

    if (error.code === "ER_DUP_ENTRY") {
      return fail(
        res,
        400,
        "Ya existe un registro con ese código, NIT o dato único.",
        error
      );
    }

    return fail(
      res,
      error.statusCode || 500,
      error.message ||
        "No se pudo guardar el proveedor.",
      error
    );
  } finally {
    connection.release();
  }
});

// =====================================================
// PUT - ACTUALIZAR PROVEEDOR
// =====================================================
router.put("/proveedores/:id", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const id = asId(req.params.id);

    if (!id) {
      await connection.rollback();

      return fail(
        res,
        400,
        "ID de proveedor inválido."
      );
    }

    await guardarProveedor(
      connection,
      req.body,
      id
    );

    await connection.commit();

    return ok(
      res,
      { id },
      "Proveedor actualizado correctamente."
    );
  } catch (error) {
    await connection.rollback();

    console.error(
      "Error al actualizar proveedor:",
      error
    );

    if (error.code === "ER_DUP_ENTRY") {
      return fail(
        res,
        400,
        "Ya existe un registro con ese código, NIT o dato único.",
        error
      );
    }

    return fail(
      res,
      error.statusCode || 500,
      error.message ||
        "No se pudo actualizar el proveedor.",
      error
    );
  } finally {
    connection.release();
  }
});

// =====================================================
// DELETE - ELIMINAR / INACTIVAR PROVEEDOR
// =====================================================
router.delete("/proveedores/:id", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const id = asId(req.params.id);

    if (!id) {
      await connection.rollback();

      return fail(
        res,
        400,
        "ID de proveedor inválido."
      );
    }

    let relacionados = 0;

    try {
      const [[a]] = await connection.query(
        `
          SELECT COUNT(*) AS total
          FROM \`${T.asignacion}\`
          WHERE proveedor_id = ?
        `,
        [id]
      );

      relacionados += Number(
        a?.total || 0
      );
    } catch (error) {
      // La tabla puede no existir en algunas versiones.
    }

    try {
      const [[pa]] = await connection.query(
        `
          SELECT COUNT(*) AS total
          FROM \`${T.proveedorAsignacion}\`
          WHERE proveedor_id = ?
        `,
        [id]
      );

      relacionados += Number(
        pa?.total || 0
      );
    } catch (error) {
      // La tabla puede no existir en algunas versiones.
    }

    if (relacionados > 0) {
      await connection.query(
        `
          UPDATE \`${T.proveedor}\`
          SET estado_id = 2
          WHERE id = ?
        `,
        [id]
      );

      await connection.commit();

      return ok(
        res,
        {
          id,
          inactivado: true,
        },
        "El proveedor tiene operaciones relacionadas, por eso se marcó como Inactivo."
      );
    }

    await connection.query(
      `DELETE FROM \`${T.contactoProveedor}\`
       WHERE proveedor_id = ?`,
      [id]
    );

    await connection.query(
      `DELETE FROM \`${T.servicioProveedor}\`
       WHERE proveedor_id = ?`,
      [id]
    );

    await connection.query(
      `DELETE FROM \`${T.cumplimientoProveedor}\`
       WHERE proveedor_id = ?`,
      [id]
    );

    await connection.query(
      `DELETE FROM \`${T.desempenoProveedor}\`
       WHERE proveedor_id = ?`,
      [id]
    );

    const [result] = await connection.query(
      `DELETE FROM \`${T.proveedor}\`
       WHERE id = ?`,
      [id]
    );

    if (!result.affectedRows) {
      await connection.rollback();

      return fail(
        res,
        404,
        "No se encontró el proveedor."
      );
    }

    await connection.commit();

    return ok(
      res,
      {
        id,
        eliminado: true,
      },
      "Proveedor eliminado correctamente."
    );
  } catch (error) {
    await connection.rollback();

    console.error(
      "Error al eliminar proveedor:",
      error
    );

    return fail(
      res,
      500,
      "No se pudo eliminar el proveedor.",
      error
    );
  } finally {
    connection.release();
  }
});

module.exports = router;