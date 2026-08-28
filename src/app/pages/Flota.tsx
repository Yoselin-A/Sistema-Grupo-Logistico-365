import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Download,
  Edit2,
  Eye,
  Filter,
  Gauge,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Truck,
  Wrench,
  X,
} from "lucide-react";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

const API_BASE_URL = "/api";

type Modo = "nuevo" | "ver" | "editar" | null;
type AnyRow = Record<string, any>;

interface TipoVehiculo {
  id: number;
  codigo_tipo_vehiculo: string;
  nombre_tipo_vehiculo: string;
}

interface EstadoVehiculo {
  id: number;
  codigo_estado: string;
  nombre_estado_vehiculo: string;
}

interface EstadoMantenimiento {
  id: number;
  codigo_estado: string;
  nombre_estado_mantenimiento: string;
}

interface Vehiculo {
  id: number;
  codigo: string;
  tipo_id: number | null;
  estado_id: number | null;
  eficiencia: number | null;
  kilometraje: number | string | null;
  estado_mantenimiento_id: number | null;
  estados_mantenimiento_id?: number | null;
  proximo_mantenimiento: string | null;

  tipo?: string;
  estado?: string;
  mantenimiento?: string;

  ultimo_mantenimiento_id?: number | null;
  ultimo_codigo_mantenimiento?: string | null;
  ultimo_tipo_mantenimiento?: string | null;
  ultimo_descripcion_mantenimiento?: string | null;
  ultimo_fecha_mantenimiento?: string | null;
  ultimo_proximo_mantenimiento?: string | null;
  ultimo_costo_mantenimiento?: number | string | null;
}

type ConfirmState = {
  vehiculo: Vehiculo;
  loading: boolean;
} | null;

type FormErrors = Record<string, string>;

type MaintenanceForm = {
  vehiculo_id: number;
  codigo_vehiculo: string;
  tipo: string;
  descripcion: string;
  fecha: string;
  proximo: string;
  costo: string;
  estado_mantenimiento_id: number | "";
};

const inputClass =
  "w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/10 disabled:bg-gray-100 disabled:text-gray-500";
const errorInput = "border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-100";
const labelClass = "text-xs font-bold text-gray-600 mb-1.5 block";

async function apiRequest(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  let json: any = null;

  try {
    json = await response.json();
  } catch {
    json = null;
  }

  if (!response.ok || json?.ok === false) {
    throw new Error(json?.message || json?.error || `Error HTTP ${response.status}`);
  }

  return json?.data ?? json;
}

const asArray = <T,>(value: any): T[] => (Array.isArray(value) ? value : []);

const cleanCode = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 15);

const cleanInteger = (value: string, maxDigits = 3) =>
  value.replace(/\D/g, "").slice(0, maxDigits);

const cleanDecimal = (value: string, maxInteger = 9, maxDecimals = 2) => {
  const parts = value.replace(/[^0-9.]/g, "").split(".");
  const integer = parts[0].slice(0, maxInteger);
  const decimals = parts.slice(1).join("").slice(0, maxDecimals);

  return parts.length > 1 ? `${integer}.${decimals}` : integer;
};

const cleanMaintenanceText = (value: string, max = 180) =>
  titleCaseMaintenance(
    value
      .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s.,#&()'/-]/g, "")
      .replace(/\s+/g, " ")
  ).slice(0, max);

function titleCaseMaintenance(value: string) {
  return value
    .trimStart()
    .toLocaleLowerCase("es-GT")
    .replace(/(^|[\s'-])([a-záéíóúüñ])/g, (_m, sep, letter) => `${sep}${letter.toLocaleUpperCase("es-GT")}`)
    .replace(/\bGL365\b/gi, "GL365");
}

const numeric = (value: any) => {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

type SortDirection = "asc" | "desc";

const compareValues = (a: any, b: any, direction: SortDirection) => {
  const av = a ?? "";
  const bv = b ?? "";

  if (typeof av === "number" || typeof bv === "number") {
    const result = Number(av || 0) - Number(bv || 0);
    return direction === "asc" ? result : -result;
  }

  const result = String(av).localeCompare(String(bv), "es", {
    numeric: true,
    sensitivity: "base",
  });

  return direction === "asc" ? result : -result;
};

const formatKm = (value: any) =>
  numeric(value).toLocaleString("es-GT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const formatMoney = (value: any) =>
  new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
  }).format(numeric(value));

const dateText = (value: any) => {
  const text = String(value || "");
  return text ? text.slice(0, 10) : "-";
};

const safeDate = (value: any) => {
  const text = String(value || "");
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
};

const getEfficiencyTone = (value: any) => {
  const n = numeric(value);
  if (n >= 85) return "bg-green-500";
  if (n >= 70) return "bg-yellow-500";
  return "bg-red-500";
};

const getEstadoColor = (estado: string) => {
  const text = String(estado || "").toLowerCase();

  if (text.includes("disponible")) return "bg-green-100 text-green-700 border-green-200";
  if (text.includes("asignado") || text.includes("ruta") || text.includes("uso")) {
    return "bg-blue-100 text-blue-700 border-blue-200";
  }
  if (text.includes("mantenimiento")) return "bg-orange-100 text-orange-700 border-orange-200";

  return "bg-gray-100 text-gray-700 border-gray-200";
};

const getMantenimientoColor = (estado: string) => {
  const text = String(estado || "").toLowerCase();

  if (text.includes("día") || text.includes("dia")) return "bg-green-100 text-green-700 border-green-200";
  if (text.includes("pendiente")) return "bg-orange-100 text-orange-700 border-orange-200";
  if (text.includes("proceso")) return "bg-blue-100 text-blue-700 border-blue-200";

  return "bg-gray-100 text-gray-700 border-gray-200";
};

function moveOnEnter(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "Enter" || event.shiftKey) return;

  const target = event.target as HTMLElement;
  if (target.tagName === "TEXTAREA") return;

  event.preventDefault();

  const form = target.closest("[data-form]");
  if (!form) return;

  const fields = Array.from(
    form.querySelectorAll<HTMLElement>("input, select, textarea, button")
  ).filter((item) => {
    const disabled = item.hasAttribute("disabled") || item.getAttribute("aria-disabled") === "true";
    const hidden = item.offsetParent === null;

    return !disabled && !hidden;
  });

  const index = fields.indexOf(target);
  const next = fields[index + 1];

  if (next) {
    next.focus();
    return;
  }

  const save = form.querySelector<HTMLButtonElement>("[data-save-button='true']");
  save?.click();
}

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold ${className}`}>
      {children}
    </span>
  );
}

function KpiCard({
  title,
  value,
  icon: Icon,
  bar,
}: {
  title: string;
  value: string | number;
  icon: any;
  bar: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className={`absolute bottom-0 left-0 h-1 w-full ${bar}`} />
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <h3 className="mt-1 text-2xl font-bold text-[#0C2D6B]">{value}</h3>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#0C2D6B]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  title,
  icon: Icon,
  tone = "default",
  onClick,
}: {
  title: string;
  icon: any;
  tone?: "default" | "blue" | "orange" | "green" | "red";
  onClick: () => void;
}) {
  const tones = {
    default: "border-gray-200 text-gray-600 hover:bg-gray-50",
    blue: "border-blue-100 bg-blue-50 text-[#0C2D6B] hover:bg-blue-100",
    orange: "border-orange-100 bg-orange-50 text-[#FF6A00] hover:bg-orange-100",
    green: "border-green-100 bg-green-50 text-green-600 hover:bg-green-100",
    red: "border-red-100 bg-red-50 text-red-600 hover:bg-red-100",
  };

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition-colors ${tones[tone]}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function Field({
  label,
  error,
  children,
  className = "",
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className={labelClass}>{label}</label>
      {children}
      {error && <p className="mt-1 text-[11px] font-semibold text-red-600">{error}</p>}
    </div>
  );
}

export function Flota() {
  const [modo, setModo] = useState<Modo>(null);
  const [selected, setSelected] = useState<Vehiculo | null>(null);
  const [deleteModal, setDeleteModal] = useState<ConfirmState>(null);
  const [maintenanceModal, setMaintenanceModal] = useState(false);
  const [maintenanceForm, setMaintenanceForm] = useState<MaintenanceForm | null>(null);
  const [maintenanceErrors, setMaintenanceErrors] = useState<FormErrors>({});

  const [tiposVehiculo, setTiposVehiculo] = useState<TipoVehiculo[]>([]);
  const [estadosVehiculo, setEstadosVehiculo] = useState<EstadoVehiculo[]>([]);
  const [estadosMantenimiento, setEstadosMantenimiento] = useState<EstadoMantenimiento[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);

  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("Todos");
  const [filterMantenimiento, setFilterMantenimiento] = useState("Todos");
  const [sortField, setSortField] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [notice, setNotice] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  const load = async () => {
    setLoading(true);
    setApiError("");

    try {
      const data = await apiRequest("/flota/bootstrap");

      setTiposVehiculo(asArray<TipoVehiculo>(data.tiposVehiculo));
      setEstadosVehiculo(asArray<EstadoVehiculo>(data.estadosVehiculo));
      setEstadosMantenimiento(asArray<EstadoMantenimiento>(data.estadosMantenimiento));
      setVehiculos(asArray<Vehiculo>(data.vehiculos));
    } catch (error: any) {
      console.error("Error cargando flota:", error);
      setApiError(error.message || "No se pudo conectar Flota con MySQL.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  };

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

  const SortChip = ({ field, label }: { field: string; label: ReactNode }) => (
    <button
      type="button"
      onClick={() => handleSort(field)}
      className={`h-8 rounded-full border px-3 text-[11px] font-bold transition-colors ${
        sortField === field
          ? "border-orange-200 bg-white text-[#FF6A00] shadow-sm"
          : "border-gray-200 bg-white text-[#0C2D6B] hover:bg-blue-50"
      }`}
      title="Ordenar ascendente o descendente"
    >
      {label} <span className="ml-1 text-[9px] leading-none">{sortIcon(field)}</span>
    </button>
  );

  const nombreTipo = (id?: number | null) =>
    tiposVehiculo.find((item) => Number(item.id) === Number(id))?.nombre_tipo_vehiculo || "Sin tipo";

  const nombreEstado = (id?: number | null) =>
    estadosVehiculo.find((item) => Number(item.id) === Number(id))?.nombre_estado_vehiculo || "Sin estado";

  const nombreMantenimiento = (id?: number | null) =>
    estadosMantenimiento.find((item) => Number(item.id) === Number(id))?.nombre_estado_mantenimiento ||
    "Sin mantenimiento";

  const disponibleId =
    estadosVehiculo.find((e) => e.nombre_estado_vehiculo.toLowerCase().includes("disponible"))?.id ||
    estadosVehiculo[0]?.id ||
    1;

  const alDiaId =
    estadosMantenimiento.find((e) =>
      e.nombre_estado_mantenimiento
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .includes("dia")
    )?.id ||
    estadosMantenimiento[0]?.id ||
    1;

  const enProcesoId =
    estadosMantenimiento.find((e) => e.nombre_estado_mantenimiento.toLowerCase().includes("proceso"))?.id ||
    alDiaId;

  const filteredVehiculos = useMemo(() => {
    const term = search.trim().toLowerCase();

    return vehiculos.filter((vehiculo) => {
      const tipo = vehiculo.tipo || nombreTipo(vehiculo.tipo_id);
      const estado = vehiculo.estado || nombreEstado(vehiculo.estado_id);
      const mantenimiento =
        vehiculo.mantenimiento || nombreMantenimiento(vehiculo.estado_mantenimiento_id || vehiculo.estados_mantenimiento_id);

      const matchText =
        !term ||
        `${vehiculo.codigo} ${tipo} ${estado} ${mantenimiento}`
          .toLowerCase()
          .includes(term);

      const matchEstado = filterEstado === "Todos" || Number(vehiculo.estado_id) === Number(filterEstado);
      const matchMantenimiento =
        filterMantenimiento === "Todos" ||
        Number(vehiculo.estado_mantenimiento_id || vehiculo.estados_mantenimiento_id) === Number(filterMantenimiento);

      return matchText && matchEstado && matchMantenimiento;
    });
  }, [vehiculos, search, filterEstado, filterMantenimiento, tiposVehiculo, estadosVehiculo, estadosMantenimiento]);

  const sortedVehiculos = useMemo(() => {
    const rows = [...filteredVehiculos];

    rows.sort((a, b) => {
      const tipoA = a.tipo || nombreTipo(a.tipo_id);
      const tipoB = b.tipo || nombreTipo(b.tipo_id);
      const estadoA = a.estado || nombreEstado(a.estado_id);
      const estadoB = b.estado || nombreEstado(b.estado_id);
      const mantenimientoA =
        a.mantenimiento || nombreMantenimiento(a.estado_mantenimiento_id || a.estados_mantenimiento_id);
      const mantenimientoB =
        b.mantenimiento || nombreMantenimiento(b.estado_mantenimiento_id || b.estados_mantenimiento_id);

      const av =
        sortField === "codigo" ? a.codigo :
        sortField === "tipo" ? tipoA :
        sortField === "estado" ? estadoA :
        sortField === "eficiencia" ? numeric(a.eficiencia) :
        sortField === "kilometraje" ? numeric(a.kilometraje) :
        sortField === "mantenimiento" ? mantenimientoA :
        sortField === "proximo" ? safeDate(a.proximo_mantenimiento) :
        "";

      const bv =
        sortField === "codigo" ? b.codigo :
        sortField === "tipo" ? tipoB :
        sortField === "estado" ? estadoB :
        sortField === "eficiencia" ? numeric(b.eficiencia) :
        sortField === "kilometraje" ? numeric(b.kilometraje) :
        sortField === "mantenimiento" ? mantenimientoB :
        sortField === "proximo" ? safeDate(b.proximo_mantenimiento) :
        "";

      return sortField ? compareValues(av, bv, sortDirection) : 0;
    });

    return rows;
  }, [filteredVehiculos, sortField, sortDirection, tiposVehiculo, estadosVehiculo, estadosMantenimiento]);

  const kpis = [
    {
      title: "Vehículos",
      value: vehiculos.length,
      icon: Truck,
      bar: "bg-[#0C2D6B]",
    },
    {
      title: "Disponibles",
      value: vehiculos.filter((v) => (v.estado || nombreEstado(v.estado_id)).toLowerCase().includes("disponible")).length,
      icon: CheckCircle,
      bar: "bg-green-500",
    },
    {
      title: "En operación",
      value: vehiculos.filter((v) => {
        const estado = (v.estado || nombreEstado(v.estado_id)).toLowerCase();
        return estado.includes("asignado") || estado.includes("ruta") || estado.includes("uso");
      }).length,
      icon: Gauge,
      bar: "bg-blue-500",
    },
    {
      title: "Mantenimiento",
      value: vehiculos.filter((v) => (v.estado || nombreEstado(v.estado_id)).toLowerCase().includes("mantenimiento")).length,
      icon: Wrench,
      bar: "bg-[#FF6A00]",
    },
  ];

  const openNuevo = () => {
    setErrors({});
    setSelected({
      id: 0,
      codigo: "",
      tipo_id: tiposVehiculo[0]?.id || null,
      estado_id: disponibleId,
      eficiencia: 80,
      kilometraje: "",
      estado_mantenimiento_id: alDiaId,
      proximo_mantenimiento: "",
    });
    setModo("nuevo");
  };

  const openVer = (vehiculo: Vehiculo) => {
    setErrors({});
    setSelected({
      ...vehiculo,
      proximo_mantenimiento: safeDate(vehiculo.proximo_mantenimiento),
    });
    setModo("ver");
  };

  const openEditar = (vehiculo: Vehiculo) => {
    setErrors({});
    setSelected({
      ...vehiculo,
      estado_mantenimiento_id: vehiculo.estado_mantenimiento_id || vehiculo.estados_mantenimiento_id || null,
      proximo_mantenimiento: safeDate(vehiculo.proximo_mantenimiento),
    });
    setModo("editar");
  };

  const validate = () => {
    if (!selected) return false;

    const nextErrors: FormErrors = {};
    const mantenimientoId = selected.estado_mantenimiento_id || selected.estados_mantenimiento_id;

    if (modo === "editar" && !cleanCode(selected.codigo || "")) {
      nextErrors.codigo = "Ingresa código o placa válida.";
    }

    if (!selected.tipo_id) nextErrors.tipo_id = "Selecciona el tipo de vehículo.";
    if (!selected.estado_id) nextErrors.estado_id = "Selecciona el estado.";

    if (selected.eficiencia === null || selected.eficiencia === undefined || selected.eficiencia === "") {
      nextErrors.eficiencia = "Ingresa la eficiencia.";
    } else if (numeric(selected.eficiencia) < 0 || numeric(selected.eficiencia) > 100) {
      nextErrors.eficiencia = "La eficiencia debe estar entre 0 y 100.";
    }

    if (selected.kilometraje === null || selected.kilometraje === undefined || selected.kilometraje === "") {
      nextErrors.kilometraje = "Ingresa el kilometraje.";
    } else if (numeric(selected.kilometraje) < 0) {
      nextErrors.kilometraje = "El kilometraje no puede ser negativo.";
    }

    if (!mantenimientoId) nextErrors.estado_mantenimiento_id = "Selecciona mantenimiento.";
    if (!selected.proximo_mantenimiento) nextErrors.proximo_mantenimiento = "Selecciona la fecha.";

    const estadoVehiculo = nombreEstado(selected.estado_id);
    const estadoMantenimiento = nombreMantenimiento(mantenimientoId);

    if (estadoVehiculo === "Mantenimiento" && estadoMantenimiento === "Al día") {
      nextErrors.estado_mantenimiento_id =
        "Si está en mantenimiento, selecciona Pendiente o En proceso.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const saveVehiculo = async () => {
    if (!selected || !validate()) return;

    try {
      const payload = {
        codigo: modo === "nuevo" ? selected.codigo : cleanCode(selected.codigo || ""),
        tipo_id: selected.tipo_id,
        estado_id: selected.estado_id,
        eficiencia: numeric(selected.eficiencia),
        kilometraje: numeric(selected.kilometraje),
        estado_mantenimiento_id: selected.estado_mantenimiento_id || selected.estados_mantenimiento_id,
        proximo_mantenimiento: selected.proximo_mantenimiento,
      };

      await apiRequest(
        modo === "editar" && selected.id ? `/flota/vehiculos/${selected.id}` : "/flota/vehiculos",
        {
          method: modo === "editar" ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );

      setModo(null);
      setSelected(null);
      setErrors({});
      await load();
      showNotice(modo === "nuevo" ? "Vehículo guardado correctamente." : "Vehículo actualizado correctamente.");
    } catch (error: any) {
      setErrors({ general: error.message || "No se pudo guardar el vehículo." });
    }
  };

  const openMantenimiento = (vehiculo: Vehiculo) => {
    const mantenimientoId =
      vehiculo.estado_mantenimiento_id ||
      vehiculo.estados_mantenimiento_id ||
      estadosMantenimiento[0]?.id ||
      "";

    const today = new Date().toISOString().slice(0, 10);

    const next = new Date();
    next.setMonth(next.getMonth() + 3);

    setMaintenanceErrors({});
    setMaintenanceForm({
      vehiculo_id: vehiculo.id,
      codigo_vehiculo: vehiculo.codigo,
      tipo: "Preventivo",
      descripcion: "",
      fecha: today,
      proximo: next.toISOString().slice(0, 10),
      costo: "",
      estado_mantenimiento_id: mantenimientoId,
    });
    setMaintenanceModal(true);
  };

  const validateMaintenance = () => {
    if (!maintenanceForm) return false;

    const nextErrors: FormErrors = {};

    if (!maintenanceForm.vehiculo_id) nextErrors.vehiculo_id = "Selecciona un vehículo.";
    if (!maintenanceForm.tipo.trim()) nextErrors.tipo = "Ingresa el tipo de mantenimiento.";
    if (!maintenanceForm.descripcion.trim()) nextErrors.descripcion = "Ingresa una descripción.";
    if (!maintenanceForm.fecha) nextErrors.fecha = "Selecciona la fecha.";
    if (!maintenanceForm.proximo) nextErrors.proximo = "Selecciona el próximo mantenimiento.";
    if (!maintenanceForm.costo || numeric(maintenanceForm.costo) < 0) nextErrors.costo = "Ingresa un costo válido.";
    if (!maintenanceForm.estado_mantenimiento_id) nextErrors.estado_mantenimiento_id = "Selecciona el estado.";

    setMaintenanceErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  const saveMantenimiento = async () => {
    if (!maintenanceForm || !validateMaintenance()) return;

    try {
      await apiRequest("/flota/mantenimientos", {
        method: "POST",
        body: JSON.stringify({
          vehiculo_id: maintenanceForm.vehiculo_id,
          tipo: cleanMaintenanceText(maintenanceForm.tipo, 60),
          descripcion: cleanMaintenanceText(maintenanceForm.descripcion, 250),
          fecha: maintenanceForm.fecha,
          proximo: maintenanceForm.proximo,
          costo: numeric(maintenanceForm.costo),
          estado_mantenimiento_id: maintenanceForm.estado_mantenimiento_id,
        }),
      });

      setMaintenanceModal(false);
      setMaintenanceForm(null);
      setMaintenanceErrors({});
      await load();
      showNotice("Mantenimiento registrado correctamente.");
    } catch (error: any) {
      setMaintenanceErrors({ general: error.message || "No se pudo registrar el mantenimiento." });
    }
  };

  const deleteVehiculo = async () => {
    if (!deleteModal) return;

    setDeleteModal({ ...deleteModal, loading: true });
    setApiError("");

    try {
      await apiRequest(`/flota/vehiculos/${deleteModal.vehiculo.id}`, { method: "DELETE" });
      setDeleteModal(null);
      await load();
      showNotice(`Vehículo ${deleteModal.vehiculo.codigo} eliminado correctamente.`);
    } catch (error: any) {
      setDeleteModal(null);
      setApiError(error.message || "No se pudo eliminar el vehículo.");
    }
  };

  const imprimirVehiculo = (vehiculo: Vehiculo) => {
    const doc = new jsPDF();

    const tipo = vehiculo.tipo || nombreTipo(vehiculo.tipo_id);
    const estado = vehiculo.estado || nombreEstado(vehiculo.estado_id);
    const mantenimiento =
      vehiculo.mantenimiento || nombreMantenimiento(vehiculo.estado_mantenimiento_id || vehiculo.estados_mantenimiento_id);

    doc.setFillColor(12, 45, 107);
    doc.rect(0, 0, 210, 32, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text("Grupo Logístico 365", 20, 15);

    doc.setFontSize(10);
    doc.text("Reporte de Vehículo", 20, 23);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);

    let y = 48;

    const line = (label: string, value: any) => {
      doc.setFont(undefined, "bold");
      doc.text(`${label}:`, 20, y);
      doc.setFont(undefined, "normal");
      doc.text(String(value || "-"), 82, y);
      y += 9;
    };

    line("Código / placa", vehiculo.codigo);
    line("Tipo", tipo);
    line("Estado", estado);
    line("Eficiencia", `${vehiculo.eficiencia || 0}%`);
    line("Kilometraje", `${formatKm(vehiculo.kilometraje)} km`);
    line("Mantenimiento", mantenimiento);
    line("Próximo mantenimiento", dateText(vehiculo.proximo_mantenimiento));

    if (vehiculo.ultimo_mantenimiento_id) {
      y += 5;
      doc.setTextColor(12, 45, 107);
      doc.setFont(undefined, "bold");
      doc.text("Último mantenimiento registrado", 20, y);
      y += 9;
      doc.setTextColor(0, 0, 0);

      line("Código", vehiculo.ultimo_codigo_mantenimiento || "-");
      line("Tipo", vehiculo.ultimo_tipo_mantenimiento || "-");
      line("Fecha", dateText(vehiculo.ultimo_fecha_mantenimiento));
      line("Costo", formatMoney(vehiculo.ultimo_costo_mantenimiento));
    }

    doc.save(`Vehiculo_${vehiculo.codigo}.pdf`);
  };

  const clearFilters = () => {
    setSearch("");
    setFilterEstado("Todos");
    setFilterMantenimiento("Todos");
    setSortField("");
    setSortDirection("asc");
  };

  const exportFlotaExcel = () => {
    const rows = sortedVehiculos.map((vehiculo) => {
      const tipo = vehiculo.tipo || nombreTipo(vehiculo.tipo_id);
      const estado = vehiculo.estado || nombreEstado(vehiculo.estado_id);
      const mantenimiento =
        vehiculo.mantenimiento || nombreMantenimiento(vehiculo.estado_mantenimiento_id || vehiculo.estados_mantenimiento_id);

      return {
        Código: vehiculo.codigo,
        Tipo: tipo,
        Estado: estado,
        Eficiencia: `${numeric(vehiculo.eficiencia)}%`,
        Kilometraje: numeric(vehiculo.kilometraje),
        Mantenimiento: mantenimiento,
        "Próximo mantenimiento": dateText(vehiculo.proximo_mantenimiento),
        "Último mantenimiento": vehiculo.ultimo_codigo_mantenimiento || "-",
        "Costo último mantenimiento": numeric(vehiculo.ultimo_costo_mantenimiento),
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Flota");
    XLSX.writeFile(wb, "Reporte_Flota_GL365.xlsx");
  };

  const exportFlotaPDF = () => {
    const doc = new jsPDF("landscape", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(12, 45, 107);
    doc.rect(0, 0, pageWidth, 24, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont(undefined, "bold");
    doc.text("Grupo Logístico 365", 14, 10);
    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    doc.text("Reporte de Flota", 14, 17);

    doc.setTextColor(12, 45, 107);
    doc.setFontSize(13);
    doc.setFont(undefined, "bold");
    doc.text("Resumen operativo", 14, 35);

    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    doc.setTextColor(75, 85, 99);
    doc.text(`Vehículos visibles: ${sortedVehiculos.length} de ${vehiculos.length}`, 14, 42);
    doc.text(`Disponibles: ${kpis[1].value}  |  En operación: ${kpis[2].value}  |  Mantenimiento: ${kpis[3].value}`, 14, 48);

    const columns = ["Código", "Tipo", "Estado", "Eficiencia", "Kilometraje", "Mantenimiento", "Próximo"];
    const rows = sortedVehiculos.map((vehiculo) => {
      const tipo = vehiculo.tipo || nombreTipo(vehiculo.tipo_id);
      const estado = vehiculo.estado || nombreEstado(vehiculo.estado_id);
      const mantenimiento =
        vehiculo.mantenimiento || nombreMantenimiento(vehiculo.estado_mantenimiento_id || vehiculo.estados_mantenimiento_id);

      return [
        vehiculo.codigo || "-",
        tipo,
        estado,
        `${numeric(vehiculo.eficiencia)}%`,
        `${formatKm(vehiculo.kilometraje)} km`,
        mantenimiento,
        dateText(vehiculo.proximo_mantenimiento),
      ];
    });

    let y = 58;

    doc.setFillColor(255, 106, 0);
    doc.roundedRect(14, y, pageWidth - 28, 10, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont(undefined, "bold");

    const widths = [34, 45, 34, 28, 34, 45, 32];
    let x = 18;
    columns.forEach((column, index) => {
      doc.text(column, x, y + 6.5);
      x += widths[index];
    });

    y += 13;
    doc.setFont(undefined, "normal");
    doc.setTextColor(17, 24, 39);

    rows.forEach((row, rowIndex) => {
      if (y > 185) {
        doc.addPage();
        y = 18;
      }

      if (rowIndex % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, y - 4, pageWidth - 28, 10, "F");
      }

      x = 18;
      row.forEach((value, index) => {
        doc.text(String(value).slice(0, index === 1 || index === 5 ? 30 : 18), x, y + 2);
        x += widths[index];
      });

      y += 10;
    });

    doc.save("Reporte_Flota_GL365.pdf");
  };

  return (
    <div className="w-full max-w-full space-y-5 overflow-hidden px-3 sm:px-4 pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0C2D6B]">Flota</h1>
          <p className="mt-1 text-gray-500">
            Control de vehículos, eficiencia, kilometraje y mantenimiento
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-[#0C2D6B] shadow-sm disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Cargando..." : "Actualizar"}
          </button>

          <button
            type="button"
            onClick={exportFlotaPDF}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-red-500 px-4 text-sm font-bold text-white shadow-sm hover:bg-red-600"
          >
            <Download className="h-4 w-4" />
            PDF
          </button>

          <button
            type="button"
            onClick={exportFlotaExcel}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#22C55E] px-4 text-sm font-bold text-white shadow-sm hover:bg-[#16A34A]"
          >
            <Download className="h-4 w-4" />
            Excel
          </button>

          <button
            type="button"
            onClick={openNuevo}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0C2D6B] px-5 text-sm font-bold text-white shadow-sm hover:bg-[#143C8C]"
          >
            <Plus className="h-4 w-4" />
            Nuevo Vehículo
          </button>
        </div>
      </div>

      {apiError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {apiError}
        </div>
      )}

      {notice && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.title} {...kpi} />
        ))}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_230px_250px_auto] gap-3">
          <div className="relative min-w-0">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por código, tipo, estado..."
              className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-12 pr-4 text-sm outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select
              value={filterEstado}
              onChange={(event) => setFilterEstado(event.target.value)}
              className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-12 pr-4 text-sm outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20"
            >
              <option value="Todos">Todos los estados</option>
              {estadosVehiculo.map((estado) => (
                <option key={estado.id} value={estado.id}>
                  {estado.nombre_estado_vehiculo}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Filter className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select
              value={filterMantenimiento}
              onChange={(event) => setFilterMantenimiento(event.target.value)}
              className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-12 pr-4 text-sm outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20"
            >
              <option value="Todos">Todo mantenimiento</option>
              {estadosMantenimiento.map((estado) => (
                <option key={estado.id} value={estado.id}>
                  {estado.nombre_estado_mantenimiento}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-orange-200 bg-white px-4 text-sm font-bold text-[#FF6A00] shadow-sm transition hover:border-[#FF6A00] hover:bg-orange-50 whitespace-nowrap"
          >
            <X className="h-4 w-4" />
            Limpiar
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase text-gray-400">Ordenar por:</span>
          <SortChip field="codigo" label="Código" />
          <SortChip field="tipo" label="Tipo" />
          <SortChip field="estado" label="Estado" />
          <SortChip field="eficiencia" label="Eficiencia" />
          <SortChip field="kilometraje" label="Kilometraje" />
          <SortChip field="mantenimiento" label="Mantenimiento" />
          <SortChip field="proximo" label="Próximo" />

          <span className="ml-0 lg:ml-auto text-sm font-bold text-gray-400">
            {sortedVehiculos.length} de {vehiculos.length} registros visibles
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sortedVehiculos.map((vehiculo) => {
          const tipo = vehiculo.tipo || nombreTipo(vehiculo.tipo_id);
          const estado = vehiculo.estado || nombreEstado(vehiculo.estado_id);
          const mantenimiento =
            vehiculo.mantenimiento || nombreMantenimiento(vehiculo.estado_mantenimiento_id || vehiculo.estados_mantenimiento_id);
          const efficiency = Math.max(0, Math.min(100, numeric(vehiculo.eficiencia)));

          return (
            <article key={vehiculo.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <h3 className="font-bold text-[#0C2D6B] text-lg leading-6 break-words">
                      {vehiculo.codigo}
                    </h3>
                    <p className="text-sm text-gray-500 leading-5">{tipo}</p>
                  </div>

                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#0C2D6B]">
                    <Truck className="h-7 w-7" />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge className={getEstadoColor(estado)}>{estado}</Badge>
                  <Badge className={getMantenimientoColor(mantenimiento)}>{mantenimiento}</Badge>
                </div>

                <div className="mb-4">
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="font-medium text-gray-600">Eficiencia</span>
                    <span className="font-bold text-[#0C2D6B]">{efficiency}%</span>
                  </div>

                  <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                    <div className={`h-full rounded-full ${getEfficiencyTone(efficiency)}`} style={{ width: `${efficiency}%` }} />
                  </div>
                </div>

                <div className="rounded-2xl bg-gray-50 p-3 mb-4">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-gray-500">Próximo:</span>
                    <b className="text-gray-800">{dateText(vehiculo.proximo_mantenimiento)}</b>
                  </div>

                  <div className="flex justify-between gap-3 text-sm mt-2">
                    <span className="text-gray-500">Kilómetros:</span>
                    <b className="text-gray-800">{formatKm(vehiculo.kilometraje)} km</b>
                  </div>
                </div>

                {vehiculo.ultimo_mantenimiento_id && (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 mb-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#0C2D6B]">
                      Último mantenimiento
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-800">
                      {vehiculo.ultimo_codigo_mantenimiento} · {vehiculo.ultimo_tipo_mantenimiento || "Servicio"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {dateText(vehiculo.ultimo_fecha_mantenimiento)} · {formatMoney(vehiculo.ultimo_costo_mantenimiento)}
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 bg-gray-50 px-3 py-2 flex justify-end gap-2">
                <ActionButton title="Ver" icon={Eye} tone="blue" onClick={() => openVer(vehiculo)} />
                <ActionButton title="Editar" icon={Edit2} tone="orange" onClick={() => openEditar(vehiculo)} />
                <ActionButton title="Imprimir" icon={Download} tone="green" onClick={() => imprimirVehiculo(vehiculo)} />
                <ActionButton title="Agregar mantenimiento" icon={Wrench} onClick={() => openMantenimiento(vehiculo)} />
                <ActionButton
                  title="Eliminar"
                  icon={Trash2}
                  tone="red"
                  onClick={() => setDeleteModal({ vehiculo, loading: false })}
                />
              </div>
            </article>
          );
        })}

        {!sortedVehiculos.length && (
          <div className="md:col-span-2 xl:col-span-3 rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-500">
            <Truck className="mx-auto mb-3 h-12 w-12 text-gray-300" />
            No se encontraron vehículos con los filtros seleccionados.
          </div>
        )}
      </div>

      {(modo === "nuevo" || modo === "editar" || modo === "ver") && selected && (
        <VehicleModal
          modo={modo}
          selected={selected}
          setSelected={setSelected}
          errors={errors}
          setErrors={setErrors}
          tiposVehiculo={tiposVehiculo}
          estadosVehiculo={estadosVehiculo}
          estadosMantenimiento={estadosMantenimiento}
          nombreTipo={nombreTipo}
          nombreEstado={nombreEstado}
          nombreMantenimiento={nombreMantenimiento}
          enProcesoId={enProcesoId}
          onClose={() => {
            setModo(null);
            setSelected(null);
            setErrors({});
          }}
          onSave={saveVehiculo}
        />
      )}

      {maintenanceModal && maintenanceForm && (
        <MaintenanceModal
          form={maintenanceForm}
          setForm={setMaintenanceForm}
          errors={maintenanceErrors}
          setErrors={setMaintenanceErrors}
          estadosMantenimiento={estadosMantenimiento}
          onClose={() => {
            setMaintenanceModal(false);
            setMaintenanceForm(null);
            setMaintenanceErrors({});
          }}
          onSave={saveMantenimiento}
        />
      )}

      {deleteModal && (
        <ConfirmDelete
          vehiculo={deleteModal.vehiculo}
          loading={deleteModal.loading}
          onCancel={() => !deleteModal.loading && setDeleteModal(null)}
          onConfirm={deleteVehiculo}
        />
      )}
    </div>
  );
}

function VehicleModal({
  modo,
  selected,
  setSelected,
  errors,
  setErrors,
  tiposVehiculo,
  estadosVehiculo,
  estadosMantenimiento,
  nombreTipo,
  nombreEstado,
  nombreMantenimiento,
  enProcesoId,
  onClose,
  onSave,
}: {
  modo: Exclude<Modo, null>;
  selected: Vehiculo;
  setSelected: React.Dispatch<React.SetStateAction<Vehiculo | null>>;
  errors: FormErrors;
  setErrors: React.Dispatch<React.SetStateAction<FormErrors>>;
  tiposVehiculo: TipoVehiculo[];
  estadosVehiculo: EstadoVehiculo[];
  estadosMantenimiento: EstadoMantenimiento[];
  nombreTipo: (id?: number | null) => string;
  nombreEstado: (id?: number | null) => string;
  nombreMantenimiento: (id?: number | null) => string;
  enProcesoId: number;
  onClose: () => void;
  onSave: () => void;
}) {
  const readonly = modo === "ver";
  const mantenimientoId = selected.estado_mantenimiento_id || selected.estados_mantenimiento_id || null;

  const clearError = (field: string) =>
    setErrors((prev) => ({
      ...prev,
      [field]: "",
    }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-3">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-xl font-bold text-[#0C2D6B]">
              {modo === "nuevo" ? "Nuevo Vehículo" : modo === "editar" ? "Editar Vehículo" : "Detalle de Vehículo"}
            </h2>
            <p className="mt-0.5 text-xs text-gray-400">
              {modo === "nuevo" ? "El código se genera automáticamente al guardar" : selected.codigo}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errors.general && (
          <div className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {errors.general}
          </div>
        )}

        <div data-form onKeyDown={moveOnEnter} className="overflow-y-auto p-5">
          {modo === "nuevo" && (
            <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm font-bold text-[#0C2D6B]">Código automático</p>
              <p className="mt-1 text-xs text-gray-600">
                El sistema generará un código tipo FL-001. Después podrás editarlo como placa/código si es necesario.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {modo !== "nuevo" && (
              <Field label="Código / placa *" error={errors.codigo}>
                <input
                  value={selected.codigo || ""}
                  disabled={readonly}
                  maxLength={15}
                  onChange={(event) => {
                    setSelected({ ...selected, codigo: cleanCode(event.target.value) });
                    clearError("codigo");
                  }}
                  className={`${inputClass} ${errors.codigo ? errorInput : ""}`}
                  placeholder="Ej. C-484BZD"
                />
              </Field>
            )}

            <Field label="Tipo de vehículo *" error={errors.tipo_id}>
              <select
                value={selected.tipo_id || ""}
                disabled={readonly}
                onChange={(event) => {
                  setSelected({ ...selected, tipo_id: event.target.value ? Number(event.target.value) : null });
                  clearError("tipo_id");
                }}
                className={`${inputClass} ${errors.tipo_id ? errorInput : ""}`}
              >
                <option value="">Seleccione tipo</option>
                {tiposVehiculo.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nombre_tipo_vehiculo}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Estado *" error={errors.estado_id}>
              <select
                value={selected.estado_id || ""}
                disabled={readonly}
                onChange={(event) => {
                  const estadoId = event.target.value ? Number(event.target.value) : null;
                  const estadoNombre = nombreEstado(estadoId);

                  setSelected({
                    ...selected,
                    estado_id: estadoId,
                    estado_mantenimiento_id:
                      estadoNombre === "Mantenimiento" ? enProcesoId : selected.estado_mantenimiento_id,
                  });

                  clearError("estado_id");
                  clearError("estado_mantenimiento_id");
                }}
                className={`${inputClass} ${errors.estado_id ? errorInput : ""}`}
              >
                <option value="">Seleccione estado</option>
                {estadosVehiculo.map((estado) => (
                  <option key={estado.id} value={estado.id}>
                    {estado.nombre_estado_vehiculo}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Eficiencia (%) *" error={errors.eficiencia}>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={3}
                value={selected.eficiencia ?? ""}
                disabled={readonly}
                onChange={(event) => {
                  const clean = cleanInteger(event.target.value, 3);
                  const n = clean === "" ? null : Math.min(100, Number(clean));
                  setSelected({ ...selected, eficiencia: n });
                  clearError("eficiencia");
                }}
                className={`${inputClass} ${errors.eficiencia ? errorInput : ""}`}
                placeholder="0 - 100"
              />
            </Field>

            <Field label="Kilometraje *" error={errors.kilometraje}>
              <input
                inputMode="decimal"
                value={selected.kilometraje ?? ""}
                disabled={readonly}
                onChange={(event) => {
                  setSelected({ ...selected, kilometraje: cleanDecimal(event.target.value, 9, 2) });
                  clearError("kilometraje");
                }}
                className={`${inputClass} ${errors.kilometraje ? errorInput : ""}`}
                placeholder="Solo números"
              />
            </Field>

            <Field label="Estado de mantenimiento *" error={errors.estado_mantenimiento_id}>
              <select
                value={mantenimientoId || ""}
                disabled={readonly}
                onChange={(event) => {
                  setSelected({
                    ...selected,
                    estado_mantenimiento_id: event.target.value ? Number(event.target.value) : null,
                  });
                  clearError("estado_mantenimiento_id");
                }}
                className={`${inputClass} ${errors.estado_mantenimiento_id ? errorInput : ""}`}
              >
                <option value="">Seleccione mantenimiento</option>
                {estadosMantenimiento.map((estado) => (
                  <option key={estado.id} value={estado.id}>
                    {estado.nombre_estado_mantenimiento}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Próximo mantenimiento *" error={errors.proximo_mantenimiento}>
              <input
                type="date"
                value={safeDate(selected.proximo_mantenimiento)}
                disabled={readonly}
                onChange={(event) => {
                  setSelected({ ...selected, proximo_mantenimiento: event.target.value });
                  clearError("proximo_mantenimiento");
                }}
                className={`${inputClass} ${errors.proximo_mantenimiento ? errorInput : ""}`}
              />
            </Field>
          </div>

          {readonly && (
            <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <h3 className="mb-3 text-sm font-bold text-[#0C2D6B]">Resumen del vehículo</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <Info label="Tipo" value={selected.tipo || nombreTipo(selected.tipo_id)} />
                <Info label="Estado" value={selected.estado || nombreEstado(selected.estado_id)} />
                <Info label="Eficiencia" value={`${selected.eficiencia || 0}%`} />
                <Info label="Kilometraje" value={`${formatKm(selected.kilometraje)} km`} />
                <Info label="Mantenimiento" value={selected.mantenimiento || nombreMantenimiento(mantenimientoId)} />
                <Info label="Próximo mantenimiento" value={dateText(selected.proximo_mantenimiento)} />
              </div>

              <div className="mt-4 rounded-2xl border border-blue-100 bg-white p-4">
                <h4 className="text-sm font-bold text-[#0C2D6B]">Último mantenimiento registrado</h4>

                {selected.ultimo_mantenimiento_id ? (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <Info label="Código" value={selected.ultimo_codigo_mantenimiento} />
                    <Info label="Tipo" value={selected.ultimo_tipo_mantenimiento} />
                    <Info label="Fecha" value={dateText(selected.ultimo_fecha_mantenimiento)} />
                    <Info label="Costo" value={formatMoney(selected.ultimo_costo_mantenimiento)} />
                    <Info className="sm:col-span-2" label="Descripción" value={selected.ultimo_descripcion_mantenimiento || "-"} />
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-gray-500">
                    No existen mantenimientos registrados para este vehículo.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {modo !== "ver" && (
          <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </button>

            <button
              data-save-button="true"
              type="button"
              onClick={onSave}
              className="h-10 rounded-xl bg-[#0C2D6B] px-5 text-sm font-bold text-white hover:bg-[#143C8C]"
            >
              Guardar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value, className = "" }: { label: string; value: any; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 break-words font-semibold text-gray-800">{value || "-"}</p>
    </div>
  );
}

function MaintenanceModal({
  form,
  setForm,
  errors,
  setErrors,
  estadosMantenimiento,
  onClose,
  onSave,
}: {
  form: MaintenanceForm;
  setForm: React.Dispatch<React.SetStateAction<MaintenanceForm | null>>;
  errors: FormErrors;
  setErrors: React.Dispatch<React.SetStateAction<FormErrors>>;
  estadosMantenimiento: EstadoMantenimiento[];
  onClose: () => void;
  onSave: () => void;
}) {
  const updateForm = (patch: Partial<MaintenanceForm>) => {
    setForm((current) => (current ? { ...current, ...patch } : current));
  };

  const clearError = (field: string) =>
    setErrors((prev) => ({
      ...prev,
      [field]: "",
    }));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 backdrop-blur-sm p-3">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-xl font-bold text-[#0C2D6B]">Agregar mantenimiento</h2>
            <p className="mt-0.5 text-xs text-gray-400">
              Vehículo seleccionado: {form.codigo_vehiculo}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errors.general && (
          <div className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {errors.general}
          </div>
        )}

        <div data-form onKeyDown={moveOnEnter} className="overflow-y-auto p-5">
          <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-bold text-[#0C2D6B]">Registro de servicio</p>
            <p className="mt-1 text-xs text-gray-600">
              Al guardar, el sistema crea un registro en mantenimiento y actualiza el próximo mantenimiento del vehículo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Tipo de mantenimiento *" error={errors.tipo}>
              <select
                value={form.tipo}
                onChange={(event) => {
                  updateForm({ tipo: event.target.value });
                  clearError("tipo");
                }}
                className={`${inputClass} ${errors.tipo ? errorInput : ""}`}
              >
                <option value="Preventivo">Preventivo</option>
                <option value="Correctivo">Correctivo</option>
                <option value="Revisión">Revisión</option>
                <option value="Servicio menor">Servicio menor</option>
                <option value="Servicio mayor">Servicio mayor</option>
              </select>
            </Field>

            <Field label="Costo *" error={errors.costo}>
              <input
                inputMode="decimal"
                value={form.costo}
                onChange={(event) => {
                  updateForm({ costo: cleanDecimal(event.target.value, 8, 2) });
                  clearError("costo");
                }}
                className={`${inputClass} ${errors.costo ? errorInput : ""}`}
                placeholder="Solo números"
              />
            </Field>

            <Field label="Fecha del mantenimiento *" error={errors.fecha}>
              <input
                type="date"
                value={form.fecha}
                onChange={(event) => {
                  updateForm({ fecha: event.target.value });
                  clearError("fecha");
                }}
                className={`${inputClass} ${errors.fecha ? errorInput : ""}`}
              />
            </Field>

            <Field label="Próximo mantenimiento *" error={errors.proximo}>
              <input
                type="date"
                value={form.proximo}
                onChange={(event) => {
                  updateForm({ proximo: event.target.value });
                  clearError("proximo");
                }}
                className={`${inputClass} ${errors.proximo ? errorInput : ""}`}
              />
            </Field>

            <Field label="Estado de mantenimiento *" error={errors.estado_mantenimiento_id} className="md:col-span-2">
              <select
                value={form.estado_mantenimiento_id}
                onChange={(event) => {
                  updateForm({ estado_mantenimiento_id: event.target.value ? Number(event.target.value) : "" });
                  clearError("estado_mantenimiento_id");
                }}
                className={`${inputClass} ${errors.estado_mantenimiento_id ? errorInput : ""}`}
              >
                <option value="">Seleccione estado</option>
                {estadosMantenimiento.map((estado) => (
                  <option key={estado.id} value={estado.id}>
                    {estado.nombre_estado_mantenimiento}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Descripción *" error={errors.descripcion} className="md:col-span-2">
              <textarea
                rows={4}
                value={form.descripcion}
                onChange={(event) => {
                  updateForm({ descripcion: cleanMaintenanceText(event.target.value, 250) });
                  clearError("descripcion");
                }}
                className={`${inputClass} h-auto resize-none py-3 ${errors.descripcion ? errorInput : ""}`}
                placeholder="Ej. Servicio menor, cambio de aceite, revisión de frenos..."
              />
            </Field>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-100"
          >
            Cancelar
          </button>

          <button
            data-save-button="true"
            type="button"
            onClick={onSave}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0C2D6B] px-5 text-sm font-bold text-white hover:bg-[#143C8C]"
          >
            <Wrench className="h-4 w-4" />
            Guardar mantenimiento
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDelete({
  vehiculo,
  loading,
  onCancel,
  onConfirm,
}: {
  vehiculo: Vehiculo;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl">
        <div className="h-2 bg-red-500" />

        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <Trash2 className="h-7 w-7" />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-bold text-[#0C2D6B]">Eliminar vehículo</h3>
              <p className="mt-1 text-sm leading-relaxed text-gray-500">
                Esta acción eliminará el vehículo seleccionado si no tiene asignaciones o viajes relacionados.
              </p>

              <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                  Vehículo seleccionado
                </p>
                <p className="mt-1 font-mono text-sm font-bold text-gray-800">{vehiculo.codigo}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-60"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="h-11 rounded-xl border border-gray-200 bg-white px-5 text-sm font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {loading ? "Eliminando..." : "Sí, eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}