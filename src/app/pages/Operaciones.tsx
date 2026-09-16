import { ReactNode, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit2,
  Eye,
  FileSpreadsheet,
  Filter,
  Globe2,
  MapPin,
  MapPinned,
  Plus,
  RefreshCw,
  RotateCcw,
  Route,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Truck,
  UserPlus,
  X,
} from "lucide-react";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import logoEmpresa from "../../assets/614cb11181e5d72cb3a39a09d833f4775b7fc7ce.png";

const API_BASE_URL = "/api";

const FINALIZED_PREVIOUS_STATE_KEY =
  "gl365_operaciones_estado_previo_finalizar_v1";

const readPreviousFinalStates = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(FINALIZED_PREVIOUS_STATE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writePreviousFinalStates = (
  values: Record<string, number>
) => {
  try {
    localStorage.setItem(
      FINALIZED_PREVIOUS_STATE_KEY,
      JSON.stringify(values)
    );
  } catch {}
};


type AssignmentType = "local" | "fiduca" | "centroamerica" | "internacional";
type Tab = AssignmentType | "cierre";
type Mode = "create" | "edit" | "view";
type SortDirection = "asc" | "desc";

interface AnyRow {
  [key: string]: any;
}

const TYPE_META: Record<
  AssignmentType,
  { label: string; singular: string; icon: any; description: string }
> = {
  local: {
    label: "Local",
    singular: "Asignación Local",
    icon: Truck,
    description: "Carga nacional con unidad, piloto, origen, destino y estatus operativo.",
  },
  fiduca: {
    label: "FYDUCA",
    singular: "Asignación FYDUCA",
    icon: ShieldCheck,
    description: "Expediente documental de piloto y transportista para operaciones FYDUCA.",
  },
  centroamerica: {
    label: "Centroamérica",
    singular: "Asignación Centroamérica",
    icon: Route,
    description: "Datos de equipo, piloto, fianza y posicionamiento para rutas regionales.",
  },
  internacional: {
    label: "Internacional",
    singular: "Asignación Internacional",
    icon: Globe2,
    description: "Unidad, piloto, CAAT, días de servicio y seguimiento por fecha y hora.",
  },
};

const input =
  "w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm outline-none focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/15 disabled:bg-gray-100 disabled:text-gray-500";

const money = (value: any) =>
  `Q ${Number(value || 0).toLocaleString("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const numeric = (value: any) => {
  const n = Number(String(value ?? 0).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const date10 = (value: any) => String(value || "").slice(0, 10);
const cleanNum = (value: string) => value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
const onlyDigits = (value: string, max = 13) => value.replace(/\D/g, "").slice(0, max);
const onlyCode = (value: string, max = 40) => value.replace(/[^0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ ._\/-]/g, "").slice(0, max);
const parseJson = (value: any) => {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return {};
  }
};

async function apiRequest<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  let json: any = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  if (!response.ok || json?.ok === false) {
    throw new Error(
      json?.error ||
      json?.message ||
      `Error HTTP ${response.status}`
    );
  }

  return (json?.data ?? json) as T;
}

const rows = <T,>(value: any): T[] => (Array.isArray(value) ? value : []);

const fullName = (row?: AnyRow) =>
  row
    ? [row.primer_nombre, row.segundo_nombre, row.primer_apellido, row.segundo_apellido]
        .filter(Boolean)
        .join(" ")
    : "";

const fullPilot = (row?: AnyRow) => row?.nombre_piloto || row?.piloto || fullName(row) || "";

// Las líneas Local de un mismo documento se guardan como asignaciones independientes
// pero comparten un código base. Ej.: ASG-067, ASG-067-02, ASG-067-03.
// Así no se requiere cambiar la estructura de la base de datos y el frontend puede
// reconstruir el grupo completo para Ver, Editar, PDF y Eliminar.
const localGroupKey = (itemOrCode: AnyRow | string | number | null | undefined) => {
  const code = String(
    typeof itemOrCode === "object" && itemOrCode !== null
      ? itemOrCode.codigo_asignacion || ""
      : itemOrCode || ""
  ).trim();

  const match = code.match(/^(.*)-(\d{2})$/);
  if (match && Number(match[2]) >= 2) return match[1];
  return code;
};

const localLineNumber = (itemOrCode: AnyRow | string | number | null | undefined) => {
  const code = String(
    typeof itemOrCode === "object" && itemOrCode !== null
      ? itemOrCode.codigo_asignacion || ""
      : itemOrCode || ""
  ).trim();
  const match = code.match(/-(\d{2})$/);
  return match && Number(match[1]) >= 2 ? Number(match[1]) : 1;
};

const compareValues = (a: any, b: any, direction: SortDirection) => {
  const av = a ?? "";
  const bv = b ?? "";
  if (typeof av === "number" || typeof bv === "number") {
    const result = Number(av || 0) - Number(bv || 0);
    return direction === "asc" ? result : -result;
  }
  const result = String(av).localeCompare(String(bv), "es", { numeric: true, sensitivity: "base" });
  return direction === "asc" ? result : -result;
};

function handleEnterNext(event: any) {
  if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.altKey) return;

  const target = event.target as HTMLElement;
  if (!target || target.tagName === "TEXTAREA" || target.getAttribute("data-enter-skip") === "true") return;

  const root = event.currentTarget as HTMLElement;
  if (!root) return;

  const focusables = Array.from(
    root.querySelectorAll<HTMLElement>(
      'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])'
    )
  ).filter((el) => el.offsetParent !== null && el.tabIndex !== -1);

  const index = focusables.indexOf(target);
  if (index < 0) return;

  const next = focusables[index + 1];
  if (next) {
    event.preventDefault();
    next.focus();
    if (next instanceof HTMLInputElement && !["date", "time", "number"].includes(next.type)) {
      next.select();
    }
  }
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-semibold text-gray-700">{label}</span>
      {children}
    </label>
  );
}

function ErrorText({ text }: { text?: string }) {
  return text ? <p className="mt-1 text-xs font-semibold text-red-600">{text}</p> : null;
}

function ActionButton({ icon: Icon, label, tone = "blue", onClick }: AnyRow) {
  const toneClass =
    tone === "red"
      ? "border-red-100 bg-red-50 text-red-600 hover:bg-red-100"
      : tone === "orange"
      ? "border-orange-100 bg-orange-50 text-[#FF6A00] hover:bg-orange-100"
      : tone === "gray"
      ? "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
      : "border-blue-100 bg-blue-50 text-[#0C2D6B] hover:bg-blue-100";

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`h-9 w-9 rounded-xl border inline-flex items-center justify-center transition ${toneClass}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}


const COUNTRIES = [
  "Guatemala",
  "El Salvador",
  "Honduras",
  "Nicaragua",
  "Costa Rica",
  "Panamá",
  "Belice",
  "México",
  "Estados Unidos",
  "N/A",
  "Otro",
];

function TextWithNA({
  value,
  onChange,
  disabled = false,
  placeholder = "",
  upper = false,
}: {
  value: any;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  upper?: boolean;
}) {
  return (
    <div className="mt-1 flex gap-2">
      <input
        disabled={disabled}
        value={value || ""}
        onChange={(e) => onChange(upper ? e.target.value.toUpperCase() : e.target.value)}
        placeholder={placeholder}
        className={input}
      />
      {!disabled && (
        <button
          type="button"
          onClick={() => onChange("N/A")}
          className="h-10 shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-3 text-xs font-bold text-gray-600 hover:border-[#FF6A00] hover:text-[#FF6A00]"
          title="Guardar como no aplica"
        >
          N/A
        </button>
      )}
    </div>
  );
}

function SearchableSelect({
  items,
  value,
  getLabel,
  onChange,
  disabled = false,
  placeholder = "Buscar...",
  emptyText = "No se encontraron registros",
  onNew,
  newLabel = "Nuevo",
}: {
  items: AnyRow[];
  value: any;
  getLabel: (item: AnyRow) => string;
  onChange: (value: any, item?: AnyRow) => void;
  disabled?: boolean;
  placeholder?: string;
  emptyText?: string;
  onNew?: () => void;
  newLabel?: string;
}) {
  const selected = items.find((item) => String(item.id) === String(value));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery(selected ? getLabel(selected) : "");
  }, [value, open, items]);

  const filteredItems = items
    .filter((item) => getLabel(item).toLowerCase().includes(query.toLowerCase()))
    .slice(0, 25);

  return (
    <div className="mt-1 flex gap-2">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          disabled={disabled}
          value={open ? query : selected ? getLabel(selected) : query}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onChange={(e) => {
            setOpen(true);
            setQuery(e.target.value);
          }}
          placeholder={placeholder}
          className={`${input} pl-9`}
        />

        {open && !disabled && (
          <div className="absolute left-0 right-0 top-[44px] z-[150] max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-2xl">
            {filteredItems.map((item) => (
              <button
                type="button"
                key={item.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(item.id, item);
                  setOpen(false);
                  setQuery(getLabel(item));
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-[#0C2D6B]"
              >
                {getLabel(item)}
              </button>
            ))}
            {!filteredItems.length && (
              <p className="px-3 py-4 text-center text-xs italic text-gray-400">{emptyText}</p>
            )}
          </div>
        )}
      </div>

      {onNew && !disabled && (
        <button
          type="button"
          onClick={onNew}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-[#FF6A00] px-3 text-xs font-bold text-white shadow-sm hover:bg-orange-600"
        >
          <Plus className="h-4 w-4" />
          {newLabel}
        </button>
      )}
    </div>
  );
}

function CountryPicker({
  value,
  otherValue,
  onChange,
  onOtherChange,
  disabled = false,
}: {
  value: string;
  otherValue?: string;
  onChange: (value: string) => void;
  onOtherChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-1 space-y-2">
      <select disabled={disabled} value={value || "Guatemala"} onChange={(e) => onChange(e.target.value)} className={input}>
        {COUNTRIES.map((country) => <option key={country}>{country}</option>)}
      </select>
      {value === "Otro" && (
        <input
          disabled={disabled}
          value={otherValue || ""}
          onChange={(e) => onOtherChange(e.target.value)}
          placeholder="Escribe el país"
          className={input}
        />
      )}
    </div>
  );
}

function StatusTimeline({
  value,
  onChange,
  readonly = false,
  title = "Estatus de la operación",
}: {
  value: AnyRow[];
  onChange: (rows: AnyRow[]) => void;
  readonly?: boolean;
  title?: string;
}) {
  const rows = Array.isArray(value) ? value : [];
  const add = () => onChange([
    ...rows,
    {
      fecha: new Date().toISOString().slice(0, 10),
      hora: new Date().toTimeString().slice(0, 5),
      estatus: "",
    },
  ]);

  return (
    <section className="rounded-xl border bg-white p-4">
      <div className="flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-bold text-[#0C2D6B]">{title}</h3>
          <p className="text-xs text-gray-500">Puedes agregar todas las actualizaciones necesarias con fecha, hora y estatus.</p>
        </div>
        {!readonly && (
          <button type="button" onClick={add} className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#FF6A00] px-3 text-sm font-bold text-white">
            <Plus className="h-4 w-4" /> Agregar línea
          </button>
        )}
      </div>
      <div className="mt-3 space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="grid grid-cols-1 gap-2 rounded-xl border bg-gray-50 p-3 md:grid-cols-[150px_120px_1fr_40px]">
            <input type="date" disabled={readonly} value={row.fecha || ""} onChange={(e) => { const next = [...rows]; next[index] = { ...next[index], fecha: e.target.value }; onChange(next); }} className={input} />
            <input type="time" disabled={readonly} value={row.hora || ""} onChange={(e) => { const next = [...rows]; next[index] = { ...next[index], hora: e.target.value }; onChange(next); }} className={input} />
            <input disabled={readonly} value={row.estatus || ""} onChange={(e) => { const next = [...rows]; next[index] = { ...next[index], estatus: e.target.value }; onChange(next); }} className={input} placeholder="Ej. Unidad presente en Distipark / En tránsito / Detenido en tráfico" />
            {!readonly && (
              <button type="button" onClick={() => onChange(rows.filter((_, i) => i !== index))} className="rounded-lg text-red-600 hover:bg-red-50">
                <Trash2 className="mx-auto h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {!rows.length && <p className="py-5 text-center text-sm italic text-gray-400">Todavía no hay estatus registrados.</p>}
      </div>
    </section>
  );
}

function Pagination({ page, totalPages, rowsPerPage, setRowsPerPage, setPage }: AnyRow) {
  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-semibold text-gray-500">
        Página {page} de {totalPages}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={rowsPerPage}
          onChange={(e) => setRowsPerPage(Number(e.target.value))}
          className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-[#0C2D6B]"
        >
          {[8, 10, 15, 25].map((n) => (
            <option key={n} value={n}>{n} por página</option>
          ))}
        </select>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage(1)}
          className="h-10 rounded-xl border px-3 text-sm font-semibold disabled:opacity-40"
        >
          Primera
        </button>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p: number) => Math.max(1, p - 1))}
          className="h-10 rounded-xl border px-3 text-sm font-semibold disabled:opacity-40"
        >
          Anterior
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
          className="h-10 rounded-xl border px-3 text-sm font-semibold disabled:opacity-40"
        >
          Siguiente
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage(totalPages)}
          className="h-10 rounded-xl border px-3 text-sm font-semibold disabled:opacity-40"
        >
          Última
        </button>
      </div>
    </div>
  );
}

async function imageUrlToDataUrl(url: string) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

export function Operaciones() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("local");

  useEffect(() => {
    const requestedTab = String(searchParams.get("tab") || "").toLowerCase();

    const validTabs: Tab[] = [
      "local",
      "fiduca",
      "centroamerica",
      "internacional",
      "cierre",
    ];

    if (validTabs.includes(requestedTab as Tab)) {
      setTab(requestedTab as Tab);
    }
  }, [searchParams]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [notice, setNotice] = useState("");

  const [asignaciones, setAsignaciones] = useState<AnyRow[]>([]);
  const [proveedores, setProveedores] = useState<AnyRow[]>([]);
  const [clientes, setClientes] = useState<AnyRow[]>([]);
  const [rutas, setRutas] = useState<AnyRow[]>([]);
  const [vehiculos, setVehiculos] = useState<AnyRow[]>([]);
  const [pilotos, setPilotos] = useState<AnyRow[]>([]);
  const [usuarios, setUsuarios] = useState<AnyRow[]>([]);
  const [prefijos, setPrefijos] = useState<AnyRow[]>([]);
  const [estadosAsignacion, setEstadosAsignacion] = useState<AnyRow[]>([]);

  const [search, setSearch] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");

  // Filtros específicos del Cierre / Excel final.
  const [cierreTipoFiltro, setCierreTipoFiltro] = useState("Todos");
  const [cierreProveedorFiltro, setCierreProveedorFiltro] = useState("Todos");
  const [cierrePagoFiltro, setCierrePagoFiltro] = useState("Todos");

  const [sortField, setSortField] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [rowsPerPage, setRowsPerPage] = useState(8);
  const [page, setPage] = useState(1);

  const [modal, setModal] = useState<{ open: boolean; mode: Mode; type: AssignmentType }>({
    open: false,
    mode: "create",
    type: "local",
  });
  const [form, setForm] = useState<AnyRow>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [localBatchRows, setLocalBatchRows] = useState<AnyRow[]>([]);

  const [closingModal, setClosingModal] = useState<{ open: boolean; mode: Mode }>({ open: false, mode: "edit" });
  const [closingForm, setClosingForm] = useState<AnyRow>({});
  const [closingErrors, setClosingErrors] = useState<Record<string, string>>({});

  const [deleteBox, setDeleteBox] = useState<AnyRow | null>(null);
  const [quickModal, setQuickModal] = useState<{ open: boolean; type: "cliente" | "piloto" | "ruta" }>({ open: false, type: "cliente" });
  const [quickTarget, setQuickTarget] = useState<{ batchIndex?: number; field?: string } | null>(null);
  const [quickForm, setQuickForm] = useState<AnyRow>({});
  const [quickError, setQuickError] = useState("");

  const estadoNombre = (id: any, row?: AnyRow) =>
    estadosAsignacion.find((e) => Number(e.id) === Number(id))?.nombre_estado_asignacion || row?.estado || "Pendiente";

  const isFinalized = (item: AnyRow) => estadoNombre(item.estado_asignacion_id, item).toLowerCase().includes("final");

  const getCliente = (id: any) => clientes.find((x) => Number(x.id) === Number(id));
  const getRuta = (id: any) => rutas.find((x) => Number(x.id) === Number(id));
  const getVehiculo = (id: any) => vehiculos.find((x) => Number(x.id) === Number(id));
  const getPiloto = (id: any) => pilotos.find((x) => Number(x.id) === Number(id));
  const getProveedor = (id: any) => proveedores.find((x) => Number(x.id) === Number(id));

  const rutaLabel = (ruta?: AnyRow) => {
    if (!ruta) return "-";
    const code = ruta.codigo_ruta || ruta.codigo || "";
    const routeText = ruta.origen || ruta.destino
      ? `${ruta.origen || "Origen"} → ${ruta.destino || "Destino"}`
      : ruta.nombre || ruta.nombre_ruta || "-";
    return code ? `${code} · ${routeText}` : routeText;
  };

  const nextCode = (prefix: string) => {
    const max = asignaciones.reduce((acc, item) => {
      const m = String(item.codigo_asignacion || "").match(/(\d+)(?!.*\d)/);
      return m ? Math.max(acc, Number(m[1])) : acc;
    }, 0);
    return `${prefix}-${String(max + 1).padStart(3, "0")}`;
  };

  const loadData = async () => {
    setLoading(true);
    setApiError("");
    try {
      const [op, crm, states] = await Promise.all([
        apiRequest<AnyRow>("/operaciones/bootstrap"),
        apiRequest<AnyRow>("/crm/bootstrap").catch(() => ({})),
        apiRequest<AnyRow[]>("/mantenimiento/tablas/estado_asignacion/registros").catch(() => []),
      ]);
      setAsignaciones(rows<AnyRow>(op.asignaciones));
      setProveedores(rows<AnyRow>(op.proveedores));
      setRutas(rows<AnyRow>(op.rutas));
      setVehiculos(rows<AnyRow>(op.vehiculos));
      setPilotos(rows<AnyRow>(op.pilotos));
      setClientes(rows<AnyRow>(crm.clientes));
      setUsuarios(rows<AnyRow>(crm.usuarios));
      setPrefijos(rows<AnyRow>(crm.prefijos));
      setEstadosAsignacion(rows<AnyRow>(states));
    } catch (error: any) {
      setApiError(error.message || "No se pudo cargar Operaciones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    setSearch("");
    setEstadoFiltro("Todos");
    setCierreTipoFiltro("Todos");
    setCierreProveedorFiltro("Todos");
    setCierrePagoFiltro("Todos");
    setSortField("");
    setSortDirection("asc");
    setPage(1);
  }, [tab]);

  const getLocalGroupRows = (itemOrCode: AnyRow | string) => {
    const key = localGroupKey(itemOrCode);
    return asignaciones
      .filter((row) => {
        const detail = parseJson(row.detalle_operativo_json);
        const rowType = row.tipo_asignacion || detail.tipo_asignacion || "local";
        return rowType === "local" && localGroupKey(row) === key;
      })
      .sort((a, b) => localLineNumber(a) - localLineNumber(b));
  };

  const currentAssignments = useMemo(() => {
    if (tab === "cierre") return asignaciones.filter(isFinalized);

    const matching = asignaciones.filter((item) => {
      const detail = parseJson(item.detalle_operativo_json);
      return (item.tipo_asignacion || detail.tipo_asignacion || "local") === tab;
    });

    if (tab !== "local") return matching;

    const groups = new Map<string, AnyRow[]>();
    matching.forEach((item) => {
      const key = localGroupKey(item) || String(item.id);
      const list = groups.get(key) || [];
      list.push(item);
      groups.set(key, list);
    });

    return Array.from(groups.entries()).map(([key, group]) => {
      const groupRows = [...group].sort((a, b) => localLineNumber(a) - localLineNumber(b));
      const first = groupRows[0];
      const searchText = groupRows
        .map((row) => {
          const d = parseJson(row.detalle_operativo_json);
          return [
            row.codigo_asignacion,
            getCliente(row.cliente_id)?.nombre_empresa,
            fullPilot(getPiloto(row.piloto_id || row.pilotos_id)),
            getVehiculo(row.vehiculo_id)?.codigo,
            rutaLabel(getRuta(row.ruta_id)),
            d.licencia, d.placa_operativa, d.furgon, d.tipo, d.origen, d.destino,
            d.estatus_operativo,
            ...(Array.isArray(d.estatus_seguimiento) ? d.estatus_seguimiento.map((s: AnyRow) => s.estatus) : []),
          ].filter(Boolean).join(" ");
        })
        .join(" ");

      return {
        ...first,
        codigo_asignacion: key,
        _localGroupKey: key,
        _localGroupRows: groupRows,
        _localLineCount: groupRows.length,
        _localSearchText: searchText,
      };
    });
  }, [asignaciones, tab, estadosAsignacion, clientes, pilotos, vehiculos, rutas]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return currentAssignments.filter((item) => {
      const cliente =
        getCliente(item.cliente_id)?.nombre_empresa ||
        item.cliente ||
        item.nombre_empresa ||
        "";

      const piloto =
        fullPilot(
          getPiloto(item.piloto_id || item.pilotos_id)
        ) ||
        item.piloto ||
        "";

      const vehiculo =
        getVehiculo(item.vehiculo_id)?.codigo ||
        item.cabezal ||
        "";

      const ruta =
        rutaLabel(getRuta(item.ruta_id)) ||
        item.ruta ||
        "";

      const estado = estadoNombre(
        item.estado_asignacion_id,
        item
      );

      const detail = parseJson(
        item.detalle_operativo_json
      );

      const tipo = String(
        item.tipo_asignacion ||
          detail.tipo_asignacion ||
          "local"
      ).toLowerCase();

      const proveedor =
        getProveedor(item.proveedor_id)?.razon_social ||
        getProveedor(item.proveedor_id)?.nombre_comercial ||
        item.proveedor ||
        "";

      const detailText = [
        detail.placa_operativa,
        detail.placa_piloto,
        detail.licencia,
        detail.dpi_piloto,
        detail.nit_piloto,
        detail.empresa_transporte,
        detail.nit_transportista,
        detail.caat,
        detail.numero_economico,
        detail.fianza,
        detail.codigo_aduanero,
        detail.pasaporte,
        detail.cabezal,
        detail.furgon,
        detail.codigo_equipo,
        detail.tamano_equipo,
        detail.origen,
        detail.destino,
        detail.estatus_operativo,

        // Datos de cierre / Excel.
        proveedor,
        item.serieProveedor,
        item.serie_proveedor,
        item.numeroProveedor,
        item.numero_proveedor,
        item.serieFactura,
        item.serie_factura,
        item.numeroFactura,
        item.numero_factura,
        item.vendedor,
        item.vendedor_nombre,
        item.doc,
        item.documentos,
        item.marchamo,
        item._localSearchText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !term ||
        String(
          item.codigo_asignacion || ""
        )
          .toLowerCase()
          .includes(term) ||
        cliente.toLowerCase().includes(term) ||
        piloto.toLowerCase().includes(term) ||
        vehiculo.toLowerCase().includes(term) ||
        ruta.toLowerCase().includes(term) ||
        detailText.includes(term);

      if (!matchesSearch) return false;

      // En las cuatro pestañas operativas se conserva
      // el filtro por estado.
      if (
        tab !== "cierre" &&
        estadoFiltro !== "Todos" &&
        estado !== estadoFiltro
      ) {
        return false;
      }

      // Filtros propios del cierre.
      if (tab === "cierre") {
        if (
          cierreTipoFiltro !== "Todos" &&
          tipo !== cierreTipoFiltro
        ) {
          return false;
        }

        if (cierreProveedorFiltro !== "Todos") {
          if (cierreProveedorFiltro === "Sin proveedor") {
            if (
              item.proveedor_id ||
              String(proveedor).trim()
            ) {
              return false;
            }
          } else if (
            Number(item.proveedor_id) !==
            Number(cierreProveedorFiltro)
          ) {
            return false;
          }
        }

        const fechaPagoProveedor =
          item.fechaPagoProveedor ||
          item.fecha_pago_proveedor;

        const fechaPagoCliente =
          item.fechaPagoFactura ||
          item.fecha_pago_factura;

        const proveedorPagado =
          Boolean(fechaPagoProveedor);

        const clientePagado =
          Boolean(fechaPagoCliente);

        if (
          cierrePagoFiltro === "Proveedor pendiente" &&
          proveedorPagado
        ) {
          return false;
        }

        if (
          cierrePagoFiltro === "Cliente pendiente" &&
          clientePagado
        ) {
          return false;
        }

        if (
          cierrePagoFiltro === "Pagados" &&
          !(proveedorPagado && clientePagado)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    currentAssignments,
    search,
    estadoFiltro,
    cierreTipoFiltro,
    cierreProveedorFiltro,
    cierrePagoFiltro,
    tab,
    clientes,
    pilotos,
    vehiculos,
    rutas,
    proveedores,
    estadosAsignacion,
  ]);

  const sorted = useMemo(() => {
    const result = [...filtered];
    result.sort((a, b) => {
      if (!sortField) return Number(b.id || 0) - Number(a.id || 0);
      const detailA = parseJson(a.detalle_operativo_json);
      const detailB = parseJson(b.detalle_operativo_json);
      const value = (item: AnyRow, detail: AnyRow) => {
        const cliente = getCliente(item.cliente_id)?.nombre_empresa || item.cliente || "";
        const piloto = fullPilot(getPiloto(item.piloto_id || item.pilotos_id)) || item.piloto || "";
        const vehiculo = getVehiculo(item.vehiculo_id)?.codigo || item.cabezal || "";
        const ruta = rutaLabel(getRuta(item.ruta_id)) || item.ruta || "";
        if (sortField === "codigo") return item.codigo_asignacion || "";
        if (sortField === "cliente") return cliente;
        if (sortField === "piloto") return piloto;
        if (sortField === "vehiculo" || sortField === "placa" || sortField === "cabezal" || sortField === "unidad") return detail.placa_operativa || detail.cabezal || detail.unidad || detail.placa_piloto || vehiculo;
        if (sortField === "ruta") return detail.ruta_codigo || ruta;
        if (sortField === "estado") return estadoNombre(item.estado_asignacion_id, item);
        if (sortField === "carga") return item.fecha_carga || "";
        if (sortField === "descarga") return item.fecha_descarga || "";
        if (sortField === "licencia") return detail.licencia || "";
        if (sortField === "furgon") return detail.furgon || "";
        if (sortField === "tipo") return detail.tipo || detail.tamano_equipo || "";
        if (sortField === "origen") return detail.origen || "";
        if (sortField === "destino") return detail.destino || "";
        if (sortField === "estatus") return detail.estatus_operativo || item.estado || "";
        if (sortField === "dpi") return detail.dpi_piloto || "";
        if (sortField === "pais") return detail.pais_piloto || "";
        if (sortField === "transportista") return detail.empresa_transporte || "";
        if (sortField === "caat") return detail.caat || "";
        if (sortField === "numero_economico") return detail.numero_economico || "";
        if (sortField === "fianza") return detail.fianza || "";
        if (sortField === "codigo_aduanero") return detail.codigo_aduanero || "";
        if (sortField === "pasaporte") return detail.pasaporte || "";
        if (sortField === "codigo_equipo") return detail.codigo_equipo || "";
        if (sortField === "tamano") return detail.tamano_equipo || "";
        if (sortField === "fecha_posicionamiento") return detail.fecha_posicionamiento || "";
        if (sortField === "dias_servicio") return Number(detail.dias_servicio || 0);

        // Cierre / Excel final
        if (sortField === "tipo") {
          return String(
            item.tipo_asignacion ||
              detail.tipo_asignacion ||
              "local"
          );
        }

        if (sortField === "proveedor") {
          return (
            getProveedor(item.proveedor_id)?.razon_social ||
            getProveedor(item.proveedor_id)?.nombre_comercial ||
            item.proveedor ||
            ""
          );
        }

        if (sortField === "margen") {
          return (
            numeric(item.total) -
            numeric(
              item.totalProveedor ||
                item.total_proveedor
            )
          );
        }

        return "";
      };
      return compareValues(value(a, detailA), value(b, detailB), sortDirection);
    });
    return result;
  }, [filtered, sortField, sortDirection, clientes, pilotos, vehiculos, rutas, proveedores, estadosAsignacion]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / rowsPerPage));
  const paginated = sorted.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  useEffect(
    () => setPage(1),
    [
      search,
      estadoFiltro,
      cierreTipoFiltro,
      cierreProveedorFiltro,
      cierrePagoFiltro,
      sortField,
      sortDirection,
      rowsPerPage,
    ]
  );
  useEffect(() => setPage((p) => Math.min(p, totalPages)), [totalPages]);

  const sortIcon = (field: string) => (sortField === field ? (sortDirection === "asc" ? "↑" : "↓") : "↕");
  const handleSort = (field: string) => {
    if (sortField === field) setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortableTh = ({ field, children, className = "" }: AnyRow) => (
    <th className={className}>
      <button type="button" onClick={() => handleSort(field)} className="text-left group">
        <span className={`inline-flex items-center gap-1 font-bold ${sortField === field ? "text-[#FF6A00]" : "text-[#0C2D6B]"}`}>
          {children}<small className="text-[9px] text-gray-300">{sortIcon(field)}</small>
        </span>
        <span className={`block mt-0.5 text-[9px] ${sortField === field ? "text-[#FF6A00]" : "text-gray-400"}`}>
          {sortField === field ? (sortDirection === "asc" ? "Ascendente" : "Descendente") : "Clic para ordenar"}
        </span>
      </button>
    </th>
  );

  const baseForm = (type: AssignmentType): AnyRow => ({
    codigo_asignacion: nextCode("ASG"),
    tipo_asignacion: type,
    cliente_id: "",
    ruta_id: "",
    vehiculo_id: "",
    pilotos_id: "",
    estado_asignacion_id: estadosAsignacion[0]?.id || 1,

    fecha_carga: new Date().toISOString().slice(0, 10),
    hora_carga: "08:00",
    fecha_descarga: "",
    hora_descarga: "17:00",

    placa_operativa: "",
    placa_piloto: "",
    licencia: "",
    furgon: "N/A",
    tipo: "",
    origen: "",
    destino: "",
    ruta_codigo: "",

    pais_piloto: "Guatemala",
    pais_piloto_otro: "",
    dpi_piloto: "",
    fecha_nacimiento_piloto: "",
    nit_piloto: "",
    empresa_transporte: "",
    nit_transportista: "",
    pais_transportista: "Guatemala",
    pais_transportista_otro: "",
    caat: "",
    numero_economico: "",
    fianza: "N/A",
    codigo_aduanero: "N/A",

    pasaporte: "N/A",
    cabezal: "",
    codigo_equipo: "N/A",
    tamano_equipo: "",
    fecha_posicionamiento: "",
    hora_posicionamiento: "08:00",

    unidad: "",
    dias_servicio: 1,
    estatus_operativo: "",
    estatus_seguimiento: type === "local" || type === "internacional"
      ? [{ fecha: new Date().toISOString().slice(0, 10), hora: new Date().toTimeString().slice(0, 5), estatus: "" }]
      : [],
  });

  const newLocalBatchRow = (index = 0): AnyRow => ({
    ...baseForm("local"),
    codigo_asignacion: "",
    _key: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    estatus_seguimiento: [],
    estatus_operativo: "",
  });

  const rowToLocalDraft = (row: AnyRow, index: number): AnyRow => {
    const detail = parseJson(row.detalle_operativo_json);
    const pilot = getPiloto(row.pilotos_id || row.piloto_id);
    const vehicle = getVehiculo(row.vehiculo_id);
    const route = getRuta(row.ruta_id);
    const statuses = Array.isArray(detail.estatus_seguimiento) ? detail.estatus_seguimiento : [];
    const latest = [...statuses].reverse().find((status: AnyRow) => String(status.estatus || "").trim());

    return {
      ...baseForm("local"),
      ...detail,
      ...row,
      _key: `db-${row.id || index}-${localGroupKey(row)}`,
      id: row.id,
      codigo_asignacion: row.codigo_asignacion || "",
      cliente_id: row.cliente_id || "",
      pilotos_id: row.pilotos_id || row.piloto_id || "",
      licencia: detail.licencia || row.licencia || pilot?.licencia || "",
      vehiculo_id: row.vehiculo_id || "",
      placa_operativa: detail.placa_operativa || vehicle?.codigo || row.cabezal || "",
      furgon: detail.furgon || row.furgon || "N/A",
      tipo: detail.tipo || vehicle?.tipo || vehicle?.nombre_tipo_vehiculo || row.tipo || "",
      ruta_id: row.ruta_id || "",
      ruta_codigo: detail.ruta_codigo || route?.codigo_ruta || "",
      origen: detail.origen || route?.origen || row.origen || "",
      destino: detail.destino || route?.destino || row.destino || "",
      fecha_carga: date10(row.fecha_carga || row.carga),
      fecha_descarga: date10(row.fecha_descarga || row.descarga),
      hora_carga: detail.hora_carga || "08:00",
      hora_descarga: detail.hora_descarga || "17:00",
      estatus_seguimiento: statuses,
      estatus_operativo: latest?.estatus || detail.estatus_operativo || row.estatus_operativo || "",
    };
  };

  const openAssignment = (mode: Mode, type: AssignmentType, item?: AnyRow) => {
    setErrors({});
    setModal({ open: true, mode, type });
    if (!item) {
      setForm(baseForm(type));
      if (type === "local") {
        setLocalBatchRows([newLocalBatchRow(0)]);
      }
      return;
    }

    if (type === "local") {
      const groupRows = Array.isArray(item._localGroupRows) && item._localGroupRows.length
        ? item._localGroupRows
        : getLocalGroupRows(item);
      const drafts = groupRows.map((row: AnyRow, index: number) => rowToLocalDraft(row, index));
      setLocalBatchRows(drafts);
      const first = drafts[0] || rowToLocalDraft(item, 0);
      setForm({
        ...first,
        codigo_asignacion: localGroupKey(item),
        estado_asignacion_id: item.estado_asignacion_id || first.estado_asignacion_id || estadosAsignacion[0]?.id || 1,
        _localGroupIds: groupRows.map((row: AnyRow) => Number(row.id)).filter(Boolean),
      });
      return;
    }

    setLocalBatchRows([]);
    const detail = parseJson(item.detalle_operativo_json);
    const pilot = getPiloto(item.pilotos_id || item.piloto_id);
    const vehicle = getVehiculo(item.vehiculo_id);
    const route = getRuta(item.ruta_id);

    setForm({
      ...baseForm(type),
      ...detail,
      ...item,
      tipo_asignacion: type,
      pilotos_id: item.pilotos_id || item.piloto_id || "",
      licencia: detail.licencia || item.licencia || pilot?.licencia || "",
      vehiculo_id: item.vehiculo_id || "",
      placa_operativa: detail.placa_operativa || vehicle?.codigo || item.cabezal || "",
      cabezal: detail.cabezal || vehicle?.codigo || item.cabezal || "",
      unidad: detail.unidad || vehicle?.codigo || item.cabezal || "",
      tipo: detail.tipo || vehicle?.tipo || vehicle?.nombre_tipo_vehiculo || item.tipo || "",
      ruta_id: item.ruta_id || "",
      ruta_codigo: detail.ruta_codigo || route?.codigo_ruta || "",
      origen: detail.origen || route?.origen || item.origen || "",
      destino: detail.destino || route?.destino || item.destino || "",
      fecha_carga: date10(item.fecha_carga || item.carga),
      fecha_descarga: date10(item.fecha_descarga || item.descarga),
      hora_carga: detail.hora_carga || "08:00",
      hora_descarga: detail.hora_descarga || "17:00",
      estatus_seguimiento: Array.isArray(detail.estatus_seguimiento) ? detail.estatus_seguimiento : [],
    });
  };

  const validateOperational = () => {
    const e: Record<string, string> = {};
    const required = (field: string, message: string) => {
      if (!String(form[field] ?? "").trim()) e[field] = message;
    };

    if (modal.type === "local") {
      if (!form.fecha_carga) e.fecha_carga = "Ingresa la fecha de carga.";
      if (!form.fecha_descarga) e.fecha_descarga = "Ingresa la fecha de descarga.";
      if (!form.cliente_id) e.cliente_id = "Selecciona o crea el cliente.";
      if (!form.pilotos_id) e.pilotos_id = "Selecciona o crea el piloto.";
      required("placa_operativa", "Ingresa o selecciona la placa / unidad.");
      required("licencia", "El piloto seleccionado debe tener licencia.");
      required("tipo", "Ingresa el tipo de unidad.");
      if (!form.ruta_id && !(String(form.origen || "").trim() && String(form.destino || "").trim())) {
        e.ruta_id = "Selecciona o crea una ruta.";
      }
      const statuses = Array.isArray(form.estatus_seguimiento) ? form.estatus_seguimiento : [];
      if (!statuses.some((row: AnyRow) => String(row.estatus || "").trim())) e.estatus_seguimiento = "Agrega al menos un estatus.";
    }

    if (modal.type === "fiduca") {
      if (!form.pilotos_id) e.pilotos_id = "Selecciona o crea el piloto.";
      required("placa_piloto", "Ingresa la placa del piloto / unidad." );
      required("dpi_piloto", "Ingresa el DPI del piloto." );
      if (!form.fecha_nacimiento_piloto) e.fecha_nacimiento_piloto = "Ingresa la fecha de nacimiento.";
      required("nit_piloto", "Ingresa el NIT del piloto." );
      required("empresa_transporte", "Ingresa el nombre del transporte." );
      required("nit_transportista", "Ingresa el NIT del transportista." );
      required("caat", "Ingresa el CAAT." );
      required("numero_economico", "Ingresa el número económico." );
      required("fianza", "Ingresa la fianza o selecciona N/A." );
      required("codigo_aduanero", "Ingresa el código aduanero o selecciona N/A." );
    }

    if (modal.type === "centroamerica") {
      if (!form.ruta_id && !(String(form.origen || "").trim() && String(form.destino || "").trim())) e.ruta_id = "Selecciona o crea la ruta.";
      if (!form.pilotos_id) e.pilotos_id = "Selecciona o crea el piloto.";
      required("dpi_piloto", "Ingresa el DPI." );
      required("licencia", "El piloto seleccionado debe tener licencia.");
      required("pasaporte", "Ingresa el pasaporte o selecciona N/A." );
      required("cabezal", "Ingresa el cabezal." );
      required("furgon", "Ingresa el furgón o selecciona N/A." );
      required("codigo_equipo", "Ingresa el código o selecciona N/A." );
      required("fianza", "Ingresa la fianza o selecciona N/A." );
      required("tamano_equipo", "Ingresa el tamaño / tipo de equipo." );
      required("empresa_transporte", "Ingresa el nombre del transporte." );
      if (!form.fecha_posicionamiento) e.fecha_posicionamiento = "Ingresa la fecha de posicionamiento.";
    }

    if (modal.type === "internacional") {
      if (!form.cliente_id) e.cliente_id = "Selecciona o crea el cliente.";
      if (!form.pilotos_id) e.pilotos_id = "Selecciona o crea el piloto.";
      required("caat", "Ingresa el CAAT." );
      required("empresa_transporte", "Ingresa el nombre del transporte." );
      if (!form.ruta_id && !(String(form.origen || "").trim() && String(form.destino || "").trim())) e.ruta_id = "Selecciona o crea una ruta.";
      required("numero_economico", "Ingresa el número económico." );
      if (!form.fecha_carga) e.fecha_carga = "Ingresa la fecha de carga.";
      required("unidad", "Ingresa la unidad." );
      required("tamano_equipo", "Ingresa el tamaño." );
      if (numeric(form.dias_servicio) <= 0) e.dias_servicio = "Ingresa los días de servicio.";
      const statuses = Array.isArray(form.estatus_seguimiento) ? form.estatus_seguimiento : [];
      if (!statuses.some((row: AnyRow) => String(row.estatus || "").trim())) e.estatus_seguimiento = "Agrega al menos un estatus.";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildOperationalPayload = (source: AnyRow, type: AssignmentType) => {
    const selectedPilot = getPiloto(source.pilotos_id);
    const selectedVehicle = getVehiculo(source.vehiculo_id);
    const selectedRoute = getRuta(source.ruta_id);
    const statuses = Array.isArray(source.estatus_seguimiento) ? source.estatus_seguimiento : [];
    const latestStatus = [...statuses].reverse().find((row: AnyRow) => String(row.estatus || "").trim())?.estatus || source.estatus_operativo || "";

    const detail = {
      tipo_asignacion: type,
      hora_carga: source.hora_carga,
      hora_descarga: source.hora_descarga,
      licencia: source.licencia || selectedPilot?.licencia || "",
      placa_operativa: source.placa_operativa || selectedVehicle?.codigo || "",
      placa_piloto: source.placa_piloto,
      furgon: source.furgon,
      tipo: source.tipo || selectedVehicle?.tipo || selectedVehicle?.nombre_tipo_vehiculo || "",
      ruta_codigo: source.ruta_codigo || selectedRoute?.codigo_ruta || "",
      origen: source.origen || selectedRoute?.origen || "",
      destino: source.destino || selectedRoute?.destino || "",
      estatus_operativo: latestStatus,
      estatus_seguimiento: statuses,
      pais_piloto: source.pais_piloto,
      pais_piloto_otro: source.pais_piloto_otro,
      dpi_piloto: source.dpi_piloto,
      fecha_nacimiento_piloto: source.fecha_nacimiento_piloto,
      nit_piloto: source.nit_piloto,
      empresa_transporte: source.empresa_transporte,
      nit_transportista: source.nit_transportista,
      pais_transportista: source.pais_transportista,
      pais_transportista_otro: source.pais_transportista_otro,
      caat: source.caat,
      numero_economico: source.numero_economico,
      fianza: source.fianza,
      codigo_aduanero: source.codigo_aduanero,
      pasaporte: source.pasaporte,
      cabezal: source.cabezal,
      codigo_equipo: source.codigo_equipo,
      tamano_equipo: source.tamano_equipo,
      fecha_posicionamiento: source.fecha_posicionamiento,
      hora_posicionamiento: source.hora_posicionamiento,
      unidad: source.unidad,
      dias_servicio: source.dias_servicio,
    };

    const vehiculoCodigo = type === "local"
      ? source.placa_operativa
      : type === "centroamerica"
      ? source.cabezal
      : type === "internacional"
      ? source.unidad
      : source.placa_piloto;

    return {
      ...source,
      tipo_asignacion: type,
      detalle_operativo_json: JSON.stringify(detail),
      piloto_id: source.pilotos_id,
      licencia: detail.licencia,
      cabezal: vehiculoCodigo,
      placa: vehiculoCodigo,
      tipo: detail.tipo || source.tamano_equipo || "Unidad",
      origen: detail.origen,
      destino: detail.destino,
      fecha_carga: source.fecha_carga || new Date().toISOString().slice(0, 10),
      fecha_descarga: source.fecha_descarga || source.fecha_carga || new Date().toISOString().slice(0, 10),
      estatus_operativo: latestStatus,
      cierre_operacion: false,
    };
  };

  const saveOperational = async () => {
    // LOCAL guarda todas las filas del mismo documento y permite volver a abrirlas juntas.
    if (modal.type === "local") {
      const activeRows = localBatchRows.filter((row) =>
        row.id || row.cliente_id || row.pilotos_id || row.vehiculo_id || row.ruta_id ||
        String(row.placa_operativa || "").trim() || String(row.estatus_operativo || "").trim()
      );

      if (!activeRows.length) {
        setErrors({ local_batch: "Completa al menos una fila de asignación Local." });
        return;
      }

      const rowErrors: string[] = [];
      activeRows.forEach((row, index) => {
        const missing: string[] = [];
        if (!row.fecha_carga) missing.push("carga");
        if (!row.fecha_descarga) missing.push("descarga");
        if (!row.cliente_id) missing.push("cliente");
        if (!row.pilotos_id) missing.push("piloto");
        if (!String(row.licencia || "").trim()) missing.push("licencia");
        if (!row.vehiculo_id) missing.push("placa");
        if (!row.ruta_id) missing.push("ruta");
        if (!String(row.estatus_operativo || "").trim()) missing.push("estatus");
        if (missing.length) rowErrors.push(`Fila ${index + 1}: falta ${missing.join(", ")}.`);
      });

      if (rowErrors.length) {
        setErrors({ local_batch: rowErrors.join(" ") });
        return;
      }

      try {
        const groupBase = modal.mode === "create"
          ? String(form.codigo_asignacion || nextCode("ASG"))
          : localGroupKey(form.codigo_asignacion);

        const originalRows = modal.mode === "edit" ? getLocalGroupRows(groupBase) : [];
        const activeExistingIds = new Set<number>(
          activeRows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0)
        );

        // Primero elimina las filas que el usuario quitó. Esto también libera su código
        // (por ejemplo -02) antes de renumerar las líneas que permanecen.
        for (const oldRow of originalRows) {
          if (!activeExistingIds.has(Number(oldRow.id))) {
            await apiRequest(`/operaciones/asignaciones/${oldRow.id}`, { method: "DELETE" });
          }
        }

        for (let index = 0; index < activeRows.length; index += 1) {
          const row = activeRows[index];
          const existingTimeline = Array.isArray(row.estatus_seguimiento)
            ? row.estatus_seguimiento.filter((status: AnyRow) => String(status.estatus || "").trim())
            : [];
          const currentStatus = String(row.estatus_operativo || "").trim();
          const previousStatus = String(existingTimeline[existingTimeline.length - 1]?.estatus || "").trim();
          const timeline = !existingTimeline.length
            ? [{
                fecha: row.fecha_carga || new Date().toISOString().slice(0, 10),
                hora: row.hora_carga || "08:00",
                estatus: currentStatus,
              }]
            : currentStatus && currentStatus !== previousStatus
            ? [
                ...existingTimeline,
                {
                  fecha: new Date().toISOString().slice(0, 10),
                  hora: new Date().toTimeString().slice(0, 5),
                  estatus: currentStatus,
                },
              ]
            : existingTimeline;

          const lineCode = index === 0
            ? groupBase
            : `${groupBase}-${String(index + 1).padStart(2, "0")}`;

          const payload = buildOperationalPayload(
            {
              ...row,
              codigo_asignacion: lineCode,
              estado_asignacion_id: form.estado_asignacion_id || row.estado_asignacion_id || 1,
              estatus_seguimiento: timeline,
            },
            "local"
          );
          payload.codigo_asignacion = lineCode;

          if (row.id) {
            await apiRequest(`/operaciones/asignaciones/${row.id}`, {
              method: "PUT",
              body: JSON.stringify(payload),
            });
          } else {
            const created = await apiRequest<AnyRow>("/operaciones/asignaciones", {
              method: "POST",
              body: JSON.stringify(payload),
            });
            void created;
          }
        }


        setModal({ open: false, mode: "create", type: "local" });
        setLocalBatchRows([]);
        setNotice(
          modal.mode === "create"
            ? `${activeRows.length} línea${activeRows.length === 1 ? "" : "s"} Local guardada${activeRows.length === 1 ? "" : "s"} en ${groupBase}.`
            : `Asignación Local ${groupBase} actualizada con ${activeRows.length} línea${activeRows.length === 1 ? "" : "s"}.`
        );
        await loadData();
        setTimeout(() => setNotice(""), 3000);
      } catch (error: any) {
        setApiError(error.message || "No se pudieron guardar las líneas de la asignación Local.");
      }
      return;
    }

    if (!validateOperational()) return;
    const payload = buildOperationalPayload(form, modal.type);

    try {
      await apiRequest(
        modal.mode === "create" ? "/operaciones/asignaciones" : `/operaciones/asignaciones/${form.id}`,
        { method: modal.mode === "create" ? "POST" : "PUT", body: JSON.stringify(payload) }
      );
      setModal({ open: false, mode: "create", type: modal.type });
      setNotice(`${TYPE_META[modal.type].singular} guardada correctamente.`);
      await loadData();
      setTimeout(() => setNotice(""), 2500);
    } catch (error: any) {
      setApiError(error.message || "No se pudo guardar la asignación.");
    }
  };

  const markFinalized = async (item: AnyRow) => {
    try {
      const type =
        item.tipo_asignacion ||
        parseJson(item.detalle_operativo_json).tipo_asignacion ||
        "local";

      const targets =
        type === "local"
          ? (
              Array.isArray(item._localGroupRows) &&
              item._localGroupRows.length
                ? item._localGroupRows
                : getLocalGroupRows(item)
            )
          : [item];

      // Guardamos el estado anterior para que el botón "Regresar"
      // pueda devolver la operación a su estado previo.
      const previousStates = readPreviousFinalStates();

      targets.forEach((target) => {
        const stateId = Number(
          target.estado_asignacion_id ||
          target.estado_id ||
          0
        );

        if (target.id && stateId > 0) {
          previousStates[String(target.id)] = stateId;
        }
      });

      writePreviousFinalStates(previousStates);

      for (const target of targets) {
        await apiRequest(
          `/operaciones/asignaciones/${target.id}/finalizar`,
          { method: "PATCH" }
        );
      }

      // No hacemos loadData() inmediatamente.
      // Ese reload hacía que Local se reagrupara y pareciera moverse o desaparecer.
      // Actualizamos únicamente las filas finalizadas dentro del estado actual,
      // conservando exactamente el mismo orden visual.
      const finalState =
        estadosAsignacion.find((state) =>
          String(state.nombre_estado_asignacion || "")
            .toLowerCase()
            .includes("final")
        );

      const finalStateId = Number(finalState?.id || 0);

      const targetIds = new Set(
        targets.map((target) => Number(target.id))
      );

      setAsignaciones((current) =>
        current.map((row) => {
          if (!targetIds.has(Number(row.id))) {
            return row;
          }

          return {
            ...row,
            ...(finalStateId > 0
              ? {
                  estado_asignacion_id: finalStateId,
                  estado_id: finalStateId,
                }
              : {
                  estado: "Finalizado",
                }),
            cierre_operacion: true,
          };
        })
      );

      setNotice(
        targets.length > 1
          ? `${localGroupKey(item)} finalizada. Sus ${targets.length} líneas permanecen visibles en Local y también están en Cierre / Excel final.`
          : `${TYPE_META[type as AssignmentType].label} finalizada. Permanece visible en su módulo y también está en Cierre / Excel final.`
      );

      setTimeout(() => setNotice(""), 3500);
    } catch (error: any) {
      setApiError(
        error.message ||
        "No se pudo finalizar la operación."
      );
    }
  };

  const openQuickCreate = (type: "cliente" | "piloto" | "ruta", target: { batchIndex?: number; field?: string } | null = null) => {
    setQuickError("");
    setQuickTarget(target);
    setQuickModal({ open: true, type });
    setQuickForm(
      type === "cliente"
        ? {
            nombre_empresa: "",
            nit: "",
            direccion: "",
            representante: "",
            cargo: "Contacto principal",
            correo: "",
            prefijo_telefonico_id1: prefijos.find((p) => p.codigo_pais === "GT")?.id || 1,
            telefono1: "",
            prefijo_telefonico_id2: prefijos.find((p) => p.codigo_pais === "GT")?.id || 1,
            telefono2: "",
            prefijo_telefonico_id3: prefijos.find((p) => p.codigo_pais === "GT")?.id || 1,
            telefono3: "",
          }
        : type === "piloto"
        ? { piloto: "", licencia: "" }
        : { codigo_ruta: "", origen: "", destino: "", km: "" }
    );
  };

  const saveQuickCreate = async () => {
    try {
      setQuickError("");
      if (quickModal.type === "cliente") {
        if (!String(quickForm.nombre_empresa || "").trim()) {
          setQuickError("Ingresa el nombre de la empresa.");
          return;
        }
        if (!String(quickForm.nit || "").trim()) {
          setQuickError("Ingresa el NIT del cliente (puedes usar CF cuando corresponda).");
          return;
        }
        if (quickForm.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(quickForm.correo).trim())) {
          setQuickError("Ingresa un correo válido para el contacto.");
          return;
        }
      }
      if (quickModal.type === "piloto" && (!String(quickForm.piloto || "").trim() || !String(quickForm.licencia || "").trim())) {
        setQuickError("Ingresa nombre y licencia del piloto.");
        return;
      }
      if (quickModal.type === "ruta" && (!String(quickForm.origen || "").trim() || !String(quickForm.destino || "").trim())) {
        setQuickError("Ingresa origen y destino de la ruta.");
        return;
      }

      const endpoint = quickModal.type === "cliente"
        ? "/clientes"
        : quickModal.type === "piloto"
        ? "/operaciones/catalogos/pilotos"
        : "/operaciones/catalogos/rutas";

      const created = await apiRequest<AnyRow>(endpoint, {
        method: "POST",
        body: JSON.stringify(quickForm),
      });

      if (quickTarget?.batchIndex !== undefined) {
        setLocalBatchRows((prev) => prev.map((row, index) => {
          if (index !== quickTarget.batchIndex) return row;
          if (quickModal.type === "cliente") return { ...row, cliente_id: created.id };
          if (quickModal.type === "piloto") return { ...row, pilotos_id: created.id, licencia: created.licencia || quickForm.licencia };
          return {
            ...row,
            ruta_id: created.id,
            ruta_codigo: created.codigo_ruta || quickForm.codigo_ruta,
            origen: created.origen || quickForm.origen,
            destino: created.destino || quickForm.destino,
          };
        }));
      } else if (quickModal.type === "cliente") {
        setForm((prev: AnyRow) => ({ ...prev, cliente_id: created.id }));
      } else if (quickModal.type === "piloto") {
        setForm((prev: AnyRow) => ({ ...prev, pilotos_id: created.id, licencia: created.licencia || quickForm.licencia }));
      } else {
        setForm((prev: AnyRow) => ({
          ...prev,
          ruta_id: created.id,
          ruta_codigo: created.codigo_ruta || quickForm.codigo_ruta,
          origen: created.origen || quickForm.origen,
          destino: created.destino || quickForm.destino,
        }));
      }

      setQuickTarget(null);
      setQuickModal({ open: false, type: quickModal.type });
      await loadData();
      setNotice(`${quickModal.type === "cliente" ? "Cliente" : quickModal.type === "piloto" ? "Piloto" : "Ruta"} creado correctamente.`);
      setTimeout(() => setNotice(""), 2200);
    } catch (error: any) {
      setQuickError(error.message || "No se pudo crear el registro.");
    }
  };

  const openClosing = (mode: Mode, item: AnyRow) => {
    setClosingErrors({});
    setClosingModal({ open: true, mode });
    setClosingForm({
      ...item,
      proveedor_id: item.proveedor_id || "",
      doc: item.doc || item.documentos || "Pendiente",
      marchamo: parseJson(item.detalle_operativo_json).marchamo || item.marchamo || "",
      auxiliar: item.costo_auxiliar || item.auxiliar || 0,
      flete: item.flete || 0,
      parada_adicional: item.parada_adicional || 0,
      movimiento_falso: item.movimiento_falso || 0,
      estadia: item.estadia || 0,
      viaje_doble: item.viaje_doble || 0,
      otros: item.otros || 0,
      total: item.total || 0,
      fechaProveedor: date10(item.fechaProveedor || item.fecha_proveedor),
      serieProveedor: item.serieProveedor || item.serie_proveedor || "",
      numeroProveedor: item.numeroProveedor || item.numero_proveedor || "",
      fleteProveedor: item.fleteProveedor || item.flete_proveedor || 0,
      cuadrilla: item.cuadrilla || 0,
      estadiaProveedor: item.estadiaProveedor || item.estadia_proveedor || 0,
      totalProveedor: item.totalProveedor || item.total_proveedor || 0,
      fechaPagoProveedor: date10(item.fechaPagoProveedor || item.fecha_pago_proveedor),
      fechaFactura: date10(item.fechaFactura || item.fecha_factura),
      serieFactura: item.serieFactura || item.serie_factura || "",
      numeroFactura: item.numeroFactura || item.numero_factura || "",
      valorFactura: item.valorFactura || item.valor_factura || item.total || 0,
      fechaPagoFactura: date10(item.fechaPagoFactura || item.fecha_pago_factura),
      vendedor_id: item.vendedor_id || usuarios[0]?.id || "",
    });
  };

  const patchClosingMoney = (field: string, raw: string) => {
    const next = { ...closingForm, [field]: numeric(cleanNum(raw)) };
    if (["auxiliar", "flete", "parada_adicional", "movimiento_falso", "estadia", "viaje_doble", "otros"].includes(field)) {
      next.total =
        numeric(next.auxiliar) + numeric(next.flete) + numeric(next.parada_adicional) +
        numeric(next.movimiento_falso) + numeric(next.estadia) + numeric(next.viaje_doble) + numeric(next.otros);
      if (!numeric(next.valorFactura)) next.valorFactura = next.total;
    }
    if (["fleteProveedor", "cuadrilla", "estadiaProveedor"].includes(field)) {
      next.totalProveedor = numeric(next.fleteProveedor) + numeric(next.cuadrilla) + numeric(next.estadiaProveedor);
    }
    setClosingForm(next);
  };

  const saveClosing = async () => {
    const e: Record<string, string> = {};
    if (!closingForm.proveedor_id) e.proveedor_id = "Selecciona el proveedor que realizó el servicio.";
    if (numeric(closingForm.total) <= 0) e.total = "Ingresa los costos/ingresos del servicio.";
    if (numeric(closingForm.totalProveedor) > numeric(closingForm.total)) e.margen = "El costo del proveedor supera el total del cliente.";
    setClosingErrors(e);
    if (Object.keys(e).length) return;

    try {
      await apiRequest(`/operaciones/asignaciones/${closingForm.id}/cierre`, {
        method: "PUT",
        body: JSON.stringify({ ...closingForm, cierre_operacion: true, costo_auxiliar: closingForm.auxiliar }),
      });
      setClosingModal({ open: false, mode: "edit" });
      setNotice("Cierre operativo guardado. El registro quedó listo para exportar al Excel final.");
      await loadData();
      setTimeout(() => setNotice(""), 3000);
    } catch (error: any) {
      setApiError(error.message || "No se pudo guardar el cierre.");
    }
  };

  const reopenFromFinal = async (item: AnyRow) => {
    try {
      const detail = parseJson(
        item.detalle_operativo_json
      );

      const type = String(
        item.tipo_asignacion ||
        detail.tipo_asignacion ||
        "local"
      ) as AssignmentType;

      const targets =
        type === "local"
          ? getLocalGroupRows(item)
          : [item];

      const previousStates = readPreviousFinalStates();

      // Para registros finalizados antes de esta mejora, usamos un estado
      // operativo razonable como respaldo.
      const fallbackState =
        estadosAsignacion.find((state) =>
          String(
            state.nombre_estado_asignacion || ""
          )
            .toLowerCase()
            .includes("en ruta")
        ) ||
        estadosAsignacion.find((state) =>
          String(
            state.nombre_estado_asignacion || ""
          )
            .toLowerCase()
            .includes("asignado")
        ) ||
        estadosAsignacion.find((state) =>
          String(
            state.nombre_estado_asignacion || ""
          )
            .toLowerCase()
            .includes("pendiente")
        ) ||
        estadosAsignacion.find(
          (state) =>
            !String(
              state.nombre_estado_asignacion || ""
            )
              .toLowerCase()
              .includes("final")
        );

      if (!fallbackState?.id) {
        throw new Error(
          "No se encontró un estado operativo para regresar la asignación."
        );
      }

      for (const target of targets) {
        const targetDetail = parseJson(
          target.detalle_operativo_json
        );

        const previousStateId =
          Number(
            previousStates[String(target.id)]
          ) || Number(fallbackState.id);

        // Al regresar desde Cierre / Excel final NO debemos perder el
        // estatus operativo original. El backend valida que una asignación
        // Local tenga al menos un estatus antes de permitir el UPDATE.
        const rawStatuses = Array.isArray(
          target.estatus_seguimiento
        )
          ? target.estatus_seguimiento
          : Array.isArray(
              targetDetail.estatus_seguimiento
            )
          ? targetDetail.estatus_seguimiento
          : [];

        const cleanStatuses = rawStatuses
          .map((row: AnyRow) => ({
            fecha:
              row?.fecha ||
              date10(
                target.fecha_carga ||
                targetDetail.fecha_carga
              ) ||
              new Date()
                .toISOString()
                .slice(0, 10),
            hora:
              row?.hora ||
              targetDetail.hora_carga ||
              "08:00",
            estatus: String(
              row?.estatus || ""
            ).trim(),
          }))
          .filter((row: AnyRow) =>
            String(row.estatus || "").trim()
          );

        const previousOperationalStatus =
          [...cleanStatuses]
            .reverse()
            .find((row: AnyRow) =>
              String(row.estatus || "").trim()
            )?.estatus ||
          String(
            target.estatus_operativo ||
              targetDetail.estatus_operativo ||
              ""
          ).trim();

        // Registros Local creados antes de guardar el historial pueden no
        // traer estatus_seguimiento. En ese caso agregamos uno válido para
        // poder restaurarlos sin alterar los demás datos.
        const restoredStatus =
          previousOperationalStatus ||
          (type === "local"
            ? "Operación reabierta"
            : "");

        const restoredStatuses =
          cleanStatuses.length > 0
            ? cleanStatuses
            : restoredStatus
            ? [
                {
                  fecha:
                    date10(
                      target.fecha_carga ||
                      targetDetail.fecha_carga
                    ) ||
                    new Date()
                      .toISOString()
                      .slice(0, 10),
                  hora:
                    targetDetail.hora_carga ||
                    "08:00",
                  estatus: restoredStatus,
                },
              ]
            : [];

        const source = {
          ...targetDetail,
          ...target,
          pilotos_id:
            target.pilotos_id ||
            target.piloto_id,
          estatus_seguimiento:
            restoredStatuses,
          estatus_operativo:
            restoredStatus,
        };

        const payload = {
          ...buildOperationalPayload(
            source,
            type
          ),
          // Se envían también arriba para que la validación del backend
          // los encuentre independientemente de si lee el JSON o el body.
          estatus_seguimiento:
            restoredStatuses,
          estatus_operativo:
            restoredStatus,
          estado_asignacion_id:
            previousStateId,
          estado_id: previousStateId,
          cierre_operacion: false,
        };

        await apiRequest(
          `/operaciones/asignaciones/${target.id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );

        delete previousStates[
          String(target.id)
        ];
      }

      writePreviousFinalStates(
        previousStates
      );

      await loadData();

      // Lleva al usuario directamente al expediente del que salió.
      setTab(type);
      setPage(1);

      setNotice(
        type === "local" &&
        targets.length > 1
          ? `${localGroupKey(item)} regresó a Local con sus ${targets.length} líneas.`
          : `${item.codigo_asignacion} regresó a ${TYPE_META[type].label}.`
      );

      setTimeout(
        () => setNotice(""),
        3000
      );
    } catch (error: any) {
      setApiError(
        error.message ||
        "No se pudo regresar la operación."
      );
    }
  };

  const removeAssignment = async (target: AnyRow | number) => {
    try {
      const ids = typeof target === "number"
        ? [target]
        : Array.isArray(target?.ids) && target.ids.length
        ? target.ids
        : [target?.id].filter(Boolean);

      for (const id of ids) {
        await apiRequest(`/operaciones/asignaciones/${id}`, { method: "DELETE" });
      }
      setDeleteBox(null);
      setNotice(ids.length > 1 ? `Se eliminaron las ${ids.length} líneas de la asignación Local.` : "Asignación eliminada correctamente.");
      await loadData();
      setTimeout(() => setNotice(""), 2500);
    } catch (error: any) {
      setApiError(error.message || "No se pudo eliminar la asignación.");
    }
  };

  const downloadAssignmentPdf = async (item: AnyRow) => {
    const detail = parseJson(item.detalle_operativo_json);
    const type = (item.tipo_asignacion || detail.tipo_asignacion || "local") as AssignmentType;
    const cliente = getCliente(item.cliente_id)?.nombre_empresa || item.cliente || "-";
    const pilotRow = getPiloto(item.piloto_id || item.pilotos_id);
    const piloto = fullPilot(pilotRow) || item.piloto || "-";
    const veh = getVehiculo(item.vehiculo_id);
    const route = getRuta(item.ruta_id);
    const origin = detail.origen || route?.origen || item.origen || "-";
    const destination = detail.destino || route?.destino || item.destino || "-";
    const license = detail.licencia || item.licencia || pilotRow?.licencia || "-";
    const logo = await imageUrlToDataUrl(logoEmpresa);
    const latest = [...(Array.isArray(detail.estatus_seguimiento) ? detail.estatus_seguimiento : [])].reverse().find((x: AnyRow) => String(x.estatus || "").trim());

    const drawLogo = (doc: jsPDF, x: number, y: number, w: number, h: number) => {
      if (!logo) return;
      try { doc.addImage(logo, "PNG", x, y, w, h); } catch {}
    };

    const textInCell = (doc: jsPDF, value: any, x: number, y: number, w: number, h: number, opts: AnyRow = {}) => {
      doc.setFont("helvetica", opts.bold ? "bold" : "normal");
      doc.setFontSize(opts.size || 8);
      doc.setTextColor(...(opts.color || [20, 20, 20]));
      const lines = doc.splitTextToSize(String(value ?? "-"), Math.max(4, w - 3));
      const lineHeight = (opts.size || 8) * 0.38;
      const blockH = lines.length * lineHeight;
      const ty = y + Math.max(3.2, (h - blockH) / 2 + lineHeight * 0.9);
      doc.text(lines, x + (opts.center ? w / 2 : 1.7), ty, { align: opts.center ? "center" : "left" });
    };

    if (type === "local") {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageW = doc.internal.pageSize.getWidth();
      const x0 = 5;
      const peach = [247, 184, 143] as [number, number, number];
      const blue = [10, 117, 184] as [number, number, number];
      const navy = [12, 45, 107] as [number, number, number];

      doc.setFillColor(...peach);
      doc.rect(0, 0, pageW, 27, "F");
      drawLogo(doc, 7, 2, 40, 23);

      doc.setTextColor(...navy);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(21);
      doc.text("ASIGNACIONES", pageW / 2, 16, {
        align: "center",
      });

      const widths = [
        18, 18, 25, 46, 28, 19,
        17, 16, 33, 35, 32,
      ];

      const heads = [
        "Carga",
        "Descarga",
        "Cliente",
        "Piloto",
        "Licencia",
        "Placa",
        "Furgón",
        "Tipo",
        "Origen",
        "Destino",
        "Estatus",
      ];

      // Primera franja azul para imitar la hoja original.
      // "Unidad" agrupa Placa, Furgón y Tipo.
      const yGroup = 34;
      const groupH = 9;
      const beforeUnit = widths
        .slice(0, 5)
        .reduce((sum, value) => sum + value, 0);
      const unitWidth = widths
        .slice(5, 8)
        .reduce((sum, value) => sum + value, 0);
      const afterUnit = widths
        .slice(8)
        .reduce((sum, value) => sum + value, 0);

      doc.setFillColor(...blue);
      doc.setDrawColor(40, 40, 40);
      doc.rect(x0, yGroup, beforeUnit, groupH, "FD");
      doc.rect(
        x0 + beforeUnit,
        yGroup,
        unitWidth,
        groupH,
        "FD"
      );
      doc.rect(
        x0 + beforeUnit + unitWidth,
        yGroup,
        afterUnit,
        groupH,
        "FD"
      );

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(
        "Unidad",
        x0 + beforeUnit + unitWidth / 2,
        yGroup + 5.8,
        { align: "center" }
      );

      // Segunda franja: nombres de columnas.
      // Dibujamos texto directamente para evitar que queden en blanco.
      const yHead = yGroup + groupH;
      const headH = 11;
      let x = x0;

      widths.forEach((w, i) => {
        doc.setFillColor(...blue);
        doc.setDrawColor(40, 40, 40);
        doc.rect(x, yHead, w, headH, "FD");

        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.2);

        const labelLines = doc.splitTextToSize(
          heads[i],
          Math.max(7, w - 2)
        );

        const lineHeight = 3;
        const blockHeight = labelLines.length * lineHeight;
        const labelY =
          yHead +
          (headH - blockHeight) / 2 +
          lineHeight * 0.8;

        doc.text(labelLines, x + w / 2, labelY, {
          align: "center",
        });

        x += w;
      });

      const pdfRows = (Array.isArray(item._localGroupRows) && item._localGroupRows.length
        ? item._localGroupRows
        : getLocalGroupRows(item)
      ).sort((a: AnyRow, b: AnyRow) => localLineNumber(a) - localLineNumber(b));

      const rowH = Math.max(12, Math.min(22, 88 / Math.max(1, pdfRows.length)));
      let currentY = yHead + headH;

      pdfRows.forEach((row: AnyRow) => {
        const rowDetail = parseJson(row.detalle_operativo_json);
        const rowClient = getCliente(row.cliente_id)?.nombre_empresa || row.cliente || "-";
        const rowPilot = getPiloto(row.piloto_id || row.pilotos_id);
        const rowVehicle = getVehiculo(row.vehiculo_id);
        const rowRoute = getRuta(row.ruta_id);
        const rowTimeline = Array.isArray(rowDetail.estatus_seguimiento) ? rowDetail.estatus_seguimiento : [];
        const rowLatest = [...rowTimeline].reverse().find((status: AnyRow) => String(status.estatus || "").trim());
        const formatLocalPdfDate = (value: any) => {
          const raw = date10(value);
          if (!raw) return "-";

          const parts = raw.split("-");
          if (parts.length !== 3) return raw;

          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        };

        const rowValues = [
          formatLocalPdfDate(row.fecha_carga),
          formatLocalPdfDate(row.fecha_descarga),
          rowClient,
          fullPilot(rowPilot) || row.piloto || "-",
          rowDetail.licencia || row.licencia || rowPilot?.licencia || "-",
          rowDetail.placa_operativa || rowVehicle?.codigo || "-",
          rowDetail.furgon || "N/A",
          rowDetail.tipo || rowVehicle?.tipo || rowVehicle?.nombre_tipo_vehiculo || "-",
          rowDetail.origen || rowRoute?.origen || row.origen || "-",
          rowDetail.destino || rowRoute?.destino || row.destino || "-",
          rowLatest?.estatus || rowDetail.estatus_operativo || "-",
        ];

        x = x0;
        widths.forEach((w, i) => {
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(75, 75, 75);
          doc.rect(x, currentY, w, rowH, "FD");
          textInCell(doc, rowValues[i], x, currentY, w, rowH, {
            center: true,
            bold: i === 10,
            color: i === 10 ? [220, 30, 30] : [20, 20, 20],
            size:
              i === 0 || i === 1
                ? (pdfRows.length > 4 ? 5.9 : 6.5)
                : (pdfRows.length > 4 ? 6.3 : 7.2),
          });
          x += w;
        });
        currentY += rowH;
      });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...navy);
      doc.text(
        `${localGroupKey(item)} · ${pdfRows.length} línea${pdfRows.length === 1 ? "" : "s"} de asignación`,
        x0,
        Math.min(198, currentY + 7)
      );

      doc.save(`Local_${localGroupKey(item) || item.id}.pdf`);
      return;
    }

    if (type === "fiduca") {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      drawLogo(doc, 70, 8, 70, 34);
      const pp = detail.pais_piloto === "Otro" ? detail.pais_piloto_otro : detail.pais_piloto;
      const pt = detail.pais_transportista === "Otro" ? detail.pais_transportista_otro : detail.pais_transportista;
      const rowsPdf = [
        ["PILOTO", piloto], ["PLACA PILOTO", detail.placa_piloto || "-"], ["LICENCIA", license],
        ["PAÍS", pp || "-"], ["DPI", detail.dpi_piloto || "-"], ["FECHA DE NACIMIENTO", detail.fecha_nacimiento_piloto || "-"],
        ["NIT PILOTO", detail.nit_piloto || "-"], ["TRANSPORTES", detail.empresa_transporte || "-"],
        ["NIT TRANSPORTISTA", detail.nit_transportista || "-"], ["PAÍS", pt || "-"], ["CAAT", detail.caat || "-"],
        ["NÚMERO ECONÓMICO", detail.numero_economico || "-"], ["FIANZA", detail.fianza || "N/A"], ["CÓDIGO ADUANERO", detail.codigo_aduanero || "N/A"],
      ];
      let y = 48; const x = 18; const lw = 60; const vw = 114; const rh = 10;
      rowsPdf.forEach((r, i) => {
        const bg = i % 2 === 0 ? [217,229,242] : [255,255,255];
        doc.setFillColor(...bg); doc.rect(x,y,lw+vw,rh,"F"); doc.setDrawColor(30,30,30); doc.rect(x,y,lw,rh); doc.rect(x+lw,y,vw,rh);
        textInCell(doc,r[0],x,y,lw,rh,{bold:true,color:[35,74,115],size:8}); textInCell(doc,r[1],x+lw,y,vw,rh,{color:[35,74,115],size:8});
        y += rh;
      });
      doc.save(`FYDUCA_${item.codigo_asignacion || item.id}.pdf`);
      return;
    }

    if (type === "centroamerica") {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      drawLogo(doc, pageW/2 - 25, 5, 50, 25);
      const orange = [255,153,61];
      doc.setDrawColor(15,96,135); doc.rect(20,3,pageW-40,30);
      doc.setFillColor(...orange); doc.rect(20,34,pageW-40,11,"F");
      textInCell(doc,"DATOS DE EQUIPO",20,34,pageW-40,11,{center:true,size:14});
      const rowsPdf = [
        ["RUTA", detail.ruta_codigo || route?.codigo_ruta || rutaLabel(route)], ["NOMBRE DE PILOTO", piloto], ["LICENCIA", license],
        ["DPI", detail.dpi_piloto || "-"], ["PASAPORTE", detail.pasaporte || "N/A"], ["CABEZAL", detail.cabezal || veh?.codigo || "-"],
        ["FURGÓN", detail.furgon || "N/A"], ["CÓDIGO", detail.codigo_equipo || "N/A"], ["FIANZA", detail.fianza || "N/A"],
        ["TAMAÑO", detail.tamano_equipo || "-"], ["NOMBRE DE TRANSPORTE", detail.empresa_transporte || "-"],
        ["FECHA DE POSICIONAMIENTO", `${detail.fecha_posicionamiento || "-"}${detail.hora_posicionamiento ? ` ${detail.hora_posicionamiento}` : ""}`],
      ];
      let y=45; const x=20; const lw=105; const vw=pageW-40-lw; const rh=10;
      rowsPdf.forEach((r)=>{ doc.setFillColor(...orange); doc.rect(x,y,lw,rh,"F"); doc.setFillColor(255,255,255); doc.rect(x+lw,y,vw,rh,"F"); doc.setDrawColor(15,96,135); doc.rect(x,y,lw,rh); doc.rect(x+lw,y,vw,rh); textInCell(doc,r[0],x,y,lw,rh,{size:10}); textInCell(doc,r[1],x+lw,y,vw,rh,{center:true,size:10}); y+=rh; });
      doc.save(`Centroamerica_${item.codigo_asignacion || item.id}.pdf`);
      return;
    }

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const blue = [54,93,157]; const orange = [255,153,61];
    drawLogo(doc, 5, 4, 48, 26);
    doc.setFillColor(...blue); doc.rect(55,0,pageW-55,32,"F");
    textInCell(doc,"ASIGNACIÓN UNIDAD Y PILOTO",55,0,pageW-55,32,{center:true,color:[255,255,255],size:18});
    const top = [
      ["Cliente", cliente, "Origen", origin, "Destino", destination],
      ["Piloto", piloto, "Licencia", license, "Unidad", detail.unidad || veh?.codigo || "-"],
      ["CAAT", detail.caat || "-", "Número económico", detail.numero_economico || "-", "Tamaño", detail.tamano_equipo || "-"],
      ["Nombre del Transporte", detail.empresa_transporte || "-", "Fecha de carga", `${date10(item.fecha_carga)} ${detail.hora_carga || ""}`.trim(), "Días de servicio", detail.dias_servicio || 1],
    ];
    let y=32; const widths=[55,67,41,55,34,45];
    top.forEach((r)=>{ let x=0; r.forEach((val:any,i:number)=>{ const label=i%2===0; doc.setFillColor(...(label?orange:[255,255,255])); doc.rect(x,y,widths[i],10,"F"); doc.setDrawColor(50,50,50); doc.rect(x,y,widths[i],10); textInCell(doc,val,x,y,widths[i],10,{size:8.5,bold:false}); x+=widths[i]; }); y+=10; });
    doc.setFillColor(...orange); doc.rect(0,y,28,9,"F"); doc.rect(28,y,28,9,"F"); doc.rect(56,y,pageW-56,9,"F");
    textInCell(doc,"Fecha",0,y,28,9,{center:true,size:10}); textInCell(doc,"Hora",28,y,28,9,{center:true,size:10}); textInCell(doc,"Estatus",56,y,pageW-56,9,{center:true,size:10}); y+=9;
    const timeline = Array.isArray(detail.estatus_seguimiento) ? detail.estatus_seguimiento : [];
    const statusRows = timeline.length ? timeline : [{fecha:"",hora:"",estatus:""},{fecha:"",hora:"",estatus:""},{fecha:"",hora:"",estatus:""},{fecha:"",hora:"",estatus:""}];
    statusRows.forEach((s:AnyRow)=>{ doc.rect(0,y,28,10); doc.rect(28,y,28,10); doc.rect(56,y,pageW-56,10); textInCell(doc,s.fecha||"",0,y,28,10,{center:true}); textInCell(doc,s.hora||"",28,y,28,10,{center:true}); textInCell(doc,s.estatus||"",56,y,pageW-56,10,{}); y+=10; });
    doc.save(`Internacional_${item.codigo_asignacion || item.id}.pdf`);
  };

  const downloadFinalClosurePdf = async (item: AnyRow) => {
    try {
      const detail = parseJson(
        item.detalle_operativo_json
      );

      // Helpers propios de este PDF individual.
      // Antes dependían de funciones locales de otro PDF
      // y por eso el botón podía no generar ningún archivo.
      const logo = await imageUrlToDataUrl(
        logoEmpresa
      );

      const drawLogo = (
        doc: jsPDF,
        x: number,
        y: number,
        w: number,
        h: number
      ) => {
        if (!logo) return;

        try {
          doc.addImage(
            logo,
            "PNG",
            x,
            y,
            w,
            h
          );
        } catch {
          // Si el navegador no convierte el logo,
          // el PDF sigue generándose sin bloquearse.
        }
      };

      const textInCell = (
        doc: jsPDF,
        value: any,
        x: number,
        y: number,
        w: number,
        h: number,
        opts: AnyRow = {}
      ) => {
        doc.setFont(
          "helvetica",
          opts.bold ? "bold" : "normal"
        );

        doc.setFontSize(opts.size || 8);

        doc.setTextColor(
          ...(opts.color || [20, 20, 20])
        );

        const lines = doc.splitTextToSize(
          String(value ?? "-"),
          Math.max(4, w - 3)
        );

        const lineHeight =
          (opts.size || 8) * 0.38;

        const blockH =
          lines.length * lineHeight;

        const ty =
          y +
          Math.max(
            3.2,
            (h - blockH) / 2 +
              lineHeight * 0.9
          );

        doc.text(
          lines,
          x +
            (opts.center
              ? w / 2
              : 1.7),
          ty,
          {
            align: opts.center
              ? "center"
              : "left",
          }
        );
      };
    const cliente =
      getCliente(item.cliente_id)?.nombre_empresa ||
      item.cliente ||
      item.nombre_empresa ||
      "-";
    const pilotoObj = getPiloto(item.piloto_id || item.pilotos_id);
    const piloto = fullPilot(pilotoObj) || item.piloto || "-";
    const veh = getVehiculo(item.vehiculo_id);
    const ruta = getRuta(item.ruta_id);
    const proveedor = getProveedor(item.proveedor_id);
    const tipo = (item.tipo_asignacion || detail.tipo_asignacion || "local") as AssignmentType;

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 10;
    const usableW = pageW - margin * 2;

    const blue: [number, number, number] = [27, 111, 143];
    const navy: [number, number, number] = [12, 45, 107];
    const green: [number, number, number] = [66, 199, 75];
    const pink: [number, number, number] = [236, 184, 222];
    const yellow: [number, number, number] = [255, 242, 0];
    const lightGray: [number, number, number] = [248, 249, 251];

    const drawTable = (
      y: number,
      title: string,
      headers: string[],
      values: any[],
      widths: number[],
      headerColor: [number, number, number],
      options: { pinkText?: boolean; operation?: boolean } = {}
    ) => {
      doc.setFillColor(...headerColor);
      doc.rect(margin, y, usableW, 8, "F");
      doc.setDrawColor(55, 55, 55);
      doc.rect(margin, y, usableW, 8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(options.pinkText ? 110 : 255, options.pinkText ? 24 : 255, options.pinkText ? 38 : 255);
      doc.text(title, margin + usableW / 2, y + 5.3, { align: "center" });

      let x = margin;
      const headerY = y + 8;
      headers.forEach((header, index) => {
        doc.setFillColor(...headerColor);
        doc.setDrawColor(70, 70, 70);
        doc.rect(x, headerY, widths[index], 9, "FD");
        textInCell(doc, header, x, headerY, widths[index], 9, {
          center: true,
          bold: true,
          size: 5.4,
          color: options.pinkText ? [110, 24, 38] : [255, 255, 255],
        });
        x += widths[index];
      });

      x = margin;
      const dataY = headerY + 9;
      values.forEach((value, index) => {
        let fill = lightGray;

        // Igual al Excel de la empresa: origen/destino amarillos y Doc verde.
        if (options.operation && (index === 10 || index === 11)) fill = yellow;
        if (options.operation && index === 12) fill = [116, 235, 116];

        doc.setFillColor(...fill);
        doc.setDrawColor(80, 80, 80);
        doc.rect(x, dataY, widths[index], 18, "FD");

        const isMarchamo = options.operation && index === 4;
        textInCell(doc, value ?? "", x, dataY, widths[index], 18, {
          center: index !== 4 && index !== 5 && index !== 10 && index !== 11 && index !== 24,
          size: 5.3,
          bold: false,
          color: isMarchamo ? [215, 35, 35] : [20, 20, 20],
        });
        x += widths[index];
      });

      return dataY + 18;
    };

    // Encabezado tipo reporte final, NO el PDF Local.
    drawLogo(doc, margin, 5, 38, 22);
    doc.setTextColor(...navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("CIERRE FINAL DE OPERACIÓN", pageW / 2, 14, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(
      `${item.codigo_asignacion || ""} · ${TYPE_META[tipo]?.label || tipo} · formato basado en Asignaciones unidades GL365`,
      pageW / 2,
      20,
      { align: "center" }
    );

    const operationHeaders = [
      "Cliente", "Carga", "Descarga", "Estadía", "Marchamo", "Piloto", "Licencia",
      "Cabezal", "Furgón", "Tipo", "Origen", "Destino", "Doc", "Km", "Vendedor",
      "Auxiliar", "Flete", "Parada adicional", "Mov en falso", "Estadía", "Viaje doble",
      "Otros", "Total"
    ];

    const operationWidths = [
      28, 14, 14, 10, 30, 30, 20, 16, 16, 12, 28, 28, 12, 10, 18, 14, 14, 16, 14, 14, 14, 12, 16
    ];

    const operationValues = [
      cliente,
      date10(item.fecha_carga),
      date10(item.fecha_descarga),
      detail.cantidad_estadias || "",
      detail.marchamo || item.marchamo || "",
      piloto,
      item.licencia || pilotoObj?.licencia || "",
      veh?.codigo || item.cabezal || "",
      item.furgon || "",
      veh?.tipo || veh?.nombre_tipo_vehiculo || item.tipo || TYPE_META[tipo]?.label || "",
      ruta?.origen || item.origen || "",
      ruta?.destino || item.destino || "",
      item.doc || item.documentos || "",
      item.km || ruta?.distancia_km || "",
      item.vendedor || item.vendedor_nombre || "",
      money(numeric(item.costo_auxiliar || item.auxiliar)),
      money(numeric(item.flete)),
      money(numeric(item.parada_adicional)),
      money(numeric(item.movimiento_falso)),
      money(numeric(item.estadia)),
      money(numeric(item.viaje_doble)),
      money(numeric(item.otros)),
      money(numeric(item.total)),
    ];

    let y = drawTable(
      29,
      "OPERACIÓN / COSTOS DEL CLIENTE",
      operationHeaders,
      operationValues,
      operationWidths,
      blue,
      { operation: true }
    );

    y += 7;

    const providerHeaders = [
      "Fecha", "Proveedor", "Serie", "Número", "Flete", "Cuadrilla", "Estadía", "Total", "Fecha pago"
    ];
    const providerWidths = [34, 92, 42, 48, 38, 38, 38, 38, 32];
    const providerValues = [
      date10(item.fechaProveedor || item.fecha_proveedor),
      proveedor?.razon_social || proveedor?.nombre_comercial || item.proveedor || "",
      item.serieProveedor || item.serie_proveedor || "",
      item.numeroProveedor || item.numero_proveedor || "",
      money(numeric(item.fleteProveedor || item.flete_proveedor)),
      money(numeric(item.cuadrilla)),
      money(numeric(item.estadiaProveedor || item.estadia_proveedor)),
      money(numeric(item.totalProveedor || item.total_proveedor)),
      date10(item.fechaPagoProveedor || item.fecha_pago_proveedor),
    ];

    y = drawTable(
      y,
      "COSTOS FACTURA / PROVEEDOR",
      providerHeaders,
      providerValues,
      providerWidths,
      green
    );

    y += 7;

    const invoiceHeaders = ["Fecha", "Serie", "Número", "Valor", "Fecha pago"];
    const invoiceWidths = [80, 80, 80, 80, 80];
    const invoiceValues = [
      date10(item.fechaFactura || item.fecha_factura),
      item.serieFactura || item.serie_factura || "",
      item.numeroFactura || item.numero_factura || "",
      money(numeric(item.valorFactura || item.valor_factura || item.total)),
      date10(item.fechaPagoFactura || item.fecha_pago_factura),
    ];

    y = drawTable(
      y,
      "FACTURA GRUPO LOGÍSTICO 365 A CLIENTES",
      invoiceHeaders,
      invoiceValues,
      invoiceWidths,
      pink,
      { pinkText: true }
    );

    const totalCliente = numeric(item.total);
    const totalProveedor = numeric(item.totalProveedor || item.total_proveedor);
    const margen = totalCliente - totalProveedor;

    y += 9;
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(margin, y, 130, 20, 3, 3, "F");
    doc.setTextColor(...navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Total cliente: ${money(totalCliente)}`, margin + 6, y + 6);
    doc.text(`Total proveedor: ${money(totalProveedor)}`, margin + 6, y + 12);
    doc.setTextColor(margen >= 0 ? 0 : 190, margen >= 0 ? 140 : 30, 60);
    doc.text(`Margen: ${money(margen)}`, margin + 6, y + 18);

      doc.save(
        `Cierre_Final_${
          item.codigo_asignacion ||
          item.id
        }.pdf`
      );

      setNotice(
        `PDF individual ${
          item.codigo_asignacion || ""
        } generado correctamente.`
      );
    } catch (error: any) {
      console.error(
        "Error al generar PDF individual:",
        error
      );

      setApiError(
        error?.message ||
          "No se pudo generar el PDF individual del cierre."
      );
    }
  };

  const exportFinalExcel = () => {
    const finalized = asignaciones.filter(isFinalized);

    const excelDate = (value: any) => {
      const d = date10(value);
      if (!d) return "";
      const parsed = new Date(`${d}T12:00:00`);
      return Number.isNaN(parsed.getTime()) ? d : parsed;
    };

    const topHeader = Array(37).fill("");
    topHeader[23] = "COSTOS FACTURA";
    topHeader[32] = "FACTURA GRUPO LOGISTICO 365 A CLIENTES";

    const headers = [
      "Cliente",
      "Carga",
      "Descarga",
      "Estadía",
      "Marchamo",
      "Piloto",
      "Licencia",
      "Cabezal",
      "Furgón",
      "Tipo",
      "Origen",
      "Destino",
      "Doc",
      "Km",
      "Vendedor",
      "Auxiliar",
      "Flete",
      "Parada adicional",
      "Mov en falso",
      "Estadía",
      "Viaje doble",
      "Otros",
      "Total",
      "Fecha",
      "Proveedor",
      "Serie",
      "Número",
      "Flete",
      "Cuadrilla",
      "Estadía",
      "Total",
      "Fecha pago",
      "Fecha",
      "Serie",
      "Número",
      "Valor",
      "Fecha pago",
    ];

    const dataRows = finalized.map((item) => {
      const detail = parseJson(item.detalle_operativo_json);
      const cliente = getCliente(item.cliente_id)?.nombre_empresa || item.cliente || "";
      const piloto = fullPilot(getPiloto(item.piloto_id || item.pilotos_id)) || item.piloto || "";
      const veh = getVehiculo(item.vehiculo_id);
      const ruta = getRuta(item.ruta_id);
      const tipo = (item.tipo_asignacion || detail.tipo_asignacion || "local") as AssignmentType;

      return [
        cliente,
        excelDate(item.fecha_carga),
        excelDate(item.fecha_descarga),
        detail.cantidad_estadias || "",
        detail.marchamo || item.marchamo || "",
        piloto,
        item.licencia || getPiloto(item.piloto_id || item.pilotos_id)?.licencia || "",
        veh?.codigo || item.cabezal || "",
        item.furgon || "",
        veh?.tipo || veh?.nombre_tipo_vehiculo || item.tipo || TYPE_META[tipo].label,
        ruta?.origen || item.origen || "",
        ruta?.destino || item.destino || "",
        item.doc || item.documentos || "",
        item.km || ruta?.distancia_km || "",
        item.vendedor || item.vendedor_nombre || "",
        numeric(item.costo_auxiliar || item.auxiliar),
        numeric(item.flete),
        numeric(item.parada_adicional),
        numeric(item.movimiento_falso),
        numeric(item.estadia),
        numeric(item.viaje_doble),
        numeric(item.otros),
        numeric(item.total),
        excelDate(item.fechaProveedor || item.fecha_proveedor),
        getProveedor(item.proveedor_id)?.razon_social || item.proveedor || "",
        item.serieProveedor || item.serie_proveedor || "",
        item.numeroProveedor || item.numero_proveedor || "",
        numeric(item.fleteProveedor || item.flete_proveedor),
        numeric(item.cuadrilla),
        numeric(item.estadiaProveedor || item.estadia_proveedor),
        numeric(item.totalProveedor || item.total_proveedor),
        excelDate(item.fechaPagoProveedor || item.fecha_pago_proveedor),
        excelDate(item.fechaFactura || item.fecha_factura),
        item.serieFactura || item.serie_factura || "",
        item.numeroFactura || item.numero_factura || "",
        numeric(item.valorFactura || item.valor_factura || item.total),
        excelDate(item.fechaPagoFactura || item.fecha_pago_factura),
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([topHeader, headers, ...dataRows]);
    ws["!merges"] = [
      { s: { r: 0, c: 23 }, e: { r: 0, c: 31 } },
      { s: { r: 0, c: 32 }, e: { r: 0, c: 36 } },
    ];
    ws["!autofilter"] = { ref: `A2:AK${Math.max(2, dataRows.length + 2)}` };
    ws["!cols"] = [
      { wch: 24 }, { wch: 13 }, { wch: 13 }, { wch: 10 }, { wch: 24 },
      { wch: 28 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
      { wch: 26 }, { wch: 26 }, { wch: 10 }, { wch: 10 }, { wch: 18 },
      { wch: 13 }, { wch: 13 }, { wch: 17 }, { wch: 15 }, { wch: 13 },
      { wch: 13 }, { wch: 13 }, { wch: 14 }, { wch: 13 }, { wch: 26 },
      { wch: 14 }, { wch: 16 }, { wch: 13 }, { wch: 13 }, { wch: 13 },
      { wch: 14 }, { wch: 13 }, { wch: 13 }, { wch: 14 }, { wch: 16 },
      { wch: 14 }, { wch: 13 },
    ];

    const moneyCols = [15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 35];
    const dateCols = [1, 2, 23, 31, 32, 36];
    for (let r = 2; r < dataRows.length + 2; r += 1) {
      moneyCols.forEach((c) => {
        const address = XLSX.utils.encode_cell({ r, c });
        if (ws[address]) ws[address].z = '"Q" #,##0.00';
      });
      dateCols.forEach((c) => {
        const address = XLSX.utils.encode_cell({ r, c });
        if (ws[address]) ws[address].z = "d-mmm";
      });
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Asignaciones");
    XLSX.writeFile(
      wb,
      `Asignaciones_unidades_GL365_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  const tabs: Array<[Tab, string, any]> = [
    ["local", "Local", Truck],
    ["fiduca", "FYDUCA", ShieldCheck],
    ["centroamerica", "Centroamérica", Route],
    ["internacional", "Internacional", Globe2],
    ["cierre", "Cierre / Excel final", FileSpreadsheet],
  ];

  return (
    <div className="min-h-screen bg-[#F5F6F8] p-4 sm:p-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0C2D6B]">Operaciones y Asignaciones</h1>
          <p className="mt-1 text-sm text-gray-500">Cuatro expedientes operativos independientes. El costo y proveedor se registran únicamente cuando la operación finaliza.</p>
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="h-11 rounded-xl bg-[#0C2D6B] px-5 text-sm font-bold text-white inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      {apiError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{apiError}</div>}
      {notice && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{notice}</div>}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {tabs.map(([value, label, Icon]) => {
          const count = value === "cierre"
            ? asignaciones.filter(isFinalized).length
            : asignaciones.filter((item) => {
                const d = parseJson(item.detalle_operativo_json);
                return (item.tipo_asignacion || d.tipo_asignacion || "local") === value;
              }).length;
          const active = tab === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-2xl border p-4 text-left transition shadow-sm ${active ? "border-[#0C2D6B] bg-[#0C2D6B] text-white" : "border-gray-200 bg-white text-[#0C2D6B] hover:border-blue-200"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <Icon className={`h-5 w-5 ${active ? "text-[#FF8A32]" : "text-[#FF6A00]"}`} />
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${active ? "bg-white/10" : "bg-blue-50"}`}>{count}</span>
              </div>
              <p className="mt-3 font-bold">{label}</p>
              <p className={`mt-1 text-xs ${active ? "text-blue-100" : "text-gray-500"}`}>
                {value === "cierre" ? "Solo operaciones finalizadas" : TYPE_META[value as AssignmentType].description}
              </p>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    tab === "cierre"
                      ? "Código, cliente, piloto, proveedor, serie, factura..."
                      : tab === "fiduca"
                      ? "Piloto, DPI, CAAT, transportista..."
                      : tab === "centroamerica"
                      ? "Ruta, piloto, licencia, cabezal..."
                      : tab === "internacional"
                      ? "Cliente, piloto, CAAT, unidad, ruta..."
                      : "Cliente, piloto, placa, ruta, estatus..."
                  }
                  className="h-11 w-full rounded-xl border border-gray-200 pl-12 pr-4 text-sm outline-none focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/15"
                />
              </div>
              {tab !== "cierre" ? (
                <div className="relative w-full sm:w-[220px]">
                  <Filter className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <select
                    value={estadoFiltro}
                    onChange={(e) =>
                      setEstadoFiltro(
                        e.target.value
                      )
                    }
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-12 pr-8 text-sm"
                  >
                    <option>Todos</option>
                    {estadosAsignacion.map(
                      (e) => (
                        <option key={e.id}>
                          {
                            e.nombre_estado_asignacion
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>
              ) : (
                <>
                  <select
                    value={cierreTipoFiltro}
                    onChange={(e) =>
                      setCierreTipoFiltro(
                        e.target.value
                      )
                    }
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm sm:w-[180px]"
                  >
                    <option value="Todos">
                      Todos los tipos
                    </option>
                    <option value="local">
                      Local
                    </option>
                    <option value="fiduca">
                      FYDUCA
                    </option>
                    <option value="centroamerica">
                      Centroamérica
                    </option>
                    <option value="internacional">
                      Internacional
                    </option>
                  </select>

                  <select
                    value={cierreProveedorFiltro}
                    onChange={(e) =>
                      setCierreProveedorFiltro(
                        e.target.value
                      )
                    }
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm sm:w-[230px]"
                  >
                    <option value="Todos">
                      Todos los proveedores
                    </option>
                    <option value="Sin proveedor">
                      Sin proveedor
                    </option>
                    {proveedores.map((p) => (
                      <option
                        key={p.id}
                        value={p.id}
                      >
                        {p.razon_social ||
                          p.nombre_comercial ||
                          p.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={cierrePagoFiltro}
                    onChange={(e) =>
                      setCierrePagoFiltro(
                        e.target.value
                      )
                    }
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm sm:w-[190px]"
                  >
                    <option value="Todos">
                      Todos los pagos
                    </option>
                    <option value="Proveedor pendiente">
                      Proveedor pendiente
                    </option>
                    <option value="Cliente pendiente">
                      Cliente pendiente
                    </option>
                    <option value="Pagados">
                      Ambos pagados
                    </option>
                  </select>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setEstadoFiltro("Todos");
                  setCierreTipoFiltro("Todos");
                  setCierreProveedorFiltro("Todos");
                  setCierrePagoFiltro("Todos");
                  setSortField("");
                  setSortDirection("asc");
                }}
                className="h-11 rounded-xl border border-orange-200 px-4 text-sm font-bold text-[#FF6A00]"
              >
                Limpiar
              </button>
              {tab !== "cierre" ? (
                <button
                  type="button"
                  onClick={() => openAssignment("create", tab as AssignmentType)}
                  className="h-11 rounded-xl bg-[#0C2D6B] px-5 text-sm font-bold text-white inline-flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" /> Nueva {TYPE_META[tab as AssignmentType].label}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={exportFinalExcel}
                  className="h-11 rounded-xl bg-[#22C55E] px-5 text-sm font-bold text-white inline-flex items-center gap-2"
                >
                  <Download className="h-4 w-4" /> Exportar Excel final
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 text-sm font-bold text-gray-400">
          {sorted.length} registros · {sortField ? `Orden ${sortDirection === "asc" ? "ascendente ↑" : "descendente ↓"}` : "Últimos ingresados primero"} · Haz clic en un encabezado para ordenar
        </div>

        {tab === "cierre" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-xs">
              <thead className="bg-[#F3F4F6]">
                <tr>
                  <SortableTh
                    field="codigo"
                    className="px-4 py-3"
                  >
                    Código
                  </SortableTh>

                  <SortableTh
                    field="tipo"
                    className="px-4 py-3"
                  >
                    Tipo
                  </SortableTh>

                  <SortableTh
                    field="cliente"
                    className="px-4 py-3"
                  >
                    Cliente
                  </SortableTh>

                  <SortableTh
                    field="piloto"
                    className="px-4 py-3"
                  >
                    Piloto
                  </SortableTh>

                  <SortableTh
                    field="proveedor"
                    className="px-4 py-3"
                  >
                    Proveedor
                  </SortableTh>

                  <SortableTh
                    field="margen"
                    className="px-4 py-3"
                  >
                    Margen
                  </SortableTh>

                  <th className="px-4 py-3 text-center text-[#0C2D6B]">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((item) => {
                  const detail = parseJson(item.detalle_operativo_json);
                  const type = (item.tipo_asignacion || detail.tipo_asignacion || "local") as AssignmentType;
                  const cliente = getCliente(item.cliente_id)?.nombre_empresa || item.cliente || "-";
                  const piloto = fullPilot(getPiloto(item.piloto_id || item.pilotos_id)) || item.piloto || "-";
                  const provider = getProveedor(item.proveedor_id)?.razon_social || item.proveedor || "Pendiente";
                  const margin = numeric(item.total) - numeric(item.totalProveedor || item.total_proveedor);
                  return (
                    <tr key={item.id} className="border-t hover:bg-blue-50/30">
                      <td className="px-4 py-3 font-bold text-[#0C2D6B]">
                        {item.codigo_asignacion}
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 font-bold text-[#0C2D6B]">
                          {TYPE_META[type].label}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-semibold">
                        {cliente}
                      </td>

                      <td className="px-4 py-3">
                        {piloto}
                      </td>

                      <td className="px-4 py-3">
                        <b className="text-[#0C2D6B]">
                          {provider}
                        </b>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`font-bold ${
                            margin >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {money(margin)}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-center gap-1.5">
                          <ActionButton
                            icon={Eye}
                            label="Ver cierre"
                            onClick={() =>
                              openClosing(
                                "view",
                                item
                              )
                            }
                          />

                          <ActionButton
                            icon={Edit2}
                            label="Editar cierre"
                            tone="orange"
                            onClick={() =>
                              openClosing(
                                "edit",
                                item
                              )
                            }
                          />

                          <button
                            type="button"
                            onClick={() =>
                              void downloadFinalClosurePdf(
                                item
                              )
                            }
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-100 bg-red-50 px-3 text-[11px] font-bold text-red-600 transition hover:bg-red-100"
                            title="Descargar PDF individual"
                          >
                            <Download className="h-4 w-4" />
                            PDF
                          </button>

                          <ActionButton
                            icon={RotateCcw}
                            label={`Regresar a ${TYPE_META[type].label}`}
                            onClick={() =>
                              void reopenFromFinal(
                                item
                              )
                            }
                          />

                          <ActionButton
                            icon={Trash2}
                            label="Eliminar definitivamente"
                            tone="red"
                            onClick={() => {
                              if (
                                type === "local"
                              ) {
                                const groupRows =
                                  getLocalGroupRows(
                                    item
                                  );

                                setDeleteBox({
                                  id: item.id,
                                  ids: groupRows.map(
                                    (row) => row.id
                                  ),
                                  codigo:
                                    localGroupKey(
                                      item
                                    ),
                                  lineas:
                                    groupRows.length,
                                });

                                return;
                              }

                              setDeleteBox({
                                id: item.id,
                                codigo:
                                  item.codigo_asignacion,
                                lineas: 1,
                              });
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!paginated.length && (
                  <tr>
                    <td
                      colSpan={7}
                      className="p-10 text-center text-gray-400"
                    >
                      No hay operaciones finalizadas con los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <OperationalTypeTable
            type={tab as AssignmentType}
            items={paginated}
            getCliente={getCliente}
            getPiloto={getPiloto}
            getVehiculo={getVehiculo}
            getRuta={getRuta}
            rutaLabel={rutaLabel}
            openAssignment={openAssignment}
            downloadAssignmentPdf={downloadAssignmentPdf}
            markFinalized={markFinalized}
            isFinalized={isFinalized}
            setDeleteBox={setDeleteBox}
            sortField={sortField}
            sortDirection={sortDirection}
            handleSort={handleSort}
            sortIcon={sortIcon}
          />
        )}

        <Pagination page={page} totalPages={totalPages} rowsPerPage={rowsPerPage} setRowsPerPage={setRowsPerPage} setPage={setPage} />
      </div>

      {modal.open && (
        <AssignmentModal
          mode={modal.mode}
          type={modal.type}
          form={form}
          setForm={setForm}
          errors={errors}
          onClose={() => setModal({ open: false, mode: "create", type: modal.type })}
          onSave={saveOperational}
          clientes={clientes}
          rutas={rutas}
          vehiculos={vehiculos}
          pilotos={pilotos}
          estadosAsignacion={estadosAsignacion}
          getPiloto={getPiloto}
          getVehiculo={getVehiculo}
          getRuta={getRuta}
          rutaLabel={rutaLabel}
          onQuickCreate={openQuickCreate}
          localBatchRows={localBatchRows}
          setLocalBatchRows={setLocalBatchRows}
          newLocalBatchRow={newLocalBatchRow}
        />
      )}

      {quickModal.open && (
        <QuickCreateModal
          type={quickModal.type}
          form={quickForm}
          setForm={setQuickForm}
          error={quickError}
          prefijos={prefijos}
          onClose={() => { setQuickTarget(null); setQuickModal({ open: false, type: quickModal.type }); }}
          onSave={saveQuickCreate}
        />
      )}

      {closingModal.open && (
        <ClosingModal
          mode={closingModal.mode}
          form={closingForm}
          setForm={setClosingForm}
          errors={closingErrors}
          proveedores={proveedores}
          usuarios={usuarios}
          onClose={() => setClosingModal({ open: false, mode: "edit" })}
          onSave={saveClosing}
          patchMoney={patchClosingMoney}
          getCliente={getCliente}
          getPiloto={getPiloto}
          getVehiculo={getVehiculo}
          getRuta={getRuta}
          rutaLabel={rutaLabel}
        />
      )}

      {deleteBox && (
        <div className="fixed inset-0 z-[120] bg-black/55 p-4 flex items-center justify-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mx-auto h-14 w-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center"><Trash2 /></div>
            <h3 className="mt-4 text-center text-xl font-bold">¿Eliminar asignación?</h3>
            <p className="mt-2 text-center text-sm text-gray-500">Se eliminará {deleteBox.codigo}{deleteBox.lineas > 1 ? ` con sus ${deleteBox.lineas} líneas` : ""} y sus datos operativos asociados.</p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setDeleteBox(null)} className="h-11 flex-1 rounded-xl border font-bold">Cancelar</button>
              <button onClick={() => removeAssignment(deleteBox)} className="h-11 flex-1 rounded-xl bg-red-600 text-white font-bold">Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function OperationalTypeTable({
  type,
  items,
  getCliente,
  getPiloto,
  getVehiculo,
  getRuta,
  rutaLabel,
  openAssignment,
  downloadAssignmentPdf,
  markFinalized,
  isFinalized,
  setDeleteBox,
  sortField,
  sortDirection,
  handleSort,
  sortIcon,
}: AnyRow) {
  const Actions = ({ item }: AnyRow) => (
    <div className="flex justify-center gap-1.5">
      <ActionButton icon={Eye} label="Ver" onClick={() => openAssignment("view", type, item)} />
      <ActionButton icon={Edit2} label="Editar" tone="orange" onClick={() => openAssignment("edit", type, item)} />
      <ActionButton icon={Download} label="Descargar PDF" tone="gray" onClick={() => downloadAssignmentPdf(item)} />
      {!isFinalized(item) ? (
        <ActionButton
          icon={CheckCircle2}
          label="Finalizar operación"
          onClick={() => markFinalized(item)}
        />
      ) : (
        <span
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-green-200 bg-green-50 px-3 text-[10px] font-bold text-green-700"
          title="También está disponible en Cierre / Excel final"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Finalizado
        </span>
      )}
      <ActionButton
        icon={Trash2}
        label="Eliminar"
        tone="red"
        onClick={() => {
          const groupRows = type === "local" && Array.isArray(item._localGroupRows) ? item._localGroupRows : [item];
          setDeleteBox({
            id: item.id,
            ids: groupRows.map((row: AnyRow) => row.id).filter(Boolean),
            codigo: type === "local" ? localGroupKey(item) : item.codigo_asignacion,
            lineas: groupRows.length,
          });
        }}
      />
    </div>
  );

  const H = ({ field, children, className = "" }: AnyRow) => (
    <th className={`px-3 py-3 ${className}`}>
      <button type="button" onClick={() => handleSort(field)} className="group text-left">
        <span className={`inline-flex items-center gap-1 font-bold ${sortField === field ? "text-[#FF6A00]" : "text-inherit"}`}>
          {children}<small className={sortField === field ? "text-[#FF6A00]" : "opacity-40"}>{sortIcon(field)}</small>
        </span>
        <span className={`mt-0.5 block text-[9px] ${sortField === field ? "text-[#FF6A00]" : "opacity-60"}`}>
          {sortField === field ? (sortDirection === "asc" ? "Ascendente" : "Descendente") : "Clic para ordenar"}
        </span>
      </button>
    </th>
  );

  const latestStatus = (d: AnyRow) => {
    const timeline = Array.isArray(d.estatus_seguimiento) ? d.estatus_seguimiento : [];
    return [...timeline].reverse().find((row: AnyRow) => String(row.estatus || "").trim())?.estatus || d.estatus_operativo || "-";
  };

  if (type === "local") {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1750px] text-left text-xs">
          <thead className="bg-[#0B75B8] text-white"><tr>
            <th className="px-3 py-3">Código / líneas</th><H field="carga">Carga</H><H field="descarga">Descarga</H><H field="cliente">Cliente</H><H field="piloto">Piloto</H><H field="licencia">Licencia</H><H field="placa">Placa</H><H field="furgon">Furgón</H><H field="tipo">Tipo</H><H field="origen">Origen</H><H field="destino">Destino</H><H field="estatus">Estatus</H><th className="px-3 py-3 text-center">Acciones</th>
          </tr></thead>
          <tbody>{items.map((item: AnyRow) => {
            const groupRows = Array.isArray(item._localGroupRows) && item._localGroupRows.length ? item._localGroupRows : [item];
            const cell = (render: (row: AnyRow, d: AnyRow) => ReactNode) => (
              <div className="divide-y divide-gray-100">
                {groupRows.map((row: AnyRow, index: number) => {
                  const d = parseJson(row.detalle_operativo_json);
                  return <div key={row.id || index} className="min-h-[38px] py-2 flex items-center">{render(row, d)}</div>;
                })}
              </div>
            );
            return <tr key={item._localGroupKey || item.id} className="border-t align-top hover:bg-blue-50/30">
              <td className="px-3 py-3"><b className="text-[#0C2D6B]">{localGroupKey(item)}</b><span className="mt-1 block w-fit rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-[#0B75B8]">{groupRows.length} línea{groupRows.length === 1 ? "" : "s"}</span></td>
              <td className="px-3 py-1">{cell((row,d)=><span>{date10(row.fecha_carga)}<small className="block text-gray-400">{d.hora_carga || ""}</small></span>)}</td>
              <td className="px-3 py-1">{cell((row,d)=><span>{date10(row.fecha_descarga)}<small className="block text-gray-400">{d.hora_descarga || ""}</small></span>)}</td>
              <td className="px-3 py-1 font-semibold">{cell((row)=>getCliente(row.cliente_id)?.nombre_empresa || "-")}</td>
              <td className="px-3 py-1">{cell((row)=>fullPilot(getPiloto(row.piloto_id || row.pilotos_id)) || "-")}</td>
              <td className="px-3 py-1">{cell((row,d)=>d.licencia || getPiloto(row.piloto_id || row.pilotos_id)?.licencia || "-")}</td>
              <td className="px-3 py-1 font-semibold">{cell((row,d)=>d.placa_operativa || getVehiculo(row.vehiculo_id)?.codigo || "-")}</td>
              <td className="px-3 py-1">{cell((_row,d)=>d.furgon || "N/A")}</td>
              <td className="px-3 py-1">{cell((row,d)=>d.tipo || getVehiculo(row.vehiculo_id)?.tipo || getVehiculo(row.vehiculo_id)?.nombre_tipo_vehiculo || "-")}</td>
              <td className="px-3 py-1">{cell((row,d)=>d.origen || getRuta(row.ruta_id)?.origen || "-")}</td>
              <td className="px-3 py-1">{cell((row,d)=>d.destino || getRuta(row.ruta_id)?.destino || "-")}</td>
              <td className="px-3 py-1 font-semibold text-[#0C2D6B]">{cell((_row,d)=>latestStatus(d))}</td>
              <td className="px-3 py-3"><Actions item={item} /></td>
            </tr>;
          })}{!items.length && <tr><td colSpan={13} className="p-10 text-center text-gray-400">No hay asignaciones Local.</td></tr>}</tbody>
        </table>
      </div>
    );
  }

  if (type === "fiduca") {
    return <div className="overflow-x-auto"><table className="w-full min-w-[2100px] text-left text-xs"><thead className="bg-[#D8E5F2] text-[#0C2D6B]"><tr><H field="piloto">Piloto</H><H field="placa">Placa piloto</H><H field="licencia">Licencia</H><H field="pais">País</H><H field="dpi">DPI</H><th className="px-3 py-3 font-bold">Fecha nacimiento</th><th className="px-3 py-3 font-bold">NIT piloto</th><H field="transportista">Transportes</H><th className="px-3 py-3 font-bold">NIT transportista</th><th className="px-3 py-3 font-bold">País transportista</th><H field="caat">CAAT</H><H field="numero_economico">Número económico</H><H field="fianza">Fianza</H><H field="codigo_aduanero">Código aduanero</H><th className="px-3 py-3">Acciones</th></tr></thead><tbody>{items.map((item: AnyRow) => { const d = parseJson(item.detalle_operativo_json); const p = getPiloto(item.piloto_id || item.pilotos_id); const pp = d.pais_piloto === "Otro" ? d.pais_piloto_otro : d.pais_piloto; const pt = d.pais_transportista === "Otro" ? d.pais_transportista_otro : d.pais_transportista; return <tr key={item.id} className="border-t hover:bg-blue-50/30"><td className="px-3 py-3 font-semibold">{fullPilot(p) || "-"}</td><td className="px-3 py-3">{d.placa_piloto || "-"}</td><td className="px-3 py-3">{d.licencia || p?.licencia || "-"}</td><td className="px-3 py-3">{pp || "-"}</td><td className="px-3 py-3">{d.dpi_piloto || "-"}</td><td className="px-3 py-3">{d.fecha_nacimiento_piloto || "-"}</td><td className="px-3 py-3">{d.nit_piloto || "-"}</td><td className="px-3 py-3">{d.empresa_transporte || "-"}</td><td className="px-3 py-3">{d.nit_transportista || "-"}</td><td className="px-3 py-3">{pt || "-"}</td><td className="px-3 py-3 font-bold">{d.caat || "-"}</td><td className="px-3 py-3">{d.numero_economico || "-"}</td><td className="px-3 py-3">{d.fianza || "N/A"}</td><td className="px-3 py-3">{d.codigo_aduanero || "N/A"}</td><td className="px-3 py-3"><Actions item={item} /></td></tr>; })}{!items.length && <tr><td colSpan={15} className="p-10 text-center text-gray-400">No hay asignaciones FYDUCA.</td></tr>}</tbody></table></div>;
  }

  if (type === "centroamerica") {
    return <div className="overflow-x-auto"><table className="w-full min-w-[1900px] text-left text-xs"><thead className="bg-[#FF9A3D] text-white"><tr><H field="ruta">Ruta</H><H field="piloto">Nombre de piloto</H><H field="licencia">Licencia</H><H field="dpi">DPI</H><H field="pasaporte">Pasaporte</H><H field="cabezal">Cabezal</H><H field="furgon">Furgón</H><H field="codigo_equipo">Código</H><H field="fianza">Fianza</H><H field="tamano">Tamaño</H><H field="transportista">Nombre de transporte</H><H field="fecha_posicionamiento">Fecha posicionamiento</H><th className="px-3 py-3">Acciones</th></tr></thead><tbody>{items.map((item: AnyRow) => { const d = parseJson(item.detalle_operativo_json); const p = getPiloto(item.piloto_id || item.pilotos_id); const v = getVehiculo(item.vehiculo_id); const r = getRuta(item.ruta_id); return <tr key={item.id} className="border-t hover:bg-orange-50/30"><td className="px-3 py-3 font-bold">{d.ruta_codigo || r?.codigo_ruta || rutaLabel(r)}</td><td className="px-3 py-3">{fullPilot(p) || "-"}</td><td className="px-3 py-3 font-semibold">{d.licencia || p?.licencia || "-"}</td><td className="px-3 py-3">{d.dpi_piloto || "-"}</td><td className="px-3 py-3">{d.pasaporte || "N/A"}</td><td className="px-3 py-3 font-semibold">{d.cabezal || v?.codigo || "-"}</td><td className="px-3 py-3">{d.furgon || "N/A"}</td><td className="px-3 py-3">{d.codigo_equipo || "N/A"}</td><td className="px-3 py-3">{d.fianza || "N/A"}</td><td className="px-3 py-3">{d.tamano_equipo || "-"}</td><td className="px-3 py-3">{d.empresa_transporte || "-"}</td><td className="px-3 py-3">{d.fecha_posicionamiento || "-"}<span className="block text-gray-400">{d.hora_posicionamiento || ""}</span></td><td className="px-3 py-3"><Actions item={item} /></td></tr>; })}{!items.length && <tr><td colSpan={13} className="p-10 text-center text-gray-400">No hay asignaciones de Centroamérica.</td></tr>}</tbody></table></div>;
  }

  return <div className="overflow-x-auto"><table className="w-full min-w-[1900px] text-left text-xs"><thead className="bg-[#365D9D] text-white"><tr><H field="cliente">Cliente</H><H field="piloto">Piloto</H><H field="caat">CAAT</H><H field="transportista">Nombre transporte</H><H field="origen">Origen</H><H field="licencia">Licencia</H><H field="numero_economico">Número económico</H><H field="carga">Fecha carga</H><H field="destino">Destino</H><H field="unidad">Unidad</H><H field="tamano">Tamaño</H><H field="dias_servicio">Días servicio</H><H field="estatus">Último estatus</H><th className="px-3 py-3">Acciones</th></tr></thead><tbody>{items.map((item: AnyRow) => { const d = parseJson(item.detalle_operativo_json); const p = getPiloto(item.piloto_id || item.pilotos_id); const v = getVehiculo(item.vehiculo_id); const r = getRuta(item.ruta_id); return <tr key={item.id} className="border-t hover:bg-blue-50/30"><td className="px-3 py-3 font-semibold">{getCliente(item.cliente_id)?.nombre_empresa || "-"}</td><td className="px-3 py-3">{fullPilot(p) || "-"}</td><td className="px-3 py-3 font-bold">{d.caat || "-"}</td><td className="px-3 py-3">{d.empresa_transporte || "-"}</td><td className="px-3 py-3">{d.origen || r?.origen || "-"}</td><td className="px-3 py-3">{d.licencia || p?.licencia || "-"}</td><td className="px-3 py-3">{d.numero_economico || "-"}</td><td className="px-3 py-3">{date10(item.fecha_carga)}<span className="block text-gray-400">{d.hora_carga || ""}</span></td><td className="px-3 py-3">{d.destino || r?.destino || "-"}</td><td className="px-3 py-3 font-semibold">{d.unidad || v?.codigo || "-"}</td><td className="px-3 py-3">{d.tamano_equipo || "-"}</td><td className="px-3 py-3 text-center">{d.dias_servicio || 1}</td><td className="px-3 py-3 font-semibold text-[#0C2D6B]">{latestStatus(d)}</td><td className="px-3 py-3"><Actions item={item} /></td></tr>; })}{!items.length && <tr><td colSpan={14} className="p-10 text-center text-gray-400">No hay asignaciones Internacionales.</td></tr>}</tbody></table></div>;
}

function QuickCreateModal({ type, form, setForm, error, prefijos = [], onClose, onSave }: AnyRow) {
  const title = type === "cliente" ? "Nuevo cliente" : type === "piloto" ? "Nuevo piloto" : "Nueva ruta";
  const phonePrefix = (field: string) => (
    <select value={form[field] || 1} onChange={(e) => setForm({ ...form, [field]: Number(e.target.value) })} className="h-10 w-[115px] rounded-lg border border-gray-300 bg-white px-2 text-sm">
      {(prefijos.length ? prefijos : [{ id: 1, prefijo: "+502", pais: "Guatemala" }]).map((p: AnyRow) => (
        <option key={p.id} value={p.id}>{p.prefijo || "+502"} · {p.codigo_pais || p.pais || "GT"}</option>
      ))}
    </select>
  );

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4">
      <div onKeyDown={handleEnterNext} className={`w-full ${type === "cliente" ? "max-w-3xl" : "max-w-xl"} max-h-[92vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col`}>
        <div className="flex items-center justify-between bg-[#0C2D6B] px-5 py-4 text-white"><div><p className="text-xs uppercase tracking-[0.2em] text-white/60">Registro rápido</p><h3 className="text-lg font-bold">{title}</h3></div><button type="button" onClick={onClose}><X /></button></div>
        <div className="space-y-4 overflow-y-auto p-5">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div>}

          {type === "cliente" && <>
            <section className="rounded-xl border border-gray-200 p-4">
              <h4 className="mb-3 font-bold text-[#0C2D6B]">Datos de la empresa</h4>
              <Field label="Empresa *"><input value={form.nombre_empresa || ""} onChange={(e) => setForm({ ...form, nombre_empresa: e.target.value })} className={`${input} mt-1`} placeholder="Razón social / nombre de empresa" /></Field>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="NIT *"><input value={form.nit || ""} onChange={(e) => setForm({ ...form, nit: e.target.value })} className={`${input} mt-1`} placeholder="CF o NIT" /></Field>
                <Field label="Dirección"><input value={form.direccion || ""} onChange={(e) => setForm({ ...form, direccion: e.target.value })} className={`${input} mt-1`} /></Field>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 p-4">
              <h4 className="mb-1 font-bold text-[#0C2D6B]">Contacto principal</h4>
              <p className="mb-3 text-xs text-gray-500">Puedes dejar esta sección vacía o completar de una vez a la persona de contacto.</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Nombre / representante"><input value={form.representante || ""} onChange={(e) => setForm({ ...form, representante: e.target.value })} className={`${input} mt-1`} placeholder="Nombre completo" /></Field>
                <Field label="Cargo"><input value={form.cargo || ""} onChange={(e) => setForm({ ...form, cargo: e.target.value })} className={`${input} mt-1`} placeholder="Ej. Encargado de logística" /></Field>
                <Field label="Correo" className="sm:col-span-2"><input type="email" value={form.correo || ""} onChange={(e) => setForm({ ...form, correo: e.target.value })} className={`${input} mt-1`} placeholder="correo@empresa.com" /></Field>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 p-4">
              <h4 className="mb-1 font-bold text-[#0C2D6B]">Teléfonos</h4>
              <p className="mb-3 text-xs text-gray-500">Puedes registrar hasta tres números desde Operaciones.</p>
              {[1,2,3].map((n) => (
                <div key={n} className="mb-3 grid grid-cols-[115px_1fr] gap-2 last:mb-0">
                  {phonePrefix(`prefijo_telefonico_id${n}`)}
                  <input inputMode="tel" value={form[`telefono${n}`] || ""} onChange={(e) => setForm({ ...form, [`telefono${n}`]: e.target.value })} className={input} placeholder={n === 1 ? "Teléfono principal" : `Teléfono ${n}`} />
                </div>
              ))}
            </section>
          </>}

          {type === "piloto" && <><Field label="Nombre completo *"><input value={form.piloto || ""} onChange={(e) => setForm({ ...form, piloto: e.target.value })} className={`${input} mt-1`} placeholder="Nombre y apellidos" /></Field><Field label="Licencia *"><input value={form.licencia || ""} onChange={(e) => setForm({ ...form, licencia: e.target.value })} className={`${input} mt-1`} placeholder="2610-54929-0201" /></Field></>}
          {type === "ruta" && <><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Código de ruta"><input value={form.codigo_ruta || ""} onChange={(e) => setForm({ ...form, codigo_ruta: e.target.value.toUpperCase() })} className={`${input} mt-1`} placeholder="GT-SV / RUT-067" /></Field><Field label="Distancia km"><input inputMode="decimal" value={form.km || ""} onChange={(e) => setForm({ ...form, km: cleanNum(e.target.value) })} className={`${input} mt-1`} /></Field></div><Field label="Origen *"><input value={form.origen || ""} onChange={(e) => setForm({ ...form, origen: e.target.value })} className={`${input} mt-1`} /></Field><Field label="Destino *"><input value={form.destino || ""} onChange={(e) => setForm({ ...form, destino: e.target.value })} className={`${input} mt-1`} /></Field></>}
        </div>
        <div className="flex justify-end gap-2 border-t p-4"><button type="button" onClick={onClose} className="h-10 rounded-lg px-4 font-bold text-gray-600">Cancelar</button><button type="button" onClick={onSave} className="h-10 rounded-lg bg-[#FF6A00] px-5 font-bold text-white">Guardar {type === "cliente" ? "cliente" : type === "piloto" ? "piloto" : "ruta"}</button></div>
      </div>
    </div>
  );
}

function LocalBatchEditor({
  rows,
  setRows,
  clientes,
  pilotos,
  vehiculos,
  rutas,
  rutaLabel,
  readonly,
  onQuickCreate,
  newLocalBatchRow,
}: AnyRow) {
  const patch = (index: number, changes: AnyRow) => {
    setRows((prev: AnyRow[]) => prev.map((row, i) => i === index ? { ...row, ...changes } : row));
  };

  const remove = (index: number) => setRows((prev: AnyRow[]) => prev.filter((_, i) => i !== index));

  return (
    <section className="rounded-xl border bg-white p-4">
      <div className="flex flex-col gap-2 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-bold text-[#0C2D6B]">Asignación Local</h3>
          <p className="text-xs text-gray-500">Todas las filas de este formulario se guardan juntas bajo el mismo código Local. Puedes verlas, editarlas y descargarlas en un solo PDF.</p>
        </div>
        {!readonly && <button type="button" onClick={() => setRows((prev: AnyRow[]) => [...prev, newLocalBatchRow(prev.length)])} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#FF6A00] px-4 text-xs font-bold text-white"><Plus className="h-4 w-4" /> Agregar otra asignación</button>}
      </div>

      <div className="mt-4 space-y-4">
        {rows.map((row: AnyRow, index: number) => {
          const pilot = pilotos.find((p: AnyRow) => Number(p.id) === Number(row.pilotos_id));
          const vehicle = vehiculos.find((v: AnyRow) => Number(v.id) === Number(row.vehiculo_id));
          const route = rutas.find((r: AnyRow) => Number(r.id) === Number(row.ruta_id));
          return (
            <div key={row._key || index} className="rounded-2xl border border-gray-200 bg-[#FAFBFD] p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0C2D6B] text-xs font-bold text-white">{index + 1}</span><b className="text-sm text-[#0C2D6B]">Fila de asignación</b></div>
                {!readonly && rows.length > 1 && <button type="button" onClick={() => remove(index)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-100 bg-red-50 px-2.5 text-xs font-bold text-red-600"><Trash2 className="h-3.5 w-3.5" /> Quitar</button>}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Carga"><div className="mt-1 grid grid-cols-[1fr_105px] gap-2"><input type="date" disabled={readonly} value={row.fecha_carga || ""} onChange={(e) => patch(index,{fecha_carga:e.target.value})} className={input}/><input type="time" disabled={readonly} value={row.hora_carga || ""} onChange={(e) => patch(index,{hora_carga:e.target.value})} className={input}/></div></Field>
                <Field label="Descarga"><div className="mt-1 grid grid-cols-[1fr_105px] gap-2"><input type="date" disabled={readonly} value={row.fecha_descarga || ""} onChange={(e) => patch(index,{fecha_descarga:e.target.value})} className={input}/><input type="time" disabled={readonly} value={row.hora_descarga || ""} onChange={(e) => patch(index,{hora_descarga:e.target.value})} className={input}/></div></Field>
                <Field label="Cliente"><SearchableSelect items={clientes} value={row.cliente_id} getLabel={(c:AnyRow)=>`${c.codigo_cliente || ""}${c.codigo_cliente ? " · " : ""}${c.nombre_empresa || c.name || "Cliente"}`} onChange={(id)=>patch(index,{cliente_id:id})} disabled={readonly} placeholder="Buscar cliente..." onNew={()=>onQuickCreate("cliente",{batchIndex:index})} newLabel="Nuevo" /></Field>
                <Field label="Piloto"><SearchableSelect items={pilotos} value={row.pilotos_id} getLabel={(p:AnyRow)=>`${fullPilot(p)}${p.licencia ? ` · ${p.licencia}` : ""}`} onChange={(id,item)=>patch(index,{pilotos_id:id,licencia:item?.licencia || ""})} disabled={readonly} placeholder="Buscar piloto..." onNew={()=>onQuickCreate("piloto",{batchIndex:index})} newLabel="Nuevo" /></Field>
                <Field label="Licencia"><input readOnly value={row.licencia || pilot?.licencia || ""} className={`${input} mt-1 bg-gray-100`} /></Field>
                <Field label="Placa / unidad"><SearchableSelect items={vehiculos} value={row.vehiculo_id} getLabel={(v:AnyRow)=>`${v.codigo || v.placa || "Unidad"}${v.tipo || v.nombre_tipo_vehiculo ? ` · ${v.tipo || v.nombre_tipo_vehiculo}` : ""}`} onChange={(id,item)=>patch(index,{vehiculo_id:id,placa_operativa:item?.codigo || item?.placa || "",tipo:item?.tipo || item?.nombre_tipo_vehiculo || row.tipo || ""})} disabled={readonly} placeholder="Buscar placa..." /></Field>
                <Field label="Furgón"><TextWithNA disabled={readonly} value={row.furgon} onChange={(value)=>patch(index,{furgon:value})} upper /></Field>
                <Field label="Tipo"><input disabled={readonly} value={row.tipo || vehicle?.tipo || vehicle?.nombre_tipo_vehiculo || ""} onChange={(e)=>patch(index,{tipo:e.target.value})} className={`${input} mt-1`} placeholder="10T / 5T / Plataforma" /></Field>
                <Field label="Ruta" className="xl:col-span-2"><SearchableSelect items={rutas} value={row.ruta_id} getLabel={(r:AnyRow)=>rutaLabel(r)} onChange={(id,item)=>patch(index,{ruta_id:id,ruta_codigo:item?.codigo_ruta || "",origen:item?.origen || "",destino:item?.destino || ""})} disabled={readonly} placeholder="Buscar ruta..." onNew={()=>onQuickCreate("ruta",{batchIndex:index})} newLabel="Nueva" /></Field>
                <Field label="Origen"><input readOnly value={row.origen || route?.origen || ""} className={`${input} mt-1 bg-gray-100`} /></Field>
                <Field label="Destino"><input readOnly value={row.destino || route?.destino || ""} className={`${input} mt-1 bg-gray-100`} /></Field>
                <Field label="Estatus" className="md:col-span-2 xl:col-span-4"><input disabled={readonly} value={row.estatus_operativo || ""} onChange={(e)=>patch(index,{estatus_operativo:e.target.value})} className={`${input} mt-1`} placeholder="Ej. Unidad presente en Distipark / Transitando / Detenido en tráfico" /></Field>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AssignmentModal({
  mode,
  type,
  form,
  setForm,
  errors,
  onClose,
  onSave,
  clientes,
  rutas,
  vehiculos,
  pilotos,
  estadosAsignacion,
  getPiloto,
  getVehiculo,
  getRuta,
  rutaLabel,
  onQuickCreate,
  localBatchRows,
  setLocalBatchRows,
  newLocalBatchRow,
}: AnyRow) {
  const readonly = mode === "view";
  const meta = TYPE_META[type as AssignmentType];
  const pilot = getPiloto(form.pilotos_id);
  const vehicle = getVehiculo(form.vehiculo_id);
  const selectedRoute = getRuta(form.ruta_id);
  const timeline = Array.isArray(form.estatus_seguimiento) ? form.estatus_seguimiento : [];

  const selectPilot = (id: any, item?: AnyRow) => {
    const selected = item || getPiloto(id);
    setForm({ ...form, pilotos_id: id, licencia: selected?.licencia || "" });
  };

  const selectRoute = (id: any, item?: AnyRow) => {
    const selected = item || getRuta(id);
    setForm({
      ...form,
      ruta_id: id,
      ruta_codigo: selected?.codigo_ruta || "",
      origen: selected?.origen || "",
      destino: selected?.destino || "",
    });
  };

  const selectVehicle = (id: any, item: AnyRow | undefined, target: "placa_operativa" | "cabezal" | "unidad") => {
    const selected = item || getVehiculo(id);
    setForm({
      ...form,
      vehiculo_id: id,
      [target]: selected?.codigo || selected?.placa || "",
      tipo: selected?.tipo || selected?.nombre_tipo_vehiculo || form.tipo || "",
    });
  };

  const routePicker = (
    <SearchableSelect
      items={rutas}
      value={form.ruta_id}
      getLabel={(r: AnyRow) => rutaLabel(r)}
      onChange={selectRoute}
      disabled={readonly}
      placeholder="Buscar por código, origen o destino..."
      emptyText="No existe esa ruta"
      onNew={() => onQuickCreate("ruta")}
      newLabel="Nueva ruta"
    />
  );

  const pilotPicker = (
    <SearchableSelect
      items={pilotos}
      value={form.pilotos_id}
      getLabel={(p: AnyRow) => `${fullPilot(p)}${p.licencia ? ` · ${p.licencia}` : ""}`}
      onChange={selectPilot}
      disabled={readonly}
      placeholder="Buscar piloto por nombre o licencia..."
      emptyText="No existe ese piloto"
      onNew={() => onQuickCreate("piloto")}
      newLabel="Nuevo piloto"
    />
  );

  const clientPicker = (
    <SearchableSelect
      items={clientes}
      value={form.cliente_id}
      getLabel={(c: AnyRow) => `${c.codigo_cliente || ""}${c.codigo_cliente ? " · " : ""}${c.nombre_empresa || c.name || "Cliente"}`}
      onChange={(id) => setForm({ ...form, cliente_id: id })}
      disabled={readonly}
      placeholder="Buscar cliente por código o empresa..."
      emptyText="No existe ese cliente"
      onNew={() => onQuickCreate("cliente")}
      newLabel="Nuevo cliente"
    />
  );

  const vehiclePicker = (target: "placa_operativa" | "cabezal" | "unidad", placeholder = "Buscar placa / unidad...") => (
    <SearchableSelect
      items={vehiculos}
      value={form.vehiculo_id}
      getLabel={(v: AnyRow) => `${v.codigo || v.placa || "Unidad"}${v.tipo || v.nombre_tipo_vehiculo ? ` · ${v.tipo || v.nombre_tipo_vehiculo}` : ""}`}
      onChange={(id, item) => selectVehicle(id, item, target)}
      disabled={readonly}
      placeholder={placeholder}
      emptyText="No se encontró esa unidad"
    />
  );

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/55">
      <div onKeyDown={handleEnterNext} className="flex h-full w-full max-w-6xl flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 bg-[#0C2D6B] px-5 py-4 text-white">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/70">{meta.label}</p>
            <h2 className="text-xl font-bold">{mode === "create" ? `Nueva ${meta.singular}` : mode === "edit" ? `Editar ${form.codigo_asignacion}` : `Detalle ${form.codigo_asignacion}`}</h2>
          </div>
          <button type="button" onClick={onClose}><X /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto bg-[#F6F7F9] p-4 sm:p-5">
          {Object.keys(errors).length > 0 && !readonly && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <b>Revisa el formulario:</b>
              <ul className="ml-5 mt-1 list-disc">{Object.values(errors).map((x: any, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          )}

          <section className="rounded-xl border bg-white p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Field label={type === "local" ? "Código del documento Local" : "Código del registro"}><input readOnly value={form.codigo_asignacion || ""} className={`${input} mt-1 bg-gray-100`} /></Field>
              <Field label="Estado del registro"><select disabled={readonly} value={form.estado_asignacion_id || ""} onChange={(e) => setForm({ ...form, estado_asignacion_id: e.target.value })} className={`${input} mt-1`}>{estadosAsignacion.map((x: AnyRow) => <option key={x.id} value={x.id}>{x.nombre_estado_asignacion}</option>)}</select></Field>
            </div>
          </section>

          {type === "local" && (
            <>
              <LocalBatchEditor
                rows={localBatchRows}
                setRows={setLocalBatchRows}
                clientes={clientes}
                pilotos={pilotos}
                vehiculos={vehiculos}
                rutas={rutas}
                rutaLabel={rutaLabel}
                readonly={readonly}
                onQuickCreate={onQuickCreate}
                newLocalBatchRow={newLocalBatchRow}
              />
              <ErrorText text={errors.local_batch} />
            </>
          )}

          {type === "fiduca" && (
            <section className="rounded-xl border bg-white p-4">
              <h3 className="border-b pb-3 font-bold text-[#0C2D6B]">Expediente FYDUCA</h3>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Field label="Piloto *" className="lg:col-span-2">{pilotPicker}<ErrorText text={errors.pilotos_id} /></Field>
                <Field label="Placa piloto *"><input disabled={readonly} value={form.placa_piloto || ""} onChange={(e) => setForm({ ...form, placa_piloto: e.target.value.toUpperCase() })} className={`${input} mt-1`} placeholder="C-699 BQT" /><ErrorText text={errors.placa_piloto} /></Field>
                <Field label="Licencia"><input readOnly value={form.licencia || pilot?.licencia || ""} className={`${input} mt-1 bg-gray-100`} /></Field>
                <Field label="País del piloto"><CountryPicker disabled={readonly} value={form.pais_piloto || "Guatemala"} otherValue={form.pais_piloto_otro} onChange={(value) => setForm({ ...form, pais_piloto: value })} onOtherChange={(value) => setForm({ ...form, pais_piloto_otro: value })} /></Field>
                <Field label="DPI *"><input disabled={readonly} value={form.dpi_piloto || ""} onChange={(e) => setForm({ ...form, dpi_piloto: onlyDigits(e.target.value, 13) })} inputMode="numeric" pattern="[0-9]*" maxLength={13} className={`${input} mt-1`} /><ErrorText text={errors.dpi_piloto} /></Field>
                <Field label="Fecha de nacimiento *"><input type="date" disabled={readonly} value={form.fecha_nacimiento_piloto || ""} onChange={(e) => setForm({ ...form, fecha_nacimiento_piloto: e.target.value })} className={`${input} mt-1`} /><ErrorText text={errors.fecha_nacimiento_piloto} /></Field>
                <Field label="NIT piloto *"><input disabled={readonly} value={form.nit_piloto || ""} onChange={(e) => setForm({ ...form, nit_piloto: onlyCode(e.target.value, 25) })} className={`${input} mt-1`} /><ErrorText text={errors.nit_piloto} /></Field>
                <Field label="Transportes *" className="lg:col-span-2"><input disabled={readonly} value={form.empresa_transporte || ""} onChange={(e) => setForm({ ...form, empresa_transporte: e.target.value })} className={`${input} mt-1`} placeholder="Nombre de quien presta el transporte" /><ErrorText text={errors.empresa_transporte} /></Field>
                <Field label="NIT transportista *"><input disabled={readonly} value={form.nit_transportista || ""} onChange={(e) => setForm({ ...form, nit_transportista: onlyCode(e.target.value, 25) })} className={`${input} mt-1`} /><ErrorText text={errors.nit_transportista} /></Field>
                <Field label="País transportista"><CountryPicker disabled={readonly} value={form.pais_transportista || "Guatemala"} otherValue={form.pais_transportista_otro} onChange={(value) => setForm({ ...form, pais_transportista: value })} onOtherChange={(value) => setForm({ ...form, pais_transportista_otro: value })} /></Field>
                <Field label="CAAT *"><input disabled={readonly} value={form.caat || ""} onChange={(e) => setForm({ ...form, caat: e.target.value.toUpperCase() })} className={`${input} mt-1`} /><ErrorText text={errors.caat} /></Field>
                <Field label="Número económico *"><input disabled={readonly} value={form.numero_economico || ""} onChange={(e) => setForm({ ...form, numero_economico: e.target.value.toUpperCase() })} className={`${input} mt-1`} /><ErrorText text={errors.numero_economico} /></Field>
                <Field label="Fianza *"><TextWithNA disabled={readonly} value={form.fianza} onChange={(value) => setForm({ ...form, fianza: value })} upper /><ErrorText text={errors.fianza} /></Field>
                <Field label="Código aduanero *"><TextWithNA disabled={readonly} value={form.codigo_aduanero} onChange={(value) => setForm({ ...form, codigo_aduanero: value })} upper /><ErrorText text={errors.codigo_aduanero} /></Field>
              </div>
            </section>
          )}

          {type === "centroamerica" && (
            <section className="rounded-xl border bg-white p-4">
              <h3 className="border-b pb-3 font-bold text-[#0C2D6B]">Datos de equipo · Centroamérica</h3>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Field label="Ruta / código *" className="lg:col-span-2">{routePicker}<ErrorText text={errors.ruta_id} /></Field>
                <Field label="Código de ruta"><input readOnly value={form.ruta_codigo || selectedRoute?.codigo_ruta || ""} className={`${input} mt-1 bg-gray-100`} /></Field>
                <Field label="Nombre del piloto *" className="lg:col-span-2">{pilotPicker}<ErrorText text={errors.pilotos_id} /></Field>
                <Field label="Licencia *"><input readOnly value={form.licencia || pilot?.licencia || ""} className={`${input} mt-1 bg-gray-100`} /><ErrorText text={errors.licencia} /></Field>
                <Field label="DPI *"><input disabled={readonly} value={form.dpi_piloto || ""} onChange={(e) => setForm({ ...form, dpi_piloto: onlyDigits(e.target.value, 13) })} inputMode="numeric" pattern="[0-9]*" maxLength={13} className={`${input} mt-1`} /><ErrorText text={errors.dpi_piloto} /></Field>
                <Field label="Pasaporte *"><TextWithNA disabled={readonly} value={form.pasaporte} onChange={(value) => setForm({ ...form, pasaporte: value })} upper /><ErrorText text={errors.pasaporte} /></Field>
                <Field label="Cabezal / placa *">{vehiclePicker("cabezal", "Buscar otra placa / cabezal...")}<ErrorText text={errors.cabezal} /></Field>
                <Field label="Furgón *"><TextWithNA disabled={readonly} value={form.furgon} onChange={(value) => setForm({ ...form, furgon: value })} upper /><ErrorText text={errors.furgon} /></Field>
                <Field label="Código *"><TextWithNA disabled={readonly} value={form.codigo_equipo} onChange={(value) => setForm({ ...form, codigo_equipo: value })} upper /><ErrorText text={errors.codigo_equipo} /></Field>
                <Field label="Fianza *"><TextWithNA disabled={readonly} value={form.fianza} onChange={(value) => setForm({ ...form, fianza: value })} upper /><ErrorText text={errors.fianza} /></Field>
                <Field label="Tamaño *"><input disabled={readonly} value={form.tamano_equipo || ""} onChange={(e) => setForm({ ...form, tamano_equipo: e.target.value })} className={`${input} mt-1`} placeholder="Plataforma / 26 pies / 10T" /><ErrorText text={errors.tamano_equipo} /></Field>
                <Field label="Nombre de transporte *" className="lg:col-span-2"><input disabled={readonly} value={form.empresa_transporte || ""} onChange={(e) => setForm({ ...form, empresa_transporte: e.target.value })} className={`${input} mt-1`} /><ErrorText text={errors.empresa_transporte} /></Field>
                <Field label="Fecha de posicionamiento *"><div className="mt-1 grid grid-cols-[1fr_120px] gap-2"><input type="date" disabled={readonly} value={form.fecha_posicionamiento || ""} onChange={(e) => setForm({ ...form, fecha_posicionamiento: e.target.value })} className={input} /><input type="time" disabled={readonly} value={form.hora_posicionamiento || ""} onChange={(e) => setForm({ ...form, hora_posicionamiento: e.target.value })} className={input} /></div><ErrorText text={errors.fecha_posicionamiento} /></Field>
              </div>
            </section>
          )}

          {type === "internacional" && (
            <>
              <section className="rounded-xl border bg-white p-4">
                <h3 className="border-b pb-3 font-bold text-[#0C2D6B]">Asignación unidad y piloto · Internacional</h3>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Field label="Cliente *" className="lg:col-span-2">{clientPicker}<ErrorText text={errors.cliente_id} /></Field>
                  <Field label="Piloto *" className="lg:col-span-2">{pilotPicker}<ErrorText text={errors.pilotos_id} /></Field>
                  <Field label="Licencia"><input readOnly value={form.licencia || pilot?.licencia || ""} className={`${input} mt-1 bg-gray-100`} /></Field>
                  <Field label="CAAT *"><input disabled={readonly} value={form.caat || ""} onChange={(e) => setForm({ ...form, caat: e.target.value.toUpperCase() })} className={`${input} mt-1`} /><ErrorText text={errors.caat} /></Field>
                  <Field label="Nombre de transporte *" className="lg:col-span-2"><input disabled={readonly} value={form.empresa_transporte || ""} onChange={(e) => setForm({ ...form, empresa_transporte: e.target.value })} className={`${input} mt-1`} /><ErrorText text={errors.empresa_transporte} /></Field>
                  <Field label="Buscar ruta *" className="lg:col-span-3">{routePicker}<ErrorText text={errors.ruta_id} /></Field>
                  <Field label="Origen"><input disabled={readonly} value={form.origen || selectedRoute?.origen || ""} onChange={(e) => setForm({ ...form, origen: e.target.value })} className={`${input} mt-1`} /></Field>
                  <Field label="Destino"><input disabled={readonly} value={form.destino || selectedRoute?.destino || ""} onChange={(e) => setForm({ ...form, destino: e.target.value })} className={`${input} mt-1`} /></Field>
                  <Field label="Número económico *"><input disabled={readonly} value={form.numero_economico || ""} onChange={(e) => setForm({ ...form, numero_economico: e.target.value.toUpperCase() })} className={`${input} mt-1`} /><ErrorText text={errors.numero_economico} /></Field>
                  <Field label="Fecha de carga *"><div className="mt-1 grid grid-cols-[1fr_120px] gap-2"><input type="date" disabled={readonly} value={form.fecha_carga || ""} onChange={(e) => setForm({ ...form, fecha_carga: e.target.value })} className={input} /><input type="time" disabled={readonly} value={form.hora_carga || ""} onChange={(e) => setForm({ ...form, hora_carga: e.target.value })} className={input} /></div><ErrorText text={errors.fecha_carga} /></Field>
                  <Field label="Unidad *">{vehiclePicker("unidad", "Buscar otra unidad...")}<ErrorText text={errors.unidad} /></Field>
                  <Field label="Tamaño *"><input disabled={readonly} value={form.tamano_equipo || ""} onChange={(e) => setForm({ ...form, tamano_equipo: e.target.value })} className={`${input} mt-1`} placeholder="26 pies / 10T / Plataforma" /><ErrorText text={errors.tamano_equipo} /></Field>
                  <Field label="Días de servicio *"><input type="number" min={1} disabled={readonly} value={form.dias_servicio || 1} onChange={(e) => setForm({ ...form, dias_servicio: Number(e.target.value) })} className={`${input} mt-1`} /><ErrorText text={errors.dias_servicio} /></Field>
                </div>
              </section>
              <StatusTimeline value={timeline} onChange={(rows) => setForm({ ...form, estatus_seguimiento: rows })} readonly={readonly} title="Fecha · hora · estatus" />
              <ErrorText text={errors.estatus_seguimiento} />
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t bg-white p-4">
          <button type="button" onClick={onClose} className="h-11 rounded-xl px-5 font-bold text-gray-600 hover:bg-gray-100">{readonly ? "Cerrar" : "Cancelar"}</button>
          {!readonly && <button type="button" onClick={onSave} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0C2D6B] px-6 font-bold text-white"><Save className="h-4 w-4" /> Guardar {meta.label}</button>}
        </div>
      </div>
    </div>
  );
}

function ClosingModal({ mode, form, setForm, errors, proveedores, usuarios, onClose, onSave, patchMoney, getCliente, getPiloto, getVehiculo, getRuta, rutaLabel }: AnyRow) {
  const readonly = mode === "view";
  const detail = parseJson(form.detalle_operativo_json);
  const cliente = getCliente(form.cliente_id)?.nombre_empresa || form.cliente || "-";
  const piloto = fullPilot(getPiloto(form.piloto_id || form.pilotos_id)) || form.piloto || "-";
  const vehicle = getVehiculo(form.vehiculo_id);
  const route = getRuta(form.ruta_id);
  const totalProvider = numeric(form.totalProveedor);
  const margin = numeric(form.total) - totalProvider;

  return (
    <div className="fixed inset-0 z-[105] bg-black/55 flex justify-end">
      <div className="h-full w-full max-w-6xl bg-white shadow-2xl flex flex-col">
        <div className="bg-[#0C2D6B] px-5 py-4 text-white flex justify-between items-center">
          <div><p className="text-xs uppercase tracking-[0.2em] text-white/70">Operación finalizada</p><h2 className="text-xl font-bold">Cierre / Excel final · {form.codigo_asignacion}</h2></div>
          <button onClick={onClose}><X /></button>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#F6F7F9] p-4 sm:p-5 space-y-4">
          {Object.keys(errors).length > 0 && !readonly && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><b>Revisa el cierre:</b><ul className="ml-5 list-disc">{Object.values(errors).map((x: any, i) => <li key={i}>{x}</li>)}</ul></div>}

          <section className="rounded-xl border bg-white p-4">
            <h3 className="border-b pb-3 font-bold text-[#0C2D6B]">Datos operativos finalizados</h3>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[ ["Cliente", cliente], ["Tipo", TYPE_META[(form.tipo_asignacion || detail.tipo_asignacion || "local") as AssignmentType].label], ["Piloto", piloto], ["Unidad", vehicle?.codigo || form.cabezal || "-"], ["Ruta", rutaLabel(route)], ["Carga", date10(form.fecha_carga)], ["Descarga", date10(form.fecha_descarga)], ["Estado", form.estado || "Finalizado"] ].map(([k, v]) => <div key={k} className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400">{k}</p><b className="text-sm text-[#0C2D6B]">{v}</b></div>)}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4">
            <h3 className="border-b pb-3 font-bold text-[#0C2D6B]">Proveedor y control para el Excel</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Field label="Proveedor *" className="lg:col-span-2"><select disabled={readonly} value={form.proveedor_id || ""} onChange={(e) => setForm({ ...form, proveedor_id: e.target.value })} className={`${input} mt-1`}><option value="">Seleccionar proveedor...</option>{proveedores.map((p: AnyRow) => <option key={p.id} value={p.id}>{p.razon_social || p.nombre_comercial}</option>)}</select><ErrorText text={errors.proveedor_id} /></Field>
              <Field label="Documentos"><select disabled={readonly} value={form.doc || "Pendiente"} onChange={(e) => setForm({ ...form, doc: e.target.value })} className={`${input} mt-1`}><option>Pendiente</option><option>Completo</option></select></Field>
              <Field label="Vendedor"><select disabled={readonly} value={form.vendedor_id || ""} onChange={(e) => setForm({ ...form, vendedor_id: e.target.value })} className={`${input} mt-1`}><option value="">Seleccionar...</option>{usuarios.map((u: AnyRow) => <option key={u.id} value={u.id}>{u.nombre_usuario || fullName(u)}</option>)}</select></Field>
              <Field label="Marchamo / referencia"><input disabled={readonly} value={form.marchamo || ""} onChange={(e) => setForm({ ...form, marchamo: e.target.value })} className={`${input} mt-1`} /></Field>
              <Field label="Km"><input disabled={readonly} value={form.km || ""} onChange={(e) => setForm({ ...form, km: cleanNum(e.target.value) })} className={`${input} mt-1`} /></Field>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4">
            <h3 className="border-b pb-3 font-bold text-[#0C2D6B]">Costos / ingreso del cliente</h3>
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              {[ ["auxiliar", "Auxiliar"], ["flete", "Flete"], ["parada_adicional", "Parada adicional"], ["movimiento_falso", "Mov. en falso"], ["estadia", "Estadía"], ["viaje_doble", "Viaje doble"], ["otros", "Otros"] ].map(([field, label]) => <Field key={field} label={label}><input disabled={readonly} value={form[field] || ""} onChange={(e) => patchMoney(field, e.target.value)} className={`${input} mt-1`} /></Field>)}
              <div className="rounded-xl border border-green-100 bg-green-50 p-3"><p className="text-xs text-gray-500">Total cliente</p><b className="text-xl text-green-600">{money(form.total)}</b></div>
            </div>
            <ErrorText text={errors.total} />
          </section>

          <section className="rounded-xl border bg-white p-4">
            <h3 className="border-b pb-3 font-bold text-[#0C2D6B]">Costos factura / proveedor</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
              <Field label="Fecha"><input type="date" disabled={readonly} value={form.fechaProveedor || ""} onChange={(e) => setForm({ ...form, fechaProveedor: e.target.value })} className={`${input} mt-1`} /></Field>
              <Field label="Serie"><input disabled={readonly} value={form.serieProveedor || ""} onChange={(e) => setForm({ ...form, serieProveedor: e.target.value.toUpperCase() })} className={`${input} mt-1`} /></Field>
              <Field label="Número"><input disabled={readonly} value={form.numeroProveedor || ""} onChange={(e) => setForm({ ...form, numeroProveedor: e.target.value.replace(/[^0-9A-Za-z-]/g, "") })} className={`${input} mt-1`} /></Field>
              {[ ["fleteProveedor", "Flete"], ["cuadrilla", "Cuadrilla"], ["estadiaProveedor", "Estadía"] ].map(([field, label]) => <Field key={field} label={label}><input disabled={readonly} value={form[field] || ""} onChange={(e) => patchMoney(field, e.target.value)} className={`${input} mt-1`} /></Field>)}
              <Field label="Fecha pago"><input type="date" disabled={readonly} value={form.fechaPagoProveedor || ""} onChange={(e) => setForm({ ...form, fechaPagoProveedor: e.target.value })} className={`${input} mt-1`} /></Field>
              <div className="rounded-xl border border-red-100 bg-red-50 p-3"><p className="text-xs text-gray-500">Total proveedor</p><b className="text-xl text-red-600">{money(totalProvider)}</b></div>
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-3"><p className="text-xs text-gray-500">Margen</p><b className={`text-xl ${margin >= 0 ? "text-[#0C2D6B]" : "text-red-600"}`}>{money(margin)}</b></div>
            </div>
            <ErrorText text={errors.margen} />
          </section>

          <section className="rounded-xl border bg-white p-4">
            <h3 className="border-b pb-3 font-bold text-[#0C2D6B]">Factura Grupo Logístico 365 a clientes</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
              <Field label="Fecha"><input type="date" disabled={readonly} value={form.fechaFactura || ""} onChange={(e) => setForm({ ...form, fechaFactura: e.target.value })} className={`${input} mt-1`} /></Field>
              <Field label="Serie"><input disabled={readonly} value={form.serieFactura || ""} onChange={(e) => setForm({ ...form, serieFactura: e.target.value.toUpperCase() })} className={`${input} mt-1`} /></Field>
              <Field label="Número"><input disabled={readonly} value={form.numeroFactura || ""} onChange={(e) => setForm({ ...form, numeroFactura: e.target.value.replace(/[^0-9A-Za-z-]/g, "") })} className={`${input} mt-1`} /></Field>
              <Field label="Valor"><input disabled={readonly} value={form.valorFactura || ""} onChange={(e) => setForm({ ...form, valorFactura: numeric(cleanNum(e.target.value)) })} className={`${input} mt-1`} /></Field>
              <Field label="Fecha pago"><input type="date" disabled={readonly} value={form.fechaPagoFactura || ""} onChange={(e) => setForm({ ...form, fechaPagoFactura: e.target.value })} className={`${input} mt-1`} /></Field>
            </div>
          </section>
        </div>

        <div className="border-t bg-white p-4 flex justify-end gap-2">
          <button onClick={onClose} className="h-11 rounded-xl px-5 font-bold text-gray-600 hover:bg-gray-100">{readonly ? "Cerrar" : "Cancelar"}</button>
          {!readonly && <button onClick={onSave} className="h-11 rounded-xl bg-[#0C2D6B] px-6 font-bold text-white inline-flex items-center gap-2"><Save className="h-4 w-4" /> Guardar cierre</button>}
        </div>
      </div>
    </div>
  );
}

export default Operaciones;