const express = require("express");
const pool = require("../config/db");

const router = express.Router();

const safeQuery = async (label, sql, params = []) => {
  try {
    const [rows] = await pool.query(sql, params);
    return { rows, error: null };
  } catch (error) {
    const message = error?.sqlMessage || error?.message || "Error desconocido";
    console.error(`Error Reportes · ${label}:`, message);
    return { rows: [], error: { tabla: label, error: message } };
  }
};

const q = (label, sql, params = []) => safeQuery(label, sql, params);

router.get("/reportes/bootstrap", async (_req, res) => {
  try {
    const results = await Promise.all([
      q("cliente", `
        SELECT id, codigo_cliente, nombre_empresa, nit, direccion, estado_cliente_id,
               DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS created_at,
               DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s') AS updated_at
        FROM cliente
        ORDER BY id
      `),

      q("usuario", `
        SELECT id, activo, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
               nombre_usuario, email, rol_id,
               TRIM(CONCAT_WS(' ', primer_nombre, segundo_nombre, primer_apellido, segundo_apellido)) AS nombre_completo
        FROM usuario
        ORDER BY primer_nombre, primer_apellido
      `),

      q("ubicacion", `
        SELECT id, codigo_ubicacion, nombre_ubicacion, pais,
               DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS created_at
        FROM ubicacion
        ORDER BY nombre_ubicacion, id
      `),

      q("ruta", `
        SELECT id, codigo_ruta, nombre_ruta, origen_id, destino_id,
               COALESCE(distancia_km, 0) AS distancia_km,
               COALESCE(tiempo, 0) AS tiempo,
               COALESCE(costo, 0) AS costo,
               frecuencia_id, estado_id,
               DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS created_at,
               DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s') AS updated_at
        FROM ruta
        ORDER BY id
      `),

      q("asignacion", `
        SELECT id, codigo_asignacion, cliente_id, ruta_id, vehiculo_id, piloto_id,
               piloto_id AS pilotos_id, proveedor_id,
               DATE_FORMAT(fecha_carga, '%Y-%m-%d') AS fecha_carga,
               DATE_FORMAT(fecha_descarga, '%Y-%m-%d') AS fecha_descarga,
               estado_asignacion_id
        FROM asignacion
        ORDER BY id
      `),

      q("costo_asignacion", `
        SELECT id, asignacion_id,
               COALESCE(flete, 0) AS flete,
               COALESCE(parada_adicional, 0) AS parada_adicional,
               COALESCE(movimiento_falso, 0) AS movimiento_falso,
               COALESCE(estadia, 0) AS estadia,
               COALESCE(viaje_doble, 0) AS viaje_doble,
               COALESCE(otros, 0) AS otros,
               COALESCE(total, 0) AS total
        FROM costo_asignacion
        ORDER BY id
      `),

      q("proveedor_asignacion", `
        SELECT id, asignacion_id, asignacion_id AS asignaciones_id,
               proveedor_id, proveedor_id AS proveedores_id,
               DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
               serie, numero,
               COALESCE(flete, 0) AS flete,
               COALESCE(cuadrilla, 0) AS cuadrilla,
               COALESCE(estadia, 0) AS estadia,
               COALESCE(total, 0) AS total,
               DATE_FORMAT(fecha_pago, '%Y-%m-%d') AS fecha_pago
        FROM proveedor_asignacion
        ORDER BY id
      `),

      q("factura_asignacion", `
        SELECT id, asignacion_id, asignacion_id AS asignaciones_id,
               DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
               serie, numero,
               COALESCE(valor, 0) AS valor,
               DATE_FORMAT(fecha_pago, '%Y-%m-%d') AS fecha_pago
        FROM factura_asignacion
        ORDER BY id
      `),

      q("proveedor", `
        SELECT id, codigo_proveedor, razon_social, nombre_comercial, nit, estado_id, correo, telefono,
               DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS created_at
        FROM proveedor
        ORDER BY id
      `),

      q("cumplimiento_proveedor", `
        SELECT id, proveedor_id, estado_sat, lista_clinton, rtu_validado, licencia_validada, cuenta_validada
        FROM cumplimiento_proveedor
        ORDER BY id
      `),

      q("desempeno_proveedor", `
        SELECT id, proveedor_id, nivel, historial, hallazgos,
               DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha
        FROM desempeno_proveedor
        ORDER BY fecha DESC, id DESC
      `),

      q("comprobante", `
        SELECT id, numero_comprobante, serie, cliente_id, usuario_id,
               DATE_FORMAT(fecha_emision, '%Y-%m-%d') AS fecha_emision,
               DATE_FORMAT(fecha_vencimiento, '%Y-%m-%d') AS fecha_vencimiento,
               COALESCE(subtotal, 0) AS subtotal,
               COALESCE(iva, 0) AS iva,
               COALESCE(total, 0) AS total,
               estado_id, forma_pago_id, observaciones,
               DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS created_at,
               DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s') AS updated_at
        FROM comprobante
        ORDER BY id DESC
      `),

      q("detalle_comprobante", `
        SELECT id, comprobante_id, descripcion,
               COALESCE(cantidad, 0) AS cantidad,
               unidad,
               COALESCE(precio_unitario, 0) AS precio_unitario,
               COALESCE(impuesto, 0) AS impuesto,
               COALESCE(descuento, 0) AS descuento,
               COALESCE(total, 0) AS total
        FROM detalle_comprobante
        ORDER BY id
      `),

      q("pago", `
        SELECT id, comprobante_id, COALESCE(monto, 0) AS monto,
               DATE_FORMAT(fecha_pago, '%Y-%m-%d') AS fecha_pago,
               forma_pago_id, referencia,
               DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS created_at
        FROM pago
        ORDER BY fecha_pago DESC, id DESC
      `),

      q("estado_factura", `
        SELECT id, codigo_estado, nombre_estado_factura
        FROM estado_factura
        ORDER BY id
      `),

      q("forma_pago", `
        SELECT id, codigo_forma_pago, nombre_forma_pago
        FROM forma_pago
        ORDER BY id
      `),

      q("viaje", `
        SELECT id, codigo, cliente_id, cliente_id AS clientes_id,
               ruta_id, ruta_id AS rutas_id,
               unidad_id, unidad_id AS unidades_id,
               piloto_id, piloto_id AS pilotos_id,
               DATE_FORMAT(fecha_salida, '%Y-%m-%dT%H:%i:%s') AS fecha_salida,
               DATE_FORMAT(eta, '%Y-%m-%dT%H:%i:%s') AS eta,
               COALESCE(progreso, 0) AS progreso,
               DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS created_at,
               envio_id, envio_id AS envios_id
        FROM viaje
        ORDER BY id DESC
      `),

      q("envio", `
        SELECT id, codigo, cliente_id, origen_id, destino_id, direccion,
               DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
               estado_id, observaciones,
               DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS created_at
        FROM envio
        ORDER BY id DESC
      `),

      q("tracking_viaje", `
        SELECT id, viaje_id, viaje_id AS viajes_id, latitud, longitud, estado_id,
               COALESCE(porcentaje, 0) AS porcentaje,
               DATE_FORMAT(fecha, '%Y-%m-%dT%H:%i:%s') AS fecha
        FROM tracking_viaje
        ORDER BY fecha DESC, id DESC
      `),

      q("estado_envio", `
        SELECT id, codigo_estado, nombre_estado_envio
        FROM estado_envio
        ORDER BY id
      `),

      q("alerta", `
        SELECT id, viaje_id, viaje_id AS viajes_id, tipo, descripcion, nivel, leida,
               DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS created_at
        FROM alerta
        ORDER BY created_at DESC, id DESC
      `),

      q("oportunidad", `
        SELECT id, codigo_oportunidad, cliente_id, ejecutivo_id, modalidad_id, estado_id,
               nombre_oportunidad,
               COALESCE(monto_estimado, 0) AS monto_estimado,
               COALESCE(probabilidad, 0) AS probabilidad,
               DATE_FORMAT(fecha_creacion, '%Y-%m-%d') AS fecha_creacion,
               DATE_FORMAT(fecha_cierre_estimada, '%Y-%m-%d') AS fecha_cierre_estimada,
               DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS created_at,
               DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s') AS updated_at
        FROM oportunidad
        ORDER BY id DESC
      `),

      q("cotizacion", `
        SELECT id, codigo_cotizacion, cliente_id, contacto_id, ejecutivo_id, modalidad_id,
               forma_pago_id, origen_id, destino_id, NULL AS fecha_ui, NULL AS estado_ui
        FROM cotizacion
        ORDER BY id DESC
      `),

      q("cotizacion_detalle", `
        SELECT id, cotizacion_id, descripcion,
               COALESCE(cantidad, 0) AS cantidad,
               COALESCE(precio_unitario, 0) AS precio_unitario
        FROM cotizacion_detalle
        ORDER BY id
      `),

      q("vehiculo", `
        SELECT id, codigo, tipo_id, estado_id,
               COALESCE(eficiencia, 0) AS eficiencia,
               COALESCE(kilometraje, 0) AS kilometraje,
               estado_mantenimiento_id,
               estado_mantenimiento_id AS estados_mantenimiento_id,
               DATE_FORMAT(proximo_mantenimiento, '%Y-%m-%d') AS proximo_mantenimiento,
               DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS created_at,
               DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s') AS updated_at
        FROM vehiculo
        ORDER BY id
      `),

      q("mantenimiento", `
        SELECT id, codigo_mantenimiento, vehiculo_id, tipo, descripcion,
               DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
               DATE_FORMAT(proximo, '%Y-%m-%d') AS proximo,
               estado_id,
               COALESCE(costo, 0) AS costo
        FROM mantenimiento
        ORDER BY fecha DESC, id DESC
      `),

      q("estado_mantenimiento", `
        SELECT id, codigo_estado, nombre_estado_mantenimiento
        FROM estado_mantenimiento
        ORDER BY id
      `),

      q("tipo_vehiculo", `
        SELECT id, codigo_tipo_vehiculo, nombre_tipo_vehiculo
        FROM tipo_vehiculo
        ORDER BY id
      `),

      q("estado_asignacion", `
        SELECT id, codigo_estado, nombre_estado_asignacion
        FROM estado_asignacion
        ORDER BY id
      `),

      q("estado_proveedor", `
        SELECT id, codigo_estado, nombre_estado_proveedor
        FROM estado_proveedor
        ORDER BY id
      `),

      q("estado_vehiculo", `
        SELECT id, codigo_estado, nombre_estado_vehiculo
        FROM estado_vehiculo
        ORDER BY id
      `),
    ]);

    const keys = [
      "clientes",
      "usuarios",
      "ubicaciones",
      "rutas",
      "asignaciones",
      "costos",
      "proveedorAsignacion",
      "facturaAsignacion",
      "proveedores",
      "cumplimiento",
      "desempeno",
      "comprobantes",
      "detalles",
      "pagos",
      "estadosFactura",
      "formasPago",
      "viajes",
      "envios",
      "tracking",
      "estadosEnvio",
      "alertas",
      "oportunidades",
      "cotizaciones",
      "cotizacionDetalle",
      "vehiculos",
      "mantenimiento",
      "estadosMantenimiento",
      "tiposVehiculo",
      "estadosAsignacion",
      "estadosProveedor",
      "estadosVehiculo",
    ];

    const data = {};
    const errors = [];

    keys.forEach((key, index) => {
      data[key] = results[index].rows;
      if (results[index].error) errors.push(results[index].error);
    });

    const counts = Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, Array.isArray(value) ? value.length : 0])
    );

    res.json({
      success: errors.length === 0,
      message: errors.length === 0 ? "Reportes cargados desde MySQL." : "Reportes cargados parcialmente.",
      data,
      diagnostics: { counts, errors },
    });
  } catch (error) {
    console.error("Error /reportes/bootstrap:", error);
    res.status(500).json({
      success: false,
      message: "No se pudieron cargar los reportes desde MySQL.",
      error: error.message,
    });
  }
});

router.get("/reportes", async (req, res, next) => {
  req.url = "/reportes/bootstrap";
  return router.handle(req, res, next);
});

module.exports = router;