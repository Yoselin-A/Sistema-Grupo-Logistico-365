import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUp,
  Building2,
  CheckCircle,
  Clock,
  Download,
  Edit2,
  Eye,
  FileText,
  Filter,
  MapPin,
  Navigation,
  Package,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Truck,
  Warehouse,
  X,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import logoEmpresa from "../../assets/614cb11181e5d72cb3a39a09d833f4775b7fc7ce.png";

const API_BASE_URL = "/api";

type AnyRow = Record<string, any>;

type Cliente = {
  id: number;
  codigo_cliente: string;
  nombre_empresa: string;
  nit?: string;
  direccion?: string;
};

type Ubicacion = {
  id: number;
  codigo_ubicacion: string;
  nombre_ubicacion: string;
  pais: string;
};

type Ruta = {
  id: number;
  codigo_ruta: string;
  nombre_ruta: string;
  origen_id: number;
  destino_id: number;
  distancia_km?: number;
  origen?: string;
  destino?: string;
  ruta_texto?: string;
};

type Unidad = {
  id: number;
  codigo: string;
  tipo: string;
};

type Piloto = {
  id: number;
  codigo_piloto: string;
  primer_nombre: string;
  segundo_nombre?: string | null;
  primer_apellido: string;
  segundo_apellido?: string | null;
  licencia: string;
  nombre_piloto?: string;
};

type EstadoEnvio = {
  id: number;
  codigo_estado: string;
  nombre_estado_envio: string;
};

type TipoDeposito = {
  id: number;
  codigo_tipo_deposito: string;
  nombre_tipo_deposito: string;
};

type Envio = {
  id: number;
  codigo: string;
  cliente_id: number;
  origen_id: number;
  destino_id: number;
  direccion: string;
  fecha: string;
  estado_id: number;
  observaciones?: string | null;
  cliente: string;
  origen: string;
  destino: string;
  estado: string;
};

type Viaje = {
  id: number;
  codigo: string;
  cliente_id: number;
  ruta_id: number;
  unidad_id: number;
  piloto_id: number;
  envio_id: number;
  fecha_salida: string;
  fechaSalida?: string;
  eta?: string;
  progreso: number;
  cliente: string;
  ruta: string;
  unidad: string;
  unidad_tipo?: string;
  piloto: string;
  licencia?: string;
  estado: string;
  envio_codigo?: string;
};

type Deposito = {
  id: number;
  codigo: string;
  nombre_deposito: string;
  nombre?: string;
  ubicacion_id: number;
  direccion?: string | null;
  capacidad: number | string;
  unidad_medida?: string | null;
  tipo_id: number;
  activo: boolean | number;
  ubicacion: string;
  tipo: string;
  estado: string;
};

type FormErrors = Record<string, string>;

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

const cleanLetters = (value: string, max = 80) =>
  titleCase(value.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'-]/g, "").replace(/\s+/g, " ")).slice(0, max);

const cleanCommercial = (value: string, max = 160) =>
  titleCaseCommercial(
    value
      .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s.,#&()'/-]/g, "")
      .replace(/\s+/g, " ")
  ).slice(0, max);

const cleanAddress = (value: string, max = 180) =>
  value
    .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s.,#&()'/-]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, max);

const cleanInteger = (value: string, max = 3) => value.replace(/\D/g, "").slice(0, max);

const cleanDecimal = (value: string, maxInteger = 8, maxDecimals = 2) => {
  const parts = value.replace(/[^0-9.]/g, "").split(".");
  const integer = parts[0].slice(0, maxInteger);
  const decimals = parts.slice(1).join("").slice(0, maxDecimals);
  return parts.length > 1 ? `${integer}.${decimals}` : integer;
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

function titleCase(value: string) {
  return value
    .trimStart()
    .toLocaleLowerCase("es-GT")
    .replace(/(^|[\s'-])([a-záéíóúüñ])/g, (_m, sep, letter) => `${sep}${letter.toLocaleUpperCase("es-GT")}`);
}

function titleCaseCommercial(value: string) {
  return titleCase(value)
    .replace(/\bS\.\s*A\.?\b/gi, "S.A.")
    .replace(/\bS\.\s*De\s*R\.\s*L\.?\b/gi, "S. de R.L.")
    .replace(/\bGL365\b/gi, "GL365")
    .replace(/\bFtl\b/g, "FTL")
    .replace(/\bLtl\b/g, "LTL")
    .replace(/\bFcl\b/g, "FCL")
    .replace(/\bLcl\b/g, "LCL");
}

const money = (value: any) =>
  new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
  }).format(Number(value || 0));

const formatDate = (value: any) => {
  const text = String(value || "");
  if (!text) return "-";
  return text.slice(0, 10);
};

const toDateTimeInput = (value: any) => {
  const text = String(value || "");
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) return text.slice(0, 16);
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(text)) return text.replace(" ", "T").slice(0, 16);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return `${text.slice(0, 10)}T00:00`;
  return "";
};

const fullPilot = (p?: Partial<Piloto> | AnyRow) =>
  p
    ? [p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(" ") ||
      String(p.nombre_piloto || p.piloto || "")
    : "";

const rutaLabel = (ruta?: Partial<Ruta> | AnyRow) => {
  if (!ruta) return "";
  if (ruta.ruta_texto) return String(ruta.ruta_texto);
  if (ruta.origen && ruta.destino) return `${ruta.origen} → ${ruta.destino}`;
  return String(ruta.nombre_ruta || "");
};

const getEstadoColor = (estado: string) => {
  switch (estado) {
    case "Pendiente":
      return "bg-gray-100 text-gray-700 border-gray-200";
    case "En ruta":
    case "En tránsito":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "En destino":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "Entregado":
      return "bg-green-100 text-green-700 border-green-200";
    case "Retraso":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "Crítico":
      return "bg-red-100 text-red-700 border-red-200";
    case "Activo":
      return "bg-green-100 text-green-700 border-green-200";
    case "Inactivo":
      return "bg-gray-100 text-gray-600 border-gray-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
};

const getProgressColor = (estado: string) => {
  if (estado === "Crítico") return "bg-red-500";
  if (estado === "Retraso" || estado === "En destino") return "bg-orange-500";
  if (estado === "Entregado") return "bg-green-500";
  if (estado === "En ruta" || estado === "En tránsito") return "bg-blue-500";
  return "bg-gray-400";
};

const getMapParts = (ruta: string) => {
  const text = String(ruta || "").trim();
  const sep = text.includes("→") ? "→" : text.includes("->") ? "->" : "-";
  const parts = text.split(sep).map((x) => x.trim()).filter(Boolean);

  return {
    origen: parts[0] || "Ciudad de Guatemala",
    destino: parts[parts.length - 1] || "Guatemala",
  };
};

const mapEmbed = (ruta: string) => {
  const { origen, destino } = getMapParts(ruta);
  return `https://maps.google.com/maps?saddr=${encodeURIComponent(origen)}&daddr=${encodeURIComponent(destino)}&output=embed`;
};

const mapExternal = (ruta: string) => {
  const { origen, destino } = getMapParts(ruta);
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origen)}&destination=${encodeURIComponent(destino)}`;
};

const inputClass =
  "w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/10 disabled:bg-gray-100 disabled:text-gray-500";

const labelClass = "block text-xs font-bold text-gray-600 mb-1.5";
const errorClass = "text-[11px] text-red-600 mt-1 font-medium";

function moveOnEnter(event: React.KeyboardEvent<HTMLElement>) {
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
      {error && <p className={errorClass}>{error}</p>}
    </div>
  );
}

function SearchableSelect({
  value,
  options,
  placeholder,
  getLabel,
  getSubLabel,
  onSelect,
  error,
  disabled,
}: {
  value?: number | string | null;
  options: AnyRow[];
  placeholder: string;
  getLabel: (item: AnyRow) => string;
  getSubLabel?: (item: AnyRow) => string;
  onSelect: (item: AnyRow) => void;
  error?: string;
  disabled?: boolean;
}) {
  const selected = options.find((item) => Number(item.id) === Number(value));
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();

    return options
      .filter((item) => {
        const text = `${getLabel(item)} ${getSubLabel?.(item) || ""}`.toLowerCase();
        return !term || text.includes(term);
      })
      .slice(0, 45);
  }, [options, query, getLabel, getSubLabel]);

  return (
    <div className="relative">
      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-[14px] z-10" />
      <input
        disabled={disabled}
        value={open ? query : selected ? getLabel(selected) : ""}
        onFocus={() => {
          if (!disabled) {
            setOpen(true);
            setQuery("");
          }
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (filtered[0]) {
              onSelect(filtered[0]);
              setOpen(false);
              setQuery("");
            }
          }
          if (event.key === "Escape") {
            setOpen(false);
            setQuery("");
          }
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 140)}
        placeholder={placeholder}
        className={`${inputClass} pl-9 ${error ? "border-red-400 ring-2 ring-red-100" : ""}`}
      />

      {open && !disabled && (
        <div className="absolute z-[130] mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl">
          {filtered.map((item) => (
            <button
              type="button"
              key={item.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(item);
                setOpen(false);
                setQuery("");
              }}
              className={`w-full text-left px-3 py-2.5 hover:bg-blue-50 ${
                Number(item.id) === Number(value) ? "bg-blue-50 text-[#0C2D6B]" : "text-gray-700"
              }`}
            >
              <span className="block text-sm font-semibold leading-5">{getLabel(item)}</span>
              {getSubLabel && <span className="block text-[11px] text-gray-400">{getSubLabel(item)}</span>}
            </button>
          ))}

          {!filtered.length && (
            <div className="px-3 py-3 text-sm text-gray-500">No se encontró coincidencia.</div>
          )}
        </div>
      )}
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon: Icon,
  colorClass,
}: {
  title: string;
  value: string | number;
  icon: any;
  colorClass: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 relative overflow-hidden">
      <div className={`absolute bottom-0 left-0 h-1 w-full ${colorClass}`} />
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-[#0C2D6B] mt-1">{value}</p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0C2D6B] flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  title,
  icon: Icon,
  onClick,
  tone = "default",
}: {
  title: string;
  icon: any;
  onClick: () => void;
  tone?: "default" | "blue" | "orange" | "red";
}) {
  const tones = {
    default: "text-gray-600 hover:text-[#0C2D6B] hover:bg-white border-gray-200",
    blue: "text-[#0C2D6B] bg-blue-50 hover:bg-blue-100 border-blue-100",
    orange: "text-[#FF6A00] bg-orange-50 hover:bg-orange-100 border-orange-100",
    red: "text-red-600 bg-red-50 hover:bg-red-100 border-red-100",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`h-9 w-9 rounded-xl border inline-flex items-center justify-center transition-colors shadow-sm ${tones[tone]}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}


async function imageUrlToDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();

    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function addCorporatePdfHeader(doc: jsPDF, title: string, subtitle: string) {
  doc.setFillColor(12, 45, 107);
  doc.rect(0, 0, 210, 36, "F");

  // Tarjeta blanca para que el logo azul/naranja conserve contraste.
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(255, 106, 0);
  doc.setLineWidth(0.6);
  doc.roundedRect(8, 4.5, 50, 27, 2.5, 2.5, "FD");

  const logo = await imageUrlToDataUrl(logoEmpresa);
  if (logo) {
    try {
      doc.addImage(logo, "PNG", 11, 7, 44, 22, undefined, "FAST");
    } catch {
      // El reporte continúa aunque el navegador no pueda convertir el logo.
    }
  }

  doc.setTextColor(255, 106, 0);
  doc.setFont(undefined, "bold");
  doc.setFontSize(9);
  doc.text("GRUPO LOGÍSTICO 365", 132, 9.5, { align: "center" });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.text(title.toUpperCase(), 132, 20, { align: "center" });

  doc.setFont(undefined, "normal");
  doc.setFontSize(8.5);
  doc.text(subtitle, 132, 26.5, { align: "center" });

  doc.setDrawColor(255, 106, 0);
  doc.setLineWidth(0.8);
  doc.line(68, 31.5, 196, 31.5);

  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, "normal");
}

function PaginationControls({
  page,
  totalPages,
  rowsPerPage,
  totalItems,
  itemLabel,
  onPageChange,
  onRowsPerPageChange,
}: {
  page: number;
  totalPages: number;
  rowsPerPage: number;
  totalItems: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rows: number) => void;
}) {
  const start = totalItems === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const end = Math.min(page * rowsPerPage, totalItems);

  return (
    <div className="mt-4 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <p className="text-sm font-semibold text-gray-500">
        Página {page} de {totalPages} · Mostrando {start} a {end} de {totalItems} {itemLabel}.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={rowsPerPage}
          onChange={(event) => {
            onRowsPerPageChange(Number(event.target.value));
            onPageChange(1);
          }}
          className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-[#0C2D6B] shadow-sm outline-none focus:border-[#0C2D6B]"
          aria-label="Registros por página"
        >
          {[4, 8, 12, 20, 40].map((size) => (
            <option key={size} value={size}>{size} por página</option>
          ))}
        </select>

        <button type="button" onClick={() => onPageChange(1)} disabled={page <= 1} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-[#0C2D6B] shadow-sm disabled:cursor-not-allowed disabled:text-gray-300 disabled:shadow-none">
          Primera
        </button>
        <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-[#0C2D6B] shadow-sm disabled:cursor-not-allowed disabled:text-gray-300 disabled:shadow-none">
          Anterior
        </button>
        <button type="button" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-[#0C2D6B] shadow-sm disabled:cursor-not-allowed disabled:text-gray-300 disabled:shadow-none">
          Siguiente
        </button>
        <button type="button" onClick={() => onPageChange(totalPages)} disabled={page >= totalPages} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-[#0C2D6B] shadow-sm disabled:cursor-not-allowed disabled:text-gray-300 disabled:shadow-none">
          Última
        </button>
      </div>
    </div>
  );
}

export function Logistica() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [pilotos, setPilotos] = useState<Piloto[]>([]);
  const [estadosEnvio, setEstadosEnvio] = useState<EstadoEnvio[]>([]);
  const [tiposDeposito, setTiposDeposito] = useState<TipoDeposito[]>([]);

  const [envios, setEnvios] = useState<Envio[]>([]);
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [depositos, setDepositos] = useState<Deposito[]>([]);

  const [activeTab, setActiveTab] = useState<"envios" | "depositos">("envios");
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [notice, setNotice] = useState("");

  const [searchViajes, setSearchViajes] = useState("");
  const [filterEstadoViaje, setFilterEstadoViaje] = useState("Todos");
  const [sortViajeField, setSortViajeField] = useState("");
  const [sortViajeDirection, setSortViajeDirection] = useState<SortDirection>("asc");

  const [searchEnvios, setSearchEnvios] = useState("");
  const [filterEstadoEnvio, setFilterEstadoEnvio] = useState("Todos");
  const [filterClienteEnvio, setFilterClienteEnvio] = useState("Todos");
  const [sortEnvioField, setSortEnvioField] = useState("");
  const [sortEnvioDirection, setSortEnvioDirection] = useState<SortDirection>("asc");

  const [searchDepositos, setSearchDepositos] = useState("");
  const [filterEstadoDeposito, setFilterEstadoDeposito] = useState("Todos");
  const [filterTipoDeposito, setFilterTipoDeposito] = useState("Todos");
  const [sortDepositoField, setSortDepositoField] = useState("");
  const [sortDepositoDirection, setSortDepositoDirection] = useState<SortDirection>("asc");

  // Paginación independiente para cada submódulo de Logística.
  const [viajePage, setViajePage] = useState(1);
  const [viajeRowsPerPage, setViajeRowsPerPage] = useState(8);
  const [envioPage, setEnvioPage] = useState(1);
  const [envioRowsPerPage, setEnvioRowsPerPage] = useState(8);
  const [depositoPage, setDepositoPage] = useState(1);
  const [depositoRowsPerPage, setDepositoRowsPerPage] = useState(8);

  const [viajeModal, setViajeModal] = useState<{ open: boolean; mode: "create" | "edit" | "view" }>({
    open: false,
    mode: "create",
  });
  const [envioModal, setEnvioModal] = useState<{ open: boolean; mode: "create" | "edit" | "view" }>({
    open: false,
    mode: "create",
  });
  const [depositoModal, setDepositoModal] = useState<{ open: boolean; mode: "create" | "edit" | "view" }>({
    open: false,
    mode: "create",
  });

  const [currentViaje, setCurrentViaje] = useState<Viaje | null>(null);
  const [currentEnvio, setCurrentEnvio] = useState<Envio | null>(null);
  const [currentDeposito, setCurrentDeposito] = useState<Deposito | null>(null);

  const [viajeForm, setViajeForm] = useState<AnyRow>({});
  const [envioForm, setEnvioForm] = useState<AnyRow>({});
  const [depositoForm, setDepositoForm] = useState<AnyRow>({});

  const [viajeErrors, setViajeErrors] = useState<FormErrors>({});
  const [envioErrors, setEnvioErrors] = useState<FormErrors>({});
  const [depositoErrors, setDepositoErrors] = useState<FormErrors>({});

  const [confirmDialog, setConfirmDialog] = useState<null | {
    type: "viaje" | "envio" | "deposito";
    id: number;
    code: string;
    title: string;
    message: string;
    actionLabel: string;
    tone: "danger" | "warning";
  }>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setApiError("");

    try {
      const data = await apiRequest("/logistica/bootstrap");

      setClientes(asArray<Cliente>(data.clientes));
      setUbicaciones(asArray<Ubicacion>(data.ubicaciones));
      setRutas(asArray<Ruta>(data.rutas));
      setUnidades(asArray<Unidad>(data.unidades));
      setPilotos(asArray<Piloto>(data.pilotos));
      setEstadosEnvio(asArray<EstadoEnvio>(data.estadosEnvio));
      setTiposDeposito(asArray<TipoDeposito>(data.tiposDeposito));
      setEnvios(asArray<Envio>(data.envios));
      setViajes(asArray<Viaje>(data.viajes));
      setDepositos(asArray<Deposito>(data.depositos));
    } catch (error: any) {
      console.error("Error cargando logística:", error);
      setApiError(error.message || "No se pudo conectar Logística con MySQL.");
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

  const sortIcon = (field: string, activeField: string, direction: SortDirection) => {
    if (activeField !== field) return "↕";
    return direction === "asc" ? "↑" : "↓";
  };

  const toggleSort = (
    field: string,
    activeField: string,
    direction: SortDirection,
    setField: (value: string) => void,
    setDirection: (value: SortDirection | ((prev: SortDirection) => SortDirection)) => void
  ) => {
    if (activeField === field) {
      setDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setField(field);
    setDirection("asc");
  };

  const SortableTh = ({
    field,
    activeField,
    direction,
    setField,
    setDirection,
    children,
    className = "",
  }: {
    field: string;
    activeField: string;
    direction: SortDirection;
    setField: (value: string) => void;
    setDirection: (value: SortDirection | ((prev: SortDirection) => SortDirection)) => void;
    children: ReactNode;
    className?: string;
  }) => (
    <th className={className}>
      <button
        type="button"
        onClick={() => toggleSort(field, activeField, direction, setField, setDirection)}
        className={`inline-flex items-center gap-0.5 text-[13px] font-bold transition-colors hover:text-[#FF6A00] ${
          activeField === field ? "text-[#FF6A00]" : "text-[#0C2D6B]"
        }`}
        title="Ordenar ascendente o descendente"
      >
        <span>{children}</span>
        <span className={`text-[9px] leading-none ${activeField === field ? "text-[#FF6A00]" : "text-gray-300"}`}>
          {sortIcon(field, activeField, direction)}
        </span>
      </button>
    </th>
  );

  const SortChip = ({
    field,
    label,
    activeField,
    direction,
    setField,
    setDirection,
  }: {
    field: string;
    label: string;
    activeField: string;
    direction: SortDirection;
    setField: (value: string) => void;
    setDirection: (value: SortDirection | ((prev: SortDirection) => SortDirection)) => void;
  }) => (
    <button
      type="button"
      onClick={() => toggleSort(field, activeField, direction, setField, setDirection)}
      className={`h-8 rounded-full border px-3 text-[11px] font-bold transition-colors ${
        activeField === field
          ? "border-orange-200 bg-white text-[#FF6A00] shadow-sm"
          : "border-gray-200 bg-white text-[#0C2D6B] hover:bg-blue-50"
      }`}
    >
      {label} <span className="ml-1 text-[9px] leading-none">{sortIcon(field, activeField, direction)}</span>
    </button>
  );

  const resetViajeFilters = () => {
    setSearchViajes("");
    setFilterEstadoViaje("Todos");
    setSortViajeField("");
    setSortViajeDirection("asc");
  };

  const resetEnvioFilters = () => {
    setSearchEnvios("");
    setFilterEstadoEnvio("Todos");
    setFilterClienteEnvio("Todos");
    setSortEnvioField("");
    setSortEnvioDirection("asc");
  };

  const resetDepositoFilters = () => {
    setSearchDepositos("");
    setFilterEstadoDeposito("Todos");
    setFilterTipoDeposito("Todos");
    setSortDepositoField("");
    setSortDepositoDirection("asc");
  };

  const estadoIdByName = (name: string) => {
    const term = name.toLowerCase();
    const found = estadosEnvio.find((e) => e.nombre_estado_envio.toLowerCase().includes(term));
    return found?.id || estadosEnvio[0]?.id || 1;
  };

  const estadoNameById = (id: number) =>
    estadosEnvio.find((e) => Number(e.id) === Number(id))?.nombre_estado_envio || "Pendiente";

  const clientesFiltro = useMemo(() => {
    return ["Todos", ...Array.from(new Set(envios.map((item) => item.cliente).filter(Boolean)))];
  }, [envios]);

  const estadosFiltro = useMemo(() => {
    return ["Todos", ...Array.from(new Set(envios.map((item) => item.estado).filter(Boolean)))];
  }, [envios]);

  const estadosViajeFiltro = useMemo(() => {
    return ["Todos", ...Array.from(new Set(viajes.map((item) => item.estado).filter(Boolean)))];
  }, [viajes]);

  const filteredViajes = useMemo(() => {
    const term = searchViajes.trim().toLowerCase();

    return viajes.filter((viaje) => {
      const text = `${viaje.codigo} ${viaje.cliente} ${viaje.ruta} ${viaje.unidad} ${viaje.piloto} ${viaje.estado}`.toLowerCase();
      const matchesSearch = !term || text.includes(term);
      const matchesEstado = filterEstadoViaje === "Todos" || viaje.estado === filterEstadoViaje;
      return matchesSearch && matchesEstado;
    });
  }, [viajes, searchViajes, filterEstadoViaje]);

  const sortedViajes = useMemo(() => {
    const rows = [...filteredViajes];

    rows.sort((a, b) => {
      const av =
        sortViajeField === "codigo" ? a.codigo :
        sortViajeField === "cliente" ? a.cliente :
        sortViajeField === "ruta" ? a.ruta :
        sortViajeField === "unidad" ? a.unidad :
        sortViajeField === "piloto" ? a.piloto :
        sortViajeField === "estado" ? a.estado :
        sortViajeField === "progreso" ? Number(a.progreso || 0) :
        sortViajeField === "eta" ? a.eta :
        "";

      const bv =
        sortViajeField === "codigo" ? b.codigo :
        sortViajeField === "cliente" ? b.cliente :
        sortViajeField === "ruta" ? b.ruta :
        sortViajeField === "unidad" ? b.unidad :
        sortViajeField === "piloto" ? b.piloto :
        sortViajeField === "estado" ? b.estado :
        sortViajeField === "progreso" ? Number(b.progreso || 0) :
        sortViajeField === "eta" ? b.eta :
        "";

      return sortViajeField ? compareValues(av, bv, sortViajeDirection) : 0;
    });

    return rows;
  }, [filteredViajes, sortViajeField, sortViajeDirection]);

  const filteredEnvios = useMemo(() => {
    const term = searchEnvios.trim().toLowerCase();

    return envios.filter((envio) => {
      const text = `${envio.codigo} ${envio.cliente} ${envio.origen} ${envio.destino} ${envio.direccion}`.toLowerCase();
      const matchesSearch = !term || text.includes(term);
      const matchesEstado = filterEstadoEnvio === "Todos" || envio.estado === filterEstadoEnvio;
      const matchesCliente = filterClienteEnvio === "Todos" || envio.cliente === filterClienteEnvio;
      return matchesSearch && matchesEstado && matchesCliente;
    });
  }, [envios, searchEnvios, filterEstadoEnvio, filterClienteEnvio]);

  const sortedEnvios = useMemo(() => {
    const rows = [...filteredEnvios];

    rows.sort((a, b) => {
      const av =
        sortEnvioField === "codigo" ? a.codigo :
        sortEnvioField === "cliente" ? a.cliente :
        sortEnvioField === "origen" ? a.origen :
        sortEnvioField === "destino" ? a.destino :
        sortEnvioField === "fecha" ? a.fecha :
        sortEnvioField === "estado" ? a.estado :
        "";

      const bv =
        sortEnvioField === "codigo" ? b.codigo :
        sortEnvioField === "cliente" ? b.cliente :
        sortEnvioField === "origen" ? b.origen :
        sortEnvioField === "destino" ? b.destino :
        sortEnvioField === "fecha" ? b.fecha :
        sortEnvioField === "estado" ? b.estado :
        "";

      return sortEnvioField ? compareValues(av, bv, sortEnvioDirection) : 0;
    });

    return rows;
  }, [filteredEnvios, sortEnvioField, sortEnvioDirection]);

  const tiposDepositoFiltro = useMemo(() => {
    return ["Todos", ...Array.from(new Set(depositos.map((item) => item.tipo).filter(Boolean)))];
  }, [depositos]);

  const estadosDepositoFiltro = useMemo(() => {
    return ["Todos", ...Array.from(new Set(depositos.map((item) => item.estado).filter(Boolean)))];
  }, [depositos]);

  const filteredDepositos = useMemo(() => {
    const term = searchDepositos.trim().toLowerCase();

    return depositos.filter((deposito) => {
      const text = `${deposito.codigo} ${deposito.nombre_deposito || deposito.nombre} ${deposito.ubicacion} ${deposito.tipo} ${deposito.estado}`.toLowerCase();
      const matchesSearch = !term || text.includes(term);
      const matchesEstado = filterEstadoDeposito === "Todos" || deposito.estado === filterEstadoDeposito;
      const matchesTipo = filterTipoDeposito === "Todos" || deposito.tipo === filterTipoDeposito;
      return matchesSearch && matchesEstado && matchesTipo;
    });
  }, [depositos, searchDepositos, filterEstadoDeposito, filterTipoDeposito]);

  const sortedDepositos = useMemo(() => {
    const rows = [...filteredDepositos];

    rows.sort((a, b) => {
      const av =
        sortDepositoField === "codigo" ? a.codigo :
        sortDepositoField === "nombre" ? (a.nombre_deposito || a.nombre || "") :
        sortDepositoField === "ubicacion" ? a.ubicacion :
        sortDepositoField === "capacidad" ? Number(a.capacidad || 0) :
        sortDepositoField === "tipo" ? a.tipo :
        sortDepositoField === "estado" ? a.estado :
        "";

      const bv =
        sortDepositoField === "codigo" ? b.codigo :
        sortDepositoField === "nombre" ? (b.nombre_deposito || b.nombre || "") :
        sortDepositoField === "ubicacion" ? b.ubicacion :
        sortDepositoField === "capacidad" ? Number(b.capacidad || 0) :
        sortDepositoField === "tipo" ? b.tipo :
        sortDepositoField === "estado" ? b.estado :
        "";

      return sortDepositoField ? compareValues(av, bv, sortDepositoDirection) : 0;
    });

    return rows;
  }, [filteredDepositos, sortDepositoField, sortDepositoDirection]);

  const viajeTotalPages = Math.max(1, Math.ceil(sortedViajes.length / viajeRowsPerPage));
  const envioTotalPages = Math.max(1, Math.ceil(sortedEnvios.length / envioRowsPerPage));
  const depositoTotalPages = Math.max(1, Math.ceil(sortedDepositos.length / depositoRowsPerPage));

  const paginatedViajes = useMemo(() => {
    const start = (viajePage - 1) * viajeRowsPerPage;
    return sortedViajes.slice(start, start + viajeRowsPerPage);
  }, [sortedViajes, viajePage, viajeRowsPerPage]);

  const paginatedEnvios = useMemo(() => {
    const start = (envioPage - 1) * envioRowsPerPage;
    return sortedEnvios.slice(start, start + envioRowsPerPage);
  }, [sortedEnvios, envioPage, envioRowsPerPage]);

  const paginatedDepositos = useMemo(() => {
    const start = (depositoPage - 1) * depositoRowsPerPage;
    return sortedDepositos.slice(start, start + depositoRowsPerPage);
  }, [sortedDepositos, depositoPage, depositoRowsPerPage]);

  // Al buscar, filtrar, ordenar o cambiar el tamaño de página regresamos a la primera página.
  useEffect(() => {
    setViajePage(1);
  }, [searchViajes, filterEstadoViaje, sortViajeField, sortViajeDirection, viajeRowsPerPage]);

  useEffect(() => {
    setEnvioPage(1);
  }, [searchEnvios, filterEstadoEnvio, filterClienteEnvio, sortEnvioField, sortEnvioDirection, envioRowsPerPage]);

  useEffect(() => {
    setDepositoPage(1);
  }, [searchDepositos, filterEstadoDeposito, filterTipoDeposito, sortDepositoField, sortDepositoDirection, depositoRowsPerPage]);

  useEffect(() => {
    setViajePage((page) => Math.min(page, viajeTotalPages));
  }, [viajeTotalPages]);

  useEffect(() => {
    setEnvioPage((page) => Math.min(page, envioTotalPages));
  }, [envioTotalPages]);

  useEffect(() => {
    setDepositoPage((page) => Math.min(page, depositoTotalPages));
  }, [depositoTotalPages]);

  const alerts = useMemo(() => {
    return viajes
      .filter((v) => v.estado === "Retraso" || v.estado === "Crítico")
      .map((v) => ({
        id: v.id,
        title: v.estado === "Crítico" ? "Situación crítica" : "Retraso detectado",
        desc: `Viaje ${v.codigo} (${v.unidad}) - ${v.ruta}. ETA: ${v.eta || "-"}`,
        type: v.estado === "Crítico" ? "error" : "warning",
      }));
  }, [viajes]);

  const kpis = [
    {
      title: "Total envíos",
      value: envios.length,
      icon: Package,
      colorClass: "bg-[#0C2D6B]",
    },
    {
      title: "En tránsito",
      value: viajes.filter((v) => v.estado === "En tránsito" || v.estado === "En ruta").length,
      icon: Truck,
      colorClass: "bg-blue-500",
    },
    {
      title: "Entregados",
      value: envios.filter((e) => e.estado === "Entregado").length,
      icon: CheckCircle,
      colorClass: "bg-green-500",
    },
    {
      title: "Alertas",
      value: alerts.length,
      icon: AlertTriangle,
      colorClass: "bg-orange-500",
    },
    {
      title: "Depósitos activos",
      value: depositos.filter((d) => d.estado === "Activo" || Number(d.activo) === 1).length,
      icon: Warehouse,
      colorClass: "bg-purple-500",
    },
  ];

  const openCreateViaje = () => {
    setViajeErrors({});
    setCurrentViaje(null);
    setViajeForm({
      cliente_id: "",
      envio_id: "",
      ruta_id: "",
      unidad_id: "",
      piloto_id: "",
      fecha_salida: "",
      eta: "",
      estado: "Pendiente",
      progreso: 0,
    });
    setViajeModal({ open: true, mode: "create" });
  };

  const openEditViaje = (viaje: Viaje) => {
    setViajeErrors({});
    setCurrentViaje(viaje);
    setViajeForm({
      ...viaje,
      fecha_salida: toDateTimeInput(viaje.fecha_salida || viaje.fechaSalida),
      estado: viaje.estado || "Pendiente",
      progreso: viaje.progreso ?? 0,
    });
    setViajeModal({ open: true, mode: "edit" });
  };

  const openViewViaje = (viaje: Viaje) => {
    setCurrentViaje(viaje);
    setViajeModal({ open: true, mode: "view" });
  };

  const validateViaje = () => {
    const errors: FormErrors = {};

    if (!viajeForm.cliente_id) errors.cliente_id = "Seleccioná un cliente.";
    if (!viajeForm.envio_id) {
      const enviosDelCliente = envios.filter((envio) =>
        !viajeForm.cliente_id || Number(envio.cliente_id) === Number(viajeForm.cliente_id)
      );

      errors.envio_id =
        viajeForm.cliente_id && enviosDelCliente.length === 0
          ? "Este cliente no tiene envíos. Registrá un envío primero y luego regresá al viaje."
          : "Seleccioná un envío relacionado.";
    }
    if (!viajeForm.ruta_id) errors.ruta_id = "Seleccioná una ruta.";
    if (!viajeForm.unidad_id) errors.unidad_id = "Seleccioná una unidad.";
    if (!viajeForm.piloto_id) errors.piloto_id = "Seleccioná un piloto.";
    if (!viajeForm.fecha_salida) errors.fecha_salida = "Seleccioná fecha y hora.";
    if (!viajeForm.eta) errors.eta = "Ingresá ETA.";
    if (Number(viajeForm.progreso) < 0 || Number(viajeForm.progreso) > 100) {
      errors.progreso = "Debe estar entre 0 y 100.";
    }

    setViajeErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveViaje = async () => {
    if (!validateViaje()) return;

    try {
      await apiRequest(
        viajeModal.mode === "edit" && currentViaje
          ? `/logistica/viajes/${currentViaje.id}`
          : "/logistica/viajes",
        {
          method: viajeModal.mode === "edit" ? "PUT" : "POST",
          body: JSON.stringify({
            cliente_id: viajeForm.cliente_id,
            envio_id: viajeForm.envio_id,
            ruta_id: viajeForm.ruta_id,
            unidad_id: viajeForm.unidad_id,
            piloto_id: viajeForm.piloto_id,
            fecha_salida: viajeForm.fecha_salida,
            eta: viajeForm.eta,
            estado: viajeForm.estado,
            progreso: viajeForm.progreso,
          }),
        }
      );

      setViajeModal({ open: false, mode: "create" });
      await load();
      showNotice("Viaje guardado correctamente en MySQL.");
    } catch (error: any) {
      setViajeErrors({ general: error.message || "No se pudo guardar el viaje." });
    }
  };

  const deleteViaje = async (viaje: Viaje) => {
    setConfirmDialog({
      type: "viaje",
      id: viaje.id,
      code: viaje.codigo,
      title: "Eliminar viaje",
      message: `Esta acción eliminará el viaje ${viaje.codigo} y sus registros relacionados de seguimiento, alertas y asignaciones de vehículo.`,
      actionLabel: "Sí, eliminar",
      tone: "danger",
    });
  };

  const changeStatus = async (viaje: Viaje) => {
    const estados = ["Pendiente", "En tránsito", "Retraso", "Crítico", "En destino", "Entregado"];
    const actual = estados.indexOf(viaje.estado);
    const next = estados[(actual + 1 + estados.length) % estados.length];

    const progreso =
      next === "Pendiente"
        ? 0
        : next === "En tránsito" || next === "Retraso" || next === "Crítico"
        ? Math.max(Number(viaje.progreso || 0), 35)
        : next === "En destino"
        ? Math.max(Number(viaje.progreso || 0), 90)
        : 100;

    try {
      await apiRequest(`/logistica/viajes/${viaje.id}/estado`, {
        method: "PUT",
        body: JSON.stringify({ estado: next, progreso }),
      });

      await load();
      showNotice(`Estado actualizado a ${next}.`);
    } catch (error: any) {
      setApiError(error.message || "No se pudo cambiar el estado.");
    }
  };

  const openCreateEnvioFromViaje = () => {
    const clienteId = viajeForm.cliente_id || "";

    setViajeModal({ open: false, mode: "create" });
    setViajeErrors({});
    setCurrentViaje(null);

    setEnvioErrors({});
    setCurrentEnvio(null);
    setEnvioForm({
      cliente_id: clienteId,
      origen_id: "",
      destino_id: "",
      direccion: "",
      fecha: "",
      estado_id: estadoIdByName("recolección"),
      observaciones: "Envío creado desde el formulario de viaje.",
    });

    setEnvioModal({ open: true, mode: "create" });
  };

  const openCreateEnvio = () => {
    setEnvioErrors({});
    setCurrentEnvio(null);
    setEnvioForm({
      cliente_id: "",
      origen_id: "",
      destino_id: "",
      direccion: "",
      fecha: "",
      estado_id: estadoIdByName("recolección"),
      observaciones: "",
    });
    setEnvioModal({ open: true, mode: "create" });
  };

  const openEditEnvio = (envio: Envio) => {
    setEnvioErrors({});
    setCurrentEnvio(envio);
    setEnvioForm({
      ...envio,
      fecha: formatDate(envio.fecha),
    });
    setEnvioModal({ open: true, mode: "edit" });
  };

  const openViewEnvio = (envio: Envio) => {
    setCurrentEnvio(envio);
    setEnvioModal({ open: true, mode: "view" });
  };

  const validateEnvio = () => {
    const errors: FormErrors = {};
    if (!envioForm.cliente_id) errors.cliente_id = "Seleccioná un cliente.";
    if (!envioForm.origen_id) errors.origen_id = "Seleccioná origen.";
    if (!envioForm.destino_id) errors.destino_id = "Seleccioná destino.";
    if (envioForm.origen_id && envioForm.destino_id && Number(envioForm.origen_id) === Number(envioForm.destino_id)) {
      errors.destino_id = "El destino debe ser diferente del origen.";
    }
    if (!String(envioForm.direccion || "").trim()) errors.direccion = "Ingresá dirección.";
    if (!envioForm.fecha) errors.fecha = "Seleccioná fecha.";
    setEnvioErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveEnvio = async () => {
    if (!validateEnvio()) return;

    try {
      await apiRequest(
        envioModal.mode === "edit" && currentEnvio
          ? `/logistica/envios/${currentEnvio.id}`
          : "/logistica/envios",
        {
          method: envioModal.mode === "edit" ? "PUT" : "POST",
          body: JSON.stringify({
            cliente_id: envioForm.cliente_id,
            origen_id: envioForm.origen_id,
            destino_id: envioForm.destino_id,
            direccion: cleanAddress(String(envioForm.direccion || ""), 180),
            fecha: envioForm.fecha,
            estado_id: envioForm.estado_id,
            observaciones: cleanAddress(String(envioForm.observaciones || ""), 250),
          }),
        }
      );

      setEnvioModal({ open: false, mode: "create" });
      await load();
      showNotice("Envío guardado correctamente en MySQL.");
    } catch (error: any) {
      setEnvioErrors({ general: error.message || "No se pudo guardar el envío." });
    }
  };

  const deleteEnvio = async (envio: Envio) => {
    setConfirmDialog({
      type: "envio",
      id: envio.id,
      code: envio.codigo,
      title: "Eliminar envío",
      message: `Esta acción eliminará el envío ${envio.codigo}. Si el envío ya está relacionado con un viaje, el sistema no permitirá borrarlo para proteger el historial operativo.`,
      actionLabel: "Sí, eliminar",
      tone: "danger",
    });
  };

  const openCreateDeposito = () => {
    setDepositoErrors({});
    setCurrentDeposito(null);
    setDepositoForm({
      nombre_deposito: "",
      ubicacion_id: "",
      direccion: "",
      capacidad: "",
      unidad_medida: "m³",
      tipo_id: tiposDeposito[0]?.id || "",
      activo: true,
    });
    setDepositoModal({ open: true, mode: "create" });
  };

  const openEditDeposito = (deposito: Deposito) => {
    setDepositoErrors({});
    setCurrentDeposito(deposito);
    setDepositoForm({
      ...deposito,
      nombre_deposito: deposito.nombre_deposito || deposito.nombre,
      capacidad: String(deposito.capacidad || ""),
      activo: deposito.estado === "Activo" || Number(deposito.activo) === 1,
    });
    setDepositoModal({ open: true, mode: "edit" });
  };

  const openViewDeposito = (deposito: Deposito) => {
    setCurrentDeposito(deposito);
    setDepositoModal({ open: true, mode: "view" });
  };

  const validateDeposito = () => {
    const errors: FormErrors = {};
    if (!String(depositoForm.nombre_deposito || depositoForm.nombre || "").trim()) {
      errors.nombre_deposito = "Ingresá el nombre.";
    }
    if (!depositoForm.ubicacion_id) errors.ubicacion_id = "Seleccioná ubicación.";
    if (!depositoForm.tipo_id) errors.tipo_id = "Seleccioná tipo.";
    if (!Number(depositoForm.capacidad)) errors.capacidad = "Ingresá capacidad numérica.";
    setDepositoErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveDeposito = async () => {
    if (!validateDeposito()) return;

    try {
      await apiRequest(
        depositoModal.mode === "edit" && currentDeposito
          ? `/logistica/depositos/${currentDeposito.id}`
          : "/logistica/depositos",
        {
          method: depositoModal.mode === "edit" ? "PUT" : "POST",
          body: JSON.stringify({
            nombre_deposito: cleanCommercial(String(depositoForm.nombre_deposito || depositoForm.nombre || ""), 120),
            ubicacion_id: depositoForm.ubicacion_id,
            direccion: cleanAddress(String(depositoForm.direccion || ""), 180),
            capacidad: depositoForm.capacidad,
            unidad_medida: depositoForm.unidad_medida || "m³",
            tipo_id: depositoForm.tipo_id,
            activo: depositoForm.activo !== false,
          }),
        }
      );

      setDepositoModal({ open: false, mode: "create" });
      await load();
      showNotice("Depósito guardado correctamente en MySQL.");
    } catch (error: any) {
      setDepositoErrors({ general: error.message || "No se pudo guardar el depósito." });
    }
  };

  const deleteDeposito = async (deposito: Deposito) => {
    setConfirmDialog({
      type: "deposito",
      id: deposito.id,
      code: deposito.codigo,
      title: "Inactivar depósito",
      message: `El depósito ${deposito.codigo} quedará marcado como inactivo. No se borrará definitivamente para conservar el historial.`,
      actionLabel: "Sí, inactivar",
      tone: "warning",
    });
  };

  const executeConfirmDelete = async () => {
    if (!confirmDialog) return;

    setConfirmLoading(true);
    setApiError("");

    try {
      if (confirmDialog.type === "viaje") {
        await apiRequest(`/logistica/viajes/${confirmDialog.id}`, { method: "DELETE" });
        showNotice("Viaje eliminado correctamente.");
      }

      if (confirmDialog.type === "envio") {
        await apiRequest(`/logistica/envios/${confirmDialog.id}`, { method: "DELETE" });
        showNotice("Envío eliminado correctamente.");
      }

      if (confirmDialog.type === "deposito") {
        await apiRequest(`/logistica/depositos/${confirmDialog.id}`, { method: "DELETE" });
        showNotice("Depósito inactivado correctamente.");
      }

      setConfirmDialog(null);
      await load();
    } catch (error: any) {
      setApiError(error.message || "No se pudo completar la acción.");
    } finally {
      setConfirmLoading(false);
    }
  };

  const exportEnviosPDF = async () => {
    const doc = new jsPDF();
    await addCorporatePdfHeader(doc, "Reporte de Envíos", "Logística · Registro y seguimiento de envíos");

    autoTable(doc, {
      startY: 44,
      head: [["Código", "Cliente", "Origen → Destino", "Fecha", "Estado"]],
      body: sortedEnvios.map((e) => [e.codigo, e.cliente, `${e.origen} → ${e.destino}`, formatDate(e.fecha), e.estado]),
      headStyles: { fillColor: [12, 45, 107], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 8, cellPadding: 2.5 },
      margin: { left: 12, right: 12 },
    });

    doc.save(`Reporte_Envios_${Date.now()}.pdf`);
  };

  const exportViajesPDF = async () => {
    const doc = new jsPDF();
    await addCorporatePdfHeader(doc, "Reporte de Viajes", "Logística · Monitoreo y seguimiento operativo");

    autoTable(doc, {
      startY: 44,
      head: [["Código", "Cliente", "Ruta", "Unidad", "Piloto", "Estado", "Progreso"]],
      body: sortedViajes.map((v) => [v.codigo, v.cliente, v.ruta, v.unidad, v.piloto, v.estado, `${v.progreso}%`]),
      headStyles: { fillColor: [12, 45, 107], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 7.5, cellPadding: 2.2 },
      margin: { left: 10, right: 10 },
    });

    doc.save(`Reporte_Viajes_${Date.now()}.pdf`);
  };

  const exportDepositosPDF = async () => {
    const doc = new jsPDF();
    await addCorporatePdfHeader(doc, "Reporte de Depósitos", "Logística · Gestión de depósitos y capacidad");

    autoTable(doc, {
      startY: 44,
      head: [["Código", "Nombre", "Ubicación", "Capacidad", "Tipo", "Estado"]],
      body: sortedDepositos.map((d) => [
        d.codigo,
        d.nombre_deposito || d.nombre,
        d.ubicacion,
        `${d.capacidad} ${d.unidad_medida || ""}`,
        d.tipo,
        d.estado,
      ]),
      headStyles: { fillColor: [12, 45, 107], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 8, cellPadding: 2.5 },
      margin: { left: 12, right: 12 },
    });

    doc.save(`Reporte_Depositos_${Date.now()}.pdf`);
  };

  const exportExcel = (rows: AnyRow[], sheetName: string, fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${fileName}_${Date.now()}.xlsx`);
  };

  // Navegación interna del módulo de Logística.
  // No cambia de ruta ni recarga la aplicación: únicamente desplaza la vista
  // hacia la sección seleccionada y conserva los filtros/datos actuales.
  const scrollToLogisticaSection = (id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const goToViajes = () => scrollToLogisticaSection("logistica-viajes");

  const goToEnvios = () => {
    setActiveTab("envios");
    window.setTimeout(() => scrollToLogisticaSection("logistica-registros"), 60);
  };

  const goToDepositos = () => {
    setActiveTab("depositos");
    window.setTimeout(() => scrollToLogisticaSection("logistica-registros"), 60);
  };

  const goToTop = () => scrollToLogisticaSection("logistica-top");

  return (
    <div id="logistica-top" className="space-y-5 pb-12 w-full max-w-full overflow-hidden px-3 sm:px-4 scroll-mt-24">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0C2D6B]">Logística</h1>
          <p className="text-gray-500 mt-1">Gestión de envíos, rutas, depósitos y monitoreo operativo</p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="h-11 px-4 rounded-xl bg-white border border-gray-200 text-[#0C2D6B] font-bold text-sm inline-flex items-center gap-2 shadow-sm disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Cargando..." : "Actualizar"}
          </button>
          <button
            type="button"
            onClick={openCreateViaje}
            className="h-12 px-7 rounded-xl bg-[#0C2D6B] text-white font-bold text-base inline-flex items-center gap-2.5 shadow-md hover:bg-[#143C8C] transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nuevo Viaje
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

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.title} {...kpi} />
        ))}
      </div>

      {/* Accesos rápidos dentro del mismo módulo */}
      <div className="sticky top-16 z-30 rounded-2xl border border-gray-200 bg-white/95 backdrop-blur px-3 py-2.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">Ir a:</span>
          <button
            type="button"
            onClick={goToViajes}
            className="h-9 px-3 rounded-xl border border-blue-100 bg-blue-50 text-[#0C2D6B] text-xs font-bold inline-flex items-center gap-1.5 hover:bg-blue-100 transition-colors"
          >
            <Truck className="w-4 h-4" /> Viajes
          </button>
          <button
            type="button"
            onClick={goToEnvios}
            className={`h-9 px-3 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
              activeTab === "envios"
                ? "border-orange-200 bg-orange-50 text-[#C85100]"
                : "border-gray-200 bg-white text-[#0C2D6B] hover:bg-blue-50"
            }`}
          >
            <Package className="w-4 h-4" /> Envíos
          </button>
          <button
            type="button"
            onClick={goToDepositos}
            className={`h-9 px-3 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
              activeTab === "depositos"
                ? "border-orange-200 bg-orange-50 text-[#C85100]"
                : "border-gray-200 bg-white text-[#0C2D6B] hover:bg-blue-50"
            }`}
          >
            <Warehouse className="w-4 h-4" /> Depósitos / Bodega
          </button>
          <button
            type="button"
            onClick={goToTop}
            className="h-9 px-3 rounded-xl border border-gray-200 bg-white text-gray-600 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-gray-50 transition-colors ml-0 sm:ml-auto"
          >
            <ArrowUp className="w-4 h-4" /> Arriba
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <section className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#0C2D6B] flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#FF6A00]" />
              Rastreo en Tiempo Real
            </h2>
            <div className="flex gap-3 text-xs font-semibold text-gray-500">
              <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full bg-green-500" /> En tiempo</span>
              <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Retraso</span>
              <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full bg-red-500" /> Crítico</span>
            </div>
          </div>

          <div className="relative h-[420px] bg-[#eef2f7] overflow-hidden">
            <svg className="absolute inset-0 w-full h-full opacity-40">
              <path d="M 50 90 Q 220 35 390 160 T 720 120" stroke="#94a3b8" strokeWidth="2" fill="none" strokeDasharray="6,6" />
              <path d="M 90 300 Q 310 390 610 260" stroke="#94a3b8" strokeWidth="2" fill="none" strokeDasharray="6,6" />
              <path d="M 140 210 Q 360 110 720 310" stroke="#0C2D6B" strokeWidth="2" fill="none" opacity=".35" />
            </svg>

            {viajes
              .filter((v) => v.estado !== "Entregado" && v.estado !== "Pendiente")
              .slice(0, 8)
              .map((viaje, index) => {
                const pos = {
                  top: 90 + (index % 4) * 70,
                  left: 90 + (index % 6) * 130,
                };

                const marker =
                  viaje.estado === "Crítico"
                    ? "bg-red-500"
                    : viaje.estado === "Retraso"
                    ? "bg-orange-500"
                    : "bg-green-500";

                return (
                  <button
                    type="button"
                    key={viaje.id}
                    onClick={() => openViewViaje(viaje)}
                    className="absolute group"
                    style={{ top: pos.top, left: pos.left }}
                  >
                    <span className={`block w-5 h-5 rounded-full border-2 border-white shadow-lg ${marker} ${viaje.estado === "En tránsito" ? "animate-pulse" : ""}`} />
                    <span className="absolute top-8 left-1/2 -translate-x-1/2 w-52 rounded-xl bg-white p-3 shadow-xl text-left opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <b className="block text-xs text-[#0C2D6B]">{viaje.codigo} · {viaje.unidad}</b>
                      <span className="block text-[11px] text-gray-500 mt-1 truncate">{viaje.piloto}</span>
                      <span className="block text-[11px] text-gray-500 truncate">{viaje.cliente}</span>
                      <span className="block h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                        <span className={`block h-full ${marker}`} style={{ width: `${viaje.progreso || 0}%` }} />
                      </span>
                      <span className="block text-[10px] text-right mt-1 font-bold text-gray-600">
                        {viaje.estado} · {viaje.progreso || 0}%
                      </span>
                    </span>
                  </button>
                );
              })}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h2 className="text-xl sm:text-2xl font-bold text-[#0C2D6B] flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Centro de Alertas ({alerts.length})
          </h2>

          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {!alerts.length && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-500 text-center">
                No hay alertas en este momento.
              </div>
            )}

            {alerts.map((alert) => {
              const viaje = viajes.find((v) => v.id === alert.id);

              return (
                <button
                  type="button"
                  key={alert.id}
                  onClick={() => viaje && openViewViaje(viaje)}
                  className={`w-full text-left rounded-xl border bg-white p-3 shadow-sm border-l-4 ${
                    alert.type === "error" ? "border-l-red-500" : "border-l-orange-500"
                  } hover:shadow-md transition-shadow`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <b className="text-sm text-gray-800">{alert.title}</b>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      alert.type === "error" ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-600"
                    }`}>
                      {alert.type === "error" ? "CRÍTICO" : "ALERTA"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{alert.desc}</p>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <section id="logistica-viajes" className="scroll-mt-28">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
          <div className="flex flex-col 2xl:flex-row 2xl:items-center 2xl:justify-between gap-3 mb-3">
            <h2 className="text-2xl font-bold text-[#0C2D6B] flex items-center gap-2">
              <Truck className="w-5 h-5 text-[#FF6A00]" />
              Viajes Activos
            </h2>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openCreateViaje}
                className="h-12 px-6 rounded-xl bg-[#0C2D6B] text-white text-base font-bold inline-flex items-center gap-2 shadow-md hover:bg-[#143C8C] transition-colors"
              >
                <Plus className="w-5 h-5" /> Nuevo Viaje
              </button>
              <button onClick={exportViajesPDF} className="h-11 px-4 rounded-xl bg-red-500 text-white text-sm font-bold inline-flex items-center gap-2">
                <Download className="w-4 h-4" /> PDF
              </button>
              <button
                onClick={() =>
                  exportExcel(
                    sortedViajes.map((v) => ({
                      Código: v.codigo,
                      Cliente: v.cliente,
                      Ruta: v.ruta,
                      Unidad: v.unidad,
                      Piloto: v.piloto,
                      Estado: v.estado,
                      Progreso: `${v.progreso}%`,
                      ETA: v.eta,
                    })),
                    "Viajes",
                    "Reporte_Viajes"
                  )
                }
                className="h-11 px-4 rounded-xl bg-[#22C55E] text-white text-sm font-bold inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> Excel
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(260px,1fr)_210px_auto] gap-3 items-center">
            <div className="relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                value={searchViajes}
                onChange={(event) => setSearchViajes(event.target.value)}
                placeholder="Código, cliente, ruta, piloto..."
                className="w-full h-11 rounded-xl border border-gray-200 bg-white pl-12 pr-4 text-sm outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20"
              />
            </div>

            <select
              value={filterEstadoViaje}
              onChange={(event) => setFilterEstadoViaje(event.target.value)}
              className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20"
            >
              {estadosViajeFiltro.map((estado) => (
                <option key={estado} value={estado}>{estado === "Todos" ? "Todos los estados" : estado}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={resetViajeFilters}
              className="h-11 px-4 rounded-xl border border-orange-200 bg-white text-sm font-bold text-[#FF6A00] inline-flex items-center justify-center gap-1.5 shadow-sm hover:border-[#FF6A00] hover:bg-orange-50 whitespace-nowrap"
            >
              <X className="w-4 h-4" /> Limpiar
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-3">
            <span className="text-xs font-bold uppercase text-gray-400">Ordenar por:</span>
            <SortChip field="codigo" label="Código" activeField={sortViajeField} direction={sortViajeDirection} setField={setSortViajeField} setDirection={setSortViajeDirection} />
            <SortChip field="cliente" label="Cliente" activeField={sortViajeField} direction={sortViajeDirection} setField={setSortViajeField} setDirection={setSortViajeDirection} />
            <SortChip field="ruta" label="Ruta" activeField={sortViajeField} direction={sortViajeDirection} setField={setSortViajeField} setDirection={setSortViajeDirection} />
            <SortChip field="estado" label="Estado" activeField={sortViajeField} direction={sortViajeDirection} setField={setSortViajeField} setDirection={setSortViajeDirection} />
            <SortChip field="progreso" label="Progreso" activeField={sortViajeField} direction={sortViajeDirection} setField={setSortViajeField} setDirection={setSortViajeDirection} />
            <span className="ml-0 lg:ml-auto text-sm font-bold text-gray-400">
              {sortedViajes.length} de {viajes.length} registros visibles
            </span>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Accesos:</span>
            <button type="button" onClick={goToEnvios} className="h-8 px-3 rounded-lg bg-blue-50 text-[#0C2D6B] text-xs font-bold inline-flex items-center gap-1.5 hover:bg-blue-100">
              <Package className="w-3.5 h-3.5" /> Ir a Envíos
            </button>
            <button type="button" onClick={goToDepositos} className="h-8 px-3 rounded-lg bg-orange-50 text-[#C85100] text-xs font-bold inline-flex items-center gap-1.5 hover:bg-orange-100">
              <Warehouse className="w-3.5 h-3.5" /> Ir a Depósitos / Bodega
            </button>
            <button type="button" onClick={goToTop} className="h-8 px-3 rounded-lg bg-gray-50 text-gray-600 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-gray-100">
              <ArrowUp className="w-3.5 h-3.5" /> Volver arriba
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {paginatedViajes.map((viaje) => (
            <article key={viaje.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span className="font-mono font-bold text-[#0C2D6B] bg-gray-50 px-3 py-1 rounded-lg text-xs">{viaje.codigo}</span>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${getEstadoColor(viaje.estado)}`}>
                    {viaje.estado}
                  </span>
                </div>

                <h3 className="font-bold text-gray-800 text-sm leading-5 min-h-[40px] line-clamp-2">{viaje.ruta}</h3>

                <div className="grid grid-cols-2 gap-3 text-xs mt-4">
                  <div>
                    <p className="text-gray-400 font-semibold">Unidad</p>
                    <p className="font-bold text-gray-700 mt-0.5">{viaje.unidad}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 font-semibold">Piloto</p>
                    <p className="font-bold text-gray-700 mt-0.5 line-clamp-2">{viaje.piloto}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 font-semibold">Cliente</p>
                    <p className="font-bold text-gray-700 mt-0.5 line-clamp-2">{viaje.cliente}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 font-semibold">ETA</p>
                    <p className="font-bold text-[#FF6A00] mt-0.5">{viaje.eta || "-"}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-gray-500">Progreso</span>
                    <span>{viaje.progreso || 0}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className={`h-full rounded-full ${getProgressColor(viaje.estado)}`} style={{ width: `${viaje.progreso || 0}%` }} />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 bg-gray-50 px-3 py-2 flex justify-between gap-2">
                <ActionButton title="Ver" icon={Eye} tone="blue" onClick={() => openViewViaje(viaje)} />
                <ActionButton title="Editar" icon={Edit2} tone="orange" onClick={() => openEditViaje(viaje)} />
                <ActionButton title="Cambiar estado" icon={PlayCircle} onClick={() => changeStatus(viaje)} />
                <ActionButton title="Eliminar" icon={Trash2} tone="red" onClick={() => deleteViaje(viaje)} />
              </div>
            </article>
          ))}
        </div>

        {!sortedViajes.length && (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-500">
            <Truck className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            No se encontraron viajes con los filtros seleccionados.
          </div>
        )}

        <PaginationControls
          page={viajePage}
          totalPages={viajeTotalPages}
          rowsPerPage={viajeRowsPerPage}
          totalItems={sortedViajes.length}
          itemLabel="viajes filtrados"
          onPageChange={setViajePage}
          onRowsPerPageChange={setViajeRowsPerPage}
        />
      </section>

      <section id="logistica-registros" className="scroll-mt-28">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-gray-200 mb-4">
          <div className="flex flex-wrap gap-6">
          <button
            type="button"
            onClick={() => setActiveTab("envios")}
            className={`px-2 pb-3 font-bold text-base sm:text-lg border-b-4 ${
              activeTab === "envios" ? "border-[#FF6A00] text-[#0C2D6B]" : "border-transparent text-gray-500"
            }`}
          >
            Registro de Envíos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("depositos")}
            className={`px-2 pb-3 font-bold text-base sm:text-lg border-b-4 ${
              activeTab === "depositos" ? "border-[#FF6A00] text-[#0C2D6B]" : "border-transparent text-gray-500"
            }`}
          >
            Gestión de Depósitos
          </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pb-2">
            <button type="button" onClick={goToViajes} className="h-9 px-3 rounded-xl border border-blue-100 bg-blue-50 text-[#0C2D6B] text-xs font-bold inline-flex items-center gap-1.5 hover:bg-blue-100">
              <Truck className="w-4 h-4" /> Viajes
            </button>
            <button type="button" onClick={goToTop} className="h-9 px-3 rounded-xl border border-gray-200 bg-white text-gray-600 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-gray-50">
              <ArrowUp className="w-4 h-4" /> Arriba
            </button>
          </div>
        </div>

        {activeTab === "envios" && (
          <div id="logistica-envios" className="scroll-mt-28">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
              <div className="flex flex-col 2xl:flex-row 2xl:items-center 2xl:justify-between gap-3">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_210px_230px_auto] gap-3 2xl:flex-1">
                  <div className="relative">
                    <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      value={searchEnvios}
                      onChange={(e) => setSearchEnvios(e.target.value)}
                      placeholder="Código, cliente, origen..."
                      className="w-full h-11 rounded-xl bg-white border border-gray-200 pl-12 pr-4 text-sm outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20"
                    />
                  </div>

                  <div className="relative">
                    <Filter className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <select
                      value={filterEstadoEnvio}
                      onChange={(e) => setFilterEstadoEnvio(e.target.value)}
                      className="w-full h-11 rounded-xl bg-white border border-gray-200 pl-12 pr-4 text-sm outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20"
                    >
                      {estadosFiltro.map((estado) => (
                        <option key={estado} value={estado}>{estado === "Todos" ? "Todos los estados" : estado}</option>
                      ))}
                    </select>
                  </div>

                  <div className="relative">
                    <Filter className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <select
                      value={filterClienteEnvio}
                      onChange={(e) => setFilterClienteEnvio(e.target.value)}
                      className="w-full h-11 rounded-xl bg-white border border-gray-200 pl-12 pr-4 text-sm outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20"
                    >
                      {clientesFiltro.map((cliente) => (
                        <option key={cliente} value={cliente}>{cliente === "Todos" ? "Todos los clientes" : cliente}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={resetEnvioFilters}
                    className="h-11 px-4 rounded-xl border border-orange-200 bg-white text-sm font-bold text-[#FF6A00] inline-flex items-center justify-center gap-1.5 shadow-sm hover:border-[#FF6A00] hover:bg-orange-50 whitespace-nowrap"
                  >
                    <X className="w-4 h-4" /> Limpiar
                  </button>
                </div>

                <div className="flex gap-2 2xl:shrink-0">
                  <button onClick={openCreateEnvio} className="h-12 px-6 rounded-xl bg-[#0C2D6B] text-white font-bold text-base inline-flex items-center gap-2.5 whitespace-nowrap shadow-md hover:bg-[#143C8C] transition-colors">
                    <Plus className="w-5 h-5" /> Nuevo Envío
                  </button>
                  <button onClick={exportEnviosPDF} className="h-11 px-4 rounded-xl bg-red-500 text-white font-bold text-sm inline-flex items-center gap-2 whitespace-nowrap">
                    <FileText className="w-4 h-4" /> PDF
                  </button>
                  <button
                    onClick={() =>
                      exportExcel(
                        sortedEnvios.map((e) => ({
                          Código: e.codigo,
                          Cliente: e.cliente,
                          Origen: e.origen,
                          Destino: e.destino,
                          Fecha: formatDate(e.fecha),
                          Estado: e.estado,
                        })),
                        "Envíos",
                        "Reporte_Envios"
                      )
                    }
                    className="h-11 px-4 rounded-xl bg-[#22C55E] text-white font-bold text-sm inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <Download className="w-4 h-4" /> Excel
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-3">
                <span className="text-xs font-bold uppercase text-gray-400">Ordenar por:</span>
                <SortChip field="codigo" label="Código" activeField={sortEnvioField} direction={sortEnvioDirection} setField={setSortEnvioField} setDirection={setSortEnvioDirection} />
                <SortChip field="cliente" label="Cliente" activeField={sortEnvioField} direction={sortEnvioDirection} setField={setSortEnvioField} setDirection={setSortEnvioDirection} />
                <SortChip field="origen" label="Origen" activeField={sortEnvioField} direction={sortEnvioDirection} setField={setSortEnvioField} setDirection={setSortEnvioDirection} />
                <SortChip field="destino" label="Destino" activeField={sortEnvioField} direction={sortEnvioDirection} setField={setSortEnvioField} setDirection={setSortEnvioDirection} />
                <SortChip field="fecha" label="Fecha" activeField={sortEnvioField} direction={sortEnvioDirection} setField={setSortEnvioField} setDirection={setSortEnvioDirection} />
                <span className="ml-0 lg:ml-auto text-sm font-bold text-gray-400">
                  {sortedEnvios.length} de {envios.length} registros visibles
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {paginatedEnvios.map((envio) => (
                <article key={envio.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="bg-[#0C2D6B] p-4 text-white">
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-mono font-bold text-sm">{envio.codigo}</span>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${getEstadoColor(envio.estado)}`}>
                        {envio.estado}
                      </span>
                    </div>
                    <h3 className="font-bold text-base mt-2 leading-5 line-clamp-2">{envio.cliente}</h3>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex gap-2">
                      <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-500">Ruta</p>
                        <p className="text-sm font-semibold text-gray-800 truncate">{envio.origen}</p>
                        <div className="flex items-center gap-2 my-1">
                          <span className="h-px flex-1 bg-gray-200" />
                          <Navigation className="w-3 h-3 text-gray-400" />
                          <span className="h-px flex-1 bg-gray-200" />
                        </div>
                        <p className="text-sm font-semibold text-gray-800 truncate">{envio.destino}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Building2 className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">Dirección</p>
                        <p className="text-sm text-gray-800 line-clamp-2">{envio.direccion || "-"}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Clock className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Fecha</p>
                        <p className="text-sm font-semibold">{formatDate(envio.fecha)}</p>
                      </div>
                    </div>

                    {envio.observaciones && (
                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">Observaciones</p>
                        <p className="text-sm text-gray-700 line-clamp-2">{envio.observaciones}</p>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-100 bg-gray-50 px-3 py-2 flex justify-end gap-2">
                    <ActionButton title="Ver" icon={Eye} tone="blue" onClick={() => openViewEnvio(envio)} />
                    <ActionButton title="Editar" icon={Edit2} tone="orange" onClick={() => openEditEnvio(envio)} />
                    <ActionButton title="Eliminar" icon={Trash2} tone="red" onClick={() => deleteEnvio(envio)} />
                  </div>
                </article>
              ))}
            </div>

            {!sortedEnvios.length && (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-500">
                <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                No se encontraron envíos.
              </div>
            )}

            <PaginationControls
              page={envioPage}
              totalPages={envioTotalPages}
              rowsPerPage={envioRowsPerPage}
              totalItems={sortedEnvios.length}
              itemLabel="envíos filtrados"
              onPageChange={setEnvioPage}
              onRowsPerPageChange={setEnvioRowsPerPage}
            />
          </div>
        )}

        {activeTab === "depositos" && (
          <div id="logistica-depositos" className="scroll-mt-28">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
              <div className="flex flex-col 2xl:flex-row 2xl:items-center 2xl:justify-between gap-3">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_190px_190px_auto] gap-3 2xl:flex-1">
                  <div className="relative">
                    <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      value={searchDepositos}
                      onChange={(event) => setSearchDepositos(event.target.value)}
                      placeholder="Código, depósito, ubicación..."
                      className="w-full h-11 rounded-xl border border-gray-200 bg-white pl-12 pr-4 text-sm outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20"
                    />
                  </div>

                  <select
                    value={filterEstadoDeposito}
                    onChange={(event) => setFilterEstadoDeposito(event.target.value)}
                    className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20"
                  >
                    {estadosDepositoFiltro.map((estado) => (
                      <option key={estado} value={estado}>{estado === "Todos" ? "Todos los estados" : estado}</option>
                    ))}
                  </select>

                  <select
                    value={filterTipoDeposito}
                    onChange={(event) => setFilterTipoDeposito(event.target.value)}
                    className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20"
                  >
                    {tiposDepositoFiltro.map((tipo) => (
                      <option key={tipo} value={tipo}>{tipo === "Todos" ? "Todos los tipos" : tipo}</option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={resetDepositoFilters}
                    className="h-11 px-4 rounded-xl border border-orange-200 bg-white text-sm font-bold text-[#FF6A00] inline-flex items-center justify-center gap-1.5 shadow-sm hover:border-[#FF6A00] hover:bg-orange-50 whitespace-nowrap"
                  >
                    <X className="w-4 h-4" /> Limpiar
                  </button>
                </div>

                <div className="flex gap-2 2xl:shrink-0">
                  <button onClick={openCreateDeposito} className="h-12 px-6 rounded-xl bg-[#0C2D6B] text-white font-bold text-base inline-flex items-center gap-2.5 whitespace-nowrap shadow-md hover:bg-[#143C8C] transition-colors">
                    <Plus className="w-5 h-5" /> Nuevo Depósito
                  </button>
                  <button onClick={exportDepositosPDF} className="h-11 px-4 rounded-xl bg-red-500 text-white font-bold text-sm inline-flex items-center gap-2 whitespace-nowrap">
                    <FileText className="w-4 h-4" /> PDF
                  </button>
                  <button
                    onClick={() =>
                      exportExcel(
                        sortedDepositos.map((d) => ({
                          Código: d.codigo,
                          Nombre: d.nombre_deposito || d.nombre,
                          Ubicación: d.ubicacion,
                          Capacidad: `${d.capacidad} ${d.unidad_medida || ""}`,
                          Tipo: d.tipo,
                          Estado: d.estado,
                        })),
                        "Depósitos",
                        "Reporte_Depositos"
                      )
                    }
                    className="h-11 px-4 rounded-xl bg-[#22C55E] text-white font-bold text-sm inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <Download className="w-4 h-4" /> Excel
                  </button>
                </div>
              </div>

              <div className="pt-3 text-sm font-bold text-gray-400">
                {sortedDepositos.length} de {depositos.length} registros visibles
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm text-left">
                  <thead className="bg-gray-50 text-[#0C2D6B]">
                    <tr>
                      <SortableTh field="codigo" activeField={sortDepositoField} direction={sortDepositoDirection} setField={setSortDepositoField} setDirection={setSortDepositoDirection} className="px-4 py-3">Código</SortableTh>
                      <SortableTh field="nombre" activeField={sortDepositoField} direction={sortDepositoDirection} setField={setSortDepositoField} setDirection={setSortDepositoDirection} className="px-4 py-3">Nombre</SortableTh>
                      <SortableTh field="ubicacion" activeField={sortDepositoField} direction={sortDepositoDirection} setField={setSortDepositoField} setDirection={setSortDepositoDirection} className="px-4 py-3">Ubicación</SortableTh>
                      <SortableTh field="capacidad" activeField={sortDepositoField} direction={sortDepositoDirection} setField={setSortDepositoField} setDirection={setSortDepositoDirection} className="px-4 py-3">Capacidad</SortableTh>
                      <SortableTh field="tipo" activeField={sortDepositoField} direction={sortDepositoDirection} setField={setSortDepositoField} setDirection={setSortDepositoDirection} className="px-4 py-3">Tipo</SortableTh>
                      <SortableTh field="estado" activeField={sortDepositoField} direction={sortDepositoDirection} setField={setSortDepositoField} setDirection={setSortDepositoDirection} className="px-4 py-3">Estado</SortableTh>
                      <th className="px-4 py-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedDepositos.map((deposito) => (
                      <tr key={deposito.id} className="hover:bg-gray-50/60">
                        <td className="px-4 py-3 font-mono font-bold text-[#0C2D6B]">{deposito.codigo}</td>
                        <td className="px-4 py-3 font-bold text-gray-800">{deposito.nombre_deposito || deposito.nombre}</td>
                        <td className="px-4 py-3 text-gray-600">{deposito.ubicacion}</td>
                        <td className="px-4 py-3 text-gray-600">{deposito.capacidad} {deposito.unidad_medida || ""}</td>
                        <td className="px-4 py-3">
                          <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold">
                            {deposito.tipo}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-3 py-1 rounded-full text-[11px] font-bold border ${getEstadoColor(deposito.estado)}`}>
                            {deposito.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-2">
                            <ActionButton title="Ver" icon={Eye} tone="blue" onClick={() => openViewDeposito(deposito)} />
                            <ActionButton title="Editar" icon={Edit2} tone="orange" onClick={() => openEditDeposito(deposito)} />
                            <ActionButton title="Inactivar" icon={Trash2} tone="red" onClick={() => deleteDeposito(deposito)} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!sortedDepositos.length && (
                <div className="p-10 text-center text-gray-500">
                  <Warehouse className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  No se encontraron depósitos con los filtros seleccionados.
                </div>
              )}
            </div>

            <PaginationControls
              page={depositoPage}
              totalPages={depositoTotalPages}
              rowsPerPage={depositoRowsPerPage}
              totalItems={sortedDepositos.length}
              itemLabel="depósitos filtrados"
              onPageChange={setDepositoPage}
              onRowsPerPageChange={setDepositoRowsPerPage}
            />
          </div>
        )}
      </section>

      {/* Acceso flotante para regresar al inicio del módulo desde listados largos */}
      <button
        type="button"
        onClick={goToTop}
        title="Volver arriba"
        aria-label="Volver arriba"
        className="fixed bottom-5 right-5 z-40 w-11 h-11 rounded-full bg-[#0C2D6B] text-white shadow-xl inline-flex items-center justify-center hover:bg-[#143C8C] transition-colors"
      >
        <ArrowUp className="w-5 h-5" />
      </button>

      {viajeModal.open && (
        <Modal
          title={viajeModal.mode === "view" ? "Detalle de Viaje" : viajeModal.mode === "create" ? "Nuevo Viaje" : "Editar Viaje"}
          onClose={() => setViajeModal({ open: false, mode: "create" })}
        >
          {viajeModal.mode === "view" && currentViaje ? (
            <ViewViaje viaje={currentViaje} />
          ) : (
            <div data-form onKeyDown={moveOnEnter}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
                {viajeErrors.general && <div className="md:col-span-2 rounded-xl bg-red-50 text-red-700 p-3 text-sm font-semibold">{viajeErrors.general}</div>}

                <Field label="Cliente *" error={viajeErrors.cliente_id}>
                  <SearchableSelect
                    value={viajeForm.cliente_id}
                    options={clientes}
                    placeholder="Buscar cliente..."
                    getLabel={(item) => `${item.codigo_cliente} · ${item.nombre_empresa}`}
                    onSelect={(item) => setViajeForm({ ...viajeForm, cliente_id: item.id, envio_id: "" })}
                  />
                </Field>

                <Field label="Envío relacionado *" error={viajeErrors.envio_id}>
                  {(() => {
                    const enviosDelCliente = envios.filter((envio) =>
                      !viajeForm.cliente_id || Number(envio.cliente_id) === Number(viajeForm.cliente_id)
                    );

                    if (viajeForm.cliente_id && enviosDelCliente.length === 0) {
                      const clienteSeleccionado = clientes.find((cliente) => Number(cliente.id) === Number(viajeForm.cliente_id));

                      return (
                        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white text-[#FF6A00] flex items-center justify-center shrink-0">
                              <Package className="w-5 h-5" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-[#C85100]">
                                Este cliente aún no tiene envíos registrados
                              </p>
                              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                                Para crear un viaje primero se debe registrar el envío del cliente
                                {clienteSeleccionado ? ` ${clienteSeleccionado.nombre_empresa}` : ""}. Luego regresá a Nuevo Viaje y seleccioná ese envío.
                              </p>

                              <button
                                type="button"
                                onClick={openCreateEnvioFromViaje}
                                className="mt-3 h-10 px-4 rounded-xl bg-[#0C2D6B] text-white text-sm font-bold inline-flex items-center gap-2"
                              >
                                <Plus className="w-4 h-4" />
                                Registrar envío primero
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <SearchableSelect
                        value={viajeForm.envio_id}
                        options={enviosDelCliente}
                        placeholder={viajeForm.cliente_id ? "Buscar envío del cliente..." : "Primero seleccioná un cliente"}
                        getLabel={(item) => `${item.codigo} · ${item.origen} → ${item.destino}`}
                        getSubLabel={(item) => item.cliente}
                        onSelect={(item) => {
                          const ruta = rutas.find((r) => Number(r.origen_id) === Number(item.origen_id) && Number(r.destino_id) === Number(item.destino_id));
                          setViajeForm({
                            ...viajeForm,
                            envio_id: item.id,
                            cliente_id: item.cliente_id,
                            ruta_id: ruta?.id || viajeForm.ruta_id,
                          });
                        }}
                        error={viajeErrors.envio_id}
                      />
                    );
                  })()}
                </Field>

                <Field label="Ruta *" error={viajeErrors.ruta_id}>
                  <SearchableSelect
                    value={viajeForm.ruta_id}
                    options={rutas}
                    placeholder="Buscar ruta..."
                    getLabel={(item) => `${item.codigo_ruta} · ${rutaLabel(item)}`}
                    getSubLabel={(item) => `${item.distancia_km || 0} km`}
                    onSelect={(item) => setViajeForm({ ...viajeForm, ruta_id: item.id })}
                    error={viajeErrors.ruta_id}
                  />
                </Field>

                <Field label="Unidad *" error={viajeErrors.unidad_id}>
                  <SearchableSelect
                    value={viajeForm.unidad_id}
                    options={unidades}
                    placeholder="Buscar unidad..."
                    getLabel={(item) => `${item.codigo} · ${item.tipo}`}
                    onSelect={(item) => setViajeForm({ ...viajeForm, unidad_id: item.id })}
                    error={viajeErrors.unidad_id}
                  />
                </Field>

                <Field label="Piloto *" error={viajeErrors.piloto_id}>
                  <SearchableSelect
                    value={viajeForm.piloto_id}
                    options={pilotos}
                    placeholder="Buscar piloto..."
                    getLabel={(item) => `${item.codigo_piloto} · ${fullPilot(item)}`}
                    getSubLabel={(item) => `Licencia: ${item.licencia}`}
                    onSelect={(item) => setViajeForm({ ...viajeForm, piloto_id: item.id })}
                    error={viajeErrors.piloto_id}
                  />
                </Field>

                <Field label="Fecha / hora salida *" error={viajeErrors.fecha_salida}>
                  <input
                    type="datetime-local"
                    value={viajeForm.fecha_salida || ""}
                    onChange={(event) => setViajeForm({ ...viajeForm, fecha_salida: event.target.value })}
                    className={inputClass}
                  />
                </Field>

                <Field label="ETA *" error={viajeErrors.eta}>
                  <input
                    type="time"
                    value={viajeForm.eta || ""}
                    onChange={(event) => setViajeForm({ ...viajeForm, eta: event.target.value })}
                    className={inputClass}
                  />
                </Field>

                <Field label="Estado">
                  <select
                    value={viajeForm.estado || "Pendiente"}
                    onChange={(event) => {
                      const estado = event.target.value;
                      const current = Number(viajeForm.progreso || 0);
                      const progreso =
                        estado === "Pendiente"
                          ? 0
                          : estado === "En tránsito" || estado === "Retraso" || estado === "Crítico"
                          ? Math.max(current, 35)
                          : estado === "En destino"
                          ? Math.max(current, 90)
                          : 100;
                      setViajeForm({ ...viajeForm, estado, progreso });
                    }}
                    className={inputClass}
                  >
                    <option value="Pendiente">Recolección / Pendiente</option>
                    <option value="En tránsito">En ruta</option>
                    <option value="Retraso">Retraso</option>
                    <option value="Crítico">Crítico</option>
                    <option value="En destino">En destino</option>
                    <option value="Entregado">Entregado</option>
                  </select>
                </Field>

                <Field label="Progreso (%)" error={viajeErrors.progreso}>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={3}
                    value={viajeForm.progreso ?? ""}
                    onChange={(event) => {
                      const clean = cleanInteger(event.target.value, 3);
                      const n = Math.min(100, Number(clean || 0));
                      setViajeForm({ ...viajeForm, progreso: n });
                    }}
                    className={inputClass}
                    placeholder="0 - 100"
                  />
                </Field>
              </div>

              <ModalFooter onCancel={() => setViajeModal({ open: false, mode: "create" })} onSave={saveViaje} />
            </div>
          )}
        </Modal>
      )}

      {envioModal.open && (
        <Modal
          title={envioModal.mode === "view" ? "Detalle de Envío" : envioModal.mode === "create" ? "Nuevo Envío" : "Editar Envío"}
          onClose={() => setEnvioModal({ open: false, mode: "create" })}
        >
          {envioModal.mode === "view" && currentEnvio ? (
            <ViewEnvio envio={currentEnvio} />
          ) : (
            <div data-form onKeyDown={moveOnEnter}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
                {envioErrors.general && <div className="md:col-span-2 rounded-xl bg-red-50 text-red-700 p-3 text-sm font-semibold">{envioErrors.general}</div>}

                <Field label="Cliente *" error={envioErrors.cliente_id} className="md:col-span-2">
                  <SearchableSelect
                    value={envioForm.cliente_id}
                    options={clientes}
                    placeholder="Buscar cliente..."
                    getLabel={(item) => `${item.codigo_cliente} · ${item.nombre_empresa}`}
                    onSelect={(item) => setEnvioForm({ ...envioForm, cliente_id: item.id })}
                    error={envioErrors.cliente_id}
                  />
                </Field>

                <Field label="Origen *" error={envioErrors.origen_id}>
                  <SearchableSelect
                    value={envioForm.origen_id}
                    options={ubicaciones}
                    placeholder="Buscar origen..."
                    getLabel={(item) => `${item.nombre_ubicacion}, ${item.pais}`}
                    onSelect={(item) => setEnvioForm({ ...envioForm, origen_id: item.id })}
                    error={envioErrors.origen_id}
                  />
                </Field>

                <Field label="Destino *" error={envioErrors.destino_id}>
                  <SearchableSelect
                    value={envioForm.destino_id}
                    options={ubicaciones}
                    placeholder="Buscar destino..."
                    getLabel={(item) => `${item.nombre_ubicacion}, ${item.pais}`}
                    onSelect={(item) => setEnvioForm({ ...envioForm, destino_id: item.id })}
                    error={envioErrors.destino_id}
                  />
                </Field>

                <Field label="Dirección exacta *" error={envioErrors.direccion} className="md:col-span-2">
                  <input
                    value={envioForm.direccion || ""}
                    onChange={(event) => setEnvioForm({ ...envioForm, direccion: cleanAddress(event.target.value, 180) })}
                    className={inputClass}
                    placeholder="Zona, ciudad, referencia"
                  />
                </Field>

                <Field label="Fecha *" error={envioErrors.fecha}>
                  <input
                    type="date"
                    value={envioForm.fecha || ""}
                    onChange={(event) => setEnvioForm({ ...envioForm, fecha: event.target.value })}
                    className={inputClass}
                  />
                </Field>

                <Field label="Estado">
                  <select
                    value={envioForm.estado_id || estadoIdByName("recolección")}
                    onChange={(event) => setEnvioForm({ ...envioForm, estado_id: Number(event.target.value) })}
                    className={inputClass}
                  >
                    {estadosEnvio.map((estado) => (
                      <option key={estado.id} value={estado.id}>{estado.nombre_estado_envio}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Observaciones" className="md:col-span-2">
                  <textarea
                    rows={3}
                    value={envioForm.observaciones || ""}
                    onChange={(event) => setEnvioForm({ ...envioForm, observaciones: cleanAddress(event.target.value, 250) })}
                    className={`${inputClass} h-auto py-3 resize-none`}
                    placeholder="Notas adicionales"
                  />
                </Field>
              </div>

              <ModalFooter onCancel={() => setEnvioModal({ open: false, mode: "create" })} onSave={saveEnvio} />
            </div>
          )}
        </Modal>
      )}

      {depositoModal.open && (
        <Modal
          title={depositoModal.mode === "view" ? "Detalle de Depósito" : depositoModal.mode === "create" ? "Nuevo Depósito" : "Editar Depósito"}
          onClose={() => setDepositoModal({ open: false, mode: "create" })}
        >
          {depositoModal.mode === "view" && currentDeposito ? (
            <ViewDeposito deposito={currentDeposito} />
          ) : (
            <div data-form onKeyDown={moveOnEnter}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
                {depositoErrors.general && <div className="md:col-span-2 rounded-xl bg-red-50 text-red-700 p-3 text-sm font-semibold">{depositoErrors.general}</div>}

                <Field label="Nombre del depósito *" error={depositoErrors.nombre_deposito} className="md:col-span-2">
                  <input
                    value={depositoForm.nombre_deposito || ""}
                    onChange={(event) => setDepositoForm({ ...depositoForm, nombre_deposito: cleanCommercial(event.target.value, 120) })}
                    className={inputClass}
                    placeholder="Ej. Bodega Central"
                  />
                </Field>

                <Field label="Ubicación *" error={depositoErrors.ubicacion_id} className="md:col-span-2">
                  <SearchableSelect
                    value={depositoForm.ubicacion_id}
                    options={ubicaciones}
                    placeholder="Buscar ubicación..."
                    getLabel={(item) => `${item.nombre_ubicacion}, ${item.pais}`}
                    onSelect={(item) => setDepositoForm({ ...depositoForm, ubicacion_id: item.id })}
                    error={depositoErrors.ubicacion_id}
                  />
                </Field>

                <Field label="Dirección / referencia">
                  <input
                    value={depositoForm.direccion || ""}
                    onChange={(event) => setDepositoForm({ ...depositoForm, direccion: cleanAddress(event.target.value, 180) })}
                    className={inputClass}
                    placeholder="Dirección o referencia"
                  />
                </Field>

                <Field label="Capacidad *" error={depositoErrors.capacidad}>
                  <input
                    inputMode="decimal"
                    value={depositoForm.capacidad || ""}
                    onChange={(event) => setDepositoForm({ ...depositoForm, capacidad: cleanDecimal(event.target.value, 8, 2) })}
                    className={inputClass}
                    placeholder="Solo números"
                  />
                </Field>

                <Field label="Unidad de medida">
                  <select
                    value={depositoForm.unidad_medida || "m³"}
                    onChange={(event) => setDepositoForm({ ...depositoForm, unidad_medida: event.target.value })}
                    className={inputClass}
                  >
                    <option value="m³">m³</option>
                    <option value="pallets">pallets</option>
                    <option value="kg">kg</option>
                    <option value="unidades">unidades</option>
                  </select>
                </Field>

                <Field label="Tipo *" error={depositoErrors.tipo_id}>
                  <select
                    value={depositoForm.tipo_id || ""}
                    onChange={(event) => setDepositoForm({ ...depositoForm, tipo_id: Number(event.target.value) })}
                    className={inputClass}
                  >
                    <option value="">Seleccionar tipo</option>
                    {tiposDeposito.map((tipo) => (
                      <option key={tipo.id} value={tipo.id}>{tipo.nombre_tipo_deposito}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Estado">
                  <select
                    value={depositoForm.activo === false ? "Inactivo" : "Activo"}
                    onChange={(event) => setDepositoForm({ ...depositoForm, activo: event.target.value === "Activo" })}
                    className={inputClass}
                  >
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </Field>
              </div>

              <ModalFooter onCancel={() => setDepositoModal({ open: false, mode: "create" })} onSave={saveDeposito} />
            </div>
          )}
        </Modal>
      )}

      {confirmDialog && (
        <ConfirmDialog
          open={!!confirmDialog}
          title={confirmDialog.title}
          message={confirmDialog.message}
          code={confirmDialog.code}
          actionLabel={confirmDialog.actionLabel}
          tone={confirmDialog.tone}
          loading={confirmLoading}
          onCancel={() => !confirmLoading && setConfirmDialog(null)}
          onConfirm={executeConfirmDelete}
        />
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-[#0C2D6B]">{title}</h2>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full bg-gray-50 text-gray-400 hover:text-gray-700 inline-flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function ConfirmDialog({
  open,
  title,
  message,
  code,
  actionLabel,
  tone,
  loading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  code: string;
  actionLabel: string;
  tone: "danger" | "warning";
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  const isDanger = tone === "danger";

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100">
        <div className={`h-2 ${isDanger ? "bg-red-500" : "bg-[#FF6A00]"}`} />

        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
              isDanger ? "bg-red-50 text-red-600" : "bg-orange-50 text-[#FF6A00]"
            }`}>
              {isDanger ? <Trash2 className="w-7 h-7" /> : <Warehouse className="w-7 h-7" />}
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-bold text-[#0C2D6B]">{title}</h3>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">{message}</p>

              <div className="mt-4 rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-400 font-bold">Registro seleccionado</p>
                <p className="font-mono text-sm font-bold text-gray-800 mt-1">{code}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="w-9 h-9 rounded-full bg-gray-50 text-gray-400 hover:text-gray-700 hover:bg-gray-100 inline-flex items-center justify-center disabled:opacity-60"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="h-11 px-5 rounded-xl border border-gray-200 bg-white text-gray-700 font-bold text-sm hover:bg-gray-100 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`h-11 px-5 rounded-xl text-white font-bold text-sm inline-flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 ${
              isDanger ? "bg-red-600 hover:bg-red-700" : "bg-[#FF6A00] hover:bg-[#e85f00]"
            }`}
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : isDanger ? <Trash2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {loading ? "Procesando..." : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalFooter({ onCancel, onSave }: { onCancel: () => void; onSave: () => void }) {
  return (
    <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
      <button type="button" onClick={onCancel} className="h-10 px-4 rounded-xl border border-gray-200 bg-white text-gray-700 font-bold text-sm">
        Cancelar
      </button>
      <button data-save-button="true" type="button" onClick={onSave} className="h-10 px-5 rounded-xl bg-[#0C2D6B] text-white font-bold text-sm">
        Guardar
      </button>
    </div>
  );
}

function ViewViaje({ viaje }: { viaje: Viaje }) {
  return (
    <div className="p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">Cliente</p>
          <h3 className="font-bold text-lg text-gray-800">{viaje.cliente}</h3>
          <p className="text-xs text-gray-400 mt-1">{viaje.codigo} · Envío {viaje.envio_codigo || viaje.envio_id}</p>
        </div>
        <span className={`px-4 py-1.5 rounded-full text-sm font-bold border ${getEstadoColor(viaje.estado)}`}>
          {viaje.estado}
        </span>
      </div>

      <div className="rounded-xl bg-gray-50 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Info label="Ruta" value={viaje.ruta} />
        <Info label="Unidad" value={`${viaje.unidad} ${viaje.unidad_tipo ? `· ${viaje.unidad_tipo}` : ""}`} />
        <Info label="Piloto" value={viaje.piloto} />
        <Info label="Licencia" value={viaje.licencia || "-"} />
        <Info label="Salida" value={toDateTimeInput(viaje.fecha_salida || viaje.fechaSalida).replace("T", " ")} />
        <Info label="ETA" value={viaje.eta || "-"} />
      </div>

      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#0C2D6B] flex items-center gap-2">
              <Navigation className="w-4 h-4 text-[#FF6A00]" />
              Mapa de la ruta
            </p>
            <p className="text-xs text-gray-500">{viaje.ruta}</p>
          </div>
          <a
            href={mapExternal(viaje.ruta)}
            target="_blank"
            rel="noreferrer"
            className="h-9 px-3 rounded-lg bg-[#0C2D6B] text-white text-xs font-bold inline-flex items-center justify-center gap-2"
          >
            <MapPin className="w-4 h-4" />
            Google Maps
          </a>
        </div>
        <iframe
          title={`Mapa ${viaje.codigo}`}
          src={mapEmbed(viaje.ruta)}
          className="w-full h-[250px] border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      <div>
        <div className="flex justify-between text-xs font-bold mb-1">
          <span>Origen</span>
          <span>{viaje.progreso || 0}%</span>
          <span>Destino</span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full ${getProgressColor(viaje.estado)}`} style={{ width: `${viaje.progreso || 0}%` }} />
        </div>
      </div>
    </div>
  );
}

function ViewEnvio({ envio }: { envio: Envio }) {
  return (
    <div className="p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">Cliente</p>
          <h3 className="font-bold text-lg text-gray-800">{envio.cliente}</h3>
          <p className="text-xs text-gray-400 mt-1">{envio.codigo}</p>
        </div>
        <span className={`px-4 py-1.5 rounded-full text-sm font-bold border ${getEstadoColor(envio.estado)}`}>
          {envio.estado}
        </span>
      </div>

      <div className="rounded-xl bg-gray-50 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Info label="Origen" value={envio.origen} />
        <Info label="Destino" value={envio.destino} />
        <Info label="Dirección" value={envio.direccion} />
        <Info label="Fecha" value={formatDate(envio.fecha)} />
      </div>

      {envio.observaciones && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs text-blue-700 font-bold mb-1">Observaciones</p>
          <p className="text-sm text-gray-700">{envio.observaciones}</p>
        </div>
      )}
    </div>
  );
}

function ViewDeposito({ deposito }: { deposito: Deposito }) {
  return (
    <div className="p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">Depósito</p>
          <h3 className="font-bold text-lg text-gray-800">{deposito.nombre_deposito || deposito.nombre}</h3>
          <p className="text-xs text-gray-400 mt-1">{deposito.codigo}</p>
        </div>
        <span className={`px-4 py-1.5 rounded-full text-sm font-bold border ${getEstadoColor(deposito.estado)}`}>
          {deposito.estado}
        </span>
      </div>

      <div className="rounded-xl bg-gray-50 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Info label="Ubicación" value={deposito.ubicacion} />
        <Info label="Dirección / referencia" value={deposito.direccion || "-"} />
        <Info label="Capacidad" value={`${deposito.capacidad} ${deposito.unidad_medida || ""}`} />
        <Info label="Tipo" value={deposito.tipo} />
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide font-bold mb-1">{label}</p>
      <p className="text-sm font-semibold text-gray-800 break-words">{value || "-"}</p>
    </div>
  );
}