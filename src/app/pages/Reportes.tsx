import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  RefreshCw,
  Route as RouteIcon,
  Search,
  ShieldCheck,
  Truck,
  Users,
  Wrench,
  X,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// Versión ajustada: evita cortes y scroll horizontal dentro del layout con sidebar.
const API_BASE_URL = "/api";

type ReportType =
  | "ejecutivo"
  | "cobranza"
  | "rentabilidad"
  | "operaciones"
  | "logistica"
  | "comercial"
  | "proveedores"
  | "flota"
  | "rutas";

type AnyRow = Record<string, any>;
type SortDirection = "asc" | "desc";

type ApiData = {
  clientes: AnyRow[];
  usuarios: AnyRow[];
  ubicaciones: AnyRow[];
  rutas: AnyRow[];
  asignaciones: AnyRow[];
  costos: AnyRow[];
  proveedorAsignacion: AnyRow[];
  facturaAsignacion: AnyRow[];
  proveedores: AnyRow[];
  cumplimiento: AnyRow[];
  desempeno: AnyRow[];
  comprobantes: AnyRow[];
  detalles: AnyRow[];
  pagos: AnyRow[];
  estadosFactura: AnyRow[];
  formasPago: AnyRow[];
  viajes: AnyRow[];
  envios: AnyRow[];
  tracking: AnyRow[];
  estadosEnvio: AnyRow[];
  alertas: AnyRow[];
  oportunidades: AnyRow[];
  estadosOportunidad: AnyRow[];
  estados_oportunidad: AnyRow[];
  cotizaciones: AnyRow[];
  cotizacionDetalle: AnyRow[];
  vehiculos: AnyRow[];
  mantenimiento: AnyRow[];
  estadosMantenimiento: AnyRow[];
  tiposVehiculo: AnyRow[];
  estadosAsignacion: AnyRow[];
  estadosProveedor: AnyRow[];
  estadosVehiculo: AnyRow[];
};

const EMPTY_DATA: ApiData = {
  clientes: [],
  usuarios: [],
  ubicaciones: [],
  rutas: [],
  asignaciones: [],
  costos: [],
  proveedorAsignacion: [],
  facturaAsignacion: [],
  proveedores: [],
  cumplimiento: [],
  desempeno: [],
  comprobantes: [],
  detalles: [],
  pagos: [],
  estadosFactura: [],
  formasPago: [],
  viajes: [],
  envios: [],
  tracking: [],
  estadosEnvio: [],
  alertas: [],
  oportunidades: [],
  estadosOportunidad: [],
  estados_oportunidad: [],
  cotizaciones: [],
  cotizacionDetalle: [],
  vehiculos: [],
  mantenimiento: [],
  estadosMantenimiento: [],
  tiposVehiculo: [],
  estadosAsignacion: [],
  estadosProveedor: [],
  estadosVehiculo: [],
};

const COLORS = ["#16A34A", "#2563EB", "#F97316", "#DC2626", "#7C3AED", "#0F766E", "#CA8A04"];
const BLUE = "#0C2D6B";
const ORANGE = "#FF6B00";
const GREEN = "#22C55E";
const RED = "#EF4444";

const n = (value: any) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const s = (value: any) => String(value ?? "").trim();

const money = (value: any) =>
  `Q ${n(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const pct = (value: any) => `${n(value).toFixed(1)}%`;

const todayIso = () => new Date().toISOString().slice(0, 10);

const normalizeDate = (value?: any) => {
  const raw = s(value);
  if (!raw) return "";
  return raw.slice(0, 10);
};

const inDateRange = (date: any, inicio: string, fin: string) => {
  const d = normalizeDate(date);
  if (!d) return true;
  if (inicio && d < inicio) return false;
  if (fin && d > fin) return false;
  return true;
};

const contains = (value: any, search: string) =>
  !search || s(value).toLowerCase().includes(search.toLowerCase());

const compareReportValues = (a: any, b: any, direction: SortDirection) => {
  const av = a ?? "";
  const bv = b ?? "";

  if (typeof av === "number" || typeof bv === "number") {
    const result = n(av) - n(bv);
    return direction === "asc" ? result : -result;
  }

  const dateA = normalizeDate(av);
  const dateB = normalizeDate(bv);
  if (dateA && dateB && /^\d{4}-\d{2}-\d{2}/.test(dateA) && /^\d{4}-\d{2}-\d{2}/.test(dateB)) {
    const result = dateA.localeCompare(dateB);
    return direction === "asc" ? result : -result;
  }

  const result = String(av).localeCompare(String(bv), "es", {
    numeric: true,
    sensitivity: "base",
  });

  return direction === "asc" ? result : -result;
};

const byId = (rows: AnyRow[]) => {
  const map = new Map<number, AnyRow>();
  rows.forEach((row) => map.set(n(row.id), row));
  return map;
};

const groupSum = (rows: AnyRow[], keyGetter: (row: AnyRow) => string, valueGetter: (row: AnyRow) => number) => {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    const key = keyGetter(row) || "Sin dato";
    map.set(key, (map.get(key) || 0) + valueGetter(row));
  });
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
};

const groupCount = (rows: AnyRow[], keyGetter: (row: AnyRow) => string) => {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    const key = keyGetter(row) || "Sin dato";
    map.set(key, (map.get(key) || 0) + 1);
  });
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
};

const estadoAsignacionNombre = (id: any, estados: Map<number, AnyRow>) => {
  const row = estados.get(n(id));
  if (row?.nombre_estado_asignacion) return s(row.nombre_estado_asignacion);
  if (row?.nombre_estado) return s(row.nombre_estado);
  if (row?.estado) return s(row.estado);

  const fallback: Record<number, string> = {
    1: "Pendiente",
    2: "Asignada",
    3: "En curso",
    4: "Finalizada",
    5: "Cancelada",
  };

  return fallback[n(id)] || "Sin estado";
};

const estadoVehiculoNombre = (id: any, estados: Map<number, AnyRow>) => {
  const row = estados.get(n(id));
  if (row?.nombre_estado_vehiculo) return s(row.nombre_estado_vehiculo);
  if (row?.nombre_estado) return s(row.nombre_estado);
  if (row?.estado) return s(row.estado);

  const fallback: Record<number, string> = {
    1: "Disponible",
    2: "Asignado",
    3: "En ruta",
    4: "Mantenimiento",
    5: "Inactivo",
  };

  return fallback[n(id)] || "Sin estado";
};

const estadoFacturaNombre = (id: any, estados: Map<number, AnyRow>) => {
  const row = estados.get(n(id));
  return s(row?.nombre_estado_factura || row?.estado || row?.nombre_estado || "Sin estado");
};

const estadoEnvioNombre = (id: any, estados: Map<number, AnyRow>) => {
  const row = estados.get(n(id));
  return s(row?.nombre_estado_envio || row?.estado || row?.nombre_estado || "Sin estado");
};

const formaPagoNombre = (id: any, formas: Map<number, AnyRow>) => {
  const row = formas.get(n(id));
  return s(row?.nombre_forma_pago || row?.forma_pago || "Sin forma");
};

const getCodigoComprobante = (row: AnyRow) => `${s(row.serie)}-${s(row.numero_comprobante)}`.replace(/^-|-$/g, "");

const getClienteNombre = (id: any, clientes: Map<number, AnyRow>) => {
  const row = clientes.get(n(id));
  return s(row?.nombre_empresa || row?.cliente || "Sin cliente");
};

const getRutaNombre = (id: any, rutas: Map<number, AnyRow>, ubicaciones: Map<number, AnyRow>) => {
  const row = rutas.get(n(id));
  if (!row) return "Sin ruta";

  const origen = s(ubicaciones.get(n(row.origen_id))?.nombre_ubicacion);
  const destino = s(ubicaciones.get(n(row.destino_id))?.nombre_ubicacion);

  if (origen || destino) return `${origen || "Origen"} → ${destino || "Destino"}`;

  return s(row.nombre_ruta || row.codigo_ruta || "Sin ruta");
};

const getProveedorNombre = (id: any, proveedores: Map<number, AnyRow>) => {
  const row = proveedores.get(n(id));
  return s(row?.nombre_comercial || row?.razon_social || "Sin proveedor");
};

const getVehiculoCodigo = (id: any, vehiculos: Map<number, AnyRow>) => {
  const row = vehiculos.get(n(id));
  return s(row?.codigo || "Sin vehículo");
};

const cleanEstado = (estado: string) =>
  estado
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const estadoOportunidadNombre = (row: AnyRow, estadosOportunidad: Map<number, AnyRow>) => {
  const directo = s(
    row.etapa ||
      row.nombre_etapa ||
      row.estado ||
      row.nombre_estado ||
      row.nombre_estado_oportunidad ||
      row.estado_oportunidad
  );

  if (directo) return directo;

  const id = n(row.estado_oportunidad_id || row.estado_id || row.etapa_id || row.estadoOportunidadId);
  const catalogo = estadosOportunidad.get(id);

  const desdeCatalogo = s(
    catalogo?.nombre_estado_oportunidad ||
      catalogo?.nombre_estado ||
      catalogo?.estado ||
      catalogo?.nombre ||
      catalogo?.descripcion
  );

  if (desdeCatalogo) return desdeCatalogo;

  const fallback: Record<number, string> = {
    1: "Prospecto",
    2: "Contactado",
    3: "Cotización enviada",
    4: "Negociación",
    5: "Ganada",
    6: "Perdida",
  };

  return fallback[id] || "Sin etapa";
};

export function Reportes() {
  const [data, setData] = useState<ApiData>(EMPTY_DATA);
  const [reportType, setReportType] = useState<ReportType>("ejecutivo");
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");
  const [search, setSearch] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [sortField, setSortField] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [diagnostics, setDiagnostics] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    setApiError("");

    try {
      const response = await fetch(`${API_BASE_URL}/reportes/bootstrap`);
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || "No se pudieron cargar los reportes desde MySQL.");
      }

      setData({ ...EMPTY_DATA, ...(payload?.data || {}) });
      setDiagnostics(payload?.diagnostics || null);
    } catch (error: any) {
      console.error("Error Reportes:", error);
      setApiError(error?.message || "No se pudo conectar Reportes con MySQL.");
      setData(EMPTY_DATA);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const sortIcon = (field: string) => {
    if (sortField !== field) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDirection("asc");
  };

  const clearReportFilters = () => {
    setInicio("");
    setFin("");
    setSearch("");
    setEstadoFiltro("");
    setSortField("");
    setSortDirection("asc");
  };

  const maps = useMemo(() => {
    return {
      clientes: byId(data.clientes),
      usuarios: byId(data.usuarios),
      ubicaciones: byId(data.ubicaciones),
      rutas: byId(data.rutas),
      proveedores: byId(data.proveedores),
      vehiculos: byId(data.vehiculos),
      estadosFactura: byId(data.estadosFactura),
      formasPago: byId(data.formasPago),
      estadosEnvio: byId(data.estadosEnvio),
      estadosMantenimiento: byId(data.estadosMantenimiento),
      tiposVehiculo: byId(data.tiposVehiculo),
      estadosAsignacion: byId(data.estadosAsignacion),
      estadosVehiculo: byId(data.estadosVehiculo),
      estadosOportunidad: byId([...(data.estadosOportunidad || []), ...(data.estados_oportunidad || [])]),
      cumplimiento: byId(data.cumplimiento.map((row) => ({ ...row, id: row.proveedor_id || row.id }))),
      desempeno: byId(data.desempeno.map((row) => ({ ...row, id: row.proveedor_id || row.id }))),
    };
  }, [data]);

  const pagosPorComprobante = useMemo(() => {
    const map = new Map<number, number>();
    data.pagos.forEach((pago) => {
      const id = n(pago.comprobante_id);
      map.set(id, (map.get(id) || 0) + n(pago.monto));
    });
    return map;
  }, [data.pagos]);

  const costosPorAsignacion = useMemo(() => {
    const map = new Map<number, number>();
    data.costos.forEach((row) => {
      map.set(n(row.asignacion_id), n(row.total));
    });
    return map;
  }, [data.costos]);

  const facturaPorAsignacion = useMemo(() => {
    const map = new Map<number, number>();
    data.facturaAsignacion.forEach((row) => {
      map.set(n(row.asignacion_id || row.asignaciones_id), n(row.valor));
    });
    return map;
  }, [data.facturaAsignacion]);

  const proveedorPorAsignacion = useMemo(() => {
    const map = new Map<number, AnyRow>();
    data.proveedorAsignacion.forEach((row) => {
      map.set(n(row.asignacion_id || row.asignaciones_id), row);
    });
    return map;
  }, [data.proveedorAsignacion]);

  const filteredComprobantes = useMemo(() => {
    return data.comprobantes.filter((row) => {
      const cliente = getClienteNombre(row.cliente_id, maps.clientes);
      const estado = estadoFacturaNombre(row.estado_id, maps.estadosFactura);
      const codigo = getCodigoComprobante(row);

      return (
        inDateRange(row.fecha_emision || row.created_at, inicio, fin) &&
        (reportType !== "cobranza" || !estadoFiltro || cleanEstado(estado) === cleanEstado(estadoFiltro)) &&
        (contains(cliente, search) || contains(codigo, search) || contains(row.observaciones, search))
      );
    });
  }, [data.comprobantes, maps.clientes, maps.estadosFactura, inicio, fin, search, estadoFiltro, reportType]);

  const comprobantesEnriquecidos = useMemo(() => {
    return filteredComprobantes.map((row) => {
      const total = n(row.total);
      const pagado = pagosPorComprobante.get(n(row.id)) || 0;
      const saldo = Math.max(total - pagado, 0);
      const estado = estadoFacturaNombre(row.estado_id, maps.estadosFactura);

      return {
        ...row,
        codigo: getCodigoComprobante(row),
        cliente: getClienteNombre(row.cliente_id, maps.clientes),
        estado,
        forma_pago: formaPagoNombre(row.forma_pago_id, maps.formasPago),
        total,
        pagado,
        saldo,
      };
    });
  }, [filteredComprobantes, pagosPorComprobante, maps]);

  const asignacionesRows = useMemo(() => {
    return data.asignaciones
      .filter((row) => {
        const cliente = getClienteNombre(row.cliente_id, maps.clientes);
        const ruta = getRutaNombre(row.ruta_id, maps.rutas, maps.ubicaciones);
        const estado = estadoAsignacionNombre(row.estado_asignacion_id, maps.estadosAsignacion);

        return (
          inDateRange(row.fecha_carga, inicio, fin) &&
          (!["rentabilidad", "operaciones"].includes(reportType) || !estadoFiltro || cleanEstado(estado) === cleanEstado(estadoFiltro)) &&
          (contains(cliente, search) || contains(ruta, search) || contains(row.codigo_asignacion, search))
        );
      })
      .map((row) => {
        const prov = proveedorPorAsignacion.get(n(row.id));
        const facturaCliente = facturaPorAsignacion.get(n(row.id)) || 0;
        const costoProveedor = n(prov?.total);
        const costoOperacion = costosPorAsignacion.get(n(row.id)) || 0;
        const costoBase = costoProveedor || costoOperacion;
        const margen = facturaCliente - costoBase;

        return {
          ...row,
          cliente: getClienteNombre(row.cliente_id, maps.clientes),
          ruta: getRutaNombre(row.ruta_id, maps.rutas, maps.ubicaciones),
          vehiculo: getVehiculoCodigo(row.vehiculo_id, maps.vehiculos),
          proveedor: getProveedorNombre(row.proveedor_id || prov?.proveedor_id || prov?.proveedores_id, maps.proveedores),
          estado: estadoAsignacionNombre(row.estado_asignacion_id, maps.estadosAsignacion),
          facturaCliente,
          costoProveedor,
          costoOperacion,
          margen,
        };
      });
  }, [
    data.asignaciones,
    maps,
    inicio,
    fin,
    search,
    estadoFiltro,
    reportType,
    proveedorPorAsignacion,
    facturaPorAsignacion,
    costosPorAsignacion,
  ]);

  const viajesRows = useMemo(() => {
    return data.viajes
      .filter((row) => {
        const cliente = getClienteNombre(row.cliente_id || row.clientes_id, maps.clientes);
        const ruta = getRutaNombre(row.ruta_id || row.rutas_id, maps.rutas, maps.ubicaciones);
        const envio = data.envios.find((env) => n(env.id) === n(row.envio_id || row.envios_id));
        const estadoEnvio = estadoEnvioNombre(envio?.estado_id, maps.estadosEnvio);

        return (
          inDateRange(row.fecha_salida || row.created_at, inicio, fin) &&
          (reportType !== "logistica" || !estadoFiltro || cleanEstado(estadoEnvio) === cleanEstado(estadoFiltro)) &&
          (contains(cliente, search) || contains(ruta, search) || contains(row.codigo, search))
        );
      })
      .map((row) => {
        const envio = data.envios.find((env) => n(env.id) === n(row.envio_id || row.envios_id));
        return {
          ...row,
          cliente: getClienteNombre(row.cliente_id || row.clientes_id, maps.clientes),
          ruta: getRutaNombre(row.ruta_id || row.rutas_id, maps.rutas, maps.ubicaciones),
          envio: s(envio?.codigo || "Sin envío"),
          estadoEnvio: estadoEnvioNombre(envio?.estado_id, maps.estadosEnvio),
          progreso: n(row.progreso),
        };
      });
  }, [data.viajes, data.envios, maps, inicio, fin, search, estadoFiltro, reportType]);

  const rutasRows = useMemo(() => {
    return data.rutas
      .filter((row) => {
        const destinoPais = s(maps.ubicaciones.get(n(row.destino_id))?.pais || "Sin país");
        return (
          (contains(row.nombre_ruta, search) || contains(row.codigo_ruta, search)) &&
          (reportType !== "rutas" || !estadoFiltro || cleanEstado(destinoPais) === cleanEstado(estadoFiltro))
        );
      })
      .map((row) => ({
        ...row,
        origen: s(maps.ubicaciones.get(n(row.origen_id))?.nombre_ubicacion || "Sin origen"),
        destino: s(maps.ubicaciones.get(n(row.destino_id))?.nombre_ubicacion || "Sin destino"),
        paisDestino: s(maps.ubicaciones.get(n(row.destino_id))?.pais || "Sin país"),
        distancia: n(row.distancia_km),
        costo: n(row.costo),
        tiempo: n(row.tiempo),
      }));
  }, [data.rutas, maps.ubicaciones, search, estadoFiltro, reportType]);

  const proveedoresRows = useMemo(() => {
    return data.proveedores
      .map((row) => {
        const cumplimiento = maps.cumplimiento.get(n(row.id));
        const desempeno = maps.desempeno.get(n(row.id));
        const asignado = data.proveedorAsignacion
          .filter((pa) => n(pa.proveedor_id || pa.proveedores_id) === n(row.id))
          .reduce((sum, pa) => sum + n(pa.total), 0);

        const pendientesPago = data.proveedorAsignacion.filter(
          (pa) => n(pa.proveedor_id || pa.proveedores_id) === n(row.id) && !pa.fecha_pago
        ).length;

        return {
          ...row,
          nombre: s(row.nombre_comercial || row.razon_social),
          estadoSat: s(cumplimiento?.estado_sat || "Sin dato"),
          nivel: s(desempeno?.nivel || "Sin nivel"),
          asignado,
          pendientesPago,
        };
      })
      .filter((row) => {
        const matchesSearch =
          contains(row.razon_social, search) || contains(row.nombre_comercial, search) || contains(row.codigo_proveedor, search);

        if (reportType !== "proveedores" || !estadoFiltro) return matchesSearch;

        if (estadoFiltro.startsWith("Nivel: ")) {
          return matchesSearch && cleanEstado(row.nivel) === cleanEstado(estadoFiltro.replace("Nivel: ", ""));
        }

        if (estadoFiltro.startsWith("SAT: ")) {
          return matchesSearch && cleanEstado(row.estadoSat) === cleanEstado(estadoFiltro.replace("SAT: ", ""));
        }

        return matchesSearch;
      });
  }, [data.proveedores, data.proveedorAsignacion, maps, search, estadoFiltro, reportType]);

  const flotaRows = useMemo(() => {
    return data.vehiculos
      .map((row) => {
        const tipo = maps.tiposVehiculo.get(n(row.tipo_id));
        const estado = estadoVehiculoNombre(row.estado_id, maps.estadosVehiculo);
        const estadoMantenimiento = maps.estadosMantenimiento.get(n(row.estado_mantenimiento_id || row.estados_mantenimiento_id));
        const ultimoMant = data.mantenimiento.find((mant) => n(mant.vehiculo_id) === n(row.id));

        return {
          ...row,
          tipo: s(tipo?.nombre_tipo_vehiculo || tipo?.nombre_tipo || "Sin tipo"),
          estado,
          mantenimiento: s(
            estadoMantenimiento?.nombre_estado_mantenimiento ||
              estadoMantenimiento?.nombre_estado ||
              ultimoMant?.tipo ||
              "Sin mantenimiento"
          ),
          eficiencia: n(row.eficiencia),
          kilometraje: n(row.kilometraje),
        };
      })
      .filter((row) => {
        const matchesSearch = contains(row.codigo, search) || contains(row.tipo, search) || contains(row.estado, search);
        return matchesSearch && (reportType !== "flota" || !estadoFiltro || cleanEstado(row.estado) === cleanEstado(estadoFiltro));
      });
  }, [data.vehiculos, data.mantenimiento, maps, search, estadoFiltro, reportType]);

  const comercialRows = useMemo(() => {
    return data.oportunidades
      .map((row) => {
        const monto = n(row.monto_estimado);
        const prob = n(row.probabilidad);
        const estado = estadoOportunidadNombre(row, maps.estadosOportunidad);

        return {
          ...row,
          cliente: getClienteNombre(row.cliente_id, maps.clientes),
          estado,
          monto,
          probabilidad: prob,
          ponderado: monto * (prob / 100),
        };
      })
      .filter((row) => {
        return (
          inDateRange(row.fecha_creacion || row.created_at, inicio, fin) &&
          (reportType !== "comercial" || !estadoFiltro || cleanEstado(row.estado) === cleanEstado(estadoFiltro)) &&
          (contains(row.cliente, search) || contains(row.codigo_oportunidad, search) || contains(row.nombre_oportunidad, search))
        );
      });
  }, [data.oportunidades, maps.clientes, maps.estadosOportunidad, inicio, fin, search, estadoFiltro, reportType]);

  const cobranzaKpi = useMemo(() => {
    const totalFacturado = comprobantesEnriquecidos.reduce((sum, row) => sum + n(row.total), 0);
    const totalPagado = comprobantesEnriquecidos.reduce((sum, row) => sum + n(row.pagado), 0);
    const saldo = comprobantesEnriquecidos.reduce((sum, row) => sum + n(row.saldo), 0);

    const pagadas = comprobantesEnriquecidos.filter((row) => cleanEstado(row.estado) === "pagada").length;
    const pendientes = comprobantesEnriquecidos.filter((row) => cleanEstado(row.estado) === "pendiente").length;
    const vencidas = comprobantesEnriquecidos.filter((row) => cleanEstado(row.estado) === "vencida").length;
    const parciales = comprobantesEnriquecidos.filter((row) => cleanEstado(row.estado) === "parcial").length;

    return { totalFacturado, totalPagado, saldo, pagadas, pendientes, vencidas, parciales };
  }, [comprobantesEnriquecidos]);

  const rentabilidadKpi = useMemo(() => {
    const ingresoCliente = asignacionesRows.reduce((sum, row) => sum + n(row.facturaCliente), 0);
    const costoProveedor = asignacionesRows.reduce((sum, row) => sum + n(row.costoProveedor || row.costoOperacion), 0);
    const margen = ingresoCliente - costoProveedor;
    const margenPct = ingresoCliente ? (margen / ingresoCliente) * 100 : 0;
    return { ingresoCliente, costoProveedor, margen, margenPct };
  }, [asignacionesRows]);

  const logisticaKpi = useMemo(() => {
    const total = viajesRows.length;
    const finalizados = viajesRows.filter((row) => n(row.progreso) >= 100).length;
    const enCurso = viajesRows.filter((row) => n(row.progreso) > 0 && n(row.progreso) < 100).length;
    const alertasActivas = data.alertas.filter((row) => !n(row.leida)).length;
    const avancePromedio = total ? viajesRows.reduce((sum, row) => sum + n(row.progreso), 0) / total : 0;
    return { total, finalizados, enCurso, alertasActivas, avancePromedio };
  }, [viajesRows, data.alertas]);

  const flotaKpi = useMemo(() => {
    const total = flotaRows.length;
    const disponibles = flotaRows.filter((row) => cleanEstado(row.estado) === "disponible").length;
    const enUso = flotaRows.filter((row) => ["asignado", "en ruta"].includes(cleanEstado(row.estado))).length;
    const mantenimiento = flotaRows.filter((row) => cleanEstado(row.estado) === "mantenimiento").length;
    const eficiencia = total ? flotaRows.reduce((sum, row) => sum + n(row.eficiencia), 0) / total : 0;
    return { total, disponibles, enUso, mantenimiento, eficiencia };
  }, [flotaRows]);

  const reportOptions: { id: ReportType; label: string; icon: any }[] = [
    { id: "ejecutivo", label: "Ejecutivo", icon: BarChart3 },
    { id: "cobranza", label: "Cobranza", icon: Banknote },
    { id: "rentabilidad", label: "Rentabilidad", icon: BriefcaseBusiness },
    { id: "operaciones", label: "Operaciones", icon: Truck },
    { id: "logistica", label: "Logística", icon: RouteIcon },
    { id: "comercial", label: "Comercial", icon: Users },
    { id: "proveedores", label: "Proveedores", icon: ShieldCheck },
    { id: "flota", label: "Flota", icon: Wrench },
    { id: "rutas", label: "Rutas", icon: RouteIcon },
  ];

  const tableRows = useMemo(() => {
    if (reportType === "cobranza") {
      return comprobantesEnriquecidos.map((row) => ({
        Comprobante: row.codigo,
        Cliente: row.cliente,
        Fecha: row.fecha_emision,
        Vence: row.fecha_vencimiento,
        Estado: row.estado,
        Total: n(row.total),
        Pagado: n(row.pagado),
        Saldo: n(row.saldo),
      }));
    }

    if (["rentabilidad", "operaciones"].includes(reportType)) {
      return asignacionesRows.map((row) => ({
        Asignación: row.codigo_asignacion,
        Cliente: row.cliente,
        Ruta: row.ruta,
        Estado: row.estado,
        "Factura cliente": n(row.facturaCliente),
        "Costo proveedor": n(row.costoProveedor || row.costoOperacion),
        Margen: n(row.margen),
      }));
    }

    if (reportType === "logistica") {
      return viajesRows.map((row) => ({
        Viaje: row.codigo,
        Cliente: row.cliente,
        Ruta: row.ruta,
        Envío: row.envio,
        Estado: row.estadoEnvio,
        Progreso: `${n(row.progreso)}%`,
        Salida: row.fecha_salida,
      }));
    }

    if (reportType === "comercial") {
      return comercialRows.map((row) => ({
        Oportunidad: row.codigo_oportunidad,
        Cliente: row.cliente,
        Etapa: row.estado,
        Descripción: row.nombre_oportunidad,
        Monto: n(row.monto),
        Probabilidad: `${n(row.probabilidad)}%`,
        Ponderado: n(row.ponderado),
      }));
    }

    if (reportType === "proveedores") {
      return proveedoresRows.map((row) => ({
        Proveedor: row.nombre,
        Código: row.codigo_proveedor,
        NIT: row.nit,
        SAT: row.estadoSat,
        Desempeño: row.nivel,
        "Total asignado": n(row.asignado),
        "Pagos pendientes": n(row.pendientesPago),
      }));
    }

    if (reportType === "flota") {
      return flotaRows.map((row) => ({
        Vehículo: row.codigo,
        Tipo: row.tipo,
        Estado: row.estado,
        Eficiencia: `${n(row.eficiencia)}%`,
        Kilometraje: n(row.kilometraje),
        Mantenimiento: row.mantenimiento,
        Próximo: row.proximo_mantenimiento,
      }));
    }

    if (reportType === "rutas") {
      return rutasRows.map((row) => ({
        Código: row.codigo_ruta,
        Ruta: row.nombre_ruta,
        Origen: row.origen,
        Destino: row.destino,
        País: row.paisDestino,
        Kilómetros: n(row.distancia),
        Horas: n(row.tiempo),
        Costo: n(row.costo),
      }));
    }

    const ejecutivoRows = [
      { Área: "CRM", Indicador: "Clientes", Valor: data.clientes.length },
      { Área: "Facturación", Indicador: "Comprobantes", Valor: data.comprobantes.length },
      { Área: "Facturación", Indicador: "Total facturado", Valor: cobranzaKpi.totalFacturado },
      { Área: "Facturación", Indicador: "Total cobrado", Valor: cobranzaKpi.totalPagado },
      { Área: "Facturación", Indicador: "Saldo por cobrar", Valor: cobranzaKpi.saldo },
      { Área: "Operaciones", Indicador: "Asignaciones", Valor: data.asignaciones.length },
      { Área: "Logística", Indicador: "Viajes", Valor: data.viajes.length },
      { Área: "Flota", Indicador: "Vehículos", Valor: data.vehiculos.length },
    ];

    return ejecutivoRows.filter((row) => !estadoFiltro || row.Área === estadoFiltro);
  }, [
    reportType,
    comprobantesEnriquecidos,
    asignacionesRows,
    viajesRows,
    comercialRows,
    proveedoresRows,
    flotaRows,
    rutasRows,
    data,
    cobranzaKpi,
  ]);


  const sortedTableRows = useMemo(() => {
    const rows = [...tableRows];

    if (!sortField) return rows;

    rows.sort((a, b) => compareReportValues(a[sortField], b[sortField], sortDirection));
    return rows;
  }, [tableRows, sortField, sortDirection]);

  const tableColumns = useMemo(() => Object.keys(sortedTableRows[0] || {}), [sortedTableRows]);

  const getPdfKpis = () => {
    if (reportType === "cobranza") {
      return [
        { label: "Total facturado", value: money(cobranzaKpi.totalFacturado), color: BLUE },
        { label: "Pagadas", value: String(cobranzaKpi.pagadas), color: GREEN },
        { label: "Pendientes", value: String(cobranzaKpi.pendientes), color: ORANGE },
        { label: "Saldo por cobrar", value: money(cobranzaKpi.saldo), color: RED },
      ];
    }
    if (reportType === "rentabilidad") {
      return [
        { label: "Ingresos cliente", value: money(rentabilidadKpi.ingresoCliente), color: BLUE },
        { label: "Costo proveedor", value: money(rentabilidadKpi.costoProveedor), color: ORANGE },
        { label: "Margen", value: money(rentabilidadKpi.margen), color: GREEN },
        { label: "Asignaciones", value: String(asignacionesRows.length), color: BLUE },
      ];
    }
    if (reportType === "operaciones") {
      return [
        { label: "Asignaciones", value: String(asignacionesRows.length), color: BLUE },
        { label: "Completadas", value: String(asignacionesRows.filter((r) => cleanEstado(r.estado).includes("final")).length), color: GREEN },
        { label: "Margen total", value: money(rentabilidadKpi.margen), color: GREEN },
        { label: "Pagos pendientes", value: String(data.proveedorAsignacion.filter((row) => !row.fecha_pago).length), color: ORANGE },
      ];
    }
    if (reportType === "logistica") {
      return [
        { label: "Viajes", value: String(logisticaKpi.total), color: BLUE },
        { label: "En curso", value: String(logisticaKpi.enCurso), color: ORANGE },
        { label: "Finalizados", value: String(logisticaKpi.finalizados), color: GREEN },
        { label: "Alertas", value: String(logisticaKpi.alertasActivas), color: RED },
      ];
    }
    if (reportType === "comercial") {
      return [
        { label: "Clientes", value: String(data.clientes.length), color: BLUE },
        { label: "Oportunidades", value: String(comercialRows.length), color: ORANGE },
        { label: "Monto estimado", value: money(comercialRows.reduce((sum, row) => sum + n(row.monto), 0)), color: GREEN },
        { label: "Cotizaciones", value: String(data.cotizaciones.length), color: BLUE },
      ];
    }
    if (reportType === "proveedores") {
      return [
        { label: "Proveedores", value: String(proveedoresRows.length), color: BLUE },
        { label: "Nivel alto", value: String(proveedoresRows.filter((r) => cleanEstado(r.nivel) === "verde").length), color: GREEN },
        { label: "SAT no vigente", value: String(proveedoresRows.filter((r) => cleanEstado(r.estadoSat).includes("no")).length), color: RED },
        { label: "Activos", value: String(proveedoresRows.filter((r) => cleanEstado(r.estado).includes("activo")).length), color: ORANGE },
      ];
    }
    if (reportType === "flota") {
      return [
        { label: "Vehículos", value: String(flotaRows.length), color: BLUE },
        { label: "Disponibles", value: String(flotaRows.filter((r) => cleanEstado(r.estado).includes("dispon")).length), color: GREEN },
        { label: "En operación", value: String(flotaRows.filter((r) => cleanEstado(r.estado).includes("asign") || cleanEstado(r.estado).includes("ruta")).length), color: ORANGE },
        { label: "Mantenimiento", value: String(flotaRows.filter((r) => cleanEstado(r.estado).includes("manten")).length), color: RED },
      ];
    }
    if (reportType === "rutas") {
      return [
        { label: "Rutas", value: String(rutasRows.length), color: BLUE },
        { label: "Kilómetros", value: String(rutasRows.reduce((sum, r) => sum + n(r.distancia), 0).toFixed(2)), color: GREEN },
        { label: "Horas", value: String(rutasRows.reduce((sum, r) => sum + n(r.tiempo), 0).toFixed(2)), color: ORANGE },
        { label: "Costo total", value: money(rutasRows.reduce((sum, r) => sum + n(r.costo), 0)), color: RED },
      ];
    }
    return [
      { label: "Total facturado", value: money(cobranzaKpi.totalFacturado), color: BLUE },
      { label: "Saldo por cobrar", value: money(cobranzaKpi.saldo), color: RED },
      { label: "Margen operativo", value: money(rentabilidadKpi.margen), color: GREEN },
      { label: "Viajes registrados", value: String(data.viajes.length), color: ORANGE },
    ];
  };

  const getPdfCharts = () => {
    if (reportType === "cobranza") {
      return {
        left: { title: "Estado de cobranza", data: estadoFacturaPie.map((r, i) => ({ label: String(r.name), value: n(r.value), color: COLORS[i % COLORS.length] })) },
        right: { title: "Cobrado vs saldo", data: cobradoVsSaldo.map((r, i) => ({ label: String(r.name), value: n(r.value), color: [GREEN, RED][i % 2] })) },
      };
    }
    if (reportType === "rentabilidad") {
      return {
        left: { title: "Margen por ruta", data: margenPorRuta.map((r, i) => ({ label: String(r.name), value: n(r.value), color: COLORS[i % COLORS.length] })) },
        right: { title: "Ingreso vs costo", data: [
          { label: "Ingreso cliente", value: rentabilidadKpi.ingresoCliente, color: BLUE },
          { label: "Costo proveedor", value: rentabilidadKpi.costoProveedor, color: ORANGE },
          { label: "Margen", value: rentabilidadKpi.margen, color: GREEN },
        ] },
      };
    }
    if (reportType === "operaciones") {
      return {
        left: { title: "Asignaciones por estado", data: groupCount(asignacionesRows, (row) => row.estado).map((r, i) => ({ label: String(r.name), value: n(r.value), color: COLORS[i % COLORS.length] })) },
        right: { title: "Top márgenes operativos", data: [...asignacionesRows].sort((a, b) => n(b.margen) - n(a.margen)).slice(0, 7).map((r, i) => ({ label: String(r.codigo_asignacion), value: n(r.margen), color: COLORS[i % COLORS.length] })) },
      };
    }
    if (reportType === "logistica") {
      return {
        left: { title: "Viajes por estado", data: viajesPorEstado.map((r, i) => ({ label: String(r.name), value: n(r.value), color: COLORS[i % COLORS.length] })) },
        right: { title: "Progreso promedio", data: viajesRows.slice(0, 7).map((r, i) => ({ label: String(r.codigo), value: n(r.progreso), color: COLORS[i % COLORS.length] })) },
      };
    }
    if (reportType === "comercial") {
      return {
        left: { title: "Oportunidades por cliente", data: oportunidadesPorCliente.map((r, i) => ({ label: String(r.name), value: n(r.value), color: COLORS[i % COLORS.length] })) },
        right: { title: "Pipeline comercial", data: groupCount(comercialRows, (row) => row.estado).map((r, i) => ({ label: String(r.name), value: n(r.value), color: COLORS[i % COLORS.length] })) },
      };
    }
    if (reportType === "proveedores") {
      return {
        left: { title: "Desempeño de proveedores", data: proveedoresPorNivel.map((r, i) => ({ label: String(r.name), value: n(r.value), color: COLORS[i % COLORS.length] })) },
        right: { title: "Estado SAT", data: groupCount(proveedoresRows, (row) => row.estadoSat).map((r, i) => ({ label: String(r.name), value: n(r.value), color: COLORS[i % COLORS.length] })) },
      };
    }
    if (reportType === "flota") {
      return {
        left: { title: "Estado de flota", data: flotaPorEstado.map((r, i) => ({ label: String(r.name), value: n(r.value), color: COLORS[i % COLORS.length] })) },
        right: { title: "Tipos de vehículo", data: groupCount(flotaRows, (row) => row.tipo).map((r, i) => ({ label: String(r.name), value: n(r.value), color: COLORS[i % COLORS.length] })) },
      };
    }
    if (reportType === "rutas") {
      return {
        left: { title: "Rutas por país", data: rutasPorPais.map((r, i) => ({ label: String(r.name), value: n(r.value), color: COLORS[i % COLORS.length] })) },
        right: { title: "Top costos de ruta", data: [...rutasRows].sort((a, b) => n(b.costo) - n(a.costo)).slice(0, 7).map((r, i) => ({ label: String(r.codigo_ruta), value: n(r.costo), color: COLORS[i % COLORS.length] })) },
      };
    }
    return {
      left: { title: "Finanzas generales", data: [
        { label: "Facturado", value: cobranzaKpi.totalFacturado, color: BLUE },
        { label: "Cobrado", value: cobranzaKpi.totalPagado, color: GREEN },
        { label: "Saldo", value: cobranzaKpi.saldo, color: RED },
      ] },
      right: { title: "Riesgos activos", data: [
        { label: "Cobranza", value: riesgos.filter((r) => r.tipo === "COBRANZA").length, color: ORANGE },
        { label: "Logística", value: riesgos.filter((r) => r.tipo === "LOGÍSTICA").length, color: BLUE },
        { label: "Proveedor", value: riesgos.filter((r) => r.tipo === "PROVEEDOR").length, color: RED },
      ] },
    };
  };

  const drawPdfCard = (doc: jsPDF, x: number, y: number, w: number, h: number, title: string, value: string, color: string) => {
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, w, h, 5, 5, 'FD');
    doc.setFillColor(12, 45, 107);
    const rgb = color === GREEN ? [34, 197, 94] : color === RED ? [239, 68, 68] : color === ORANGE ? [255, 107, 0] : [12, 45, 107];
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    doc.roundedRect(x, y + h - 2, w, 2, 1, 1, 'F');
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(title, x + 4, y + 7);
    doc.setTextColor(12, 45, 107);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(value, x + 4, y + 16);
  };


  const getPdfRecommendations = () => {
    const recomendaciones: string[] = [];

    if (reportType === "cobranza") {
      if (cobranzaKpi.saldo > 0) recomendaciones.push(`Priorizar recuperación de cartera por ${money(cobranzaKpi.saldo)}.`);
      if (cobranzaKpi.vencidas > 0) recomendaciones.push(`Dar seguimiento inmediato a ${cobranzaKpi.vencidas} comprobante(s) vencido(s).`);
      recomendaciones.push("Revisar semanalmente pagos parciales y compromisos de cobro por cliente.");
    } else if (reportType === "rentabilidad") {
      recomendaciones.push(`Mantener control del margen operativo actual: ${pct(rentabilidadKpi.margenPct)}.`);
      if (rentabilidadKpi.margenPct < 15) recomendaciones.push("Revisar tarifas de rutas con bajo margen antes de nuevas cotizaciones.");
      recomendaciones.push("Comparar costo proveedor contra factura cliente para negociar mejores tarifas.");
    } else if (reportType === "operaciones") {
      recomendaciones.push("Validar que cada asignación tenga factura cliente y costo proveedor registrados.");
      recomendaciones.push(`Dar seguimiento a ${data.proveedorAsignacion.filter((row) => !row.fecha_pago).length} pago(s) de proveedor sin fecha de pago.`);
      recomendaciones.push("Usar estados de asignación para medir cumplimiento operativo por semana.");
    } else if (reportType === "logistica") {
      if (logisticaKpi.alertasActivas > 0) recomendaciones.push(`Resolver ${logisticaKpi.alertasActivas} alerta(s) logística(s) activa(s).`);
      recomendaciones.push(`Avance promedio de viajes: ${pct(logisticaKpi.avancePromedio)}.`);
      recomendaciones.push("Mantener actualizado el tracking para mejorar visibilidad del cliente.");
    } else if (reportType === "comercial") {
      recomendaciones.push("Convertir oportunidades de mayor monto en cotizaciones formales.");
      recomendaciones.push("Dar seguimiento a clientes frecuentes para incrementar recompra logística.");
      recomendaciones.push("Comparar oportunidades ganadas contra cotizaciones para medir cierre comercial.");
    } else if (reportType === "proveedores") {
      const noSat = proveedoresRows.filter((row) => cleanEstado(row.estadoSat).includes("no")).length;
      if (noSat > 0) recomendaciones.push(`Actualizar documentación SAT de ${noSat} proveedor(es).`);
      recomendaciones.push("Priorizar proveedores con mejor desempeño para rutas críticas.");
      recomendaciones.push("Revisar proveedores con pagos pendientes para evitar bloqueos operativos.");
    } else if (reportType === "flota") {
      if (flotaKpi.mantenimiento > 0) recomendaciones.push(`Programar revisión de ${flotaKpi.mantenimiento} vehículo(s) en mantenimiento.`);
      recomendaciones.push(`Eficiencia promedio de flota: ${pct(flotaKpi.eficiencia)}.`);
      recomendaciones.push("Controlar kilometraje y mantenimiento preventivo para reducir fallas.");
    } else if (reportType === "rutas") {
      recomendaciones.push("Revisar rutas con mayor costo para negociar tarifas y tiempos.");
      recomendaciones.push("Mantener kilómetros y horas actualizadas para cotizar con precisión.");
      recomendaciones.push("Identificar rutas internacionales con mayor demanda y margen.");
    } else {
      recomendaciones.push("Usar este reporte como resumen ejecutivo para reuniones gerenciales semanales.");
      recomendaciones.push(`Cartera por cobrar actual: ${money(cobranzaKpi.saldo)}.`);
      recomendaciones.push(`Margen operativo actual: ${money(rentabilidadKpi.margen)}.`);
    }

    return recomendaciones.slice(0, 4);
  };

  const drawPdfTextBox = (doc: jsPDF, x: number, y: number, w: number, h: number, title: string, lines: string[]) => {
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, w, h, 5, 5, 'FD');

    doc.setTextColor(12, 45, 107);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(title, x + 5, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);

    let cursorY = y + 16;
    lines.forEach((line, index) => {
      const wrapped = doc.splitTextToSize(`${index + 1}. ${line}`, w - 10).slice(0, 2);
      doc.text(wrapped, x + 5, cursorY);
      cursorY += wrapped.length * 4.3 + 2;
    });
  };

  const drawPdfExecutiveBox = (doc: jsPDF, x: number, y: number, w: number, h: number) => {
    const resumen = [
      `Base de análisis: ${data.clientes.length} clientes, ${data.comprobantes.length} comprobantes y ${data.asignaciones.length} asignaciones.`,
      `Facturación total: ${money(cobranzaKpi.totalFacturado)} · Cobrado: ${money(cobranzaKpi.totalPagado)} · Saldo: ${money(cobranzaKpi.saldo)}.`,
      `Margen operativo registrado: ${money(rentabilidadKpi.margen)} (${pct(rentabilidadKpi.margenPct)}).`,
    ];

    drawPdfTextBox(doc, x, y, w, h, 'Lectura gerencial', resumen);
  };

  const drawPdfBarChart = (doc: jsPDF, x: number, y: number, w: number, h: number, title: string, rows: { label: string; value: number; color?: string }[], currency = false) => {
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, w, h, 5, 5, 'FD');
    doc.setTextColor(12, 45, 107);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(title, x + 4, y + 8);

    const dataRows = rows.filter((r) => n(r.value) > 0).slice(0, 6);
    if (!dataRows.length) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text('Sin datos para graficar', x + 4, y + 20);
      return;
    }

    const maxValue = Math.max(...dataRows.map((r) => n(r.value)), 1);
    const startY = y + 16;
    const rowH = Math.min(12, (h - 22) / dataRows.length);
    dataRows.forEach((row, index) => {
      const yy = startY + index * rowH;
      const label = String(row.label).slice(0, 24);
      const barW = ((w - 40) * n(row.value)) / maxValue;
      const rgb = row.color === GREEN ? [34, 197, 94] : row.color === RED ? [239, 68, 68] : row.color === ORANGE ? [255, 107, 0] : row.color === '#2563EB' ? [37, 99, 235] : [12, 45, 107];

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(label, x + 4, yy + 5);
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(x + 36, yy, w - 60, 6, 2, 2, 'F');
      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      doc.roundedRect(x + 36, yy, Math.max(8, barW), 6, 2, 2, 'F');
      doc.setTextColor(15, 23, 42);
      doc.text(currency ? money(row.value) : String(n(row.value).toLocaleString('en-US', { maximumFractionDigits: 2 })), x + w - 20, yy + 5, { align: 'right' });
    });
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const title = reportOptions.find((item) => item.id === reportType)?.label || "Reporte";
    const subtitle = `GL365 · ${title} · ${new Date().toLocaleString("es-GT")}`;
    const pdfKpis = getPdfKpis();
    const pdfCharts = getPdfCharts();
    const recomendaciones = getPdfRecommendations();

    doc.setFillColor(243, 244, 246);
    doc.rect(0, 0, pageW, pageH, 'F');

    // Header ejecutivo
    doc.setFillColor(12, 45, 107);
    doc.roundedRect(10, 8, pageW - 20, 30, 7, 7, 'F');
    doc.setTextColor(255, 107, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('REPORTES GERENCIALES', 18, 18);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text(`Reporte ${title}`, 18, 28);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(subtitle, pageW - 18, 18, { align: 'right' });
    doc.text('Fuente: MySQL · GL365 ERP', pageW - 18, 28, { align: 'right' });

    // Tarjetas KPI
    const cardY = 45;
    const gap = 4;
    const cardW = (pageW - 28 - gap * 3) / 4;
    pdfKpis.forEach((card, i) => drawPdfCard(doc, 14 + i * (cardW + gap), cardY, cardW, 22, card.label, card.value, card.color));

    // Gráficas resumidas
    drawPdfBarChart(doc, 14, 73, (pageW - 32) / 2, 52, pdfCharts.left.title, pdfCharts.left.data, reportType === 'cobranza' || reportType === 'rentabilidad' || reportType === 'operaciones' || reportType === 'ejecutivo' || reportType === 'rutas');
    drawPdfBarChart(doc, 18 + (pageW - 32) / 2, 73, (pageW - 32) / 2, 52, pdfCharts.right.title, pdfCharts.right.data, reportType === 'cobranza' || reportType === 'rentabilidad' || reportType === 'operaciones' || reportType === 'ejecutivo' || reportType === 'rutas');

    // Lectura gerencial + recomendaciones
    drawPdfExecutiveBox(doc, 14, 132, (pageW - 32) / 2, 48);
    drawPdfTextBox(doc, 18 + (pageW - 32) / 2, 132, (pageW - 32) / 2, 48, 'Acciones recomendadas', recomendaciones);

    // Footer
    doc.setFillColor(255, 107, 0);
    doc.rect(10, pageH - 14, pageW - 20, 1.2, 'F');
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text('Reporte generado automáticamente con datos reales del sistema GL365.', 14, pageH - 8);
    doc.text('GL365 ERP', pageW - 14, pageH - 8, { align: 'right' });

    // Página de detalle
    doc.addPage();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageW, pageH, 'F');
    doc.setFillColor(12, 45, 107);
    doc.rect(0, 0, pageW, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(`Detalle del reporte · ${title}`, 14, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Registros exportados: ${sortedTableRows.length}`, pageW - 14, 12, { align: 'right' });

    const body = sortedTableRows.map((row) =>
      Object.values(row).map((value) =>
        typeof value === 'number'
          ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : String(value ?? '')
      )
    );

    autoTable(doc, {
      startY: 24,
      head: [tableColumns.length ? tableColumns : ["Sin datos"]],
      body,
      styles: { fontSize: 7.1, cellPadding: 2.1, textColor: [30, 41, 59], lineColor: [226, 232, 240], lineWidth: 0.1 },
      headStyles: { fillColor: [12, 45, 107], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
      didDrawPage: () => {
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(8);
        doc.text(`Página ${doc.getNumberOfPages()}`, pageW - 14, pageH - 8, { align: 'right' });
      },
    });

    doc.save(`GL365_Reporte_${title}.pdf`);
  };

  const exportExcel = () => {
    const title = reportOptions.find((item) => item.id === reportType)?.label || "Reporte";
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sortedTableRows), "Detalle");

    const resumen = [
      { KPI: "Clientes", Valor: data.clientes.length },
      { KPI: "Comprobantes", Valor: data.comprobantes.length },
      { KPI: "Total facturado", Valor: cobranzaKpi.totalFacturado },
      { KPI: "Total cobrado", Valor: cobranzaKpi.totalPagado },
      { KPI: "Saldo por cobrar", Valor: cobranzaKpi.saldo },
      { KPI: "Asignaciones", Valor: data.asignaciones.length },
      { KPI: "Margen operativo", Valor: rentabilidadKpi.margen },
      { KPI: "Viajes", Valor: data.viajes.length },
      { KPI: "Vehículos", Valor: data.vehiculos.length },
    ];

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), "Resumen");
    XLSX.writeFile(wb, `GL365_Reporte_${title}.xlsx`);
  };

  const estadoFacturaPie = groupCount(comprobantesEnriquecidos, (row) => row.estado);
  const cobradoVsSaldo = [
    { name: "Cobrado", value: cobranzaKpi.totalPagado },
    { name: "Saldo", value: cobranzaKpi.saldo },
  ];

  const margenPorRuta = groupSum(asignacionesRows, (row) => row.ruta, (row) => n(row.margen))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const viajesPorEstado = groupCount(viajesRows, (row) => row.estadoEnvio);
  const oportunidadesPorCliente = groupSum(comercialRows, (row) => row.cliente, (row) => n(row.monto))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const proveedoresPorNivel = groupCount(proveedoresRows, (row) => row.nivel);
  const flotaPorEstado = groupCount(flotaRows, (row) => row.estado);
  const rutasPorPais = groupCount(rutasRows, (row) => {
    const destinoId = data.rutas.find((ruta) => n(ruta.id) === n(row.id))?.destino_id;
    return s(maps.ubicaciones.get(n(destinoId))?.pais || "Sin país");
  });

  const riesgos = useMemo(() => {
    const cobranza = comprobantesEnriquecidos
      .filter((row) => cleanEstado(row.estado) === "vencida" && n(row.saldo) > 0)
      .slice(0, 4)
      .map((row) => ({
        tipo: "COBRANZA",
        titulo: `${row.codigo} · ${row.cliente}`,
        detalle: `Saldo vencido ${money(row.saldo)}`,
        nivel: "Alto",
      }));

    const logistica = data.alertas
      .filter((row) => !n(row.leida))
      .slice(0, 4)
      .map((row) => ({
        tipo: "LOGÍSTICA",
        titulo: s(row.tipo || "Alerta operativa"),
        detalle: s(row.descripcion),
        nivel: s(row.nivel || "Medio"),
      }));

    const proveedor = proveedoresRows
      .filter((row) => cleanEstado(row.estadoSat).includes("no") || cleanEstado(row.nivel) === "rojo")
      .slice(0, 3)
      .map((row) => ({
        tipo: "PROVEEDOR",
        titulo: row.nombre,
        detalle: `SAT: ${row.estadoSat} · Desempeño: ${row.nivel}`,
        nivel: cleanEstado(row.nivel) === "rojo" ? "Crítico" : "Medio",
      }));

    return [...cobranza, ...logistica, ...proveedor];
  }, [comprobantesEnriquecidos, data.alertas, proveedoresRows]);

  const dynamicFilter = useMemo(() => {
    const unique = (values: any[]) =>
      Array.from(new Set(values.map((value) => s(value)).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "es", { numeric: true, sensitivity: "base" })
      );

    if (reportType === "ejecutivo") {
      return {
        label: "Área del resumen",
        all: "Todas las áreas",
        options: ["CRM", "Facturación", "Operaciones", "Logística", "Flota"],
      };
    }

    if (reportType === "cobranza") {
      return {
        label: "Estado factura",
        all: "Todos los estados",
        options: data.estadosFactura.map((row) => estadoFacturaNombre(row.id, maps.estadosFactura)).filter(Boolean),
      };
    }

    if (["rentabilidad", "operaciones"].includes(reportType)) {
      return {
        label: "Estado asignación",
        all: "Todas las asignaciones",
        options: ["Pendiente", "Asignada", "En curso", "Finalizada", "Cancelada"],
      };
    }

    if (reportType === "logistica") {
      const options = unique(
        data.viajes.map((row) => {
          const envio = data.envios.find((env) => n(env.id) === n(row.envio_id || row.envios_id));
          return estadoEnvioNombre(envio?.estado_id, maps.estadosEnvio);
        })
      );

      return {
        label: "Estado de envío",
        all: "Todos los envíos",
        options,
      };
    }

    if (reportType === "comercial") {
      const catalogoEtapas = unique(
        [...(data.estadosOportunidad || []), ...(data.estados_oportunidad || [])].map((row) =>
          s(row.nombre_estado_oportunidad || row.nombre_estado || row.estado || row.nombre || row.descripcion)
        )
      );

      const etapasEnOportunidades = unique(
        data.oportunidades.map((row) => estadoOportunidadNombre(row, maps.estadosOportunidad))
      ).filter((etapa) => cleanEstado(etapa) !== "sin etapa");

      const fallbackEtapas = ["Prospecto", "Contactado", "Cotización enviada", "Negociación", "Ganada", "Perdida"];

      return {
        label: "Etapa comercial",
        all: "Todas las etapas",
        options: unique([...catalogoEtapas, ...etapasEnOportunidades]).length
          ? unique([...catalogoEtapas, ...etapasEnOportunidades])
          : fallbackEtapas,
      };
    }

    if (reportType === "proveedores") {
      const niveles = unique(data.desempeno.map((row) => s(row.nivel))).map((row) => `Nivel: ${row}`);
      const sat = unique(data.cumplimiento.map((row) => s(row.estado_sat))).map((row) => `SAT: ${row}`);

      return {
        label: "Desempeño / SAT",
        all: "Todos los proveedores",
        options: [...niveles, ...sat],
      };
    }

    if (reportType === "flota") {
      return {
        label: "Estado vehículo",
        all: "Todos los vehículos",
        options: unique(data.vehiculos.map((row) => estadoVehiculoNombre(row.estado_id, maps.estadosVehiculo))),
      };
    }

    if (reportType === "rutas") {
      return {
        label: "País destino",
        all: "Todos los países",
        options: unique(data.rutas.map((row) => maps.ubicaciones.get(n(row.destino_id))?.pais || "Sin país")),
      };
    }

    return { label: "Filtro", all: "Todos", options: [] };
  }, [reportType, data, maps]);

  const dataStatusText = diagnostics?.counts
    ? `Datos reales cargados: ${diagnostics.counts.clientes || data.clientes.length} clientes, ${diagnostics.counts.comprobantes || data.comprobantes.length} comprobantes, ${diagnostics.counts.asignaciones || data.asignaciones.length} asignaciones.`
    : "Datos reales cargados desde MySQL.";

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#F3F4F6] px-3 py-5 text-[#071B3A] sm:px-4 lg:px-5">
      <div className="mb-5 w-full max-w-full rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-1 tracking-[0.35em] text-sm font-bold text-[#FF6B00]">REPORTES</p>
            <h1 className="text-3xl font-black leading-tight text-[#0C2D6B] lg:text-4xl">Reportes gerenciales</h1>
            <p className="mt-2 max-w-5xl text-base leading-relaxed text-slate-500 lg:text-lg">Indicadores reales conectados a MySQL y consistentes con Comprobantes, Operaciones, Logística, CRM y Flota.</p>
          </div>

          <div className="flex w-full shrink-0 flex-wrap items-center gap-3 rounded-3xl bg-slate-50 p-2 sm:w-auto sm:flex-nowrap sm:justify-end">
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-2xl bg-[#0C2D6B] px-4 py-3 text-sm font-bold text-white shadow-sm shadow-blue-900/20 transition hover:bg-[#092557] disabled:opacity-60"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>
            <button onClick={exportPDF} className="inline-flex min-w-[110px] items-center justify-center gap-2 rounded-2xl bg-[#EF4444] px-4 py-3 text-sm font-bold text-white shadow-sm shadow-red-900/20 transition hover:bg-[#DC2626]">
              <FileText size={18} /> PDF
            </button>
            <button onClick={exportExcel} className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-2xl bg-[#16A34A] px-4 py-3 text-sm font-bold text-white shadow-sm shadow-green-900/20 transition hover:bg-[#15803D]">
              <FileSpreadsheet size={18} /> Excel
            </button>
          </div>
        </div>
      </div>

      {(loading || apiError) && (
        <div className={`mb-5 rounded-2xl border px-5 py-4 font-semibold ${apiError ? "border-red-200 bg-red-50 text-red-700" : "border-blue-200 bg-blue-50 text-[#0C2D6B]"}`}>
          {apiError || "Cargando datos reales desde MySQL..."}
        </div>
      )}

      {!apiError && !loading && (
        <div className="mb-5 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm font-semibold text-green-700">
          {dataStatusText}
        </div>
      )}

      <div className="mb-5 grid w-full max-w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-9">
        {reportOptions.map((item) => {
          const Icon = item.icon;
          const active = reportType === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setReportType(item.id);
                setEstadoFiltro("");
                setSortField("");
                setSortDirection("asc");
              }}
              className={`min-w-0 rounded-2xl border px-3 py-3 text-left shadow-sm transition sm:px-4 sm:py-4 ${
                active
                  ? "border-[#0C2D6B] bg-[#0C2D6B] text-white"
                  : "border-slate-200 bg-white text-[#0C2D6B] hover:border-[#FF6B00]"
              }`}
            >
              <Icon size={20} className="mb-2" />
              <span className="block truncate text-sm font-black">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-5 w-full max-w-full rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex w-full max-w-full flex-col gap-3 2xl:flex-row 2xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por cliente, código, ruta, proveedor..."
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-4 outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20"
            />
          </div>

          <div className="flex w-full shrink-0 flex-wrap items-center gap-3 rounded-3xl bg-slate-50 p-2 sm:w-auto sm:flex-nowrap sm:justify-end">
            <div className="relative">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <select
                value={estadoFiltro}
                onChange={(event) => setEstadoFiltro(event.target.value)}
                className="w-full min-w-[190px] rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20 sm:w-[230px]"
                title={dynamicFilter.label}
              >
                <option value="">{dynamicFilter.all}</option>
                {dynamicFilter.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <input value={inicio} onChange={(event) => setInicio(event.target.value)} type="date" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20 sm:w-auto" />
            <input value={fin} onChange={(event) => setFin(event.target.value)} type="date" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20 sm:w-auto" />


          </div>
        </div>
      </div>

      {reportType === "ejecutivo" && (
        <>
          <div className="grid w-full max-w-full gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="Total facturado" value={money(cobranzaKpi.totalFacturado)} helper={`${data.comprobantes.length} comprobantes`} icon={<FileText />} border="blue" />
            <KpiCard title="Saldo por cobrar" value={money(cobranzaKpi.saldo)} helper={`${cobranzaKpi.vencidas} vencidas oficiales`} icon={<AlertTriangle />} border="red" />
            <KpiCard title="Margen operativo" value={money(rentabilidadKpi.margen)} helper={pct(rentabilidadKpi.margenPct)} icon={<Banknote />} border="green" />
            <KpiCard title="Viajes registrados" value={String(data.viajes.length)} helper={`${data.envios.length} envíos`} icon={<Truck />} border="orange" />
          </div>

          <div className="mt-5 grid w-full max-w-full gap-5 xl:grid-cols-2">
            <ChartCard title="Facturado, cobrado y saldo">
              <BarChart data={[{ name: "Finanzas", Facturado: cobranzaKpi.totalFacturado, Cobrado: cobranzaKpi.totalPagado, Saldo: cobranzaKpi.saldo }]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={55} />
                <YAxis />
                <Tooltip formatter={(value) => money(value)} />
                <Legend />
                <Bar dataKey="Facturado" fill={BLUE} />
                <Bar dataKey="Cobrado" fill={GREEN} />
                <Bar dataKey="Saldo" fill={RED} />
              </BarChart>
            </ChartCard>

            <ChartCard title="Riesgos y pendientes">
              <div className="h-[310px] overflow-y-auto pr-2">
                {riesgos.length ? (
                  <div className="space-y-3">
                    {riesgos.map((item, index) => (
                      <RiskItem key={`${item.tipo}-${index}`} {...item} />
                    ))}
                  </div>
                ) : (
                  <EmptyState text="Sin riesgos activos con los datos actuales." />
                )}
              </div>
            </ChartCard>
          </div>
        </>
      )}

      {reportType === "cobranza" && (
        <>
          <div className="grid w-full max-w-full gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="Total facturado" value={money(cobranzaKpi.totalFacturado)} helper={`${comprobantesEnriquecidos.length} comprobantes filtrados`} icon={<FileText />} border="blue" />
            <KpiCard title="Pagadas" value={String(cobranzaKpi.pagadas)} helper="Estado oficial en MySQL" icon={<CheckCircle2 />} border="green" />
            <KpiCard title="Pendientes" value={String(cobranzaKpi.pendientes)} helper="Estado oficial en MySQL" icon={<Clock3 />} border="orange" />
            <KpiCard title="Saldo por cobrar" value={money(cobranzaKpi.saldo)} helper={`${cobranzaKpi.vencidas} vencidas oficiales`} icon={<Banknote />} border="red" />
          </div>

          <div className="mt-5 grid w-full max-w-full gap-5 xl:grid-cols-2">
            <ChartCard title="Estado de cobranza">
              <PieChart>
                <Pie data={estadoFacturaPie} dataKey="value" nameKey="name" innerRadius={65} outerRadius={105} label>
                  {estadoFacturaPie.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ChartCard>
            <ChartCard title="Cobrado vs saldo">
              <PieChart>
                <Pie data={cobradoVsSaldo} dataKey="value" nameKey="name" innerRadius={65} outerRadius={105} label>
                  {cobradoVsSaldo.map((_, index) => (
                    <Cell key={index} fill={[GREEN, RED][index % 2]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => money(value)} />
                <Legend />
              </PieChart>
            </ChartCard>
          </div>
        </>
      )}

      {reportType === "rentabilidad" && (
        <>
          <div className="grid w-full max-w-full gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="Ingresos cliente" value={money(rentabilidadKpi.ingresoCliente)} helper="Factura asignación" icon={<FileText />} border="blue" />
            <KpiCard title="Costo proveedor" value={money(rentabilidadKpi.costoProveedor)} helper="Proveedor asignación" icon={<Truck />} border="orange" />
            <KpiCard title="Margen" value={money(rentabilidadKpi.margen)} helper={pct(rentabilidadKpi.margenPct)} icon={<Banknote />} border="green" />
            <KpiCard title="Asignaciones" value={String(asignacionesRows.length)} helper="Registros filtrados" icon={<BriefcaseBusiness />} border="blue" />
          </div>

          <div className="mt-5 grid w-full max-w-full gap-5 xl:grid-cols-2">
            <ChartCard title="Margen por ruta">
              <BarChart data={margenPorRuta}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" hide />
                <YAxis />
                <Tooltip formatter={(value) => money(value)} />
                <Bar dataKey="value" fill={GREEN} name="Margen" />
              </BarChart>
            </ChartCard>
            <ChartCard title="Ingreso vs costo">
              <BarChart data={asignacionesRows.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="codigo_asignacion" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip formatter={(value) => money(value)} />
                <Legend />
                <Bar dataKey="facturaCliente" fill={BLUE} name="Ingreso" />
                <Bar dataKey="costoProveedor" fill={ORANGE} name="Costo proveedor" />
              </BarChart>
            </ChartCard>
          </div>
        </>
      )}

      {reportType === "operaciones" && (
        <>
          <div className="grid w-full max-w-full gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="Asignaciones" value={String(asignacionesRows.length)} helper="Unidades asignadas" icon={<Truck />} border="blue" />
            <KpiCard title="Completadas" value={String(asignacionesRows.filter((r) => cleanEstado(r.estado).includes("final")).length)} helper="Estado asignación" icon={<CheckCircle2 />} border="green" />
            <KpiCard title="Margen total" value={money(rentabilidadKpi.margen)} helper="Ingreso - costo proveedor" icon={<Banknote />} border="green" />
            <KpiCard title="Pagos proveedor pendientes" value={String(data.proveedorAsignacion.filter((row) => !row.fecha_pago).length)} helper="Sin fecha de pago" icon={<AlertTriangle />} border="orange" />
          </div>

          <div className="mt-5 grid w-full max-w-full gap-5 xl:grid-cols-2">
            <ChartCard title="Asignaciones por estado">
              <BarChart data={groupCount(asignacionesRows, (row) => row.estado)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={55} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill={BLUE} name="Asignaciones" />
              </BarChart>
            </ChartCard>
            <ChartCard title="Top márgenes operativos">
              <BarChart data={[...asignacionesRows].sort((a, b) => n(b.margen) - n(a.margen)).slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="codigo_asignacion" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip formatter={(value) => money(value)} />
                <Bar dataKey="margen" fill={GREEN} name="Margen" />
              </BarChart>
            </ChartCard>
          </div>
        </>
      )}

      {reportType === "logistica" && (
        <>
          <div className="grid w-full max-w-full gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="Viajes" value={String(logisticaKpi.total)} helper={`${data.envios.length} envíos`} icon={<Truck />} border="blue" />
            <KpiCard title="En curso" value={String(logisticaKpi.enCurso)} helper="Progreso entre 1% y 99%" icon={<Clock3 />} border="orange" />
            <KpiCard title="Finalizados" value={String(logisticaKpi.finalizados)} helper="Progreso 100%" icon={<CheckCircle2 />} border="green" />
            <KpiCard title="Alertas activas" value={String(logisticaKpi.alertasActivas)} helper="Alertas sin leer" icon={<AlertTriangle />} border="red" />
          </div>

          <div className="mt-5 grid w-full max-w-full gap-5 xl:grid-cols-2">
            <ChartCard title="Viajes por estado de envío">
              <PieChart>
                <Pie data={viajesPorEstado} dataKey="value" nameKey="name" innerRadius={60} outerRadius={105} label>
                  {viajesPorEstado.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ChartCard>
            <ChartCard title="Progreso de viajes">
              <BarChart data={viajesRows.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="codigo" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="progreso" fill={BLUE} name="Progreso %" />
              </BarChart>
            </ChartCard>
          </div>
        </>
      )}

      {reportType === "comercial" && (
        <>
          <div className="grid w-full max-w-full gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="Clientes" value={String(data.clientes.length)} helper="Base CRM" icon={<Users />} border="blue" />
            <KpiCard title="Oportunidades" value={String(comercialRows.length)} helper="Pipeline comercial" icon={<BriefcaseBusiness />} border="orange" />
            <KpiCard title="Monto estimado" value={money(comercialRows.reduce((sum, row) => sum + n(row.monto), 0))} helper="Total oportunidades" icon={<Banknote />} border="green" />
            <KpiCard title="Cotizaciones" value={String(data.cotizaciones.length)} helper={`${data.cotizacionDetalle.length} líneas`} icon={<FileText />} border="blue" />
          </div>

          <div className="mt-5 grid w-full max-w-full gap-5 xl:grid-cols-2">
            <ChartCard title="Oportunidades por cliente">
              <BarChart data={oportunidadesPorCliente}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" hide />
                <YAxis />
                <Tooltip formatter={(value) => money(value)} />
                <Bar dataKey="value" fill={BLUE} name="Monto" />
              </BarChart>
            </ChartCard>
            <ChartCard title="Monto vs ponderado">
              <BarChart data={comercialRows.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="codigo_oportunidad" />
                <YAxis />
                <Tooltip formatter={(value) => money(value)} />
                <Legend />
                <Bar dataKey="monto" fill={BLUE} name="Monto" />
                <Bar dataKey="ponderado" fill={GREEN} name="Ponderado" />
              </BarChart>
            </ChartCard>
          </div>
        </>
      )}

      {reportType === "proveedores" && (
        <>
          <div className="grid w-full max-w-full gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="Proveedores" value={String(proveedoresRows.length)} helper="Directorio" icon={<Building2 />} border="blue" />
            <KpiCard title="SAT no vigente" value={String(proveedoresRows.filter((row) => cleanEstado(row.estadoSat).includes("no")).length)} helper="Cumplimiento" icon={<AlertTriangle />} border="red" />
            <KpiCard title="Asignado a proveedor" value={money(proveedoresRows.reduce((sum, row) => sum + n(row.asignado), 0))} helper="Proveedor asignación" icon={<Banknote />} border="green" />
            <KpiCard title="Pagos pendientes" value={String(data.proveedorAsignacion.filter((row) => !row.fecha_pago).length)} helper="Sin fecha de pago" icon={<Clock3 />} border="orange" />
          </div>

          <div className="mt-5 grid w-full max-w-full gap-5 xl:grid-cols-2">
            <ChartCard title="Desempeño de proveedores">
              <PieChart>
                <Pie data={proveedoresPorNivel} dataKey="value" nameKey="name" innerRadius={60} outerRadius={105} label>
                  {proveedoresPorNivel.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ChartCard>
            <ChartCard title="Monto asignado por proveedor">
              <BarChart data={[...proveedoresRows].sort((a, b) => n(b.asignado) - n(a.asignado)).slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="codigo_proveedor" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip formatter={(value) => money(value)} />
                <Bar dataKey="asignado" fill={BLUE} name="Asignado" />
              </BarChart>
            </ChartCard>
          </div>
        </>
      )}

      {reportType === "flota" && (
        <>
          <div className="grid w-full max-w-full gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="Vehículos" value={String(flotaKpi.total)} helper="Flota registrada" icon={<Truck />} border="blue" />
            <KpiCard title="Disponibles" value={String(flotaKpi.disponibles)} helper="Estado Disponible" icon={<CheckCircle2 />} border="green" />
            <KpiCard title="En uso" value={String(flotaKpi.enUso)} helper="Asignado / En ruta" icon={<RouteIcon />} border="blue" />
            <KpiCard title="Mantenimiento" value={String(flotaKpi.mantenimiento)} helper={`Eficiencia prom. ${pct(flotaKpi.eficiencia)}`} icon={<Wrench />} border="orange" />
          </div>

          <div className="mt-5 grid w-full max-w-full gap-5 xl:grid-cols-2">
            <ChartCard title="Estado de flota">
              <PieChart>
                <Pie data={flotaPorEstado} dataKey="value" nameKey="name" innerRadius={60} outerRadius={105} label>
                  {flotaPorEstado.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ChartCard>
            <ChartCard title="Eficiencia por vehículo">
              <BarChart data={flotaRows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="codigo" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="eficiencia" fill={GREEN} name="Eficiencia %" />
              </BarChart>
            </ChartCard>
          </div>
        </>
      )}

      {reportType === "rutas" && (
        <>
          <div className="grid w-full max-w-full gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="Rutas" value={String(rutasRows.length)} helper="Catálogo activo" icon={<RouteIcon />} border="blue" />
            <KpiCard title="Kilómetros totales" value={n(rutasRows.reduce((sum, row) => sum + n(row.distancia), 0)).toLocaleString("en-US")} helper="Suma de distancia_km" icon={<Truck />} border="green" />
            <KpiCard title="Costo rutas" value={money(rutasRows.reduce((sum, row) => sum + n(row.costo), 0))} helper="Suma costo" icon={<Banknote />} border="orange" />
            <KpiCard title="Internacionales" value={String(rutasRows.filter((row) => maps.ubicaciones.get(n(row.destino_id))?.pais && maps.ubicaciones.get(n(row.destino_id))?.pais !== "Guatemala").length)} helper="Destino fuera de GT" icon={<RouteIcon />} border="blue" />
          </div>

          <div className="mt-5 grid w-full max-w-full gap-5 xl:grid-cols-2">
            <ChartCard title="Rutas por país destino">
              <PieChart>
                <Pie data={rutasPorPais} dataKey="value" nameKey="name" innerRadius={60} outerRadius={105} label>
                  {rutasPorPais.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ChartCard>
            <ChartCard title="Rutas con mayor distancia">
              <BarChart data={[...rutasRows].sort((a, b) => n(b.distancia) - n(a.distancia)).slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="codigo_ruta" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="distancia" fill={BLUE} name="Km" />
              </BarChart>
            </ChartCard>
          </div>
        </>
      )}

      <div className="mt-5 w-full max-w-full rounded-[24px] bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-2 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black text-[#0C2D6B]">Detalle del reporte</h2>
            <p className="text-sm text-slate-500">La tabla se construye con la información real recibida desde MySQL.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600">
              {sortedTableRows.length} registros visibles
            </span>
            <button
              type="button"
              onClick={clearReportFilters}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-white px-4 py-2 text-sm font-bold text-[#FF6B00] shadow-sm transition hover:border-[#FF6B00] hover:bg-orange-50"
            >
              <X size={16} />
              Limpiar
            </button>
          </div>
        </div>

        <div className="max-w-full overflow-x-auto">
          {sortedTableRows.length ? (
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  {tableColumns.map((key) => (
                    <th key={key} className="whitespace-nowrap px-4 py-3 font-black lg:px-5 lg:py-4">
                      <button
                        type="button"
                        onClick={() => handleSort(key)}
                        className={`inline-flex items-center gap-0.5 text-[12px] font-black uppercase tracking-wide transition-colors hover:text-[#FF6B00] ${
                          sortField === key ? "text-[#FF6B00]" : "text-[#0C2D6B]"
                        }`}
                        title="Ordenar ascendente o descendente"
                      >
                        <span>{key}</span>
                        <span className={`text-[9px] leading-none ${sortField === key ? "text-[#FF6B00]" : "text-slate-300"}`}>
                          {sortIcon(key)}
                        </span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedTableRows.slice(0, 80).map((row, index) => (
                  <tr key={index} className="border-t border-slate-100 hover:bg-slate-50">
                    {tableColumns.map((column) => {
                      const value = row[column];
                      return (
                        <td key={column} className="max-w-[260px] whitespace-normal px-4 py-3 font-semibold text-slate-700 lg:px-5 lg:py-4">
                          {typeof value === "number" && !["Valor"].includes(column) ? money(value) : String(value ?? "-")}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState text="No hay registros reales para mostrar con los filtros actuales." />
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  helper,
  icon,
  border,
}: {
  title: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  border: "blue" | "green" | "orange" | "red";
}) {
  const borderClass = {
    blue: "border-b-[#0C2D6B]",
    green: "border-b-[#22C55E]",
    orange: "border-b-[#FF6B00]",
    red: "border-b-[#EF4444]",
  }[border];

  return (
    <div className={`min-w-0 rounded-2xl border-b-4 ${borderClass} bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:p-5`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <h3 className="mt-1 break-words text-2xl font-black leading-tight text-[#0C2D6B]">{value}</h3>
          <p className="mt-1 text-xs font-medium text-slate-400">{helper}</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#0C2D6B] lg:h-14 lg:w-14">{icon}</div>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:p-5">
      <h2 className="mb-4 text-xl font-black text-[#0C2D6B]">{title}</h2>
      <div className="h-[300px] min-w-0 lg:h-[330px]">
        <ResponsiveContainer width="100%" height="100%">
          {children as any}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function RiskItem({ tipo, titulo, detalle, nivel }: { tipo: string; titulo: string; detalle: string; nivel: string }) {
  const severity = cleanEstado(nivel);
  const color =
    severity.includes("critico") || severity.includes("alto")
      ? "bg-red-50 text-red-700"
      : severity.includes("medio")
      ? "bg-amber-50 text-amber-700"
      : "bg-blue-50 text-blue-700";

  return (
    <div className="rounded-2xl border border-slate-100 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-wide text-slate-400">{tipo}</p>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${color}`}>{nivel}</span>
      </div>
      <p className="font-black text-[#0C2D6B]">{titulo}</p>
      <p className="mt-1 text-sm text-slate-500">{detalle}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="flex min-h-[180px] items-center justify-center p-10 text-center font-semibold text-slate-400">{text}</div>;
}