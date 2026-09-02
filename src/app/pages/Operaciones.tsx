import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Truck,
  Star,
  AlertTriangle,
  DollarSign,
  X,
  CheckCircle2,
  Download,
  Save,
  RefreshCw,
  Building2,
} from "lucide-react";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import logoEmpresa from "../../assets/614cb11181e5d72cb3a39a09d833f4775b7fc7ce.png";

const API_BASE_URL = "/api";

type Tab = "asignaciones" | "proveedores";
type Mode = "create" | "edit" | "view";

interface AnyRow {
  [key: string]: any;
}

const input =
  "w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm outline-none focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/15 disabled:bg-gray-100 disabled:text-gray-500";

const errorInput = "border-red-400 focus:border-red-500 focus:ring-red-100";

async function apiRequest<T = any>(path: string, options: RequestInit = {}): Promise<T> {
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

  return (json?.data ?? json) as T;
}

const rows = <T,>(value: any, fallback: T[] = []): T[] =>
  Array.isArray(value) ? value : fallback;

const money = (value?: number | string | null) =>
  `Q ${Number(value || 0).toLocaleString("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const date10 = (value: any) => {
  const text = String(value || "").trim();
  return text ? text.slice(0, 10) : "";
};

const numeric = (value: any) => {
  const number = Number(String(value ?? 0).replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
};

const cleanNum = (value: string) =>
  value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");

const cleanCommercialTyping = (value: string, max = 140) =>
  value
    .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s.,#&()'\/-]/g, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, max);

function titleCaseText(value: string) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es-GT")
    .replace(/(^|[\s'-])([a-záéíóúüñ])/g, (_m, sep, letter) =>
      `${sep}${letter.toLocaleUpperCase("es-GT")}`
    );
}

function titleCaseCompany(value: string) {
  return titleCaseText(value)
    .replace(/\bS\.\s*A\.?\b/gi, "S.A.")
    .replace(/\bS\.\s*De\s*R\.\s*L\.?\b/gi, "S. de R.L.")
    .replace(/\bGl365\b/gi, "GL365")
    .replace(/\bFtl\b/g, "FTL")
    .replace(/\bLtl\b/g, "LTL")
    .replace(/\bFcl\b/g, "FCL")
    .replace(/\bLcl\b/g, "LCL");
}

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


const extractEmail = (value: any) => {
  const match = String(value || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : "";
};

const extractPhone = (value: any, max = 15) => {
  const text = String(value || "");
  const pieces = text
    .split(/[\/,;|]+/)
    .map((piece) => piece.replace(/\D/g, ""))
    .filter((piece) => piece.length >= 7);

  if (pieces[0]) return pieces[0].slice(0, max);

  const all = text.replace(/\D/g, "");
  return all.length >= 7 ? all.slice(0, max) : "";
};

const providerEmail = (row: AnyRow) => extractEmail(row?.correo || row?.contact || row?.contacto);
const providerPhone = (row: AnyRow) => extractPhone(row?.telefono || row?.contact || row?.contacto);

const bool = (value: any) =>
  value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";

const fullName = (row?: AnyRow) =>
  row
    ? [row.primer_nombre, row.segundo_nombre, row.primer_apellido, row.segundo_apellido]
        .filter(Boolean)
        .join(" ")
    : "";

const fullPilot = (row?: AnyRow) =>
  row?.nombre_piloto || row?.piloto || fullName(row) || "";

const fullUser = (row?: AnyRow) =>
  row?.nombre_completo || fullName(row) || row?.nombre_usuario || "";

const uniqueById = (items: AnyRow[]) => {
  const map = new Map<number, AnyRow>();

  items.forEach((item) => {
    const id = Number(item?.id);
    if (id) map.set(id, item);
  });

  return Array.from(map.values());
};

const nextCode = (prefix: string, items: AnyRow[], field: string) => {
  const max = Math.max(
    0,
    ...items.map((item) => {
      const match = String(item?.[field] || "").match(/(\d+)(?!.*\d)/);
      return match ? Number(match[1]) : 0;
    })
  );

  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
};

function ErrorText({ text }: { text?: string }) {
  return text ? <p className="text-xs text-red-600 font-medium mt-1">{text}</p> : null;
}

function ActionButton({
  icon: Icon,
  label,
  tone = "blue",
  onClick,
}: {
  icon: any;
  label: string;
  tone?: "blue" | "orange" | "red" | "gray";
  onClick: () => void;
}) {
  const color =
    tone === "orange"
      ? "bg-orange-50 text-[#C85100] border-orange-100 hover:bg-orange-100"
      : tone === "red"
      ? "bg-red-50 text-red-600 border-red-100 hover:bg-red-100"
      : tone === "gray"
      ? "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
      : "bg-blue-50 text-[#0C2D6B] border-blue-100 hover:bg-blue-100";

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`h-8 w-8 min-h-[32px] min-w-[32px] rounded-lg border inline-flex items-center justify-center shrink-0 transition-colors shadow-sm ${color}`}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
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
    <div className="border-t bg-white px-4 py-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
          {[5, 10, 15, 25, 50].map((size) => (
            <option key={size} value={size}>{size} por página</option>
          ))}
        </select>

        <button type="button" onClick={() => onPageChange(1)} disabled={page <= 1} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-[#0C2D6B] shadow-sm disabled:cursor-not-allowed disabled:text-gray-300 disabled:shadow-none">Primera</button>
        <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-[#0C2D6B] shadow-sm disabled:cursor-not-allowed disabled:text-gray-300 disabled:shadow-none">Anterior</button>
        <button type="button" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-[#0C2D6B] shadow-sm disabled:cursor-not-allowed disabled:text-gray-300 disabled:shadow-none">Siguiente</button>
        <button type="button" onClick={() => onPageChange(totalPages)} disabled={page >= totalPages} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-[#0C2D6B] shadow-sm disabled:cursor-not-allowed disabled:text-gray-300 disabled:shadow-none">Última</button>
      </div>
    </div>
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

async function drawCorporatePdfHeader(doc: jsPDF, title: string, subtitle: string) {
  doc.setFillColor(12, 45, 107);
  doc.rect(0, 0, 210, 38, "F");

  // Tarjeta blanca para que el logo azul/naranja conserve contraste.
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(255, 106, 0);
  doc.setLineWidth(0.6);
  doc.roundedRect(8, 4, 48, 29, 2, 2, "FD");

  const logo = await imageUrlToDataUrl(logoEmpresa);
  if (logo) {
    try {
      doc.addImage(logo, "PNG", 11, 7, 42, 23, undefined, "FAST");
    } catch {
      // El reporte sigue funcionando aunque el navegador no convierta la imagen.
    }
  }

  doc.setTextColor(255, 106, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("GRUPO LOGÍSTICO 365", 132, 10, { align: "center" });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.text(title.toUpperCase(), 132, 20, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(subtitle, 132, 27, { align: "center" });

  doc.setDrawColor(255, 106, 0);
  doc.setLineWidth(0.8);
  doc.line(70, 32, 196, 32);
  doc.setTextColor(0, 0, 0);
}

export function Operaciones() {
  const [tab, setTab] = useState<Tab>("asignaciones");
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
  const [estadosAsignacion, setEstadosAsignacion] = useState<AnyRow[]>([]);
  const [estadosProveedor, setEstadosProveedor] = useState<AnyRow[]>([]);

  const [search, setSearch] = useState("");
  const [estadoAsigFiltro, setEstadoAsigFiltro] = useState("Todos");
  const [proveedorAsigFiltro, setProveedorAsigFiltro] = useState("Todos");
  const [estadoProvFiltro, setEstadoProvFiltro] = useState("Todos");
  const [nivelFiltro, setNivelFiltro] = useState("Todos");
  const [satFiltro, setSatFiltro] = useState("Todos");
  const [sortField, setSortField] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Paginación independiente para cada submódulo.
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [providerPage, setProviderPage] = useState(1);

  const [assignmentModal, setAssignmentModal] = useState<{ open: boolean; mode: Mode }>({
    open: false,
    mode: "create",
  });
  const [assignmentForm, setAssignmentForm] = useState<AnyRow>({});
  const [assignmentErrors, setAssignmentErrors] = useState<Record<string, string>>({});
  const [expandedAssignment, setExpandedAssignment] = useState<number | null>(null);

  const [providerModal, setProviderModal] = useState<{ open: boolean; mode: Mode }>({
    open: false,
    mode: "create",
  });
  const [providerForm, setProviderForm] = useState<AnyRow>({});
  const [providerErrors, setProviderErrors] = useState<Record<string, string>>({});
  const [providerReturnToAssignment, setProviderReturnToAssignment] = useState(false);

  // Alta rápida de cliente desde Nueva Asignación.
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [quickClientForm, setQuickClientForm] = useState<AnyRow>({});
  const [quickClientErrors, setQuickClientErrors] = useState<Record<string, string>>({});

  const [deleteBox, setDeleteBox] = useState<{ type: "asignacion" | "proveedor"; id: number } | null>(null);

  const estadoAsignacionNombre = (id?: number | string | null) =>
    estadosAsignacion.find((item) => Number(item.id) === Number(id))?.nombre_estado_asignacion ||
    asignaciones.find((item) => Number(item.estado_asignacion_id) === Number(id))?.estado ||
    "Pendiente";

  const estadoProveedorNombre = (id?: number | string | null) =>
    estadosProveedor.find((item) => Number(item.id) === Number(id))?.nombre_estado_proveedor ||
    (Number(id) === 2 ? "Inactivo" : "Activo");

  const rutaLabel = (ruta?: AnyRow) => {
    if (!ruta) return "-";
    if (ruta.origen || ruta.destino) return `${ruta.origen || "Origen"} → ${ruta.destino || "Destino"}`;

    const origen = rutas.find((item) => Number(item.id) === Number(ruta.origen_id));
    const destino = rutas.find((item) => Number(item.id) === Number(ruta.destino_id));

    return origen || destino
      ? `${origen?.nombre_ubicacion || "Origen"} → ${destino?.nombre_ubicacion || "Destino"}`
      : ruta.nombre_ruta || ruta.nombre || "-";
  };

  const loadData = async () => {
    setLoading(true);
    setApiError("");

    try {
      const [op, crm, estadosA, estadosP] = await Promise.all([
        apiRequest<AnyRow>("/operaciones/bootstrap"),
        apiRequest<AnyRow>("/crm/bootstrap").catch(() => ({})),
        apiRequest<AnyRow[]>("/mantenimiento/tablas/estado_asignacion/registros").catch(() => []),
        apiRequest<AnyRow[]>("/mantenimiento/tablas/estado_proveedor/registros").catch(() => []),
      ]);

      const apiAsignaciones = rows<AnyRow>(op.asignaciones);
      const apiProveedores = rows<AnyRow>(op.proveedores);

      const clientesFromAssignments = apiAsignaciones
        .filter((row) => row.cliente_id)
        .map((row) => ({
          id: Number(row.cliente_id),
          codigo_cliente: row.codigo_cliente || `CLI-${String(row.cliente_id).padStart(3, "0")}`,
          nombre_empresa: row.nombre_empresa || row.cliente || "Cliente operativo",
          nit: row.nit || "",
          estado_cliente_id: 1,
        }));

      const proveedoresFromAssignments = apiAsignaciones
        .filter((row) => row.proveedor_id)
        .map((row) => ({
          id: Number(row.proveedor_id),
          codigo_proveedor: row.codigo_proveedor || `PROV-${String(row.proveedor_id).padStart(3, "0")}`,
          razon_social: row.proveedor_razon_social || row.proveedor || "Proveedor",
          nombre_comercial: row.proveedor || row.nombre_comercial || null,
          nit: row.nit_proveedor || "",
          estado_id: 1,
          correo: providerEmail(row) || null,
          telefono: providerPhone(row) || null,
          service: row.service || row.servicio || "Transporte",
          performance: row.performance || row.desempeno || "Amarillo",
          estado_sat: row.estado_sat || "pendiente",
        }));

      setAsignaciones(apiAsignaciones);
      setProveedores(uniqueById([...apiProveedores, ...proveedoresFromAssignments]));
      setClientes(uniqueById([...rows<AnyRow>(crm.clientes), ...clientesFromAssignments]));
      setRutas(rows<AnyRow>(op.rutas));
      setVehiculos(rows<AnyRow>(op.vehiculos));
      setPilotos(rows<AnyRow>(op.pilotos));
      setUsuarios(rows<AnyRow>(crm.usuarios));
      setEstadosAsignacion(rows<AnyRow>(estadosA));
      setEstadosProveedor(rows<AnyRow>(estadosP));
    } catch (error: any) {
      console.error("Error cargando Operaciones:", error);
      setApiError(error.message || "No se pudo conectar Operaciones con MySQL.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const getCliente = (id?: number | string | null) =>
    clientes.find((item) => Number(item.id) === Number(id));

  const getRuta = (id?: number | string | null) =>
    rutas.find((item) => Number(item.id) === Number(id));

  const getVehiculo = (id?: number | string | null) =>
    vehiculos.find((item) => Number(item.id) === Number(id));

  const getPiloto = (id?: number | string | null) =>
    pilotos.find((item) => Number(item.id) === Number(id));

  const getProveedor = (id?: number | string | null) =>
    proveedores.find((item) => Number(item.id) === Number(id));

  const getUsuario = (id?: number | string | null) =>
    usuarios.find((item) => Number(item.id) === Number(id));

  const resetFilters = () => {
    setSearch("");
    setEstadoAsigFiltro("Todos");
    setProveedorAsigFiltro("Todos");
    setEstadoProvFiltro("Todos");
    setNivelFiltro("Todos");
    setSatFiltro("Todos");
    setSortField("");
    setSortDirection("asc");
    setAssignmentPage(1);
    setProviderPage(1);
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

  const SortableTh = ({
    field,
    children,
    className = "",
  }: {
    field: string;
    children: ReactNode;
    className?: string;
  }) => (
    <th className={className}>
      <button
        type="button"
        onClick={() => handleSort(field)}
        className={`inline-flex items-center gap-0.5 text-[13px] font-bold transition-colors hover:text-[#FF6A00] ${
          sortField === field ? "text-[#FF6A00]" : "text-[#0C2D6B]"
        }`}
        title="Ordenar ascendente o descendente"
      >
        <span>{children}</span>
        <span className={`text-[9px] leading-none ${sortField === field ? "text-[#FF6A00]" : "text-gray-300"}`}>
          {sortIcon(field)}
        </span>
      </button>
    </th>
  );

  const filteredAssignments = useMemo(() => {
    const term = search.trim().toLowerCase();

    return asignaciones.filter((item) => {
      const cliente = getCliente(item.cliente_id)?.nombre_empresa || item.cliente || item.nombre_empresa || "";
      const proveedor = getProveedor(item.proveedor_id)?.razon_social || item.proveedor || "";
      const piloto = fullPilot(getPiloto(item.pilotos_id || item.piloto_id)) || item.piloto || "";
      const vehiculo = getVehiculo(item.vehiculo_id)?.codigo || item.cabezal || "";
      const ruta = rutaLabel(getRuta(item.ruta_id)) || item.ruta || "";
      const estado = estadoAsignacionNombre(item.estado_asignacion_id);

      return (
        (!term ||
          String(item.codigo_asignacion || "").toLowerCase().includes(term) ||
          cliente.toLowerCase().includes(term) ||
          proveedor.toLowerCase().includes(term) ||
          piloto.toLowerCase().includes(term) ||
          vehiculo.toLowerCase().includes(term) ||
          ruta.toLowerCase().includes(term)) &&
        (estadoAsigFiltro === "Todos" || estado === estadoAsigFiltro) &&
        (proveedorAsigFiltro === "Todos" || String(item.proveedor_id || "") === proveedorAsigFiltro)
      );
    });
  }, [asignaciones, search, estadoAsigFiltro, proveedorAsigFiltro, clientes, proveedores, pilotos, vehiculos, rutas, estadosAsignacion]);

  const sortedAssignments = useMemo(() => {
    const rows = [...filteredAssignments];

    rows.sort((a, b) => {
      const clienteA = getCliente(a.cliente_id)?.nombre_empresa || a.cliente || a.nombre_empresa || "";
      const clienteB = getCliente(b.cliente_id)?.nombre_empresa || b.cliente || b.nombre_empresa || "";
      const proveedorA = getProveedor(a.proveedor_id)?.razon_social || a.proveedor || "";
      const proveedorB = getProveedor(b.proveedor_id)?.razon_social || b.proveedor || "";
      const pilotoA = fullPilot(getPiloto(a.pilotos_id || a.piloto_id)) || a.piloto || "";
      const pilotoB = fullPilot(getPiloto(b.pilotos_id || b.piloto_id)) || b.piloto || "";
      const vehiculoA = getVehiculo(a.vehiculo_id)?.codigo || a.cabezal || "";
      const vehiculoB = getVehiculo(b.vehiculo_id)?.codigo || b.cabezal || "";
      const rutaA = rutaLabel(getRuta(a.ruta_id)) || a.ruta || "";
      const rutaB = rutaLabel(getRuta(b.ruta_id)) || b.ruta || "";
      const margenA = numeric(a.total) - numeric(a.totalProveedor || a.total_proveedor);
      const margenB = numeric(b.total) - numeric(b.totalProveedor || b.total_proveedor);

      const av =
        sortField === "cliente" ? clienteA :
        sortField === "codigo" ? a.codigo_asignacion :
        sortField === "estado" ? estadoAsignacionNombre(a.estado_asignacion_id) :
        sortField === "ruta" ? rutaA :
        sortField === "piloto" ? pilotoA :
        sortField === "vehiculo" ? vehiculoA :
        sortField === "proveedor" ? proveedorA :
        sortField === "total" ? numeric(a.total) :
        sortField === "margen" ? margenA :
        "";

      const bv =
        sortField === "cliente" ? clienteB :
        sortField === "codigo" ? b.codigo_asignacion :
        sortField === "estado" ? estadoAsignacionNombre(b.estado_asignacion_id) :
        sortField === "ruta" ? rutaB :
        sortField === "piloto" ? pilotoB :
        sortField === "vehiculo" ? vehiculoB :
        sortField === "proveedor" ? proveedorB :
        sortField === "total" ? numeric(b.total) :
        sortField === "margen" ? margenB :
        "";

      return sortField ? compareValues(av, bv, sortDirection) : 0;
    });

    return rows;
  }, [filteredAssignments, sortField, sortDirection, clientes, proveedores, pilotos, vehiculos, rutas, estadosAsignacion]);

  const filteredProviders = useMemo(() => {
    const term = search.trim().toLowerCase();

    return proveedores.filter((item) => {
      const estado = estadoProveedorNombre(item.estado_id);
      const nivel = item.performance || item.desempeno || "Amarillo";
      const sat = item.estado_sat || (String(item.satStatus || "").toLowerCase().includes("solvente") ? "vigente" : "pendiente");

      return (
        (!term ||
          String(item.codigo_proveedor || "").toLowerCase().includes(term) ||
          String(item.razon_social || item.name || "").toLowerCase().includes(term) ||
          String(item.nombre_comercial || "").toLowerCase().includes(term) ||
          String(item.nit || "").toLowerCase().includes(term) ||
          String(item.service || item.servicio || "").toLowerCase().includes(term)) &&
        (estadoProvFiltro === "Todos" || estado === estadoProvFiltro) &&
        (nivelFiltro === "Todos" || nivel === nivelFiltro) &&
        (satFiltro === "Todos" || sat === satFiltro)
      );
    });
  }, [proveedores, search, estadoProvFiltro, nivelFiltro, satFiltro, estadosProveedor]);

  const sortedProviders = useMemo(() => {
    const rows = [...filteredProviders];

    rows.sort((a, b) => {
      const av =
        sortField === "codigo_proveedor" ? a.codigo_proveedor :
        sortField === "proveedor" ? (a.razon_social || a.name || "") :
        sortField === "nit" ? a.nit :
        sortField === "servicio" ? (a.service || a.servicio || "") :
        sortField === "contacto" ? `${providerEmail(a)} ${providerPhone(a)}` :
        sortField === "desempeno" ? (a.performance || a.desempeno || "Amarillo") :
        sortField === "sat" ? (a.estado_sat || a.satStatus || "") :
        sortField === "estado" ? estadoProveedorNombre(a.estado_id) :
        "";

      const bv =
        sortField === "codigo_proveedor" ? b.codigo_proveedor :
        sortField === "proveedor" ? (b.razon_social || b.name || "") :
        sortField === "nit" ? b.nit :
        sortField === "servicio" ? (b.service || b.servicio || "") :
        sortField === "contacto" ? `${providerEmail(b)} ${providerPhone(b)}` :
        sortField === "desempeno" ? (b.performance || b.desempeno || "Amarillo") :
        sortField === "sat" ? (b.estado_sat || b.satStatus || "") :
        sortField === "estado" ? estadoProveedorNombre(b.estado_id) :
        "";

      return sortField ? compareValues(av, bv, sortDirection) : 0;
    });

    return rows;
  }, [filteredProviders, sortField, sortDirection, estadosProveedor]);

  const assignmentTotalPages = Math.max(1, Math.ceil(sortedAssignments.length / rowsPerPage));
  const providerTotalPages = Math.max(1, Math.ceil(sortedProviders.length / rowsPerPage));

  const paginatedAssignments = useMemo(() => {
    const start = (assignmentPage - 1) * rowsPerPage;
    return sortedAssignments.slice(start, start + rowsPerPage);
  }, [sortedAssignments, assignmentPage, rowsPerPage]);

  const paginatedProviders = useMemo(() => {
    const start = (providerPage - 1) * rowsPerPage;
    return sortedProviders.slice(start, start + rowsPerPage);
  }, [sortedProviders, providerPage, rowsPerPage]);

  useEffect(() => {
    setAssignmentPage(1);
  }, [search, estadoAsigFiltro, proveedorAsigFiltro, sortField, sortDirection, rowsPerPage]);

  useEffect(() => {
    setProviderPage(1);
  }, [search, estadoProvFiltro, nivelFiltro, satFiltro, sortField, sortDirection, rowsPerPage]);

  useEffect(() => {
    setAssignmentPage((page) => Math.min(page, assignmentTotalPages));
  }, [assignmentTotalPages]);

  useEffect(() => {
    setProviderPage((page) => Math.min(page, providerTotalPages));
  }, [providerTotalPages]);

  const margenTotal = asignaciones.reduce(
    (sum, item) => sum + numeric(item.total) - numeric(item.totalProveedor || item.total_proveedor),
    0
  );

  const docsPendientes = asignaciones.filter((item) =>
    String(item.doc || item.documentos || "").toLowerCase() !== "completo"
  ).length;

  const pagosProveedorPendientes = asignaciones.filter(
    (item) => numeric(item.totalProveedor || item.total_proveedor) > 0 && !item.fechaPagoProveedor && !item.fecha_pago_proveedor
  ).length;

  const riesgoAlto = proveedores.filter((item) => (item.performance || item.desempeno) === "Rojo").length;
  const satNoVigente = proveedores.filter((item) => item.estado_sat === "no_vigente").length;

  const kpis = tab === "asignaciones"
    ? [
        ["Asignaciones", asignaciones.length, Truck, "blue"],
        ["Docs pendientes", docsPendientes, AlertTriangle, "orange"],
        ["Margen total", money(margenTotal), DollarSign, margenTotal >= 0 ? "green" : "red"],
        ["Pagos proveedor", pagosProveedorPendientes, Star, "blue"],
      ]
    : [
        ["Proveedores", proveedores.length, Building2, "blue"],
        ["Activos", proveedores.filter((item) => estadoProveedorNombre(item.estado_id) === "Activo").length, Star, "green"],
        ["Riesgo alto", riesgoAlto, AlertTriangle, "red"],
        ["SAT no vigente", satNoVigente, AlertTriangle, "orange"],
      ];

  const stateClass = (value: string) => {
    const state = value.toLowerCase();
    if (state.includes("complet") || state.includes("final") || state.includes("liquid")) return "bg-green-100 text-green-700";
    if (state.includes("curso") || state.includes("ruta")) return "bg-blue-100 text-blue-700";
    if (state.includes("asign")) return "bg-indigo-100 text-indigo-700";
    if (state.includes("cancel")) return "bg-red-100 text-red-700";
    return "bg-orange-100 text-orange-700";
  };

  const satClass = (value?: string) =>
    value === "vigente"
      ? "bg-green-100 text-green-700"
      : value === "no_vigente"
      ? "bg-red-100 text-red-700"
      : "bg-orange-100 text-orange-700";

  const openAssignment = (mode: Mode, item?: AnyRow) => {
    setAssignmentErrors({});
    setAssignmentModal({ open: true, mode });

    if (item) {
      setAssignmentForm({
        ...item,
        pilotos_id: item.pilotos_id || item.piloto_id,
        fecha_carga: date10(item.fecha_carga || item.carga),
        fecha_descarga: date10(item.fecha_descarga || item.descarga),
        doc: item.doc || item.documentos || "Pendiente",
        fechaProveedor: date10(item.fechaProveedor || item.fecha_proveedor),
        serieProveedor: item.serieProveedor || item.serie_proveedor || "",
        numeroProveedor: item.numeroProveedor || item.numero_proveedor || "",
        fleteProveedor: item.fleteProveedor || item.flete_proveedor || 0,
        estadiaProveedor: item.estadiaProveedor || item.estadia_proveedor || 0,
        totalProveedor: item.totalProveedor || item.total_proveedor || 0,
        fechaPagoProveedor: date10(item.fechaPagoProveedor || item.fecha_pago_proveedor),
        fechaFactura: date10(item.fechaFactura || item.fecha_factura),
        serieFactura: item.serieFactura || item.serie_factura || "",
        numeroFactura: item.numeroFactura || item.numero_factura || "",
        valorFactura: item.valorFactura || item.valor_factura || 0,
        fechaPagoFactura: date10(item.fechaPagoFactura || item.fecha_pago_factura),
      });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    setAssignmentForm({
      codigo_asignacion: nextCode("ASG", asignaciones, "codigo_asignacion"),
      cliente_id: "",
      ruta_id: "",
      vehiculo_id: "",
      pilotos_id: "",
      proveedor_id: "",
      estado_asignacion_id: estadosAsignacion[0]?.id || 1,
      fecha_carga: today,
      fecha_descarga: "",
      vendedor_id: usuarios[0]?.id || "",
      doc: "Pendiente",
      flete: 0,
      parada_adicional: 0,
      movimiento_falso: 0,
      estadia: 0,
      viaje_doble: 0,
      otros: 0,
      total: 0,
      fleteProveedor: 0,
      cuadrilla: 0,
      estadiaProveedor: 0,
      totalProveedor: 0,
      nueva_ruta: false,
      origen: "",
      destino: "",
      km: "",
    });
  };

  const patchAssignmentMoney = (field: string, value: string) => {
    const next = { ...assignmentForm, [field]: numeric(cleanNum(value)) };

    if (["flete", "parada_adicional", "movimiento_falso", "estadia", "viaje_doble", "otros"].includes(field)) {
      next.total =
        numeric(next.flete) +
        numeric(next.parada_adicional) +
        numeric(next.movimiento_falso) +
        numeric(next.estadia) +
        numeric(next.viaje_doble) +
        numeric(next.otros);
    }

    if (["fleteProveedor", "cuadrilla", "estadiaProveedor"].includes(field)) {
      next.totalProveedor =
        numeric(next.fleteProveedor) + numeric(next.cuadrilla) + numeric(next.estadiaProveedor);
    }

    setAssignmentForm(next);
  };

  const validateAssignment = () => {
    const errors: Record<string, string> = {};

    if (!assignmentForm.cliente_id) errors.cliente_id = "Selecciona un cliente.";
    const rutaNuevaValida =
      !assignmentForm.ruta_id &&
      String(assignmentForm.origen || "").trim() &&
      String(assignmentForm.destino || "").trim() &&
      numeric(assignmentForm.km) > 0;

    if (!assignmentForm.ruta_id && !rutaNuevaValida) {
      errors.ruta_id = "Selecciona una ruta o crea una nueva con origen, destino y kilómetros.";
    }
    if (!assignmentForm.vehiculo_id) errors.vehiculo_id = "Selecciona un vehículo.";
    if (!assignmentForm.pilotos_id) errors.pilotos_id = "Selecciona un piloto.";
    if (!assignmentForm.proveedor_id) errors.proveedor_id = "Selecciona un proveedor.";
    if (!assignmentForm.fecha_carga) errors.fecha_carga = "La fecha de carga es obligatoria.";
    if (!assignmentForm.fecha_descarga) errors.fecha_descarga = "La fecha de descarga es obligatoria.";
    if (assignmentForm.fecha_carga && assignmentForm.fecha_descarga && assignmentForm.fecha_descarga < assignmentForm.fecha_carga) {
      errors.fecha_descarga = "La descarga no puede ser anterior a la carga.";
    }
    if (numeric(assignmentForm.flete) <= 0) errors.flete = "El flete debe ser mayor a 0.";
    if (numeric(assignmentForm.totalProveedor) > numeric(assignmentForm.total)) {
      errors.margen = "El costo del proveedor supera el total cobrado al cliente.";
    }

    setAssignmentErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveAssignment = async () => {
    if (!validateAssignment()) return;

    const payload = {
      ...assignmentForm,
      piloto_id: assignmentForm.pilotos_id,
      fecha_carga: assignmentForm.fecha_carga,
      fecha_descarga: assignmentForm.fecha_descarga,
      km: assignmentForm.km,
      origen: assignmentForm.origen,
      destino: assignmentForm.destino,
      nueva_ruta: assignmentForm.nueva_ruta,
      documentos: assignmentForm.doc,
      fechaProveedor: assignmentForm.fechaProveedor,
      serieProveedor: assignmentForm.serieProveedor,
      numeroProveedor: assignmentForm.numeroProveedor,
      fleteProveedor: assignmentForm.fleteProveedor,
      estadiaProveedor: assignmentForm.estadiaProveedor,
      totalProveedor: assignmentForm.totalProveedor,
      fechaPagoProveedor: assignmentForm.fechaPagoProveedor,
      fechaFactura: assignmentForm.fechaFactura,
      serieFactura: assignmentForm.serieFactura,
      numeroFactura: assignmentForm.numeroFactura,
      valorFactura: assignmentForm.valorFactura,
      fechaPagoFactura: assignmentForm.fechaPagoFactura,
    };

    try {
      await apiRequest(
        assignmentModal.mode === "create"
          ? "/operaciones/asignaciones"
          : `/operaciones/asignaciones/${assignmentForm.id}`,
        {
          method: assignmentModal.mode === "create" ? "POST" : "PUT",
          body: JSON.stringify(payload),
        }
      );

      setAssignmentModal({ open: false, mode: "create" });
      setNotice("Asignación guardada correctamente en MySQL.");
      await loadData();
      window.setTimeout(() => setNotice(""), 3000);
    } catch (error: any) {
      setApiError(error.message || "No se pudo guardar la asignación.");
    }
  };

  const openProvider = (mode: Mode, item?: AnyRow) => {
    setProviderErrors({});
    setProviderModal({ open: true, mode });

    if (item) {
      setProviderForm({
        ...item,
        razon_social: item.razon_social || item.name || "",
        nombre_comercial: item.nombre_comercial || item.name || "",
        service: item.service || item.servicio || "",
        estado_sat: item.estado_sat || (String(item.satStatus || "").toLowerCase().includes("solvente") ? "vigente" : "pendiente"),
        performance: item.performance || item.desempeno || "Amarillo",
        rtuValidated: bool(item.rtuValidated || item.rtu_validado),
        pilotLicenseValidated: bool(item.pilotLicenseValidated || item.licencia_validada),
        bankAccountValidated: bool(item.bankAccountValidated || item.cuenta_validada),
        clintonInvestigation: item.clintonInvestigation || "Aprobado",
        correo: providerEmail(item),
        telefono: providerPhone(item),
        contact: "",
        contacto: "",
      });
      return;
    }

    setProviderForm({
      codigo_proveedor: nextCode("PROV", proveedores, "codigo_proveedor"),
      razon_social: "",
      nombre_comercial: "",
      nit: "",
      estado_id: 1,
      correo: "",
      telefono: "",
      service: "Transporte FTL",
      estado_sat: "pendiente",
      performance: "Amarillo",
      rtuValidated: false,
      pilotLicenseValidated: false,
      bankAccountValidated: false,
      clintonInvestigation: "Aprobado",
    });
  };

  const openQuickClient = (term = "") => {
    setQuickClientErrors({});
    setQuickClientForm({
      codigo_cliente: nextCode("CLI", clientes, "codigo_cliente"),
      nombre_empresa: cleanCommercialTyping(term, 120),
      nit: "",
      direccion: "",
      estado_cliente_id: 1,
    });
    setQuickClientOpen(true);
  };

  const saveQuickClient = async () => {
    const errors: Record<string, string> = {};
    const nombre = String(quickClientForm.nombre_empresa || "").trim();
    const nit = String(quickClientForm.nit || "").trim();

    if (!nombre) errors.nombre_empresa = "El nombre de la empresa es obligatorio.";
    if (!nit) errors.nit = "El NIT es obligatorio.";
    if (clientes.some((item) => String(item.nit || "").trim().toLowerCase() === nit.toLowerCase())) {
      errors.nit = "Ya existe un cliente registrado con ese NIT.";
    }

    setQuickClientErrors(errors);
    if (Object.keys(errors).length) return;

    const payload = {
      codigo_cliente: quickClientForm.codigo_cliente,
      nombre_empresa: titleCaseCompany(nombre),
      nit,
      direccion: titleCaseCompany(String(quickClientForm.direccion || "")),
      estado_cliente_id: 1,
    };

    try {
      const created = await apiRequest<AnyRow>("/clientes", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      let createdId = Number(created?.id || created?.cliente_id || created?.insertId || 0) || null;

      if (!createdId) {
        const fresh = await apiRequest<AnyRow>("/crm/bootstrap");
        const found = rows<AnyRow>(fresh?.clientes).find(
          (item) => String(item.nit || "").trim().toLowerCase() === nit.toLowerCase()
        );
        createdId = Number(found?.id || 0) || null;
      }

      await loadData();

      if (createdId) {
        setAssignmentForm((current: AnyRow) => ({ ...current, cliente_id: createdId }));
        setAssignmentErrors((current) => ({ ...current, cliente_id: "" }));
      }

      setQuickClientOpen(false);
      setNotice("Cliente creado y seleccionado en la asignación.");
      window.setTimeout(() => setNotice(""), 3000);
    } catch (error: any) {
      setQuickClientErrors({ general: error.message || "No se pudo crear el cliente." });
    }
  };

  const openProviderFromAssignment = (term = "") => {
    setProviderReturnToAssignment(true);
    setProviderErrors({});
    setProviderModal({ open: true, mode: "create" });
    setProviderForm({
      codigo_proveedor: nextCode("PROV", proveedores, "codigo_proveedor"),
      razon_social: cleanCommercialTyping(term, 120),
      nombre_comercial: cleanCommercialTyping(term, 100),
      nit: "",
      estado_id: 1,
      correo: "",
      telefono: "",
      service: "Transporte FTL",
      estado_sat: "pendiente",
      performance: "Amarillo",
      rtuValidated: false,
      pilotLicenseValidated: false,
      bankAccountValidated: false,
      clintonInvestigation: "Aprobado",
    });
  };

  const validateProvider = () => {
    const errors: Record<string, string> = {};

    if (!String(providerForm.razon_social || "").trim()) errors.razon_social = "La razón social es obligatoria.";
    if (!String(providerForm.nit || "").trim()) errors.nit = "El NIT es obligatorio.";
    const correoLimpio = extractEmail(providerForm.correo);
    if (providerForm.correo && !correoLimpio) {
      errors.correo = "Correo no válido.";
    }

    setProviderErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveProvider = async () => {
    if (!validateProvider()) return;

    const payload = {
      ...providerForm,
      name: providerForm.nombre_comercial || providerForm.razon_social,
      correo: extractEmail(providerForm.correo),
      telefono: extractPhone(providerForm.telefono),
      contact: "",
      contacto: "",
      servicio: providerForm.service,
      estado_sat: providerForm.estado_sat,
      satStatus: providerForm.estado_sat === "vigente" ? "Solvente" : providerForm.estado_sat === "no_vigente" ? "Omiso" : "Pendiente",
      performance: providerForm.performance,
      desempeno: providerForm.performance,
    };

    try {
      const saved = await apiRequest<AnyRow>(
        providerModal.mode === "create"
          ? "/operaciones/proveedores"
          : `/operaciones/proveedores/${providerForm.id}`,
        {
          method: providerModal.mode === "create" ? "POST" : "PUT",
          body: JSON.stringify(payload),
        }
      );

      let createdProviderId =
        providerModal.mode === "create"
          ? Number(saved?.id || saved?.proveedor_id || saved?.insertId || 0) || null
          : Number(providerForm.id || 0) || null;

      if (providerModal.mode === "create" && providerReturnToAssignment && !createdProviderId) {
        const fresh = await apiRequest<AnyRow>("/operaciones/bootstrap");
        const found = rows<AnyRow>(fresh?.proveedores).find(
          (item) => String(item.nit || "").trim().toLowerCase() === String(payload.nit || "").trim().toLowerCase()
        );
        createdProviderId = Number(found?.id || 0) || null;
      }

      await loadData();

      if (providerReturnToAssignment && createdProviderId) {
        setAssignmentForm((current: AnyRow) => ({ ...current, proveedor_id: createdProviderId }));
        setAssignmentErrors((current) => ({ ...current, proveedor_id: "" }));
        setProviderModal({ open: false, mode: "create" });
        setProviderReturnToAssignment(false);
        setNotice("Proveedor creado y seleccionado en la asignación.");
        window.setTimeout(() => setNotice(""), 3000);
        return;
      }

      setProviderModal({ open: false, mode: "create" });
      setProviderReturnToAssignment(false);
      setTab("proveedores");
      setNotice("Proveedor guardado correctamente en MySQL.");
      window.setTimeout(() => setNotice(""), 3000);
    } catch (error: any) {
      setProviderErrors({ general: error.message || "No se pudo guardar el proveedor." });
    }
  };

  const deleteRecord = async () => {
    if (!deleteBox) return;

    try {
      if (deleteBox.type === "asignacion") {
        await apiRequest(`/operaciones/asignaciones/${deleteBox.id}`, { method: "DELETE" });
        if (expandedAssignment === deleteBox.id) setExpandedAssignment(null);
      } else {
        await apiRequest(`/operaciones/proveedores/${deleteBox.id}`, { method: "DELETE" });
      }

      setDeleteBox(null);
      setNotice("Registro eliminado o actualizado correctamente.");
      await loadData();
      window.setTimeout(() => setNotice(""), 3000);
    } catch (error: any) {
      setApiError(error.message || "No se pudo eliminar el registro.");
      setDeleteBox(null);
    }
  };

  const exportAssignmentsExcel = () => {
    const sheet = sortedAssignments.map((item) => ({
      Código: item.codigo_asignacion,
      Cliente: getCliente(item.cliente_id)?.nombre_empresa || item.cliente || item.nombre_empresa,
      Estado: estadoAsignacionNombre(item.estado_asignacion_id),
      Ruta: rutaLabel(getRuta(item.ruta_id)) || item.ruta,
      Piloto: fullPilot(getPiloto(item.pilotos_id || item.piloto_id)) || item.piloto,
      Vehículo: getVehiculo(item.vehiculo_id)?.codigo || item.cabezal,
      Proveedor: getProveedor(item.proveedor_id)?.razon_social || item.proveedor,
      "Total cliente": numeric(item.total),
      "Total proveedor": numeric(item.totalProveedor || item.total_proveedor),
      Margen: numeric(item.total) - numeric(item.totalProveedor || item.total_proveedor),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet), "Asignaciones");
    XLSX.writeFile(wb, `Operaciones_Asignaciones_${Date.now()}.xlsx`);
  };

  const exportProvidersExcel = () => {
    const sheet = sortedProviders.map((item) => ({
      Código: item.codigo_proveedor,
      Proveedor: item.razon_social || item.name,
      NIT: item.nit,
      Servicio: item.service || item.servicio,
      Contacto: [providerEmail(item), providerPhone(item)].filter(Boolean).join(" / "),
      SAT: item.estado_sat || item.satStatus,
      Desempeño: item.performance || item.desempeno,
      Estado: estadoProveedorNombre(item.estado_id),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet), "Proveedores");
    XLSX.writeFile(wb, `Operaciones_Proveedores_${Date.now()}.xlsx`);
  };

  const pdfAssignment = async (item: AnyRow) => {
    const doc = new jsPDF();
    await drawCorporatePdfHeader(
      doc,
      "Detalle de Asignación",
      `Operaciones y Compras · ${item.codigo_asignacion || "Asignación"}`
    );

    doc.setFontSize(10.5);
    let y = 50;
    const line = (label: string, value: string) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(12, 45, 107);
      doc.text(label, 18, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(25, 25, 25);
      doc.text(value || "-", 65, y, { maxWidth: 125 });
      y += 8;
    };

    line("Código:", item.codigo_asignacion || "-");
    line("Cliente:", getCliente(item.cliente_id)?.nombre_empresa || item.cliente || item.nombre_empresa || "-");
    line("Estado:", estadoAsignacionNombre(item.estado_asignacion_id));
    line("Ruta:", rutaLabel(getRuta(item.ruta_id)) || item.ruta || "-");
    line("Piloto:", fullPilot(getPiloto(item.pilotos_id || item.piloto_id)) || item.piloto || "-");
    line("Vehículo:", getVehiculo(item.vehiculo_id)?.codigo || item.cabezal || "-");
    line("Proveedor:", getProveedor(item.proveedor_id)?.razon_social || item.proveedor || "-");

    y += 3;
    doc.setDrawColor(225, 229, 235);
    doc.line(18, y, 192, y);
    y += 8;

    line("Total cliente:", money(item.total));
    line("Total proveedor:", money(item.totalProveedor || item.total_proveedor));
    line("Margen:", money(numeric(item.total) - numeric(item.totalProveedor || item.total_proveedor)));

    doc.save(`${item.codigo_asignacion || "asignacion"}.pdf`);
  };

  const pdfProvider = async (item: AnyRow) => {
    const doc = new jsPDF();
    await drawCorporatePdfHeader(
      doc,
      "Expediente de Proveedor",
      `Operaciones y Compras · ${item.codigo_proveedor || "Proveedor"}`
    );

    doc.setFontSize(10.5);
    let y = 50;
    const line = (label: string, value: string) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(12, 45, 107);
      doc.text(label, 18, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(25, 25, 25);
      doc.text(value || "-", 65, y, { maxWidth: 125 });
      y += 8;
    };

    line("Código:", item.codigo_proveedor || "-");
    line("Razón social:", item.razon_social || item.name || "-");
    line("Nombre comercial:", item.nombre_comercial || "-");
    line("NIT:", item.nit || "-");
    line("Correo:", providerEmail(item) || "-");
    line("Teléfono:", providerPhone(item) || "-");
    line("Servicio:", item.service || item.servicio || "-");
    line("SAT:", item.estado_sat === "vigente" ? "Vigente" : item.estado_sat === "no_vigente" ? "No vigente" : item.estado_sat || item.satStatus || "Pendiente");
    line("Desempeño:", item.performance || item.desempeno || "-");
    line("Estado:", estadoProveedorNombre(item.estado_id));

    doc.save(`${item.codigo_proveedor || "proveedor"}.pdf`);
  };

  return (
    <div className="space-y-4 w-full max-w-full overflow-hidden px-3 sm:px-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0C2D6B]">Operaciones y Compras</h1>
          <p className="text-gray-500 mt-1">Asignaciones, costos operativos y expediente de proveedores</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="h-10 px-4 rounded-xl bg-[#0C2D6B] text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Cargando..." : "Actualizar"}
        </button>
      </div>

      {apiError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">
          {apiError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {kpis.map(([title, value, Icon, color]: any, index) => (
          <div key={index} className="bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 relative overflow-hidden">
            <div
              className={`absolute bottom-0 left-0 h-1 w-full ${
                color === "blue"
                  ? "bg-[#0C2D6B]"
                  : color === "green"
                  ? "bg-[#22C55E]"
                  : color === "red"
                  ? "bg-red-500"
                  : "bg-[#FF6A00]"
              }`}
            />
            <div className="flex justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">{title}</p>
                <h3 className="text-lg sm:text-xl font-bold text-[#0C2D6B] mt-1">{value}</h3>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 text-[#0C2D6B]">
                <Icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <div className="flex border-b border-gray-200 gap-5 sm:gap-8 min-w-max">
        <button
          onClick={() => {
            setTab("asignaciones");
            resetFilters();
          }}
          className={`px-2 sm:px-4 pb-4 pt-2 text-base sm:text-lg font-bold relative transition-colors ${tab === "asignaciones" ? "text-[#0C2D6B]" : "text-gray-500 hover:text-[#0C2D6B]"}`}
        >
          Asignaciones de Unidades
          {tab === "asignaciones" && <div className="absolute left-0 bottom-0 h-1 w-full bg-[#FF6A00] rounded-t" />}
        </button>
        <button
          onClick={() => {
            setTab("proveedores");
            resetFilters();
          }}
          className={`px-2 sm:px-4 pb-4 pt-2 text-base sm:text-lg font-bold relative transition-colors ${tab === "proveedores" ? "text-[#0C2D6B]" : "text-gray-500 hover:text-[#0C2D6B]"}`}
        >
          Directorio de Proveedores
          {tab === "proveedores" && <div className="absolute left-0 bottom-0 h-1 w-full bg-[#FF6A00] rounded-t" />}
        </button>
        </div>
      </div>

      {tab === "asignaciones" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden max-w-full">
          <div className="p-4 border-b border-gray-100 flex flex-col xl:flex-row justify-between gap-3 bg-white">
            <div className="flex flex-wrap gap-3">
              <div className="relative w-full sm:w-[340px]">
                <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Código, cliente, piloto..."
                  className="w-full h-11 pl-12 pr-4 rounded-xl border border-gray-200 bg-white text-sm outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20"
                />
              </div>
              <div className="relative w-[190px] max-w-full">
                <Filter className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <select
                  value={estadoAsigFiltro}
                  onChange={(event) => setEstadoAsigFiltro(event.target.value)}
                  className="w-full h-11 pl-12 pr-8 rounded-xl border border-gray-200 bg-white text-sm outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20"
                >
                  <option value="Todos">Estados</option>
                  {estadosAsignacion.map((item) => (
                    <option key={item.id}>{item.nombre_estado_asignacion}</option>
                  ))}
                </select>
              </div>
              <select
                value={proveedorAsigFiltro}
                onChange={(event) => setProveedorAsigFiltro(event.target.value)}
                className="w-[230px] max-w-full h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20"
              >
                <option value="Todos">Todos los proveedores</option>
                {proveedores.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre_comercial || item.razon_social || item.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={resetFilters}
                className="h-11 px-4 rounded-xl border border-orange-200 bg-white text-sm font-bold text-[#FF6A00] shadow-sm inline-flex gap-1.5 items-center transition hover:border-[#FF6A00] hover:bg-orange-50"
              >
                <X className="w-4 h-4" /> Limpiar
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => openAssignment("create")}
                className="h-12 px-6 rounded-xl bg-[#0C2D6B] text-white font-bold text-base inline-flex items-center gap-2.5 shadow-sm hover:bg-[#143C8C] transition-colors"
              >
                <Plus className="w-5 h-5" /> Nueva Asignación
              </button>
              <button
                onClick={exportAssignmentsExcel}
                className="h-11 px-4 rounded-xl bg-[#22C55E] text-white font-bold text-sm inline-flex items-center gap-2 shadow-sm"
              >
                <Download className="w-4 h-4" /> Excel
              </button>
            </div>
          </div>

          <div className="px-4 py-3 text-sm font-bold text-gray-400">
            {sortedAssignments.length} de {asignaciones.length} registros visibles
          </div>

          <div className="overflow-x-auto max-w-full pr-1">
            <table className="w-full min-w-[1060px] table-fixed text-xs text-left">
              <thead className="bg-[#F3F4F6] text-[#0C2D6B]">
                <tr>
                  <SortableTh field="cliente" className="px-2.5 py-2.5 w-[170px]">Cliente / código</SortableTh>
                  <SortableTh field="estado" className="px-2.5 py-2.5 w-[90px]">Estado</SortableTh>
                  <SortableTh field="ruta" className="px-2.5 py-2.5 w-[195px]">Ruta</SortableTh>
                  <SortableTh field="piloto" className="px-2.5 py-2.5 w-[145px]">Piloto</SortableTh>
                  <SortableTh field="vehiculo" className="px-2.5 py-2.5 w-[105px]">Vehículo</SortableTh>
                  <SortableTh field="proveedor" className="px-2.5 py-2.5 w-[155px]">Proveedor</SortableTh>
                  <SortableTh field="margen" className="px-2.5 py-2.5 w-[120px]">Total / margen</SortableTh>
                  <th className="px-3 py-2.5 w-[145px] text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedAssignments.map((item) => {
                  const cliente = getCliente(item.cliente_id);
                  const ruta = getRuta(item.ruta_id);
                  const vehiculo = getVehiculo(item.vehiculo_id);
                  const piloto = getPiloto(item.pilotos_id || item.piloto_id);
                  const proveedor = getProveedor(item.proveedor_id);
                  const estado = estadoAsignacionNombre(item.estado_asignacion_id);
                  const totalProveedor = numeric(item.totalProveedor || item.total_proveedor);
                  const margen = numeric(item.total) - totalProveedor;

                  return (
                    <tbody key={item.id} className="contents">
                      <tr className="hover:bg-gray-50 align-top">
                        <td className="px-2.5 py-2.5 align-top">
                          <b className="text-[#0C2D6B] block leading-4 break-words">{cliente?.nombre_empresa || item.cliente || item.nombre_empresa}</b>
                          <p className="text-[11px] text-gray-400 mt-1 leading-4 break-words">{item.codigo_asignacion}</p>
                          <p className="text-[11px] text-gray-400 leading-4 break-words">{cliente?.codigo_cliente || item.codigo_cliente}</p>
                        </td>
                        <td className="px-2.5 py-2.5">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap ${stateClass(estado)}`}>{estado}</span>
                        </td>
                        <td className="px-2.5 py-2.5 leading-4 break-words">
                          {rutaLabel(ruta) || item.ruta}
                          <p className="text-[11px] text-gray-400 mt-1 leading-4">{ruta?.codigo_ruta || item.codigo_ruta} · {ruta?.distancia_km || item.distancia_km || item.km || 0} km</p>
                        </td>
                        <td className="px-2.5 py-2.5 leading-4 break-words">
                          {fullPilot(piloto) || item.piloto}
                          <p className="text-[11px] text-gray-400 mt-1 leading-4">{piloto?.codigo_piloto || item.codigo_piloto}</p>
                        </td>
                        <td className="px-2.5 py-2.5 leading-4">
                          <b>{vehiculo?.codigo || item.cabezal}</b>
                          <p className="text-[11px] text-gray-400 mt-1 leading-4">{item.tipo || item.nombre_tipo_vehiculo}</p>
                        </td>
                        <td className="px-2.5 py-2.5">
                          <b className={`${proveedor ? "text-[#0C2D6B]" : "text-red-600"} block leading-4 break-words`}>{proveedor?.nombre_comercial || proveedor?.razon_social || item.proveedor || "Sin proveedor"}</b>
                          <p className="text-[11px] text-gray-400 mt-1 leading-4">{proveedor?.codigo_proveedor || item.codigo_proveedor}</p>
                        </td>
                        <td className="px-2.5 py-2.5 whitespace-nowrap align-top">
                          <p className="font-bold text-green-600">{money(item.total)}</p>
                          <p className={`font-bold text-[11px] mt-1 ${margen >= 0 ? "text-[#0C2D6B]" : "text-red-600"}`}>Margen: {money(margen)}</p>
                        </td>
                        <td className="px-2.5 py-2.5">
                          <div className="flex gap-1 justify-center whitespace-nowrap">
                            <ActionButton icon={Download} label="PDF" tone="gray" onClick={() => pdfAssignment(item)} />
                            <ActionButton icon={Eye} label="Ver detalle" onClick={() => setExpandedAssignment(expandedAssignment === item.id ? null : item.id)} />
                            <ActionButton icon={Edit2} label="Editar" tone="orange" onClick={() => openAssignment("edit", item)} />
                            <ActionButton icon={Trash2} label="Eliminar" tone="red" onClick={() => setDeleteBox({ type: "asignacion", id: Number(item.id) })} />
                          </div>
                        </td>
                      </tr>

                      {expandedAssignment === item.id && (
                        <tr>
                          <td colSpan={8} className="bg-[#F8FAFC] px-3 py-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-2.5">
                              <DetailCard title="Viaje" rows={[
                                ["Código", item.codigo_asignacion],
                                ["Carga", date10(item.fecha_carga || item.carga)],
                                ["Descarga", date10(item.fecha_descarga || item.descarga)],
                                ["Estado", estado],
                              ]} />
                              <DetailCard title="Unidad" rows={[
                                ["Piloto", fullPilot(piloto) || item.piloto],
                                ["Licencia", item.licencia || piloto?.licencia],
                                ["Vehículo", vehiculo?.codigo || item.cabezal],
                                ["Furgón", item.furgon],
                                ["Vendedor", fullUser(getUsuario(item.vendedor_id)) || item.vendedor],
                              ]} />
                              <DetailCard title="Costos" rows={[
                                ["Flete", money(item.flete)],
                                ["Parada adicional", money(item.parada_adicional)],
                                ["Movimiento falso", money(item.movimiento_falso)],
                                ["Estadía", money(item.estadia)],
                                ["Otros", money(item.otros)],
                                ["Total cliente", money(item.total)],
                              ]} />
                              <DetailCard title="Proveedor" rows={[
                                ["Proveedor", proveedor?.razon_social || item.proveedor],
                                ["Factura", `${item.serieProveedor || ""} ${item.numeroProveedor || ""}`],
                                ["Fecha", date10(item.fechaProveedor)],
                                ["Total proveedor", money(totalProveedor)],
                                ["Pago", date10(item.fechaPagoProveedor) || "Pendiente"],
                              ]} />
                              <DetailCard title="Factura cliente" rows={[
                                ["Fecha", date10(item.fechaFactura)],
                                ["Serie / número", `${item.serieFactura || ""} ${item.numeroFactura || ""}`],
                                ["Valor", money(item.valorFactura)],
                                ["Pago", date10(item.fechaPagoFactura) || "Pendiente"],
                                ["Margen", money(margen)],
                              ]} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  );
                })}
                {!sortedAssignments.length && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-500">No se encontraron asignaciones.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <PaginationControls
            page={assignmentPage}
            totalPages={assignmentTotalPages}
            rowsPerPage={rowsPerPage}
            totalItems={sortedAssignments.length}
            itemLabel="asignaciones filtradas"
            onPageChange={setAssignmentPage}
            onRowsPerPageChange={setRowsPerPage}
          />
        </div>
      )}

      {tab === "proveedores" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-100 bg-white">
            <div className="flex flex-col 2xl:flex-row 2xl:items-center 2xl:justify-between gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_145px_155px_155px_auto] gap-3 2xl:flex-1 2xl:min-w-0">
                <div className="relative min-w-0">
                  <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Código, proveedor, NIT..."
                    className="w-full h-11 pl-12 pr-4 rounded-xl border border-gray-200 bg-white text-sm outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20"
                  />
                </div>

                <select value={estadoProvFiltro} onChange={(event) => setEstadoProvFiltro(event.target.value)} className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20">
                  <option value="Todos">Estado</option>
                  <option>Activo</option>
                  <option>Inactivo</option>
                </select>

                <select value={nivelFiltro} onChange={(event) => setNivelFiltro(event.target.value)} className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20">
                  <option value="Todos">Desempeño</option>
                  <option>Verde</option>
                  <option>Amarillo</option>
                  <option>Rojo</option>
                </select>

                <select value={satFiltro} onChange={(event) => setSatFiltro(event.target.value)} className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20">
                  <option value="Todos">Estado SAT</option>
                  <option value="vigente">Vigente</option>
                  <option value="no_vigente">No vigente</option>
                  <option value="pendiente">Pendiente</option>
                </select>

                <button onClick={resetFilters} className="h-11 px-4 rounded-xl border border-orange-200 bg-white text-sm font-bold text-[#FF6A00] inline-flex gap-1.5 items-center justify-center shadow-sm transition hover:border-[#FF6A00] hover:bg-orange-50 whitespace-nowrap">
                  <X className="w-4 h-4" /> Limpiar
                </button>
              </div>

              <div className="flex gap-2 sm:justify-end 2xl:shrink-0">
                <button onClick={() => openProvider("create")} className="h-12 px-6 rounded-xl bg-[#0C2D6B] text-white font-bold text-base inline-flex items-center justify-center gap-2.5 shadow-sm hover:bg-[#10357D] transition-colors whitespace-nowrap">
                  <Plus className="w-5 h-5" /> Nuevo Proveedor
                </button>
                <button onClick={exportProvidersExcel} className="h-11 px-5 rounded-xl bg-[#22C55E] text-white font-bold text-sm inline-flex items-center justify-center gap-2 shadow-sm hover:bg-[#1fb455] transition-colors whitespace-nowrap">
                  <Download className="w-4 h-4" /> Excel
                </button>
              </div>
            </div>
          </div>

          <div className="px-4 py-3 text-sm font-bold text-gray-400">
            {sortedProviders.length} de {proveedores.length} registros visibles
          </div>

          <div className="p-3 sm:p-4 overflow-x-auto max-w-full">
            <table className="w-full min-w-[1080px] table-fixed text-[13px] text-left rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-[#F6F8FC] text-[#0C2D6B] border border-gray-100">
                  <SortableTh field="codigo_proveedor" className="px-3 py-3.5 w-[9%] rounded-l-xl">Código</SortableTh>
                  <SortableTh field="proveedor" className="px-3 py-3.5 w-[22%]">Proveedor</SortableTh>
                  <SortableTh field="nit" className="px-3 py-3.5 w-[10%]">NIT</SortableTh>
                  <SortableTh field="servicio" className="px-3 py-3.5 w-[16%]">Servicio principal</SortableTh>
                  <SortableTh field="contacto" className="px-3 py-3.5 w-[17%]">Contacto</SortableTh>
                  <SortableTh field="desempeno" className="px-3 py-3.5 w-[9%]">Desempeño</SortableTh>
                  <SortableTh field="sat" className="px-3 py-3.5 w-[9%]">SAT</SortableTh>
                  <SortableTh field="estado" className="px-3 py-3.5 w-[8%]">Estado</SortableTh>
                  <th className="px-3 py-3.5 w-[14%] text-center rounded-r-xl">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedProviders.map((item, index) => {
                  const nivel = item.performance || item.desempeno || "Amarillo";
                  const sat = item.estado_sat || (String(item.satStatus || "").toLowerCase().includes("solvente") ? "vigente" : "pendiente");
                  const estado = estadoProveedorNombre(item.estado_id);

                  return (
                    <tr key={item.id} className={`align-top transition-colors ${index % 2 === 0 ? "bg-white" : "bg-[#FCFCFD]"} hover:bg-blue-50/40`}>
                      <td className="px-3 py-4 font-bold text-[#0C2D6B] whitespace-nowrap">{item.codigo_proveedor}</td>
                      <td className="px-3 py-4 leading-5">
                        <div className="font-semibold text-[#0C2D6B] break-words">{item.razon_social || item.name}</div>
                        <p className="text-[11px] text-gray-500 mt-1 break-words">{item.nombre_comercial}</p>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-[13px] text-gray-700">{item.nit}</td>
                      <td className="px-3 py-4 leading-4 break-words text-[13px] text-gray-700">{item.service || item.servicio || "Transporte"}</td>
                      <td className="px-3 py-4 leading-5">
                        <div className="break-words text-[13px] font-medium text-gray-800">
                          {providerEmail(item) || "Sin correo"}
                          {providerPhone(item) && <span className="block text-gray-500 mt-1">{providerPhone(item)}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold whitespace-nowrap">
                          <span className={`w-2.5 h-2.5 rounded-full ${nivel === "Verde" ? "bg-green-500" : nivel === "Amarillo" ? "bg-yellow-400" : "bg-red-500"}`} />
                          {nivel}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${satClass(sat)}`}>{sat === "vigente" ? "Vigente" : sat === "no_vigente" ? "No vigente" : "Pendiente"}</span>
                      </td>
                      <td className="px-3 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${estado === "Activo" ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-700"}`}>{estado}</span>
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                          <ActionButton icon={Download} label="PDF" tone="gray" onClick={() => pdfProvider(item)} />
                          <ActionButton icon={Eye} label="Ver" onClick={() => openProvider("view", item)} />
                          <ActionButton icon={Edit2} label="Editar" tone="orange" onClick={() => openProvider("edit", item)} />
                          <ActionButton icon={Trash2} label="Eliminar" tone="red" onClick={() => setDeleteBox({ type: "proveedor", id: Number(item.id) })} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!sortedProviders.length && (
                  <tr>
                    <td colSpan={9} className="p-10 text-center text-gray-500">No se encontraron proveedores.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <PaginationControls
            page={providerPage}
            totalPages={providerTotalPages}
            rowsPerPage={rowsPerPage}
            totalItems={sortedProviders.length}
            itemLabel="proveedores filtrados"
            onPageChange={setProviderPage}
            onRowsPerPageChange={setRowsPerPage}
          />
        </div>
      )}

      {assignmentModal.open && (
        <AssignmentDrawer
          mode={assignmentModal.mode}
          form={assignmentForm}
          setForm={setAssignmentForm}
          errors={assignmentErrors}
          onClose={() => setAssignmentModal({ open: false, mode: "create" })}
          onSave={saveAssignment}
          clientes={clientes}
          rutas={rutas}
          vehiculos={vehiculos}
          pilotos={pilotos}
          proveedores={proveedores}
          usuarios={usuarios}
          estadosAsignacion={estadosAsignacion}
          rutaLabel={rutaLabel}
          patchMoney={patchAssignmentMoney}
          onCreateClient={openQuickClient}
          onCreateProvider={openProviderFromAssignment}
        />
      )}

      {quickClientOpen && (
        <QuickClientModal
          form={quickClientForm}
          setForm={setQuickClientForm}
          errors={quickClientErrors}
          onClose={() => setQuickClientOpen(false)}
          onSave={saveQuickClient}
        />
      )}

      {providerModal.open && (
        <ProviderDrawer
          mode={providerModal.mode}
          form={providerForm}
          setForm={setProviderForm}
          errors={providerErrors}
          onClose={() => {
            setProviderModal({ open: false, mode: "create" });
            setProviderReturnToAssignment(false);
          }}
          onSave={saveProvider}
          estadosProveedor={estadosProveedor}
        />
      )}

      {deleteBox && (
        <div className="fixed inset-0 z-[100] bg-black/55 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold">¿Eliminar registro?</h3>
              <p className="text-sm text-gray-500 mt-2">Esta acción actualizará la base de datos MySQL.</p>
            </div>
            <div className="p-5 border-t bg-gray-50 flex gap-3">
              <button onClick={() => setDeleteBox(null)} className="flex-1 h-11 rounded-lg border font-bold text-gray-600">Cancelar</button>
              <button onClick={deleteRecord} className="flex-1 h-11 rounded-lg bg-red-600 text-white font-bold">Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div className="fixed z-[120] right-5 bottom-5 max-w-sm bg-green-50 border border-green-200 text-green-800 rounded-xl shadow-xl px-3 py-3 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold">Cambios guardados</p>
            <p className="text-xs mt-0.5">{notice}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailCard({ title, rows }: { title: string; rows: Array<[string, any]> }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm min-w-0">
      <h4 className="font-bold text-[#0C2D6B] mb-2 text-sm">{title}</h4>
      <div className="grid grid-cols-1 gap-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <p className="text-[11px] text-gray-500 leading-4">{label}</p>
            <p className="font-semibold text-xs leading-4 break-words whitespace-normal">{value || "-"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}


function SearchableSelect({
  value,
  options,
  getLabel,
  getSubLabel,
  onSelect,
  placeholder,
  disabled,
  error,
  onCreate,
  createLabel = "Crear nuevo",
}: {
  value?: string | number | null;
  options: AnyRow[];
  getLabel: (item: AnyRow) => string;
  getSubLabel?: (item: AnyRow) => string;
  onSelect: (item: AnyRow) => void;
  placeholder: string;
  disabled?: boolean;
  error?: string;
  onCreate?: (query: string) => void;
  createLabel?: string;
}) {
  const selected = options.find((item) => Number(item.id) === Number(value));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();

    return options
      .filter((item) => {
        const text = `${getLabel(item)} ${getSubLabel?.(item) || ""}`.toLowerCase();
        return !term || text.includes(term);
      })
      .slice(0, 40);
  }, [query, options, getLabel, getSubLabel]);

  const shownValue = open ? query : selected ? getLabel(selected) : "";

  return (
    <div className="relative">
      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-[17px] z-10" />
      <input
        disabled={disabled}
        value={shownValue}
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
              return;
            }

            if (onCreate && query.trim()) {
              onCreate(query.trim());
              setOpen(false);
              setQuery("");
            }
          }

          if (event.key === "Escape") {
            setOpen(false);
            setQuery("");
          }
        }}
        placeholder={placeholder}
        className={`${input} mt-1 pl-9 ${error ? errorInput : ""}`}
      />

      {open && !disabled && (
        <div className="absolute z-[120] mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
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
              {getSubLabel && (
                <span className="block text-[11px] text-gray-400 mt-0.5">{getSubLabel(item)}</span>
              )}
            </button>
          ))}

          {!filtered.length && (
            <div className="px-3 py-3 text-sm text-gray-500">
              No se encontró coincidencia.
            </div>
          )}

          {onCreate && query.trim() && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onCreate(query.trim());
                setOpen(false);
                setQuery("");
              }}
              className="w-full text-left px-3 py-3 border-t bg-orange-50 text-[#C85100] text-sm font-bold hover:bg-orange-100"
            >
              + {createLabel}: “{query.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function QuickClientModal({ form, setForm, errors, onClose, onSave }: AnyRow) {
  return (
    <div className="fixed inset-0 z-[120] bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-[#0C2D6B] px-6 py-4 text-white">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-white/70">Alta rápida desde Operaciones</p>
            <h2 className="text-xl font-bold">Nuevo Cliente</h2>
          </div>
          <button type="button" onClick={onClose} className="text-white/70 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 p-6">
          {errors.general && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{errors.general}</div>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Código">
              <input readOnly value={form.codigo_cliente || ""} className={`${input} mt-1 bg-gray-100`} />
            </Field>
            <Field label="NIT *">
              <input
                autoFocus
                value={form.nit || ""}
                onChange={(event) => setForm({ ...form, nit: event.target.value.replace(/[^0-9A-Za-zKk-]/g, "").slice(0, 20) })}
                className={`${input} mt-1 ${errors.nit ? errorInput : ""}`}
                placeholder="5487963-2"
              />
              <ErrorText text={errors.nit} />
            </Field>
            <Field label="Nombre de empresa / razón social *" className="sm:col-span-2">
              <input
                value={form.nombre_empresa || ""}
                onChange={(event) => setForm({ ...form, nombre_empresa: cleanCommercialTyping(event.target.value, 120) })}
                onBlur={() => setForm({ ...form, nombre_empresa: titleCaseCompany(form.nombre_empresa || "") })}
                className={`${input} mt-1 ${errors.nombre_empresa ? errorInput : ""}`}
                placeholder="Distribuidora Maya del Norte, S.A."
              />
              <ErrorText text={errors.nombre_empresa} />
            </Field>
            <Field label="Dirección" className="sm:col-span-2">
              <input
                value={form.direccion || ""}
                onChange={(event) => setForm({ ...form, direccion: cleanCommercialTyping(event.target.value, 180) })}
                onBlur={() => setForm({ ...form, direccion: titleCaseCompany(form.direccion || "") })}
                className={`${input} mt-1`}
                placeholder="5a Avenida 3-42 Zona 1, Cobán"
              />
            </Field>
          </div>
          <p className="text-xs text-gray-500">Al guardar, el cliente se seleccionará automáticamente en la asignación que estás creando.</p>
        </div>

        <div className="flex justify-end gap-2 border-t bg-gray-50 px-6 py-4">
          <button type="button" onClick={onClose} className="h-11 rounded-xl border border-gray-200 bg-white px-5 font-bold text-gray-600">Cancelar</button>
          <button type="button" onClick={onSave} className="h-11 rounded-xl bg-[#FF6A00] px-6 font-bold text-white shadow-sm">Guardar cliente</button>
        </div>
      </div>
    </div>
  );
}

function AssignmentDrawer({
  mode,
  form,
  setForm,
  errors,
  onClose,
  onSave,
  clientes,
  rutas,
  vehiculos,
  pilotos,
  proveedores,
  usuarios,
  estadosAsignacion,
  rutaLabel,
  patchMoney,
  onCreateClient,
  onCreateProvider,
}: AnyRow) {
  const readonly = mode === "view";
  const [creatingRoute, setCreatingRoute] = useState(Boolean(form.nueva_ruta));
  const selectedRoute = rutas.find((item: AnyRow) => Number(item.id) === Number(form.ruta_id));
  const selectedPilot = pilotos.find((item: AnyRow) => Number(item.id) === Number(form.pilotos_id || form.piloto_id));

  return (
    <div className="fixed inset-0 z-[80] bg-black/55 flex justify-end">
      <div className="w-full max-w-3xl h-full bg-white shadow-2xl flex flex-col">
        <div className="p-4 bg-[#0C2D6B] text-white flex justify-between items-center">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-white/70">Asignaciones / operación / costos</p>
            <h2 className="text-xl font-bold">{mode === "create" ? "Nueva Asignación" : mode === "edit" ? `Editar ${form.codigo_asignacion}` : `Detalle ${form.codigo_asignacion}`}</h2>
          </div>
          <button onClick={onClose}><X className="w-6 h-6" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-[#F6F7F9] space-y-4">
          {Object.keys(errors).length > 0 && mode !== "view" && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
              <b>Revisa la asignación:</b>
              <ul className="list-disc ml-5 mt-1">{Object.values(errors).map((item: any, index) => <li key={index}>{item}</li>)}</ul>
            </div>
          )}

          <section className="bg-white rounded-xl border p-4">
            <div className="flex justify-between border-b pb-3 mb-4"><h3 className="font-bold text-[#0C2D6B]">Datos de la asignación</h3><span className="text-xs bg-blue-50 text-[#0C2D6B] px-3 py-1 rounded-full font-bold">asignacion</span></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Código"><input readOnly value={form.codigo_asignacion || ""} className={`${input} bg-gray-100 mt-1`} /></Field>
              <Field label="Cliente *" className="md:col-span-2">
                <SearchableSelect
                  disabled={readonly}
                  value={form.cliente_id || ""}
                  options={clientes.filter((item: AnyRow) => Number(item.estado_cliente_id || 1) === 1)}
                  placeholder="Buscar cliente por código, empresa o NIT..."
                  error={errors.cliente_id}
                  getLabel={(item: AnyRow) => `${item.codigo_cliente || "CLI"} · ${item.nombre_empresa || "Cliente"}`}
                  getSubLabel={(item: AnyRow) => `NIT: ${item.nit || "Sin NIT"}`}
                  onSelect={(item: AnyRow) =>
                    setForm({ ...form, cliente_id: item.id })
                  }
                  onCreate={(term: string) => onCreateClient(term)}
                  createLabel="Registrar cliente"
                />
                <ErrorText text={errors.cliente_id} />
              </Field>
              <Field label="Estado *">
                <select disabled={readonly} value={form.estado_asignacion_id || ""} onChange={(event) => setForm({ ...form, estado_asignacion_id: event.target.value })} className={`${input} mt-1`}>
                  {estadosAsignacion.map((item: AnyRow) => <option key={item.id} value={item.id}>{item.nombre_estado_asignacion}</option>)}
                </select>
              </Field>
              <Field label="Fecha carga *"><input type="date" disabled={readonly} value={form.fecha_carga || ""} onChange={(event) => setForm({ ...form, fecha_carga: event.target.value })} className={`${input} mt-1 ${errors.fecha_carga ? errorInput : ""}`} /><ErrorText text={errors.fecha_carga} /></Field>
              <Field label="Fecha descarga *"><input type="date" disabled={readonly} value={form.fecha_descarga || ""} onChange={(event) => setForm({ ...form, fecha_descarga: event.target.value })} className={`${input} mt-1 ${errors.fecha_descarga ? errorInput : ""}`} /><ErrorText text={errors.fecha_descarga} /></Field>
              <Field label="Ruta *" className="lg:col-span-3">
                <SearchableSelect
                  disabled={readonly}
                  value={form.ruta_id || ""}
                  options={rutas}
                  placeholder="Buscar ruta por código, origen o destino..."
                  error={errors.ruta_id}
                  getLabel={(item: AnyRow) => `${item.codigo_ruta || item.codigo || "RUT"} · ${rutaLabel(item)}`}
                  getSubLabel={(item: AnyRow) => `${item.distancia_km || item.km || 0} km`}
                  onSelect={(item: AnyRow) => {
                    setCreatingRoute(false);
                    setForm({
                      ...form,
                      ruta_id: item.id,
                      nueva_ruta: false,
                      origen: "",
                      destino: "",
                      km: numeric(item.distancia_km || item.km),
                    });
                  }}
                  onCreate={(term: string) => {
                    setCreatingRoute(true);
                    const [origenRaw, destinoRaw] = term.split(/→|->|-/).map((x) => x.trim());
                    setForm({
                      ...form,
                      ruta_id: "",
                      nueva_ruta: true,
                      origen: origenRaw || term,
                      destino: destinoRaw || "",
                      km: "",
                    });
                  }}
                  createLabel="Crear ruta"
                />
                <ErrorText text={errors.ruta_id} />

                {selectedRoute && !creatingRoute && (
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
                      <b className="text-[#0C2D6B]">Ruta:</b> {selectedRoute.codigo_ruta || selectedRoute.codigo}
                    </div>
                    <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 sm:col-span-2">
                      <b className="text-[#0C2D6B]">Kilómetros:</b> {selectedRoute.distancia_km || selectedRoute.km || 0} km
                    </div>
                  </div>
                )}

                {creatingRoute && !readonly && (
                  <div className="mt-3 rounded-xl border border-orange-100 bg-orange-50 p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-sm font-bold text-[#C85100]">Crear ruta nueva para esta asignación</p>
                      <button
                        type="button"
                        onClick={() => {
                          setCreatingRoute(false);
                          setForm({ ...form, nueva_ruta: false, origen: "", destino: "", km: "" });
                        }}
                        className="text-xs font-bold text-gray-500 hover:text-red-600"
                      >
                        Cancelar
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-bold text-gray-600">Origen</label>
                        <input
                          value={form.origen || ""}
                          onChange={(event) => setForm({ ...form, origen: cleanCommercialTyping(event.target.value, 100) })}
                          onBlur={() => setForm({ ...form, origen: titleCaseCompany(form.origen || "") })}
                          className={`${input} mt-1`}
                          placeholder="Ej. Ciudad de Guatemala"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-600">Destino</label>
                        <input
                          value={form.destino || ""}
                          onChange={(event) => setForm({ ...form, destino: cleanCommercialTyping(event.target.value, 100) })}
                          onBlur={() => setForm({ ...form, destino: titleCaseCompany(form.destino || "") })}
                          className={`${input} mt-1`}
                          placeholder="Ej. San Salvador"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-600">Km</label>
                        <input
                          inputMode="decimal"
                          value={form.km || ""}
                          onChange={(event) => setForm({ ...form, km: numeric(cleanNum(event.target.value)) })}
                          className={`${input} mt-1`}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-2">
                      Al guardar la asignación, el backend creará la ubicación/ruta si no existe.
                    </p>
                  </div>
                )}
              </Field>
            </div>
          </section>

          <section className="bg-white rounded-xl border p-4">
            <div className="flex justify-between border-b pb-3 mb-4"><h3 className="font-bold text-[#0C2D6B]">Unidad, piloto y responsables</h3><span className="text-xs bg-blue-50 text-[#0C2D6B] px-3 py-1 rounded-full font-bold">unidad_operacion</span></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Piloto *">
                <SearchableSelect
                  disabled={readonly}
                  value={form.pilotos_id || form.piloto_id || ""}
                  options={pilotos}
                  placeholder="Buscar piloto por nombre o licencia..."
                  error={errors.pilotos_id}
                  getLabel={(item: AnyRow) => `${item.codigo_piloto || "PIL"} · ${fullPilot(item)}`}
                  getSubLabel={(item: AnyRow) => `Licencia: ${item.licencia || "Sin licencia"}`}
                  onSelect={(item: AnyRow) =>
                    setForm({
                      ...form,
                      pilotos_id: item.id,
                      piloto_id: item.id,
                      licencia: item.licencia || "",
                    })
                  }
                />
                <ErrorText text={errors.pilotos_id} />
              </Field>
              <Field label="Licencia del piloto">
                <input
                  readOnly
                  value={form.licencia || selectedPilot?.licencia || ""}
                  className={`${input} bg-gray-100 mt-1`}
                  placeholder="Se llena al seleccionar piloto"
                />
              </Field>
              <Field label="Vehículo *"><select disabled={readonly} value={form.vehiculo_id || ""} onChange={(event) => setForm({ ...form, vehiculo_id: event.target.value })} className={`${input} mt-1 ${errors.vehiculo_id ? errorInput : ""}`}><option value="">Seleccionar vehículo...</option>{vehiculos.map((item: AnyRow) => <option key={item.id} value={item.id}>{item.codigo || item.placa} · {item.tipo || item.nombre_tipo_vehiculo || "Vehículo"}</option>)}</select><ErrorText text={errors.vehiculo_id} /></Field>
              <Field label="Furgón / remolque"><input disabled={readonly} value={form.furgon || ""} onChange={(event) => setForm({ ...form, furgon: event.target.value.toUpperCase() })} className={`${input} mt-1`} /></Field>
              <Field label="Documentos"><select disabled={readonly} value={form.doc || "Pendiente"} onChange={(event) => setForm({ ...form, doc: event.target.value })} className={`${input} mt-1`}><option>Pendiente</option><option>En revisión</option><option>Completo</option></select></Field>
              <Field label="Vendedor responsable"><select disabled={readonly} value={form.vendedor_id || ""} onChange={(event) => setForm({ ...form, vendedor_id: event.target.value })} className={`${input} mt-1`}><option value="">Seleccionar usuario...</option>{usuarios.map((item: AnyRow) => <option key={item.id} value={item.id}>{fullUser(item)}</option>)}</select></Field>
              <Field label="Kilómetros de la ruta">
                <input
                  disabled={readonly}
                  readOnly={!creatingRoute}
                  value={form.km || ""}
                  onChange={(event) => setForm({ ...form, km: numeric(cleanNum(event.target.value)) })}
                  className={`${input} mt-1 ${!creatingRoute ? "bg-gray-100" : ""}`}
                  placeholder="Se llena al seleccionar ruta"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  {creatingRoute ? "Ingrese los kilómetros de la ruta nueva." : "Dato automático según la ruta seleccionada."}
                </p>
              </Field>
            </div>
          </section>

          <section className="bg-white rounded-xl border p-4">
            <div className="flex justify-between border-b pb-3 mb-4"><h3 className="font-bold text-[#0C2D6B]">Costos al cliente</h3><span className="text-xs bg-blue-50 text-[#0C2D6B] px-3 py-1 rounded-full font-bold">costo_asignacion</span></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[ ["flete", "Flete *"], ["parada_adicional", "Parada adicional"], ["movimiento_falso", "Movimiento falso"], ["estadia", "Estadía"], ["viaje_doble", "Viaje doble"], ["otros", "Otros"] ].map(([field, label]) => (
                <Field key={field} label={label}><input disabled={readonly} value={form[field] || ""} onChange={(event) => patchMoney(field, event.target.value)} className={`${input} mt-1 ${field === "flete" && errors.flete ? errorInput : ""}`} /><ErrorText text={field === "flete" ? errors.flete : ""} /></Field>
              ))}
            </div>
            <div className="mt-4 bg-green-50 border border-green-100 rounded-xl p-4 flex justify-between"><b className="text-[#0C2D6B]">TOTAL CLIENTE</b><b className="text-green-600 text-xl">{money(form.total)}</b></div>
          </section>

          <section className="bg-white rounded-xl border p-4">
            <div className="flex justify-between border-b pb-3 mb-4"><h3 className="font-bold text-[#0C2D6B]">Proveedor asignado y pago</h3><span className="text-xs bg-blue-50 text-[#0C2D6B] px-3 py-1 rounded-full font-bold">proveedor_asignacion</span></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Proveedor *" className="lg:col-span-3">
                <SearchableSelect
                  disabled={readonly}
                  value={form.proveedor_id || ""}
                  options={proveedores}
                  placeholder="Buscar proveedor por código, nombre o NIT..."
                  error={errors.proveedor_id}
                  getLabel={(item: AnyRow) => `${item.codigo_proveedor || "PROV"} · ${item.nombre_comercial || item.razon_social || item.name || "Proveedor"}`}
                  getSubLabel={(item: AnyRow) => `NIT: ${item.nit || "-"} · ${item.performance || item.desempeno || "Amarillo"}`}
                  onSelect={(item: AnyRow) => setForm({ ...form, proveedor_id: item.id })}
                  onCreate={(term: string) => onCreateProvider(term)}
                  createLabel="Registrar proveedor"
                />
                <ErrorText text={errors.proveedor_id} />
              </Field>
              <Field label="Fecha factura proveedor"><input type="date" disabled={readonly} value={form.fechaProveedor || ""} onChange={(event) => setForm({ ...form, fechaProveedor: event.target.value })} className={`${input} mt-1`} /></Field>
              <Field label="Serie"><input disabled={readonly} value={form.serieProveedor || ""} onChange={(event) => setForm({ ...form, serieProveedor: event.target.value.toUpperCase() })} className={`${input} mt-1`} /></Field>
              <Field label="Número"><input disabled={readonly} value={form.numeroProveedor || ""} onChange={(event) => setForm({ ...form, numeroProveedor: event.target.value })} className={`${input} mt-1`} /></Field>
              {[ ["fleteProveedor", "Flete proveedor"], ["cuadrilla", "Cuadrilla"], ["estadiaProveedor", "Estadía proveedor"] ].map(([field, label]) => <Field key={field} label={label}><input disabled={readonly} value={form[field] || ""} onChange={(event) => patchMoney(field, event.target.value)} className={`${input} mt-1`} /></Field>)}
              <Field label="Fecha pago proveedor"><input type="date" disabled={readonly} value={form.fechaPagoProveedor || ""} onChange={(event) => setForm({ ...form, fechaPagoProveedor: event.target.value })} className={`${input} mt-1`} /></Field>
            </div>
            <ErrorText text={errors.margen} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              <div className="bg-red-50 border border-red-100 rounded-xl p-3"><p className="text-xs text-gray-500">Total proveedor</p><b className="text-red-600 text-lg">{money(form.totalProveedor)}</b></div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3"><p className="text-xs text-gray-500">Margen</p><b className={`${numeric(form.total) - numeric(form.totalProveedor) >= 0 ? "text-[#0C2D6B]" : "text-red-600"} text-lg`}>{money(numeric(form.total) - numeric(form.totalProveedor))}</b></div>
              <div className="bg-gray-50 border rounded-xl p-3"><p className="text-xs text-gray-500">Estado pago</p><b className={form.fechaPagoProveedor ? "text-green-600" : "text-orange-600"}>{form.fechaPagoProveedor ? "Pagado" : "Pendiente"}</b></div>
            </div>
          </section>

          <section className="bg-white rounded-xl border p-4">
            <div className="flex justify-between border-b pb-3 mb-4"><h3 className="font-bold text-[#0C2D6B]">Factura al cliente</h3><span className="text-xs bg-blue-50 text-[#0C2D6B] px-3 py-1 rounded-full font-bold">factura_asignacion</span></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Fecha factura"><input type="date" disabled={readonly} value={form.fechaFactura || ""} onChange={(event) => setForm({ ...form, fechaFactura: event.target.value })} className={`${input} mt-1`} /></Field>
              <Field label="Serie"><input disabled={readonly} value={form.serieFactura || ""} onChange={(event) => setForm({ ...form, serieFactura: event.target.value.toUpperCase() })} className={`${input} mt-1`} /></Field>
              <Field label="Número"><input disabled={readonly} value={form.numeroFactura || ""} onChange={(event) => setForm({ ...form, numeroFactura: event.target.value })} className={`${input} mt-1`} /></Field>
              <Field label="Valor factura"><input disabled={readonly} value={form.valorFactura || ""} onChange={(event) => setForm({ ...form, valorFactura: numeric(cleanNum(event.target.value)) })} className={`${input} mt-1`} /></Field>
              <Field label="Fecha pago cliente"><input type="date" disabled={readonly} value={form.fechaPagoFactura || ""} onChange={(event) => setForm({ ...form, fechaPagoFactura: event.target.value })} className={`${input} mt-1`} /></Field>
            </div>
          </section>
        </div>

        <div className="p-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="h-11 px-6 rounded-lg font-bold text-gray-600 hover:bg-gray-100">{mode === "view" ? "Cerrar" : "Cancelar"}</button>
          {mode !== "view" && <button onClick={onSave} className="h-11 px-7 rounded-lg bg-[#FF6A00] text-white font-bold inline-flex items-center gap-2"><Save className="w-4 h-4" /> Guardar Asignación</button>}
        </div>
      </div>
    </div>
  );
}

function ProviderDrawer({ mode, form, setForm, errors, onClose, onSave, estadosProveedor }: AnyRow) {
  const readonly = mode === "view";

  return (
    <div className="fixed inset-0 z-[80] bg-black/55 flex justify-end">
      <div className="w-full max-w-3xl h-full bg-white shadow-2xl flex flex-col">
        <div className="p-4 bg-[#0C2D6B] text-white flex justify-between items-center">
          <div><p className="text-[11px] uppercase tracking-widest text-white/70">Expediente de proveedor</p><h2 className="text-xl font-bold">{mode === "create" ? "Nuevo Proveedor" : mode === "edit" ? `Editar ${form.codigo_proveedor}` : `Detalle ${form.codigo_proveedor}`}</h2></div>
          <button onClick={onClose}><X className="w-6 h-6" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 bg-[#F6F7F9] space-y-4">
          {Object.keys(errors).length > 0 && mode !== "view" && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm"><b>Revisa el expediente:</b><ul className="list-disc ml-5 mt-1">{Object.values(errors).map((item: any, index) => <li key={index}>{item}</li>)}</ul></div>
          )}
          <section className="bg-white rounded-xl border p-4">
            <div className="flex justify-between border-b pb-3 mb-4"><h3 className="font-bold text-[#0C2D6B]">Datos generales</h3><span className="text-xs bg-blue-50 text-[#0C2D6B] px-3 py-1 rounded-full font-bold">proveedor</span></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Código"><input readOnly value={form.codigo_proveedor || ""} className={`${input} mt-1 bg-gray-100`} /></Field>
              <Field label="Estado"><select disabled={readonly} value={form.estado_id || 1} onChange={(event) => setForm({ ...form, estado_id: event.target.value })} className={`${input} mt-1`}>{estadosProveedor.map((item: AnyRow) => <option key={item.id} value={item.id}>{item.nombre_estado_proveedor}</option>)}</select></Field>
              <Field label="Razón social *" className="md:col-span-2"><input disabled={readonly} value={form.razon_social || ""} onChange={(event) => setForm({ ...form, razon_social: cleanCommercialTyping(event.target.value, 120) })} onBlur={() => setForm({ ...form, razon_social: titleCaseCompany(form.razon_social || "") })} className={`${input} mt-1 ${errors.razon_social ? errorInput : ""}`} /><ErrorText text={errors.razon_social} /></Field>
              <Field label="Nombre comercial"><input disabled={readonly} value={form.nombre_comercial || ""} onChange={(event) => setForm({ ...form, nombre_comercial: cleanCommercialTyping(event.target.value, 100) })} onBlur={() => setForm({ ...form, nombre_comercial: titleCaseCompany(form.nombre_comercial || "") })} className={`${input} mt-1`} /></Field>
              <Field label="NIT *"><input disabled={readonly} value={form.nit || ""} onChange={(event) => setForm({ ...form, nit: event.target.value.replace(/[^0-9A-Za-zKk-]/g, "").slice(0, 20) })} className={`${input} mt-1 ${errors.nit ? errorInput : ""}`} /><ErrorText text={errors.nit} /></Field>
              <Field label="Correo">
                <input
                  disabled={readonly}
                  value={form.correo || ""}
                  onChange={(event) => setForm({ ...form, correo: event.target.value.replace(/\s/g, "").toLowerCase() })}
                  onBlur={() => setForm({ ...form, correo: extractEmail(form.correo) })}
                  placeholder="correo@empresa.com"
                  className={`${input} mt-1 ${errors.correo ? errorInput : ""}`}
                />
                <ErrorText text={errors.correo} />
              </Field>
              <Field label="Teléfono">
                <input
                  disabled={readonly}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={15}
                  value={form.telefono || ""}
                  onChange={(event) => setForm({ ...form, telefono: extractPhone(event.target.value) || event.target.value.replace(/\D/g, "").slice(0, 15) })}
                  placeholder="Solo números"
                  className={`${input} mt-1`}
                />
              </Field>
            </div>
          </section>
          <section className="bg-white rounded-xl border p-4">
            <div className="flex justify-between border-b pb-3 mb-4"><h3 className="font-bold text-[#0C2D6B]">Servicio y cumplimiento</h3><span className="text-xs bg-blue-50 text-[#0C2D6B] px-3 py-1 rounded-full font-bold">cumplimiento_proveedor</span></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Servicio principal"><input disabled={readonly} value={form.service || ""} onChange={(event) => setForm({ ...form, service: cleanCommercialTyping(event.target.value, 100) })} onBlur={() => setForm({ ...form, service: titleCaseCompany(form.service || "") })} className={`${input} mt-1`} /></Field>
              <Field label="Estado SAT"><select disabled={readonly} value={form.estado_sat || "pendiente"} onChange={(event) => setForm({ ...form, estado_sat: event.target.value })} className={`${input} mt-1`}><option value="vigente">Vigente</option><option value="no_vigente">No vigente</option><option value="pendiente">Pendiente</option></select></Field>
              <Field label="Desempeño"><select disabled={readonly} value={form.performance || "Amarillo"} onChange={(event) => setForm({ ...form, performance: event.target.value })} className={`${input} mt-1`}><option>Verde</option><option>Amarillo</option><option>Rojo</option></select></Field>
              <div className="grid grid-cols-2 gap-2 pt-6">
                {[ ["rtuValidated", "RTU"], ["pilotLicenseValidated", "Licencias"], ["bankAccountValidated", "Cuenta"], ["clintonInvestigation", "Lista Clinton"] ].map(([field, label]) => (
                  <label key={field} className="rounded-lg border bg-gray-50 px-3 py-2 text-xs font-bold flex items-center gap-2">
                    <input type="checkbox" disabled={readonly} checked={field === "clintonInvestigation" ? form.clintonInvestigation !== "Rechazado" : bool(form[field])} onChange={(event) => setForm({ ...form, [field]: field === "clintonInvestigation" ? (event.target.checked ? "Aprobado" : "Rechazado") : event.target.checked })} /> {label}
                  </label>
                ))}
              </div>
              <Field label="Historial" className="md:col-span-1"><textarea disabled={readonly} value={form.history || form.historial || ""} onChange={(event) => setForm({ ...form, history: event.target.value })} className="w-full min-h-[100px] mt-1 rounded-lg border p-3 text-sm disabled:bg-gray-100" /></Field>
              <Field label="Hallazgos" className="md:col-span-1"><textarea disabled={readonly} value={form.findings || form.hallazgos || ""} onChange={(event) => setForm({ ...form, findings: event.target.value })} className="w-full min-h-[100px] mt-1 rounded-lg border p-3 text-sm disabled:bg-gray-100" /></Field>
            </div>
          </section>
        </div>
        <div className="p-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="h-11 px-6 rounded-lg font-bold text-gray-600 hover:bg-gray-100">{mode === "view" ? "Cerrar" : "Cancelar"}</button>
          {mode !== "view" && <button onClick={onSave} className="h-11 px-7 rounded-lg bg-[#FF6A00] text-white font-bold inline-flex items-center gap-2"><Save className="w-4 h-4" /> Guardar Expediente</button>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><label className="text-xs font-bold text-gray-600">{label}</label>{children}</div>;
}