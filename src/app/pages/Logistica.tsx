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


type Envio = {
  id: number;
  codigo: string;
  cliente_id: number;
  origen_id: number;
  destino_id: number;
  ruta_id?: number | null;
  codigo_ruta?: string | null;
  nombre_ruta?: string | null;
  distancia_km?: number | null;
  ruta_texto?: string | null;
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

const toDateInput = (value: any) => {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
};

const formatDate = (value: any) => {
  const iso = toDateInput(value);
  if (!iso) return "-";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
};

const toDateTimeInput = (value: any) => {
  const text = String(value || "").trim();
  if (!text) return "";

  // Cuando MySQL/Express devuelve un ISO con Z, no debemos cortar la cadena:
  // hay que convertirlo a la hora LOCAL del navegador. Esto corrige, por ejemplo,
  // 17:05 en Guatemala que antes se mostraba como 23:05.
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(text)) {
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }
  }

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
      return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-slate-400/10 dark:text-slate-300 dark:border-slate-400/30";
    case "En ruta":
    case "En tránsito":
      return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-400/30";
    case "En destino":
      return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-400/30";
    case "Entregado":
      return "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-300 dark:border-green-400/30";
    case "Retraso":
      return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-400/30";
    case "Crítico":
      return "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-400/30";
    case "Activo":
      return "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-300 dark:border-green-400/30";
    case "Inactivo":
      return "bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-400/10 dark:text-slate-300 dark:border-slate-400/30";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-slate-400/10 dark:text-slate-300 dark:border-slate-400/30";
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
    const skip = item.getAttribute("data-skip-enter") === "true";
    return !disabled && !hidden && !skip;
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
  actionLabel,
  onAction,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex min-h-[20px] items-center justify-between gap-2">
        <label className="block text-xs font-bold text-gray-600">{label}</label>
        {actionLabel && onAction && (
          <button
            type="button"
            data-skip-enter="true"
            onClick={onAction}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2.5 text-[11px] font-bold text-[#D45700] transition hover:border-[#FF6A00] hover:bg-orange-100"
          >
            <Plus className="h-3.5 w-3.5" /> {actionLabel}
          </button>
        )}
      </div>
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
          {[3, 6, 9, 12, 15, 18].map((size) => (
            <option key={size} value={size}>
              {size} por página
            </option>
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

  const [envios, setEnvios] = useState<Envio[]>([]);
  const [viajes, setViajes] = useState<Viaje[]>([]);

  const [activeTab, setActiveTab] = useState<"envios">("envios");
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

  // Paginación independiente para cada submódulo de Logística.
  const [viajePage, setViajePage] = useState(1);
  const [viajeRowsPerPage, setViajeRowsPerPage] = useState(6);
  const [envioPage, setEnvioPage] = useState(1);
  const [envioRowsPerPage, setEnvioRowsPerPage] = useState(6);

  const [viajeModal, setViajeModal] = useState<{ open: boolean; mode: "create" | "edit" | "view" }>({
    open: false,
    mode: "create",
  });
  const [envioModal, setEnvioModal] = useState<{ open: boolean; mode: "create" | "edit" | "view" }>({
    open: false,
    mode: "create",
  });
  const [currentViaje, setCurrentViaje] = useState<Viaje | null>(null);
  const [currentEnvio, setCurrentEnvio] = useState<Envio | null>(null);
  const [hoveredViajeId, setHoveredViajeId] = useState<number | null>(null);

  const [viajeForm, setViajeForm] = useState<AnyRow>({});
  const [envioForm, setEnvioForm] = useState<AnyRow>({});

  const [viajeErrors, setViajeErrors] = useState<FormErrors>({});
  const [envioErrors, setEnvioErrors] = useState<FormErrors>({});

  const [envioFromViaje, setEnvioFromViaje] = useState(false);
  const [quickModal, setQuickModal] = useState<null | {
    type: "cliente" | "ruta" | "unidad" | "piloto" | "ubicacion";
    target: string;
  }>(null);
  const [quickForm, setQuickForm] = useState<AnyRow>({});
  const [quickError, setQuickError] = useState("");
  const [quickSaving, setQuickSaving] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<null | {
    type: "viaje" | "envio";
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
      setEnvios(asArray<Envio>(data.envios));
      setViajes(asArray<Viaje>(data.viajes));
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


  const viajeTotalPages = Math.max(1, Math.ceil(sortedViajes.length / viajeRowsPerPage));
  const envioTotalPages = Math.max(1, Math.ceil(sortedEnvios.length / envioRowsPerPage));

  const paginatedViajes = useMemo(() => {
    const start = (viajePage - 1) * viajeRowsPerPage;
    return sortedViajes.slice(start, start + viajeRowsPerPage);
  }, [sortedViajes, viajePage, viajeRowsPerPage]);

  const paginatedEnvios = useMemo(() => {
    const start = (envioPage - 1) * envioRowsPerPage;
    return sortedEnvios.slice(start, start + envioRowsPerPage);
  }, [sortedEnvios, envioPage, envioRowsPerPage]);


  // Al buscar, filtrar, ordenar o cambiar el tamaño de página regresamos a la primera página.
  useEffect(() => {
    setViajePage(1);
  }, [searchViajes, filterEstadoViaje, sortViajeField, sortViajeDirection, viajeRowsPerPage]);

  useEffect(() => {
    setEnvioPage(1);
  }, [searchEnvios, filterEstadoEnvio, filterClienteEnvio, sortEnvioField, sortEnvioDirection, envioRowsPerPage]);


  useEffect(() => {
    setViajePage((page) => Math.min(page, viajeTotalPages));
  }, [viajeTotalPages]);

  useEffect(() => {
    setEnvioPage((page) => Math.min(page, envioTotalPages));
  }, [envioTotalPages]);


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
      title: "Total servicios",
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
  ];

  const openQuick = (
    type: "cliente" | "ruta" | "unidad" | "piloto" | "ubicacion",
    target: string,
    seed: AnyRow = {}
  ) => {
    setQuickError("");
    setQuickForm(
      type === "ubicacion"
        ? { pais: "Guatemala", ...seed }
        : type === "ruta"
        ? { origen_id: "", destino_id: "", nombre_ruta: "", distancia_km: "", ...seed }
        : seed
    );
    setQuickModal({ type, target });
  };

  const closeQuick = () => {
    if (quickSaving) return;
    setQuickModal(null);
    setQuickForm({});
    setQuickError("");
  };

  const applyQuickCreated = (target: string, created: AnyRow) => {
    if (!created?.id) return;

    if (target === "viaje_cliente") {
      setViajeForm((current) => ({ ...current, cliente_id: created.id, envio_id: "" }));
    } else if (target === "viaje_ruta") {
      setViajeForm((current) => ({ ...current, ruta_id: created.id }));
    } else if (target === "viaje_unidad") {
      setViajeForm((current) => ({ ...current, unidad_id: created.id }));
    } else if (target === "viaje_piloto") {
      setViajeForm((current) => ({ ...current, piloto_id: created.id }));
    } else if (target === "envio_cliente") {
      setEnvioForm((current) => ({ ...current, cliente_id: created.id }));
    } else if (target === "envio_origen") {
      setEnvioForm((current) => ({ ...current, origen_id: created.id }));
    } else if (target === "envio_destino") {
      setEnvioForm((current) => ({ ...current, destino_id: created.id }));
    } else if (target === "envio_ruta") {
      setEnvioForm((current) => ({
        ...current,
        origen_id: created.origen_id || current.origen_id,
        destino_id: created.destino_id || current.destino_id,
      }));
    }
  };

  const saveQuick = async () => {
    if (!quickModal) return;
    setQuickError("");

    const value = (name: string) => String(quickForm[name] || "").trim();

    if (quickModal.type === "cliente" && (!value("nombre_empresa") || !value("nit"))) {
      setQuickError("Nombre de empresa y NIT son obligatorios.");
      return;
    }
    if (quickModal.type === "ubicacion" && !value("nombre_ubicacion")) {
      setQuickError("El nombre de la ubicación es obligatorio.");
      return;
    }
    if (quickModal.type === "ruta" && (!quickForm.origen_id || !quickForm.destino_id)) {
      setQuickError("Seleccioná origen y destino para la ruta.");
      return;
    }
    if (quickModal.type === "ruta" && Number(quickForm.origen_id) === Number(quickForm.destino_id)) {
      setQuickError("Origen y destino deben ser diferentes.");
      return;
    }
    if (quickModal.type === "unidad" && !value("tipo")) {
      setQuickError("El tipo de unidad es obligatorio.");
      return;
    }
    if (
      quickModal.type === "piloto" &&
      (!value("primer_nombre") || !value("primer_apellido") || !value("licencia"))
    ) {
      setQuickError("Primer nombre, primer apellido y licencia son obligatorios.");
      return;
    }

    try {
      setQuickSaving(true);
      const payload = { ...quickForm };
      const catalogPath: Record<string, string> = {
        cliente: "clientes",
        ruta: "rutas",
        unidad: "unidades",
        piloto: "pilotos",
        ubicacion: "ubicaciones",
      };
      const created = await apiRequest(`/logistica/catalogos/${catalogPath[quickModal.type]}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const target = quickModal.target;
      await load();
      applyQuickCreated(target, created);
      setQuickModal(null);
      setQuickForm({});
      showNotice("Registro creado y seleccionado correctamente.");
    } catch (error: any) {
      setQuickError(error.message || "No se pudo crear el registro.");
    } finally {
      setQuickSaving(false);
    }
  };

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
          ? "Este cliente no tiene servicios de transporte. Registrá un servicio primero y luego regresá al viaje."
          : "Seleccioná un servicio relacionado.";
    }
    // La ruta se obtiene automáticamente del origen y destino del envío.
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
            ruta_id: viajeForm.ruta_id || null,
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
    setEnvioFromViaje(true);
    setEnvioErrors({});
    setCurrentEnvio(null);
    setEnvioForm({
      cliente_id: clienteId,
      origen_id: "",
      destino_id: "",
      direccion: "",
      fecha: "",
      estado_id: estadoIdByName("recolección"),
      observaciones: "Servicio creado desde el formulario de viaje.",
    });
    setEnvioModal({ open: true, mode: "create" });
  };

  const openCreateEnvio = () => {
    setEnvioFromViaje(false);
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
      fecha: toDateInput(envio.fecha),
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
      const savedEnvio = await apiRequest(
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

      if (envioFromViaje && savedEnvio?.id) {
        setViajeForm((current) => ({
          ...current,
          cliente_id: envioForm.cliente_id || current.cliente_id,
          envio_id: savedEnvio.id,
          ruta_id: savedEnvio.ruta_id || "",
        }));
      }

      setEnvioFromViaje(false);
      showNotice("Servicio guardado correctamente en MySQL.");
    } catch (error: any) {
      setEnvioErrors({ general: error.message || "No se pudo guardar el servicio." });
    }
  };

  const deleteEnvio = async (envio: Envio) => {
    setConfirmDialog({
      type: "envio",
      id: envio.id,
      code: envio.codigo,
      title: "Eliminar servicio",
      message: `Esta acción eliminará el servicio ${envio.codigo}. Si el servicio ya está relacionado con un viaje, el sistema no permitirá borrarlo para proteger el historial operativo.`,
      actionLabel: "Sí, eliminar",
      tone: "danger",
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
        showNotice("Servicio eliminado correctamente.");
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
    await addCorporatePdfHeader(doc, "Servicios de Transporte", "Logística · Solicitudes de transporte registradas");

    autoTable(doc, {
      startY: 44,
      head: [["Código", "Cliente", "Origen → Destino", "Fecha", "Estado"]],
      body: sortedEnvios.map((e) => [e.codigo, e.cliente, `${e.origen} → ${e.destino}`, formatDate(e.fecha), e.estado]),
      headStyles: { fillColor: [12, 45, 107], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 8, cellPadding: 2.5 },
      margin: { left: 12, right: 12 },
    });

    doc.save(`Servicios_Transporte_${Date.now()}.pdf`);
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
    if (!element) return;

    // Dejamos espacio para:
    // - header principal del sistema
    // - barra rápida "Ir a"
    // Así los títulos no quedan escondidos/cortados al navegar.
    const offset = 166;
    const top =
      element.getBoundingClientRect().top +
      window.scrollY -
      offset;

    window.scrollTo({
      top: Math.max(0, top),
      behavior: "smooth",
    });
  };

  const goToViajes = () =>
    scrollToLogisticaSection("logistica-viajes");

  const goToEnvios = () => {
    setActiveTab("envios");
    window.setTimeout(
      () => scrollToLogisticaSection("logistica-registros"),
      80
    );
  };

  const goToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <div id="logistica-top" className="space-y-5 pb-12 w-full max-w-full overflow-hidden px-3 sm:px-4 scroll-mt-[166px]">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0C2D6B]">Logística</h1>
          <p className="text-gray-500 mt-1">Gestión de servicios de transporte, viajes, rutas y monitoreo operativo</p>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.title} {...kpi} />
        ))}
      </div>

      {/* Navegación rápida de ancho completo.
          Se deja larga para que sea fácil de ver y no choque con el header. */}
      <div className="sticky top-[92px] z-30 w-full px-1">
        <div className="w-full rounded-2xl border border-gray-200/90 bg-white/95 px-4 py-2.5 shadow-[0_6px_20px_rgba(15,23,42,0.10)] backdrop-blur-md dark:border-[#2D3B50] dark:bg-[#111827]/90 dark:shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
          <div className="flex min-h-10 w-full flex-wrap items-center gap-2">
            <span className="mr-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">
              Ir a:
            </span>

            <button
              type="button"
              onClick={goToViajes}
              className="h-9 px-3 rounded-xl border border-blue-100 bg-blue-50 text-[#0C2D6B] text-xs font-bold inline-flex items-center gap-1.5 hover:bg-blue-100 transition-colors dark:border-blue-400/25 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/15"
            >
              <Truck className="w-4 h-4" /> Viajes
            </button>

            <button
              type="button"
              onClick={goToEnvios}
              className={`h-9 px-3 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
                activeTab === "envios"
                  ? "border-orange-200 bg-orange-50 text-[#C85100] dark:border-orange-400/30 dark:bg-orange-500/10 dark:text-orange-200"
                  : "border-gray-200 bg-white text-[#0C2D6B] hover:bg-blue-50 dark:border-[#34435A] dark:bg-[#151F2F] dark:text-[#DCE8FA] dark:hover:bg-[#1A273A]"
              }`}
            >
              <Package className="w-4 h-4" /> Servicios
            </button>

            <button
              type="button"
              onClick={goToTop}
              className="ml-0 sm:ml-auto h-9 px-3 rounded-xl border border-gray-200 bg-white text-gray-600 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-gray-50 transition-colors dark:border-[#34435A] dark:bg-[#151F2F] dark:text-[#DCE8FA] dark:hover:bg-[#1A273A]"
            >
              <ArrowUp className="w-4 h-4" /> Arriba
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <section className="xl:col-span-2 bg-white dark:bg-[#111827] rounded-2xl border border-gray-100 dark:border-[#2A3950] shadow-sm dark:shadow-[0_12px_30px_rgba(0,0,0,0.20)] overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-[#263244] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#0C2D6B] dark:text-[#F8FAFC] flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#FF6A00]" />
                Rastreo en Tiempo Real
              </h2>
              <p className="mt-1 text-[11px] text-gray-400 dark:text-[#9FB0C6]">
                Identificá cada viaje por su código sin abrir el detalle.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="inline-flex h-7 items-center rounded-full border border-blue-100 bg-blue-50 px-2.5 text-[10px] font-extrabold text-[#0C2D6B] dark:border-blue-400/25 dark:bg-blue-500/10 dark:text-blue-200">
                {
                  viajes.filter(
                    (v) => v.estado !== "Entregado" && v.estado !== "Pendiente"
                  ).length
                }{" "}
                activos
              </span>

              <div className="flex gap-3 text-xs font-semibold text-gray-500 dark:text-[#C7D2E3]">
                <span className="inline-flex items-center gap-1">
                  <i className="w-2.5 h-2.5 rounded-full bg-green-500" /> En tiempo
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Retraso
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="w-2.5 h-2.5 rounded-full bg-red-500" /> Crítico
                </span>
              </div>
            </div>
          </div>

          <div className="relative h-[420px] overflow-hidden bg-gradient-to-br from-[#f5f8fc] via-[#eef3f8] to-[#e8eef6] dark:from-[#0E1726] dark:via-[#111C2D] dark:to-[#0C1523]">
            <div className="pointer-events-none absolute inset-0 opacity-[0.22]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, #94a3b8 1px, transparent 0)",
                backgroundSize: "24px 24px",
              }}
            />

            <svg
              className="absolute inset-0 h-full w-full opacity-45"
              viewBox="0 0 1000 420"
              preserveAspectRatio="none"
            >
              <path
                d="M 60 95 Q 230 25 410 155 T 900 125"
                stroke="#94a3b8"
                strokeWidth="2"
                fill="none"
                strokeDasharray="7,7"
              />
              <path
                d="M 95 310 Q 330 405 760 245"
                stroke="#94a3b8"
                strokeWidth="2"
                fill="none"
                strokeDasharray="7,7"
              />
              <path
                d="M 170 215 Q 390 115 880 325"
                stroke="#0C2D6B"
                strokeWidth="2"
                fill="none"
                opacity=".32"
              />
            </svg>

            {viajes
              .filter((v) => v.estado !== "Entregado" && v.estado !== "Pendiente")
              .slice(0, 8)
              .map((viaje, index) => {
                const positions = [
                  { top: 24, left: 12 },
                  { top: 45, left: 28 },
                  { top: 67, left: 12 },
                  { top: 67, left: 44 },
                  { top: 24, left: 74 },
                  { top: 45, left: 88 },
                  { top: 83, left: 60 },
                  { top: 83, left: 28 },
                ];

                const pos = positions[index % positions.length];
                const alignLeft = pos.left >= 74;
                const popupAbove = pos.top >= 63;

                const marker =
                  viaje.estado === "Crítico"
                    ? "bg-red-500"
                    : viaje.estado === "Retraso"
                    ? "bg-orange-500"
                    : "bg-green-500";

                const markerRing =
                  viaje.estado === "Crítico"
                    ? "ring-red-100"
                    : viaje.estado === "Retraso"
                    ? "ring-orange-100"
                    : "ring-green-100";

                return (
                  <button
                    type="button"
                    key={viaje.id}
                    onClick={() => openViewViaje(viaje)}
                    onMouseEnter={() => setHoveredViajeId(viaje.id)}
                    onMouseLeave={() => setHoveredViajeId(null)}
                    onFocus={() => setHoveredViajeId(viaje.id)}
                    onBlur={() => setHoveredViajeId(null)}
                    className="absolute z-10 group hover:z-[80] focus:z-[80] focus-visible:z-[80]"
                    style={{
                      top: `${pos.top}%`,
                      left: `${pos.left}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                    title={`Abrir ${viaje.codigo}`}
                  >
                    <span className="relative flex items-center">
                      <span
                        className={`block h-5 w-5 rounded-full border-2 border-white shadow-md ring-4 ${markerRing} ${marker} ${
                          viaje.estado === "En tránsito" ? "animate-pulse" : ""
                        }`}
                      />

                      <span
                        className={`absolute top-1/2 -translate-y-1/2 max-w-[116px] truncate whitespace-nowrap rounded-lg border border-gray-200 bg-white/95 px-2 py-1 text-[10px] font-extrabold text-[#0C2D6B] shadow-md backdrop-blur-sm dark:border-[#40516A] dark:bg-[#172337]/95 dark:text-[#F4F8FF] dark:shadow-[0_8px_20px_rgba(0,0,0,0.28)] transition-opacity duration-150 ${
                          alignLeft ? "right-7" : "left-7"
                        } ${
                          hoveredViajeId !== null && hoveredViajeId !== viaje.id
                            ? "opacity-0"
                            : "opacity-100"
                        }`}
                      >
                        {viaje.codigo}
                      </span>
                    </span>

                    <span
                      className={`absolute z-[90] w-56 rounded-2xl border border-gray-100 bg-white p-3.5 text-left shadow-2xl ring-8 ring-white/80 opacity-0 scale-[0.98] transition-all duration-150 pointer-events-none group-hover:opacity-100 group-hover:scale-100 ${
                        alignLeft ? "right-0" : "left-0"
                      } ${popupAbove ? "bottom-9" : "top-9"}`}
                    >
                      <span className="mb-2 flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <b className="block truncate text-xs text-[#0C2D6B]">
                            {viaje.codigo}
                          </b>
                          <span className="mt-0.5 block truncate text-[10px] font-semibold text-gray-500">
                            {viaje.unidad}
                          </span>
                        </span>

                        <span
                          className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${marker}`}
                        />
                      </span>

                      <span className="block truncate text-[11px] font-semibold text-gray-700">
                        {viaje.piloto}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-gray-500">
                        {viaje.cliente}
                      </span>
                      <span className="mt-1 block truncate text-[10px] text-gray-400">
                        {viaje.ruta}
                      </span>

                      <span className="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <span
                          className={`block h-full rounded-full ${marker}`}
                          style={{ width: `${Math.min(100, Number(viaje.progreso || 0))}%` }}
                        />
                      </span>

                      <span className="mt-1.5 flex items-center justify-between text-[10px] font-bold">
                        <span className="text-gray-600">{viaje.estado}</span>
                        <span className="text-[#0C2D6B]">{viaje.progreso || 0}%</span>
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
                  className={`w-full text-left rounded-xl border bg-white dark:bg-[#151F2F] dark:border-[#334155] p-3 shadow-sm border-l-4 ${
                    alert.type === "error" ? "border-l-red-500" : "border-l-orange-500"
                  } hover:shadow-md transition-shadow`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <b className="text-sm text-gray-800 dark:text-[#F8FAFC]">{alert.title}</b>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      alert.type === "error" ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-600"
                    }`}>
                      {alert.type === "error" ? "CRÍTICO" : "ALERTA"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-[#B7C4D8] mt-1 leading-relaxed">{alert.desc}</p>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <section id="logistica-viajes" className="scroll-mt-[166px]">
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
              <Package className="w-3.5 h-3.5" /> Ir a Servicios
            </button>
            <button type="button" onClick={goToTop} className="h-8 px-3 rounded-lg bg-gray-50 text-gray-600 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-gray-100">
              <ArrowUp className="w-3.5 h-3.5" /> Volver arriba
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {paginatedViajes.map((viaje) => (
            <article key={viaje.id} className="bg-white dark:bg-[#111827] rounded-2xl border border-gray-100 dark:border-[#2A3950] shadow-sm overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span className="font-mono font-bold text-[#0C2D6B] dark:text-[#DDE9FF] bg-gray-50 dark:bg-[#172337] px-3 py-1 rounded-lg text-xs">{viaje.codigo}</span>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${getEstadoColor(viaje.estado)}`}>
                    {viaje.estado}
                  </span>
                </div>

                <h3 className="font-bold text-gray-800 dark:text-[#F8FAFC] text-sm leading-5 min-h-[40px] line-clamp-2">{viaje.ruta}</h3>

                <div className="grid grid-cols-2 gap-3 text-xs mt-4">
                  <div>
                    <p className="text-gray-400 font-semibold">Unidad</p>
                    <p className="font-bold text-gray-700 dark:text-[#DCE5F1] mt-0.5">{viaje.unidad}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 font-semibold">Piloto</p>
                    <p className="font-bold text-gray-700 dark:text-[#DCE5F1] mt-0.5 line-clamp-2">{viaje.piloto}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 font-semibold">Cliente</p>
                    <p className="font-bold text-gray-700 dark:text-[#DCE5F1] mt-0.5 line-clamp-2">{viaje.cliente}</p>
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
                  <div className="h-2 rounded-full bg-gray-100 dark:bg-[#253248] overflow-hidden">
                    <div className={`h-full rounded-full ${getProgressColor(viaje.estado)}`} style={{ width: `${viaje.progreso || 0}%` }} />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 dark:border-[#263244] bg-gray-50 dark:bg-[#0F1929] px-3 py-2 flex justify-between gap-2">
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

      <section id="logistica-registros" className="scroll-mt-[166px]">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 border-b border-gray-200 mb-4 overflow-visible">
          <div className="flex flex-wrap gap-6">
          <div className="pb-3">
            <button
              type="button"
              onClick={() => setActiveTab("envios")}
              className={`px-2 pb-2 font-bold text-base sm:text-lg border-b-4 ${
                activeTab === "envios"
                  ? "border-[#FF6A00] text-[#0C2D6B]"
                  : "border-transparent text-gray-500"
              }`}
            >
              Servicios de Transporte
            </button>
            <p className="mt-2 px-2 text-xs text-gray-500">
              Solicitudes del cliente: origen, destino y fecha. Después se asignan a un viaje con unidad y piloto.
            </p>
          </div>
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
          <div id="logistica-envios" className="scroll-mt-[166px]">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 overflow-hidden">
              <div className="flex min-w-0 flex-wrap xl:flex-nowrap items-center gap-2.5">
                {/* Búsqueda: flexible para absorber el espacio disponible */}
                <div className="relative min-w-[220px] flex-[1_1_260px]">
                  <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    value={searchEnvios}
                    onChange={(e) => setSearchEnvios(e.target.value)}
                    placeholder="Código, cliente, origen..."
                    className="w-full h-11 rounded-xl bg-white border border-gray-200 pl-12 pr-3 text-sm outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20"
                  />
                </div>

                <div className="relative w-[180px] shrink-0">
                  <Filter className="w-4.5 h-4.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <select
                    value={filterEstadoEnvio}
                    onChange={(e) => setFilterEstadoEnvio(e.target.value)}
                    className="w-full h-11 rounded-xl bg-white border border-gray-200 pl-10 pr-8 text-sm outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20"
                  >
                    {estadosFiltro.map((estado) => (
                      <option key={estado} value={estado}>
                        {estado === "Todos" ? "Todos los estados" : estado}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative w-[195px] shrink-0">
                  <Filter className="w-4.5 h-4.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <select
                    value={filterClienteEnvio}
                    onChange={(e) => setFilterClienteEnvio(e.target.value)}
                    className="w-full h-11 rounded-xl bg-white border border-gray-200 pl-10 pr-8 text-sm outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20"
                  >
                    {clientesFiltro.map((cliente) => (
                      <option key={cliente} value={cliente}>
                        {cliente === "Todos" ? "Todos los clientes" : cliente}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={resetEnvioFilters}
                  className="h-11 shrink-0 px-3.5 rounded-xl border border-orange-200 bg-white text-sm font-bold text-[#FF6A00] inline-flex items-center justify-center gap-1.5 shadow-sm hover:border-[#FF6A00] hover:bg-orange-50 whitespace-nowrap"
                >
                  <X className="w-4 h-4" /> Limpiar
                </button>

                <div className="hidden xl:block flex-1 min-w-0" />

                <button
                  type="button"
                  onClick={openCreateEnvio}
                  className="h-11 shrink-0 px-4 rounded-xl bg-[#0C2D6B] text-white font-bold text-sm inline-flex items-center gap-2 whitespace-nowrap shadow-md hover:bg-[#143C8C] transition-colors"
                >
                  <Plus className="w-4 h-4" /> Nuevo Servicio
                </button>

                <button
                  type="button"
                  onClick={exportEnviosPDF}
                  className="h-11 shrink-0 px-3.5 rounded-xl bg-red-500 text-white font-bold text-sm inline-flex items-center gap-1.5 whitespace-nowrap shadow-sm hover:bg-red-600"
                  title="Exportar servicios a PDF"
                >
                  <FileText className="w-4 h-4" /> PDF
                </button>

                <button
                  type="button"
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
                      "Servicios",
                      "Servicios_Transporte"
                    )
                  }
                  className="h-11 shrink-0 px-3.5 rounded-xl bg-[#22C55E] text-white font-bold text-sm inline-flex items-center gap-1.5 whitespace-nowrap shadow-sm hover:bg-[#16A34A]"
                  title="Exportar servicios a Excel"
                >
                  <Download className="w-4 h-4" /> Excel
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-3">
                <span className="text-xs font-bold uppercase text-gray-400">Ordenar por:</span>
                <SortChip field="codigo" label="Código" activeField={sortEnvioField} direction={sortEnvioDirection} setField={setSortEnvioField} setDirection={setSortEnvioDirection} />
                <SortChip field="cliente" label="Cliente" activeField={sortEnvioField} direction={sortEnvioDirection} setField={setSortEnvioField} setDirection={setSortEnvioDirection} />
                <SortChip field="origen" label="Origen" activeField={sortEnvioField} direction={sortEnvioDirection} setField={setSortEnvioField} setDirection={setSortEnvioDirection} />
                <SortChip field="destino" label="Destino" activeField={sortEnvioField} direction={sortEnvioDirection} setField={setSortEnvioField} setDirection={setSortEnvioDirection} />
                <SortChip field="fecha" label="Fecha" activeField={sortEnvioField} direction={sortEnvioDirection} setField={setSortEnvioField} setDirection={setSortEnvioDirection} />
                <span className="ml-0 lg:ml-auto text-sm font-bold text-gray-400">
                  {sortedEnvios.length} de {envios.length} servicios visibles
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {paginatedEnvios.map((envio) => (
                <article key={envio.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="bg-[#0C2D6B] p-4 text-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-sm">{envio.codigo}</span>
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-100">
                            Servicio solicitado
                          </span>
                        </div>
                        <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-blue-200">
                          Cliente
                        </p>
                        <h3 className="mt-0.5 font-bold text-base leading-5 line-clamp-2">
                          {envio.cliente}
                        </h3>
                      </div>

                      <span
                        className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold border ${getEstadoColor(
                          envio.estado
                        )}`}
                      >
                        {envio.estado}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
                      <div className="grid grid-cols-[18px_1fr] gap-x-2 gap-y-2">
                        <MapPin className="mt-0.5 h-4 w-4 text-[#FF6A00]" />

                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                            Origen
                          </p>
                          <p className="truncate text-sm font-bold text-gray-800">
                            {envio.origen}
                          </p>
                        </div>

                        <Navigation className="mt-0.5 h-4 w-4 text-[#0C2D6B]" />

                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                            Destino
                          </p>
                          <p className="truncate text-sm font-bold text-gray-800">
                            {envio.destino}
                          </p>
                        </div>
                      </div>

                      <div className="mt-2 border-t border-dashed border-gray-200 pt-2">
                        <p className="text-[10px] text-gray-400">
                          La ruta se genera automáticamente con este origen y destino.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Building2 className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">Dirección del servicio</p>
                        <p className="text-sm text-gray-800 line-clamp-2">{envio.direccion || "-"}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Clock className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Fecha solicitada</p>
                        <p className="text-sm font-semibold">{formatDate(envio.fecha)}</p>
                      </div>
                    </div>

                    {envio.observaciones && (
                      <div className="rounded-xl bg-blue-50/70 p-3">
                        <p className="text-xs font-semibold text-[#0C2D6B]">
                          Observaciones del servicio
                        </p>
                        <p className="mt-1 text-sm text-gray-700 line-clamp-2">
                          {envio.observaciones}
                        </p>
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
                No se encontraron servicios de transporte.
              </div>
            )}

            <PaginationControls
              page={envioPage}
              totalPages={envioTotalPages}
              rowsPerPage={envioRowsPerPage}
              totalItems={sortedEnvios.length}
              itemLabel="servicios filtrados"
              onPageChange={setEnvioPage}
              onRowsPerPageChange={setEnvioRowsPerPage}
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

                <Field label="Cliente *" error={viajeErrors.cliente_id} actionLabel="Nuevo cliente" onAction={() => openQuick("cliente", "viaje_cliente")}>
                  <SearchableSelect
                    value={viajeForm.cliente_id}
                    options={clientes}
                    placeholder="Buscar cliente..."
                    getLabel={(item) => `${item.codigo_cliente} · ${item.nombre_empresa}`}
                    onSelect={(item) =>
                      setViajeForm({
                        ...viajeForm,
                        cliente_id: item.id,
                        envio_id: "",
                        ruta_id: "",
                      })
                    }
                  />
                </Field>

                <Field label="Servicio relacionado *" error={viajeErrors.envio_id} actionLabel="Nuevo servicio" onAction={openCreateEnvioFromViaje}>
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
                                Este cliente aún no tiene servicios registrados
                              </p>
                              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                                Para crear un viaje primero se debe registrar el servicio del cliente
                                {clienteSeleccionado ? ` ${clienteSeleccionado.nombre_empresa}` : ""}. Luego regresá a Nuevo Viaje y seleccioná ese servicio.
                              </p>

                              <button
                                type="button"
                                onClick={openCreateEnvioFromViaje}
                                className="mt-3 h-10 px-4 rounded-xl bg-[#0C2D6B] text-white text-sm font-bold inline-flex items-center gap-2"
                              >
                                <Plus className="w-4 h-4" />
                                Registrar servicio primero
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
                        placeholder={viajeForm.cliente_id ? "Buscar servicio del cliente..." : "Primero seleccioná un cliente"}
                        getLabel={(item) => `${item.codigo} · ${item.origen} → ${item.destino}`}
                        getSubLabel={(item) => item.cliente}
                        onSelect={(item) => {
                          const rutaCoincidente =
                            rutas.find(
                              (ruta) =>
                                Number(ruta.id) === Number(item.ruta_id)
                            ) ||
                            rutas.find(
                              (ruta) =>
                                Number(ruta.origen_id) === Number(item.origen_id) &&
                                Number(ruta.destino_id) === Number(item.destino_id)
                            );

                          setViajeForm({
                            ...viajeForm,
                            envio_id: item.id,
                            cliente_id: item.cliente_id,
                            ruta_id: item.ruta_id || rutaCoincidente?.id || "",
                          });
                        }}
                        error={viajeErrors.envio_id}
                      />
                    );
                  })()}
                </Field>

                <Field label="Ruta del servicio">
                  {(() => {
                    const envioSeleccionado = envios.find(
                      (envio) => Number(envio.id) === Number(viajeForm.envio_id)
                    );

                    const rutaSeleccionada =
                      rutas.find(
                        (ruta) => Number(ruta.id) === Number(viajeForm.ruta_id)
                      ) ||
                      rutas.find(
                        (ruta) =>
                          Number(ruta.origen_id) === Number(envioSeleccionado?.origen_id) &&
                          Number(ruta.destino_id) === Number(envioSeleccionado?.destino_id)
                      );

                    if (!envioSeleccionado) {
                      return (
                        <div className="min-h-[54px] rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-400 flex items-center">
                          Primero seleccioná un servicio relacionado
                        </div>
                      );
                    }

                    return (
                      <div className="min-h-[54px] rounded-2xl border border-blue-100 bg-blue-50 px-4 py-2.5">
                        <div className="flex items-start gap-2">
                          <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-[#0C2D6B]" />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#0C2D6B]">
                              {rutaSeleccionada?.codigo_ruta
                                ? `${rutaSeleccionada.codigo_ruta} · ${rutaLabel(rutaSeleccionada)}`
                                : `${envioSeleccionado.origen} → ${envioSeleccionado.destino}`}
                            </p>
                            <p className="mt-0.5 text-[11px] text-gray-500">
                              {rutaSeleccionada
                                ? `Ruta tomada automáticamente del servicio${
                                    rutaSeleccionada.distancia_km
                                      ? ` · ${rutaSeleccionada.distancia_km} km`
                                      : ""
                                  }.`
                                : "La ruta todavía no existe; GL365 la creará automáticamente al guardar el viaje."}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </Field>

                <Field label="Unidad *" error={viajeErrors.unidad_id} actionLabel="Nueva unidad" onAction={() => openQuick("unidad", "viaje_unidad")}>
                  <SearchableSelect
                    value={viajeForm.unidad_id}
                    options={unidades}
                    placeholder="Buscar unidad..."
                    getLabel={(item) => `${item.codigo} · ${item.tipo}`}
                    onSelect={(item) => setViajeForm({ ...viajeForm, unidad_id: item.id })}
                    error={viajeErrors.unidad_id}
                  />
                </Field>

                <Field label="Piloto *" error={viajeErrors.piloto_id} actionLabel="Nuevo piloto" onAction={() => openQuick("piloto", "viaje_piloto")}>
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
          title={
            envioModal.mode === "view"
              ? "Detalle del Servicio de Transporte"
              : envioModal.mode === "create"
              ? "Nuevo Servicio de Transporte"
              : "Editar Servicio de Transporte"
          }
          onClose={() => { setEnvioModal({ open: false, mode: "create" }); setEnvioFromViaje(false); }}
        >
          {envioModal.mode === "view" && currentEnvio ? (
            <ViewEnvio envio={currentEnvio} />
          ) : (
            <div data-form onKeyDown={moveOnEnter}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
                {envioErrors.general && <div className="md:col-span-2 rounded-xl bg-red-50 text-red-700 p-3 text-sm font-semibold">{envioErrors.general}</div>}

                <Field label="Cliente *" error={envioErrors.cliente_id} className="md:col-span-2" actionLabel="Nuevo cliente" onAction={() => openQuick("cliente", "envio_cliente")}>
                  <SearchableSelect
                    value={envioForm.cliente_id}
                    options={clientes}
                    placeholder="Buscar cliente..."
                    getLabel={(item) => `${item.codigo_cliente} · ${item.nombre_empresa}`}
                    onSelect={(item) => setEnvioForm({ ...envioForm, cliente_id: item.id })}
                    error={envioErrors.cliente_id}
                  />
                </Field>

                <Field label="Origen *" error={envioErrors.origen_id} actionLabel="Nuevo origen" onAction={() => openQuick("ubicacion", "envio_origen")}>
                  <SearchableSelect
                    value={envioForm.origen_id}
                    options={ubicaciones}
                    placeholder="Buscar origen..."
                    getLabel={(item) => `${item.nombre_ubicacion}, ${item.pais}`}
                    onSelect={(item) => setEnvioForm({ ...envioForm, origen_id: item.id })}
                    error={envioErrors.origen_id}
                  />
                </Field>

                <Field label="Destino *" error={envioErrors.destino_id} actionLabel="Nuevo destino" onAction={() => openQuick("ubicacion", "envio_destino")}>
                  <SearchableSelect
                    value={envioForm.destino_id}
                    options={ubicaciones}
                    placeholder="Buscar destino..."
                    getLabel={(item) => `${item.nombre_ubicacion}, ${item.pais}`}
                    onSelect={(item) => setEnvioForm({ ...envioForm, destino_id: item.id })}
                    error={envioErrors.destino_id}
                  />
                </Field>

                <div className="md:col-span-2 -mt-1">
                  {(() => {
                    if (!envioForm.origen_id || !envioForm.destino_id) {
                      return (
                        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500">
                          Seleccioná origen y destino. GL365 utilizará esos datos para asociar la ruta del servicio.
                        </div>
                      );
                    }

                    const rutaExistente = rutas.find(
                      (ruta) =>
                        Number(ruta.origen_id) === Number(envioForm.origen_id) &&
                        Number(ruta.destino_id) === Number(envioForm.destino_id)
                    );

                    const origen = ubicaciones.find(
                      (ubicacion) => Number(ubicacion.id) === Number(envioForm.origen_id)
                    );

                    const destino = ubicaciones.find(
                      (ubicacion) => Number(ubicacion.id) === Number(envioForm.destino_id)
                    );

                    return (
                      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                        <div className="flex items-start gap-2">
                          <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-[#0C2D6B]" />
                          <div>
                            <p className="text-xs font-bold text-[#0C2D6B]">
                              Ruta automática: {origen?.nombre_ubicacion || "Origen"} → {destino?.nombre_ubicacion || "Destino"}
                            </p>
                            <p className="mt-1 text-[11px] text-gray-500">
                              {rutaExistente
                                ? `Ya existe ${rutaExistente.codigo_ruta}; se reutilizará automáticamente.`
                                : "No existe todavía. Al guardar el servicio se creará una nueva ruta automáticamente y quedará disponible para los viajes."}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

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
                    lang="es-GT"
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

              <ModalFooter onCancel={() => { setEnvioModal({ open: false, mode: "create" }); setEnvioFromViaje(false); }} onSave={saveEnvio} />
            </div>
          )}
        </Modal>
      )}


      {quickModal && (
        <Modal title={quickModal.type === "cliente" ? "Nuevo Cliente" : quickModal.type === "ruta" ? "Nueva Ruta" : quickModal.type === "unidad" ? "Nueva Unidad" : quickModal.type === "piloto" ? "Nuevo Piloto" : "Nueva Ubicación"} onClose={closeQuick}>
          <div data-form onKeyDown={moveOnEnter}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
              {quickError && <div className="md:col-span-2 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{quickError}</div>}

              {quickModal.type === "cliente" && (
                <>
                  <Field label="Nombre de empresa *" className="md:col-span-2">
                    <input value={quickForm.nombre_empresa || ""} onChange={(e) => setQuickForm({ ...quickForm, nombre_empresa: cleanCommercial(e.target.value, 120) })} className={inputClass} placeholder="Nombre o razón social" />
                  </Field>
                  <Field label="NIT *">
                    <input value={quickForm.nit || ""} onChange={(e) => setQuickForm({ ...quickForm, nit: e.target.value.replace(/[^0-9Kk-]/g, "").slice(0, 20) })} className={inputClass} placeholder="NIT" />
                  </Field>
                  <Field label="Dirección">
                    <input value={quickForm.direccion || ""} onChange={(e) => setQuickForm({ ...quickForm, direccion: cleanAddress(e.target.value, 180) })} className={inputClass} placeholder="Dirección" />
                  </Field>
                </>
              )}

              {quickModal.type === "ubicacion" && (
                <>
                  <Field label="Nombre de ubicación *">
                    <input value={quickForm.nombre_ubicacion || ""} onChange={(e) => setQuickForm({ ...quickForm, nombre_ubicacion: cleanCommercial(e.target.value, 100) })} className={inputClass} placeholder="Ej. Fraijanes" />
                  </Field>
                  <Field label="País *">
                    <input value={quickForm.pais || "Guatemala"} onChange={(e) => setQuickForm({ ...quickForm, pais: cleanLetters(e.target.value, 60) })} className={inputClass} />
                  </Field>
                </>
              )}

              {quickModal.type === "ruta" && (
                <>
                  <Field label="Origen *">
                    <SearchableSelect value={quickForm.origen_id} options={ubicaciones} placeholder="Buscar origen..." getLabel={(item) => `${item.nombre_ubicacion}, ${item.pais}`} onSelect={(item) => setQuickForm({ ...quickForm, origen_id: item.id })} />
                  </Field>
                  <Field label="Destino *">
                    <SearchableSelect value={quickForm.destino_id} options={ubicaciones} placeholder="Buscar destino..." getLabel={(item) => `${item.nombre_ubicacion}, ${item.pais}`} onSelect={(item) => setQuickForm({ ...quickForm, destino_id: item.id })} />
                  </Field>
                  <Field label="Nombre de ruta" className="md:col-span-2">
                    <input value={quickForm.nombre_ruta || ""} onChange={(e) => setQuickForm({ ...quickForm, nombre_ruta: cleanCommercial(e.target.value, 80) })} className={inputClass} placeholder="Se genera automáticamente si lo dejás vacío" />
                  </Field>
                  <Field label="Distancia (km)">
                    <input inputMode="decimal" value={quickForm.distancia_km || ""} onChange={(e) => setQuickForm({ ...quickForm, distancia_km: cleanDecimal(e.target.value, 7, 2) })} className={inputClass} placeholder="Opcional" />
                  </Field>
                </>
              )}

              {quickModal.type === "unidad" && (
                <>
                  <Field label="Código">
                    <input value={quickForm.codigo || ""} onChange={(e) => setQuickForm({ ...quickForm, codigo: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20) })} className={inputClass} placeholder="Automático si queda vacío" />
                  </Field>
                  <Field label="Tipo de unidad *">
                    <input value={quickForm.tipo || ""} onChange={(e) => setQuickForm({ ...quickForm, tipo: cleanCommercial(e.target.value, 40) })} className={inputClass} placeholder="Ej. Furgón 53 pies" />
                  </Field>
                </>
              )}

              {quickModal.type === "piloto" && (
                <>
                  <Field label="Primer nombre *"><input value={quickForm.primer_nombre || ""} onChange={(e) => setQuickForm({ ...quickForm, primer_nombre: cleanLetters(e.target.value, 30) })} className={inputClass} /></Field>
                  <Field label="Segundo nombre"><input value={quickForm.segundo_nombre || ""} onChange={(e) => setQuickForm({ ...quickForm, segundo_nombre: cleanLetters(e.target.value, 30) })} className={inputClass} /></Field>
                  <Field label="Primer apellido *"><input value={quickForm.primer_apellido || ""} onChange={(e) => setQuickForm({ ...quickForm, primer_apellido: cleanLetters(e.target.value, 35) })} className={inputClass} /></Field>
                  <Field label="Segundo apellido"><input value={quickForm.segundo_apellido || ""} onChange={(e) => setQuickForm({ ...quickForm, segundo_apellido: cleanLetters(e.target.value, 35) })} className={inputClass} /></Field>
                  <Field label="Licencia *" className="md:col-span-2"><input value={quickForm.licencia || ""} onChange={(e) => setQuickForm({ ...quickForm, licencia: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 25) })} className={inputClass} placeholder="Número de licencia" /></Field>
                </>
              )}
            </div>
            <ModalFooter onCancel={closeQuick} onSave={saveQuick} />
          </div>
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
              {isDanger ? <Trash2 className="w-7 h-7" /> : <AlertTriangle className="w-7 h-7" />}
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
          <p className="text-xs text-gray-400 mt-1">{viaje.codigo} · Servicio {viaje.envio_codigo || viaje.envio_id}</p>
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
        <Info
          label="Salida"
          value={(() => {
            const local = toDateTimeInput(viaje.fecha_salida || viaje.fechaSalida);
            if (!local) return "-";
            const [date, time] = local.split("T");
            return `${formatDate(date)} ${time}`;
          })()}
        />
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
        <Info label="Ruta" value={
          envio.codigo_ruta
            ? `${envio.codigo_ruta} · ${envio.ruta_texto || `${envio.origen} → ${envio.destino}`}`
            : `${envio.origen} → ${envio.destino}`
        } />
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

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide font-bold mb-1">{label}</p>
      <p className="text-sm font-semibold text-gray-800 break-words">{value || "-"}</p>
    </div>
  );
}