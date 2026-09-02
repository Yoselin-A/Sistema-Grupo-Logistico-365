import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  CheckCircle,
  DollarSign,
  Download,
  Edit2,
  Eye,
  FileText,
  Filter,
  History,
  MapPin,
  Navigation,
  Plus,
  RefreshCw,
  Route as RouteIcon,
  Search,
  Trash2,
  X,
} from "lucide-react";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import logoImage from "../../assets/614cb11181e5d72cb3a39a09d833f4775b7fc7ce.png";

const API_BASE_URL = "/api";

type Modo = "nuevo" | "ver" | "editar" | null;
type LocationTarget = "origen" | "destino" | null;
type FormErrors = Record<string, string>;
type AnyRow = Record<string, any>;
type SortDirection = "asc" | "desc";

interface Ubicacion {
  id: number;
  codigo_ubicacion: string;
  nombre_ubicacion: string;
  pais: string;
}

interface FrecuenciaRuta {
  id: number;
  codigo_frecuencia: string;
  nombre_frecuencia_ruta: string;
}

interface EstadoRuta {
  id: number;
  codigo_estado: string;
  nombre_estado_ruta: string;
}

interface Ruta {
  id: number;
  codigo_ruta: string;
  nombre_ruta: string;
  origen_id: number | null;
  destino_id: number | null;
  distancia_km: number | string | null;
  tiempo: number | string | null;
  costo: number | string | null;
  frecuencia_id: number | null;
  estado_id: number | null;
  created_at?: string;
  updated_at?: string;

  origen_codigo?: string;
  origen_nombre?: string;
  origen_pais?: string;
  destino_codigo?: string;
  destino_nombre?: string;
  destino_pais?: string;
  frecuencia?: string;
  estado?: string;
  ruta_texto?: string;
}

interface RutaHistorial {
  id: number;
  ruta_id: number;
  costo: number | string | null;
  fecha: string | null;
  codigo_ruta?: string;
}

interface LocationForm {
  codigo_ubicacion: string;
  nombre_ubicacion: string;
  pais: string;
}

type RouteEstimate = {
  distancia_km: string;
  tiempo: string;
  source: "existente" | "coordenadas";
  label: string;
};

const inputClass =
  "w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/10 disabled:bg-gray-100 disabled:text-gray-500";
const labelClass = "block text-xs font-bold text-gray-600 mb-1.5";
const errorInput = "border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-100";

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

const normalize = (value: any) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const titleCase = (value: string) =>
  value
    .trimStart()
    .toLocaleLowerCase("es-GT")
    .replace(
      /(^|[\s'-])([a-záéíóúüñ])/g,
      (_m, sep, letter) => `${sep}${letter.toLocaleUpperCase("es-GT")}`
    )
    .replace(/\bGL365\b/gi, "GL365")
    .replace(/\bKm\b/g, "Km")
    .replace(/\bA30\b/gi, "A30");

const cleanCode = (value: string, max = 12) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, max);

const cleanLocationName = (value: string, max = 120) =>
  titleCase(
    value
      .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s.,#&()'/-]/g, "")
      .replace(/\s+/g, " ")
  ).slice(0, max);

const cleanPais = (value: string, max = 60) =>
  titleCase(
    value
      .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'-]/g, "")
      .replace(/\s+/g, " ")
  ).slice(0, max);

const cleanDecimal = (value: string, maxInteger = 8, maxDecimals = 2) => {
  const parts = value.replace(/[^0-9.]/g, "").split(".");
  const integer = parts[0].slice(0, maxInteger);
  const decimals = parts.slice(1).join("").slice(0, maxDecimals);
  return parts.length > 1 ? `${integer}.${decimals}` : integer;
};

const numeric = (value: any) => {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

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

const formatMoney = (value: any) =>
  new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
  }).format(numeric(value));

const formatNumber = (value: any, decimals = 2) =>
  numeric(value).toLocaleString("es-GT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });

const splitDuration = (value: any) => {
  const totalMinutes = Math.max(0, Math.round(numeric(value) * 60));
  return {
    horas: Math.floor(totalMinutes / 60),
    minutos: totalMinutes % 60,
  };
};

const durationToDecimal = (horas: any, minutos: any) => {
  const cleanHours = Math.max(
    0,
    Number(String(horas ?? "").replace(/\D/g, "")) || 0
  );

  const cleanMinutes = Math.min(
    59,
    Math.max(0, Number(String(minutos ?? "").replace(/\D/g, "")) || 0)
  );

  return Number(((cleanHours * 60 + cleanMinutes) / 60).toFixed(2));
};

const formatDuration = (value: any) => {
  const { horas, minutos } = splitDuration(value);

  if (horas === 0 && minutos === 0) return "0 h 0 min";
  if (horas === 0) return `${minutos} min`;
  if (minutos === 0) return `${horas} h`;

  return `${horas} h ${minutos} min`;
};

const cleanHours = (value: string) => value.replace(/\D/g, "").slice(0, 3);

const cleanMinutes = (value: string) => {
  const clean = value.replace(/\D/g, "").slice(0, 2);
  if (clean === "") return "";
  return String(Math.min(59, Number(clean)));
};

const dateText = (value: any) => {
  const text = String(value || "");
  return text ? text.slice(0, 10) : "-";
};

const estadoTone = (estado: string) => {
  const text = normalize(estado);

  if (text.includes("activa")) {
    return "bg-green-100 text-green-700 border-green-200";
  }

  if (text.includes("inactiva")) {
    return "bg-gray-100 text-gray-600 border-gray-200";
  }

  return "bg-blue-100 text-[#0C2D6B] border-blue-200";
};

const LOCATION_COORDS: Record<string, { lat: number; lng: number }> = {
  "ciudad de guatemala|guatemala": { lat: 14.6349, lng: -90.5069 },
  "guatemala|guatemala": { lat: 14.6349, lng: -90.5069 },
  "zona 12|guatemala": { lat: 14.5852, lng: -90.5486 },
  "zona 3 capital|guatemala": { lat: 14.6417, lng: -90.5269 },
  "villa nueva|guatemala": { lat: 14.5269, lng: -90.5875 },
  "san jose villa nueva|guatemala": { lat: 14.5255, lng: -90.6052 },
  "amatitlan|guatemala": { lat: 14.4875, lng: -90.6153 },
  "a30 amatitlan|guatemala": { lat: 14.4703, lng: -90.6129 },
  "escuintla|guatemala": { lat: 14.3009, lng: -90.7858 },
  "antigua guatemala|guatemala": { lat: 14.5586, lng: -90.7295 },
  "coban|guatemala": { lat: 15.4708, lng: -90.3708 },
  "quetzaltenango|guatemala": { lat: 14.8347, lng: -91.5181 },
  "xela|guatemala": { lat: 14.8347, lng: -91.5181 },
  "retalhuleu|guatemala": { lat: 14.5361, lng: -91.6778 },
  "mazatenango|guatemala": { lat: 14.5342, lng: -91.5033 },
  "huehuetenango|guatemala": { lat: 15.3192, lng: -91.4724 },
  "quiche|guatemala": { lat: 15.0306, lng: -91.1489 },
  "chiquimula|guatemala": { lat: 14.797, lng: -89.5453 },
  "zacapa|guatemala": { lat: 14.9722, lng: -89.5306 },
  "puerto barrios|guatemala": { lat: 15.7308, lng: -88.5944 },
  "flores|guatemala": { lat: 16.9181, lng: -89.8925 },
  "peten|guatemala": { lat: 16.9181, lng: -89.8925 },
  "san marcos|guatemala": { lat: 14.9639, lng: -91.7944 },
  "sanarate|guatemala": { lat: 14.795, lng: -90.1925 },
  "jutiapa|guatemala": { lat: 14.2828, lng: -89.8922 },
  "malacatan san marcos|guatemala": { lat: 14.9107, lng: -92.0576 },
  "km22.4|guatemala": { lat: 14.543, lng: -90.624 },
  "hospital san juan de dios|guatemala": { lat: 14.6393, lng: -90.515 },

  "san salvador|el salvador": { lat: 13.6929, lng: -89.2182 },
  "tegucigalpa|honduras": { lat: 14.0723, lng: -87.1921 },
  "san pedro sula|honduras": { lat: 15.5042, lng: -88.025 },
  "managua|nicaragua": { lat: 12.114, lng: -86.2362 },
  "san jose|costa rica": { lat: 9.9281, lng: -84.0907 },
  "alajuela|costa rica": { lat: 10.0163, lng: -84.2116 },
  "panama|panama": { lat: 8.9824, lng: -79.5199 },
  "ciudad de panama|panama": { lat: 8.9824, lng: -79.5199 },
  "belice|belice": { lat: 17.5046, lng: -88.1962 },

  "ciudad hidalgo|mexico": { lat: 14.6811, lng: -92.149 },
  "tapachula|mexico": { lat: 14.9056, lng: -92.2634 },
  "ciudad de mexico|mexico": { lat: 19.4326, lng: -99.1332 },
  "cdmx|mexico": { lat: 19.4326, lng: -99.1332 },
  "monterrey|mexico": { lat: 25.6866, lng: -100.3161 },
  "laredo|estados unidos": { lat: 27.5036, lng: -99.5076 },
  "houston|estados unidos": { lat: 29.7604, lng: -95.3698 },
  "dallas|estados unidos": { lat: 32.7767, lng: -96.797 },
  "miami|estados unidos": { lat: 25.7617, lng: -80.1918 },
  "los angeles|estados unidos": { lat: 34.0522, lng: -118.2437 },
};

const coordKey = (ubicacion?: Partial<Ubicacion> | null) => {
  if (!ubicacion) return "";
  return `${normalize(ubicacion.nombre_ubicacion)}|${normalize(ubicacion.pais)}`;
};

const getLocationCoord = (ubicacion?: Partial<Ubicacion> | null) => {
  if (!ubicacion) return null;

  const exact = LOCATION_COORDS[coordKey(ubicacion)];
  if (exact) return exact;

  const name = normalize(ubicacion.nombre_ubicacion);
  const country = normalize(ubicacion.pais);

  const foundKey = Object.keys(LOCATION_COORDS).find((key) => {
    const [knownName, knownCountry] = key.split("|");

    return (
      knownCountry === country &&
      (name.includes(knownName) || knownName.includes(name))
    );
  });

  return foundKey ? LOCATION_COORDS[foundKey] : null;
};

const haversineKm = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
};

const roundTo = (value: number, decimals = 2) =>
  Number(value.toFixed(decimals));

const mapsDirectionUrl = (
  origen?: Partial<Ubicacion> | null,
  destino?: Partial<Ubicacion> | null
) => {
  const origenText = origen
    ? `${origen.nombre_ubicacion}, ${origen.pais}`
    : "";

  const destinoText = destino
    ? `${destino.nombre_ubicacion}, ${destino.pais}`
    : "";

  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    origenText
  )}&destination=${encodeURIComponent(destinoText)}`;
};

const estimateRouteData = (
  ruta: Partial<Ruta>,
  ubicaciones: Ubicacion[],
  rutas: Ruta[]
): RouteEstimate | null => {
  const origenId = Number(ruta.origen_id);
  const destinoId = Number(ruta.destino_id);

  if (!origenId || !destinoId || origenId === destinoId) return null;

  const existente = rutas.find((item) => {
    const same =
      Number(item.origen_id) === origenId &&
      Number(item.destino_id) === destinoId &&
      Number(item.id) !== Number(ruta.id || 0);

    return same && numeric(item.distancia_km) > 0 && numeric(item.tiempo) > 0;
  });

  if (existente) {
    return {
      distancia_km: String(roundTo(numeric(existente.distancia_km), 2)),
      tiempo: String(roundTo(numeric(existente.tiempo), 2)),
      source: "existente",
      label: `Usado de la ruta existente ${existente.codigo_ruta}.`,
    };
  }

  const inversa = rutas.find((item) => {
    const same =
      Number(item.origen_id) === destinoId &&
      Number(item.destino_id) === origenId &&
      Number(item.id) !== Number(ruta.id || 0);

    return same && numeric(item.distancia_km) > 0 && numeric(item.tiempo) > 0;
  });

  if (inversa) {
    return {
      distancia_km: String(roundTo(numeric(inversa.distancia_km), 2)),
      tiempo: String(roundTo(numeric(inversa.tiempo), 2)),
      source: "existente",
      label: `Calculado con la ruta inversa ${inversa.codigo_ruta}.`,
    };
  }

  const origen = ubicaciones.find((item) => Number(item.id) === origenId);
  const destino = ubicaciones.find((item) => Number(item.id) === destinoId);

  const coordOrigen = getLocationCoord(origen);
  const coordDestino = getLocationCoord(destino);

  if (!coordOrigen || !coordDestino) return null;

  const directKm = haversineKm(coordOrigen, coordDestino);
  const sameCountry = normalize(origen?.pais) === normalize(destino?.pais);
  const roadFactor = sameCountry ? 1.28 : 1.18;
  const averageSpeed = sameCountry ? 55 : 62;

  const distancia = Math.max(1, directKm * roadFactor);
  const tiempo = distancia / averageSpeed;

  return {
    distancia_km: String(roundTo(distancia, 2)),
    tiempo: String(roundTo(tiempo, 2)),
    source: "coordenadas",
    label:
      "Estimación automática por coordenadas aproximadas. Podés verificarla en Google Maps.",
  };
};

const loadImageDataUrl = async (src: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";

    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;

        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("No se pudo preparar el logo."));
          return;
        }

        context.drawImage(image, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        reject(error);
      }
    };

    image.onerror = () => reject(new Error("No se pudo cargar el logo."));
    image.src = src;
  });

const addCorporatePdfHeader = async (
  doc: jsPDF,
  title: string,
  subtitle: string,
  landscape = false
) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const headerHeight = landscape ? 34 : 38;

  doc.setFillColor(12, 45, 107);
  doc.rect(0, 0, pageWidth, headerHeight, "F");

  try {
    const logo = await loadImageDataUrl(logoImage);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(255, 106, 0);
    doc.setLineWidth(0.7);

    doc.roundedRect(10, 6, landscape ? 44 : 48, 25, 3, 3, "FD");
    doc.addImage(logo, "PNG", 13, 8, landscape ? 38 : 42, 21);
  } catch (error) {
    console.warn("No se pudo agregar el logo al PDF:", error);
  }

  const centerX = landscape ? pageWidth / 2 + 14 : pageWidth / 2 + 18;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 106, 0);
  doc.setFontSize(10);
  doc.text("GRUPO LOGÍSTICO 365", centerX, 11, { align: "center" });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(landscape ? 18 : 17);
  doc.text(title, centerX, 20, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(subtitle, centerX, 27, { align: "center" });

  doc.setDrawColor(255, 106, 0);
  doc.setLineWidth(1);
  doc.line(landscape ? 72 : 70, 31, pageWidth - 12, 31);
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
    const disabled =
      item.hasAttribute("disabled") ||
      item.getAttribute("aria-disabled") === "true";

    const hidden = item.offsetParent === null;
    return !disabled && !hidden;
  });

  const index = fields.indexOf(target);
  const next = fields[index + 1];

  if (next) {
    next.focus();
    return;
  }

  const save = form.querySelector<HTMLButtonElement>(
    "[data-save-button='true']"
  );

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
      {error && (
        <p className="mt-1 text-[11px] font-semibold text-red-600">{error}</p>
      )}
    </div>
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

function Badge({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold ${className}`}
    >
      {children}
    </span>
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
      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm transition-colors ${tones[tone]}`}
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
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
  const selected = options.find(
    (item) => Number(item.id) === Number(value)
  );

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = normalize(query.trim());

    return options
      .filter((item) => {
        const text = normalize(
          `${getLabel(item)} ${getSubLabel?.(item) || ""}`
        );

        return !term || text.includes(term);
      })
      .slice(0, 60);
  }, [options, query, getLabel, getSubLabel]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-[14px] z-10 h-4 w-4 text-gray-400" />

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
        className={`${inputClass} pl-9 ${
          error ? errorInput : ""
        }`}
      />

      {open && !disabled && (
        <div className="absolute z-[130] mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl">
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
              className={`w-full px-3 py-2.5 text-left hover:bg-blue-50 ${
                Number(item.id) === Number(value)
                  ? "bg-blue-50 text-[#0C2D6B]"
                  : "text-gray-700"
              }`}
            >
              <span className="block text-sm font-semibold leading-5">
                {getLabel(item)}
              </span>

              {getSubLabel && (
                <span className="block text-[11px] text-gray-400">
                  {getSubLabel(item)}
                </span>
              )}
            </button>
          ))}

          {!filtered.length && (
            <div className="px-3 py-3 text-sm text-gray-500">
              No se encontró coincidencia.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Rutas() {
  const [modo, setModo] = useState<Modo>(null);
  const [selected, setSelected] = useState<Ruta | null>(null);
  const [deleteModal, setDeleteModal] = useState<Ruta | null>(null);

  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [frecuencias, setFrecuencias] = useState<FrecuenciaRuta[]>([]);
  const [estados, setEstados] = useState<EstadoRuta[]>([]);
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [historial, setHistorial] = useState<RutaHistorial[]>([]);

  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("Todos");
  const [filterFrecuencia, setFilterFrecuencia] = useState("Todos");
  const [sortField, setSortField] = useState("");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("asc");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const [locationModal, setLocationModal] = useState(false);
  const [locationTarget, setLocationTarget] =
    useState<LocationTarget>(null);

  const [locationForm, setLocationForm] = useState<LocationForm>({
    codigo_ubicacion: "",
    nombre_ubicacion: "",
    pais: "Guatemala",
  });

  const [locationErrors, setLocationErrors] =
    useState<FormErrors>({});

  const load = async () => {
    setLoading(true);
    setApiError("");

    try {
      const data = await apiRequest("/rutas/bootstrap");

      setUbicaciones(asArray<Ubicacion>(data.ubicaciones));
      setFrecuencias(asArray<FrecuenciaRuta>(data.frecuenciasRuta));
      setEstados(asArray<EstadoRuta>(data.estadosRuta));
      setRutas(asArray<Ruta>(data.rutas));
      setHistorial(asArray<RutaHistorial>(data.historial));
    } catch (error: any) {
      console.error("Error cargando rutas:", error);

      setApiError(
        error.message || "No se pudo conectar Rutas con MySQL."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3000);
  };

  const sortIcon = (field: string) => {
    if (sortField !== field) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) =>
        prev === "asc" ? "desc" : "asc"
      );

      return;
    }

    setSortField(field);
    setSortDirection("asc");
  };

  const SortChip = ({
    field,
    label,
  }: {
    field: string;
    label: ReactNode;
  }) => (
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
      {label}{" "}
      <span className="ml-1 text-[9px] leading-none">
        {sortIcon(field)}
      </span>
    </button>
  );

  const ubicacionById = (id?: number | null) =>
    ubicaciones.find(
      (item) => Number(item.id) === Number(id)
    );

  const frecuenciaById = (id?: number | null) =>
    frecuencias.find(
      (item) => Number(item.id) === Number(id)
    );

  const estadoById = (id?: number | null) =>
    estados.find((item) => Number(item.id) === Number(id));

  const nombreUbicacion = (id?: number | null) => {
    const u = ubicacionById(id);

    if (!u) return "-";

    return `${u.nombre_ubicacion}, ${u.pais}`;
  };

  const routeName = (ruta: Partial<Ruta>) => {
    const origen =
      ubicacionById(ruta.origen_id)?.nombre_ubicacion ||
      ruta.origen_nombre ||
      "";

    const destino =
      ubicacionById(ruta.destino_id)?.nombre_ubicacion ||
      ruta.destino_nombre ||
      "";

    if (origen && destino) return `${origen} → ${destino}`;

    return ruta.nombre_ruta || ruta.ruta_texto || "Ruta sin definir";
  };

  const activeEstadoId =
    estados.find((estado) =>
      normalize(estado.nombre_estado_ruta).includes("activa")
    )?.id ||
    estados[0]?.id ||
    1;

  const filteredRutas = useMemo(() => {
    const term = normalize(search.trim());

    return rutas.filter((ruta) => {
      const estado =
        ruta.estado ||
        estadoById(ruta.estado_id)?.nombre_estado_ruta ||
        "";

      const frecuencia =
        ruta.frecuencia ||
        frecuenciaById(ruta.frecuencia_id)
          ?.nombre_frecuencia_ruta ||
        "";

      const text = normalize(
        `${ruta.codigo_ruta} ${ruta.nombre_ruta} ${routeName(
          ruta
        )} ${nombreUbicacion(ruta.origen_id)} ${nombreUbicacion(
          ruta.destino_id
        )} ${estado} ${frecuencia}`
      );

      const matchSearch = !term || text.includes(term);

      const matchEstado =
        filterEstado === "Todos" ||
        Number(ruta.estado_id) === Number(filterEstado);

      const matchFrecuencia =
        filterFrecuencia === "Todos" ||
        Number(ruta.frecuencia_id) === Number(filterFrecuencia);

      return matchSearch && matchEstado && matchFrecuencia;
    });
  }, [
    rutas,
    search,
    filterEstado,
    filterFrecuencia,
    ubicaciones,
    frecuencias,
    estados,
  ]);

  const sortedRutas = useMemo(() => {
    const rows = [...filteredRutas];

    rows.sort((a, b) => {
      const estadoA =
        a.estado ||
        estadoById(a.estado_id)?.nombre_estado_ruta ||
        "";

      const estadoB =
        b.estado ||
        estadoById(b.estado_id)?.nombre_estado_ruta ||
        "";

      const frecuenciaA =
        a.frecuencia ||
        frecuenciaById(a.frecuencia_id)
          ?.nombre_frecuencia_ruta ||
        "";

      const frecuenciaB =
        b.frecuencia ||
        frecuenciaById(b.frecuencia_id)
          ?.nombre_frecuencia_ruta ||
        "";

      const origenA = nombreUbicacion(a.origen_id);
      const origenB = nombreUbicacion(b.origen_id);
      const destinoA = nombreUbicacion(a.destino_id);
      const destinoB = nombreUbicacion(b.destino_id);

      const av =
        sortField === "codigo"
          ? a.codigo_ruta
          : sortField === "ruta"
          ? routeName(a)
          : sortField === "origen"
          ? origenA
          : sortField === "destino"
          ? destinoA
          : sortField === "distancia"
          ? numeric(a.distancia_km)
          : sortField === "tiempo"
          ? numeric(a.tiempo)
          : sortField === "costo"
          ? numeric(a.costo)
          : sortField === "frecuencia"
          ? frecuenciaA
          : sortField === "estado"
          ? estadoA
          : "";

      const bv =
        sortField === "codigo"
          ? b.codigo_ruta
          : sortField === "ruta"
          ? routeName(b)
          : sortField === "origen"
          ? origenB
          : sortField === "destino"
          ? destinoB
          : sortField === "distancia"
          ? numeric(b.distancia_km)
          : sortField === "tiempo"
          ? numeric(b.tiempo)
          : sortField === "costo"
          ? numeric(b.costo)
          : sortField === "frecuencia"
          ? frecuenciaB
          : sortField === "estado"
          ? estadoB
          : "";

      return sortField
        ? compareValues(av, bv, sortDirection)
        : 0;
    });

    return rows;
  }, [
    filteredRutas,
    sortField,
    sortDirection,
    ubicaciones,
    frecuencias,
    estados,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedRutas.length / pageSize)
  );

  const paginatedRutas = useMemo(() => {
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * pageSize;

    return sortedRutas.slice(start, start + pageSize);
  }, [sortedRutas, page, pageSize, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    filterEstado,
    filterFrecuencia,
    sortField,
    sortDirection,
    pageSize,
  ]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const kpis = [
    {
      title: "Rutas",
      value: rutas.length,
      icon: RouteIcon,
      bar: "bg-[#0C2D6B]",
    },
    {
      title: "Activas",
      value: rutas.filter((ruta) =>
        normalize(
          ruta.estado ||
            estadoById(ruta.estado_id)?.nombre_estado_ruta
        ).includes("activa")
      ).length,
      icon: CheckCircle,
      bar: "bg-green-500",
    },
    {
      title: "Distancia total",
      value: `${formatNumber(
        rutas.reduce(
          (acc, ruta) => acc + numeric(ruta.distancia_km),
          0
        ),
        0
      )} km`,
      icon: Navigation,
      bar: "bg-blue-500",
    },
    {
      title: "Costo promedio",
      value: formatMoney(
        rutas.length
          ? rutas.reduce(
              (acc, ruta) => acc + numeric(ruta.costo),
              0
            ) / rutas.length
          : 0
      ),
      icon: DollarSign,
      bar: "bg-[#FF6A00]",
    },
  ];

  const clearError = (field: string) =>
    setErrors((prev) => ({
      ...prev,
      [field]: "",
    }));

  const openNuevo = () => {
    setErrors({});

    setSelected({
      id: 0,
      codigo_ruta: "",
      nombre_ruta: "",
      origen_id: null,
      destino_id: null,
      distancia_km: "",
      tiempo: "",
      costo: "",
      frecuencia_id: frecuencias[0]?.id || null,
      estado_id: activeEstadoId,
    });

    setModo("nuevo");
  };

  const openVer = (ruta: Ruta) => {
    setErrors({});
    setSelected({ ...ruta });
    setModo("ver");
  };

  const openEditar = (ruta: Ruta) => {
    setErrors({});
    setSelected({ ...ruta });
    setModo("editar");
  };

  const validate = () => {
    if (!selected) return false;

    const nextErrors: FormErrors = {};

    if (!selected.origen_id) {
      nextErrors.origen_id = "Selecciona el origen.";
    }

    if (!selected.destino_id) {
      nextErrors.destino_id = "Selecciona el destino.";
    }

    if (
      selected.origen_id &&
      selected.destino_id &&
      Number(selected.origen_id) === Number(selected.destino_id)
    ) {
      nextErrors.destino_id =
        "El destino debe ser diferente del origen.";
    }

    if (
      !String(selected.distancia_km ?? "").trim() ||
      numeric(selected.distancia_km) <= 0
    ) {
      nextErrors.distancia_km =
        "Ingresa una distancia válida mayor a 0.";
    }

    if (
      !String(selected.tiempo ?? "").trim() ||
      numeric(selected.tiempo) <= 0
    ) {
      nextErrors.tiempo =
        "Ingresa un tiempo válido mayor a 0.";
    }

    if (
      !String(selected.costo ?? "").trim() ||
      numeric(selected.costo) < 0
    ) {
      nextErrors.costo = "Ingresa un costo válido.";
    }

    if (!selected.frecuencia_id) {
      nextErrors.frecuencia_id = "Selecciona la frecuencia.";
    }

    if (!selected.estado_id) {
      nextErrors.estado_id = "Selecciona el estado.";
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  const saveRuta = async () => {
    if (!selected || !validate()) return;

    try {
      await apiRequest(
        modo === "editar" && selected.id
          ? `/rutas/${selected.id}`
          : "/rutas",
        {
          method: modo === "editar" ? "PUT" : "POST",
          body: JSON.stringify({
            codigo_ruta: selected.codigo_ruta,
            origen_id: selected.origen_id,
            destino_id: selected.destino_id,
            distancia_km: numeric(selected.distancia_km),
            tiempo: numeric(selected.tiempo),
            costo: numeric(selected.costo),
            frecuencia_id: selected.frecuencia_id,
            estado_id: selected.estado_id,
          }),
        }
      );

      const fueNueva = modo === "nuevo";

      setModo(null);
      setSelected(null);
      setErrors({});

      await load();

      showNotice(
        fueNueva
          ? "Ruta guardada correctamente."
          : "Ruta actualizada correctamente."
      );
    } catch (error: any) {
      setErrors({
        general:
          error.message || "No se pudo guardar la ruta.",
      });
    }
  };

  const deleteRuta = async () => {
    if (!deleteModal) return;

    try {
      await apiRequest(`/rutas/${deleteModal.id}`, {
        method: "DELETE",
      });

      const code = deleteModal.codigo_ruta;

      setDeleteModal(null);

      await load();

      showNotice(`Ruta ${code} eliminada correctamente.`);
    } catch (error: any) {
      setDeleteModal(null);

      setApiError(
        error.message || "No se pudo eliminar la ruta."
      );
    }
  };

  const historialRuta = (rutaId?: number | null) =>
    historial
      .filter(
        (item) => Number(item.ruta_id) === Number(rutaId)
      )
      .sort((a, b) =>
        String(b.fecha || "").localeCompare(
          String(a.fecha || "")
        )
      );

  const openLocationModal = (target: LocationTarget) => {
    setLocationTarget(target);

    setLocationForm({
      codigo_ubicacion: "",
      nombre_ubicacion: "",
      pais: "Guatemala",
    });

    setLocationErrors({});
    setLocationModal(true);
  };

  const validateLocation = () => {
    const nextErrors: FormErrors = {};

    if (!locationForm.nombre_ubicacion.trim()) {
      nextErrors.nombre_ubicacion =
        "Ingresa el nombre de la ubicación.";
    }

    if (!locationForm.pais.trim()) {
      nextErrors.pais = "Ingresa el país.";
    }

    setLocationErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  const saveLocation = async () => {
    if (!validateLocation()) return;

    try {
      const saved = await apiRequest("/rutas/ubicaciones", {
        method: "POST",
        body: JSON.stringify({
          codigo_ubicacion: locationForm.codigo_ubicacion,
          nombre_ubicacion: locationForm.nombre_ubicacion,
          pais: locationForm.pais,
        }),
      });

      await load();

      if (selected && locationTarget) {
        setSelected({
          ...selected,
          [locationTarget === "origen"
            ? "origen_id"
            : "destino_id"]: saved.id,
        });
      }

      setLocationModal(false);
      setLocationTarget(null);
      setLocationErrors({});

      showNotice("Ubicación guardada correctamente.");
    } catch (error: any) {
      setLocationErrors({
        general:
          error.message ||
          "No se pudo guardar la ubicación.",
      });
    }
  };

  const clearFilters = () => {
    setSearch("");
    setFilterEstado("Todos");
    setFilterFrecuencia("Todos");
    setSortField("");
    setSortDirection("asc");
    setPage(1);
  };

  const exportRutasExcel = () => {
    const rows = sortedRutas.map((ruta) => {
      const estado =
        ruta.estado ||
        estadoById(ruta.estado_id)?.nombre_estado_ruta ||
        "-";

      const frecuencia =
        ruta.frecuencia ||
        frecuenciaById(ruta.frecuencia_id)
          ?.nombre_frecuencia_ruta ||
        "-";

      return {
        Código: ruta.codigo_ruta,
        Ruta: routeName(ruta),
        Origen: nombreUbicacion(ruta.origen_id),
        Destino: nombreUbicacion(ruta.destino_id),
        "Distancia km": numeric(ruta.distancia_km),
        Tiempo: formatDuration(ruta.tiempo),
        "Tiempo decimal": numeric(ruta.tiempo),
        Costo: numeric(ruta.costo),
        Frecuencia: frecuencia,
        Estado: estado,
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "Rutas");
    XLSX.writeFile(wb, "Reporte_Rutas_GL365.xlsx");
  };

  const exportRutasPDF = async () => {
    const doc = new jsPDF("landscape", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();

    await addCorporatePdfHeader(
      doc,
      "REPORTE DE RUTAS",
      "Rutas · Distancias, tiempos, costos y frecuencias",
      true
    );

    doc.setTextColor(12, 45, 107);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Resumen operativo", 14, 45);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(75, 85, 99);

    doc.text(
      `Rutas visibles: ${sortedRutas.length} de ${rutas.length}`,
      14,
      52
    );

    doc.text(
      `Activas: ${kpis[1].value}  |  Distancia total: ${kpis[2].value}  |  Costo promedio: ${kpis[3].value}`,
      14,
      58
    );

    const columns = [
      "Código",
      "Ruta",
      "Distancia",
      "Tiempo",
      "Costo",
      "Frecuencia",
      "Estado",
    ];

    const rows = sortedRutas.map((ruta) => {
      const estado =
        ruta.estado ||
        estadoById(ruta.estado_id)?.nombre_estado_ruta ||
        "-";

      const frecuencia =
        ruta.frecuencia ||
        frecuenciaById(ruta.frecuencia_id)
          ?.nombre_frecuencia_ruta ||
        "-";

      return [
        ruta.codigo_ruta || "-",
        routeName(ruta),
        `${formatNumber(ruta.distancia_km)} km`,
        formatDuration(ruta.tiempo),
        formatMoney(ruta.costo),
        frecuencia,
        estado,
      ];
    });

    const widths = [28, 88, 30, 30, 34, 40, 32];
    let y = 68;

    const drawHeader = () => {
      doc.setFillColor(255, 106, 0);
      doc.roundedRect(
        14,
        y,
        pageWidth - 28,
        10,
        3,
        3,
        "F"
      );

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");

      let x = 18;

      columns.forEach((column, index) => {
        doc.text(column, x, y + 6.5);
        x += widths[index];
      });

      y += 13;
    };

    drawHeader();

    doc.setFont("helvetica", "normal");
    doc.setTextColor(17, 24, 39);

    rows.forEach((row, rowIndex) => {
      if (y > 188) {
        doc.addPage();

        y = 18;

        drawHeader();

        doc.setFont("helvetica", "normal");
        doc.setTextColor(17, 24, 39);
      }

      if (rowIndex % 2 === 0) {
        doc.setFillColor(248, 250, 252);

        doc.rect(
          14,
          y - 4,
          pageWidth - 28,
          10,
          "F"
        );
      }

      let x = 18;

      row.forEach((value, index) => {
        const limit =
          index === 1 ? 45 : index === 5 ? 22 : 18;

        doc.text(
          String(value).slice(0, limit),
          x,
          y + 2
        );

        x += widths[index];
      });

      y += 10;
    });

    doc.save("Reporte_Rutas_GL365.pdf");
  };

  const printRuta = async (ruta: Ruta) => {
    const doc = new jsPDF();

    const estado =
      ruta.estado ||
      estadoById(ruta.estado_id)?.nombre_estado_ruta ||
      "-";

    const frecuencia =
      ruta.frecuencia ||
      frecuenciaById(ruta.frecuencia_id)
        ?.nombre_frecuencia_ruta ||
      "-";

    await addCorporatePdfHeader(
      doc,
      "DETALLE DE RUTA",
      `Rutas · ${ruta.codigo_ruta || "Ruta"}`
    );

    let y = 50;

    const line = (label: string, value: any) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(12, 45, 107);
      doc.text(`${label}:`, 20, y);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(17, 24, 39);
      doc.text(String(value || "-"), 72, y, {
        maxWidth: 118,
      });

      y += 9;
    };

    line("Código", ruta.codigo_ruta);
    line("Ruta", routeName(ruta));
    line("Origen", nombreUbicacion(ruta.origen_id));
    line("Destino", nombreUbicacion(ruta.destino_id));
    line(
      "Distancia",
      `${formatNumber(ruta.distancia_km)} km`
    );
    line("Tiempo", formatDuration(ruta.tiempo));
    line("Costo", formatMoney(ruta.costo));
    line("Frecuencia", frecuencia);
    line("Estado", estado);

    const routeHistory = historialRuta(ruta.id);

    if (routeHistory.length) {
      y += 6;

      doc.setFillColor(248, 250, 252);

      doc.roundedRect(
        15,
        y - 6,
        180,
        10,
        2,
        2,
        "F"
      );

      doc.setFont("helvetica", "bold");
      doc.setTextColor(12, 45, 107);
      doc.text("HISTORIAL DE COSTO", 20, y);

      y += 11;

      routeHistory.slice(0, 5).forEach((item, index) => {
        line(
          `Cambio ${index + 1}`,
          `${dateText(item.fecha)} · ${formatMoney(
            item.costo
          )}`
        );
      });
    }

    doc.save(`Ruta_${ruta.codigo_ruta}.pdf`);
  };

  return (
    <div className="w-full max-w-full space-y-7 overflow-hidden px-3 sm:px-4 pb-12">
      <div className="flex flex-col gap-5 pt-1 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#0C2D6B]">
            Rutas
          </h1>

          <p className="mt-1 text-gray-500">
            Gestión de rutas, distancias, horas, minutos,
            costos y frecuencias operativas
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-[#0C2D6B] shadow-sm disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                loading ? "animate-spin" : ""
              }`}
            />

            {loading ? "Cargando..." : "Actualizar"}
          </button>

          <button
            type="button"
            onClick={exportRutasPDF}
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-red-500 px-5 text-sm font-bold text-white shadow-sm hover:bg-red-600"
          >
            <FileText className="h-4 w-4" />
            PDF
          </button>

          <button
            type="button"
            onClick={exportRutasExcel}
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#22C55E] px-5 text-sm font-bold text-white shadow-sm hover:bg-[#16A34A]"
          >
            <Download className="h-4 w-4" />
            Excel
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.title} {...kpi} />
        ))}
      </div>

      <section className="pt-2">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-[#0C2D6B]">
              <RouteIcon className="h-6 w-6 text-[#FF6A00]" />
              Rutas Operativas
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Consulta, creación y control de recorridos,
              costos y frecuencias.
            </p>
          </div>

          <button
            type="button"
            onClick={openNuevo}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0C2D6B] px-7 text-base font-bold text-white shadow-md hover:bg-[#143C8C]"
          >
            <Plus className="h-5 w-5" />
            Nueva Ruta
          </button>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_230px_240px_auto]">
            <div className="relative min-w-0">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Buscar por código, origen, destino..."
                className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-12 pr-4 text-sm outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20"
              />
            </div>

            <div className="relative">
              <Filter className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />

              <select
                value={filterEstado}
                onChange={(event) =>
                  setFilterEstado(event.target.value)
                }
                className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-12 pr-4 text-sm outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20"
              >
                <option value="Todos">
                  Todos los estados
                </option>

                {estados.map((estado) => (
                  <option
                    key={estado.id}
                    value={estado.id}
                  >
                    {estado.nombre_estado_ruta}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <Filter className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />

              <select
                value={filterFrecuencia}
                onChange={(event) =>
                  setFilterFrecuencia(event.target.value)
                }
                className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-12 pr-4 text-sm outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20"
              >
                <option value="Todos">
                  Todas las frecuencias
                </option>

                {frecuencias.map((frecuencia) => (
                  <option
                    key={frecuencia.id}
                    value={frecuencia.id}
                  >
                    {frecuencia.nombre_frecuencia_ruta}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-orange-200 bg-white px-4 text-sm font-bold text-[#FF6A00] shadow-sm transition hover:border-[#FF6A00] hover:bg-orange-50"
            >
              <X className="h-4 w-4" />
              Limpiar
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase text-gray-400">
              Ordenar por:
            </span>

            <SortChip field="codigo" label="Código" />
            <SortChip field="ruta" label="Ruta" />
            <SortChip field="origen" label="Origen" />
            <SortChip field="destino" label="Destino" />
            <SortChip
              field="distancia"
              label="Distancia"
            />
            <SortChip field="tiempo" label="Tiempo" />
            <SortChip field="costo" label="Costo" />
            <SortChip
              field="frecuencia"
              label="Frecuencia"
            />
            <SortChip field="estado" label="Estado" />

            <div className="ml-0 flex flex-wrap items-center gap-3 lg:ml-auto">
              <span className="text-sm font-bold text-gray-400">
                {sortedRutas.length} de {rutas.length} registros
                visibles
              </span>

              <label className="inline-flex items-center gap-2 text-xs font-bold text-gray-500">
                Mostrar

                <select
                  value={pageSize}
                  onChange={(event) =>
                    setPageSize(
                      Number(event.target.value)
                    )
                  }
                  className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm font-semibold text-[#0C2D6B]"
                >
                  <option value={4}>4</option>
                  <option value={8}>8</option>
                  <option value={12}>12</option>
                  <option value={20}>20</option>
                  <option value={40}>40</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
          {paginatedRutas.map((ruta) => {
            const estado =
              ruta.estado ||
              estadoById(ruta.estado_id)
                ?.nombre_estado_ruta ||
              "-";

            const frecuencia =
              ruta.frecuencia ||
              frecuenciaById(ruta.frecuencia_id)
                ?.nombre_frecuencia_ruta ||
              "-";

            return (
              <article
                key={ruta.id}
                className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="p-4">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words text-lg font-bold leading-6 text-[#0C2D6B]">
                          {routeName(ruta)}
                        </h3>

                        <span className="rounded-lg bg-blue-50 px-2 py-1 font-mono text-[11px] font-bold text-[#0C2D6B]">
                          {ruta.codigo_ruta}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-gray-500">
                        Frecuencia: {frecuencia}
                      </p>
                    </div>

                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#0C2D6B]">
                      <RouteIcon className="h-7 w-7" />
                    </div>
                  </div>

                  <div className="mb-4 flex flex-wrap gap-2">
                    <Badge
                      className={estadoTone(estado)}
                    >
                      {estado}
                    </Badge>

                    <Badge className="border-orange-100 bg-orange-50 text-[#FF6A00]">
                      {frecuencia}
                    </Badge>
                  </div>

                  <div className="mb-4 rounded-2xl bg-gray-50 p-4">
                    <div className="grid grid-cols-[24px_1fr] gap-x-3 gap-y-3">
                      <MapPin className="mt-0.5 h-5 w-5 text-green-600" />

                      <div>
                        <p className="text-xs font-bold uppercase text-gray-400">
                          Origen
                        </p>

                        <p className="text-sm font-semibold text-gray-800">
                          {nombreUbicacion(
                            ruta.origen_id
                          )}
                        </p>
                      </div>

                      <Navigation className="mt-0.5 h-5 w-5 text-[#FF6A00]" />

                      <div>
                        <p className="text-xs font-bold uppercase text-gray-400">
                          Destino
                        </p>

                        <p className="text-sm font-semibold text-gray-800">
                          {nombreUbicacion(
                            ruta.destino_id
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">
                        Distancia
                      </p>

                      <p className="font-bold text-gray-800">
                        {formatNumber(
                          ruta.distancia_km
                        )}{" "}
                        km
                      </p>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">
                        Tiempo
                      </p>

                      <p className="font-bold text-gray-800">
                        {formatDuration(ruta.tiempo)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">
                        Costo
                      </p>

                      <p className="font-bold text-green-600">
                        {formatMoney(ruta.costo)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-3 py-2.5">
                  <ActionButton
                    title="Ver"
                    icon={Eye}
                    tone="blue"
                    onClick={() => openVer(ruta)}
                  />

                  <ActionButton
                    title="Editar"
                    icon={Edit2}
                    tone="orange"
                    onClick={() => openEditar(ruta)}
                  />

                  <ActionButton
                    title="Imprimir"
                    icon={Download}
                    tone="green"
                    onClick={() => {
                      void printRuta(ruta);
                    }}
                  />

                  <ActionButton
                    title="Eliminar"
                    icon={Trash2}
                    tone="red"
                    onClick={() =>
                      setDeleteModal(ruta)
                    }
                  />
                </div>
              </article>
            );
          })}

          {!sortedRutas.length && (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-500 xl:col-span-2">
              <RouteIcon className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              No se encontraron rutas.
            </div>
          )}
        </div>

        {sortedRutas.length > 0 && (
          <div className="mt-6 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm font-semibold text-gray-500">
                Página{" "}
                <b className="text-[#0C2D6B]">
                  {Math.min(page, totalPages)}
                </b>{" "}
                de{" "}
                <b className="text-[#0C2D6B]">
                  {totalPages}
                </b>
                {" · "}
                Mostrando{" "}
                <b className="text-[#0C2D6B]">
                  {(Math.min(page, totalPages) -
                    1) *
                    pageSize +
                    1}
                </b>
                {" - "}
                <b className="text-[#0C2D6B]">
                  {Math.min(
                    Math.min(page, totalPages) *
                      pageSize,
                    sortedRutas.length
                  )}
                </b>{" "}
                de{" "}
                <b className="text-[#0C2D6B]">
                  {sortedRutas.length}
                </b>
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(1)}
                  className="h-10 rounded-xl border border-gray-200 bg-white px-4 text-xs font-bold text-[#0C2D6B] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Primera
                </button>

                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() =>
                    setPage((current) =>
                      Math.max(1, current - 1)
                    )
                  }
                  className="h-10 rounded-xl border border-gray-200 bg-white px-4 text-xs font-bold text-[#0C2D6B] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Anterior
                </button>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((current) =>
                      Math.min(
                        totalPages,
                        current + 1
                      )
                    )
                  }
                  className="h-10 rounded-xl border border-gray-200 bg-white px-4 text-xs font-bold text-[#0C2D6B] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Siguiente
                </button>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage(totalPages)
                  }
                  className="h-10 rounded-xl border border-gray-200 bg-white px-4 text-xs font-bold text-[#0C2D6B] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Última
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {(modo === "nuevo" ||
        modo === "editar" ||
        modo === "ver") &&
        selected && (
          <RutaModal
            modo={modo}
            selected={selected}
            setSelected={setSelected}
            ubicaciones={ubicaciones}
            rutas={rutas}
            frecuencias={frecuencias}
            estados={estados}
            errors={errors}
            clearError={clearError}
            routeName={routeName}
            nombreUbicacion={nombreUbicacion}
            frecuenciaById={frecuenciaById}
            estadoById={estadoById}
            historial={historialRuta(selected.id)}
            openLocationModal={openLocationModal}
            onClose={() => {
              setModo(null);
              setSelected(null);
              setErrors({});
            }}
            onSave={saveRuta}
          />
        )}

      {locationModal && (
        <LocationModal
          form={locationForm}
          setForm={setLocationForm}
          errors={locationErrors}
          setErrors={setLocationErrors}
          target={locationTarget}
          onClose={() => {
            setLocationModal(false);
            setLocationTarget(null);
            setLocationErrors({});
          }}
          onSave={saveLocation}
        />
      )}

      {deleteModal && (
        <ConfirmDelete
          ruta={deleteModal}
          routeName={routeName}
          onCancel={() => setDeleteModal(null)}
          onConfirm={deleteRuta}
        />
      )}
    </div>
  );
}

function RutaModal({
  modo,
  selected,
  setSelected,
  ubicaciones,
  rutas,
  frecuencias,
  estados,
  errors,
  clearError,
  routeName,
  nombreUbicacion,
  frecuenciaById,
  estadoById,
  historial,
  openLocationModal,
  onClose,
  onSave,
}: {
  modo: Exclude<Modo, null>;
  selected: Ruta;
  setSelected: React.Dispatch<
    React.SetStateAction<Ruta | null>
  >;
  ubicaciones: Ubicacion[];
  rutas: Ruta[];
  frecuencias: FrecuenciaRuta[];
  estados: EstadoRuta[];
  errors: FormErrors;
  clearError: (field: string) => void;
  routeName: (ruta: Partial<Ruta>) => string;
  nombreUbicacion: (id?: number | null) => string;
  frecuenciaById: (
    id?: number | null
  ) => FrecuenciaRuta | undefined;
  estadoById: (
    id?: number | null
  ) => EstadoRuta | undefined;
  historial: RutaHistorial[];
  openLocationModal: (target: LocationTarget) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const readonly = modo === "ver";

  const origenSeleccionado = ubicaciones.find(
    (item) =>
      Number(item.id) === Number(selected.origen_id)
  );

  const destinoSeleccionado = ubicaciones.find(
    (item) =>
      Number(item.id) === Number(selected.destino_id)
  );

  const routeEstimate = estimateRouteData(
    selected,
    ubicaciones,
    rutas
  );

  const mapsUrl =
    origenSeleccionado && destinoSeleccionado
      ? mapsDirectionUrl(
          origenSeleccionado,
          destinoSeleccionado
        )
      : "";

  const applyRouteEstimate = (
    nextSelected: Ruta,
    options: { force?: boolean } = {}
  ) => {
    const estimate = estimateRouteData(
      nextSelected,
      ubicaciones,
      rutas
    );

    if (!estimate) return nextSelected;

    const shouldFillDistance =
      options.force ||
      !String(nextSelected.distancia_km ?? "").trim();

    const shouldFillTime =
      options.force ||
      !String(nextSelected.tiempo ?? "").trim();

    return {
      ...nextSelected,
      distancia_km: shouldFillDistance
        ? estimate.distancia_km
        : nextSelected.distancia_km,
      tiempo: shouldFillTime
        ? estimate.tiempo
        : nextSelected.tiempo,
    };
  };

  const updateLocationAndEstimate = (
    field: "origen_id" | "destino_id",
    id: number
  ) => {
    const next = applyRouteEstimate(
      {
        ...selected,
        [field]: id,
      },
      { force: true }
    );

    setSelected(next);

    clearError(field);
    clearError("distancia_km");
    clearError("tiempo");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-xl font-bold text-[#0C2D6B]">
              {modo === "nuevo"
                ? "Nueva Ruta"
                : modo === "editar"
                ? "Editar Ruta"
                : "Detalle de Ruta"}
            </h2>

            <p className="mt-0.5 text-xs text-gray-400">
              {modo === "nuevo"
                ? "El código se genera automáticamente al guardar"
                : selected.codigo_ruta}
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

        <div
          data-form
          onKeyDown={moveOnEnter}
          className="overflow-y-auto p-5"
        >
          {modo === "nuevo" && (
            <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm font-bold text-[#0C2D6B]">
                Código automático
              </p>

              <p className="mt-1 text-xs text-gray-600">
                El sistema generará el código de la ruta
                automáticamente. El nombre se forma con el origen y
                destino.
              </p>
            </div>
          )}

          <div className="mb-4 rounded-2xl border border-orange-100 bg-orange-50 p-4">
            <p className="text-xs font-bold uppercase text-[#C85100]">
              Ruta
            </p>

            <p className="mt-1 text-lg font-bold text-[#0C2D6B]">
              {routeName(selected) ||
                "Selecciona origen y destino"}
            </p>
          </div>

          {!readonly &&
            selected.origen_id &&
            selected.destino_id &&
            Number(selected.origen_id) !==
              Number(selected.destino_id) && (
              <div
                className={`mb-4 rounded-2xl border p-4 ${
                  routeEstimate
                    ? "border-blue-100 bg-blue-50"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p
                      className={`text-sm font-bold ${
                        routeEstimate
                          ? "text-[#0C2D6B]"
                          : "text-amber-700"
                      }`}
                    >
                      {routeEstimate
                        ? "Cálculo automático disponible"
                        : "Verificar ruta en mapa"}
                    </p>

                    <p className="mt-1 text-xs leading-relaxed text-gray-600">
                      {routeEstimate
                        ? `${routeEstimate.label} Distancia: ${routeEstimate.distancia_km} km · Tiempo: ${formatDuration(
                            routeEstimate.tiempo
                          )}.`
                        : "No hay coordenadas registradas para una de estas ubicaciones. Podés abrir Google Maps y copiar los valores manualmente."}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {routeEstimate && (
                      <button
                        type="button"
                        onClick={() => {
                          const next =
                            applyRouteEstimate(
                              selected,
                              { force: true }
                            );

                          setSelected(next);
                          clearError("distancia_km");
                          clearError("tiempo");
                        }}
                        className="h-10 rounded-xl bg-[#0C2D6B] px-4 text-xs font-bold text-white hover:bg-[#143C8C]"
                      >
                        Usar km, horas y minutos
                      </button>
                    )}

                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-xs font-bold text-[#0C2D6B] hover:bg-gray-50"
                      >
                        Abrir Maps
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

          {readonly && mapsUrl && (
            <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-[#0C2D6B]">
                    Mapa de la ruta
                  </p>

                  <p className="mt-1 text-xs text-gray-600">
                    Abre la ruta en Google Maps para validar el
                    recorrido.
                  </p>
                </div>

                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-[#0C2D6B] px-4 text-xs font-bold text-white hover:bg-[#143C8C]"
                >
                  Abrir Maps
                </a>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Origen *"
              error={errors.origen_id}
            >
              {readonly ? (
                <ReadBox>
                  {nombreUbicacion(selected.origen_id)}
                </ReadBox>
              ) : (
                <div className="space-y-2">
                  <SearchableSelect
                    value={selected.origen_id}
                    options={ubicaciones}
                    placeholder="Buscar origen..."
                    getLabel={(item) =>
                      `${item.nombre_ubicacion}, ${item.pais}`
                    }
                    getSubLabel={(item) =>
                      item.codigo_ubicacion
                    }
                    onSelect={(item) =>
                      updateLocationAndEstimate(
                        "origen_id",
                        item.id
                      )
                    }
                    error={errors.origen_id}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      openLocationModal("origen")
                    }
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#0C2D6B] hover:underline"
                  >
                    <Plus className="h-3 w-3" />
                    Crear nueva ubicación
                  </button>
                </div>
              )}
            </Field>

            <Field
              label="Destino *"
              error={errors.destino_id}
            >
              {readonly ? (
                <ReadBox>
                  {nombreUbicacion(selected.destino_id)}
                </ReadBox>
              ) : (
                <div className="space-y-2">
                  <SearchableSelect
                    value={selected.destino_id}
                    options={ubicaciones.filter(
                      (ubicacion) =>
                        Number(ubicacion.id) !==
                        Number(selected.origen_id)
                    )}
                    placeholder="Buscar destino..."
                    getLabel={(item) =>
                      `${item.nombre_ubicacion}, ${item.pais}`
                    }
                    getSubLabel={(item) =>
                      item.codigo_ubicacion
                    }
                    onSelect={(item) =>
                      updateLocationAndEstimate(
                        "destino_id",
                        item.id
                      )
                    }
                    error={errors.destino_id}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      openLocationModal("destino")
                    }
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#0C2D6B] hover:underline"
                  >
                    <Plus className="h-3 w-3" />
                    Crear nueva ubicación
                  </button>
                </div>
              )}
            </Field>

            <Field
              label="Distancia (km) *"
              error={errors.distancia_km}
            >
              {readonly ? (
                <ReadBox>
                  {formatNumber(selected.distancia_km)} km
                </ReadBox>
              ) : (
                <input
                  inputMode="decimal"
                  value={selected.distancia_km ?? ""}
                  onChange={(event) => {
                    setSelected({
                      ...selected,
                      distancia_km: cleanDecimal(
                        event.target.value,
                        8,
                        2
                      ),
                    });

                    clearError("distancia_km");
                  }}
                  className={`${inputClass} ${
                    errors.distancia_km
                      ? errorInput
                      : ""
                  }`}
                  placeholder="Auto o manual"
                />
              )}
            </Field>

            <Field
              label="Tiempo estimado *"
              error={errors.tiempo}
            >
              {readonly ? (
                <ReadBox>
                  {formatDuration(selected.tiempo)}
                </ReadBox>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <input
                      inputMode="numeric"
                      value={
                        splitDuration(selected.tiempo)
                          .horas || ""
                      }
                      onChange={(event) => {
                        const horas = cleanHours(
                          event.target.value
                        );

                        const minutos =
                          splitDuration(
                            selected.tiempo
                          ).minutos;

                        setSelected({
                          ...selected,
                          tiempo:
                            horas === "" &&
                            minutos === 0
                              ? ""
                              : durationToDecimal(
                                  horas || 0,
                                  minutos
                                ),
                        });

                        clearError("tiempo");
                      }}
                      className={`${inputClass} pr-12 ${
                        errors.tiempo
                          ? errorInput
                          : ""
                      }`}
                      placeholder="Horas"
                    />

                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                      hrs
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      inputMode="numeric"
                      value={
                        splitDuration(selected.tiempo)
                          .minutos || ""
                      }
                      onChange={(event) => {
                        const minutos = cleanMinutes(
                          event.target.value
                        );

                        const horas =
                          splitDuration(
                            selected.tiempo
                          ).horas;

                        setSelected({
                          ...selected,
                          tiempo:
                            minutos === "" &&
                            horas === 0
                              ? ""
                              : durationToDecimal(
                                  horas,
                                  minutos || 0
                                ),
                        });

                        clearError("tiempo");
                      }}
                      className={`${inputClass} pr-12 ${
                        errors.tiempo
                          ? errorInput
                          : ""
                      }`}
                      placeholder="Min"
                    />

                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                      min
                    </span>
                  </div>

                  <p className="col-span-2 text-[11px] text-gray-400">
                    Se guarda en la base como horas
                    decimales, pero aquí se captura separado.
                  </p>
                </div>
              )}
            </Field>

            <Field
              label="Costo (Q) *"
              error={errors.costo}
            >
              {readonly ? (
                <ReadBox>
                  {formatMoney(selected.costo)}
                </ReadBox>
              ) : (
                <input
                  inputMode="decimal"
                  value={selected.costo ?? ""}
                  onChange={(event) => {
                    setSelected({
                      ...selected,
                      costo: cleanDecimal(
                        event.target.value,
                        8,
                        2
                      ),
                    });

                    clearError("costo");
                  }}
                  className={`${inputClass} ${
                    errors.costo ? errorInput : ""
                  }`}
                  placeholder="Solo números"
                />
              )}
            </Field>

            <Field
              label="Frecuencia *"
              error={errors.frecuencia_id}
            >
              {readonly ? (
                <ReadBox>
                  {frecuenciaById(
                    selected.frecuencia_id
                  )?.nombre_frecuencia_ruta || "-"}
                </ReadBox>
              ) : (
                <select
                  value={selected.frecuencia_id || ""}
                  onChange={(event) => {
                    setSelected({
                      ...selected,
                      frecuencia_id:
                        event.target.value
                          ? Number(
                              event.target.value
                            )
                          : null,
                    });

                    clearError("frecuencia_id");
                  }}
                  className={`${inputClass} ${
                    errors.frecuencia_id
                      ? errorInput
                      : ""
                  }`}
                >
                  <option value="">
                    Seleccionar frecuencia
                  </option>

                  {frecuencias.map((frecuencia) => (
                    <option
                      key={frecuencia.id}
                      value={frecuencia.id}
                    >
                      {
                        frecuencia.nombre_frecuencia_ruta
                      }
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field
              label="Estado *"
              error={errors.estado_id}
            >
              {readonly ? (
                <ReadBox>
                  {estadoById(selected.estado_id)
                    ?.nombre_estado_ruta || "-"}
                </ReadBox>
              ) : (
                <select
                  value={selected.estado_id || ""}
                  onChange={(event) => {
                    setSelected({
                      ...selected,
                      estado_id: event.target.value
                        ? Number(event.target.value)
                        : null,
                    });

                    clearError("estado_id");
                  }}
                  className={`${inputClass} ${
                    errors.estado_id
                      ? errorInput
                      : ""
                  }`}
                >
                  <option value="">
                    Seleccionar estado
                  </option>

                  {estados.map((estado) => (
                    <option
                      key={estado.id}
                      value={estado.id}
                    >
                      {estado.nombre_estado_ruta}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>

          {readonly && (
            <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#0C2D6B]">
                <History className="h-4 w-4 text-[#FF6A00]" />
                Historial de costo
              </h3>

              {historial.length ? (
                <div className="space-y-2">
                  {historial
                    .slice(0, 5)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm"
                      >
                        <span className="text-gray-500">
                          {dateText(item.fecha)}
                        </span>

                        <span className="font-bold text-green-600">
                          {formatMoney(item.costo)}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  No hay cambios de costo registrados. El
                  historial aparece cuando editás una ruta y
                  cambiás su costo.
                </p>
              )}
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
              {modo === "nuevo"
                ? "Crear Ruta"
                : "Guardar Cambios"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ReadBox({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-11 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-800">
      {children}
    </div>
  );
}

function LocationModal({
  form,
  setForm,
  errors,
  setErrors,
  target,
  onClose,
  onSave,
}: {
  form: LocationForm;
  setForm: React.Dispatch<
    React.SetStateAction<LocationForm>
  >;
  errors: FormErrors;
  setErrors: React.Dispatch<
    React.SetStateAction<FormErrors>
  >;
  target: LocationTarget;
  onClose: () => void;
  onSave: () => void;
}) {
  const clearError = (field: string) =>
    setErrors((prev) => ({
      ...prev,
      [field]: "",
    }));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-xl font-bold text-[#0C2D6B]">
              Nueva ubicación
            </h2>

            <p className="mt-0.5 text-xs text-gray-400">
              Se asignará como{" "}
              {target === "origen"
                ? "origen"
                : "destino"}{" "}
              de la ruta.
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

        <div
          data-form
          onKeyDown={moveOnEnter}
          className="overflow-y-auto p-5"
        >
          <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-bold text-[#0C2D6B]">
              Ubicación rápida
            </p>

            <p className="mt-1 text-xs text-gray-600">
              El código es opcional. Si lo dejás vacío, el
              sistema lo genera automáticamente.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Código"
              error={errors.codigo_ubicacion}
            >
              <input
                value={form.codigo_ubicacion}
                onChange={(event) => {
                  setForm({
                    ...form,
                    codigo_ubicacion: cleanCode(
                      event.target.value,
                      12
                    ),
                  });

                  clearError("codigo_ubicacion");
                }}
                className={`${inputClass} ${
                  errors.codigo_ubicacion
                    ? errorInput
                    : ""
                }`}
                placeholder="Ej. GUA"
                maxLength={12}
              />
            </Field>

            <Field
              label="País *"
              error={errors.pais}
            >
              <input
                value={form.pais}
                onChange={(event) => {
                  setForm({
                    ...form,
                    pais: cleanPais(
                      event.target.value,
                      60
                    ),
                  });

                  clearError("pais");
                }}
                className={`${inputClass} ${
                  errors.pais ? errorInput : ""
                }`}
                placeholder="Solo letras"
              />
            </Field>

            <Field
              label="Nombre de ubicación *"
              error={errors.nombre_ubicacion}
              className="md:col-span-2"
            >
              <input
                value={form.nombre_ubicacion}
                onChange={(event) => {
                  setForm({
                    ...form,
                    nombre_ubicacion:
                      cleanLocationName(
                        event.target.value,
                        120
                      ),
                  });

                  clearError("nombre_ubicacion");
                }}
                className={`${inputClass} ${
                  errors.nombre_ubicacion
                    ? errorInput
                    : ""
                }`}
                placeholder="Ej. Zona 12, A30 Amatitlán, Cobán..."
              />

              <p className="mt-1 text-[11px] text-gray-400">
                Se permiten letras y números porque las rutas
                usan nombres como Zona 12, A30 y Km22.4.
              </p>
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
            className="h-10 rounded-xl bg-[#0C2D6B] px-5 text-sm font-bold text-white hover:bg-[#143C8C]"
          >
            Guardar ubicación
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDelete({
  ruta,
  routeName,
  onCancel,
  onConfirm,
}: {
  ruta: Ruta;
  routeName: (ruta: Partial<Ruta>) => string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl">
        <div className="h-2 bg-red-500" />

        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <Trash2 className="h-7 w-7" />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-bold text-[#0C2D6B]">
                Eliminar ruta
              </h3>

              <p className="mt-1 text-sm leading-relaxed text-gray-500">
                Esta acción eliminará la ruta seleccionada si
                no tiene viajes o asignaciones relacionadas.
              </p>

              <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                  Ruta seleccionada
                </p>

                <p className="mt-1 font-mono text-sm font-bold text-gray-800">
                  {ruta.codigo_ruta}
                </p>

                <p className="mt-1 text-sm text-gray-600">
                  {routeName(ruta)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 rounded-xl border border-gray-200 bg-white px-5 text-sm font-bold text-gray-700 hover:bg-gray-100"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-red-700"
          >
            <Trash2 className="h-4 w-4" />
            Sí, eliminar
          </button>
        </div>
      </div>
    </div>
  );
}