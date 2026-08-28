import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Truck,
  FileText,
  Users,
  Clock,
  Package,
  BarChart3,
  DollarSign,
  RefreshCw,
  Brain,
  Database,
  ShoppingCart,
  Bell,
  CheckCircle,
  XCircle,
  AlertTriangle,
  CheckCircle2,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API_BASE_URL = "http://localhost:3001/api";

type DashboardResumen = {
  envios: any[];
  viajes: any[];
  comprobantes: any[];
  clientes: any[];
  oportunidades: any[];
  asignaciones: any[];
  proveedores: any[];
  estadosEnvio: any[];
  estadosFactura: any[];
  estadosOportunidad: any[];
};

const valorNumerico = (value: any) => {
  if (value === null || value === undefined || value === "") return 0;
  return Number(String(value).replace(/,/g, "")) || 0;
};

const formatearMoneda = (amount: number) =>
  `Q ${Number(amount || 0).toLocaleString("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const normalizarData = (json: any) => {
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.data?.registros)) return json.data.registros;
  if (Array.isArray(json?.registros)) return json.registros;
  return [];
};

const normalizarObjeto = (json: any) => {
  if (json?.data && typeof json.data === "object" && !Array.isArray(json.data)) return json.data;
  if (json && typeof json === "object" && !Array.isArray(json)) return json;
  return {};
};

const pickArray = (source: any, keys: string[]) => {
  for (const key of keys) {
    const value = source?.[key];
    if (Array.isArray(value)) return value;
  }
  return [];
};

const uniqueById = (rows: any[]) => {
  const seen = new Set<string>();

  return rows.filter((row, index) => {
    const key = String(row?.id ?? row?.codigo ?? row?.codigo_envio ?? row?.codigo_viaje ?? index);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const safeGetObject = async (path: string) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    const json = await response.json();

    if (!response.ok || json?.ok === false || json?.success === false) {
      console.warn(`No se pudo cargar ${path}`, json);
      return {};
    }

    return normalizarObjeto(json);
  } catch (error) {
    console.warn(`No se pudo cargar ${path}`, error);
    return {};
  } finally {
    window.clearTimeout(timeout);
  }
};

const obtenerTexto = (...values: any[]) =>
  values
    .map((value) => String(value ?? "").trim())
    .find(Boolean) || "";

const normalizarTexto = (value: any) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const estadoPorCatalogo = (id: any, catalogo: any[], campos: string[]) => {
  const row = catalogo.find((item) => Number(item?.id) === Number(id));
  if (!row) return "";

  return obtenerTexto(...campos.map((campo) => row?.[campo]));
};

const estaEntregado = (estado: string) => {
  const value = normalizarTexto(estado);
  return (
    value.includes("entregado") ||
    value.includes("finalizado") ||
    value.includes("completado") ||
    value.includes("cerrado")
  );
};

const estaPendiente = (estado: string) => {
  const value = normalizarTexto(estado);
  return (
    value.includes("pendiente") ||
    value.includes("recoleccion") ||
    value.includes("programado") ||
    value.includes("asignado") ||
    value.includes("prospecto")
  );
};

const estaEnRuta = (estado: string) => {
  const value = normalizarTexto(estado);
  return (
    value.includes("ruta") ||
    value.includes("transito") ||
    value.includes("tránsito") ||
    value.includes("destino") ||
    value.includes("curso") ||
    value.includes("activo") ||
    value.includes("proceso")
  );
};

const safeGet = async (path: string) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    const json = await response.json();

    if (!response.ok || json?.ok === false) {
      console.warn(`No se pudo cargar ${path}`, json);
      return [];
    }

    return normalizarData(json);
  } catch (error) {
    console.warn(`No se pudo cargar ${path}`, error);
    return [];
  } finally {
    window.clearTimeout(timeout);
  }
};

function ModuleCard({
  title,
  description,
  icon: Icon,
  color,
  onClick,
}: {
  title: string;
  description: string;
  icon: any;
  color: "blue" | "green" | "orange" | "purple" | "pink" | "gray";
  onClick: () => void;
}) {
  const colors = {
    blue: "border-l-[#0C2D6B]",
    green: "border-l-[#22C55E]",
    orange: "border-l-[#FF6A00]",
    purple: "border-l-purple-500",
    pink: "border-l-pink-500",
    gray: "border-l-slate-500",
  };

  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-xl p-6 shadow-sm border border-gray-100 border-l-4 ${colors[color]} hover:shadow-md hover:-translate-y-0.5 transition-all text-left w-full`}
    >
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-slate-100 text-[#0C2D6B] shrink-0">
          <Icon className="w-6 h-6" />
        </div>

        <div className="min-w-0">
          <h2 className="text-lg font-bold text-[#0C2D6B]">{title}</h2>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
      </div>
    </button>
  );
}

function KpiCard({
  title,
  value,
  icon: Icon,
  color,
  loading,
}: {
  title: string;
  value: any;
  icon: any;
  color: "blue" | "green" | "orange" | "red" | "purple";
  loading: boolean;
}) {
  const colors = {
    blue: "bg-[#0C2D6B]",
    green: "bg-[#22C55E]",
    orange: "bg-[#FF6A00]",
    red: "bg-red-500",
    purple: "bg-purple-500",
  };

  const iconColors = {
    blue: "bg-blue-50 text-[#0C2D6B]",
    green: "bg-green-50 text-[#22C55E]",
    orange: "bg-orange-50 text-[#FF6A00]",
    red: "bg-red-50 text-red-500",
    purple: "bg-purple-50 text-purple-500",
  };

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 relative overflow-hidden min-w-0">
      <div className={`absolute bottom-0 left-0 w-full h-1 ${colors[color]}`} />

      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0 pr-2">
          <h3 className="text-2xl font-bold text-[#0C2D6B] break-words">
            {loading ? "..." : value}
          </h3>
          <p className="text-sm text-gray-500 mt-1 leading-snug">{title}</p>
        </div>

        <div className={`p-3 rounded-lg shrink-0 ${iconColors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { role } = useAuth();

  const [data, setData] = useState<DashboardResumen>({
    envios: [],
    viajes: [],
    comprobantes: [],
    clientes: [],
    oportunidades: [],
    asignaciones: [],
    proveedores: [],
    estadosEnvio: [],
    estadosFactura: [],
    estadosOportunidad: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [loadingSolicitudes, setLoadingSolicitudes] = useState(false);

  const [modalConfirmacion, setModalConfirmacion] = useState<{
    abierto: boolean;
    tipo: "aprobar" | "denegar" | null;
    id: number | null;
    usuario: string;
  }>({
    abierto: false,
    tipo: null,
    id: null,
    usuario: "",
  });

  const [modalResultado, setModalResultado] = useState<{
    abierto: boolean;
    tipo: "success" | "error";
    mensaje: string;
  }>({
    abierto: false,
    tipo: "success",
    mensaje: "",
  });

  const cargarDashboard = async () => {
    try {
      setLoading(true);
      setError("");

      const [
        logisticaBootstrap,
        comprobantesBootstrap,
        crmBootstrap,
        operacionesBootstrap,
        enviosFallback,
        viajesFallback,
        comprobantesFallback,
        clientesFallback,
        oportunidadesFallback,
        asignacionesFallback,
        proveedoresFallback,
      ] = await Promise.all([
        safeGetObject("/logistica/bootstrap"),
        safeGetObject("/comprobantes/bootstrap"),
        safeGetObject("/crm/bootstrap"),
        safeGetObject("/operaciones/bootstrap"),
        safeGet("/logistica/envios"),
        safeGet("/logistica/viajes"),
        safeGet("/comprobantes"),
        safeGet("/clientes"),
        safeGet("/oportunidades"),
        safeGet("/operaciones/asignaciones"),
        safeGet("/operaciones/proveedores"),
      ]);

      const envios = uniqueById([
        ...pickArray(logisticaBootstrap, ["envios", "envio", "shipping"]),
        ...enviosFallback,
      ]);

      const viajes = uniqueById([
        ...pickArray(logisticaBootstrap, ["viajes", "viaje"]),
        ...pickArray(operacionesBootstrap, ["viajes", "viaje"]),
        ...viajesFallback,
      ]);

      const comprobantes = uniqueById([
        ...pickArray(comprobantesBootstrap, ["comprobantes", "comprobante", "facturas"]),
        ...comprobantesFallback,
      ]);

      const clientes = uniqueById([
        ...pickArray(crmBootstrap, ["clientes", "cliente"]),
        ...pickArray(comprobantesBootstrap, ["clientes", "cliente"]),
        ...clientesFallback,
      ]);

      const oportunidades = uniqueById([
        ...pickArray(crmBootstrap, ["oportunidades", "oportunidad"]),
        ...oportunidadesFallback,
      ]);

      const asignaciones = uniqueById([
        ...pickArray(operacionesBootstrap, ["asignaciones", "asignacion"]),
        ...pickArray(logisticaBootstrap, ["asignaciones", "asignacion"]),
        ...asignacionesFallback,
      ]);

      const proveedores = uniqueById([
        ...pickArray(operacionesBootstrap, ["proveedores", "proveedor"]),
        ...proveedoresFallback,
      ]);

      const estadosEnvio = uniqueById([
        ...pickArray(logisticaBootstrap, ["estadosEnvio", "estados_envio", "estadoEnvio", "estado_envio"]),
      ]);

      const estadosFactura = uniqueById([
        ...pickArray(comprobantesBootstrap, ["estadosFactura", "estados_factura", "estadoFactura", "estado_factura"]),
      ]);

      const estadosOportunidad = uniqueById([
        ...pickArray(crmBootstrap, ["estadosOportunidad", "estados_oportunidad", "estadoOportunidad", "estado_oportunidad"]),
      ]);

      setData({
        envios,
        viajes,
        comprobantes,
        clientes,
        oportunidades,
        asignaciones,
        proveedores,
        estadosEnvio,
        estadosFactura,
        estadosOportunidad,
      });

      if (
        !envios.length &&
        !viajes.length &&
        !comprobantes.length &&
        !clientes.length &&
        !oportunidades.length &&
        !asignaciones.length &&
        !proveedores.length
      ) {
        setError(
          "No se pudieron cargar datos del dashboard. Revisa que el backend esté encendido."
        );
      }
    } catch (error: any) {
      console.error("Error al cargar dashboard:", error);
      setError(error.message || "No se pudo cargar el dashboard.");
    } finally {
      setLoading(false);
    }
  };

  const obtenerUsuarioSesion = () => {
    try {
      const user = localStorage.getItem("user");
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  };

  const cargarSolicitudesCredenciales = async () => {
    if (role !== "gerencia") {
      setSolicitudes([]);
      return;
    }

    try {
      setLoadingSolicitudes(true);

      const response = await fetch(
        `${API_BASE_URL}/auth/solicitudes-credenciales`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const json = await response.json();

      if (!response.ok || json.ok === false) {
        console.warn("No se pudieron cargar solicitudes:", json);
        setSolicitudes([]);
        return;
      }

      setSolicitudes(Array.isArray(json.data) ? json.data : []);
    } catch (error) {
      console.warn("Error al cargar solicitudes de credenciales:", error);
      setSolicitudes([]);
    } finally {
      setLoadingSolicitudes(false);
    }
  };

  const abrirModalConfirmacion = (
    tipo: "aprobar" | "denegar",
    id: number,
    usuario: string
  ) => {
    setModalConfirmacion({
      abierto: true,
      tipo,
      id,
      usuario,
    });
  };

  const cerrarModalConfirmacion = () => {
    setModalConfirmacion({
      abierto: false,
      tipo: null,
      id: null,
      usuario: "",
    });
  };

  const mostrarResultado = (tipo: "success" | "error", mensaje: string) => {
    setModalResultado({
      abierto: true,
      tipo,
      mensaje,
    });
  };

  const cerrarResultado = () => {
    setModalResultado({
      abierto: false,
      tipo: "success",
      mensaje: "",
    });
  };

  const ejecutarAccionSolicitud = async () => {
    if (!modalConfirmacion.id || !modalConfirmacion.tipo) return;

    const user = obtenerUsuarioSesion();

    const endpoint =
      modalConfirmacion.tipo === "aprobar" ? "aprobar" : "denegar";

    try {
      const response = await fetch(
        `${API_BASE_URL}/auth/solicitudes-credenciales/${modalConfirmacion.id}/${endpoint}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            revisadoPor: user?.id || null,
          }),
        }
      );

      const json = await response.json();

      if (!response.ok || json.ok === false) {
        cerrarModalConfirmacion();
        mostrarResultado(
          "error",
          json.message || "No se pudo procesar la solicitud."
        );
        return;
      }

      cerrarModalConfirmacion();

      mostrarResultado(
        "success",
        modalConfirmacion.tipo === "aprobar"
          ? "Cambio de contraseña autorizado correctamente."
          : "Solicitud denegada correctamente."
      );

      await cargarSolicitudesCredenciales();
    } catch (error) {
      console.error("Error al procesar solicitud:", error);

      cerrarModalConfirmacion();

      mostrarResultado("error", "No se pudo conectar con el backend.");
    }
  };

  const actualizarTodo = async () => {
    await cargarDashboard();
    await cargarSolicitudesCredenciales();
  };

  useEffect(() => {
    cargarDashboard();
    cargarSolicitudesCredenciales();
  }, [role]);

  const estadoEnvioTexto = (item: any) =>
    obtenerTexto(
      item.nombre_estado_envio,
      item.estado_envio,
      item.nombre_estado,
      item.estado,
      estadoPorCatalogo(item.estado_id || item.estado_envio_id, data.estadosEnvio, [
        "nombre_estado_envio",
        "nombre_estado",
        "estado",
      ])
    );

  const estadoFacturaTexto = (item: any) =>
    obtenerTexto(
      item.nombre_estado_factura,
      item.estado_factura,
      item.nombre_estado,
      item.estado,
      estadoPorCatalogo(item.estado_id || item.estado_factura_id, data.estadosFactura, [
        "nombre_estado_factura",
        "nombre_estado",
        "estado",
      ])
    );

  const estadoOportunidadTexto = (item: any) =>
    obtenerTexto(
      item.nombre_estado_oportunidad,
      item.estado_oportunidad,
      item.etapa,
      item.estado,
      estadoPorCatalogo(item.estado_oportunidad_id || item.estado_id, data.estadosOportunidad, [
        "nombre_estado_oportunidad",
        "nombre_estado",
        "estado",
        "nombre",
      ])
    );

  const estadoViajeTexto = (item: any) =>
    obtenerTexto(
      item.nombre_estado_viaje,
      item.estado_viaje,
      item.nombre_estado,
      item.estado,
      item.estado_asignacion,
      item.nombre_estado_asignacion
    );

  const enviosEntregados = data.envios.filter((e) => estaEntregado(estadoEnvioTexto(e))).length;

  const viajesActivos = data.viajes.filter((v) => {
    const estado = estadoViajeTexto(v);
    const progreso = valorNumerico(v.progreso);
    return !estaEntregado(estado) && !normalizarTexto(estado).includes("cancel") && (progreso < 100 || !progreso);
  }).length;

  const enviosEnRutaPorEstado = data.envios.filter((e) => estaEnRuta(estadoEnvioTexto(e)) && !estaEntregado(estadoEnvioTexto(e))).length;
  const enviosEnRuta = Math.max(enviosEnRutaPorEstado, viajesActivos);

  const enviosPendientes = data.envios.filter((e) => {
    const estado = estadoEnvioTexto(e);
    return estaPendiente(estado) && !estaEntregado(estado) && !estaEnRuta(estado);
  }).length;

  const comprobantesPendientes = data.comprobantes.filter((c) => {
    const estado = estadoFacturaTexto(c);
    return normalizarTexto(estado).includes("pendiente");
  }).length;

  const comprobantesVencidos = data.comprobantes.filter((c) => {
    const estado = estadoFacturaTexto(c);
    return normalizarTexto(estado).includes("vencid");
  }).length;

  const saldoPorCobrar = data.comprobantes.reduce((sum, c) => {
    const total = valorNumerico(c.total || c.monto || c.valor);
    const pagado = valorNumerico(c.pagado || c.total_pagado || c.monto_pagado);
    const saldo = c.saldo !== undefined ? valorNumerico(c.saldo) : Math.max(total - pagado, 0);

    if (estaEntregado(estadoFacturaTexto(c)) || normalizarTexto(estadoFacturaTexto(c)).includes("pagada")) {
      return sum;
    }

    return sum + saldo;
  }, 0);

  const totalComprobantes = data.comprobantes.reduce(
    (sum, c) => sum + valorNumerico(c.total || c.monto || c.valor),
    0
  );

  const clientesActivos = data.clientes.filter((c) => {
    const estado = normalizarTexto(c.nombre_estado_cliente || c.estado || "");

    return !estado.includes("inactivo");
  }).length;

  const oportunidadesActivas = data.oportunidades.filter((o) => {
    const estado = estadoOportunidadTexto(o);
    return !normalizarTexto(estado).includes("perdid") && !normalizarTexto(estado).includes("ganad");
  }).length;

  const valorOportunidades = data.oportunidades.reduce(
    (sum, o) =>
      sum + valorNumerico(o.monto || o.monto_estimado || o.amount || o.valor),
    0
  );

  const margenOperativo = data.asignaciones.reduce((sum, a) => {
    const totalCliente = valorNumerico(a.total || a.total_cliente || a.ingreso_cliente);
    const totalProveedor = valorNumerico(
      a.total_proveedor || a.costo_total || a.costo_proveedor || a.costo
    );

    return sum + (totalCliente - totalProveedor);
  }, 0);

  const datosCargados =
    data.envios.length +
    data.viajes.length +
    data.comprobantes.length +
    data.clientes.length +
    data.oportunidades.length +
    data.asignaciones.length +
    data.proveedores.length;

  const roleTitle = role ? role.toUpperCase() : "USUARIO";

  return (
    <div className="space-y-6 w-full max-w-full px-2 sm:px-3 lg:px-4">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0C2D6B]">
            Dashboard - {role === "facturacion" ? "COMPROBANTES" : roleTitle}
          </h1>

          <p className="text-gray-500 mt-1">
            Resumen general del sistema GL365 ERP
          </p>
        </div>

        <button
          onClick={actualizarTodo}
          className="bg-[#0C2D6B] text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#143C8C] transition-colors w-full sm:w-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      <div
        className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
          error
            ? "border-yellow-300 bg-yellow-50 text-yellow-800"
            : "border-green-200 bg-green-50 text-green-700"
        }`}
      >
        {error || `Datos reales conectados: ${data.envios.length} envíos, ${data.viajes.length} viajes, ${data.comprobantes.length} comprobantes, ${data.clientes.length} clientes.`}
      </div>

      {/* NOTIFICACIONES GERENCIA */}
      {role === "gerencia" && solicitudes.length > 0 && (
        <div className="bg-white border border-orange-200 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-orange-50 px-5 py-4 border-b border-orange-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
              <Bell className="w-5 h-5 text-[#FF6A00]" />
            </div>

            <div>
              <h2 className="font-bold text-[#0C2D6B]">
                Solicitudes pendientes de contraseña
              </h2>

              <p className="text-sm text-gray-500">
                Revisa y autoriza los cambios solicitados por los usuarios.
              </p>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {solicitudes.map((solicitud) => (
              <div
                key={solicitud.id}
                className="px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
              >
                <div>
                  <p className="font-semibold text-[#0C2D6B]">
                    {solicitud.nombre_usuario} quiere cambiar su contraseña.
                  </p>

                  <p className="text-sm text-gray-500">
                    Usuario: {solicitud.nombre_usuario} · Correo:{" "}
                    {solicitud.email}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() =>
                      abrirModalConfirmacion(
                        "aprobar",
                        solicitud.id,
                        solicitud.nombre_usuario
                      )
                    }
                    className="px-4 py-2 rounded-lg bg-green-600 text-white font-bold text-sm hover:bg-green-700 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Autorizar
                  </button>

                  <button
                    onClick={() =>
                      abrirModalConfirmacion(
                        "denegar",
                        solicitud.id,
                        solicitud.nombre_usuario
                      )
                    }
                    className="px-4 py-2 rounded-lg bg-red-600 text-white font-bold text-sm hover:bg-red-700 flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Denegar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {role === "gerencia" && loadingSolicitudes && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
          Cargando solicitudes de credenciales...
        </div>
      )}

      {/* MÓDULOS GERENCIA */}
      {role === "gerencia" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ModuleCard
              title="CRM y Ventas"
              description="Gestión de clientes, oportunidades y cotizaciones"
              icon={Users}
              color="blue"
              onClick={() => navigate("/crm")}
            />

            <ModuleCard
              title="Operaciones"
              description="Asignaciones, compras y proveedores"
              icon={ShoppingCart}
              color="orange"
              onClick={() => navigate("/operaciones")}
            />

            <ModuleCard
              title="Logística"
              description="Envíos, viajes, rutas, flota y seguimiento"
              icon={Truck}
              color="green"
              onClick={() => navigate("/logistica")}
            />

            <ModuleCard
              title="Comprobantes"
              description="Documentos internos de cobro y facturación"
              icon={FileText}
              color="purple"
              onClick={() => navigate("/facturacion")}
            />

            <ModuleCard
              title="Reportes"
              description="Indicadores, filtros y análisis logísticos"
              icon={BarChart3}
              color="blue"
              onClick={() => navigate("/reportes")}
            />

            <ModuleCard
              title="IA Logística"
              description="Consultas inteligentes sobre datos del sistema"
              icon={Brain}
              color="pink"
              onClick={() => navigate("/ia")}
            />

            <ModuleCard
              title="Mantenimiento"
              description="Administración de tablas y registros de MySQL"
              icon={Database}
              color="gray"
              onClick={() => navigate("/mantenimiento")}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <KpiCard
              title="Envíos"
              value={data.envios.length}
              icon={Truck}
              color="blue"
              loading={loading}
            />

            <KpiCard
              title="Entregados"
              value={enviosEntregados}
              icon={Package}
              color="green"
              loading={loading}
            />

            <KpiCard
              title="Viajes activos / En ruta"
              value={enviosEnRuta}
              icon={Clock}
              color="blue"
              loading={loading}
            />

            <KpiCard
              title="Pendientes"
              value={enviosPendientes}
              icon={Clock}
              color="orange"
              loading={loading}
            />

            <KpiCard
              title="Comprobantes Pendientes"
              value={comprobantesPendientes}
              icon={FileText}
              color="red"
              loading={loading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              title="Clientes Registrados"
              value={data.clientes.length}
              icon={Users}
              color="blue"
              loading={loading}
            />

            <KpiCard
              title="Proveedores"
              value={data.proveedores.length}
              icon={FileText}
              color="orange"
              loading={loading}
            />

            <KpiCard
              title="Total Comprobantes"
              value={formatearMoneda(totalComprobantes)}
              icon={DollarSign}
              color="purple"
              loading={loading}
            />

            <KpiCard
              title="Saldo por cobrar"
              value={formatearMoneda(saldoPorCobrar)}
              icon={DollarSign}
              color="red"
              loading={loading}
            />
          </div>
        </>
      )}

      {/* LOGÍSTICA */}
      {role === "logistica" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ModuleCard
              title="Gestión"
              description="Control de envíos y viajes"
              icon={Truck}
              color="blue"
              onClick={() => navigate("/logistica")}
            />

            <ModuleCard
              title="Flota"
              description="Vehículos y unidades"
              icon={Package}
              color="green"
              onClick={() => navigate("/flota")}
            />

            <ModuleCard
              title="Rutas"
              description="Rutas, origen y destino"
              icon={BarChart3}
              color="orange"
              onClick={() => navigate("/rutas")}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard
              title="Viajes activos / En ruta"
              value={enviosEnRuta}
              icon={Truck}
              color="blue"
              loading={loading}
            />

            <KpiCard
              title="Pendientes"
              value={enviosPendientes}
              icon={Clock}
              color="orange"
              loading={loading}
            />

            <KpiCard
              title="Total Envíos"
              value={data.envios.length}
              icon={Package}
              color="green"
              loading={loading}
            />
          </div>
        </>
      )}

      {/* VENTAS */}
      {role === "ventas" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ModuleCard
              title="Ir a CRM"
              description="Gestión de clientes, oportunidades y cotizaciones"
              icon={Users}
              color="blue"
              onClick={() => navigate("/crm")}
            />

            <ModuleCard
              title="Reportes"
              description="Indicadores comerciales"
              icon={BarChart3}
              color="orange"
              onClick={() => navigate("/reportes")}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiCard
              title="Clientes"
              value={data.clientes.length}
              icon={Users}
              color="blue"
              loading={loading}
            />

            <KpiCard
              title="Clientes activos"
              value={clientesActivos}
              icon={Users}
              color="green"
              loading={loading}
            />

            <KpiCard
              title="Oportunidades activas"
              value={oportunidadesActivas || data.oportunidades.length}
              icon={BarChart3}
              color="orange"
              loading={loading}
            />

            <KpiCard
              title="Valor oportunidades"
              value={formatearMoneda(valorOportunidades)}
              icon={DollarSign}
              color="purple"
              loading={loading}
            />
          </div>
        </>
      )}

      {/* OPERACIONES / COMPRAS */}
      {(role === "operaciones" || role === "compras") && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ModuleCard
              title="Operaciones"
              description="Asignaciones y gestión de viajes"
              icon={ShoppingCart}
              color="orange"
              onClick={() => navigate("/operaciones")}
            />

            <ModuleCard
              title="Reportes"
              description="Análisis operativo"
              icon={BarChart3}
              color="blue"
              onClick={() => navigate("/reportes")}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiCard
              title="Asignaciones"
              value={data.asignaciones.length}
              icon={Truck}
              color="blue"
              loading={loading}
            />

            <KpiCard
              title="Proveedores"
              value={data.proveedores.length}
              icon={FileText}
              color="orange"
              loading={loading}
            />

            <KpiCard
              title="Viajes"
              value={data.viajes.length}
              icon={Package}
              color="green"
              loading={loading}
            />

            <KpiCard
              title="Margen operativo"
              value={formatearMoneda(margenOperativo)}
              icon={DollarSign}
              color="purple"
              loading={loading}
            />
          </div>
        </>
      )}

      {/* FACTURACIÓN / FINANZAS */}
      {(role === "facturacion" || role === "finanzas") && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ModuleCard
              title="Ir a Comprobantes"
              description="Gestión de documentos internos"
              icon={FileText}
              color="purple"
              onClick={() => navigate("/facturacion")}
            />

            <ModuleCard
              title="Reportes"
              description="Indicadores financieros"
              icon={BarChart3}
              color="blue"
              onClick={() => navigate("/reportes")}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard
              title="Comprobantes"
              value={data.comprobantes.length}
              icon={FileText}
              color="purple"
              loading={loading}
            />

            <KpiCard
              title="Pendientes"
              value={comprobantesPendientes}
              icon={Clock}
              color="orange"
              loading={loading}
            />

            <KpiCard
              title="Total Comprobantes"
              value={formatearMoneda(totalComprobantes)}
              icon={DollarSign}
              color="green"
              loading={loading}
            />
          </div>
        </>
      )}

      {/* MENSAJERÍA */}
      {role === "mensajeria" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ModuleCard
              title="Gestión Logística"
              description="Consulta y seguimiento de envíos"
              icon={Truck}
              color="green"
              onClick={() => navigate("/logistica")}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard
              title="Viajes activos / En ruta"
              value={enviosEnRuta}
              icon={Truck}
              color="blue"
              loading={loading}
            />

            <KpiCard
              title="Pendientes"
              value={enviosPendientes}
              icon={Clock}
              color="orange"
              loading={loading}
            />

            <KpiCard
              title="Entregados"
              value={enviosEntregados}
              icon={Package}
              color="green"
              loading={loading}
            />
          </div>
        </>
      )}

      {/* MODAL CONFIRMACIÓN */}
      {modalConfirmacion.abierto && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div
              className={`px-6 py-5 flex items-center justify-between ${
                modalConfirmacion.tipo === "aprobar"
                  ? "bg-green-600"
                  : "bg-red-600"
              }`}
            >
              <div className="flex items-center gap-3">
                {modalConfirmacion.tipo === "aprobar" ? (
                  <CheckCircle className="w-6 h-6 text-white" />
                ) : (
                  <XCircle className="w-6 h-6 text-white" />
                )}

                <h2 className="text-white text-lg font-bold">
                  {modalConfirmacion.tipo === "aprobar"
                    ? "Autorizar cambio"
                    : "Denegar solicitud"}
                </h2>
              </div>

              <button
                onClick={cerrarModalConfirmacion}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                    modalConfirmacion.tipo === "aprobar"
                      ? "bg-green-100"
                      : "bg-red-100"
                  }`}
                >
                  <AlertTriangle
                    className={`w-6 h-6 ${
                      modalConfirmacion.tipo === "aprobar"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  />
                </div>

                <div>
                  <h3 className="text-xl font-bold text-[#0C2D6B] mb-2">
                    {modalConfirmacion.tipo === "aprobar"
                      ? "¿Deseas autorizar este cambio?"
                      : "¿Deseas denegar esta solicitud?"}
                  </h3>

                  <p className="text-gray-600 text-sm leading-relaxed">
                    {modalConfirmacion.tipo === "aprobar"
                      ? `Al autorizar, la nueva contraseña de ${modalConfirmacion.usuario} será aplicada en el sistema.`
                      : `Al denegar, la contraseña de ${modalConfirmacion.usuario} no será modificada.`}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  onClick={cerrarModalConfirmacion}
                  className="flex-1 h-11 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50"
                >
                  Cancelar
                </button>

                <button
                  onClick={ejecutarAccionSolicitud}
                  className={`flex-1 h-11 rounded-xl text-white font-bold ${
                    modalConfirmacion.tipo === "aprobar"
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {modalConfirmacion.tipo === "aprobar"
                    ? "Sí, autorizar"
                    : "Sí, denegar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RESULTADO */}
      {modalResultado.abierto && (
        <div className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div
              className={`px-6 py-5 text-center ${
                modalResultado.tipo === "success"
                  ? "bg-green-600"
                  : "bg-red-600"
              }`}
            >
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                {modalResultado.tipo === "success" ? (
                  <CheckCircle2 className="w-8 h-8 text-white" />
                ) : (
                  <AlertTriangle className="w-8 h-8 text-white" />
                )}
              </div>

              <h2 className="text-white text-xl font-bold">
                {modalResultado.tipo === "success"
                  ? "Proceso realizado"
                  : "Ocurrió un error"}
              </h2>
            </div>

            <div className="p-6 text-center">
              <p className="text-gray-600 mb-6">{modalResultado.mensaje}</p>

              <button
                onClick={cerrarResultado}
                className="w-full h-11 rounded-xl bg-[#0C2D6B] text-white font-bold hover:bg-[#143C8C]"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}