import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  Building2,
  CheckCircle2,
  ChevronRight,
  Database,
  Eye,
  Filter,
  FileText,
  KeyRound,
  Layers3,
  Link2,
  Loader2,
  LockKeyhole,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Shield,
  Table2,
  Trash2,
  Truck,
  Users,
  UserCheck,
  UserX,
  Wrench,
  X,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useAuth } from "../context/AuthContext";

/* ============================================================
   GL365 · MANTENIMIENTO DEL SISTEMA
   ------------------------------------------------------------
   Versión conectada a MySQL
   - Carga todas las tablas reales de la base de datos.
   - Muestra los registros insertados en MySQL.
   - Permite Nuevo, Ver, Editar y Eliminar.
   - FK como desplegables.
   - Validaciones: letras, números, teléfonos, correos y requeridos.
   - Enter avanza al siguiente campo.
   - Diseño tipo Figma GL365.
   - Filtros por campo, ordenación y PDF.
   - Auditoría automática por usuario en crear, editar y eliminar.
   ============================================================ */

type AnyRow = Record<string, any>;
type Mode = "create" | "edit" | "view";
type SortDirection = "asc" | "desc";

type ColumnDef = {
  name: string;
  type: string;
  columnType?: string;
  nullable?: boolean;
  required?: boolean;
  columnKey?: string;
  defaultValue?: any;
  extra?: string;
  maxLength?: number | null;
  numericPrecision?: number | null;
  numericScale?: number | null;
  auto?: boolean;
  readonly?: boolean;
  enumOptions?: string[];
  ref?: ForeignKey | null;
};

type ForeignKey = {
  column: string;
  referencedTable: string;
  referencedColumn: string;
  constraintName?: string;
};

type UniqueIndex = {
  name: string;
  columns: string[];
};

type SchemaDef = {
  columns: ColumnDef[];
  foreignKeys: ForeignKey[];
  uniqueIndexes: UniqueIndex[];
  primaryKey: string;
};

type TableInfo = {
  name: string;
  title: string;
  description: string;
  category: string;
  color: string;
  adminOnly?: boolean;
  records: number;
  columns: number;
};

type OptionItem = {
  value: string | number;
  label: string;
  row?: AnyRow;
};

type BootstrapData = {
  tables: TableInfo[];
  schemas: Record<string, SchemaDef>;
  options: Record<string, OptionItem[]>;
  categories: string[];
};

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_URL || "http://localhost:3001/api";

const getAuditHeaders = () => {
  let stored: AnyRow = {};

  try {
    const keys = ["gl365_user", "gl365User", "user", "usuario", "authUser", "currentUser"];
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        stored = parsed;
        break;
      }
    }
  } catch {
    stored = {};
  }

  const runtimeUser = (window as any).__GL365_CURRENT_USER__ || {};
  const name =
    runtimeUser.userName ||
    runtimeUser.name ||
    stored.userName ||
    stored.nombre_completo ||
    stored.nombre ||
    stored.name ||
    stored.nombre_usuario ||
    stored.usuario ||
    "Usuario del sistema";

  const email = stored.email || stored.correo || stored.correo_usuario || stored.username || "";
  const role = runtimeUser.role || stored.role || stored.rol || stored.nombre_rol || "";
  const id = stored.id || stored.usuario_id || stored.user_id || "";

  return {
    "X-GL365-User-Id": String(id || ""),
    "X-GL365-User-Name": String(name || "Usuario del sistema"),
    "X-GL365-User-Email": String(email || ""),
    "X-GL365-User-Role": String(role || ""),
  };
};

const apiRequest = async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...getAuditHeaders(),
      ...(options.headers || {}),
    },
  });

  let json: any = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  if (!response.ok || json?.ok === false) {
    throw new Error(json?.message || json?.error || "No se pudo completar la operación.");
  }

  return (json?.data ?? json) as T;
};

const COLOR_CLASS: Record<string, { soft: string; text: string; border: string; bar: string }> = {
  blue: { soft: "bg-blue-50", text: "text-blue-700", border: "border-blue-100", bar: "bg-[#0C2D6B]" },
  green: { soft: "bg-green-50", text: "text-green-700", border: "border-green-100", bar: "bg-green-500" },
  orange: { soft: "bg-orange-50", text: "text-orange-700", border: "border-orange-100", bar: "bg-[#FF6A00]" },
  purple: { soft: "bg-purple-50", text: "text-purple-700", border: "border-purple-100", bar: "bg-purple-500" },
  red: { soft: "bg-red-50", text: "text-red-700", border: "border-red-100", bar: "bg-red-500" },
  indigo: { soft: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-100", bar: "bg-indigo-500" },
  gray: { soft: "bg-slate-50", text: "text-slate-700", border: "border-slate-100", bar: "bg-slate-500" },
};

const CATEGORY_ICONS: Record<string, any> = {
  "Catálogos": Settings,
  "CRM y ventas": Users,
  Operaciones: Layers3,
  Logística: Truck,
  Flota: Wrench,
  Proveedores: Building2,
  Facturación: KeyRound,
  "Rutas y ubicaciones": MapPin,
  Bodega: Database,
  Seguridad: Shield,
  Otros: Table2,
};

const TABLE_ICONS: Record<string, any> = {
  cliente: Users,
  contacto_cliente: Users,
  telefono_contacto: Users,
  proveedor: Building2,
  contacto_proveedor: Building2,
  servicio_proveedor: Building2,
  vehiculo: Truck,
  piloto: Truck,
  unidad: Truck,
  mantenimiento: Wrench,
  ruta: MapPin,
  ubicacion: MapPin,
  envio: Truck,
  viaje: Truck,
  comprobante: KeyRound,
  pago: KeyRound,
  estado_cliente: Table2,
  estados_cliente: Table2,
  usuario: Shield,
  usuarios: Shield,
  rol: Shield,
  role: Shield,
  roles: Shield,
  solicitud_credencial: Shield,
  solicitudes_credenciales: Shield,
  auditoria: Shield,
};

const LABELS: Record<string, string> = {
  id: "ID",
  codigo: "Código",
  codigo_cliente: "Código cliente",
  codigo_proveedor: "Código proveedor",
  codigo_ruta: "Código ruta",
  codigo_estado: "Código estado",
  codigo_mantenimiento: "Código mantenimiento",
  codigo_piloto: "Código piloto",
  codigo_cotizacion: "Código cotización",
  codigo_oportunidad: "Código oportunidad",
  codigo_servicio: "Código servicio",
  codigo_rol: "Código rol",
  codigo_ubicacion: "Código ubicación",
  codigo_tipo_vehiculo: "Código tipo vehículo",
  codigo_tipo_deposito: "Código tipo depósito",
  codigo_forma_pago: "Código forma pago",
  codigo_modalidad: "Código modalidad",
  codigo_frecuencia: "Código frecuencia",
  nombre_empresa: "Empresa",
  razon_social: "Razón social",
  nombre_comercial: "Nombre comercial",
  nombre_ruta: "Nombre de ruta",
  nombre_ubicacion: "Ubicación",
  nombre_deposito: "Depósito",
  nombre_estado_cliente: "Estado cliente",
  nombre_estado_envio: "Estado envío",
  nombre_estado_factura: "Estado comprobante",
  nombre_estado_mantenimiento: "Estado mantenimiento",
  nombre_estado_proveedor: "Estado proveedor",
  nombre_estado_ruta: "Estado ruta",
  nombre_estado_vehiculo: "Estado vehículo",
  nombre_estado_oportunidad: "Estado oportunidad",
  nombre_estado_asignacion: "Estado asignación",
  nombre_forma_pago: "Forma de pago",
  nombre_frecuencia_ruta: "Frecuencia",
  nombre_modalidad: "Modalidad",
  nombre_tipo_deposito: "Tipo depósito",
  nombre_tipo_vehiculo: "Tipo vehículo",
  nombre_servicio_proveedor: "Servicio proveedor",
  primer_nombre: "Primer nombre",
  segundo_nombre: "Segundo nombre",
  primer_apellido: "Primer apellido",
  segundo_apellido: "Segundo apellido",
  nit: "NIT",
  direccion: "Dirección",
  correo: "Correo",
  email: "Email",
  nombre_usuario: "Usuario",
  password_hash: "Contraseña",
  nueva_password_hash: "Nueva contraseña",
  activo: "Estado",
  __estado_usuario: "Estado",
  __rol_usuario: "Rol",
  telefono: "Teléfono",
  tipo_telefono: "Tipo teléfono",
  prefijo_telefonico_id: "Prefijo telefónico",
  estado_id: "Estado",
  cliente_id: "Cliente",
  contacto_id: "Contacto",
  ejecutivo_id: "Ejecutivo",
  usuario_id: "Usuario",
  vehiculo_id: "Vehículo",
  piloto_id: "Piloto",
  proveedor_id: "Proveedor",
  ruta_id: "Ruta",
  unidad_id: "Unidad",
  asignacion_id: "Asignación",
  comprobante_id: "Comprobante",
  viaje_id: "Viaje",
  origen_id: "Origen",
  destino_id: "Destino",
  forma_pago_id: "Forma de pago",
  modalidad_id: "Modalidad",
  tipo_id: "Tipo",
  estado_cliente_id: "Estado cliente",
  estado_mantenimiento_id: "Estado mantenimiento",
  estados_mantenimiento_id: "Estado mantenimiento",
  fecha: "Fecha",
  fecha_carga: "Fecha carga",
  fecha_descarga: "Fecha descarga",
  fecha_salida: "Fecha / hora salida",
  fecha_emision: "Fecha emisión",
  fecha_vencimiento: "Vencimiento",
  fecha_pago: "Fecha de pago",
  fecha_creacion: "Fecha creación",
  fecha_cierre_estimada: "Cierre estimado",
  created_at: "Creado",
  updated_at: "Actualizado",
  solicitado_en: "Solicitado",
  revisado_en: "Revisado",
  revisado_por: "Revisado por",
  numero_comprobante: "Número comprobante",
  serie: "Serie",
  numero: "Número",
  subtotal: "Subtotal",
  iva: "IVA",
  total: "Total",
  costo: "Costo",
  flete: "Flete",
  cuadrilla: "Cuadrilla",
  estadia: "Estadía",
  parada_adicional: "Parada adicional",
  movimiento_falso: "Movimiento falso",
  viaje_doble: "Viaje doble",
  otros: "Otros",
  eficiencia: "Eficiencia",
  kilometraje: "Kilometraje",
  proximo_mantenimiento: "Próximo mantenimiento",
  proximo: "Próximo",
  descripcion: "Descripción",
  observaciones: "Observaciones",
  historial: "Historial",
  hallazgos: "Hallazgos",
  estado: "Estado",
  es_principal: "Principal",
  lista_clinton: "Lista Clinton",
  rtu_validado: "RTU validado",
  licencia_validada: "Licencia validada",
  cuenta_validada: "Cuenta validada",
};

const label = (name: string) => LABELS[name] || name.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const normalizeRows = (data: any): AnyRow[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.registros)) return data.registros;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const normalizeSchema = (data: any): SchemaDef => ({
  columns: data?.columns || data?.columnas || [],
  foreignKeys: data?.foreignKeys || [],
  uniqueIndexes: data?.uniqueIndexes || [],
  primaryKey: data?.primaryKey || data?.llavePrimaria || "id",
});

const isNumericType = (column?: ColumnDef) => {
  const type = String(column?.type || "").toLowerCase();
  return ["int", "tinyint", "smallint", "mediumint", "bigint", "decimal", "float", "double"].includes(type);
};

const isDecimalType = (column?: ColumnDef) => ["decimal", "float", "double"].includes(String(column?.type || "").toLowerCase());
const isDateType = (column?: ColumnDef) => String(column?.type || "").toLowerCase() === "date";
const isDateTimeType = (column?: ColumnDef) => ["datetime", "timestamp"].includes(String(column?.type || "").toLowerCase());
const isTinyBoolean = (column?: ColumnDef) => String(column?.type || "").toLowerCase() === "tinyint" && String(column?.columnType || "").includes("(1)");
const isLongText = (column?: ColumnDef) => ["text", "mediumtext", "longtext"].includes(String(column?.type || "").toLowerCase()) || ["descripcion", "observaciones", "historial", "hallazgos", "direccion"].includes(column?.name || "");
const isPasswordField = (name: string) => name.toLowerCase().includes("password");
const isEmailField = (name: string) => ["email", "correo"].includes(name.toLowerCase());
const isPhoneField = (name: string) => name.toLowerCase().includes("telefono");
const isCodeField = (name: string) => name.toLowerCase().startsWith("codigo") || ["nit", "licencia", "serie", "numero", "marchamo", "cabezal", "furgon", "referencia"].includes(name.toLowerCase());
const isLettersField = (name: string) => ["primer_nombre", "segundo_nombre", "primer_apellido", "segundo_apellido", "pais", "cargo"].includes(name.toLowerCase());

const cleanLetters = (value: string) => value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]/g, "");
const cleanNumber = (value: string, decimal = false) => {
  const raw = value.replace(decimal ? /[^0-9.]/g : /[^0-9]/g, "");
  if (!decimal) return raw;
  const [first, ...rest] = raw.split(".");
  return first + (rest.length ? "." + rest.join("") : "");
};
const cleanPhone = (value: string) => value.replace(/[^0-9]/g, "").slice(0, 15);
const cleanCode = (value: string) => value.replace(/[^A-Za-z0-9_\-./]/g, "").toUpperCase();

const titleCase = (value: string) =>
  value
    .toLowerCase()
    .replace(/(^|\s)([a-záéíóúñü])/g, (_, space, char) => `${space}${String(char).toUpperCase()}`);

const toInputDate = (value: any) => {
  if (!value) return "";
  const raw = String(value);
  if (raw.includes("T")) return raw.slice(0, 10);
  if (raw.includes(" ")) return raw.split(" ")[0];
  return raw.slice(0, 10);
};

const toInputDateTime = (value: any) => {
  if (!value) return "";
  const raw = String(value);
  if (raw.includes("T")) return raw.slice(0, 16);
  if (raw.includes(" ")) return raw.replace(" ", "T").slice(0, 16);
  return raw.slice(0, 16);
};

const fromInputDateTime = (value: any) => {
  if (!value) return null;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return raw.replace("T", " ") + ":00";
  return raw.replace("T", " ");
};

const formatDate = (value: any) => {
  if (!value) return "-";
  const raw = String(value);
  if (raw.includes("T")) return raw.slice(0, 10);
  if (raw.includes(" ")) return raw.split(" ")[0];
  return raw;
};

const formatMoney = (value: any) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "Q 0.00";
  return new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(n);
};

const formatCell = (row: AnyRow, column: ColumnDef, options: Record<string, OptionItem[]>) => {
  const value = row[column.name];
  if (value === null || value === undefined || value === "") return <span className="text-gray-400">-</span>;
  if (isPasswordField(column.name)) return <span className="tracking-widest text-gray-400">••••••••</span>;
  if (column.ref?.referencedTable) {
    const item = options[column.ref.referencedTable]?.find((option) => String(option.value) === String(value));
    return item ? <span>{item.label}</span> : <span>{String(value)}</span>;
  }
  if (isTinyBoolean(column)) {
    const active = Number(value) === 1;
    return <Badge tone={active ? "green" : "gray"}>{active ? "Sí" : "No"}</Badge>;
  }
  if (isDateType(column)) return <span>{formatDate(value)}</span>;
  if (isDateTimeType(column)) return <span>{String(value).replace("T", " ").slice(0, 16)}</span>;
  if (["total", "subtotal", "iva", "costo", "flete", "cuadrilla", "estadia", "valor", "monto", "precio_unitario", "impuesto", "descuento"].includes(column.name)) return <span className="font-bold text-[#0C2D6B]">{formatMoney(value)}</span>;
  if (String(value).length > 80) return <span title={String(value)}>{String(value).slice(0, 80)}...</span>;
  return <span>{String(value)}</span>;
};


const formatCellText = (row: AnyRow, column: ColumnDef, options: Record<string, OptionItem[]> = {}) => {
  const value = row[column.name];
  if (value === null || value === undefined || value === "") return "-";
  if (isPasswordField(column.name)) return "********";

  if (column.ref?.referencedTable) {
    const item = options[column.ref.referencedTable]?.find((option) => String(option.value) === String(value));
    return item ? String(item.label) : String(value);
  }

  if (isTinyBoolean(column)) return Number(value) === 1 ? "Sí" : "No";
  if (isDateType(column)) return formatDate(value);
  if (isDateTimeType(column)) return String(value).replace("T", " ").slice(0, 16);

  if (["total", "subtotal", "iva", "costo", "flete", "cuadrilla", "estadia", "valor", "monto", "precio_unitario", "impuesto", "descuento"].includes(column.name)) {
    return formatMoney(value);
  }

  return String(value);
};

const normalizeForCompare = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const cleanPdfText = (value: any, limit = 90) => {
  const text = String(value ?? "-").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
};

const getRowTitle = (table: string, row: AnyRow) => {
  const codeFields = ["codigo", "codigo_cliente", "codigo_proveedor", "codigo_ruta", "codigo_mantenimiento", "numero_comprobante", "codigo_cotizacion", "codigo_oportunidad"];
  const nameFields = ["nombre_empresa", "razon_social", "nombre_comercial", "nombre_ruta", "nombre_ubicacion", "nombre_deposito", "descripcion", "tipo", "correo", "email"];
  const code = codeFields.map((field) => row[field]).find(Boolean);
  let name = nameFields.map((field) => row[field]).find(Boolean);
  if (!name && (row.primer_nombre || row.primer_apellido)) {
    name = [row.primer_nombre, row.segundo_nombre, row.primer_apellido, row.segundo_apellido].filter(Boolean).join(" ");
  }
  if (code && name) return `${code} · ${name}`;
  return String(code || name || `${table} #${row.id || ""}`);
};

const displayColumns = (schema?: SchemaDef) => {
  const columns = schema?.columns || [];
  const hidden = new Set(["created_at", "updated_at", "password_hash", "nueva_password_hash"]);
  const priority = [
    "codigo", "codigo_cliente", "codigo_proveedor", "codigo_ruta", "codigo_mantenimiento", "numero_comprobante", "serie",
    "nombre_empresa", "razon_social", "nombre_comercial", "nombre_ruta", "nombre_ubicacion", "primer_nombre",
    "estado_id", "estado", "nivel", "tipo", "fecha", "fecha_emision", "total", "costo", "correo", "telefono",
  ];

  const selected: ColumnDef[] = [];
  priority.forEach((name) => {
    const found = columns.find((column) => column.name === name && !hidden.has(column.name));
    if (found && !selected.some((column) => column.name === found.name)) selected.push(found);
  });

  columns.forEach((column) => {
    if (selected.length >= 7) return;
    if (hidden.has(column.name)) return;
    if (column.name === schema?.primaryKey) return;
    if (!selected.some((item) => item.name === column.name)) selected.push(column);
  });

  return selected.slice(0, 7);
};

const emptyValueFor = (column: ColumnDef) => {
  if (isTinyBoolean(column)) return column.defaultValue ?? 0;
  if (column.defaultValue !== null && column.defaultValue !== undefined && !String(column.defaultValue).toUpperCase().includes("CURRENT_TIMESTAMP")) return column.defaultValue;
  return "";
};

function Badge({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "green" | "orange" | "red" | "gray" | "purple" }) {
  const cls: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    green: "bg-green-50 text-green-700 border-green-100",
    orange: "bg-orange-50 text-orange-700 border-orange-100",
    red: "bg-red-50 text-red-700 border-red-100",
    gray: "bg-slate-50 text-slate-600 border-slate-100",
    purple: "bg-purple-50 text-purple-700 border-purple-100",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${cls[tone]}`}>{children}</span>;
}

function StatCard({ title, value, subtitle, icon: Icon, color = "blue" }: { title: string; value: string; subtitle?: string; icon: any; color?: string }) {
  const c = COLOR_CLASS[color] || COLOR_CLASS.blue;
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-3xl font-black text-[#0C2D6B]">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
        </div>
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${c.soft} ${c.text}`}>
          <Icon className="h-7 w-7" />
        </div>
      </div>
      <div className={`h-1.5 ${c.bar}`} />
    </div>
  );
}

function IconButton({ title, icon: Icon, tone = "blue", onClick }: { title: string; icon: any; tone?: "blue" | "orange" | "red" | "green" | "gray"; onClick: () => void }) {
  const cls: Record<string, string> = {
    blue: "bg-blue-50 text-[#0C2D6B] hover:bg-blue-100",
    orange: "bg-orange-50 text-[#FF6A00] hover:bg-orange-100",
    red: "bg-red-50 text-red-600 hover:bg-red-100",
    green: "bg-green-50 text-green-600 hover:bg-green-100",
    gray: "bg-slate-50 text-slate-600 hover:bg-slate-100",
  };
  return (
    <button type="button" title={title} onClick={onClick} className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-100 shadow-sm transition ${cls[tone]}`}>
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function Mantenimiento() {
  const { role, userName } = useAuth();
  const [bootstrap, setBootstrap] = useState<BootstrapData>({ tables: [], schemas: {}, options: {}, categories: [] });
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const [records, setRecords] = useState<AnyRow[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [globalSearch, setGlobalSearch] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [mainSort, setMainSort] = useState("category");
  const [mainSortDirection, setMainSortDirection] = useState<SortDirection>("asc");
  const [columnFilter, setColumnFilter] = useState("Todas");
  const [columnFilterValue, setColumnFilterValue] = useState("");
  const [sortColumn, setSortColumn] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [userStatusFilter, setUserStatusFilter] = useState("Todos");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [modalMode, setModalMode] = useState<Mode | null>(null);
  const [form, setForm] = useState<AnyRow>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteRow, setDeleteRow] = useState<AnyRow | null>(null);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    (window as any).__GL365_CURRENT_USER__ = {
      userName,
      role,
    };
  }, [userName, role]);

  const schema = selectedTable ? bootstrap.schemas[selectedTable.name] : undefined;
  const primaryKey = schema?.primaryKey || "id";
  const isAuditTable = selectedTable?.name === "auditoria";
  const isUserTable = selectedTable?.name === "usuario" || selectedTable?.name === "usuarios";
  const formColumns = (schema?.columns || []).filter((column) => !column.auto && column.columnKey !== "PRI" && !column.readonly);
  const viewColumns = schema?.columns || [];
  const columnsToShow = displayColumns(schema);
  const filterableColumns = (schema?.columns || []).filter((column) => !isPasswordField(column.name) && !["created_at", "updated_at", "nueva_password_hash"].includes(column.name));

  const userFullName = (row: AnyRow) =>
    [
      row.primer_nombre,
      row.segundo_nombre,
      row.primer_apellido,
      row.segundo_apellido,
    ]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    String(row.nombre_completo || row.nombre || row.nombre_usuario || row.email || "Usuario").trim();

  const isUserActive = (row: AnyRow) => {
    const raw = row.activo ?? row.estado ?? row.estado_usuario ?? row.status ?? 1;

    if (typeof raw === "number") return Number(raw) === 1;
    if (typeof raw === "boolean") return raw;

    const text = String(raw).toLowerCase();
    return !text.includes("inactivo") && !text.includes("baja") && !text.includes("desactivado") && text !== "0";
  };

  const userRoleLabel = (row: AnyRow) => {
    const roleColumn = (schema?.columns || []).find((column) =>
      ["rol_id", "role_id", "id_rol", "id_role"].includes(column.name)
    );

    if (roleColumn) {
      const value = formatCellText(row, roleColumn, bootstrap.options);
      if (value && value !== "-") return value;
    }

    return String(row.nombre_rol || row.rol || row.role || row.rol_id || row.role_id || "Sin rol");
  };

  const userStatusLabel = (row: AnyRow) => (isUserActive(row) ? "Activo" : "De baja");

  const userFilterText = (row: AnyRow, key: string) => {
    const values: Record<string, string> = {
      USER_NOMBRE: userFullName(row),
      USER_USUARIO: String(row.nombre_usuario || row.usuario || ""),
      USER_EMAIL: String(row.email || row.correo || ""),
      USER_ROL: userRoleLabel(row),
      USER_ESTADO: userStatusLabel(row),
      Todas: [
        userFullName(row),
        row.nombre_usuario,
        row.usuario,
        row.email,
        row.correo,
        userRoleLabel(row),
        userStatusLabel(row),
      ].join(" "),
    };

    return values[key] ?? values.Todas;
  };

  const userFilterOptions = [
    { value: "Todas", label: "Buscar en todo el usuario" },
    { value: "USER_NOMBRE", label: "Nombre completo" },
    { value: "USER_USUARIO", label: "Usuario" },
    { value: "USER_EMAIL", label: "Correo electrónico" },
    { value: "USER_ROL", label: "Rol de acceso" },
    { value: "USER_ESTADO", label: "Estado del usuario" },
  ];

  const userSortOptions = [
    { value: "USER_NOMBRE", label: "Nombre completo" },
    { value: "USER_USUARIO", label: "Usuario" },
    { value: "USER_EMAIL", label: "Correo electrónico" },
    { value: "USER_ROL", label: "Rol de acceso" },
    { value: "USER_ESTADO", label: "Estado" },
  ];

  const findColumn = (names: string[]) =>
    (schema?.columns || []).find((column) => names.includes(column.name));

  const syntheticColumn = (name: string): ColumnDef => ({
    name,
    type: "varchar",
    nullable: true,
    required: false,
    readonly: true,
  });

  const userColumnsToShow = [
    findColumn(["primer_nombre"]),
    findColumn(["segundo_nombre"]),
    findColumn(["primer_apellido"]),
    findColumn(["segundo_apellido"]),
    syntheticColumn("__estado_usuario"),
    findColumn(["nombre_usuario", "usuario"]),
    findColumn(["email", "correo"]),
    findColumn(["rol_id", "role_id", "id_rol"]),
  ].filter(Boolean) as ColumnDef[];

  const tableColumnsToShow = isUserTable ? userColumnsToShow : columnsToShow;

  const selectedFilterLabel = isUserTable
    ? userFilterOptions.find((option) => option.value === columnFilter)?.label || "todo el usuario"
    : columnFilter === "Todas"
    ? "todos los campos"
    : label(columnFilter);

  const tableSearchPlaceholder = isUserTable
    ? `Buscar por ${selectedFilterLabel.toLowerCase()}...`
    : `Buscar por ${selectedFilterLabel.toLowerCase()}...`;

  const renderTableCell = (row: AnyRow, column: ColumnDef) => {
    if (column.name === "__estado_usuario") {
      const active = isUserActive(row);
      return (
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${
          active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
        }`}>
          {active ? "Activo" : "De baja"}
        </span>
      );
    }

    if (column.name === "__rol_usuario") return userRoleLabel(row);

    return formatCell(row, column, bootstrap.options);
  };

  const loadBootstrap = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const data = await apiRequest<BootstrapData>("/mantenimiento/bootstrap");
      const normalizedTables = (data.tables || []).map((table) => {
        if (["estado_cliente", "estados_cliente"].includes(table.name)) {
          return {
            ...table,
            title: "Estados de cliente",
            category: "Catálogos",
            color: "blue",
            description: "Estados administrativos para clientes.",
          };
        }

        if (["usuario", "usuarios"].includes(table.name)) {
          return {
            ...table,
            title: "Usuarios",
            category: "Seguridad",
            color: "indigo",
            description: "Control de usuarios, accesos, roles, usuarios activos y de baja.",
            adminOnly: true,
          };
        }

        return table;
      });

      setBootstrap({
        tables: normalizedTables,
        schemas: data.schemas || {},
        options: data.options || {},
        categories: data.categories || [],
      });
    } catch (error: any) {
      setNotice({ type: "error", text: error.message || "No se pudo conectar mantenimiento con MySQL." });
    } finally {
      setLoading(false);
    }
  };

  const loadRecords = async (table = selectedTable?.name) => {
    if (!table) return;
    setTableLoading(true);
    setNotice(null);
    try {
      const query = new URLSearchParams({ limit: "5000" });
      const data = await apiRequest<any>(`/mantenimiento/tablas/${table}/registros?${query.toString()}`);
      setRecords(normalizeRows(data));
      setTotalRecords(Number(data?.total || normalizeRows(data).length || 0));
    } catch (error: any) {
      setRecords([]);
      setTotalRecords(0);
      setNotice({ type: "error", text: error.message || "No se pudieron cargar los registros." });
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    loadBootstrap();
  }, []);

  useEffect(() => {
    if (!selectedTable) return;
    setTableSearch("");
    setColumnFilter("Todas");
    setColumnFilterValue("");
    setSortColumn("");
    setSortDirection("asc");
    setUserStatusFilter("Todos");
    setCurrentPage(1);
    loadRecords(selectedTable.name);
  }, [selectedTable?.name]);

  useEffect(() => {
    if (!selectedTable) return;
    setCurrentPage(1);
  }, [tableSearch, columnFilter]);

  const visibleTables = useMemo(() => {
    return (bootstrap.tables || []).filter((table) => {
      if (table.adminOnly && role !== "gerencia" && role !== "administrador") return false;
      const hayBusqueda = `${table.title} ${table.name} ${table.description} ${table.category}`.toLowerCase().includes(globalSearch.toLowerCase());
      const hayCategoria = categoryFilter === "Todas" || table.category === categoryFilter;
      return hayBusqueda && hayCategoria;
    });
  }, [bootstrap.tables, globalSearch, categoryFilter, role]);

  const sortedVisibleTables = useMemo(() => {
    const rows = [...visibleTables];
    rows.sort((a, b) => {
      let av: any = "";
      let bv: any = "";

      if (mainSort === "records") {
        av = Number(a.records || 0);
        bv = Number(b.records || 0);
      } else if (mainSort === "name") {
        av = a.title || a.name;
        bv = b.title || b.name;
      } else {
        av = `${a.category || ""} ${a.title || a.name}`;
        bv = `${b.category || ""} ${b.title || b.name}`;
      }

      if (typeof av === "number" && typeof bv === "number") {
        return mainSortDirection === "asc" ? av - bv : bv - av;
      }

      return mainSortDirection === "asc"
        ? String(av).localeCompare(String(bv), "es")
        : String(bv).localeCompare(String(av), "es");
    });
    return rows;
  }, [visibleTables, mainSort, mainSortDirection]);

  const categories = useMemo(() => {
    const fromTables = Array.from(new Set((bootstrap.tables || []).map((table) => table.category))).filter(Boolean);
    const ordered = (bootstrap.categories || []).filter((category) => fromTables.includes(category));
    return [...ordered, ...fromTables.filter((category) => !ordered.includes(category))];
  }, [bootstrap.tables, bootstrap.categories]);

  const groupedTables = useMemo(() => {
    return categories.map((category) => ({
      category,
      tables: sortedVisibleTables.filter((table) => table.category === category),
    })).filter((group) => group.tables.length > 0);
  }, [categories, sortedVisibleTables]);

  const totalRows = useMemo(() => (bootstrap.tables || []).reduce((sum, table) => sum + Number(table.records || 0), 0), [bootstrap.tables]);
  const totalRelations = useMemo(() => (Object.values(bootstrap.schemas || {}) as SchemaDef[]).reduce((sum, item) => sum + Number(item.foreignKeys?.length || 0), 0), [bootstrap.schemas]);
  const totalCatalogs = useMemo(() => (bootstrap.tables || []).filter((table) => table.category === "Catálogos").length, [bootstrap.tables]);
  const defaultSortColumn = isUserTable ? "USER_NOMBRE" : columnsToShow[0]?.name || filterableColumns[0]?.name || "";
  const activeSortColumn = sortColumn || defaultSortColumn;

  const displayedRecords = useMemo(() => {
    let rows = [...records];
    const filterText = normalizeForCompare(tableSearch);

    if (filterText) {
      rows = rows.filter((row) => {
        if (isUserTable) {
          return normalizeForCompare(userFilterText(row, columnFilter)).includes(filterText);
        }

        const cols = columnFilter === "Todas"
          ? filterableColumns
          : filterableColumns.filter((column) => column.name === columnFilter);

        return cols.some((column) =>
          normalizeForCompare(formatCellText(row, column, bootstrap.options)).includes(filterText)
        );
      });
    }

    if (isUserTable && userStatusFilter !== "Todos") {
      rows = rows.filter((row) =>
        userStatusFilter === "Activos" ? isUserActive(row) : !isUserActive(row)
      );
    }

    if (activeSortColumn) {
      const selectedColumn = (schema?.columns || []).find((column) => column.name === activeSortColumn);
      rows.sort((a, b) => {
        if (isUserTable && (String(activeSortColumn).startsWith("USER_") || activeSortColumn === "__estado_usuario" || activeSortColumn === "__rol_usuario")) {
          const key =
            activeSortColumn === "__estado_usuario"
              ? "USER_ESTADO"
              : activeSortColumn === "__rol_usuario"
              ? "USER_ROL"
              : activeSortColumn;

          const av = normalizeForCompare(userFilterText(a, key));
          const bv = normalizeForCompare(userFilterText(b, key));
          return sortDirection === "asc"
            ? av.localeCompare(bv, "es", { numeric: true })
            : bv.localeCompare(av, "es", { numeric: true });
        }

        const avRaw = a[activeSortColumn];
        const bvRaw = b[activeSortColumn];

        if (selectedColumn && isNumericType(selectedColumn)) {
          const av = Number(avRaw || 0);
          const bv = Number(bvRaw || 0);
          return sortDirection === "asc" ? av - bv : bv - av;
        }

        if (selectedColumn && (isDateType(selectedColumn) || isDateTimeType(selectedColumn))) {
          const av = String(avRaw ?? "");
          const bv = String(bvRaw ?? "");
          return sortDirection === "asc" ? av.localeCompare(bv, "es") : bv.localeCompare(av, "es");
        }

        const av = normalizeForCompare(selectedColumn ? formatCellText(a, selectedColumn, bootstrap.options) : String(avRaw ?? ""));
        const bv = normalizeForCompare(selectedColumn ? formatCellText(b, selectedColumn, bootstrap.options) : String(bvRaw ?? ""));
        return sortDirection === "asc" ? av.localeCompare(bv, "es", { numeric: true }) : bv.localeCompare(av, "es", { numeric: true });
      });
    }

    return rows;
  }, [records, tableSearch, columnFilter, activeSortColumn, sortDirection, filterableColumns, schema?.columns, bootstrap.options, isUserTable, userStatusFilter]);

  const totalPages = Math.max(1, Math.ceil(displayedRecords.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRecords = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return displayedRecords.slice(start, start + pageSize);
  }, [displayedRecords, safeCurrentPage, pageSize]);

  const usuariosActivos = isUserTable ? records.filter((row) => isUserActive(row)).length : 0;
  const usuariosBaja = isUserTable ? Math.max(records.length - usuariosActivos, 0) : 0;
  const rolesDetectados = isUserTable
    ? new Set(records.map((row) => row.rol_id || row.role_id || row.rol || row.nombre_rol).filter(Boolean)).size
    : 0;

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedTable?.name, tableSearch, columnFilter, sortColumn, sortDirection, userStatusFilter, pageSize]);

  const refreshAll = async () => {
    await loadBootstrap();
    if (selectedTable) await loadRecords(selectedTable.name, tableSearch);
  };

  const openCreate = () => {
    if (!schema || isAuditTable) {
      setNotice({ type: "error", text: "Auditoría se genera automáticamente con las acciones del sistema. No se ingresa manualmente." });
      return;
    }
    const next: AnyRow = {};
    formColumns.forEach((column) => {
      next[column.name] = emptyValueFor(column);
    });
    setForm(next);
    setErrors({});
    setModalMode("create");
  };

  const openView = (row: AnyRow) => {
    setForm({ ...row });
    setErrors({});
    setModalMode("view");
  };

  const openEdit = (row: AnyRow) => {
    if (isAuditTable) {
      setNotice({ type: "error", text: "Los registros de auditoría son solo de consulta." });
      return;
    }
    const next = { ...row };
    (schema?.columns || []).forEach((column) => {
      if (isDateType(column)) next[column.name] = toInputDate(next[column.name]);
      if (isDateTimeType(column)) next[column.name] = toInputDateTime(next[column.name]);
      if (isPasswordField(column.name)) next[column.name] = "";
    });
    setForm(next);
    setErrors({});
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setForm({});
    setErrors({});
  };

  const validateForm = () => {
    const next: Record<string, string> = {};
    formColumns.forEach((column) => {
      const value = form[column.name];
      const empty = value === null || value === undefined || String(value).trim() === "";

      if (column.required && empty && !(modalMode === "edit" && isPasswordField(column.name))) {
        next[column.name] = "Este campo es obligatorio.";
      }

      if (!empty && isEmailField(column.name) && !/^\S+@\S+\.\S+$/.test(String(value))) {
        next[column.name] = "Ingresa un correo válido.";
      }

      if (!empty && isPhoneField(column.name) && String(value).replace(/\D/g, "").length < 8) {
        next[column.name] = "Ingresa al menos 8 números.";
      }

      if (!empty && isNumericType(column) && !Number.isFinite(Number(value))) {
        next[column.name] = "Solo se permiten números.";
      }

      if (!empty && column.maxLength && String(value).length > Number(column.maxLength)) {
        next[column.name] = `Máximo ${column.maxLength} caracteres.`;
      }
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const updateField = (column: ColumnDef, value: string) => {
    let next: any = value;
    if (isLettersField(column.name)) next = titleCase(cleanLetters(value));
    else if (isPhoneField(column.name)) next = cleanPhone(value);
    else if (isNumericType(column)) next = cleanNumber(value, isDecimalType(column));
    else if (isCodeField(column.name)) next = cleanCode(value);

    if (column.maxLength) next = String(next).slice(0, Number(column.maxLength));

    setForm((prev) => ({ ...prev, [column.name]: next }));
    setErrors((prev) => ({ ...prev, [column.name]: "" }));
  };

  const preparePayload = () => {
    const payload: AnyRow = {};
    formColumns.forEach((column) => {
      if (modalMode === "edit" && isPasswordField(column.name) && !form[column.name]) return;
      let value = form[column.name];
      if (isDateTimeType(column)) value = fromInputDateTime(value);
      if (value === "") value = null;
      payload[column.name] = value;
    });
    return payload;
  };

  const saveRecord = async () => {
    if (!selectedTable || !schema || !validateForm()) return;

    try {
      const id = form[primaryKey];
      const method = modalMode === "edit" ? "PUT" : "POST";
      const url = modalMode === "edit"
        ? `/mantenimiento/tablas/${selectedTable.name}/registros/${id}`
        : `/mantenimiento/tablas/${selectedTable.name}/registros`;

      await apiRequest(url, {
        method,
        body: JSON.stringify(preparePayload()),
      });

      setNotice({ type: "success", text: modalMode === "edit" ? "Registro actualizado correctamente." : "Registro creado correctamente." });
      closeModal();
      await loadRecords(selectedTable.name, tableSearch);
      await loadBootstrap();
    } catch (error: any) {
      setNotice({ type: "error", text: error.message || "No se pudo guardar el registro." });
    }
  };

  const confirmDelete = async () => {
    if (!selectedTable || !deleteRow) return;
    if (isAuditTable) {
      setDeleteError("Auditoría se genera automáticamente y no debe eliminarse desde mantenimiento.");
      return;
    }
    setDeleteError("");
    try {
      await apiRequest(`/mantenimiento/tablas/${selectedTable.name}/registros/${deleteRow[primaryKey]}`, { method: "DELETE" });
      setNotice({ type: "success", text: "Registro eliminado correctamente." });
      setDeleteRow(null);
      await loadRecords(selectedTable.name, tableSearch);
      await loadBootstrap();
    } catch (error: any) {
      setDeleteError(error.message || "No se pudo eliminar el registro.");
    }
  };

  const handleEnter = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    const fields = Array.from(document.querySelectorAll<HTMLElement>('[data-mant-field="true"]')).filter((element) => !element.hasAttribute("disabled"));
    const index = fields.indexOf(event.currentTarget as HTMLElement);
    const next = fields[index + 1];
    if (next) next.focus();
    else saveRecord();
  };

  const toggleSort = (columnName: string) => {
    if ((sortColumn || defaultSortColumn) === columnName) {
      setSortColumn(columnName);
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortColumn(columnName);
    setSortDirection("asc");
  };

  const toggleSortDirection = () => {
    if (!sortColumn && defaultSortColumn) setSortColumn(defaultSortColumn);
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  const clearTableFilters = () => {
    setTableSearch("");
    setColumnFilter("Todas");
    setColumnFilterValue("");
    setSortColumn("");
    setSortDirection("asc");
  };

  const pdfColumnsFor = (schemaDef?: SchemaDef) =>
    (schemaDef?.columns || []).filter((column) => !["password_hash", "nueva_password_hash"].includes(column.name));

  const exportCurrentTablePdf = () => {
    if (!selectedTable || !schema) return;

    setExportingPdf(true);
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pdfColumns = pdfColumnsFor(schema);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(12, 45, 107);
      doc.text(`GL365 · ${selectedTable.title}`, 14, 14);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(90, 103, 122);
      doc.text(`Tabla: ${selectedTable.name} | Registros exportados: ${displayedRecords.length} | Fuente: MySQL`, 14, 21);

      autoTable(doc, {
        startY: 28,
        head: [pdfColumns.map((column) => label(column.name))],
        body: displayedRecords.map((row) => pdfColumns.map((column) => cleanPdfText(formatCellText(row, column, bootstrap.options), 70))),
        styles: { fontSize: 6, cellPadding: 1.6, overflow: "linebreak" },
        headStyles: { fillColor: [12, 45, 107], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [247, 249, 252] },
        margin: { left: 10, right: 10 },
      } as any);

      doc.save(`GL365_${selectedTable.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
      setNotice({ type: "success", text: "PDF de la tabla generado correctamente." });
    } catch (error: any) {
      setNotice({ type: "error", text: error.message || "No se pudo generar el PDF." });
    } finally {
      setExportingPdf(false);
    }
  };

  const exportAllTablesPdf = async () => {
    setExportingPdf(true);
    setNotice({ type: "success", text: "Generando PDF general de todas las tablas. Esperá un momento..." });

    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const tablesToExport = (bootstrap.tables || []).filter((table) => !(table.adminOnly && role !== "gerencia" && role !== "administrador"));

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(12, 45, 107);
      doc.text("GL365 ERP · Mantenimiento general", 14, 16);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(90, 103, 122);
      doc.text(`Tablas exportadas: ${tablesToExport.length} | Fuente: MySQL | Fecha: ${new Date().toLocaleDateString("es-GT")}`, 14, 24);

      autoTable(doc, {
        startY: 32,
        head: [["Tabla", "Categoría", "Registros", "Descripción"]],
        body: tablesToExport.map((table) => [table.title, table.category, String(table.records || 0), cleanPdfText(table.description, 100)]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [12, 45, 107], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [247, 249, 252] },
      } as any);

      for (let index = 0; index < tablesToExport.length; index += 1) {
        const table = tablesToExport[index];
        const schemaDef = bootstrap.schemas[table.name];
        const pdfColumns = pdfColumnsFor(schemaDef);

        doc.addPage();
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(12, 45, 107);
        doc.text(`${index + 1}. ${table.title}`, 14, 14);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(90, 103, 122);
        doc.text(`Tabla: ${table.name} · Categoría: ${table.category}`, 14, 20);

        let rows: AnyRow[] = [];
        try {
          const query = new URLSearchParams({ limit: "5000" });
          const data = await apiRequest<any>(`/mantenimiento/tablas/${table.name}/registros?${query.toString()}`);
          rows = normalizeRows(data);
        } catch {
          rows = [];
        }

        if (!rows.length) {
          doc.setFontSize(9);
          doc.setTextColor(120, 120, 120);
          doc.text("Sin registros para exportar.", 14, 30);
          continue;
        }

        autoTable(doc, {
          startY: 27,
          head: [pdfColumns.map((column) => label(column.name))],
          body: rows.map((row) => pdfColumns.map((column) => cleanPdfText(formatCellText(row, column, bootstrap.options), 65))),
          styles: { fontSize: 5.5, cellPadding: 1.4, overflow: "linebreak" },
          headStyles: { fillColor: [255, 106, 0], textColor: 255, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          margin: { left: 8, right: 8 },
        } as any);
      }

      doc.save(`GL365_Mantenimiento_Todas_las_tablas_${new Date().toISOString().slice(0, 10)}.pdf`);
      setNotice({ type: "success", text: "PDF general de todas las tablas generado correctamente." });
    } catch (error: any) {
      setNotice({ type: "error", text: error.message || "No se pudo generar el PDF general." });
    } finally {
      setExportingPdf(false);
    }
  };

  const renderField = (column: ColumnDef, mode: Mode) => {
    const disabled = mode === "view";
    const value = form[column.name] ?? "";
    const error = errors[column.name];
    const base = `w-full rounded-2xl border bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0C2D6B] focus:ring-4 focus:ring-[#0C2D6B]/10 disabled:bg-gray-50 disabled:text-gray-500 ${error ? "border-red-300" : "border-gray-200"}`;

    let control: ReactNode;

    if (column.ref?.referencedTable) {
      const opts = bootstrap.options[column.ref.referencedTable] || [];
      control = (
        <select data-mant-field="true" value={value ?? ""} onKeyDown={handleEnter} onChange={(e) => updateField(column, e.target.value)} disabled={disabled} className={base}>
          <option value="">Seleccionar {label(column.name).toLowerCase()}...</option>
          {opts.map((option) => (
            <option key={`${option.value}`} value={option.value}>{option.label}</option>
          ))}
        </select>
      );
    } else if (column.enumOptions?.length) {
      control = (
        <select data-mant-field="true" value={value ?? ""} onKeyDown={handleEnter} onChange={(e) => updateField(column, e.target.value)} disabled={disabled} className={base}>
          <option value="">Seleccionar...</option>
          {column.enumOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      );
    } else if (isTinyBoolean(column)) {
      control = (
        <select data-mant-field="true" value={String(value ?? 0)} onKeyDown={handleEnter} onChange={(e) => updateField(column, e.target.value)} disabled={disabled} className={base}>
          <option value="1">Sí</option>
          <option value="0">No</option>
        </select>
      );
    } else if (isLongText(column)) {
      control = (
        <textarea data-mant-field="true" rows={3} value={String(value ?? "")} onKeyDown={handleEnter} onChange={(e) => updateField(column, e.target.value)} disabled={disabled} className={`${base} resize-none`} maxLength={column.maxLength || undefined} />
      );
    } else {
      const inputType = isDateType(column) ? "date" : isDateTimeType(column) ? "datetime-local" : isEmailField(column.name) ? "email" : isPasswordField(column.name) ? "password" : "text";
      const shownValue = isDateType(column) ? toInputDate(value) : isDateTimeType(column) ? toInputDateTime(value) : String(value ?? "");
      control = (
        <input
          data-mant-field="true"
          type={inputType}
          value={shownValue}
          onKeyDown={handleEnter}
          onChange={(e) => updateField(column, e.target.value)}
          disabled={disabled}
          className={base}
          placeholder={isPhoneField(column.name) ? "Solo números" : isNumericType(column) ? "Solo números" : isLettersField(column.name) ? "Solo letras" : label(column.name)}
          maxLength={column.maxLength || undefined}
          inputMode={isPhoneField(column.name) || isNumericType(column) ? "numeric" : undefined}
        />
      );
    }

    return (
      <div key={column.name} className="space-y-1.5">
        <label className="text-xs font-black uppercase tracking-wide text-gray-500">
          {label(column.name)} {column.required && <span className="text-[#FF6A00]">*</span>}
        </label>
        {control}
        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
        {!error && column.ref?.referencedTable && <p className="text-[11px] text-gray-400">Relacionado con {label(column.ref.referencedTable)}</p>}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#0C2D6B]" />
          <p className="mt-4 font-bold text-[#0C2D6B]">Cargando tablas desde MySQL...</p>
        </div>
      </div>
    );
  }

  if (!selectedTable) {
    return (
      <div className="space-y-6 pb-10">
        <section className="rounded-[28px] border border-gray-100 bg-white p-7 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#0C2D6B] text-white shadow-md">
                <Settings className="h-9 w-9" />
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-[0.35em] text-[#FF6A00]">Mantenimiento</p>
                <h1 className="mt-1 text-4xl font-black text-[#0C2D6B]">Mantenimiento del Sistema</h1>
                <p className="mt-2 max-w-4xl text-lg text-gray-500">Administración real de tablas, catálogos, registros y relaciones de GL365 conectada a MySQL.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge tone="blue">Base normalizada</Badge>
                  <Badge tone="green">Datos insertados</Badge>
                  <Badge tone="orange">CRUD completo</Badge>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={refreshAll} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0C2D6B] px-6 py-4 font-black text-white shadow-md transition hover:bg-[#143C8C]">
                <RefreshCw className="h-5 w-5" />
                Actualizar
              </button>
              <button type="button" onClick={exportAllTablesPdf} disabled={exportingPdf} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FF6A00] px-6 py-4 font-black text-white shadow-md transition hover:bg-[#e85f00] disabled:opacity-60">
                {exportingPdf ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
                PDF todos
              </button>
            </div>
          </div>
        </section>

        {notice && (
          <div className={`rounded-2xl border p-4 font-bold ${notice.type === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
            {notice.text}
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Tablas disponibles" value={String(visibleTables.length)} subtitle={`${bootstrap.tables.length} tablas en MySQL`} icon={Table2} color="blue" />
          <StatCard title="Registros insertados" value={String(totalRows)} subtitle="Total cargado desde la BD" icon={Database} color="green" />
          <StatCard title="Relaciones" value={String(totalRelations)} subtitle="Llaves foráneas detectadas" icon={Link2} color="orange" />
          <StatCard title="Catálogos" value={String(totalCatalogs)} subtitle={`Acceso: ${role || "usuario"}`} icon={Shield} color="purple" />
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} placeholder="Buscar tabla por nombre, categoría o descripción..." className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-4 pl-12 pr-4 text-sm outline-none transition focus:border-[#0C2D6B] focus:bg-white focus:ring-4 focus:ring-[#0C2D6B]/10" />
            </div>
            <div className="relative min-w-[240px]">
              <Filter className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full appearance-none rounded-2xl border border-gray-200 bg-gray-50 py-4 pl-12 pr-4 text-sm font-bold text-[#0C2D6B] outline-none transition focus:border-[#0C2D6B] focus:bg-white focus:ring-4 focus:ring-[#0C2D6B]/10">
                <option value="Todas">Todas las categorías</option>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </div>
            <div className="relative min-w-[210px]">
              <ArrowUpDown className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <select value={mainSort} onChange={(e) => setMainSort(e.target.value)} className="w-full appearance-none rounded-2xl border border-gray-200 bg-gray-50 py-4 pl-12 pr-4 text-sm font-bold text-[#0C2D6B] outline-none transition focus:border-[#0C2D6B] focus:bg-white focus:ring-4 focus:ring-[#0C2D6B]/10">
                <option value="category">Ordenar por categoría</option>
                <option value="name">Ordenar por nombre</option>
                <option value="records">Ordenar por registros</option>
              </select>
            </div>
            <button type="button" onClick={() => setMainSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))} className="rounded-2xl border border-gray-200 bg-white px-5 py-4 text-sm font-black text-[#0C2D6B] shadow-sm transition hover:bg-blue-50">
              {mainSortDirection === "asc" ? "Ascendente" : "Descendente"}
            </button>
          </div>
        </section>

        <section className="space-y-8">
          {groupedTables.map((group) => {
            const Icon = CATEGORY_ICONS[group.category] || Table2;
            return (
              <div key={group.category}>
                <div className="mb-4 flex items-center gap-3 border-b border-gray-200 pb-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#0C2D6B]"><Icon className="h-6 w-6" /></div>
                  <div>
                    <h2 className="text-xl font-black text-[#0C2D6B]">{group.category}</h2>
                    <p className="text-sm text-gray-400">{group.tables.length} tabla{group.tables.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {group.tables.map((table) => {
                    const color = COLOR_CLASS[table.color] || COLOR_CLASS.blue;
                    const IconTable = TABLE_ICONS[table.name] || CATEGORY_ICONS[table.category] || Table2;
                    return (
                      <button key={table.name} type="button" onClick={() => setSelectedTable(table)} className="group overflow-hidden rounded-3xl border border-gray-100 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:border-[#0C2D6B] hover:shadow-lg">
                        <div className="p-5">
                          <div className="mb-4 flex items-start justify-between gap-3">
                            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${color.soft} ${color.text} transition group-hover:bg-[#0C2D6B] group-hover:text-white`}><IconTable className="h-6 w-6" /></div>
                            {table.adminOnly && <Badge tone="red">Admin</Badge>}
                          </div>
                          <h3 className="text-lg font-black text-[#0C2D6B] group-hover:text-[#FF6A00]">{table.title}</h3>
                          <p className="mt-2 min-h-[42px] text-sm leading-5 text-gray-500 line-clamp-2">{table.description}</p>
                          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
                            <span className="text-xs font-bold text-gray-400">{table.records} registros</span>
                            <span className="inline-flex items-center gap-1 text-xs font-black text-[#0C2D6B] group-hover:text-[#FF6A00]">Gestionar <ChevronRight className="h-4 w-4" /></span>
                          </div>
                        </div>
                        <div className={`h-1.5 ${color.bar}`} />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    );
  }

  const selectedColor = COLOR_CLASS[selectedTable.color] || COLOR_CLASS.blue;
  const SelectedIcon = TABLE_ICONS[selectedTable.name] || CATEGORY_ICONS[selectedTable.category] || Table2;

  return (
    <div className="space-y-6 pb-10">
      <button type="button" onClick={() => { setSelectedTable(null); setRecords([]); setNotice(null); }} className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#0C2D6B] shadow-sm transition hover:bg-orange-50 hover:text-[#FF6A00]">
        <ArrowLeft className="h-4 w-4" />
        Volver a mantenimiento
      </button>

      <section className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${selectedColor.soft} ${selectedColor.text}`}>
              <SelectedIcon className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.35em] text-[#FF6A00]">{selectedTable.category}</p>
              <h1 className="mt-1 text-3xl font-black text-[#0C2D6B]">{selectedTable.title}</h1>
              <p className="mt-1 text-gray-500">{selectedTable.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="blue">Tabla: {selectedTable.name}</Badge>
                <Badge tone="green">{totalRecords} registros</Badge>
                <Badge tone="orange">{schema?.columns.length || 0} campos</Badge>
                {isAuditTable && <Badge tone="red">Solo consulta automática</Badge>}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => loadRecords(selectedTable.name, tableSearch)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3 font-black text-[#0C2D6B] shadow-sm transition hover:border-[#0C2D6B] hover:bg-blue-50">
              <RefreshCw className={`h-5 w-5 ${tableLoading ? "animate-spin" : ""}`} />
              Actualizar
            </button>
            <button type="button" onClick={exportCurrentTablePdf} disabled={exportingPdf} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-5 py-3 font-black text-[#FF6A00] shadow-sm transition hover:bg-orange-100 disabled:opacity-60">
              {exportingPdf ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
              PDF tabla
            </button>
            {!isAuditTable && (
              <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0C2D6B] px-5 py-3 font-black text-white shadow-md transition hover:bg-[#143C8C]">
                <Plus className="h-5 w-5" />
                {isUserTable ? "Nuevo usuario" : "Nuevo registro"}
              </button>
            )}
          </div>
        </div>
      </section>

      {notice && (
        <div className={`rounded-2xl border p-4 font-bold ${notice.type === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
          {notice.text}
        </div>
      )}

      {isUserTable && (
        <section className="rounded-3xl border border-indigo-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-[#FF6A00]">Control de usuarios</p>
              <h2 className="text-2xl font-black text-[#0C2D6B]">Panel de usuarios del sistema</h2>
              <p className="text-sm text-gray-500">
                Formulario para crear usuarios, modificar accesos, consultar activos y usuarios de baja.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {["Todos", "Activos", "Baja"].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setUserStatusFilter(status)}
                  className={`rounded-2xl px-4 py-2 text-sm font-black shadow-sm transition ${
                    userStatusFilter === status
                      ? "bg-[#0C2D6B] text-white"
                      : "border border-gray-200 bg-white text-[#0C2D6B] hover:bg-blue-50"
                  }`}
                >
                  {status === "Baja" ? "De baja" : status}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Usuarios registrados" value={String(records.length)} subtitle="Total en MySQL" icon={Users} color="blue" />
            <StatCard title="Usuarios activos" value={String(usuariosActivos)} subtitle="Acceso habilitado" icon={UserCheck} color="green" />
            <StatCard title="Usuarios de baja" value={String(usuariosBaja)} subtitle="Inactivos o deshabilitados" icon={UserX} color="red" />
            <StatCard title="Roles vinculados" value={String(rolesDetectados)} subtitle="Roles detectados" icon={Shield} color="purple" />
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-gray-100 bg-white shadow-sm">
        <div className="space-y-3 border-b border-gray-100 p-4">
          {isAuditTable && (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-700">
              Auditoría es automática: cada vez que un usuario crea, edita o elimina registros desde Mantenimiento, el sistema guarda aquí la acción realizada.
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(220px,320px)_minmax(360px,1fr)_auto] xl:items-center">
            <select
              value={columnFilter}
              onChange={(e) => setColumnFilter(e.target.value)}
              className="rounded-2xl border border-gray-200 bg-white px-4 py-4 text-sm font-bold text-[#0C2D6B] outline-none shadow-sm transition focus:border-[#0C2D6B] focus:ring-4 focus:ring-[#0C2D6B]/10"
              title="Seleccioná en qué campo querés buscar"
            >
              {isUserTable ? (
                userFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))
              ) : (
                <>
                  <option value="Todas">Buscar en todos los campos</option>
                  {filterableColumns.map((column) => <option key={column.name} value={column.name}>{label(column.name)}</option>)}
                </>
              )}
            </select>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder={tableSearchPlaceholder}
                className="w-full rounded-2xl border border-gray-200 bg-white py-4 pl-12 pr-4 text-sm outline-none shadow-sm transition focus:border-[#0C2D6B] focus:ring-4 focus:ring-[#0C2D6B]/10"
              />
            </div>

            <div className="flex items-center justify-center gap-2 rounded-2xl bg-slate-50 px-4 py-4 text-sm font-bold text-gray-500">
              <Database className="h-4 w-4" />
              Datos reales de MySQL
            </div>
          </div>

          {!isUserTable && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_minmax(220px,280px)]">
              <select
                value={activeSortColumn}
                onChange={(e) => {
                  setSortColumn(e.target.value);
                  setSortDirection("asc");
                }}
                className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-[#0C2D6B] outline-none shadow-sm transition focus:border-[#0C2D6B] focus:ring-4 focus:ring-[#0C2D6B]/10"
              >
                {columnsToShow.map((column) => <option key={column.name} value={column.name}>{label(column.name)}</option>)}
              </select>

              <button
                type="button"
                onClick={toggleSortDirection}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#BFD3F2] bg-blue-50 px-4 py-3 text-sm font-black text-[#0C2D6B] shadow-sm transition hover:border-[#0C2D6B] hover:bg-blue-100"
                title={`Orden actual: ${label(activeSortColumn || "campo")} ${sortDirection === "asc" ? "ascendente" : "descendente"}`}
              >
                <ArrowUpDown className="h-4 w-4" />
                {sortDirection === "asc" ? "Ascendente" : "Descendente"}
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-gray-400">
            <span>
              {displayedRecords.length} de {records.length} registros visibles
              {isUserTable && userStatusFilter !== "Todos" ? ` · Filtro: ${userStatusFilter === "Baja" ? "usuarios de baja" : "usuarios activos"}` : ""}
              {tableSearch ? ` · Buscando en: ${selectedFilterLabel}.` : ""}
              {isUserTable ? " · Ordená tocando los encabezados de la tabla." : ""}
            </span>
            {(tableSearch || columnFilter !== "Todas" || sortColumn || sortDirection !== "asc" || userStatusFilter !== "Todos") && (
              <button
                type="button"
                onClick={() => {
                  clearTableFilters();
                  setUserStatusFilter("Todos");
                }}
                className="rounded-full bg-orange-50 px-3 py-1 text-[#FF6A00]"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-[#0C2D6B]">
              <tr>
                {tableColumnsToShow.map((column) => (
                  <th key={column.name} className="px-5 py-4 font-black">
                    <button type="button" onClick={() => toggleSort(column.name)} className="inline-flex items-center gap-1.5 text-left transition hover:text-[#FF6A00]">
                      {label(column.name)}
                      <ArrowUpDown className={`h-3.5 w-3.5 ${activeSortColumn === column.name ? "text-[#FF6A00]" : "text-gray-300"}`} />
                      {activeSortColumn === column.name && <span className="text-[10px] text-[#FF6A00]">{sortDirection === "asc" ? "↑" : "↓"}</span>}
                    </button>
                  </th>
                ))}
                <th className="px-5 py-4 text-right font-black">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tableLoading ? (
                <tr><td colSpan={tableColumnsToShow.length + 1} className="px-5 py-16 text-center text-gray-500"><Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-[#0C2D6B]" />Cargando registros...</td></tr>
              ) : displayedRecords.length ? (
                paginatedRecords.map((row) => (
                  <tr key={String(row[primaryKey])} className="align-top transition hover:bg-blue-50/40">
                    {tableColumnsToShow.map((column) => (
                      <td key={column.name} className="max-w-[300px] px-5 py-4 font-medium text-gray-800">
                        {renderTableCell(row, column)}
                      </td>
                    ))}
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <IconButton title="Ver" icon={Eye} tone="blue" onClick={() => openView(row)} />
                        {!isAuditTable && (
                          <>
                            <IconButton title="Editar" icon={Pencil} tone="orange" onClick={() => openEdit(row)} />
                            <IconButton title="Eliminar" icon={Trash2} tone="red" onClick={() => { setDeleteRow(row); setDeleteError(""); }} />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={tableColumnsToShow.length + 1} className="px-5 py-16 text-center text-gray-500">
                    <Table2 className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                    No se encontraron registros con los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {displayedRecords.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div className="text-sm font-bold text-gray-500">
              Página {safeCurrentPage} de {totalPages} · Mostrando {paginatedRecords.length} de {displayedRecords.length} registros filtrados.
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-[#0C2D6B] shadow-sm outline-none"
              >
                {[5, 10, 15, 25, 50].map((size) => (
                  <option key={size} value={size}>{size} por página</option>
                ))}
              </select>

              <button type="button" onClick={() => setCurrentPage(1)} disabled={safeCurrentPage <= 1} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-black text-[#0C2D6B] shadow-sm disabled:opacity-40">Primera</button>
              <button type="button" onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={safeCurrentPage <= 1} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-black text-[#0C2D6B] shadow-sm disabled:opacity-40">Anterior</button>
              <button type="button" onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} disabled={safeCurrentPage >= totalPages} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-black text-[#0C2D6B] shadow-sm disabled:opacity-40">Siguiente</button>
              <button type="button" onClick={() => setCurrentPage(totalPages)} disabled={safeCurrentPage >= totalPages} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-black text-[#0C2D6B] shadow-sm disabled:opacity-40">Última</button>
            </div>
          </div>
        )}
      </section>

      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-100 bg-white p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-[#FF6A00]">{selectedTable.title}</p>
                <h2 className="mt-1 text-2xl font-black text-[#0C2D6B]">
                  {isUserTable
                    ? modalMode === "create"
                      ? "Crear usuario"
                      : modalMode === "edit"
                      ? "Modificar usuario"
                      : "Ficha del usuario"
                    : modalMode === "create"
                    ? "Nuevo registro"
                    : modalMode === "edit"
                    ? "Editar registro"
                    : "Detalle del registro"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {isUserTable
                    ? modalMode === "view"
                      ? "Ficha completa del usuario, rol, estado, correo y datos de acceso."
                      : "Formulario principal para crear o modificar usuarios. Enter avanza al siguiente campo."
                    : modalMode === "view"
                    ? "Consulta completa del registro seleccionado."
                    : "Completá los campos requeridos. Enter avanza al siguiente campo."}
                </p>
              </div>
              <button type="button" onClick={closeModal} className="rounded-2xl bg-gray-100 p-3 text-gray-500 transition hover:bg-red-50 hover:text-red-600"><X className="h-6 w-6" /></button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              {modalMode === "view" ? (
                <div className="space-y-5">
                  {isUserTable && (
                    <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-blue-50 to-white p-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0C2D6B] text-white">
                            <Users className="h-8 w-8" />
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.3em] text-[#FF6A00]">Ficha del usuario</p>
                            <h3 className="text-2xl font-black text-[#0C2D6B]">{userFullName(form)}</h3>
                            <p className="text-sm font-semibold text-gray-500">{form.email || form.correo || form.nombre_usuario || "Sin correo registrado"}</p>
                          </div>
                        </div>

                        <span className={`rounded-full px-4 py-2 text-sm font-black ${
                          isUserActive(form) ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}>
                          {isUserActive(form) ? "Usuario activo" : "Usuario de baja"}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {viewColumns.map((column) => (
                      <div key={column.name} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                        <p className="text-xs font-black uppercase tracking-wide text-gray-400">{label(column.name)}</p>
                        <div className="mt-2 break-words text-base font-bold text-gray-800">{formatCell(form, column, bootstrap.options)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {formColumns.map((column) => renderField(column, modalMode))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50 p-5 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeModal} className="rounded-2xl border border-gray-200 bg-white px-6 py-3 font-black text-gray-600 shadow-sm transition hover:bg-gray-100">
                {modalMode === "view" ? "Cerrar" : "Cancelar"}
              </button>
              {modalMode === "view" ? (
                !isAuditTable && (
                  <button type="button" onClick={() => setModalMode("edit")} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FF6A00] px-6 py-3 font-black text-white shadow-md transition hover:bg-[#e85f00]"><Pencil className="h-5 w-5" />{isUserTable ? "Modificar usuario" : "Editar"}</button>
                )
              ) : (
                <button type="button" onClick={saveRecord} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0C2D6B] px-6 py-3 font-black text-white shadow-md transition hover:bg-[#143C8C]"><Save className="h-5 w-5" />Guardar</button>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="bg-red-50 p-6 text-red-700">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-red-600"><AlertTriangle className="h-7 w-7" /></div>
                <div>
                  <h3 className="text-xl font-black">Eliminar registro</h3>
                  <p className="text-sm text-red-500">Esta acción eliminará el registro de MySQL si no tiene relaciones.</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <p className="text-gray-600">¿Eliminar este registro?</p>
              <p className="mt-2 rounded-2xl bg-gray-50 p-4 font-black text-[#0C2D6B]">{getRowTitle(selectedTable.name, deleteRow)}</p>
              {deleteError && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{deleteError}</div>}
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 p-5">
              <button type="button" onClick={() => setDeleteRow(null)} className="rounded-2xl border border-gray-200 bg-white px-6 py-3 font-black text-gray-600 shadow-sm transition hover:bg-gray-100">Cancelar</button>
              <button type="button" onClick={confirmDelete} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-6 py-3 font-black text-white shadow-md transition hover:bg-red-700"><Trash2 className="h-5 w-5" />Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Mantenimiento;