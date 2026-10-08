import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import type { DragEvent, KeyboardEvent, ReactNode } from "react";
import {
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  TrendingUp,
  Target,
  DollarSign,
  GripVertical,
  X,
  FileText,
  Download,
  RefreshCw,
  Users,
  CheckCircle,
  Send,
  Phone,
  UserPlus,
  UserX,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Building2,
  Star,
  Save,
  Route,
} from "lucide-react";
import { generarPDFCotizacion } from "../services/pdfGenerator";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import logoEmpresa from "../../assets/614cb11181e5d72cb3a39a09d833f4775b7fc7ce.png";

// ============================================================
// CRM GL365 - PROTOTIPO FIGMA ALINEADO A LA BD NORMALIZADA
// ============================================================
// Tablas representadas:
// - clientes
// - estados_cliente
// - contactos_cliente
// - telefonos_contacto
// - oportunidades
// - estados_oportunidad
// - usuarios
// - modalidades
// - cotizaciones
// - cotizacion_detalle
// - formas_pago
// - ubicaciones
//
// NOTA IMPORTANTE:
// La tabla física actual todavía no incluye todos los campos visuales
// del documento comercial. Las relaciones y detalles se guardan por API/MySQL
// y los campos UI faltantes se conservan por código de cotización para que
// peso, volumen, estado, moneda, fecha, observaciones y días no se pierdan
// después de recargar la pantalla.
// ============================================================

type Stage = "prospecto" | "cotizado" | "negociacion" | "ganado" | "perdido";
type QuoteStatus = "Borrador" | "Enviada" | "Aprobada";
type ClientStatus = "Activo" | "Inactivo";
type ModalMode = "create" | "edit" | "view";
type CrmSortDirection = "asc" | "desc";

type FieldErrors = Record<string, string>;

interface ClienteRow {
  id: number;
  codigo_cliente: string;
  nombre_empresa: string;
  nit: string;
  direccion: string;
  estado_cliente_id: number;
  motivo_inactivacion?: string | null;
  fecha_inactivacion?: string | null;
  created_at: string;
  updated_at: string;
  // Campo de presentación equivalente a JOIN con estados_cliente.
  nombre_estado_cliente?: string;

  // Se utilizan en Crear / Editar para administrar
  // el contacto principal desde el mismo formulario del cliente.
  contacto_primer_nombre?: string;
  contacto_segundo_nombre?: string;
  contacto_primer_apellido?: string;
  contacto_segundo_apellido?: string;
  contacto_cargo?: string;
  contacto_correo?: string;
  contacto_prefijo_telefonico_id?: number | null;
  contacto_telefono?: string;
  contacto_tipo_telefono?:
    | "Oficina"
    | "Móvil"
    | "WhatsApp"
    | "Emergencia"
    | "Otro";
}

interface ContactoClienteRow {
  id: number;
  cliente_id: number;
  primer_nombre: string;
  segundo_nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  cargo: string;
  correo: string;
  es_principal: boolean;
  estado: boolean;
  created_at: string;
  updated_at: string;
}

interface TelefonoContactoRow {
  id: number;
  contacto_id: number;
  prefijo_telefonico_id?: number | null;
  telefono: string;
  tipo_telefono: string;
  es_principal: boolean;
  prefijo?: string | null;
  codigo_pais?: string | null;
  telefono_completo?: string | null;
}

interface PrefijoTelefonicoRow {
  id: number;
  codigo_pais: string;
  pais: string;
  prefijo: string;
  ejemplo?: string | null;
  activo?: boolean | number;
}

interface UsuarioRow {
  id: number;
  activo: boolean;
  primer_nombre: string;
  segundo_nombre: string | null;
  primer_apellido: string;
  segundo_apellido: string | null;
  nombre_usuario: string;
  email: string;
  rol_id: number;
}

interface RolRow {
  id: number;
  codigo_rol: string;
  nombre_rol: string;
}

interface ModalidadRow {
  id: number;
  codigo_modalidad: string;
  nombre_modalidad: string;
}

interface FormaPagoRow {
  id: number;
  codigo_forma_pago: string;
  nombre_forma_pago: string;
}

interface UbicacionRow {
  id: number;
  codigo_ubicacion: string;
  nombre_ubicacion: string;
  pais: string;
}

interface OportunidadRow {
  id: number;
  codigo_oportunidad: string;
  cliente_id: number | null;
  ejecutivo_id: number | null;
  modalidad_id: number | null;
  estado_id: number;
  nombre_oportunidad: string;
  monto_estimado: number;
  probabilidad: number;
  fecha_creacion: string;
  fecha_cierre_estimada: string;
  created_at: string;
  updated_at: string;
}

interface CotizacionRow {
  id: number;
  codigo_cotizacion: string;
  cliente_id: number | null;
  contacto_id: number | null;
  ejecutivo_id: number | null;
  modalidad_id: number | null;
  forma_pago_id: number | null;
  origen_id: number | null;
  destino_id: number | null;

  // Metadata visual del prototipo (no pertenece a la tabla física actual).
  fecha_ui: string;
  estado_ui: QuoteStatus;
  moneda_ui: "USD" | "GTQ";
  tipo_carga_ui: string;
  peso_ui: string;
  volumen_ui: string;
  observaciones_ui: string;

  // Condiciones comerciales editables de esta cotización.
  no_incluye_ui: string[];
  notas_importantes_ui: string[];
}

interface CotizacionDetalleRow {
  id: number;
  cotizacion_id: number;
  descripcion: string;
  // En el formulario estos valores también pueden ser "" temporalmente.
  // Eso permite borrar el contenido y escribir otro número sin que React
  // vuelva a colocar 1 o 0 en cada pulsación.
  cantidad: number | string;
  precio_unitario: number | string;
  dias_ui: number | string;
}

interface LeadView {
  id: number;
  code: string;
  clientId: number | null;
  clientName: string;
  opportunityName: string;
  modalityId: number | null;
  type: string;
  executiveId: number | null;
  executive: string;
  date: string;
  closeDate: string;
  probability: number;
  amount: number;
  stage: Stage;
}

interface QuoteView {
  id: number;
  quoteNumber: string;
  clientId: number | null;
  clientName: string;
  nit: string;
  contactId: number | null;
  contact: string;
  email: string;
  executiveId: number | null;
  executive: string;
  modalityId: number | null;
  modality: string;
  paymentMethodId: number | null;
  paymentMethod: string;
  originId: number | null;
  origin: string;
  destinationId: number | null;
  destination: string;
  date: string;
  status: QuoteStatus;
  currency: "USD" | "GTQ";
  cargoType: string;
  weight: string;
  volume: string;
  observations: string;
  noIncluye: string[];
  notasImportantes: string[];
  services: QuoteServiceView[];
  subtotal: number;
  iva: number;
  total: number;
}

interface QuoteServiceView {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  days: number;
}


type ProviderLevel = "Verde" | "Amarillo" | "Rojo";
type ProviderSat = "vigente" | "no_vigente" | "pendiente";

interface ProviderRow {
  id: number;
  codigo_proveedor: string;
  razon_social: string;
  nombre_comercial?: string | null;
  nit: string;
  estado_id: number;
  correo?: string | null;
  telefono?: string | null;
  estado?: string;
  nombre_estado_proveedor?: string;
  servicio_principal?: string;
  desempeno?: ProviderLevel;
  estado_sat?: ProviderSat;
}

interface ProviderContactRow {
  id: number;
  proveedor_id: number;
  primer_nombre: string;
  segundo_nombre?: string | null;
  primer_apellido: string;
  segundo_apellido?: string | null;
  cargo?: string | null;
  correo?: string | null;
  telefono?: string | null;
  es_principal: boolean;
  estado: boolean;
}

interface ProviderServiceRow {
  id: number;
  codigo_servicio: string;
  es_principal: boolean;
  nombre_servicio_proveedor: string;
  proveedor_id: number;
}

interface ProviderComplianceRow {
  id?: number;
  proveedor_id?: number;
  estado_sat: ProviderSat;
  lista_clinton: boolean;
  rtu_validado: boolean;
  licencia_validada: boolean;
  cuenta_validada: boolean;
}

interface ProviderPerformanceRow {
  id?: number;
  proveedor_id?: number;
  nivel: ProviderLevel;
  historial?: string | null;
  hallazgos?: string | null;
  fecha?: string | null;
}

interface CrmRouteRow {
  id: number;
  codigo_ruta: string;
  nombre_ruta: string;
  origen_id: number;
  destino_id: number;
  distancia_km?: number | null;
  origen?: string;
  destino?: string;
  pais_origen?: string;
  pais_destino?: string;
}

// ============================================================
// STORAGE KEYS
// ============================================================

const K = {
  clientes: "clientes",
  contactos: "contactos_cliente",
  telefonos: "telefonos_contacto",
  oportunidades: "oportunidades",
  cotizaciones: "cotizaciones",
  cotizacionDetalle: "cotizacion_detalle",
  modalidades: "modalidades",
  formasPago: "formas_pago",
  ubicaciones: "ubicaciones",
  roles: "gl365_roles_normalizado",
  usuarios: "gl365_usuarios_normalizado",
  seedVersion: "gl365_crm_seed_version_20260816_v8",
  quoteUiMeta: "gl365_cotizacion_ui_metadata_v1",
};

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_URL || "/api";

async function apiRequestCRM(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    cache: "no-store",
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.message || data?.error || `No se pudo procesar ${path}`);
  }

  return data?.data || data;
}

async function apiSendCRM(path: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: any) {
  return apiRequestCRM(path, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}


// ============================================================
// CATÁLOGOS / DATOS DE DEMOSTRACIÓN


// ============================================================
// CATÁLOGOS / DATOS DE DEMOSTRACIÓN
// ============================================================

const MODALIDADES_DEFAULT: ModalidadRow[] = [
  { id: 1, codigo_modalidad: "FTL", nombre_modalidad: "FTL" },
  { id: 2, codigo_modalidad: "LTL", nombre_modalidad: "LTL" },
  { id: 3, codigo_modalidad: "FCL", nombre_modalidad: "FCL" },
  { id: 4, codigo_modalidad: "LCL", nombre_modalidad: "LCL" },
  { id: 5, codigo_modalidad: "MAR", nombre_modalidad: "Marítimo" },
  { id: 6, codigo_modalidad: "AER", nombre_modalidad: "Aéreo" },
  { id: 7, codigo_modalidad: "ADU", nombre_modalidad: "Aduanas" },
  { id: 8, codigo_modalidad: "ALM", nombre_modalidad: "Almacenaje" },
];

const FORMAS_PAGO_DEFAULT: FormaPagoRow[] = [
  { id: 1, codigo_forma_pago: "CON", nombre_forma_pago: "CONTADO" },
  { id: 2, codigo_forma_pago: "CR15", nombre_forma_pago: "15 DÍAS" },
  { id: 3, codigo_forma_pago: "CR30", nombre_forma_pago: "30 DÍAS" },
];


const QUOTE_NO_INCLUYE_DEFAULT = [
  "Maniobras (carga y descarga)",
  "Seguro de cargas",
  "Custodios y/o patrullas para unidades en modalidad FTL (cotizado por aparte)",
  "Estadías",
  "Selectivos rojos",
  "Gastos por cuenta ajena",
];

const QUOTE_NOTAS_IMPORTANTES_DEFAULT = [
  "Cotización basada en datos proporcionados.",
  "Para movimientos locales deberán reservar las unidades con 24 Hrs de anticipación.",
  "En temporada alta las unidades deberán ser reservadas con un promedio de 48 Hrs antes del posicionamiento.",
  "Logistics Group 365 no asume penalizaciones por atrasos, conflictos sociales, clima, etc.",
  "Todo movimiento en falso se cobrará el flete.",
  "Los custodios se cotizan por evento dependiendo la ruta.",
];

const UBICACIONES_DEFAULT: UbicacionRow[] = [
  { id: 1, codigo_ubicacion: "GUA", nombre_ubicacion: "Ciudad de Guatemala", pais: "Guatemala" },
  { id: 2, codigo_ubicacion: "VNO", nombre_ubicacion: "Villa Nueva", pais: "Guatemala" },
  { id: 3, codigo_ubicacion: "XEL", nombre_ubicacion: "Quetzaltenango", pais: "Guatemala" },
  { id: 4, codigo_ubicacion: "ESC", nombre_ubicacion: "Escuintla", pais: "Guatemala" },
  { id: 5, codigo_ubicacion: "PBR", nombre_ubicacion: "Puerto Barrios", pais: "Guatemala" },
  { id: 6, codigo_ubicacion: "SAL", nombre_ubicacion: "San Salvador", pais: "El Salvador" },
  { id: 7, codigo_ubicacion: "MGA", nombre_ubicacion: "Managua", pais: "Nicaragua" },
  { id: 8, codigo_ubicacion: "TGU", nombre_ubicacion: "Tegucigalpa", pais: "Honduras" },
];

const PREFIJOS_DEFAULT: PrefijoTelefonicoRow[] = [
  { id: 1, codigo_pais: "GT", pais: "Guatemala", prefijo: "+502", ejemplo: "+502 5555-5555", activo: true },
  { id: 2, codigo_pais: "MX", pais: "México", prefijo: "+52", ejemplo: "+52 55 5555-5555", activo: true },
  { id: 3, codigo_pais: "US", pais: "Estados Unidos", prefijo: "+1", ejemplo: "+1 305 555-0188", activo: true },
  { id: 4, codigo_pais: "SV", pais: "El Salvador", prefijo: "+503", ejemplo: "+503 2222-2222", activo: true },
  { id: 5, codigo_pais: "HN", pais: "Honduras", prefijo: "+504", ejemplo: "+504 9999-9999", activo: true },
  { id: 6, codigo_pais: "NI", pais: "Nicaragua", prefijo: "+505", ejemplo: "+505 8888-8888", activo: true },
  { id: 7, codigo_pais: "CR", pais: "Costa Rica", prefijo: "+506", ejemplo: "+506 8888-8888", activo: true },
  { id: 8, codigo_pais: "PA", pais: "Panamá", prefijo: "+507", ejemplo: "+507 6000-0000", activo: true },
  { id: 9, codigo_pais: "BZ", pais: "Belice", prefijo: "+501", ejemplo: "+501 600-0000", activo: true },
];

const PHONE_DIGITS_BY_COUNTRY: Record<string, number> = {
  GT: 8, MX: 10, US: 10, SV: 8, HN: 8, NI: 8, CR: 8, PA: 8, BZ: 7,
};

const ROLES_DEFAULT: RolRow[] = [
  { id: 1, codigo_rol: "gerencia", nombre_rol: "Gerencia" },
  { id: 2, codigo_rol: "finanzas", nombre_rol: "Finanzas" },
  { id: 3, codigo_rol: "ventas", nombre_rol: "Ventas" },
  { id: 4, codigo_rol: "operaciones", nombre_rol: "Operaciones" },
  { id: 5, codigo_rol: "logistica", nombre_rol: "Logística" },
  { id: 6, codigo_rol: "facturacion", nombre_rol: "Facturación" },
  { id: 7, codigo_rol: "compras", nombre_rol: "Compras" },
  { id: 8, codigo_rol: "mensajeria", nombre_rol: "Mensajería" },
];

const USUARIOS_FALLBACK: UsuarioRow[] = [
  { id: 1, activo: true, primer_nombre: "Enma", segundo_nombre: null, primer_apellido: "García", segundo_apellido: "Bachez", nombre_usuario: "gerencia", email: "gerencia@gl365.com", rol_id: 1 },
  { id: 2, activo: true, primer_nombre: "Lidia", segundo_nombre: "María", primer_apellido: "Morales", segundo_apellido: "Pérez", nombre_usuario: "finanzas", email: "finanzas@gl365.com", rol_id: 2 },
  { id: 3, activo: true, primer_nombre: "Melissa", segundo_nombre: "Alejandra", primer_apellido: "López", segundo_apellido: "Ruiz", nombre_usuario: "ventas", email: "ventas@gl365.com", rol_id: 3 },
  { id: 4, activo: true, primer_nombre: "Gaby", segundo_nombre: "María", primer_apellido: "Ramírez", segundo_apellido: "López", nombre_usuario: "gaby.ventas", email: "gaby@gl365.com", rol_id: 3 },
  { id: 5, activo: true, primer_nombre: "Germán", segundo_nombre: "Antonio", primer_apellido: "Méndez", segundo_apellido: "García", nombre_usuario: "operaciones", email: "operaciones@gl365.com", rol_id: 4 },
  { id: 6, activo: true, primer_nombre: "Kevin", segundo_nombre: "Eduardo", primer_apellido: "López", segundo_apellido: "Castillo", nombre_usuario: "logistica", email: "logistica@gl365.com", rol_id: 5 },
  { id: 7, activo: true, primer_nombre: "Héctor", segundo_nombre: "Manuel", primer_apellido: "Pérez", segundo_apellido: "Díaz", nombre_usuario: "facturacion", email: "comprobante@gl365.com", rol_id: 6 },
];

const CLIENTES_DEFAULT: ClienteRow[] = [
  { id: 1, codigo_cliente: "CLI-001", nombre_empresa: "Empacadora de Alimentos Mejorados, S.A.", nit: "101778953", direccion: "14 Avenida 08-50, Zona 8, San Cristóbal, Mixco", estado_cliente_id: 1, created_at: "2026-03-01T10:00:00.000Z", updated_at: "2026-03-01T10:00:00.000Z", nombre_estado_cliente: "Activo" },
  { id: 2, codigo_cliente: "CLI-002", nombre_empresa: "Empaques & Aislamientos, S.A.", nit: "93421389", direccion: "12 Avenida A 16-90, Zona 2, Ciudad de Guatemala", estado_cliente_id: 1, created_at: "2026-03-02T10:00:00.000Z", updated_at: "2026-03-02T10:00:00.000Z", nombre_estado_cliente: "Activo" },
  { id: 3, codigo_cliente: "CLI-003", nombre_empresa: "Distribuidora Maya del Norte, S.A.", nit: "5487963-2", direccion: "5a Avenida 3-42, Zona 1, Cobán, Alta Verapaz", estado_cliente_id: 1, created_at: "2026-03-03T10:00:00.000Z", updated_at: "2026-03-03T10:00:00.000Z", nombre_estado_cliente: "Activo" },
  { id: 4, codigo_cliente: "CLI-004", nombre_empresa: "Comercializadora Los Volcanes, S.A.", nit: "7845129-6", direccion: "Km 54.5 Carretera Interamericana, Chimaltenango", estado_cliente_id: 1, created_at: "2026-03-04T10:00:00.000Z", updated_at: "2026-03-04T10:00:00.000Z", nombre_estado_cliente: "Activo" },
  { id: 5, codigo_cliente: "CLI-005", nombre_empresa: "Global Tech de Nicaragua, S.A.", nit: "J031000289000", direccion: "Ofibodegas Fernández, Carretera Norte, Managua, Nicaragua", estado_cliente_id: 1, created_at: "2026-03-05T10:00:00.000Z", updated_at: "2026-03-05T10:00:00.000Z", nombre_estado_cliente: "Activo" },
  { id: 6, codigo_cliente: "CLI-006", nombre_empresa: "Agroindustrias del Pacífico, S.A.", nit: "6321457-8", direccion: "Km 92 Carretera a Puerto San José, Escuintla", estado_cliente_id: 1, created_at: "2026-03-06T10:00:00.000Z", updated_at: "2026-03-06T10:00:00.000Z", nombre_estado_cliente: "Activo" },
  { id: 7, codigo_cliente: "CLI-007", nombre_empresa: "Textiles Centroamericanos, S.A.", nit: "4512876-4", direccion: "Calzada Roosevelt 12-45, Zona 11, Ciudad de Guatemala", estado_cliente_id: 1, created_at: "2026-03-07T10:00:00.000Z", updated_at: "2026-03-07T10:00:00.000Z", nombre_estado_cliente: "Activo" },
  { id: 8, codigo_cliente: "CLI-008", nombre_empresa: "Importadora San Miguel, S.A.", nit: "7125489-1", direccion: "18 Calle 4-75, Zona 10, Ciudad de Guatemala", estado_cliente_id: 2, created_at: "2026-03-08T10:00:00.000Z", updated_at: "2026-03-08T10:00:00.000Z", nombre_estado_cliente: "Inactivo" },
];

const CONTACTOS_DEFAULT: ContactoClienteRow[] = [
  { id: 1, cliente_id: 1, primer_nombre: "Edgar", segundo_nombre: "Alejandro", primer_apellido: "España", segundo_apellido: "López", cargo: "Representante Legal", correo: "edgar.espana@alimentosmejorados.com.gt", es_principal: true, estado: true, created_at: "2026-03-01T10:00:00.000Z", updated_at: "2026-03-01T10:00:00.000Z" },
  { id: 2, cliente_id: 1, primer_nombre: "Lucía", segundo_nombre: "María", primer_apellido: "Fuentes", segundo_apellido: "López", cargo: "Encargada de Logística", correo: "lucia.fuentes@alimentosmejorados.com.gt", es_principal: false, estado: true, created_at: "2026-03-01T11:00:00.000Z", updated_at: "2026-03-01T11:00:00.000Z" },
  { id: 3, cliente_id: 2, primer_nombre: "Marines", segundo_nombre: "Alejandra", primer_apellido: "Reyes", segundo_apellido: "García", cargo: "Coordinadora de Operaciones", correo: "marines.reyes@empaquesaislamientos.com.gt", es_principal: true, estado: true, created_at: "2026-03-02T10:00:00.000Z", updated_at: "2026-03-02T10:00:00.000Z" },
  { id: 4, cliente_id: 3, primer_nombre: "Carlos", segundo_nombre: "Eduardo", primer_apellido: "Méndez", segundo_apellido: "Caal", cargo: "Gerente de Compras", correo: "carlos.mendez@distribuidoramaya.com.gt", es_principal: true, estado: true, created_at: "2026-03-03T10:00:00.000Z", updated_at: "2026-03-03T10:00:00.000Z" },
  { id: 5, cliente_id: 4, primer_nombre: "Andrea", segundo_nombre: "Sofía", primer_apellido: "López", segundo_apellido: "Pérez", cargo: "Jefa de Abastecimiento", correo: "andrea.lopez@losvolcanes.com.gt", es_principal: true, estado: true, created_at: "2026-03-04T10:00:00.000Z", updated_at: "2026-03-04T10:00:00.000Z" },
  { id: 6, cliente_id: 5, primer_nombre: "Jorge", segundo_nombre: "Luis", primer_apellido: "Gómez", segundo_apellido: "Martínez", cargo: "Ejecutivo de Compras", correo: "jorge.gomez@globaltechnicaragua.com", es_principal: true, estado: true, created_at: "2026-03-05T10:00:00.000Z", updated_at: "2026-03-05T10:00:00.000Z" },
  { id: 7, cliente_id: 6, primer_nombre: "Paola", segundo_nombre: "Fernanda", primer_apellido: "Castillo", segundo_apellido: "Ruiz", cargo: "Coordinadora de Importaciones", correo: "paola.castillo@agropacifico.com.gt", es_principal: true, estado: true, created_at: "2026-03-06T10:00:00.000Z", updated_at: "2026-03-06T10:00:00.000Z" },
  { id: 8, cliente_id: 7, primer_nombre: "José", segundo_nombre: "Miguel", primer_apellido: "Ramírez", segundo_apellido: "Santos", cargo: "Director de Logística", correo: "jose.ramirez@textilesca.com.gt", es_principal: true, estado: true, created_at: "2026-03-07T10:00:00.000Z", updated_at: "2026-03-07T10:00:00.000Z" },
  { id: 9, cliente_id: 7, primer_nombre: "María", segundo_nombre: "Fernanda", primer_apellido: "Alvarado", segundo_apellido: "Díaz", cargo: "Analista de Compras", correo: "maria.alvarado@textilesca.com.gt", es_principal: false, estado: true, created_at: "2026-03-07T11:00:00.000Z", updated_at: "2026-03-07T11:00:00.000Z" },
  { id: 10, cliente_id: 8, primer_nombre: "Roberto", segundo_nombre: "Antonio", primer_apellido: "Sánchez", segundo_apellido: "Lemus", cargo: "Gerente General", correo: "roberto.sanchez@importadorasanmiguel.com.gt", es_principal: true, estado: true, created_at: "2026-03-08T10:00:00.000Z", updated_at: "2026-03-08T10:00:00.000Z" },
];

const TELEFONOS_DEFAULT: TelefonoContactoRow[] = [
  { id: 1, contacto_id: 1, telefono: "2505-5300", tipo_telefono: "Oficina", es_principal: true },
  { id: 2, contacto_id: 1, telefono: "4808-7827", tipo_telefono: "Móvil", es_principal: false },
  { id: 3, contacto_id: 2, telefono: "5558-2471", tipo_telefono: "WhatsApp", es_principal: true },
  { id: 4, contacto_id: 3, telefono: "2426-1700", tipo_telefono: "Oficina", es_principal: true },
  { id: 5, contacto_id: 4, telefono: "7951-4432", tipo_telefono: "Oficina", es_principal: true },
  { id: 6, contacto_id: 5, telefono: "5632-8914", tipo_telefono: "Móvil", es_principal: true },
  { id: 7, contacto_id: 6, telefono: "+505 8703-5335", tipo_telefono: "WhatsApp", es_principal: true },
  { id: 8, contacto_id: 7, telefono: "7889-2145", tipo_telefono: "Móvil", es_principal: true },
  { id: 9, contacto_id: 8, telefono: "2298-6041", tipo_telefono: "Oficina", es_principal: true },
  { id: 10, contacto_id: 9, telefono: "5412-8860", tipo_telefono: "WhatsApp", es_principal: true },
  { id: 11, contacto_id: 10, telefono: "2368-1120", tipo_telefono: "Oficina", es_principal: true },
];

const OPORTUNIDADES_DEFAULT: OportunidadRow[] = [
  { id: 1, codigo_oportunidad: "OPO-001", cliente_id: 1, ejecutivo_id: 3, modalidad_id: 1, estado_id: 1, nombre_oportunidad: "Distribución nacional de alimentos", monto_estimado: 45000, probabilidad: 25, fecha_creacion: "2026-03-15", fecha_cierre_estimada: "2026-04-15", created_at: "2026-03-15T10:00:00.000Z", updated_at: "2026-03-15T10:00:00.000Z" },
  { id: 2, codigo_oportunidad: "OPO-002", cliente_id: 2, ejecutivo_id: 4, modalidad_id: 5, estado_id: 2, nombre_oportunidad: "Importación marítima de materia prima", monto_estimado: 120000, probabilidad: 45, fecha_creacion: "2026-03-16", fecha_cierre_estimada: "2026-04-30", created_at: "2026-03-16T10:00:00.000Z", updated_at: "2026-03-16T10:00:00.000Z" },
  { id: 3, codigo_oportunidad: "OPO-003", cliente_id: 3, ejecutivo_id: 3, modalidad_id: 2, estado_id: 3, nombre_oportunidad: "Distribución LTL Cobán - Guatemala", monto_estimado: 38500, probabilidad: 70, fecha_creacion: "2026-03-18", fecha_cierre_estimada: "2026-04-10", created_at: "2026-03-18T10:00:00.000Z", updated_at: "2026-03-18T10:00:00.000Z" },
  { id: 4, codigo_oportunidad: "OPO-004", cliente_id: 5, ejecutivo_id: 1, modalidad_id: 6, estado_id: 4, nombre_oportunidad: "Importación aérea de equipo tecnológico", monto_estimado: 89000, probabilidad: 100, fecha_creacion: "2026-03-10", fecha_cierre_estimada: "2026-03-28", created_at: "2026-03-10T10:00:00.000Z", updated_at: "2026-03-28T10:00:00.000Z" },
  { id: 5, codigo_oportunidad: "OPO-005", cliente_id: 6, ejecutivo_id: 4, modalidad_id: 1, estado_id: 1, nombre_oportunidad: "Transporte de fertilizantes hacia Escuintla", monto_estimado: 67500, probabilidad: 35, fecha_creacion: "2026-03-21", fecha_cierre_estimada: "2026-05-02", created_at: "2026-03-21T10:00:00.000Z", updated_at: "2026-03-21T10:00:00.000Z" },
  { id: 6, codigo_oportunidad: "OPO-006", cliente_id: 7, ejecutivo_id: 3, modalidad_id: 1, estado_id: 2, nombre_oportunidad: "Exportación terrestre de textiles a El Salvador", monto_estimado: 54200, probabilidad: 55, fecha_creacion: "2026-03-24", fecha_cierre_estimada: "2026-04-20", created_at: "2026-03-24T10:00:00.000Z", updated_at: "2026-03-24T10:00:00.000Z" },
  { id: 7, codigo_oportunidad: "OPO-007", cliente_id: 4, ejecutivo_id: 4, modalidad_id: 7, estado_id: 3, nombre_oportunidad: "Gestión aduanal de maquinaria industrial", monto_estimado: 73500, probabilidad: 75, fecha_creacion: "2026-03-26", fecha_cierre_estimada: "2026-04-18", created_at: "2026-03-26T10:00:00.000Z", updated_at: "2026-03-26T10:00:00.000Z" },
  { id: 8, codigo_oportunidad: "OPO-008", cliente_id: 8, ejecutivo_id: 3, modalidad_id: 8, estado_id: 5, nombre_oportunidad: "Almacenaje temporal de productos importados", monto_estimado: 28000, probabilidad: 0, fecha_creacion: "2026-03-05", fecha_cierre_estimada: "2026-03-20", created_at: "2026-03-05T10:00:00.000Z", updated_at: "2026-03-20T10:00:00.000Z" },
];

const COTIZACIONES_DEFAULT: CotizacionRow[] = [
  { id: 1, codigo_cotizacion: "COT-001", cliente_id: 1, contacto_id: 1, ejecutivo_id: 3, modalidad_id: 1, forma_pago_id: 1, origen_id: 1, destino_id: 3, fecha_ui: "2026-03-22", estado_ui: "Enviada", moneda_ui: "GTQ", tipo_carga_ui: "Alimentos procesados", peso_ui: "12", volumen_ui: "35", observaciones_ui: "Entrega en 24 horas." },
  { id: 2, codigo_cotizacion: "COT-002", cliente_id: 2, contacto_id: 3, ejecutivo_id: 4, modalidad_id: 5, forma_pago_id: 3, origen_id: 1, destino_id: 6, fecha_ui: "2026-03-23", estado_ui: "Aprobada", moneda_ui: "USD", tipo_carga_ui: "Materia prima industrial", peso_ui: "18", volumen_ui: "40", observaciones_ui: "Incluye coordinación fronteriza." },
  { id: 3, codigo_cotizacion: "COT-003", cliente_id: 3, contacto_id: 4, ejecutivo_id: 3, modalidad_id: 2, forma_pago_id: 2, origen_id: 1, destino_id: 5, fecha_ui: "2026-03-25", estado_ui: "Borrador", moneda_ui: "GTQ", tipo_carga_ui: "Mercadería de consumo", peso_ui: "8.5", volumen_ui: "22", observaciones_ui: "Sujeto a disponibilidad de unidad." },
  { id: 4, codigo_cotizacion: "COT-004", cliente_id: 6, contacto_id: 7, ejecutivo_id: 4, modalidad_id: 1, forma_pago_id: 1, origen_id: 5, destino_id: 4, fecha_ui: "2026-03-27", estado_ui: "Enviada", moneda_ui: "GTQ", tipo_carga_ui: "Fertilizantes empacados", peso_ui: "20", volumen_ui: "48", observaciones_ui: "Carga general no peligrosa." },
  { id: 5, codigo_cotizacion: "COT-005", cliente_id: 7, contacto_id: 8, ejecutivo_id: 3, modalidad_id: 1, forma_pago_id: 3, origen_id: 1, destino_id: 6, fecha_ui: "2026-03-29", estado_ui: "Aprobada", moneda_ui: "USD", tipo_carga_ui: "Textiles terminados", peso_ui: "14", volumen_ui: "32", observaciones_ui: "Entrega programada con 48 horas de anticipación." },
  { id: 6, codigo_cotizacion: "COT-006", cliente_id: 8, contacto_id: 10, ejecutivo_id: 3, modalidad_id: 8, forma_pago_id: 1, origen_id: 1, destino_id: 5, fecha_ui: "2026-04-01", estado_ui: "Enviada", moneda_ui: "GTQ", tipo_carga_ui: "Productos importados", peso_ui: "9", volumen_ui: "24", observaciones_ui: "Almacenaje y traslado coordinados con el contacto principal." },
];

const DETALLES_DEFAULT: CotizacionDetalleRow[] = [
  { id: 1, cotizacion_id: 1, descripcion: "Transporte FTL Guatemala - Xela", cantidad: 1, precio_unitario: 2500, dias_ui: 1 },
  { id: 2, cotizacion_id: 2, descripcion: "Flete marítimo y coordinación logística", cantidad: 1, precio_unitario: 3200, dias_ui: 5 },
  { id: 3, cotizacion_id: 3, descripcion: "Transporte LTL Guatemala - Puerto Barrios", cantidad: 2, precio_unitario: 1450, dias_ui: 2 },
  { id: 4, cotizacion_id: 4, descripcion: "Transporte FTL Puerto Barrios - Escuintla", cantidad: 1, precio_unitario: 6800, dias_ui: 1 },
  { id: 5, cotizacion_id: 5, descripcion: "Transporte internacional Guatemala - San Salvador", cantidad: 1, precio_unitario: 2950, dias_ui: 2 },
  { id: 6, cotizacion_id: 6, descripcion: "Almacenaje temporal y traslado terrestre", cantidad: 1, precio_unitario: 4850, dias_ui: 3 },
];

// ============================================================
// STORAGE HELPERS / MIGRACIÓN
// ============================================================

function readArray<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeArray<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

interface QuoteUiMetadata {
  fecha_ui?: string;
  estado_ui?: QuoteStatus;
  moneda_ui?: "USD" | "GTQ";
  tipo_carga_ui?: string;
  peso_ui?: string;
  volumen_ui?: string;
  observaciones_ui?: string;
  no_incluye_ui?: string[];
  notas_importantes_ui?: string[];
  dias_ui_por_linea?: Array<number | string>;
  updated_at?: string;
}

type QuoteUiMetadataMap = Record<string, QuoteUiMetadata>;

function readQuoteUiMetadata(): QuoteUiMetadataMap {
  try {
    const raw = localStorage.getItem(K.quoteUiMeta);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function writeQuoteUiMetadata(data: QuoteUiMetadataMap) {
  localStorage.setItem(K.quoteUiMeta, JSON.stringify(data));
}

function quoteUiIdKey(id?: number | null) {
  const numericId = Number(id || 0);
  return numericId > 0 ? `id:${numericId}` : "";
}

function quoteUiCodeKey(code?: string | null) {
  const cleanCode = String(code || "").trim();
  return cleanCode ? `code:${cleanCode}` : "";
}

function getQuoteUiMetadata(
  id?: number | null,
  code?: string | null
): QuoteUiMetadata {
  const current = readQuoteUiMetadata();
  const idKey = quoteUiIdKey(id);
  const codeKey = quoteUiCodeKey(code);
  const legacyCode = String(code || "").trim();

  return (
    (idKey && current[idKey]) ||
    (codeKey && current[codeKey]) ||
    (legacyCode && current[legacyCode]) ||
    {}
  );
}

function saveQuoteUiMetadata(
  id: number | null | undefined,
  code: string | null | undefined,
  meta: QuoteUiMetadata
) {
  const current = readQuoteUiMetadata();
  const idKey = quoteUiIdKey(id);
  const codeKey = quoteUiCodeKey(code);
  const previous = getQuoteUiMetadata(id, code);

  const next: QuoteUiMetadata = {
    ...previous,
    ...meta,
    updated_at: new Date().toISOString(),
  };

  if (idKey) current[idKey] = next;
  if (codeKey) current[codeKey] = next;

  writeQuoteUiMetadata(current);
}

function removeQuoteUiMetadata(
  id?: number | null,
  code?: string | null
) {
  const current = readQuoteUiMetadata();
  const idKey = quoteUiIdKey(id);
  const codeKey = quoteUiCodeKey(code);
  const legacyCode = String(code || "").trim();

  if (idKey) delete current[idKey];
  if (codeKey) delete current[codeKey];
  if (legacyCode) delete current[legacyCode];

  writeQuoteUiMetadata(current);
}

function firstNonBlank(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text !== "") return text;
  }
  return "";
}

function nextId(items: Array<{ id: number }>) {
  return items.length ? Math.max(...items.map((i) => Number(i.id) || 0)) + 1 : 1;
}

function nextCode(items: any[], field: string, prefix: string) {
  const max = items.reduce((acc, item) => {
    const value = String(item?.[field] || "");
    const nums = value.match(/\d+/g);
    const n = nums?.length ? Number(nums[nums.length - 1]) : 0;
    return Math.max(acc, n || 0);
  }, 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

function estadoClienteNombre(id: number): ClientStatus {
  return id === 2 ? "Inactivo" : "Activo";
}

function stageToEstadoId(stage: Stage) {
  return { prospecto: 1, cotizado: 2, negociacion: 3, ganado: 4, perdido: 5 }[stage];
}

function estadoIdToStage(id: number): Stage {
  if (id === 2) return "cotizado";
  if (id === 3) return "negociacion";
  if (id === 4) return "ganado";
  if (id === 5) return "perdido";
  return "prospecto";
}

function migrateClients(raw: any[]): ClienteRow[] {
  if (!raw.length) return CLIENTES_DEFAULT;
  if (raw[0]?.codigo_cliente) {
    return raw.map((c: any) => ({
      ...c,
      id: Number(c.id),
      estado_cliente_id: Number(c.estado_cliente_id || (String(c.nombre_estado_cliente || c.estado).toLowerCase().includes("inactivo") ? 2 : 1)),
      nombre_estado_cliente: c.nombre_estado_cliente || estadoClienteNombre(Number(c.estado_cliente_id || 1)),
    }));
  }

  return raw.map((c: any, index: number) => ({
    id: Number(c.id) || index + 1,
    codigo_cliente: `CLI-${String(index + 1).padStart(3, "0")}`,
    nombre_empresa: c.name || c.nombre_empresa || `Cliente ${index + 1}`,
    nit: c.nit || `CF-${index + 1}`,
    direccion: c.address || c.direccion || "",
    estado_cliente_id: String(c.status || c.estado || "Activo").toLowerCase().includes("inactivo") ? 2 : 1,
    created_at: c.fechaRegistro || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    nombre_estado_cliente: String(c.status || c.estado || "Activo").toLowerCase().includes("inactivo") ? "Inactivo" : "Activo",
  }));
}


function mergeSeedRows<T extends Record<string, any>>(current: T[], seed: T[], key: keyof T): T[] {
  const existing = new Set(current.map((item) => String(item?.[key] ?? "")));
  const missing = seed.filter((item) => !existing.has(String(item?.[key] ?? "")));
  return [...current, ...missing];
}

function applyDemoSeedVersion() {
  // Esta versión reemplaza los ejemplos antiguos del prototipo
  // ("Cliente Ejemplo A", "Servicio terrestre", etc.) por datos
  // completos y realistas. Los registros creados por el usuario con
  // códigos posteriores se conservan.
  const version = "8";

  const currentClients = migrateClients(readArray<any>(K.clientes, []));
  const currentOpportunitiesCheck = readArray<any>(K.oportunidades, []);

  const hayDatosLegacy =
    currentClients.some((c: any) =>
      /cliente\s+ejemplo|cliente\s+no\s+asignado/i.test(String(c?.nombre_empresa || c?.name || ""))
    ) ||
    currentOpportunitiesCheck.length !== 8 ||
    currentOpportunitiesCheck.some((o: any) =>
      /servicio\s+terrestre|servicio\s+mar[ií]timo|almacenaje\s+temporal/i.test(
        String(o?.nombre_oportunidad || o?.clientName || "")
      )
    );

  if (localStorage.getItem(K.seedVersion) === version && !hayDatosLegacy) return;
  const clientDemoCodes = new Set(Array.from({ length: 10 }, (_, i) => `CLI-${String(i + 1).padStart(3, "0")}`));
  const preservedClients = currentClients.filter((c) => !clientDemoCodes.has(c.codigo_cliente));
  writeArray(K.clientes, [...CLIENTES_DEFAULT, ...preservedClients]);

  const currentContacts = readArray<ContactoClienteRow>(K.contactos, []);
  const preservedContacts = currentContacts.filter((c) => Number(c.id) > 12);
  writeArray(K.contactos, [...CONTACTOS_DEFAULT, ...preservedContacts]);

  const currentPhones = readArray<TelefonoContactoRow>(K.telefonos, []);
  const preservedPhones = currentPhones.filter((p) => Number(p.id) > 13);
  writeArray(K.telefonos, [...TELEFONOS_DEFAULT, ...preservedPhones]);

  const opportunityDemoCodes = new Set(Array.from({ length: 10 }, (_, i) => `OPO-${String(i + 1).padStart(3, "0")}`));
  const currentOpportunities = readArray<OportunidadRow>(K.oportunidades, []);
  const preservedOpportunities = currentOpportunities.filter((o) => !opportunityDemoCodes.has(String(o.codigo_oportunidad || "")));
  writeArray(K.oportunidades, [...OPORTUNIDADES_DEFAULT, ...preservedOpportunities]);

  const quoteDemoCodes = new Set(Array.from({ length: 7 }, (_, i) => `COT-${String(i + 1).padStart(3, "0")}`));
  const currentQuotes = readArray<CotizacionRow>(K.cotizaciones, []);
  const preservedQuotes = currentQuotes.filter((q) => !quoteDemoCodes.has(String(q.codigo_cotizacion || "")));
  writeArray(K.cotizaciones, [...COTIZACIONES_DEFAULT, ...preservedQuotes]);

  const currentDetails = readArray<CotizacionDetalleRow>(K.cotizacionDetalle, []);
  const preservedDetails = currentDetails.filter((d) => Number(d.id) > 7);
  writeArray(K.cotizacionDetalle, [...DETALLES_DEFAULT, ...preservedDetails]);

  localStorage.setItem(K.seedVersion, version);
}

function initializePrototype() {
  // Migra posibles claves legacy creadas por el prototipo anterior.
  const legacyClients = (() => {
    try {
      const raw = localStorage.getItem(K.clientes) || localStorage.getItem("clients");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  })();

  const clientes = migrateClients(Array.isArray(legacyClients) ? legacyClients : []);
  writeArray(K.clientes, clientes);

  // Si una versión anterior dejó una colección vacía, el prototipo vuelve a
  // colocar datos de demostración. Así nunca depende de un backend para verse lleno.
  const ensureDemo = <T,>(key: string, seed: T[]) => {
    const rows = readArray<T>(key, seed);
    if (!rows.length) {
      writeArray(key, seed);
      return seed;
    }
    return rows;
  };

  ensureDemo(K.contactos, CONTACTOS_DEFAULT);
  ensureDemo(K.telefonos, TELEFONOS_DEFAULT);
  ensureDemo(K.modalidades, MODALIDADES_DEFAULT);
  ensureDemo(K.formasPago, FORMAS_PAGO_DEFAULT);
  ensureDemo(K.ubicaciones, UBICACIONES_DEFAULT);
  ensureDemo(K.oportunidades, OPORTUNIDADES_DEFAULT);
  ensureDemo(K.cotizaciones, COTIZACIONES_DEFAULT);
  ensureDemo(K.cotizacionDetalle, DETALLES_DEFAULT);

  // El Login nuevo crea roles y usuarios normalizados. Si todavía no existen,
  // se usan datos locales de demostración, sin hacer peticiones HTTP.
  ensureDemo(K.roles, ROLES_DEFAULT);
  ensureDemo(K.usuarios, USUARIOS_FALLBACK);

  applyDemoSeedVersion();
}

// ============================================================
// UTILS
// ============================================================

const moneyGTQ = (value: number) =>
  `Q ${Number(value || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const moneyQuote = (value: number, currency: "USD" | "GTQ") =>
  `${currency === "GTQ" ? "Q" : "$"} ${Number(value || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const validEmail = (value: string) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/*
  Validaciones de escritura para formularios:
  - Nombres, apellidos y cargos: solo letras, espacios, apóstrofe y guion.
  - Teléfonos y cantidades: solo números.
  - Montos, peso y volumen: solo números y un punto decimal.
  - Empresas, rutas y descripciones comerciales: letras, números y signos comerciales seguros.
*/
const cleanEmail = (value: string) => value.replace(/\s/g, "").toLowerCase();
const cleanNit = (value: string) => value.replace(/[^0-9A-Za-zKk-]/g, "").slice(0, 20);
const cleanName = (value: string) => value.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'-]/g, "");
const cleanCompany = (value: string) => value.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s.,&()'/-]/g, "");
const cleanAddress = (value: string) => value.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s.,#&()'/-]/g, "");
const cleanPhone = (value: string, max = 15) => value.replace(/\D/g, "").slice(0, max);
const cleanInteger = (value: string, maxDigits = 10) => value.replace(/\D/g, "").slice(0, maxDigits);
const cleanDecimal = (value: string, maxDigits = 10, maxDecimals = 2) => {
  const only = value.replace(/[^0-9.]/g, "");
  const parts = only.split(".");
  const integer = parts[0].slice(0, maxDigits);
  const decimal = parts.slice(1).join("").slice(0, maxDecimals);
  return parts.length > 1 ? `${integer}.${decimal}` : integer;
};

function titleCase(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es-GT")
    .replace(/(^|[\s'-])([a-záéíóúüñ])/g, (_m, sep, letter) => `${sep}${letter.toLocaleUpperCase("es-GT")}`);
}

function titleCaseCompany(value: string) {
  return titleCase(value)
    .replace(/\bS\.\s*A\.?\b/gi, "S.A.")
    .replace(/\bS\.\s*De\s*R\.\s*L\.?\b/gi, "S. de R.L.")
    .replace(/\bGl365\b/gi, "GL365")
    .replace(/\bFtl\b/g, "FTL")
    .replace(/\bLtl\b/g, "LTL")
    .replace(/\bFcl\b/g, "FCL")
    .replace(/\bLcl\b/g, "LCL");
}

const cleanPersonName = (value: string, max = 35) => titleCase(cleanName(value)).slice(0, max);
const cleanRoleText = (value: string, max = 60) => titleCase(cleanName(value)).slice(0, max);
const cleanCommercialText = (value: string, max = 120) => titleCaseCompany(cleanCompany(value)).slice(0, max);

// ============================================================
// LIMPIEZA MIENTRAS EL USUARIO ESCRIBE
// ============================================================
// Importante: estos helpers NO hacen trim() ni titleCase().
// De esa forma un espacio recién escrito se conserva y el usuario puede
// seguir escribiendo la siguiente palabra normalmente. La normalización
// final se hace al guardar con cleanPersonName/cleanCommercialText/etc.
const keepSingleSpaces = (value: string) => value.replace(/\s{2,}/g, " ");

const cleanPersonTyping = (value: string, max = 35) =>
  keepSingleSpaces(cleanName(value)).slice(0, max);

// Da formato mientras se escribe sin eliminar el espacio final:
// "mARIA fernanda" -> "Maria Fernanda".
const capitalizePersonTyping = (value: string, max = 35) =>
  cleanPersonTyping(value, max)
    .toLocaleLowerCase("es-GT")
    .replace(/(^|[\s'-])([a-záéíóúüñ])/g, (_m, sep, letter) =>
      `${sep}${String(letter).toLocaleUpperCase("es-GT")}`
    );

const cleanRoleTyping = (value: string, max = 60) =>
  keepSingleSpaces(cleanName(value)).slice(0, max);

const uppercaseFirstLetter = (value: string) =>
  value.replace(
    /(^\s*)([a-záéíóúüñ])/,
    (_match, spaces, letter) =>
      `${spaces}${String(letter).toLocaleUpperCase("es-GT")}`
  );

const capitalizeCommercialTyping = (value: string, max = 120) =>
  uppercaseFirstLetter(
    keepSingleSpaces(cleanCompany(value)).slice(0, max)
  );

const capitalizeRoleTyping = (value: string, max = 60) =>
  uppercaseFirstLetter(
    keepSingleSpaces(cleanName(value)).slice(0, max)
  );

const capitalizeAddressTyping = (value: string, max = 180) =>
  uppercaseFirstLetter(
    keepSingleSpaces(cleanAddress(value)).slice(0, max)
  );

const cleanCommercialTyping = (value: string, max = 120) =>
  keepSingleSpaces(cleanCompany(value)).slice(0, max);

const cleanAddressTyping = (value: string, max = 180) =>
  keepSingleSpaces(cleanAddress(value)).slice(0, max);

const cleanAddressText = (value: string, max = 180) =>
  titleCaseCompany(cleanAddress(value)).slice(0, max);

function fullContactName(c?: Partial<ContactoClienteRow> | null) {
  if (!c) return "";
  return [c.primer_nombre, c.segundo_nombre, c.primer_apellido, c.segundo_apellido]
    .filter(Boolean)
    .join(" ");
}

function telefonoTexto(p?: Partial<TelefonoContactoRow> | null) {
  if (!p) return "";
  return String(p.telefono_completo || `${p.prefijo || ""} ${p.telefono || ""}`).trim();
}

function fullUserName(u?: UsuarioRow | null) {
  if (!u) return "";
  return [u.primer_nombre, u.segundo_nombre, u.primer_apellido, u.segundo_apellido]
    .filter(Boolean)
    .join(" ");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string) {
  if (!value) return "-";
  const d = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("es-GT");
}

function moveWithEnter(e: KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  if (e.key !== "Enter") return;
  if (e.shiftKey && e.currentTarget.tagName === "TEXTAREA") return;

  e.preventDefault();
  const form = e.currentTarget.closest("[data-enter-form]");
  if (!form) return;

  const elements = Array.from(
    form.querySelectorAll<HTMLElement>(
      '[data-enter-item="true"]:not([disabled]), [data-enter-save="true"]:not([disabled])'
    )
  ).filter((el) => {
    const s = window.getComputedStyle(el);
    return s.display !== "none" && s.visibility !== "hidden";
  });

  const index = elements.indexOf(e.currentTarget as unknown as HTMLElement);
  const next = elements[index + 1];

  if (next) {
    next.focus();
    return;
  }

  // Si ya no hay otro campo, lleva el foco al botón Guardar del modal activo.
  const modal = e.currentTarget.closest(".fixed") || document;
  const saveButton = modal.querySelector<HTMLElement>('[data-enter-save="true"]:not([disabled])');
  saveButton?.focus();
}

const baseInput =
  "w-full h-10 px-3 rounded-lg border bg-white text-sm outline-none transition-all focus:ring-2 focus:ring-[#0C2D6B]/20 disabled:bg-gray-100 disabled:text-gray-500";

function inputClass(error?: string) {
  return `${baseInput} ${error ? "border-red-400 bg-red-50 focus:border-red-500" : "border-gray-300 focus:border-[#0C2D6B]"}`;
}

function ErrorText({ value }: { value?: string }) {
  if (!value) return null;
  return (
    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
      <AlertTriangle className="w-3 h-3" />
      {value}
    </p>
  );
}

function ErrorSummary({ errors, title }: { errors: FieldErrors; title: string }) {
  const list = Object.values(errors).filter(Boolean);
  if (!list.length) return null;
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <p className="font-bold mb-1">{title}</p>
      <ul className="list-disc ml-5 space-y-1">
        {list.map((e, i) => (
          <li key={`${e}-${i}`}>{e}</li>
        ))}
      </ul>
    </div>
  );
}


function normalizeLocationLabel(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function locationLabel(u?: Partial<UbicacionRow> | null) {
  if (!u) return "";
  return `${u.nombre_ubicacion || ""} · ${u.pais || ""}`.trim();
}

function uniqueLocationOptions(locations: UbicacionRow[], selectedId?: number | null) {
  const map = new Map<string, UbicacionRow>();

  locations.forEach((u) => {
    const key = normalizeLocationLabel(`${u.nombre_ubicacion}||${u.pais}`);
    const current = map.get(key);
    if (!current || Number(u.id) < Number(current.id)) {
      map.set(key, u);
    }
  });

  const selected = locations.find((u) => Number(u.id) === Number(selectedId));
  const rows = Array.from(map.values()).sort((a, b) =>
    locationLabel(a).localeCompare(locationLabel(b), "es")
  );

  if (selected && !rows.some((u) => Number(u.id) === Number(selected.id))) {
    rows.unshift(selected);
  }

  return rows;
}

function SearchableLocationSelect({
  id,
  valueId,
  locations,
  disabled,
  error,
  placeholder,
  onChange,
}: {
  id: string;
  valueId?: number | null;
  locations: UbicacionRow[];
  disabled?: boolean;
  error?: string;
  placeholder: string;
  onChange: (id: number | null) => void;
}) {
  const options = useMemo(() => uniqueLocationOptions(locations, valueId), [locations, valueId]);
  const selected = locations.find((u) => Number(u.id) === Number(valueId));
  const [text, setText] = useState(selected ? locationLabel(selected) : "");

  useEffect(() => {
    setText(selected ? locationLabel(selected) : "");
  }, [selected?.id, selected?.nombre_ubicacion, selected?.pais]);

  const findMatch = (raw: string) => {
    const typed = normalizeLocationLabel(raw);
    if (!typed) return null;

    return (
      options.find((u) => normalizeLocationLabel(locationLabel(u)) === typed) ||
      options.find((u) => normalizeLocationLabel(locationLabel(u)).includes(typed)) ||
      null
    );
  };

  const applyMatch = (raw: string, allowPartial = false) => {
    const typed = raw.trim();
    if (!typed) {
      setText("");
      onChange(null);
      return;
    }

    const exact = options.find(
      (u) => normalizeLocationLabel(locationLabel(u)) === normalizeLocationLabel(typed)
    );

    const match = exact || (allowPartial ? findMatch(typed) : null);

    if (match) {
      setText(locationLabel(match));
      onChange(Number(match.id));
    }
  };

  return (
    <div className="flex-1 min-w-0">
      <input
        list={`${id}-lista`}
        disabled={disabled}
        data-enter-item="true"
        value={text}
        onChange={(e) => {
          const value = e.target.value;
          setText(value);
          applyMatch(value, false);
        }}
        onBlur={(e) => applyMatch(e.target.value, true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            applyMatch(e.currentTarget.value, true);
          }
          moveWithEnter(e);
        }}
        placeholder={placeholder}
        className={`h-8 w-full rounded border bg-white px-2 font-semibold text-[#0C2D6B] outline-none ${error ? "border-red-400" : "border-blue-300 focus:border-[#FF6A00]"}`}
      />
      <datalist id={`${id}-lista`}>
        {options.map((u) => (
          <option key={`${id}-${u.id}`} value={locationLabel(u)} />
        ))}
      </datalist>
      <p className="mt-1 text-[10px] text-gray-500">
        Escribí para buscar. Se muestran ubicaciones únicas, sin duplicados.
      </p>
    </div>
  );
}


function normalizeCrmSearch(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function SearchableClientSelect({
  id,
  valueId,
  clients,
  disabled,
  error,
  placeholder = "Buscar por código, empresa o NIT...",
  onChange,
}: {
  id: string;
  valueId?: number | null;
  clients: ClienteRow[];
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  onChange: (id: number | null) => void;
}) {
  const selected = clients.find(
    (client) => Number(client.id) === Number(valueId)
  );

  const options = useMemo(
    () =>
      clients
        .filter(
          (client) =>
            Number(client.estado_cliente_id) === 1 ||
            Number(client.id) === Number(valueId)
        )
        .sort((a, b) =>
          String(a.nombre_empresa || "").localeCompare(
            String(b.nombre_empresa || ""),
            "es"
          )
        ),
    [clients, valueId]
  );

  const clientLabel = (client: ClienteRow) =>
    `${client.codigo_cliente} · ${client.nombre_empresa} · ${client.nit}`;

  const [text, setText] = useState(
    selected ? clientLabel(selected) : ""
  );
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Solo sincroniza el texto con el valor seleccionado cuando el usuario
  // NO está escribiendo. Así no se borra cada tecla.
  useEffect(() => {
    if (!isEditing) {
      setText(selected ? clientLabel(selected) : "");
    }
  }, [
    isEditing,
    selected?.id,
    selected?.codigo_cliente,
    selected?.nombre_empresa,
    selected?.nit,
  ]);

  const filtered = useMemo(() => {
    const query = normalizeCrmSearch(text);
    if (!query) return options.slice(0, 10);

    const terms = query.split(" ").filter(Boolean);

    return options
      .filter((client) => {
        const haystack = normalizeCrmSearch(
          [
            client.codigo_cliente,
            client.nombre_empresa,
            client.nit,
          ].join(" ")
        );

        return terms.every((term) => haystack.includes(term));
      })
      .slice(0, 10);
  }, [options, text]);

  const selectClient = (client: ClienteRow) => {
    setText(clientLabel(client));
    setOpen(false);
    setIsEditing(false);
    onChange(Number(client.id));
  };

  const clearClient = () => {
    setText("");
    setOpen(false);
    setIsEditing(false);
    onChange(null);
  };

  const resolveTypedValue = () => {
    const typed = normalizeCrmSearch(text);

    if (!typed) {
      clearClient();
      return null;
    }

    const exact = options.find(
      (client) =>
        normalizeCrmSearch(clientLabel(client)) === typed
    );

    if (exact) {
      selectClient(exact);
      return exact;
    }

    if (filtered.length === 1) {
      selectClient(filtered[0]);
      return filtered[0];
    }

    return null;
  };

  return (
    <div className="relative min-w-0 w-full">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

        <input
          id={id}
          disabled={disabled}
          data-enter-item="true"
          autoComplete="off"
          value={text}
          onFocus={() => {
            setIsEditing(true);
            setOpen(true);
          }}
          onChange={(e) => {
            const value = e.target.value;
            setText(value);
            setIsEditing(true);
            setOpen(true);

            if (!value.trim()) {
              onChange(null);
            }
          }}
          onBlur={() => {
            // Se deja un pequeño margen para poder hacer clic en una opción.
            window.setTimeout(() => {
              resolveTypedValue();
              setOpen(false);
              setIsEditing(false);
            }, 120);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              return;
            }

            if (e.key === "Enter") {
              e.preventDefault();

              const resolved = resolveTypedValue();

              if (!resolved && filtered.length > 0) {
                selectClient(filtered[0]);
              }

              window.setTimeout(() => moveWithEnter(e), 0);
            }
          }}
          placeholder={placeholder}
          className={`h-8 w-full rounded border bg-white pl-8 pr-8 font-semibold text-[#0C2D6B] outline-none ${
            error
              ? "border-red-400"
              : "border-blue-300 focus:border-[#FF6A00]"
          }`}
        />

        {!disabled && text && (
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={clearClient}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#FF6A00]"
            title="Limpiar cliente"
            aria-label="Limpiar cliente"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!disabled && open && (
        <div className="absolute left-0 right-0 top-[36px] z-[140] max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl">
          {filtered.length > 0 ? (
            filtered.map((client) => (
              <button
                key={`${id}-${client.id}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectClient(client)}
                className={`w-full border-b border-gray-100 px-3 py-2 text-left last:border-b-0 hover:bg-blue-50 ${
                  Number(valueId) === Number(client.id)
                    ? "bg-blue-50"
                    : "bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-[#0C2D6B]">
                      {client.nombre_empresa}
                    </p>
                    <p className="mt-0.5 text-[10px] text-gray-500">
                      {client.codigo_cliente} · NIT {client.nit}
                    </p>
                  </div>

                  {Number(valueId) === Number(client.id) && (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                  )}
                </div>
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-[11px] text-gray-500">
              No se encontraron clientes con esa búsqueda.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SearchableContactSelect({
  id,
  valueId,
  contacts,
  disabled,
  error,
  placeholder = "Buscar contacto por nombre, correo o cargo...",
  onChange,
}: {
  id: string;
  valueId?: number | null;
  contacts: ContactoClienteRow[];
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  onChange: (id: number | null) => void;
}) {
  const selected = contacts.find(
    (contact) => Number(contact.id) === Number(valueId)
  );

  const options = useMemo(
    () =>
      contacts
        .filter(
          (contact) =>
            contact.estado !== false ||
            Number(contact.id) === Number(valueId)
        )
        .sort((a, b) => {
          if (Boolean(a.es_principal) !== Boolean(b.es_principal)) {
            return a.es_principal ? -1 : 1;
          }

          return fullContactName(a).localeCompare(
            fullContactName(b),
            "es"
          );
        }),
    [contacts, valueId]
  );

  const contactLabel = (contact: ContactoClienteRow) => {
    const principal = contact.es_principal ? " · Principal" : "";
    const correo = contact.correo ? ` · ${contact.correo}` : "";

    return `${fullContactName(contact)}${principal}${correo}`;
  };

  const [text, setText] = useState(
    selected ? contactLabel(selected) : ""
  );
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setText(selected ? contactLabel(selected) : "");
    }
  }, [
    isEditing,
    selected?.id,
    selected?.primer_nombre,
    selected?.segundo_nombre,
    selected?.primer_apellido,
    selected?.segundo_apellido,
    selected?.cargo,
    selected?.correo,
    selected?.es_principal,
  ]);

  const filtered = useMemo(() => {
    const query = normalizeCrmSearch(text);
    if (!query) return options.slice(0, 10);

    const terms = query.split(" ").filter(Boolean);

    return options
      .filter((contact) => {
        const haystack = normalizeCrmSearch(
          [
            fullContactName(contact),
            contact.cargo,
            contact.correo,
            contact.es_principal ? "principal" : "",
          ].join(" ")
        );

        return terms.every((term) => haystack.includes(term));
      })
      .slice(0, 10);
  }, [options, text]);

  const selectContact = (contact: ContactoClienteRow) => {
    setText(contactLabel(contact));
    setOpen(false);
    setIsEditing(false);
    onChange(Number(contact.id));
  };

  const clearContact = () => {
    setText("");
    setOpen(false);
    setIsEditing(false);
    onChange(null);
  };

  const resolveTypedValue = () => {
    const typed = normalizeCrmSearch(text);

    if (!typed) {
      clearContact();
      return null;
    }

    const exact = options.find(
      (contact) =>
        normalizeCrmSearch(contactLabel(contact)) === typed
    );

    if (exact) {
      selectContact(exact);
      return exact;
    }

    if (filtered.length === 1) {
      selectContact(filtered[0]);
      return filtered[0];
    }

    return null;
  };

  return (
    <div className="relative min-w-0 w-full">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

        <input
          id={id}
          disabled={disabled}
          data-enter-item="true"
          autoComplete="off"
          value={text}
          onFocus={() => {
            setIsEditing(true);
            setOpen(true);
          }}
          onChange={(e) => {
            const value = e.target.value;
            setText(value);
            setIsEditing(true);
            setOpen(true);

            if (!value.trim()) {
              onChange(null);
            }
          }}
          onBlur={() => {
            window.setTimeout(() => {
              resolveTypedValue();
              setOpen(false);
              setIsEditing(false);
            }, 120);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              return;
            }

            if (e.key === "Enter") {
              e.preventDefault();

              const resolved = resolveTypedValue();

              if (!resolved && filtered.length > 0) {
                selectContact(filtered[0]);
              }

              window.setTimeout(() => moveWithEnter(e), 0);
            }
          }}
          placeholder={placeholder}
          className={`h-8 w-full rounded border bg-white pl-8 pr-8 font-semibold text-[#0C2D6B] outline-none ${
            error
              ? "border-red-400"
              : "border-blue-300 focus:border-[#FF6A00]"
          }`}
        />

        {!disabled && text && (
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={clearContact}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#FF6A00]"
            title="Limpiar contacto"
            aria-label="Limpiar contacto"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!disabled && open && (
        <div className="absolute left-0 right-0 top-[36px] z-[140] max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl">
          {filtered.length > 0 ? (
            filtered.map((contact) => (
              <button
                key={`${id}-${contact.id}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectContact(contact)}
                className={`w-full border-b border-gray-100 px-3 py-2 text-left last:border-b-0 hover:bg-blue-50 ${
                  Number(valueId) === Number(contact.id)
                    ? "bg-blue-50"
                    : "bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-[12px] font-bold text-[#0C2D6B]">
                        {fullContactName(contact)}
                      </p>

                      {contact.es_principal && (
                        <span className="rounded bg-green-100 px-1.5 py-0.5 text-[9px] font-bold text-green-700">
                          Principal
                        </span>
                      )}
                    </div>

                    <p className="mt-0.5 text-[10px] text-gray-500">
                      {contact.cargo || "Sin cargo"}
                      {contact.correo ? ` · ${contact.correo}` : ""}
                    </p>
                  </div>

                  {Number(valueId) === Number(contact.id) && (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                  )}
                </div>
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-[11px] text-gray-500">
              No se encontraron contactos con esa búsqueda.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KpiCard({ title, value, icon: Icon, color }: { title: string; value: string | number; icon: any; color: "blue" | "green" | "orange" }) {
  const bar = color === "green" ? "bg-[#22C55E]" : color === "orange" ? "bg-[#FF6A00]" : "bg-[#0C2D6B]";
  const icon = color === "green" ? "bg-green-50 text-[#22C55E]" : color === "orange" ? "bg-orange-50 text-[#FF6A00]" : "bg-blue-50 text-[#0C2D6B]";
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 relative overflow-hidden min-w-0">
      <div className={`absolute bottom-0 left-0 w-full h-1 ${bar}`} />
      <div className="flex justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-500 mb-1">{title}</p>
          <h3 className="text-xl font-bold text-[#0C2D6B] break-words">{value}</h3>
        </div>
        <div className={`p-2.5 rounded-lg h-fit ${icon}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
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
          onChange={(e) => {
            onRowsPerPageChange(Number(e.target.value));
            onPageChange(1);
          }}
          className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-[#0C2D6B] shadow-sm outline-none focus:border-[#0C2D6B]"
          aria-label="Registros por página"
        >
          {[5, 10, 15, 25, 50].map((size) => (
            <option key={size} value={size}>
              {size} por página
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-[#0C2D6B] shadow-sm disabled:cursor-not-allowed disabled:text-gray-300 disabled:shadow-none"
        >
          Primera
        </button>

        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-[#0C2D6B] shadow-sm disabled:cursor-not-allowed disabled:text-gray-300 disabled:shadow-none"
        >
          Anterior
        </button>

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-[#0C2D6B] shadow-sm disabled:cursor-not-allowed disabled:text-gray-300 disabled:shadow-none"
        >
          Siguiente
        </button>

        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-[#0C2D6B] shadow-sm disabled:cursor-not-allowed disabled:text-gray-300 disabled:shadow-none"
        >
          Última
        </button>
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

async function generarPDFCliente(
  client: ClienteRow,
  contacts: ContactoClienteRow[],
  phones: TelefonoContactoRow[]
) {
  const doc = new jsPDF();

  // Encabezado corporativo del PDF.
  doc.setFillColor(12, 45, 107);
  doc.rect(0, 0, 210, 36, "F");

  const logo = await imageUrlToDataUrl(logoEmpresa);
  if (logo) {
    try {
      // Tarjeta blanca para que el logo azul/naranja conserve contraste.
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(255, 106, 0);
      doc.setLineWidth(0.55);
      doc.roundedRect(9, 4, 48, 27, 2.5, 2.5, "FD");
      doc.addImage(logo, "PNG", 12, 6, 42, 23, undefined, "FAST");
    } catch {
      // Si el navegador no puede convertir la imagen, el PDF continúa sin fallar.
    }
  }

  // Bloque de título alineado con el logo.
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 106, 0);
  doc.setFontSize(9);
  doc.text("GRUPO LOGÍSTICO 365", 130, 11, { align: "center" });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(19);
  doc.text("DETALLE DE CLIENTE", 130, 21, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(220, 229, 245);
  doc.text("CRM · Información comercial y de contacto", 130, 27, { align: "center" });

  // Línea naranja que integra visualmente el encabezado.
  doc.setDrawColor(255, 106, 0);
  doc.setLineWidth(0.8);
  doc.line(69, 31, 192, 31);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);

  let y = 48;
  const field = (label: string, value?: string) => {
    doc.setFont(undefined, "bold");
    doc.text(label, 20, y);
    doc.setFont(undefined, "normal");
    doc.text(value || "-", 65, y, { maxWidth: 125 });
    y += 8;
  };

  field("Código:", client.codigo_cliente);
  field("Empresa:", client.nombre_empresa);
  field("NIT:", client.nit);
  field("Dirección:", client.direccion);
  field("Estado:", estadoClienteNombre(client.estado_cliente_id));

  // Separación visual entre los datos generales y la sección de contactos.
  y += 8;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  doc.line(20, y - 3, 190, y - 3);

  doc.setFont(undefined, "bold");
  doc.setTextColor(12, 45, 107);
  doc.setFontSize(12);
  doc.text("Contactos", 20, y + 2);

  // Más espacio antes del primer contacto para que no quede pegado al título.
  y += 12;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);

  const clientContacts = contacts.filter((c) => c.cliente_id === client.id);
  if (!clientContacts.length) {
    doc.setFont(undefined, "normal");
    doc.text("Sin contactos registrados.", 20, y);
  } else {
    clientContacts.forEach((c) => {
      const tp = phones.filter((p) => p.contacto_id === c.id);
      doc.setFont(undefined, "bold");
      doc.text(`${fullContactName(c)}${c.es_principal ? " (Principal)" : ""}`, 20, y);
      y += 6;
      doc.setFont(undefined, "normal");
      doc.text(`${c.cargo || "Sin cargo"} · ${c.correo || "Sin correo"}`, 25, y, { maxWidth: 160 });
      y += 6;
      if (tp.length) {
        doc.text(`Teléfonos: ${tp.map((p) => `${telefonoTexto(p)} (${p.tipo_telefono || "Otro"})`).join(", ")}`, 25, y, { maxWidth: 160 });
        y += 7;
      }
    });
  }

  doc.save(`Cliente_${client.codigo_cliente}.pdf`);
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function CRM() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<"seguimiento" | "clientes" | "cotizaciones" | "proveedores">("seguimiento");

  useEffect(() => {
    const requestedTab = String(searchParams.get("tab") || "").toLowerCase();

    const tabMap: Record<
      string,
      "seguimiento" | "clientes" | "cotizaciones" | "proveedores"
    > = {
      oportunidades: "seguimiento",
      oportunidad: "seguimiento",
      seguimiento: "seguimiento",
      clientes: "clientes",
      cliente: "clientes",
      cotizaciones: "cotizaciones",
      cotizacion: "cotizaciones",
      proveedores: "proveedores",
      proveedor: "proveedores",
    };

    const nextTab = tabMap[requestedTab];

    if (nextTab) {
      setActiveTab(nextTab);
    }
  }, [searchParams]);

  const selectCrmTab = (
    tab: "seguimiento" | "clientes" | "cotizaciones" | "proveedores"
  ) => {
    setActiveTab(tab);

    const tabUrl: Record<
      "seguimiento" | "clientes" | "cotizaciones" | "proveedores",
      string
    > = {
      seguimiento: "oportunidades",
      clientes: "clientes",
      cotizaciones: "cotizaciones",
      proveedores: "proveedores",
    };

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", tabUrl[tab]);
    setSearchParams(nextParams, { replace: true });
  };

  const [clients, setClients] = useState<ClienteRow[]>([]);
  const [contacts, setContacts] = useState<ContactoClienteRow[]>([]);
  const [phones, setPhones] = useState<TelefonoContactoRow[]>([]);
  const [opportunities, setOpportunities] = useState<OportunidadRow[]>([]);
  const [quotes, setQuotes] = useState<CotizacionRow[]>([]);
  const [quoteDetails, setQuoteDetails] = useState<CotizacionDetalleRow[]>([]);

  const [modalidades, setModalidades] = useState<ModalidadRow[]>([]);
  const [formasPago, setFormasPago] = useState<FormaPagoRow[]>([]);
  const [ubicaciones, setUbicaciones] = useState<UbicacionRow[]>([]);
  const [roles, setRoles] = useState<RolRow[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [prefijos, setPrefijos] = useState<PrefijoTelefonicoRow[]>([]);


  // Directorio de proveedores: movido desde Operaciones al CRM.
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [providerContacts, setProviderContacts] = useState<ProviderContactRow[]>([]);
  const [providerServices, setProviderServices] = useState<ProviderServiceRow[]>([]);
  const [providerCompliance, setProviderCompliance] = useState<ProviderComplianceRow[]>([]);
  const [providerPerformance, setProviderPerformance] = useState<ProviderPerformanceRow[]>([]);
  const [providerStates, setProviderStates] = useState<any[]>([]);
  const [crmRoutes, setCrmRoutes] = useState<CrmRouteRow[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [leadStageFilter, setLeadStageFilter] = useState("Todos");
  const [providerStatusFilter, setProviderStatusFilter] = useState("Todos");
  const [providerLevelFilter, setProviderLevelFilter] = useState("Todos");
  const [providerSatFilter, setProviderSatFilter] = useState("Todos");
  // Sin columna activa al entrar.
  // Cuando sortField está vacío, el CRM usa ID DESC:
  // el registro ingresado más recientemente aparece primero.
  const [sortField, setSortField] = useState("");
  const [crmSortDirection, setCrmSortDirection] =
    useState<CrmSortDirection>("desc");

  // Paginación independiente para los tres submódulos del CRM.
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [leadPage, setLeadPage] = useState(1);
  const [clientPage, setClientPage] = useState(1);
  const [quotePage, setQuotePage] = useState(1);
  const [providerPage, setProviderPage] = useState(1);

  const [clientModal, setClientModal] = useState<{ open: boolean; mode: ModalMode; value: Partial<ClienteRow> }>({ open: false, mode: "create", value: {} });
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});

  const [contactModal, setContactModal] = useState<{ open: boolean; mode: ModalMode; value: Partial<ContactoClienteRow>; clientId: number | null }>({ open: false, mode: "create", value: {}, clientId: null });

  // Contactos y teléfonos temporales del formulario "Nuevo cliente".
  // Se usan IDs negativos para diferenciarlos de los registros de MySQL.
  const [newClientContacts, setNewClientContacts] =
    useState<ContactoClienteRow[]>([]);
  const [newClientPhones, setNewClientPhones] =
    useState<TelefonoContactoRow[]>([]);
  const draftContactIdRef = useRef(-1);
  const draftPhoneIdRef = useRef(-1);

  const [contactErrors, setContactErrors] = useState<FieldErrors>({});

  const [phoneModal, setPhoneModal] = useState<{ open: boolean; mode: ModalMode; value: Partial<TelefonoContactoRow>; contactId: number | null }>({ open: false, mode: "create", value: {}, contactId: null });
  const [phoneErrors, setPhoneErrors] = useState<FieldErrors>({});

  const [leadModal, setLeadModal] = useState<{ open: boolean; mode: ModalMode; value: Partial<OportunidadRow> }>({ open: false, mode: "create", value: {} });
  const [leadErrors, setLeadErrors] = useState<FieldErrors>({});

  const [quoteModal, setQuoteModal] = useState<{ open: boolean; mode: ModalMode; value: Partial<CotizacionRow>; details: CotizacionDetalleRow[] }>({ open: false, mode: "create", value: {}, details: [] });
  const [quoteErrors, setQuoteErrors] = useState<FieldErrors>({});


  const [providerModal, setProviderModal] = useState<{
    open: boolean;
    mode: ModalMode;
    value: Partial<ProviderRow>;
  }>({ open: false, mode: "create", value: {} });
  const [providerContactDraft, setProviderContactDraft] = useState<ProviderContactRow[]>([]);
  const [providerServiceDraft, setProviderServiceDraft] = useState<ProviderServiceRow[]>([]);
  const [providerComplianceDraft, setProviderComplianceDraft] = useState<ProviderComplianceRow>({
    estado_sat: "pendiente",
    lista_clinton: false,
    rtu_validado: false,
    licencia_validada: false,
    cuenta_validada: false,
  });
  const [providerPerformanceDraft, setProviderPerformanceDraft] = useState<ProviderPerformanceRow>({
    nivel: "Amarillo",
    historial: "",
    hallazgos: "",
    fecha: todayISO(),
  });
  const [providerErrors, setProviderErrors] = useState<FieldErrors>({});
  const [providerDeleteId, setProviderDeleteId] = useState<number | null>(null);

  // Modal de nueva ruta desde Cotizaciones.
  const [routeModalOpen, setRouteModalOpen] = useState(false);
  const [routeDraft, setRouteDraft] = useState({
    codigo_ruta: "",
    nombre_ruta: "",
    origen: "",
    pais_origen: "Guatemala",
    destino: "",
    pais_destino: "Guatemala",
    distancia_km: "",
  });
  const [routeErrors, setRouteErrors] = useState<FieldErrors>({});

  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    type:
      | "client"
      | "clientPermanent"
      | "contact"
      | "phone"
      | "lead"
      | "quote"
      | null;
    id: number | null;
  }>({ open: false, type: null, id: null });
  const [clientInactiveReason, setClientInactiveReason] = useState("");

  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Cuando un cliente se crea desde Oportunidad o Cotización,
  // se regresa al formulario que lo solicitó y se selecciona automáticamente.
  const [clientReturnTarget, setClientReturnTarget] = useState<"lead" | "quote" | null>(null);

  // ----------------------------------------------------------
  // LOAD / RELOAD
  // ----------------------------------------------------------

  const reload = async () => {
    try {
      const data = await apiRequestCRM("/crm/bootstrap");

      const clientesBD = Array.isArray(data?.clientes) ? data.clientes : [];
      const contactosBD = Array.isArray(data?.contactos) ? data.contactos : [];
      const telefonosBD = Array.isArray(data?.telefonos) ? data.telefonos : [];
      const oportunidadesBD = Array.isArray(data?.oportunidades) ? data.oportunidades : [];
      const cotizacionesBD = Array.isArray(data?.cotizaciones) ? data.cotizaciones : [];
      const detallesBD = Array.isArray(data?.cotizacionDetalle)
        ? data.cotizacionDetalle
        : Array.isArray(data?.cotizacion_detalle)
        ? data.cotizacion_detalle
        : [];
      const prefijosBD = Array.isArray(data?.prefijos) ? data.prefijos : PREFIJOS_DEFAULT;

      const proveedoresBD = Array.isArray(data?.proveedores) ? data.proveedores : [];
      const contactosProveedorBD = Array.isArray(data?.contactosProveedor) ? data.contactosProveedor : [];
      const serviciosProveedorBD = Array.isArray(data?.serviciosProveedor) ? data.serviciosProveedor : [];
      const cumplimientosProveedorBD = Array.isArray(data?.cumplimientosProveedor) ? data.cumplimientosProveedor : [];
      const desempenosProveedorBD = Array.isArray(data?.desempenosProveedor) ? data.desempenosProveedor : [];
      const estadosProveedorBD = Array.isArray(data?.estadosProveedor) ? data.estadosProveedor : [];
      const rutasBD = Array.isArray(data?.rutas) ? data.rutas : [];

      setClients(
        clientesBD.map((c: any) => ({
          ...c,
          id: Number(c.id),
          estado_cliente_id: Number(c.estado_cliente_id || 1),
          motivo_inactivacion: c.motivo_inactivacion || null,
          fecha_inactivacion: c.fecha_inactivacion || null,
          nombre_estado_cliente: c.nombre_estado_cliente || estadoClienteNombre(Number(c.estado_cliente_id || 1)),
          created_at: c.created_at || new Date().toISOString(),
          updated_at: c.updated_at || new Date().toISOString(),
        }))
      );

      setContacts(
        contactosBD.map((c: any) => ({
          ...c,
          id: Number(c.id),
          cliente_id: Number(c.cliente_id),
          es_principal: Boolean(c.es_principal),
          estado: c.estado === false || c.estado === 0 ? false : true,
          created_at: c.created_at || new Date().toISOString(),
          updated_at: c.updated_at || new Date().toISOString(),
        }))
      );

      setPhones(
        telefonosBD.map((p: any) => ({
          ...p,
          id: Number(p.id),
          contacto_id: Number(p.contacto_id),
          prefijo_telefonico_id: p.prefijo_telefonico_id ? Number(p.prefijo_telefonico_id) : null,
          telefono: String(p.telefono || "").replace(/\D/g, ""),
          telefono_completo: p.telefono_completo || `${p.prefijo || ""} ${p.telefono || ""}`.trim(),
          prefijo: p.prefijo || null,
          codigo_pais: p.codigo_pais || null,
          tipo_telefono: p.tipo_telefono || "Principal",
          es_principal: Boolean(p.es_principal),
        }))
      );

      setOpportunities(
        oportunidadesBD.map((o: any, index: number) => ({
          id: Number(o.id) || index + 1,
          codigo_oportunidad: o.codigo_oportunidad || `OPO-${String(index + 1).padStart(3, "0")}`,
          cliente_id: o.cliente_id ? Number(o.cliente_id) : null,
          ejecutivo_id: o.ejecutivo_id ? Number(o.ejecutivo_id) : null,
          modalidad_id: o.modalidad_id ? Number(o.modalidad_id) : null,
          estado_id: Number(o.estado_id || 1),
          nombre_oportunidad: o.nombre_oportunidad || "Oportunidad",
          monto_estimado: Number(o.monto_estimado ?? 0),
          probabilidad: Number(o.probabilidad ?? 10),
          fecha_creacion: String(o.fecha_creacion || todayISO()).slice(0, 10),
          fecha_cierre_estimada: o.fecha_cierre_estimada ? String(o.fecha_cierre_estimada).slice(0, 10) : "",
          created_at: o.created_at || new Date().toISOString(),
          updated_at: o.updated_at || new Date().toISOString(),
        }))
      );

      setQuotes(
        cotizacionesBD.map((q: any, index: number) => {
          const codigo = q.codigo_cotizacion || q.numero_cotizacion || `COT-${String(index + 1).padStart(3, "0")}`;
          const meta = getQuoteUiMetadata(
            Number(q.id) || index + 1,
            codigo
          );

          return {
            id: Number(q.id) || index + 1,
            codigo_cotizacion: codigo,
            cliente_id: q.cliente_id ? Number(q.cliente_id) : null,
            contacto_id: q.contacto_id ? Number(q.contacto_id) : null,
            ejecutivo_id: q.ejecutivo_id ? Number(q.ejecutivo_id) : null,
            modalidad_id: q.modalidad_id ? Number(q.modalidad_id) : null,
            forma_pago_id: q.forma_pago_id ? Number(q.forma_pago_id) : null,
            origen_id: q.origen_id ? Number(q.origen_id) : null,
            destino_id: q.destino_id ? Number(q.destino_id) : null,
            fecha_ui: firstNonBlank(q.fecha_ui, meta.fecha_ui, q.fecha, q.created_at, todayISO()).slice(0, 10),
            estado_ui: (firstNonBlank(q.estado_ui, meta.estado_ui, q.estado, "Borrador") || "Borrador") as QuoteStatus,
            moneda_ui: firstNonBlank(q.moneda_ui, meta.moneda_ui, q.moneda, "GTQ").toUpperCase() === "USD" ? "USD" : "GTQ",
            tipo_carga_ui: firstNonBlank(q.tipo_carga_ui, meta.tipo_carga_ui, q.tipo_carga, q.nombre_modalidad),
            peso_ui: firstNonBlank(q.peso_ui, meta.peso_ui, q.peso),
            volumen_ui: firstNonBlank(q.volumen_ui, meta.volumen_ui, q.volumen),
            observaciones_ui: firstNonBlank(
              meta.observaciones_ui,
              q.observaciones_ui,
              q.observaciones
            ),
            no_incluye_ui:
              Array.isArray(meta.no_incluye_ui) && meta.no_incluye_ui.length
                ? meta.no_incluye_ui
                : [...QUOTE_NO_INCLUYE_DEFAULT],
            notas_importantes_ui:
              Array.isArray(meta.notas_importantes_ui) && meta.notas_importantes_ui.length
                ? meta.notas_importantes_ui
                : [...QUOTE_NOTAS_IMPORTANTES_DEFAULT],
          };
        })
      );

      const quoteCodeById = new Map<number, string>(
        cotizacionesBD.map((q: any, index: number) => [
          Number(q.id) || index + 1,
          q.codigo_cotizacion || q.numero_cotizacion || `COT-${String(index + 1).padStart(3, "0")}`,
        ])
      );
      const detailPositionByQuote = new Map<number, number>();

      setQuoteDetails(
        detallesBD.map((d: any, index: number) => {
          const cotizacionId = Number(d.cotizacion_id);
          const position = detailPositionByQuote.get(cotizacionId) || 0;
          detailPositionByQuote.set(cotizacionId, position + 1);
          const quoteCode = quoteCodeById.get(cotizacionId) || "";
          const meta = getQuoteUiMetadata(
            cotizacionId,
            quoteCode
          );
          const savedDays = meta.dias_ui_por_linea?.[position];

          return {
            id: Number(d.id) || index + 1,
            cotizacion_id: cotizacionId,
            descripcion: d.descripcion || "",
            cantidad: Number(d.cantidad ?? 1),
            precio_unitario: Number(d.precio_unitario ?? 0),
            dias_ui: Number(firstNonBlank(d.dias_ui, d.dias, savedDays, 1)),
          };
        })
      );

      setModalidades(Array.isArray(data?.modalidades) ? data.modalidades : []);
      setFormasPago(Array.isArray(data?.formasPago) ? data.formasPago : []);
      setUbicaciones(Array.isArray(data?.ubicaciones) ? data.ubicaciones : []);
      setRoles(Array.isArray(data?.roles) ? data.roles : []);
      setUsuarios(Array.isArray(data?.usuarios) ? data.usuarios : []);
      setPrefijos(
        prefijosBD.map((p: any) => ({
          id: Number(p.id),
          codigo_pais: String(p.codigo_pais || "GT"),
          pais: String(p.pais || "Guatemala"),
          prefijo: String(p.prefijo || "+502"),
          ejemplo: p.ejemplo || null,
          activo: p.activo === 0 || p.activo === false ? false : true,
        }))
      );


      setProviders(
        proveedoresBD.map((p: any) => ({
          ...p,
          id: Number(p.id),
          estado_id: Number(p.estado_id || 1),
          desempeno: (p.desempeno || "Amarillo") as ProviderLevel,
          estado_sat: (p.estado_sat || "pendiente") as ProviderSat,
        }))
      );
      setProviderContacts(
        contactosProveedorBD.map((c: any) => ({
          ...c,
          id: Number(c.id),
          proveedor_id: Number(c.proveedor_id),
          es_principal: Boolean(c.es_principal),
          estado: c.estado === 0 || c.estado === false ? false : true,
        }))
      );
      setProviderServices(
        serviciosProveedorBD.map((s: any) => ({
          ...s,
          id: Number(s.id),
          proveedor_id: Number(s.proveedor_id),
          es_principal: Boolean(s.es_principal),
        }))
      );
      setProviderCompliance(
        cumplimientosProveedorBD.map((c: any) => ({
          ...c,
          id: Number(c.id),
          proveedor_id: Number(c.proveedor_id),
          estado_sat: (c.estado_sat || "pendiente") as ProviderSat,
          lista_clinton: Boolean(c.lista_clinton),
          rtu_validado: Boolean(c.rtu_validado),
          licencia_validada: Boolean(c.licencia_validada),
          cuenta_validada: Boolean(c.cuenta_validada),
        }))
      );
      setProviderPerformance(
        desempenosProveedorBD.map((d: any) => ({
          ...d,
          id: Number(d.id),
          proveedor_id: Number(d.proveedor_id),
          nivel: (d.nivel || "Amarillo") as ProviderLevel,
        }))
      );
      setProviderStates(estadosProveedorBD);
      setCrmRoutes(
        rutasBD.map((r: any) => ({
          ...r,
          id: Number(r.id),
          origen_id: Number(r.origen_id),
          destino_id: Number(r.destino_id),
          distancia_km: r.distancia_km == null ? null : Number(r.distancia_km),
        }))
      );

      setNotice({
        type: "success",
        text: `CRM conectado a MySQL: ${clientesBD.length} clientes cargados.`,
      });
      window.setTimeout(() => setNotice(null), 3200);
    } catch (error: any) {
      console.error("Error cargando CRM desde backend:", error);
      setNotice({
        type: "error",
        text: `No se pudo conectar CRM con MySQL: ${error?.message || "error desconocido"}.`,
      });

      // Ya no cargamos datos demo para no confundirlos con la base real.
      setClients([]);
      setContacts([]);
      setPhones([]);
      setOpportunities([]);
      setQuotes([]);
      setQuoteDetails([]);
      setModalidades([]);
      setFormasPago([]);
      setUbicaciones([]);
      setRoles([]);
      setUsuarios([]);
      setPrefijos([]);
      setProviders([]);
      setProviderContacts([]);
      setProviderServices([]);
      setProviderCompliance([]);
      setProviderPerformance([]);
      setProviderStates([]);
      setCrmRoutes([]);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    setSearchQuery("");
    setStatusFilter("Todos");
    setLeadStageFilter("Todos");
    setProviderStatusFilter("Todos");
    setProviderLevelFilter("Todos");
    setProviderSatFilter("Todos");

    // Orden natural del sistema: último ingresado primero,
    // sin mostrar ninguna columna como filtro/orden activo.
    setSortField("");
    setCrmSortDirection("desc");

    setLeadPage(1);
    setClientPage(1);
    setQuotePage(1);
    setProviderPage(1);
  }, [activeTab]);

  const showNotice = (type: "success" | "error", text: string) => {
    setNotice({ type, text });
    window.setTimeout(() => setNotice(null), 3200);
  };

  // ----------------------------------------------------------
  // DERIVED / JOINS
  // ----------------------------------------------------------

  const salesUsers = useMemo(() => {
    const allowedRoleIds = roles
      .filter((r) => ["gerencia", "ventas"].includes(String(r.codigo_rol).toLowerCase()))
      .map((r) => r.id);
    return usuarios.filter((u) => u.activo !== false && (allowedRoleIds.length ? allowedRoleIds.includes(Number(u.rol_id)) : true));
  }, [usuarios, roles]);

  const leads: LeadView[] = useMemo(
    () =>
      opportunities.map((o) => {
        const c = clients.find((x) => x.id === o.cliente_id);
        const u = usuarios.find((x) => x.id === o.ejecutivo_id);
        const m = modalidades.find((x) => x.id === o.modalidad_id);
        return {
          id: o.id,
          code: o.codigo_oportunidad,
          clientId: o.cliente_id,
          clientName: c?.nombre_empresa || "Cliente no asignado",
          opportunityName: o.nombre_oportunidad,
          modalityId: o.modalidad_id,
          type: m?.nombre_modalidad || "Sin modalidad",
          executiveId: o.ejecutivo_id,
          executive: fullUserName(u) || u?.nombre_usuario || "Sin ejecutivo",
          date: o.fecha_creacion,
          closeDate: o.fecha_cierre_estimada,
          probability: Number(o.probabilidad || 0),
          amount: Number(o.monto_estimado || 0),
          stage: estadoIdToStage(Number(o.estado_id || 1)),
        };
      }),
    [opportunities, clients, usuarios, modalidades]
  );

  const quoteViews: QuoteView[] = useMemo(
    () =>
      quotes.map((q) => {
        const c = clients.find((x) => x.id === q.cliente_id);
        const ct = contacts.find((x) => x.id === q.contacto_id);
        const u = usuarios.find((x) => x.id === q.ejecutivo_id);
        const m = modalidades.find((x) => x.id === q.modalidad_id);
        const fp = formasPago.find((x) => x.id === q.forma_pago_id);
        const ori = ubicaciones.find((x) => x.id === q.origen_id);
        const des = ubicaciones.find((x) => x.id === q.destino_id);
        const ds = quoteDetails.filter((d) => d.cotizacion_id === q.id);
        const services: QuoteServiceView[] = ds.map((d) => ({
          id: d.id,
          description: d.descripcion,
          quantity: Number(d.cantidad || 0),
          unitPrice: Number(d.precio_unitario || 0),
          subtotal: Number(d.cantidad || 0) * Number(d.precio_unitario || 0),
          days: Number(d.dias_ui || 0),
        }));
        const subtotal = services.reduce((s, d) => s + d.subtotal, 0);
        const iva = subtotal * 0.12;
        const total = subtotal + iva;
        return {
          id: q.id,
          quoteNumber: q.codigo_cotizacion,
          clientId: q.cliente_id,
          clientName: c?.nombre_empresa || "Cliente no asignado",
          nit: c?.nit || "C/F",
          contactId: q.contacto_id,
          contact: fullContactName(ct) || "Sin contacto",
          email: ct?.correo || "",
          executiveId: q.ejecutivo_id,
          executive: fullUserName(u) || u?.nombre_usuario || "Sin ejecutivo",
          modalityId: q.modalidad_id,
          modality: m?.nombre_modalidad || "Sin modalidad",
          paymentMethodId: q.forma_pago_id,
          paymentMethod: fp?.nombre_forma_pago || "Sin forma de pago",
          originId: q.origen_id,
          origin: ori ? `${ori.nombre_ubicacion}, ${ori.pais}` : "",
          destinationId: q.destino_id,
          destination: des ? `${des.nombre_ubicacion}, ${des.pais}` : "",
          date: q.fecha_ui,
          status: q.estado_ui,
          currency: q.moneda_ui,
          cargoType: q.tipo_carga_ui,
          weight: q.peso_ui,
          volume: q.volumen_ui,
          observations: q.observaciones_ui,
          noIncluye:
            Array.isArray(q.no_incluye_ui) && q.no_incluye_ui.length
              ? q.no_incluye_ui
              : [...QUOTE_NO_INCLUYE_DEFAULT],
          notasImportantes:
            Array.isArray(q.notas_importantes_ui) && q.notas_importantes_ui.length
              ? q.notas_importantes_ui
              : [...QUOTE_NOTAS_IMPORTANTES_DEFAULT],
          services,
          subtotal,
          iva,
          total,
        };
      }),
    [quotes, clients, contacts, usuarios, modalidades, formasPago, ubicaciones, quoteDetails]
  );

  const principalContact = (clientId: number) =>
    contacts.find((c) => c.cliente_id === clientId && c.es_principal && c.estado) ||
    contacts.find((c) => c.cliente_id === clientId && c.estado);

  const prefixOptions = (prefijos.length ? prefijos : PREFIJOS_DEFAULT).filter((p) => p.activo !== false && p.activo !== 0);

  const getPhonePrefix = (id?: number | null) =>
    prefixOptions.find((p) => Number(p.id) === Number(id)) ||
    prefixOptions.find((p) => p.codigo_pais === "GT") ||
    PREFIJOS_DEFAULT[0];

  const phoneDigitsLimit = (id?: number | null) => {
    const p = getPhonePrefix(id);
    return PHONE_DIGITS_BY_COUNTRY[p.codigo_pais] || 8;
  };

  const formatPhone = (phone?: Partial<TelefonoContactoRow> | null) => {
    if (!phone) return "";
    const prefix = phone.prefijo || getPhonePrefix(phone.prefijo_telefonico_id).prefijo;
    return `${prefix} ${phone.telefono || ""}`.trim();
  };


  // ----------------------------------------------------------
  // FILTERS
  // ----------------------------------------------------------


  const compareValues = (a: any, b: any) => {
    const emptyA = a === null || a === undefined || a === "";
    const emptyB = b === null || b === undefined || b === "";
    if (emptyA && emptyB) return 0;
    if (emptyA) return crmSortDirection === "asc" ? 1 : -1;
    if (emptyB) return crmSortDirection === "asc" ? -1 : 1;

    if (typeof a === "number" || typeof b === "number") {
      const diff = Number(a || 0) - Number(b || 0);
      return crmSortDirection === "asc" ? diff : -diff;
    }

    const av = String(a).toLocaleLowerCase("es-GT");
    const bv = String(b).toLocaleLowerCase("es-GT");
    const diff = av.localeCompare(bv, "es");
    return crmSortDirection === "asc" ? diff : -diff;
  };


  const providerMainContact = (providerId: number) => {
    const rows = providerContacts.filter(
      (c) => Number(c.proveedor_id) === Number(providerId) && c.estado !== false
    );
    return rows.find((c) => c.es_principal) || rows[0];
  };

  const providerMainService = (providerId: number) => {
    const rows = providerServices.filter(
      (s) => Number(s.proveedor_id) === Number(providerId)
    );
    return rows.find((s) => s.es_principal) || rows[0];
  };

  const providerComplianceFor = (providerId: number) =>
    providerCompliance.find((c) => Number(c.proveedor_id) === Number(providerId));

  const providerPerformanceFor = (providerId: number) =>
    [...providerPerformance]
      .filter((d) => Number(d.proveedor_id) === Number(providerId))
      .sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")))[0];

  const providerStatusName = (p: ProviderRow) =>
    p.nombre_estado_proveedor || p.estado || (Number(p.estado_id) === 2 ? "Inactivo" : "Activo");

  const filteredProviders = useMemo(() => {
    const s = searchQuery.trim().toLowerCase();
    return providers.filter((p) => {
      const contact = providerMainContact(p.id);
      const service = providerMainService(p.id);
      const perf = providerPerformanceFor(p.id)?.nivel || p.desempeno || "Amarillo";
      const sat = providerComplianceFor(p.id)?.estado_sat || p.estado_sat || "pendiente";
      const status = providerStatusName(p);
      const contactName = fullContactName(contact as any);

      return (
        (!s ||
          p.codigo_proveedor.toLowerCase().includes(s) ||
          p.razon_social.toLowerCase().includes(s) ||
          String(p.nombre_comercial || "").toLowerCase().includes(s) ||
          p.nit.toLowerCase().includes(s) ||
          contactName.toLowerCase().includes(s) ||
          String(service?.nombre_servicio_proveedor || "").toLowerCase().includes(s)) &&
        (providerStatusFilter === "Todos" || status === providerStatusFilter) &&
        (providerLevelFilter === "Todos" || perf === providerLevelFilter) &&
        (providerSatFilter === "Todos" || sat === providerSatFilter)
      );
    });
  }, [providers, providerContacts, providerServices, providerCompliance, providerPerformance, searchQuery, providerStatusFilter, providerLevelFilter, providerSatFilter]);

  const sortedProviders = useMemo(() => {
    const rows = [...filteredProviders];
    rows.sort((a, b) => {
      if (!sortField) return b.id - a.id;
      const aContact = providerMainContact(a.id);
      const bContact = providerMainContact(b.id);
      const aService = providerMainService(a.id);
      const bService = providerMainService(b.id);
      const aPerf = providerPerformanceFor(a.id)?.nivel || a.desempeno || "Amarillo";
      const bPerf = providerPerformanceFor(b.id)?.nivel || b.desempeno || "Amarillo";
      const aSat = providerComplianceFor(a.id)?.estado_sat || a.estado_sat || "pendiente";
      const bSat = providerComplianceFor(b.id)?.estado_sat || b.estado_sat || "pendiente";

      const av =
        sortField === "providerCode" ? a.codigo_proveedor :
        sortField === "providerName" ? a.razon_social :
        sortField === "providerNit" ? a.nit :
        sortField === "providerService" ? aService?.nombre_servicio_proveedor || "" :
        sortField === "providerContact" ? fullContactName(aContact as any) :
        sortField === "providerPerformance" ? aPerf :
        sortField === "providerSat" ? aSat :
        sortField === "providerStatus" ? providerStatusName(a) : a.id;

      const bv =
        sortField === "providerCode" ? b.codigo_proveedor :
        sortField === "providerName" ? b.razon_social :
        sortField === "providerNit" ? b.nit :
        sortField === "providerService" ? bService?.nombre_servicio_proveedor || "" :
        sortField === "providerContact" ? fullContactName(bContact as any) :
        sortField === "providerPerformance" ? bPerf :
        sortField === "providerSat" ? bSat :
        sortField === "providerStatus" ? providerStatusName(b) : b.id;

      return compareValues(av, bv);
    });
    return rows;
  }, [filteredProviders, sortField, crmSortDirection, providerContacts, providerServices, providerCompliance, providerPerformance]);

  const filteredClients = useMemo(() => {
    const s = searchQuery.trim().toLowerCase();
    return clients.filter((c) => {
      const pc = principalContact(c.id);
      const matches =
        !s ||
        c.codigo_cliente.toLowerCase().includes(s) ||
        c.nombre_empresa.toLowerCase().includes(s) ||
        c.nit.toLowerCase().includes(s) ||
        fullContactName(pc).toLowerCase().includes(s) ||
        String(pc?.correo || "").toLowerCase().includes(s);
      const status = estadoClienteNombre(c.estado_cliente_id);
      return matches && (statusFilter === "Todos" || status === statusFilter);
    });
  }, [clients, contacts, searchQuery, statusFilter]);

  const sortedClients = useMemo(() => {
    const rows = [...filteredClients];
    rows.sort((a, b) => {
      // Sin columna seleccionada: nuevo -> antiguo.
      if (!sortField) return b.id - a.id;

      const ac = principalContact(a.id);
      const bc = principalContact(b.id);

      const av =
        sortField === "codigo_cliente" ? a.codigo_cliente :
        sortField === "nit" ? a.nit :
        sortField === "estado" ? estadoClienteNombre(a.estado_cliente_id) :
        sortField === "contacto" ? fullContactName(ac) :
        sortField === "nombre_empresa" ? a.nombre_empresa :
        a.id;

      const bv =
        sortField === "codigo_cliente" ? b.codigo_cliente :
        sortField === "nit" ? b.nit :
        sortField === "estado" ? estadoClienteNombre(b.estado_cliente_id) :
        sortField === "contacto" ? fullContactName(bc) :
        sortField === "nombre_empresa" ? b.nombre_empresa :
        b.id;

      return compareValues(av, bv);
    });
    return rows;
  }, [filteredClients, contacts, sortField, crmSortDirection]);

  const filteredLeads = useMemo(() => {
    const normalizeSearch = (value: any) =>
      String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

    const searchTerms = normalizeSearch(searchQuery)
      .split(" ")
      .filter(Boolean);

    const stageNames: Record<Stage, string> = {
      prospecto: "Prospecto",
      cotizado: "Cotizado",
      negociacion: "Negociación",
      ganado: "Ganado",
      perdido: "Perdido",
    };

    return leads.filter((lead) => {
      const haystack = normalizeSearch(
        [
          lead.code,
          lead.opportunityName,
          lead.clientName,
          lead.type,
          lead.executive,
          lead.date,
          lead.closeDate,
          lead.probability,
          lead.amount,
          lead.stage,
          stageNames[lead.stage],
        ].join(" ")
      );

      // Permite escribir varias palabras en cualquier orden.
      // Ej.: "Hidra exportación", "OPO 25", "Melissa FTL".
      const matches =
        searchTerms.length === 0 ||
        searchTerms.every((term) => haystack.includes(term));

      const stageMatches =
        leadStageFilter === "Todos" ||
        lead.stage === leadStageFilter;

      return matches && stageMatches;
    });
  }, [leads, searchQuery, leadStageFilter]);

  const sortedLeads = useMemo(() => {
    const stageOrder: Record<Stage, number> = { prospecto: 1, cotizado: 2, negociacion: 3, ganado: 4, perdido: 5 };
    const rows = [...filteredLeads];

    rows.sort((a, b) => {
      // Sin columna seleccionada: nuevo -> antiguo.
      if (!sortField) return b.id - a.id;

      const av =
        sortField === "amount" ? a.amount :
        sortField === "probability" ? a.probability :
        sortField === "closeDate" ? a.closeDate :
        sortField === "clientName" ? a.clientName :
        sortField === "opportunityName" ? a.opportunityName :
        sortField === "stage" ? stageOrder[a.stage] :
        a.date;

      const bv =
        sortField === "amount" ? b.amount :
        sortField === "probability" ? b.probability :
        sortField === "closeDate" ? b.closeDate :
        sortField === "clientName" ? b.clientName :
        sortField === "opportunityName" ? b.opportunityName :
        sortField === "stage" ? stageOrder[b.stage] :
        b.date;

      const compared = compareValues(av, bv);
      if (compared !== 0) return compared;

      return crmSortDirection === "asc"
        ? a.id - b.id
        : b.id - a.id;
    });

    return rows;
  }, [filteredLeads, sortField, crmSortDirection]);

  const filteredQuotes = useMemo(() => {
    const s = searchQuery.trim().toLowerCase();
    return quoteViews.filter((q) => {
      const matches =
        !s ||
        q.quoteNumber.toLowerCase().includes(s) ||
        q.clientName.toLowerCase().includes(s) ||
        q.nit.toLowerCase().includes(s) ||
        q.contact.toLowerCase().includes(s);
      return matches && (statusFilter === "Todos" || q.status === statusFilter);
    });
  }, [quoteViews, searchQuery, statusFilter]);

  const sortedQuotes = useMemo(() => {
    const rows = [...filteredQuotes];
    rows.sort((a, b) => {
      // Sin columna seleccionada: nuevo -> antiguo.
      if (!sortField) return b.id - a.id;

      const av =
        sortField === "quoteNumber" ? a.quoteNumber :
        sortField === "clientName" ? a.clientName :
        sortField === "status" ? a.status :
        sortField === "total" ? a.total :
        sortField === "contact" ? a.contact :
        a.id;

      const bv =
        sortField === "quoteNumber" ? b.quoteNumber :
        sortField === "clientName" ? b.clientName :
        sortField === "status" ? b.status :
        sortField === "total" ? b.total :
        sortField === "contact" ? b.contact :
        b.id;

      return compareValues(av, bv);
    });
    return rows;
  }, [filteredQuotes, sortField, crmSortDirection]);

  // La paginación se aplica DESPUÉS de buscar, filtrar y ordenar.
  // Así cada página conserva exactamente el resultado visible del usuario.
  const leadTotalPages = Math.max(1, Math.ceil(sortedLeads.length / rowsPerPage));
  const clientTotalPages = Math.max(1, Math.ceil(sortedClients.length / rowsPerPage));
  const quoteTotalPages = Math.max(1, Math.ceil(sortedQuotes.length / rowsPerPage));
  const providerTotalPages = Math.max(1, Math.ceil(sortedProviders.length / rowsPerPage));

  const paginatedLeads = useMemo(() => {
    const start = (leadPage - 1) * rowsPerPage;
    return sortedLeads.slice(start, start + rowsPerPage);
  }, [sortedLeads, leadPage, rowsPerPage]);

  const paginatedClients = useMemo(() => {
    const start = (clientPage - 1) * rowsPerPage;
    return sortedClients.slice(start, start + rowsPerPage);
  }, [sortedClients, clientPage, rowsPerPage]);

  const paginatedQuotes = useMemo(() => {
    const start = (quotePage - 1) * rowsPerPage;
    return sortedQuotes.slice(start, start + rowsPerPage);
  }, [sortedQuotes, quotePage, rowsPerPage]);

  const paginatedProviders = useMemo(() => {
    const start = (providerPage - 1) * rowsPerPage;
    return sortedProviders.slice(start, start + rowsPerPage);
  }, [sortedProviders, providerPage, rowsPerPage]);

  // Cuando cambia una búsqueda, filtro, ordenamiento o cantidad por página,
  // regresamos a la primera página del listado activo.
  useEffect(() => {
    if (activeTab === "seguimiento") {
      setLeadPage(1);
    }

    if (activeTab === "clientes") {
      setClientPage(1);
    }

    if (activeTab === "cotizaciones") {
      setQuotePage(1);
    }

    if (activeTab === "proveedores") {
      setProviderPage(1);
    }
  }, [activeTab, searchQuery, statusFilter, leadStageFilter, providerStatusFilter, providerLevelFilter, providerSatFilter, sortField, crmSortDirection, rowsPerPage]);

  // Protección adicional por si después de actualizar MySQL disminuye
  // la cantidad de registros y la página actual deja de existir.
  useEffect(() => {
    setLeadPage((page) => Math.min(page, leadTotalPages));
  }, [leadTotalPages]);

  useEffect(() => {
    setClientPage((page) => Math.min(page, clientTotalPages));
  }, [clientTotalPages]);

  useEffect(() => {
    setQuotePage((page) => Math.min(page, quoteTotalPages));
  }, [quoteTotalPages]);

  useEffect(() => {
    setProviderPage((page) => Math.min(page, providerTotalPages));
  }, [providerTotalPages]);

  // ----------------------------------------------------------
  // CLIENT CRUD
  // ----------------------------------------------------------

  const openClient = (
    mode: ModalMode,
    client?: ClienteRow
  ) => {
    setClientErrors({});

    if (mode === "create") {
      // Cada cliente nuevo inicia con su propio conjunto
      // temporal de contactos y teléfonos.
      setNewClientContacts([]);
      setNewClientPhones([]);
      draftContactIdRef.current = -1;
      draftPhoneIdRef.current = -1;

      setClientModal({
        open: true,
        mode,
        value: {
          codigo_cliente: nextCode(
            clients,
            "codigo_cliente",
            "CLI"
          ),
          nombre_empresa: "",
          nit: "",
          direccion: "",
          estado_cliente_id: 1,
        } as Partial<ClienteRow>,
      });

      return;
    }

    setClientModal({
      open: true,
      mode,
      value: client ? { ...client } : {},
    });
  };

  const openNewClientFrom = (target: "lead" | "quote") => {
    setClientReturnTarget(target);
    openClient("create");
  };

  const newClientPhonesFor = (contactId: number) =>
    newClientPhones
      .filter(
        (phone) =>
          Number(phone.contacto_id) ===
          Number(contactId)
      )
      .sort((a, b) => {
        if (
          Boolean(a.es_principal) !==
          Boolean(b.es_principal)
        ) {
          return a.es_principal ? -1 : 1;
        }

        return Number(b.id) - Number(a.id);
      });

  const removeNewClientContact = (contactId: number) => {
    setNewClientContacts((current) => {
      const remaining = current.filter(
        (contact) =>
          Number(contact.id) !== Number(contactId)
      );

      // Si se eliminó el principal y todavía quedan contactos,
      // el primero pasa a ser principal automáticamente.
      if (
        remaining.length > 0 &&
        !remaining.some(
          (contact) => contact.es_principal
        )
      ) {
        return remaining.map((contact, index) => ({
          ...contact,
          es_principal: index === 0,
        }));
      }

      return remaining;
    });

    setNewClientPhones((current) =>
      current.filter(
        (phone) =>
          Number(phone.contacto_id) !==
          Number(contactId)
      )
    );

    showNotice(
      "success",
      "Contacto quitado del nuevo cliente."
    );
  };

  const removeNewClientPhone = (phoneId: number) => {
    const currentPhone = newClientPhones.find(
      (phone) => Number(phone.id) === Number(phoneId)
    );

    setNewClientPhones((current) => {
      const remaining = current.filter(
        (phone) =>
          Number(phone.id) !== Number(phoneId)
      );

      if (!currentPhone) return remaining;

      const sameContact = remaining.filter(
        (phone) =>
          Number(phone.contacto_id) ===
          Number(currentPhone.contacto_id)
      );

      if (
        sameContact.length > 0 &&
        !sameContact.some(
          (phone) => phone.es_principal
        )
      ) {
        const firstId = sameContact[0].id;

        return remaining.map((phone) =>
          Number(phone.id) === Number(firstId)
            ? { ...phone, es_principal: true }
            : phone
        );
      }

      return remaining;
    });

    setPhoneModal({
      open: false,
      mode: "create",
      value: {},
      contactId: null,
    });

    showNotice(
      "success",
      "Teléfono quitado del contacto."
    );
  };

  const validateClient = () => {
    const v = clientModal.value;
    const e: FieldErrors = {};

    if (!String(v.nombre_empresa || "").trim()) {
      e.nombre_empresa =
        "El nombre de la empresa es obligatorio.";
    }

    if (!String(v.nit || "").trim()) {
      e.nit = "El NIT es obligatorio.";
    }

    if (clientModal.mode === "create") {
      if (newClientContacts.length === 0) {
        e.contactos =
          "Agrega por lo menos un contacto del cliente.";
      } else if (
        !newClientContacts.some(
          (contact) => contact.es_principal
        )
      ) {
        e.contactos =
          "Debe existir un contacto principal.";
      }
    }

    const duplicate = clients.some(
      (client) =>
        client.nit.trim().toLowerCase() ===
          String(v.nit || "")
            .trim()
            .toLowerCase() &&
        client.id !== Number(v.id)
    );

    if (duplicate) {
      e.nit =
        "Ya existe un cliente registrado con ese NIT.";
    }

    setClientErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveClientData = async () => {
    if (!validateClient()) return;

    // El cliente se guarda independiente de sus contactos.
    // Los contactos y teléfonos se registran después usando
    // sus endpoints normales, lo cual permite N contactos y
    // N teléfonos por contacto.
    const payload = {
      codigo_cliente:
        clientModal.value.codigo_cliente,
      nombre_empresa: cleanCommercialText(
        String(
          clientModal.value.nombre_empresa || ""
        ),
        120
      ),
      nit: String(
        clientModal.value.nit || ""
      ).trim(),
      direccion: cleanAddressText(
        String(
          clientModal.value.direccion || ""
        ),
        180
      ),
      estado_cliente_id: Number(
        clientModal.value.estado_cliente_id || 1
      ),
    };

    try {
      let createdClientId: number | null = null;
      let createdPrincipalContactId:
        | number
        | null = null;

      if (clientModal.mode === "create") {
        const created = await apiSendCRM(
          "/clientes",
          "POST",
          payload
        );

        createdClientId =
          Number(
            created?.id ||
              created?.cliente_id ||
              created?.insertId ||
              0
          ) || null;

        // Recuperación por NIT si el endpoint no devolviera ID.
        if (!createdClientId) {
          const fresh =
            await apiRequestCRM(
              "/crm/bootstrap"
            );

          const found = (
            Array.isArray(fresh?.clientes)
              ? fresh.clientes
              : []
          ).find(
            (client: any) =>
              String(client.nit || "")
                .trim()
                .toLowerCase() ===
              payload.nit.toLowerCase()
          );

          createdClientId =
            Number(found?.id || 0) || null;
        }

        if (!createdClientId) {
          throw new Error(
            "El cliente se guardó, pero no fue posible recuperar su ID para registrar los contactos."
          );
        }

        // Guardar los no principales primero y el principal al final.
        // Así queda exactamente un principal en MySQL.
        const orderedContacts = [
          ...newClientContacts,
        ].sort(
          (a, b) =>
            Number(a.es_principal) -
            Number(b.es_principal)
        );

        for (const draftContact of orderedContacts) {
          const contactPayload = {
            cliente_id: createdClientId,
            primer_nombre:
              cleanPersonName(
                String(
                  draftContact.primer_nombre ||
                    ""
                ),
                35
              ),
            segundo_nombre:
              cleanPersonName(
                String(
                  draftContact.segundo_nombre ||
                    ""
                ),
                35
              ),
            primer_apellido:
              cleanPersonName(
                String(
                  draftContact.primer_apellido ||
                    ""
                ),
                35
              ),
            segundo_apellido:
              cleanPersonName(
                String(
                  draftContact.segundo_apellido ||
                    ""
                ),
                35
              ),
            cargo: cleanRoleText(
              String(
                draftContact.cargo || ""
              ),
              60
            ),
            correo: cleanEmail(
              String(
                draftContact.correo || ""
              )
            ),
            es_principal: Boolean(
              draftContact.es_principal
            ),
            estado:
              draftContact.estado !== false,
          };

          const createdContact =
            await apiSendCRM(
              "/contactos-cliente",
              "POST",
              contactPayload
            );

          let realContactId =
            Number(
              createdContact?.id ||
                createdContact
                  ?.contacto_id ||
                createdContact
                  ?.insertId ||
                0
            ) || null;

          if (!realContactId) {
            const fresh =
              await apiRequestCRM(
                "/crm/bootstrap"
              );

            const possibleContacts =
              Array.isArray(
                fresh?.contactos
              )
                ? fresh.contactos
                : [];

            const found = [
              ...possibleContacts,
            ]
              .reverse()
              .find(
                (contact: any) =>
                  Number(
                    contact.cliente_id
                  ) ===
                    Number(
                      createdClientId
                    ) &&
                  String(
                    contact.primer_nombre ||
                      ""
                  )
                    .trim()
                    .toLowerCase() ===
                    String(
                      contactPayload
                        .primer_nombre || ""
                    )
                      .trim()
                      .toLowerCase() &&
                  String(
                    contact.primer_apellido ||
                      ""
                  )
                    .trim()
                    .toLowerCase() ===
                    String(
                      contactPayload
                        .primer_apellido || ""
                    )
                      .trim()
                      .toLowerCase() &&
                  String(
                    contact.correo || ""
                  )
                    .trim()
                    .toLowerCase() ===
                    String(
                      contactPayload.correo ||
                        ""
                    )
                      .trim()
                      .toLowerCase()
              );

            realContactId =
              Number(found?.id || 0) ||
              null;
          }

          if (!realContactId) {
            throw new Error(
              `No se pudo recuperar el contacto ${contactPayload.primer_nombre} ${contactPayload.primer_apellido}.`
            );
          }

          if (draftContact.es_principal) {
            createdPrincipalContactId =
              realContactId;
          }

          const draftPhones =
            newClientPhones
              .filter(
                (phone) =>
                  Number(
                    phone.contacto_id
                  ) ===
                  Number(
                    draftContact.id
                  )
              )
              .sort(
                (a, b) =>
                  Number(a.es_principal) -
                  Number(b.es_principal)
              );

          for (const draftPhone of draftPhones) {
            const limit =
              phoneDigitsLimit(
                draftPhone
                  .prefijo_telefonico_id
              );

            await apiSendCRM(
              "/telefonos-contacto",
              "POST",
              {
                contacto_id:
                  realContactId,
                prefijo_telefonico_id:
                  Number(
                    draftPhone
                      .prefijo_telefonico_id ||
                      getPhonePrefix().id
                  ),
                telefono: cleanPhone(
                  String(
                    draftPhone.telefono ||
                      ""
                  ),
                  limit
                ),
                tipo_telefono: String(
                  draftPhone.tipo_telefono ||
                    "Móvil"
                ),
                es_principal: Boolean(
                  draftPhone.es_principal
                ),
              }
            );
          }
        }
      } else if (
        clientModal.mode === "edit" &&
        clientModal.value.id
      ) {
        // En edición, contactos y teléfonos se administran
        // desde sus propios botones/modal. Aquí solo se
        // actualiza la información de la empresa.
        await apiSendCRM(
          `/clientes/${clientModal.value.id}`,
          "PUT",
          payload
        );
      }

      await reload();

      if (
        clientModal.mode === "create" &&
        clientReturnTarget &&
        createdClientId
      ) {
        if (clientReturnTarget === "lead") {
          setLeadErrors((current) => ({
            ...current,
            cliente_id: "",
          }));

          setLeadModal((current) => ({
            ...current,
            value: {
              ...current.value,
              cliente_id:
                createdClientId,
            },
          }));
        } else {
          setQuoteErrors((current) => ({
            ...current,
            cliente_id: "",
            contacto_id: "",
          }));

          setQuoteModal((current) => ({
            ...current,
            value: {
              ...current.value,
              cliente_id:
                createdClientId,
              contacto_id:
                createdPrincipalContactId,
            },
          }));
        }

        setClientModal({
          open: false,
          mode: "create",
          value: {},
        });
        setNewClientContacts([]);
        setNewClientPhones([]);
        setClientReturnTarget(null);

        showNotice(
          "success",
          clientReturnTarget === "quote"
            ? "Cliente creado con sus contactos y teléfonos. El contacto principal quedó seleccionado en la cotización."
            : "Cliente creado con sus contactos y seleccionado en la oportunidad."
        );

        return;
      }

      setSearchQuery("");
      setStatusFilter("Todos");
      setSortField("");
      setCrmSortDirection("desc");
      setClientPage(1);
      selectCrmTab("clientes");

      setClientModal({
        open: false,
        mode: "create",
        value: {},
      });

      setNewClientContacts([]);
      setNewClientPhones([]);
      setClientReturnTarget(null);

      showNotice(
        "success",
        clientModal.mode === "create"
          ? "Cliente, contactos y teléfonos guardados correctamente en MySQL."
          : "Cliente actualizado correctamente en MySQL."
      );
    } catch (error: any) {
      showNotice(
        "error",
        error.message ||
          "No se pudo guardar el cliente en MySQL."
      );
    }
  };

  const openClientStatusAction = (client: ClienteRow) => {
    setClientInactiveReason("");
    setDeleteModal({
      open: true,
      type: "client",
      id: client.id,
    });
  };

  const openClientPermanentDelete = (client: ClienteRow) => {
    setClientInactiveReason("");
    setDeleteModal({
      open: true,
      type: "clientPermanent",
      id: client.id,
    });
  };

  const syncLegacyClients = (rows: ClienteRow[]) => {
    writeArray(
      "clients",
      rows.map((c) => ({
        id: String(c.id),
        name: c.nombre_empresa,
        nit: c.nit,
        address: c.direccion,
        status: estadoClienteNombre(c.estado_cliente_id),
      }))
    );
  };

  // ----------------------------------------------------------
  // CONTACT CRUD
  // ----------------------------------------------------------

  const openContact = (
    mode: ModalMode,
    clientId: number,
    contact?: ContactoClienteRow
  ) => {
    setContactErrors({});

    const isDraftClient =
      Number(clientId) === -1;

    const currentContacts =
      isDraftClient
        ? newClientContacts
        : contacts.filter(
            (item) =>
              Number(item.cliente_id) ===
              Number(clientId)
          );

    setContactModal({
      open: true,
      mode,
      clientId,
      value:
        contact ||
        ({
          cliente_id:
            isDraftClient
              ? 0
              : clientId,
          primer_nombre: "",
          segundo_nombre: "",
          primer_apellido: "",
          segundo_apellido: "",
          cargo: "",
          correo: "",
          es_principal:
            currentContacts.length === 0,
          estado: true,
        } as Partial<ContactoClienteRow>),
    });
  };

  const validateContact = () => {
    const v = contactModal.value;
    const e: FieldErrors = {};

    if (
      !String(v.primer_nombre || "").trim()
    ) {
      e.primer_nombre =
        "El primer nombre es obligatorio.";
    }

    if (
      !String(v.primer_apellido || "").trim()
    ) {
      e.primer_apellido =
        "El primer apellido es obligatorio.";
    }

    if (
      v.correo &&
      !validEmail(String(v.correo))
    ) {
      e.correo =
        "Ingresa un correo electrónico válido.";
    }

    setContactErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveContactData = async () => {
    if (!validateContact()) return;

    const isDraftClient =
      Number(contactModal.clientId) === -1;

    if (isDraftClient) {
      const isPrincipal = Boolean(
        contactModal.value.es_principal
      );

      const cleanDraft = {
        primer_nombre:
          cleanPersonName(
            String(
              contactModal.value
                .primer_nombre || ""
            ),
            35
          ),
        segundo_nombre:
          cleanPersonName(
            String(
              contactModal.value
                .segundo_nombre || ""
            ),
            35
          ),
        primer_apellido:
          cleanPersonName(
            String(
              contactModal.value
                .primer_apellido || ""
            ),
            35
          ),
        segundo_apellido:
          cleanPersonName(
            String(
              contactModal.value
                .segundo_apellido || ""
            ),
            35
          ),
        cargo: cleanRoleText(
          String(
            contactModal.value.cargo || ""
          ),
          60
        ),
        correo: cleanEmail(
          String(
            contactModal.value.correo || ""
          )
        ),
        es_principal: isPrincipal,
        estado:
          contactModal.value.estado !==
          false,
      };

      if (contactModal.mode === "create") {
        const tempId =
          draftContactIdRef.current--;

        setNewClientContacts(
          (current) => {
            const normalized = isPrincipal
              ? current.map((contact) => ({
                  ...contact,
                  es_principal: false,
                }))
              : current;

            return [
              ...normalized,
              {
                id: tempId,
                cliente_id: 0,
                ...cleanDraft,
                created_at: "",
                updated_at: "",
              },
            ];
          }
        );
      } else if (
        contactModal.value.id
      ) {
        const editId = Number(
          contactModal.value.id
        );

        setNewClientContacts(
          (current) =>
            current.map((contact) => {
              if (
                isPrincipal &&
                Number(contact.id) !==
                  editId
              ) {
                return {
                  ...contact,
                  es_principal: false,
                };
              }

              if (
                Number(contact.id) === editId
              ) {
                return {
                  ...contact,
                  ...cleanDraft,
                };
              }

              return contact;
            })
        );
      }

      setContactModal({
        open: false,
        mode: "create",
        value: {},
        clientId: null,
      });

      setClientErrors((current) => ({
        ...current,
        contactos: "",
      }));

      showNotice(
        "success",
        contactModal.mode === "create"
          ? "Contacto agregado al nuevo cliente."
          : "Contacto actualizado."
      );

      return;
    }

    if (!contactModal.clientId) return;

    const payload = {
      cliente_id: contactModal.clientId,
      primer_nombre: cleanPersonName(
        String(
          contactModal.value.primer_nombre ||
            ""
        ),
        35
      ),
      segundo_nombre: cleanPersonName(
        String(
          contactModal.value.segundo_nombre ||
            ""
        ),
        35
      ),
      primer_apellido: cleanPersonName(
        String(
          contactModal.value
            .primer_apellido || ""
        ),
        35
      ),
      segundo_apellido: cleanPersonName(
        String(
          contactModal.value
            .segundo_apellido || ""
        ),
        35
      ),
      cargo: cleanRoleText(
        String(
          contactModal.value.cargo || ""
        ),
        60
      ),
      correo: cleanEmail(
        String(
          contactModal.value.correo || ""
        )
      ),
      es_principal: Boolean(
        contactModal.value.es_principal
      ),
      estado:
        contactModal.value.estado !== false,
    };

    try {
      let createdContactId:
        | number
        | null = null;

      if (contactModal.mode === "create") {
        const created =
          await apiSendCRM(
            "/contactos-cliente",
            "POST",
            payload
          );

        createdContactId =
          Number(
            created?.id ||
              created?.contacto_id ||
              created?.insertId ||
              0
          ) || null;

        if (
          !createdContactId &&
          quoteModal.open &&
          Number(
            quoteModal.value.cliente_id
          ) ===
            Number(
              contactModal.clientId
            )
        ) {
          const fresh =
            await apiRequestCRM(
              "/crm/bootstrap"
            );

          const freshContacts =
            Array.isArray(
              fresh?.contactos
            )
              ? fresh.contactos
              : [];

          const found = [
            ...freshContacts,
          ]
            .reverse()
            .find(
              (contact: any) =>
                Number(
                  contact.cliente_id
                ) ===
                  Number(
                    contactModal.clientId
                  ) &&
                String(
                  contact.correo || ""
                ).toLowerCase() ===
                  payload.correo.toLowerCase() &&
                String(
                  contact.primer_nombre ||
                    ""
                ).toLowerCase() ===
                  payload.primer_nombre.toLowerCase()
            );

          createdContactId =
            Number(found?.id || 0) ||
            null;
        }
      } else if (
        contactModal.value.id
      ) {
        await apiSendCRM(
          `/contactos-cliente/${contactModal.value.id}`,
          "PUT",
          payload
        );
      }

      await reload();

      if (
        createdContactId &&
        quoteModal.open &&
        Number(
          quoteModal.value.cliente_id
        ) === Number(contactModal.clientId)
      ) {
        setQuoteModal((current) => ({
          ...current,
          value: {
            ...current.value,
            contacto_id:
              createdContactId,
          },
        }));

        setQuoteErrors((current) => ({
          ...current,
          contacto_id: "",
        }));
      }

      setContactModal({
        open: false,
        mode: "create",
        value: {},
        clientId: null,
      });

      showNotice(
        "success",
        createdContactId &&
          quoteModal.open
          ? "Contacto creado y seleccionado en la cotización."
          : "Contacto guardado correctamente en MySQL."
      );
    } catch (error: any) {
      showNotice(
        "error",
        error.message ||
          "No se pudo guardar el contacto en MySQL."
      );
    }
  };

  // ----------------------------------------------------------
  // PHONE CRUD
  // ----------------------------------------------------------

  const openPhone = (
    mode: ModalMode,
    contactId: number,
    phone?: TelefonoContactoRow
  ) => {
    setPhoneErrors({});

    const defaultPrefix =
      prefijos.find(
        (prefix) =>
          prefix.codigo_pais === "GT"
      ) || PREFIJOS_DEFAULT[0];

    const isDraftContact =
      Number(contactId) < 0;

    const sourcePhones =
      isDraftContact
        ? newClientPhones.filter(
            (item) =>
              Number(item.contacto_id) ===
              Number(contactId)
          )
        : phones.filter(
            (item) =>
              Number(item.contacto_id) ===
              Number(contactId)
          );

    setPhoneModal({
      open: true,
      mode,
      contactId,
      value: phone
        ? {
            ...phone,
            telefono: cleanPhone(
              String(phone.telefono || ""),
              phoneDigitsLimit(
                phone.prefijo_telefonico_id ||
                  defaultPrefix.id
              )
            ),
            prefijo_telefonico_id:
              phone.prefijo_telefonico_id ||
              defaultPrefix.id,
          }
        : ({
            contacto_id: contactId,
            prefijo_telefonico_id:
              defaultPrefix.id,
            telefono: "",
            tipo_telefono: "Móvil",
            es_principal:
              sourcePhones.length === 0,
          } as Partial<TelefonoContactoRow>),
    });
  };

  const validatePhone = () => {
    const v = phoneModal.value;
    const e: FieldErrors = {};

    const prefix =
      getPhonePrefix(
        v.prefijo_telefonico_id
      );

    const limit =
      phoneDigitsLimit(
        v.prefijo_telefonico_id
      );

    const digits =
      cleanPhone(
        String(v.telefono || ""),
        limit
      );

    if (!v.prefijo_telefonico_id) {
      e.prefijo =
        "Selecciona el prefijo del país.";
    }

    if (!digits) {
      e.telefono =
        "El teléfono es obligatorio.";
    } else if (
      digits.length !== limit
    ) {
      e.telefono =
        `${prefix.prefijo} debe tener exactamente ${limit} dígitos.`;
    }

    setPhoneErrors(e);
    return Object.keys(e).length === 0;
  };

  const savePhoneData = async () => {
    if (!validatePhone()) return;

    const contactId =
      Number(phoneModal.contactId);

    if (!contactId) return;

    const limit =
      phoneDigitsLimit(
        phoneModal.value
          .prefijo_telefonico_id
      );

    const payload = {
      contacto_id: contactId,
      prefijo_telefonico_id:
        Number(
          phoneModal.value
            .prefijo_telefonico_id || 1
        ),
      telefono: cleanPhone(
        String(
          phoneModal.value.telefono || ""
        ),
        limit
      ),
      tipo_telefono: String(
        phoneModal.value.tipo_telefono ||
          "Otro"
      ),
      es_principal: Boolean(
        phoneModal.value.es_principal
      ),
    };

    const isDraftContact =
      contactId < 0;

    if (isDraftContact) {
      const isPrincipal =
        Boolean(payload.es_principal);

      if (phoneModal.mode === "create") {
        const tempPhoneId =
          draftPhoneIdRef.current--;

        setNewClientPhones(
          (current) => {
            const normalized = isPrincipal
              ? current.map((phone) =>
                  Number(
                    phone.contacto_id
                  ) === contactId
                    ? {
                        ...phone,
                        es_principal:
                          false,
                      }
                    : phone
                )
              : current;

            return [
              ...normalized,
              {
                id: tempPhoneId,
                contacto_id:
                  contactId,
                prefijo_telefonico_id:
                  payload.prefijo_telefonico_id,
                telefono:
                  payload.telefono,
                tipo_telefono:
                  payload.tipo_telefono,
                es_principal:
                  payload.es_principal,
              },
            ];
          }
        );
      } else if (
        phoneModal.value.id
      ) {
        const editPhoneId =
          Number(
            phoneModal.value.id
          );

        setNewClientPhones(
          (current) =>
            current.map((phone) => {
              if (
                isPrincipal &&
                Number(
                  phone.contacto_id
                ) === contactId &&
                Number(phone.id) !==
                  editPhoneId
              ) {
                return {
                  ...phone,
                  es_principal: false,
                };
              }

              if (
                Number(phone.id) ===
                editPhoneId
              ) {
                return {
                  ...phone,
                  ...payload,
                  id: editPhoneId,
                };
              }

              return phone;
            })
        );
      }

      setPhoneModal({
        open: false,
        mode: "create",
        value: {},
        contactId: null,
      });

      showNotice(
        "success",
        phoneModal.mode === "create"
          ? "Teléfono agregado al contacto."
          : "Teléfono actualizado."
      );

      return;
    }

    try {
      if (phoneModal.mode === "create") {
        await apiSendCRM(
          "/telefonos-contacto",
          "POST",
          payload
        );
      } else if (
        phoneModal.value.id
      ) {
        await apiSendCRM(
          `/telefonos-contacto/${phoneModal.value.id}`,
          "PUT",
          payload
        );
      }

      await reload();

      setPhoneModal({
        open: false,
        mode: "create",
        value: {},
        contactId: null,
      });

      showNotice(
        "success",
        "Teléfono guardado correctamente en MySQL."
      );
    } catch (error: any) {
      showNotice(
        "error",
        error.message ||
          "No se pudo guardar el teléfono en MySQL."
      );
    }
  };

  // ----------------------------------------------------------
  // OPPORTUNITY CRUD
  // ----------------------------------------------------------
  // OPPORTUNITY CRUD
  // ----------------------------------------------------------

  const openLead = (mode: ModalMode, view?: LeadView) => {
    setLeadErrors({});
    const source = view ? opportunities.find((o) => o.id === view.id) : undefined;
    setLeadModal({
      open: true,
      mode,
      value:
        source ||
        ({
          codigo_oportunidad: nextCode(opportunities, "codigo_oportunidad", "OPO"),
          cliente_id: null,
          ejecutivo_id: salesUsers[0]?.id || null,
          modalidad_id: modalidades[0]?.id || 1,
          estado_id: 1,
          nombre_oportunidad: "",
          monto_estimado: undefined,
          probabilidad: 10,
          fecha_creacion: todayISO(),
          fecha_cierre_estimada: "",
        } as Partial<OportunidadRow>),
    });
  };

  const validateLead = () => {
    const v = leadModal.value;
    const e: FieldErrors = {};
    if (!v.cliente_id) e.cliente_id = "Selecciona un cliente.";
    if (!String(v.nombre_oportunidad || "").trim()) e.nombre_oportunidad = "El nombre de la oportunidad es obligatorio.";
    if (!v.ejecutivo_id) e.ejecutivo_id = "Selecciona el ejecutivo responsable.";
    if (!v.modalidad_id) e.modalidad_id = "Selecciona una modalidad.";
    if (!v.estado_id) e.estado_id = "Selecciona la etapa.";
    const prob = Number(v.probabilidad);
    if (Number.isNaN(prob) || prob < 0 || prob > 100) e.probabilidad = "La probabilidad debe estar entre 0 y 100.";
    if (Number(v.monto_estimado || 0) < 0) e.monto_estimado = "El monto no puede ser negativo.";
    if (!v.fecha_creacion) e.fecha_creacion = "La fecha de creación es obligatoria.";
    if (v.fecha_cierre_estimada && v.fecha_creacion && String(v.fecha_cierre_estimada) < String(v.fecha_creacion)) e.fecha_cierre_estimada = "La fecha de cierre no puede ser anterior a la fecha de creación.";
    setLeadErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveLeadData = async () => {
    if (!validateLead()) return;

    const payload = {
      codigo_oportunidad: leadModal.value.codigo_oportunidad,
      cliente_id: leadModal.value.cliente_id,
      ejecutivo_id: leadModal.value.ejecutivo_id,
      modalidad_id: leadModal.value.modalidad_id,
      estado_id: leadModal.value.estado_id,
      nombre_oportunidad: cleanCommercialText(String(leadModal.value.nombre_oportunidad || ""), 100),
      monto_estimado: Number(leadModal.value.monto_estimado || 0),
      probabilidad: Number(leadModal.value.probabilidad || 0),
      fecha_creacion: String(leadModal.value.fecha_creacion || todayISO()),
      fecha_cierre_estimada: String(leadModal.value.fecha_cierre_estimada || ""),
    };

    try {
      if (leadModal.mode === "create") {
        await apiSendCRM("/oportunidades", "POST", payload);
      } else if (leadModal.value.id) {
        await apiSendCRM(`/oportunidades/${leadModal.value.id}`, "PUT", payload);
      }

      await reload();
      setSortField("");
      setCrmSortDirection("desc");
      setLeadPage(1);
      setLeadModal({ open: false, mode: "create", value: {} });
      showNotice("success", "Oportunidad guardada correctamente en MySQL.");
    } catch (error: any) {
      showNotice("error", error.message || "No se pudo guardar la oportunidad en MySQL.");
    }
  };

  const syncLegacyLeads = (rows: OportunidadRow[]) => {
    writeArray(
      "leads",
      rows.map((o) => {
        const c = clients.find((x) => x.id === o.cliente_id);
        const u = usuarios.find((x) => x.id === o.ejecutivo_id);
        const m = modalidades.find((x) => x.id === o.modalidad_id);
        return {
          id: String(o.id),
          clientName: c?.nombre_empresa || "",
          type: m?.nombre_modalidad || "",
          executive: fullUserName(u),
          date: o.fecha_creacion,
          probability: o.probabilidad,
          amount: o.monto_estimado,
          stage: estadoIdToStage(o.estado_id),
        };
      })
    );
  };

  const dropLead = async (e: DragEvent, stage: Stage) => {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData("leadId"));
    const estado_id = stageToEstadoId(stage);

    const updated = opportunities.map((o) => (o.id === id ? { ...o, estado_id, updated_at: new Date().toISOString() } : o));
    setOpportunities(updated);

    try {
      await apiSendCRM(`/oportunidades/${id}/estado`, "PATCH", { estado_id, stage });
      await reload();
    } catch (error: any) {
      showNotice("error", error.message || "No se pudo cambiar la etapa en MySQL.");
      await reload();
    }
  };

  // ----------------------------------------------------------
  // QUOTE CRUD  // ----------------------------------------------------------
  // QUOTE CRUD
  // ----------------------------------------------------------

  const blankDetail = (cotizacionId = 0): CotizacionDetalleRow => ({
    id: Date.now(),
    cotizacion_id: cotizacionId,
    descripcion: "",
    cantidad: 1,
    precio_unitario: 0,
    dias_ui: 1,
  });

  const openQuote = (mode: ModalMode, view?: QuoteView, fromLead?: LeadView) => {
    setQuoteErrors({});

    if (view) {
      const row = quotes.find((q) => q.id === view.id);
      if (!row) return;
      setQuoteModal({
        open: true,
        mode,
        value: { ...row },
        details: quoteDetails.filter((d) => d.cotizacion_id === row.id).map((d) => ({ ...d })),
      });
      return;
    }

    const clientId = fromLead?.clientId || null;
    const pc = clientId ? principalContact(clientId) : undefined;
    setQuoteModal({
      open: true,
      mode: "create",
      value: {
        codigo_cotizacion: nextCode(quotes, "codigo_cotizacion", "COT"),
        cliente_id: clientId,
        contacto_id: pc?.id || null,
        ejecutivo_id: fromLead?.executiveId || salesUsers[0]?.id || null,
        modalidad_id: fromLead?.modalityId || modalidades[0]?.id || null,
        forma_pago_id: formasPago[0]?.id || null,
        origen_id: null,
        destino_id: null,
        fecha_ui: todayISO(),
        estado_ui: "Borrador",
        moneda_ui: "GTQ",
        tipo_carga_ui: fromLead?.opportunityName || "",
        peso_ui: "",
        volumen_ui: "",
        observaciones_ui: fromLead ? `Cotización generada desde ${fromLead.code}.` : "",
        no_incluye_ui: [...QUOTE_NO_INCLUYE_DEFAULT],
        notas_importantes_ui: [...QUOTE_NOTAS_IMPORTANTES_DEFAULT],
      },
      details: [
        {
          ...blankDetail(0),
          descripcion: fromLead ? `Servicio ${fromLead.type}`.slice(0, 50) : "",
          precio_unitario: fromLead?.amount || 0,
        },
      ],
    });
  };

  const validateQuote = () => {
    const v = quoteModal.value;
    const e: FieldErrors = {};
    if (!v.cliente_id) e.cliente_id = "Selecciona el cliente de la cotización.";
    if (!v.contacto_id) e.contacto_id = "Selecciona un contacto del cliente.";
    if (!v.ejecutivo_id) e.ejecutivo_id = "Selecciona el ejecutivo de ventas.";
    if (!v.modalidad_id) e.modalidad_id = "Selecciona la modalidad.";
    if (!v.forma_pago_id) e.forma_pago_id = "Selecciona la forma de pago.";
    if (!v.origen_id) e.origen_id = "Selecciona el origen.";
    if (!v.destino_id) e.destino_id = "Selecciona el destino.";
    if (v.origen_id && v.destino_id && Number(v.origen_id) === Number(v.destino_id)) e.destino_id = "El destino debe ser diferente al origen.";
    if (!quoteModal.details.length) e.details = "Agrega al menos una línea de servicio.";

    const bad = quoteModal.details.find((d) => {
      const descripcion = String(d.descripcion || "").trim();
      const cantidadTexto = String(d.cantidad ?? "").trim();
      const precioTexto = String(d.precio_unitario ?? "").trim();
      const diasTexto = String(d.dias_ui ?? "").trim();

      const cantidad = Number(cantidadTexto);
      const precio = Number(precioTexto || 0);
      const dias = Number(diasTexto);

      return (
        !descripcion ||
        descripcion.length > 50 ||
        !cantidadTexto ||
        !Number.isFinite(cantidad) ||
        cantidad <= 0 ||
        !precioTexto ||
        !Number.isFinite(precio) ||
        precio <= 0 ||
        !diasTexto ||
        !Number.isFinite(dias) ||
        dias <= 0
      );
    });

    if (bad) {
      e.details =
        "Cada línea debe tener descripción (máx. 50), cantidad mayor a 0, precio/venta mayor a 0 y días mayor a 0. No se permite guardar valores en 0.";
    }

    setQuoteErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveQuoteData = async () => {
    if (!validateQuote()) return;

    const services = quoteModal.details.map((d) => ({
      id: d.id,
      description: cleanCommercialText(String(d.descripcion || ""), 50),
      descripcion: cleanCommercialText(String(d.descripcion || ""), 50),
      quantity: Number(d.cantidad),
      cantidad: Number(d.cantidad),
      unitPrice: Number(d.precio_unitario || 0),
      precio_unitario: Number(d.precio_unitario || 0),
      days: Number(d.dias_ui),
      dias_ui: Number(d.dias_ui),
    }));

    const payload = {
      codigo_cotizacion: quoteModal.value.codigo_cotizacion,
      cliente_id: quoteModal.value.cliente_id,
      contacto_id: quoteModal.value.contacto_id,
      ejecutivo_id: quoteModal.value.ejecutivo_id,
      modalidad_id: quoteModal.value.modalidad_id,
      forma_pago_id: quoteModal.value.forma_pago_id,
      origen_id: quoteModal.value.origen_id,
      destino_id: quoteModal.value.destino_id,
      fecha_ui: quoteModal.value.fecha_ui,
      estado_ui: quoteModal.value.estado_ui,
      moneda_ui: quoteModal.value.moneda_ui,
      tipo_carga_ui: cleanCommercialText(String(quoteModal.value.tipo_carga_ui || ""), 80),
      peso_ui: quoteModal.value.peso_ui,
      volumen_ui: quoteModal.value.volumen_ui,
      observaciones_ui: quoteModal.value.observaciones_ui,
      services,
    };

    try {
      let savedQuoteId =
        Number(quoteModal.value.id || 0) || null;

      if (quoteModal.mode === "create") {
        const created = await apiSendCRM(
          "/cotizaciones",
          "POST",
          payload
        );

        savedQuoteId =
          Number(
            created?.id ||
              created?.cotizacion_id ||
              created?.insertId ||
              0
          ) || null;
      } else if (quoteModal.value.id) {
        await apiSendCRM(
          `/cotizaciones/${quoteModal.value.id}`,
          "PUT",
          payload
        );
      }

      saveQuoteUiMetadata(
        savedQuoteId,
        String(payload.codigo_cotizacion || ""),
        {
        fecha_ui: String(payload.fecha_ui || todayISO()),
        estado_ui: (payload.estado_ui || "Borrador") as QuoteStatus,
        moneda_ui: payload.moneda_ui === "USD" ? "USD" : "GTQ",
        tipo_carga_ui: String(payload.tipo_carga_ui || ""),
        peso_ui: String(payload.peso_ui || ""),
        volumen_ui: String(payload.volumen_ui || ""),
        observaciones_ui: String(payload.observaciones_ui || ""),
        no_incluye_ui:
          Array.isArray(quoteModal.value.no_incluye_ui) &&
          quoteModal.value.no_incluye_ui.length
            ? quoteModal.value.no_incluye_ui.map((item) => String(item || "").trim()).filter(Boolean)
            : [...QUOTE_NO_INCLUYE_DEFAULT],
        notas_importantes_ui:
          Array.isArray(quoteModal.value.notas_importantes_ui) &&
          quoteModal.value.notas_importantes_ui.length
            ? quoteModal.value.notas_importantes_ui.map((item) => String(item || "").trim()).filter(Boolean)
            : [...QUOTE_NOTAS_IMPORTANTES_DEFAULT],
          dias_ui_por_linea: services.map(
            (service) => service.dias_ui
          ),
        }
      );

      await reload();
      setSortField("");
      setCrmSortDirection("desc");
      setQuotePage(1);
      setQuoteModal({ open: false, mode: "create", value: {}, details: [] });
      showNotice(
        "success",
        "Cotización guardada correctamente. Peso, volumen y observaciones quedaron asociados únicamente a esta cotización."
      );
    } catch (error: any) {
      showNotice("error", error.message || "No se pudo guardar la cotización en MySQL.");
    }
  };

  const changeQuoteStatus = async (id: number, status: QuoteStatus) => {
    const updatedQuotes = quotes.map((q) =>
      q.id === id
        ? { ...q, estado_ui: status }
        : q
    );

    setQuotes(updatedQuotes);
    setQuoteModal((prev) => {
      if (Number(prev.value.id) !== id) return prev;
      return { ...prev, value: { ...prev.value, estado_ui: status } };
    });

    try {
      const currentQuote = quotes.find((q) => Number(q.id) === Number(id));
      if (currentQuote?.codigo_cotizacion) {
        saveQuoteUiMetadata(
          currentQuote.id,
          currentQuote.codigo_cotizacion,
          { estado_ui: status }
        );
      }

      await apiSendCRM(`/cotizaciones/${id}/estado`, "PATCH", {
        estado: status,
        estado_ui: status,
      });

      await reload();
      showNotice("success", `Estado actualizado a ${status}.`);
    } catch (error: any) {
      showNotice("error", error.message || "No se pudo actualizar el estado.");
      await reload();
    }
  };

  const syncLegacyQuotes = (qs: CotizacionRow[], ds: CotizacionDetalleRow[]) => {
    const legacy = qs.map((q) => {
      const c = clients.find((x) => x.id === q.cliente_id);
      const ct = contacts.find((x) => x.id === q.contacto_id);
      const det = ds.filter((d) => d.cotizacion_id === q.id);
      const subtotal = det.reduce(
        (s, d) => s + Number(d.cantidad || 0) * Number(d.precio_unitario || 0),
        0
      );
      return {
        id: String(q.id),
        quoteNumber: q.codigo_cotizacion,
        clientId: q.cliente_id ? String(q.cliente_id) : "",
        clientName: c?.nombre_empresa || "",
        nit: c?.nit || "C/F",
        contact: fullContactName(ct),
        email: ct?.correo || "",
        date: q.fecha_ui,
        status: q.estado_ui,
        services: det.map((d) => ({
          id: String(d.id),
          description: d.descripcion,
          modality: "",
          route: "",
          quantity: Number(d.cantidad || 0),
          unitPrice: Number(d.precio_unitario || 0),
          subtotal: Number(d.cantidad || 0) * Number(d.precio_unitario || 0),
          days: Number(d.dias_ui || 0),
        })),
        subtotal,
        iva: subtotal * 0.12,
        total: subtotal * 1.12,
        observations: q.observaciones_ui,
        currency: q.moneda_ui,
      };
    });
    writeArray("quotes", legacy);
  };

  const updateQuoteDetail = (id: number, field: keyof CotizacionDetalleRow, value: any) => {
    setQuoteModal((p) => ({
      ...p,
      details: p.details.map((d) => (d.id === id ? { ...d, [field]: value } : d)),
    }));
  };

  const convertLeadToQuote = (lead: LeadView) => {
    setLeadModal({ open: false, mode: "create", value: {} });
    openQuote("create", undefined, lead);
  };

  // ----------------------------------------------------------
  // BAJAS / REACTIVACIÓN DE CLIENTES Y ELIMINACIÓN DE OTROS REGISTROS
  // ----------------------------------------------------------

  const executeDelete = async () => {
    if (!deleteModal.type || !deleteModal.id) return;
    const id = Number(deleteModal.id);

    try {
      // ------------------------------------------------------
      // ELIMINACIÓN DEFINITIVA DE CLIENTE
      // ------------------------------------------------------
      if (deleteModal.type === "clientPermanent") {
        const client = clients.find(
          (c) => Number(c.id) === id
        );

        if (!client) {
          throw new Error(
            "No se encontró el cliente seleccionado."
          );
        }

        await apiSendCRM(
          `/clientes/${id}?definitivo=1`,
          "DELETE"
        );

        await reload();

        setClientModal({
          open: false,
          mode: "create",
          value: {},
        });
        setDeleteModal({
          open: false,
          type: null,
          id: null,
        });
        setClientPage(1);
        setSortField("");
        setCrmSortDirection("desc");

        showNotice(
          "success",
          `Cliente ${client.nombre_empresa} eliminado definitivamente.`
        );

        return;
      }

      // ------------------------------------------------------
      // BAJA / REACTIVACIÓN
      // ------------------------------------------------------
      // 1 = Activo
      // 2 = Inactivo / De baja
      if (deleteModal.type === "client") {
        const client = clients.find((c) => Number(c.id) === id);

        if (!client) {
          throw new Error("No se encontró el cliente seleccionado.");
        }

        const estaActivo = Number(client.estado_cliente_id) === 1;
        const nuevoEstado = estaActivo ? 2 : 1;

        const motivo = clientInactiveReason.trim();

        if (estaActivo && motivo.length < 5) {
          showNotice(
            "error",
            "Escribe el motivo de inactivación antes de dar de baja al cliente."
          );
          return;
        }

        await apiSendCRM(`/clientes/${id}`, "PUT", {
          codigo_cliente: client.codigo_cliente,
          nombre_empresa: client.nombre_empresa,
          nit: client.nit,
          direccion: client.direccion,
          estado_cliente_id: nuevoEstado,

          // Nuevos campos de trazabilidad.
          motivo_inactivacion: estaActivo ? motivo : null,
          fecha_inactivacion: estaActivo ? new Date().toISOString() : null,
        });

        await reload();

        setClientModal({ open: false, mode: "create", value: {} });
        setDeleteModal({ open: false, type: null, id: null });
        setClientInactiveReason("");

        showNotice(
          "success",
          estaActivo
            ? `Cliente dado de baja. Motivo: ${motivo}`
            : "Cliente reactivado correctamente."
        );

        return;
      }

      // Los demás tipos conservan su comportamiento actual.
      const endpointByType: Record<string, string> = {
        contact: `/contactos-cliente/${id}`,
        phone: `/telefonos-contacto/${id}`,
        lead: `/oportunidades/${id}`,
        quote: `/cotizaciones/${id}`,
      };

      const endpoint = endpointByType[deleteModal.type];

      if (!endpoint) {
        throw new Error("No se encontró la operación solicitada.");
      }

      if (deleteModal.type === "quote") {
        const quoteToDelete = quotes.find((q) => Number(q.id) === id);
        if (quoteToDelete?.codigo_cotizacion) {
          removeQuoteUiMetadata(
            quoteToDelete.id,
            quoteToDelete.codigo_cotizacion
          );
        }
      }

      await apiSendCRM(endpoint, "DELETE");
      await reload();

      setClientModal({ open: false, mode: "create", value: {} });
      setContactModal({ open: false, mode: "create", value: {}, clientId: null });
      setPhoneModal({ open: false, mode: "create", value: {}, contactId: null });
      setLeadModal({ open: false, mode: "create", value: {} });
      setQuoteModal({ open: false, mode: "create", value: {}, details: [] });
      setDeleteModal({ open: false, type: null, id: null });

      showNotice("success", "Registro eliminado correctamente en MySQL.");
    } catch (error: any) {
      setDeleteModal({ open: false, type: null, id: null });

      showNotice(
        "error",
        error.message ||
          (deleteModal.type === "client"
            ? "No se pudo cambiar el estado del cliente."
            : "No se pudo eliminar el registro en MySQL.")
      );
    }
  };


  // ----------------------------------------------------------
  // PROVEEDORES
  // ----------------------------------------------------------

  const openProvider = (mode: ModalMode, provider?: ProviderRow) => {
    setProviderErrors({});
    if (provider) {
      setProviderModal({ open: true, mode, value: { ...provider } });
      setProviderContactDraft(
        providerContacts
          .filter((c) => Number(c.proveedor_id) === Number(provider.id))
          .map((c) => ({ ...c }))
      );
      setProviderServiceDraft(
        providerServices
          .filter((s) => Number(s.proveedor_id) === Number(provider.id))
          .map((s) => ({ ...s }))
      );
      setProviderComplianceDraft({
        ...(providerComplianceFor(provider.id) || {
          proveedor_id: provider.id,
          estado_sat: "pendiente",
          lista_clinton: false,
          rtu_validado: false,
          licencia_validada: false,
          cuenta_validada: false,
        }),
      });
      setProviderPerformanceDraft({
        ...(providerPerformanceFor(provider.id) || {
          proveedor_id: provider.id,
          nivel: "Amarillo",
          historial: "",
          hallazgos: "",
          fecha: todayISO(),
        }),
      });
      return;
    }

    setProviderModal({
      open: true,
      mode: "create",
      value: {
        codigo_proveedor: "",
        razon_social: "",
        nombre_comercial: "",
        nit: "",
        estado_id: 1,
        correo: "",
        telefono: "",
      },
    });
    setProviderContactDraft([]);
    setProviderServiceDraft([]);
    setProviderComplianceDraft({
      estado_sat: "pendiente",
      lista_clinton: false,
      rtu_validado: false,
      licencia_validada: false,
      cuenta_validada: false,
    });
    setProviderPerformanceDraft({
      nivel: "Amarillo",
      historial: "",
      hallazgos: "",
      fecha: todayISO(),
    });
  };

  const addProviderContact = () => {
    const id = -Date.now();
    setProviderContactDraft((prev) => [
      ...prev.map((c) => prev.length === 0 ? c : c),
      {
        id,
        proveedor_id: Number(providerModal.value.id || 0),
        primer_nombre: "",
        segundo_nombre: "",
        primer_apellido: "",
        segundo_apellido: "",
        cargo: "",
        correo: "",
        telefono: "",
        es_principal: prev.length === 0,
        estado: true,
      },
    ]);
  };

  const patchProviderContact = (id: number, patch: Partial<ProviderContactRow>) => {
    setProviderContactDraft((prev) =>
      prev.map((c) => {
        if (patch.es_principal && c.id !== id) return { ...c, es_principal: false };
        return c.id === id ? { ...c, ...patch } : c;
      })
    );
  };

  const nextProviderServiceCode = (draftRows: ProviderServiceRow[] = []) => {
    const realDraftIds = new Set(
      draftRows
        .filter((row) => Number(row.id) > 0)
        .map((row) => Number(row.id))
    );

    const occupiedRows = providerServices.filter(
      (row) => !realDraftIds.has(Number(row.id))
    );

    const allRows = [...occupiedRows, ...draftRows];

    let maxNumber = allRows.reduce((max, row) => {
      const match = String(row.codigo_servicio || "")
        .toUpperCase()
        .match(/SRV[-_ ]?(\d+)/);

      return Math.max(max, match ? Number(match[1]) || 0 : 0);
    }, 0);

    const usedCodes = new Set(
      occupiedRows
        .map((row) => String(row.codigo_servicio || "").trim().toUpperCase())
        .filter(Boolean)
    );

    draftRows.forEach((row) => {
      const code = String(row.codigo_servicio || "").trim().toUpperCase();
      if (code) usedCodes.add(code);
    });

    let candidate = "";
    do {
      maxNumber += 1;
      candidate = `SRV-${String(maxNumber).padStart(3, "0")}`;
    } while (usedCodes.has(candidate));

    return candidate;
  };

  const normalizeProviderServiceCodes = (
    rows: ProviderServiceRow[]
  ): ProviderServiceRow[] => {
    const realDraftIds = new Set(
      rows
        .filter((row) => Number(row.id) > 0)
        .map((row) => Number(row.id))
    );

    const occupiedCodes = new Set(
      providerServices
        .filter((row) => !realDraftIds.has(Number(row.id)))
        .map((row) => String(row.codigo_servicio || "").trim().toUpperCase())
        .filter(Boolean)
    );

    let maxNumber = [...providerServices, ...rows].reduce((max, row) => {
      const match = String(row.codigo_servicio || "")
        .toUpperCase()
        .match(/SRV[-_ ]?(\d+)/);

      return Math.max(max, match ? Number(match[1]) || 0 : 0);
    }, 0);

    const nextUniqueCode = () => {
      let candidate = "";

      do {
        maxNumber += 1;
        candidate = `SRV-${String(maxNumber).padStart(3, "0")}`;
      } while (occupiedCodes.has(candidate));

      occupiedCodes.add(candidate);
      return candidate;
    };

    return rows.map((row) => {
      const currentCode = String(row.codigo_servicio || "")
        .trim()
        .toUpperCase();

      if (!currentCode || occupiedCodes.has(currentCode)) {
        return {
          ...row,
          codigo_servicio: nextUniqueCode(),
        };
      }

      occupiedCodes.add(currentCode);

      return {
        ...row,
        codigo_servicio: currentCode,
      };
    });
  };

  const addProviderService = () => {
    const id = -Date.now();

    setProviderServiceDraft((prev) => {
      const codigoServicio = nextProviderServiceCode(prev);

      return [
        ...prev,
        {
          id,
          proveedor_id: Number(providerModal.value.id || 0),
          codigo_servicio: codigoServicio,
          nombre_servicio_proveedor: "",
          es_principal: prev.length === 0,
        },
      ];
    });
  };

  const patchProviderService = (id: number, patch: Partial<ProviderServiceRow>) => {
    setProviderServiceDraft((prev) =>
      prev.map((s) => {
        if (patch.es_principal && s.id !== id) return { ...s, es_principal: false };
        return s.id === id ? { ...s, ...patch } : s;
      })
    );
  };

  const validateProvider = () => {
    const e: FieldErrors = {};
    if (!String(providerModal.value.razon_social || "").trim()) e.razon_social = "La razón social es obligatoria.";
    if (!String(providerModal.value.nit || "").trim()) e.nit = "El NIT es obligatorio.";
    if (providerModal.value.correo && !validEmail(String(providerModal.value.correo))) e.correo = "Correo no válido.";
    providerContactDraft.forEach((c, index) => {
      const started = c.primer_nombre || c.primer_apellido || c.cargo || c.correo || c.telefono;
      if (started && (!c.primer_nombre.trim() || !c.primer_apellido.trim())) {
        e[`contacto_${index}`] = `Completa nombre y apellido del contacto ${index + 1}.`;
      }
      if (c.correo && !validEmail(c.correo)) e[`correo_contacto_${index}`] = `Correo del contacto ${index + 1} no válido.`;
    });
    setProviderErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveProvider = async () => {
    if (!validateProvider()) return;

    const serviciosNormalizados =
      normalizeProviderServiceCodes(providerServiceDraft);

    setProviderServiceDraft(serviciosNormalizados);

    const payload = {
      ...providerModal.value,
      contactos: providerContactDraft,
      servicios: serviciosNormalizados,
      cumplimiento: providerComplianceDraft,
      desempeno: providerPerformanceDraft,
    };

    try {
      if (providerModal.mode === "create") {
        await apiSendCRM("/crm/proveedores", "POST", payload);
      } else if (providerModal.value.id) {
        await apiSendCRM(`/crm/proveedores/${providerModal.value.id}`, "PUT", payload);
      }
      await reload();
      setProviderModal({ open: false, mode: "create", value: {} });
      showNotice("success", providerModal.mode === "create" ? "Proveedor guardado correctamente." : "Proveedor actualizado correctamente.");
    } catch (error: any) {
      setProviderErrors({ general: error?.message || "No se pudo guardar el proveedor." });
    }
  };

  const deleteProvider = async () => {
    if (!providerDeleteId) return;
    try {
      const result = await apiSendCRM(`/crm/proveedores/${providerDeleteId}`, "DELETE");
      await reload();
      setProviderDeleteId(null);
      showNotice("success", result?.inactivado ? "El proveedor tenía operaciones y fue marcado como Inactivo." : "Proveedor eliminado correctamente.");
    } catch (error: any) {
      setProviderDeleteId(null);
      showNotice("error", error?.message || "No se pudo eliminar el proveedor.");
    }
  };

  const providerPdf = async (p: ProviderRow) => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const NAVY = [12, 45, 107] as const;
    const ORANGE = [255, 106, 0] as const;
    const LIGHT_BLUE = [239, 246, 255] as const;
    const LIGHT_GRAY = [248, 250, 252] as const;
    const BORDER = [220, 226, 235] as const;
    const TEXT = [31, 41, 55] as const;
    const MUTED = [100, 116, 139] as const;

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;

    const contactsRows = providerContacts
      .filter(
        (contact) =>
          Number(contact.proveedor_id) === Number(p.id) &&
          contact.estado !== false
      )
      .sort((a, b) => {
        if (Boolean(a.es_principal) !== Boolean(b.es_principal)) {
          return a.es_principal ? -1 : 1;
        }

        return fullContactName(a as any).localeCompare(
          fullContactName(b as any),
          "es"
        );
      });

    const servicesRows = providerServices
      .filter(
        (service) =>
          Number(service.proveedor_id) === Number(p.id)
      )
      .sort((a, b) => {
        if (Boolean(a.es_principal) !== Boolean(b.es_principal)) {
          return a.es_principal ? -1 : 1;
        }

        return String(a.nombre_servicio_proveedor || "").localeCompare(
          String(b.nombre_servicio_proveedor || ""),
          "es"
        );
      });

    const compliance = providerComplianceFor(p.id);
    const performance = providerPerformanceFor(p.id);
    const mainContact = providerMainContact(p.id);
    const mainService = providerMainService(p.id);

    let logo: string | null = null;

    try {
      logo = await imageUrlToDataUrl(logoEmpresa);
    } catch {
      logo = null;
    }

    const satText =
      compliance?.estado_sat === "vigente"
        ? "Vigente"
        : compliance?.estado_sat === "no_vigente"
        ? "No vigente"
        : "Pendiente";

    const statusName = providerStatusName(p);

    const performanceLevel =
      performance?.nivel ||
      p.desempeno ||
      "Amarillo";

    const drawHeader = (continuation = false) => {
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, pageWidth, continuation ? 26 : 38, "F");

      if (logo) {
        try {
          const logoX = margin;
          const logoY = continuation ? 4 : 6;
          const logoW = continuation ? 30 : 39;
          const logoH = continuation ? 17 : 23;

          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(255, 255, 255);
          doc.roundedRect(
            logoX - 1.5,
            logoY - 1.5,
            logoW + 3,
            logoH + 3,
            2,
            2,
            "FD"
          );

          doc.addImage(
            logo,
            "PNG",
            logoX,
            logoY,
            logoW,
            logoH,
            undefined,
            "FAST"
          );
        } catch {}
      }

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");

      if (continuation) {
        doc.setFontSize(14);
        doc.text(
          "EXPEDIENTE DE PROVEEDOR",
          pageWidth - margin,
          11,
          { align: "right" }
        );

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(
          `${p.codigo_proveedor} · Continuación`,
          pageWidth - margin,
          17,
          { align: "right" }
        );
      } else {
        doc.setFontSize(20);
        doc.text(
          "EXPEDIENTE DE PROVEEDOR",
          pageWidth - margin,
          16,
          { align: "right" }
        );

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(
          "CRM y Ventas · Gestión de proveedores",
          pageWidth - margin,
          22,
          { align: "right" }
        );

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...ORANGE);
        doc.text(
          p.codigo_proveedor,
          pageWidth - margin,
          29,
          { align: "right" }
        );
      }
    };

    const drawFooter = () => {
      const pages = doc.getNumberOfPages();

      for (let page = 1; page <= pages; page += 1) {
        doc.setPage(page);
        doc.setDrawColor(...BORDER);
        doc.line(
          margin,
          pageHeight - 12,
          pageWidth - margin,
          pageHeight - 12
        );

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...MUTED);
        doc.text(
          "Grupo Logístico 365 · Expediente de proveedor",
          margin,
          pageHeight - 7
        );

        doc.text(
          `Página ${page} de ${pages}`,
          pageWidth - margin,
          pageHeight - 7,
          { align: "right" }
        );
      }
    };

    drawHeader(false);

    let y = 46;

    const ensureSpace = (needed: number) => {
      if (y + needed <= pageHeight - 18) return;

      doc.addPage();
      drawHeader(true);
      y = 34;
    };

    const sectionTitle = (
      title: string,
      subtitle?: string
    ) => {
      ensureSpace(subtitle ? 17 : 12);

      doc.setFillColor(...LIGHT_BLUE);
      doc.roundedRect(
        margin,
        y,
        contentWidth,
        subtitle ? 14 : 10,
        2,
        2,
        "F"
      );

      doc.setTextColor(...NAVY);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(title, margin + 4, y + 6);

      if (subtitle) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...MUTED);
        doc.text(subtitle, margin + 4, y + 10.5);
      }

      y += subtitle ? 18 : 14;
    };

    const valueLines = (
      value: any,
      width: number
    ) => {
      const textValue =
        value === null ||
        value === undefined ||
        String(value).trim() === ""
          ? "-"
          : String(value);

      return doc.splitTextToSize(textValue, width);
    };

    const field = (
      label: string,
      value: any,
      x: number,
      top: number,
      width: number
    ) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(label, x, top);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...TEXT);

      const lines = valueLines(value, width);
      doc.text(lines, x, top + 5);

      return Math.max(11, 5 + lines.length * 4);
    };

    const statusBadge = (
      textValue: string,
      x: number,
      top: number,
      kind: "green" | "yellow" | "red" | "blue"
    ) => {
      const palette =
        kind === "green"
          ? {
              bg: [220, 252, 231],
              fg: [22, 101, 52],
            }
          : kind === "red"
          ? {
              bg: [254, 226, 226],
              fg: [185, 28, 28],
            }
          : kind === "yellow"
          ? {
              bg: [254, 249, 195],
              fg: [161, 98, 7],
            }
          : {
              bg: [219, 234, 254],
              fg: [30, 64, 175],
            };

      const badgeWidth = Math.max(
        26,
        doc.getTextWidth(textValue) + 8
      );

      doc.setFillColor(
        palette.bg[0],
        palette.bg[1],
        palette.bg[2]
      );

      doc.roundedRect(
        x,
        top,
        badgeWidth,
        7,
        2,
        2,
        "F"
      );

      doc.setTextColor(
        palette.fg[0],
        palette.fg[1],
        palette.fg[2]
      );

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text(textValue, x + 4, top + 4.7);

      return badgeWidth;
    };

    // --------------------------------------------------------
    // RESUMEN GENERAL
    // --------------------------------------------------------
    sectionTitle(
      "Información general",
      "Datos principales y estado actual del proveedor."
    );

    ensureSpace(47);

    doc.setFillColor(...LIGHT_GRAY);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(
      margin,
      y,
      contentWidth,
      43,
      2,
      2,
      "FD"
    );

    const leftX = margin + 5;
    const rightX = margin + contentWidth / 2 + 4;
    const halfWidth = contentWidth / 2 - 10;

    field(
      "Razón social",
      p.razon_social,
      leftX,
      y + 7,
      halfWidth
    );

    field(
      "Nombre comercial",
      p.nombre_comercial,
      rightX,
      y + 7,
      halfWidth
    );

    field(
      "NIT",
      p.nit,
      leftX,
      y + 21,
      halfWidth
    );

    field(
      "Servicio principal",
      mainService?.nombre_servicio_proveedor,
      rightX,
      y + 21,
      halfWidth
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text("Estado", leftX, y + 35);

    statusBadge(
      statusName,
      leftX + 18,
      y + 30.3,
      String(statusName).toLowerCase().includes("activo")
        ? "green"
        : "red"
    );

    doc.text(
      "Desempeño",
      rightX,
      y + 35
    );

    statusBadge(
      performanceLevel,
      rightX + 24,
      y + 30.3,
      performanceLevel === "Verde"
        ? "green"
        : performanceLevel === "Rojo"
        ? "red"
        : "yellow"
    );

    y += 49;

    // --------------------------------------------------------
    // CONTACTO GENERAL / PRINCIPAL
    // --------------------------------------------------------
    sectionTitle(
      "Contacto principal",
      "Información inmediata para comunicación con el proveedor."
    );

    ensureSpace(35);

    doc.setDrawColor(...BORDER);
    doc.roundedRect(
      margin,
      y,
      contentWidth,
      30,
      2,
      2,
      "S"
    );

    field(
      "Contacto",
      fullContactName(mainContact as any),
      leftX,
      y + 7,
      halfWidth
    );

    field(
      "Cargo",
      mainContact?.cargo,
      rightX,
      y + 7,
      halfWidth
    );

    field(
      "Correo",
      mainContact?.correo || p.correo,
      leftX,
      y + 20,
      halfWidth
    );

    field(
      "Teléfono",
      mainContact?.telefono || p.telefono,
      rightX,
      y + 20,
      halfWidth
    );

    y += 36;

    // --------------------------------------------------------
    // TODOS LOS CONTACTOS
    // --------------------------------------------------------
    sectionTitle(
      "Contactos registrados",
      `${contactsRows.length} contacto(s) activo(s) asociado(s) al proveedor.`
    );

    if (!contactsRows.length) {
      ensureSpace(16);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text(
        "No hay contactos adicionales registrados.",
        margin + 3,
        y + 4
      );
      y += 12;
    } else {
      const widths = [8, 48, 29, 50, 28, 20];
      const headers = [
        "#",
        "Nombre",
        "Cargo",
        "Correo",
        "Teléfono",
        "Tipo",
      ];

      ensureSpace(12);

      doc.setFillColor(...NAVY);
      doc.rect(
        margin,
        y,
        contentWidth,
        8,
        "F"
      );

      let hx = margin;

      headers.forEach((header, index) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.8);
        doc.setTextColor(255, 255, 255);
        doc.text(
          header,
          hx + 2,
          y + 5
        );
        hx += widths[index];
      });

      y += 8;

      contactsRows.forEach((contact, index) => {
        const name = fullContactName(contact as any) || "-";
        const cargo = contact.cargo || "-";
        const correo = contact.correo || "-";
        const telefono = contact.telefono || "-";
        const tipo = contact.es_principal ? "Principal" : "Adicional";

        const cells = [
          String(index + 1),
          name,
          cargo,
          correo,
          telefono,
          tipo,
        ];

        const lineSets = cells.map((cell, cellIndex) =>
          doc.splitTextToSize(
            cell,
            Math.max(5, widths[cellIndex] - 4)
          )
        );

        const maxLines = Math.max(
          ...lineSets.map((lines) => lines.length)
        );

        const rowHeight = Math.max(
          9,
          4 + maxLines * 3.2
        );

        ensureSpace(rowHeight + 2);

        if (index % 2 === 0) {
          doc.setFillColor(...LIGHT_GRAY);
          doc.rect(
            margin,
            y,
            contentWidth,
            rowHeight,
            "F"
          );
        }

        doc.setDrawColor(...BORDER);
        doc.rect(
          margin,
          y,
          contentWidth,
          rowHeight,
          "S"
        );

        let cx = margin;

        lineSets.forEach((lines, cellIndex) => {
          doc.setFont(
            "helvetica",
            cellIndex === 1 ? "bold" : "normal"
          );
          doc.setFontSize(6.8);

          if (
            cellIndex === 5 &&
            contact.es_principal
          ) {
            doc.setTextColor(22, 101, 52);
          } else {
            doc.setTextColor(...TEXT);
          }

          doc.text(
            lines,
            cx + 2,
            y + 5
          );

          cx += widths[cellIndex];
        });

        y += rowHeight;
      });

      y += 5;
    }

    // --------------------------------------------------------
    // SERVICIOS
    // --------------------------------------------------------
    sectionTitle(
      "Servicios",
      `${servicesRows.length} servicio(s) registrado(s).`
    );

    if (!servicesRows.length) {
      ensureSpace(14);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text(
        "No hay servicios registrados.",
        margin + 3,
        y + 4
      );
      y += 12;
    } else {
      servicesRows.forEach((service, index) => {
        const lines = doc.splitTextToSize(
          service.nombre_servicio_proveedor || "-",
          contentWidth - 43
        );

        const rowHeight = Math.max(
          10,
          5 + lines.length * 3.4
        );

        ensureSpace(rowHeight + 2);

        doc.setFillColor(
          index % 2 === 0 ? 248 : 255,
          index % 2 === 0 ? 250 : 255,
          index % 2 === 0 ? 252 : 255
        );

        doc.setDrawColor(...BORDER);
        doc.roundedRect(
          margin,
          y,
          contentWidth,
          rowHeight,
          1.5,
          1.5,
          "FD"
        );

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...NAVY);
        doc.text(
          service.codigo_servicio || `Servicio ${index + 1}`,
          margin + 4,
          y + 5
        );

        doc.setFont("helvetica", "normal");
        doc.setTextColor(...TEXT);
        doc.text(
          lines,
          margin + 34,
          y + 5
        );

        if (service.es_principal) {
          statusBadge(
            "Principal",
            pageWidth - margin - 27,
            y + 1.5,
            "blue"
          );
        }

        y += rowHeight + 2;
      });

      y += 3;
    }

    // --------------------------------------------------------
    // CUMPLIMIENTO
    // --------------------------------------------------------
    sectionTitle(
      "Cumplimiento documental",
      "Estado de las validaciones utilizadas para el expediente del proveedor."
    );

    ensureSpace(33);

    const checks = [
      {
        label: "SAT",
        value: satText,
        ok: compliance?.estado_sat === "vigente",
        warning: compliance?.estado_sat === "pendiente",
      },
      {
        label: "Lista Clinton",
        value: compliance?.lista_clinton ? "Revisado" : "Pendiente",
        ok: Boolean(compliance?.lista_clinton),
      },
      {
        label: "RTU",
        value: compliance?.rtu_validado ? "Validado" : "Pendiente",
        ok: Boolean(compliance?.rtu_validado),
      },
      {
        label: "Licencias",
        value: compliance?.licencia_validada ? "Validado" : "Pendiente",
        ok: Boolean(compliance?.licencia_validada),
      },
      {
        label: "Cuenta bancaria",
        value: compliance?.cuenta_validada ? "Validado" : "Pendiente",
        ok: Boolean(compliance?.cuenta_validada),
      },
    ];

    const cardGap = 3;
    const cardWidth =
      (contentWidth - cardGap * 4) / 5;

    checks.forEach((item, index) => {
      const x =
        margin +
        index * (cardWidth + cardGap);

      doc.setFillColor(...LIGHT_GRAY);
      doc.setDrawColor(...BORDER);
      doc.roundedRect(
        x,
        y,
        cardWidth,
        25,
        2,
        2,
        "FD"
      );

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(...NAVY);

      const labelLines = doc.splitTextToSize(
        item.label,
        cardWidth - 5
      );

      doc.text(
        labelLines,
        x + 2.5,
        y + 5
      );

      const kind =
        item.ok
          ? "green"
          : item.warning
          ? "yellow"
          : item.value === "No vigente"
          ? "red"
          : "yellow";

      statusBadge(
        item.value,
        x + 2.5,
        y + 15,
        kind
      );
    });

    y += 31;

    // --------------------------------------------------------
    // DESEMPEÑO
    // --------------------------------------------------------
    sectionTitle(
      "Evaluación de desempeño",
      "Última evaluación registrada para este proveedor."
    );

    ensureSpace(26);

    doc.setDrawColor(...BORDER);
    doc.roundedRect(
      margin,
      y,
      contentWidth,
      20,
      2,
      2,
      "S"
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      "Nivel",
      margin + 4,
      y + 6
    );

    statusBadge(
      performanceLevel,
      margin + 18,
      y + 1.5,
      performanceLevel === "Verde"
        ? "green"
        : performanceLevel === "Rojo"
        ? "red"
        : "yellow"
    );

    field(
      "Fecha de evaluación",
      performance?.fecha
        ? formatDate(performance.fecha)
        : "-",
      margin + 75,
      y + 6,
      45
    );

    y += 25;

    const longTextBox = (
      title: string,
      value: any
    ) => {
      const lines = doc.splitTextToSize(
        value && String(value).trim()
          ? String(value)
          : "Sin información registrada.",
        contentWidth - 10
      );

      const boxHeight = Math.max(
        18,
        12 + lines.length * 3.5
      );

      ensureSpace(boxHeight + 4);

      doc.setFillColor(...LIGHT_GRAY);
      doc.setDrawColor(...BORDER);
      doc.roundedRect(
        margin,
        y,
        contentWidth,
        boxHeight,
        2,
        2,
        "FD"
      );

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...NAVY);
      doc.text(
        title,
        margin + 4,
        y + 6
      );

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...TEXT);
      doc.text(
        lines,
        margin + 4,
        y + 11
      );

      y += boxHeight + 4;
    };

    longTextBox(
      "Historial",
      performance?.historial
    );

    longTextBox(
      "Hallazgos",
      performance?.hallazgos
    );

    // --------------------------------------------------------
    // CIERRE
    // --------------------------------------------------------
    ensureSpace(18);

    doc.setDrawColor(...ORANGE);
    doc.setLineWidth(0.7);
    doc.line(
      margin,
      y + 2,
      margin + 42,
      y + 2
    );

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...NAVY);
    doc.text(
      "Expediente generado desde GL365 ERP",
      margin,
      y + 8
    );

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(
      `Fecha de generación: ${new Date().toLocaleDateString("es-GT")}`,
      margin,
      y + 13
    );

    drawFooter();

    doc.save(
      `Expediente_${p.codigo_proveedor}_${String(
        p.razon_social || "Proveedor"
      )
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "_")}.pdf`
    );
  };

  const exportProviders = () => {
    const rows = sortedProviders.map((p) => {
      const c = providerMainContact(p.id);
      const s = providerMainService(p.id);
      const comp = providerComplianceFor(p.id);
      const perf = providerPerformanceFor(p.id);
      return {
        Código: p.codigo_proveedor,
        Proveedor: p.razon_social,
        "Nombre comercial": p.nombre_comercial || "",
        NIT: p.nit,
        "Servicio principal": s?.nombre_servicio_proveedor || "",
        "Contacto principal": fullContactName(c as any),
        Correo: c?.correo || p.correo || "",
        Teléfono: c?.telefono || p.telefono || "",
        Desempeño: perf?.nivel || "Amarillo",
        SAT: comp?.estado_sat || "pendiente",
        Estado: providerStatusName(p),
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Proveedores");
    XLSX.writeFile(wb, `CRM_Proveedores_${Date.now()}.xlsx`);
  };

  const openNewRoute = () => {
    const origin = ubicaciones.find((u) => Number(u.id) === Number(quoteModal.value.origen_id));
    const destination = ubicaciones.find((u) => Number(u.id) === Number(quoteModal.value.destino_id));
    setRouteErrors({});
    setRouteDraft({
      codigo_ruta: "",
      nombre_ruta: "",
      origen: origin?.nombre_ubicacion || "",
      pais_origen: origin?.pais || "Guatemala",
      destino: destination?.nombre_ubicacion || "",
      pais_destino: destination?.pais || "Guatemala",
      distancia_km: "",
    });
    setRouteModalOpen(true);
  };

  const saveNewRoute = async () => {
    const e: FieldErrors = {};
    if (!routeDraft.origen.trim()) e.origen = "Escribe el origen.";
    if (!routeDraft.destino.trim()) e.destino = "Escribe el destino.";
    if (normalizeLocationLabel(routeDraft.origen) === normalizeLocationLabel(routeDraft.destino)) e.destino = "Origen y destino deben ser diferentes.";
    setRouteErrors(e);
    if (Object.keys(e).length) return;

    try {
      const result = await apiSendCRM("/crm/rutas", "POST", {
        ...routeDraft,
        distancia_km: Number(routeDraft.distancia_km || 0),
      });
      setQuoteModal((prev) => ({
        ...prev,
        value: {
          ...prev.value,
          origen_id: Number(result.origen_id),
          destino_id: Number(result.destino_id),
        },
      }));
      setQuoteErrors((prev) => ({ ...prev, origen_id: "", destino_id: "" }));
      setRouteModalOpen(false);
      await reload();
      showNotice("success", result?.existente ? "La ruta ya existía y fue seleccionada." : "Ruta creada y seleccionada en la cotización.");
    } catch (error: any) {
      setRouteErrors({ general: error?.message || "No se pudo guardar la ruta." });
    }
  };

  // ----------------------------------------------------------
  // EXPORTS  // ----------------------------------------------------------
  // EXPORTS
  // ----------------------------------------------------------

  const exportClients = () => {
    const ws = XLSX.utils.json_to_sheet(
      clients.map((c) => {
        const cp = principalContact(c.id);
        const pp = cp ? phones.find((p) => p.contacto_id === cp.id && p.es_principal) || phones.find((p) => p.contacto_id === cp.id) : undefined;
        return {
          Código: c.codigo_cliente,
          Empresa: c.nombre_empresa,
          NIT: c.nit,
          Dirección: c.direccion,
          Estado: estadoClienteNombre(c.estado_cliente_id),
          "Contacto principal": fullContactName(cp),
          Cargo: cp?.cargo || "",
          Correo: cp?.correo || "",
          Teléfono: formatPhone(pp) || "",
        };
      })
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, `Clientes_Normalizados_${Date.now()}.xlsx`);
  };

  const exportLeads = () => {
    const ws = XLSX.utils.json_to_sheet(
      leads.map((l) => ({ Código: l.code, Cliente: l.clientName, Oportunidad: l.opportunityName, Modalidad: l.type, Ejecutivo: l.executive, "Fecha creación": l.date, "Cierre estimado": l.closeDate, "Probabilidad (%)": l.probability, Monto: l.amount, Etapa: l.stage }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Oportunidades");
    XLSX.writeFile(wb, `CRM_Oportunidades_${Date.now()}.xlsx`);
  };

  const exportQuotes = () => {
    const ws = XLSX.utils.json_to_sheet(
      quoteViews.map((q) => ({ Código: q.quoteNumber, Cliente: q.clientName, Contacto: q.contact, Ejecutivo: q.executive, Modalidad: q.modality, "Forma pago": q.paymentMethod, Origen: q.origin, Destino: q.destination, Estado: q.status, Moneda: q.currency, Subtotal: q.subtotal, IVA: q.iva, Total: q.total }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cotizaciones");
    XLSX.writeFile(wb, `CRM_Cotizaciones_${Date.now()}.xlsx`);
  };

  // ----------------------------------------------------------
  // KPIs
  // ----------------------------------------------------------

  const totalOpportunityValue = leads.reduce((sum, lead) => sum + Number(lead.amount || 0), 0);
  const activeLeads = leads.filter(
  (l) => l.stage !== "ganado" && l.stage !== "perdido"
);
  const totalQuoteGTQ = quoteViews.reduce((s, q) => s + (q.currency === "USD" ? q.total * 7.8 : q.total), 0);

  const kpis =
    activeTab === "seguimiento"
      ? [
          { title: "Oportunidades activas", value: activeLeads.length, icon: Target, color: "blue" as const },
          { title: "Tasa de cierre", value: leads.length ? `${Math.round((leads.filter((l) => l.stage === "ganado").length / leads.length) * 100)}%` : "0%", icon: TrendingUp, color: "green" as const },
          { title: "Oportunidades registradas", value: leads.length, icon: FileText, color: "orange" as const },
          { title: "Valor de oportunidades", value: moneyGTQ(totalOpportunityValue), icon: DollarSign, color: "blue" as const },
        ]
      : activeTab === "clientes"
      ? [
          { title: "Total clientes", value: clients.length, icon: Users, color: "blue" as const },
          { title: "Clientes activos", value: clients.filter((c) => c.estado_cliente_id === 1).length, icon: TrendingUp, color: "green" as const },
          { title: "Clientes inactivos", value: clients.filter((c) => c.estado_cliente_id === 2).length, icon: FileText, color: "orange" as const },
          { title: "Contactos registrados", value: contacts.length, icon: UserPlus, color: "blue" as const },
        ]
      : activeTab === "proveedores"
      ? [
          { title: "Proveedores", value: providers.length, icon: Building2, color: "blue" as const },
          { title: "Activos", value: providers.filter((p) => providerStatusName(p) === "Activo").length, icon: CheckCircle2, color: "green" as const },
          { title: "Riesgo alto", value: providers.filter((p) => (providerPerformanceFor(p.id)?.nivel || p.desempeno) === "Rojo").length, icon: AlertTriangle, color: "orange" as const },
          { title: "SAT no vigente", value: providers.filter((p) => (providerComplianceFor(p.id)?.estado_sat || p.estado_sat) === "no_vigente").length, icon: AlertTriangle, color: "orange" as const },
        ]
      : [
          { title: "Total cotizaciones", value: quoteViews.length, icon: Target, color: "blue" as const },
          { title: "Aprobadas", value: quoteViews.filter((q) => q.status === "Aprobada").length, icon: CheckCircle, color: "green" as const },
          { title: "Enviadas", value: quoteViews.filter((q) => q.status === "Enviada").length, icon: Send, color: "orange" as const },
          { title: "Valor total cotizado", value: moneyGTQ(totalQuoteGTQ), icon: DollarSign, color: "blue" as const },
        ];

  // ----------------------------------------------------------
  // VIEW HELPERS
  // ----------------------------------------------------------

  const currentClient = clientModal.value.id ? clients.find((c) => c.id === Number(clientModal.value.id)) : undefined;
  const currentClientContacts = currentClient ? contacts.filter((c) => c.cliente_id === currentClient.id).sort((a, b) => b.id - a.id) : [];

  const clientForStatusAction =
    (deleteModal.type === "client" ||
      deleteModal.type === "clientPermanent") &&
    deleteModal.id
      ? clients.find(
          (c) =>
            Number(c.id) === Number(deleteModal.id)
        )
      : undefined;

  const clientStatusActionIsReactivate =
    Number(clientForStatusAction?.estado_cliente_id) === 2;

  const currentLeadView = leadModal.value.id ? leads.find((l) => l.id === Number(leadModal.value.id)) : undefined;

  const quoteClient = clients.find((c) => c.id === Number(quoteModal.value.cliente_id));
  const quoteContact = contacts.find((c) => c.id === Number(quoteModal.value.contacto_id));
  const quoteContacts = contacts.filter((c) => c.cliente_id === Number(quoteModal.value.cliente_id) && c.estado);
  const quoteContactPhones = quoteContact ? phones.filter((p) => p.contacto_id === quoteContact.id) : [];
  const quoteExecutive = usuarios.find((u) => u.id === Number(quoteModal.value.ejecutivo_id));
  const quoteModality = modalidades.find((m) => m.id === Number(quoteModal.value.modalidad_id));
  const quotePayment = formasPago.find((f) => f.id === Number(quoteModal.value.forma_pago_id));
  const quoteOrigin = ubicaciones.find((u) => u.id === Number(quoteModal.value.origen_id));
  const quoteDestination = ubicaciones.find((u) => u.id === Number(quoteModal.value.destino_id));
  const quoteTotalPackages = quoteModal.details.reduce((s, d) => s + Number(d.cantidad || 0), 0);
  const quoteSubtotal = quoteModal.details.reduce((s, d) => s + Number(d.cantidad || 0) * Number(d.precio_unitario || 0), 0);
  const quoteIva = quoteSubtotal * 0.12;
  const quoteTotal = quoteSubtotal + quoteIva;

  const quoteLegacyForPdf = (q: QuoteView) => ({
    id: String(q.id),
    quoteNumber: q.quoteNumber,
    clientId: q.clientId ? String(q.clientId) : "",
    clientName: q.clientName,
    nit: q.nit,
    contact: q.contact,
    email: q.email,
    date: q.date,
    status: q.status,
    services: q.services.map((s) => ({ id: String(s.id), description: s.description, modality: q.modality, route: `${q.origin} - ${q.destination}`, quantity: s.quantity, unitPrice: s.unitPrice, subtotal: s.subtotal, days: s.days })),
    subtotal: q.subtotal,
    iva: q.iva,
    total: q.total,
    observations: q.observations,
    origin: q.origin,
    destination: q.destination,
    cargoType: q.cargoType,
    weight: q.weight,
    volume: q.volume,
    paymentMethod: q.paymentMethod,
    currency: q.currency,

    // IMPORTANTE:
    // El PDF debe recibir el ejecutivo que actualmente está relacionado
    // con la cotización, no un valor fijo ni el ejecutivo anterior.
    salesExecutive: q.executive,
    executive: q.executive,
    ejecutivo: q.executive,
    ejecutivo_ventas: q.executive,
    executiveId: q.executiveId,

    noIncluye: q.noIncluye,
    notasImportantes: q.notasImportantes,
  });


  const hasActiveCrmFilters = Boolean(searchQuery.trim()) || statusFilter !== "Todos" || leadStageFilter !== "Todos" || providerStatusFilter !== "Todos" || providerLevelFilter !== "Todos" || providerSatFilter !== "Todos";

  const clearCrmFilters = () => {
    setSearchQuery("");
    setStatusFilter("Todos");
    setLeadStageFilter("Todos");
    setProviderStatusFilter("Todos");
    setProviderLevelFilter("Todos");
    setProviderSatFilter("Todos");
    setSortField("");
    setCrmSortDirection("desc");
  };

  const sortIcon = (field: string) => {
    if (sortField !== field) return "↕";
    return crmSortDirection === "asc" ? "↑" : "↓";
  };

  const sortLabel = (field: string) => {
    const labels: Record<string, string> = {
      date: "Fecha",
      amount: "Monto",
      probability: "Probabilidad",
      clientName: "Cliente",
      opportunityName: "Oportunidad",
      stage: "Etapa",
      codigo_cliente: "Código",
      nombre_empresa: "Empresa",
      nit: "NIT",
      contacto: "Contacto principal",
      estado: "Estado",
      quoteNumber: "No. Cotización",
      contact: "Contacto",
      status: "Estado",
      total: "Total",
      closeDate: "Cierre estimado",
      providerCode: "Código",
      providerName: "Proveedor",
      providerNit: "NIT",
      providerService: "Servicio",
      providerContact: "Contacto",
      providerPerformance: "Desempeño",
      providerSat: "SAT",
      providerStatus: "Estado",
    };

    return labels[field] || field;
  };

  const sortMeaning = (
    field: string,
    direction: CrmSortDirection
  ) => {
    const numericFields = new Set([
      "amount",
      "probability",
      "total",
    ]);

    const dateFields = new Set([
      "date",
      "closeDate",
    ]);

    if (dateFields.has(field)) {
      return direction === "asc"
        ? "Más antiguo → más reciente"
        : "Más reciente → más antiguo";
    }

    if (numericFields.has(field)) {
      return direction === "asc"
        ? "Menor → mayor"
        : "Mayor → menor";
    }

    return direction === "asc"
      ? "A → Z"
      : "Z → A";
  };

  const sortShortMeaning = (
    field: string,
    direction: CrmSortDirection
  ) => {
    const numericFields = new Set([
      "amount",
      "probability",
      "total",
    ]);

    const dateFields = new Set([
      "date",
      "closeDate",
    ]);

    if (dateFields.has(field)) {
      return direction === "asc"
        ? "Antiguo → reciente"
        : "Reciente → antiguo";
    }

    if (numericFields.has(field)) {
      return direction === "asc"
        ? "Menor → mayor"
        : "Mayor → menor";
    }

    return direction === "asc"
      ? "A → Z"
      : "Z → A";
  };

  const handleColumnSort = (field: string) => {
    if (sortField === field) {
      // Segundo clic y siguientes:
      // ascendente <-> descendente.
      setCrmSortDirection((prev) =>
        prev === "asc" ? "desc" : "asc"
      );
      return;
    }

    // Al tocar una columna por primera vez,
    // empieza en ASCENDENTE.
    setSortField(field);
    setCrmSortDirection("asc");
  };

  const SortableTh = ({
    field,
    children,
    className = "",
  }: {
    field: string;
    children: ReactNode;
    className?: string;
  }) => {
    const active = sortField === field;

    const nextDirection: CrmSortDirection =
      active && crmSortDirection === "asc"
        ? "desc"
        : "asc";

    return (
      <th className={className}>
        <button
          type="button"
          onClick={() => handleColumnSort(field)}
          className={`group inline-flex flex-col items-start gap-0.5 text-left transition-colors ${
            active
              ? "text-[#FF6A00]"
              : "text-[#0C2D6B] hover:text-[#FF6A00]"
          }`}
          title={
            active
              ? `Orden ${crmSortDirection === "asc" ? "ascendente" : "descendente"}. Clic para cambiar a ${nextDirection === "asc" ? "ascendente" : "descendente"}.`
              : `Clic para ordenar ${sortLabel(field)} de forma ascendente.`
          }
          aria-label={
            active
              ? `${sortLabel(field)} ordenado ${crmSortDirection === "asc" ? "ascendente" : "descendente"}. Presiona para invertir.`
              : `${sortLabel(field)}. Presiona para ordenar ascendente.`
          }
        >
          <span className="inline-flex items-center gap-1 text-[13px] font-bold">
            {children}
            <span
              className={`text-[10px] ${
                active
                  ? "text-[#FF6A00]"
                  : "text-gray-300 group-hover:text-[#FF6A00]"
              }`}
            >
              {sortIcon(field)}
            </span>
          </span>

          <span
            className={`whitespace-nowrap text-[9px] font-semibold leading-none ${
              active
                ? "text-[#FF6A00]"
                : "text-gray-400"
            }`}
          >
            {active
              ? `${
                  crmSortDirection === "asc"
                    ? "Ascendente"
                    : "Descendente"
                } · ${sortShortMeaning(
                  field,
                  crmSortDirection
                )}`
              : "Clic para ordenar"}
          </span>
        </button>
      </th>
    );
  };

  const SortChip = ({
    field,
    label,
  }: {
    field: string;
    label: string;
  }) => {
    const active = sortField === field;

    return (
      <button
        type="button"
        onClick={() => handleColumnSort(field)}
        className={`min-h-9 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all ${
          active
            ? "border-orange-300 bg-orange-50 text-[#C85100] shadow-sm"
            : "border-gray-200 bg-white text-[#0C2D6B] hover:border-blue-200 hover:bg-blue-50"
        }`}
        title={
          active
            ? `Orden ${crmSortDirection === "asc" ? "ascendente" : "descendente"}. Haz clic para invertir.`
            : `Haz clic para ordenar ${label} ascendente.`
        }
      >
        <span>{label}</span>
        <span className="ml-1">
          {sortIcon(field)}
        </span>

        <span
          className={`ml-1 ${
            active
              ? "text-[#C85100]"
              : "text-gray-400"
          }`}
        >
          {active
            ? crmSortDirection === "asc"
              ? "Asc."
              : "Desc."
            : "Ordenar"}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-5 w-full max-w-full px-2 sm:px-3 lg:px-4">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[#0C2D6B]">CRM y Ventas</h1>
          <p className="text-gray-500 mt-1">Gestión de clientes, contactos, oportunidades y cotizaciones</p>
        </div>
        <button onClick={reload} className="h-9 bg-[#0C2D6B] text-white px-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#143C8C] w-fit">
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      {/* KPIs compactos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {kpis.map((k, i) => (
          <KpiCard key={i} {...k} />
        ))}
      </div>

      {/* TABS */}
      <div className="overflow-x-auto">
        <div className="grid grid-cols-3 border-b border-gray-200 gap-1 sm:flex sm:gap-8">
          {[
            ["seguimiento", "Oportunidades"],
            ["clientes", "Clientes"],
            ["cotizaciones", "Cotizaciones"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => {
                selectCrmTab(
                  id as "seguimiento" | "clientes" | "cotizaciones" | "proveedores"
                );
                setSearchQuery("");
                setStatusFilter("Todos");
                setLeadStageFilter("Todos");
              }}
              className={`min-w-0 px-1 sm:px-4 pb-4 pt-2 font-bold text-sm sm:text-lg relative transition-colors ${activeTab === id ? "text-[#0C2D6B]" : "text-gray-500 hover:text-[#0C2D6B]"}`}
            >
              {label}
              {activeTab === id && <div className="absolute bottom-0 left-0 w-full h-1 bg-[#FF6A00] rounded-t" />}
            </button>
          ))}
        </div>
      </div>

      {/* ==================================================== */}
      {/* OPORTUNIDADES */}
      {/* ==================================================== */}
      {activeTab === "seguimiento" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-[380px]">
              <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar código, oportunidad, cliente, modalidad o ejecutivo..." className="w-full h-11 pl-12 pr-4 bg-white border border-gray-200 rounded-xl text-sm outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20" />
            </div>

            <div className="relative w-[210px] max-w-full">
              <Filter className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select value={leadStageFilter} onChange={(e) => setLeadStageFilter(e.target.value)} className="w-full h-11 pl-12 pr-8 bg-white border border-gray-200 rounded-xl text-sm outline-none appearance-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20">
                <option value="Todos">Todas las etapas</option>
                <option value="prospecto">Prospecto</option>
                <option value="cotizado">Cotizado</option>
                <option value="negociacion">Negociación</option>
                <option value="ganado">Ganado</option>
                <option value="perdido">Perdido</option>
              </select>
            </div>

            <button
              type="button"
              onClick={clearCrmFilters}
              className="h-11 rounded-xl border border-orange-200 bg-white px-4 text-sm font-bold text-[#FF6A00] shadow-sm transition hover:border-[#FF6A00] hover:bg-orange-50"
            >
              <X className="inline-block w-4 h-4 mr-1" />
              Limpiar filtros y orden
            </button>

            <button onClick={() => openLead("create")} className="h-12 bg-[#0C2D6B] text-white px-6 rounded-xl text-base font-bold flex items-center gap-2.5 shadow-sm hover:bg-[#143C8C] ml-0 xl:ml-auto">
              <Plus className="w-5 h-5" /> Nueva oportunidad
            </button>
            <button onClick={exportLeads} className="h-11 bg-[#22C55E] text-white px-4 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#16A34A]">
              <Download className="w-4 h-4" /> Excel
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-bold text-gray-400">{sortedLeads.length} de {leads.length} oportunidades visibles</span>

          </div>

          <div className="mx-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-gray-400 uppercase tracking-wide">
              Ordenar por:
            </span>
            <SortChip field="date" label="Fecha" />
            <SortChip field="amount" label="Monto" />
            <SortChip
              field="probability"
              label="Probabilidad"
            />
            <SortChip
              field="clientName"
              label="Cliente"
            />
            <SortChip
              field="opportunityName"
              label="Oportunidad"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 pb-3">
            {[
              { id: "prospecto", label: "Prospecto", border: "border-l-gray-400", badge: "bg-gray-200" },
              { id: "cotizado", label: "Cotizado", border: "border-l-blue-400", badge: "bg-blue-100" },
              { id: "negociacion", label: "Negociación", border: "border-l-[#FF6A00]", badge: "bg-orange-100" },
              { id: "ganado", label: "Ganado", border: "border-l-[#22C55E]", badge: "bg-green-100" },
              { id: "perdido", label: "Perdido", border: "border-l-red-500", badge: "bg-red-100" },
            ].map((col) => {
              const rows = paginatedLeads.filter((l) => l.stage === col.id);
              return (
                <div key={col.id} onDragOver={(e) => e.preventDefault()} onDrop={(e) => dropLead(e, col.id as Stage)} className="rounded-xl border border-gray-200 bg-[#F3F4F6] p-3 min-h-[360px]">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-[#0C2D6B] text-sm">{col.label}</h3>
                    <span className={`${col.badge} px-2 py-0.5 rounded-full text-xs font-bold text-[#0C2D6B]`}>{rows.length}</span>
                  </div>
                  <div className="space-y-2.5">
                    {rows.map((lead) => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("leadId", String(lead.id))}
                        onClick={() => openLead("view", lead)}
                        className={`bg-white p-3 rounded-xl shadow-sm border-l-4 ${col.border} cursor-pointer hover:shadow-md transition-all group`}
                      >
                        <div className="flex justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[10px] text-gray-400 font-bold">{lead.code}</p>
                            <h4 className="font-bold text-[#0C2D6B] text-sm leading-snug whitespace-normal break-words" title={lead.opportunityName}>{lead.opportunityName}</h4>
                            <p className="text-xs text-gray-500 leading-snug whitespace-normal break-words mt-0.5" title={lead.clientName}>{lead.clientName}</p>
                          </div>
                          <GripVertical className="w-4 h-4 text-gray-300 shrink-0 opacity-0 group-hover:opacity-100" />
                        </div>
                        <div className="mt-2 text-xs text-gray-500 space-y-1">
                          <p className="leading-snug whitespace-normal break-words">{lead.type} · {lead.executive}</p>
                          <p>{formatDate(lead.date)}</p>
                        </div>
                        <div className="border-t mt-2 pt-2 flex items-end justify-between gap-2">
                          <div>
                            <p className="text-[9px] text-gray-400 font-bold">PROBABILIDAD</p>
                            <div className="flex items-center gap-1">
                              <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-[#0C2D6B]" style={{ width: `${lead.probability}%` }} /></div>
                              <span className="text-[11px] font-bold text-[#0C2D6B]">{lead.probability}%</span>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-[#22C55E]">{moneyGTQ(lead.amount)}</span>
                        </div>
                      </div>
                    ))}
                    {!rows.length && <p className="text-center text-xs text-gray-400 py-8">Sin oportunidades</p>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
            <PaginationControls
              page={leadPage}
              totalPages={leadTotalPages}
              rowsPerPage={rowsPerPage}
              totalItems={sortedLeads.length}
              itemLabel="oportunidades filtradas"
              onPageChange={setLeadPage}
              onRowsPerPageChange={setRowsPerPage}
            />
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* CLIENTES */}
      {/* ==================================================== */}
      {activeTab === "clientes" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Toolbar compacto: filtros pequeños y botones siempre visibles */}
          <div className="p-4 border-b flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-[390px]">
              <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cliente, código o NIT..." className="w-full h-11 pl-12 pr-4 bg-white border border-gray-200 rounded-xl text-sm outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20" />
            </div>
            <div className="relative w-[180px] max-w-full">
              <Filter className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full h-11 pl-12 pr-8 bg-white border border-gray-200 rounded-xl text-sm outline-none appearance-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20">
                <option value="Todos">Todos</option>
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </div>

            <button
              type="button"
              onClick={clearCrmFilters}
              className="h-11 rounded-xl border border-orange-200 bg-white px-4 text-sm font-bold text-[#FF6A00] shadow-sm transition hover:border-[#FF6A00] hover:bg-orange-50"
            >
              <X className="inline-block w-4 h-4 mr-1" />
              Limpiar filtros y orden
            </button>

            <div className="flex gap-2 ml-0 xl:ml-auto">
              <button onClick={() => openClient("create")} className="h-12 bg-[#0C2D6B] text-white px-6 rounded-xl text-base font-bold flex items-center gap-2.5 shadow-sm hover:bg-[#143C8C]">
                <Plus className="w-5 h-5" /> Nuevo Cliente
              </button>
              <button onClick={exportClients} className="h-11 bg-[#22C55E] text-white px-4 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#16A34A]">
                <Download className="w-4 h-4" /> Excel
              </button>
            </div>
          </div>

          <div className="px-4 pt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-bold text-gray-400">{sortedClients.length} de {clients.length} registros visibles</span>

          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="bg-[#F3F4F6] text-[#0C2D6B]">
                <tr>
                  <SortableTh field="codigo_cliente" className="px-3 py-3 w-[80px]">Código</SortableTh>
                  <SortableTh field="nombre_empresa" className="px-3 py-3 w-[250px]">Empresa</SortableTh>
                  <SortableTh field="nit" className="px-3 py-3 w-[105px]">NIT</SortableTh>
                  <SortableTh field="contacto" className="px-3 py-3 w-[220px]">Contacto principal</SortableTh>
                  <th className="px-3 py-3 w-[300px] text-[#0C2D6B]">Dirección</th>
                  <SortableTh field="estado" className="px-3 py-3 w-[82px]">Estado</SortableTh>
                  <th className="px-3 py-3 w-[165px] text-center text-[#0C2D6B]">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedClients.map((c) => {
                  const pc = principalContact(c.id);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3 font-bold text-[#0C2D6B] whitespace-nowrap">{c.codigo_cliente}</td>
                      <td className="px-3 py-3 font-semibold text-[#0C2D6B] align-top"><p className="whitespace-normal break-words leading-snug" title={c.nombre_empresa}>{c.nombre_empresa}</p></td>
                      <td className="px-3 py-3 whitespace-nowrap align-top">{c.nit}</td>
                      <td className="px-3 py-3 align-top">
                        {pc ? (
                          <div>
                            <p className="font-medium text-gray-700 whitespace-normal break-words leading-snug">{fullContactName(pc)}</p>
                            <p className="text-xs text-gray-400 whitespace-normal break-words leading-snug mt-0.5">{pc.cargo || "Sin cargo"}</p>
                          </div>
                        ) : <span className="text-xs text-gray-400">Sin contacto</span>}
                      </td>
                      <td className="px-3 py-3 align-top"><p className="whitespace-normal break-words leading-snug text-xs" title={c.direccion}>{c.direccion || "-"}</p></td>
                      <td className="px-3 py-3 align-top"><span className={`px-2 py-1 rounded text-[11px] font-bold whitespace-nowrap ${c.estado_cliente_id === 1 ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"}`}>{estadoClienteNombre(c.estado_cliente_id)}</span></td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => generarPDFCliente(c, contacts, phones)} className="w-8 h-8 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 flex items-center justify-center" title="Descargar PDF" aria-label="Descargar PDF"><Download className="w-4 h-4" /></button>
                          <button onClick={() => openClient("view", c)} className="w-8 h-8 rounded-lg text-gray-500 hover:text-[#0C2D6B] hover:bg-blue-50 flex items-center justify-center" title="Ver cliente" aria-label="Ver cliente"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => openClient("edit", c)} className="w-8 h-8 rounded-lg text-gray-500 hover:text-[#FF6A00] hover:bg-orange-50 flex items-center justify-center" title="Editar cliente" aria-label="Editar cliente"><Edit2 className="w-4 h-4" /></button>
                          <button
                            onClick={() => openClientStatusAction(c)}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                              c.estado_cliente_id === 2
                                ? "text-green-600 hover:text-green-700 hover:bg-green-50"
                                : "text-gray-500 hover:text-red-600 hover:bg-red-50"
                            }`}
                            title={c.estado_cliente_id === 2 ? "Reactivar cliente" : "Dar de baja cliente"}
                            aria-label={c.estado_cliente_id === 2 ? "Reactivar cliente" : "Dar de baja cliente"}
                          >
                            {c.estado_cliente_id === 2 ? (
                              <UserCheck className="w-4 h-4" />
                            ) : (
                              <UserX className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() =>
                              openClientPermanentDelete(c)
                            }
                            className="w-8 h-8 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 flex items-center justify-center transition-colors"
                            title="Eliminar cliente definitivamente"
                            aria-label="Eliminar cliente definitivamente"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!sortedClients.length && <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No se encontraron clientes.</td></tr>}
              </tbody>
            </table>
          </div>

          <PaginationControls
            page={clientPage}
            totalPages={clientTotalPages}
            rowsPerPage={rowsPerPage}
            totalItems={sortedClients.length}
            itemLabel="registros filtrados"
            onPageChange={setClientPage}
            onRowsPerPageChange={setRowsPerPage}
          />
        </div>
      )}


      {/* ==================================================== */}
      {/* PROVEEDORES */}
      {/* ==================================================== */}
      {activeTab === "proveedores" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b p-4">
            {/* Barra compacta de proveedores: una sola línea y sin scroll horizontal */}
            <div className="flex w-full min-w-0 flex-nowrap items-center gap-2 overflow-hidden">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Código, proveedor, NIT, contacto..."
                  className="h-11 w-full min-w-0 rounded-xl border border-gray-200 bg-white pl-10 pr-3 text-sm shadow-sm outline-none focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20"
                />
              </div>

              <select
                value={providerStatusFilter}
                onChange={(e) => setProviderStatusFilter(e.target.value)}
                className="h-11 w-[126px] shrink-0 rounded-xl border border-gray-200 bg-white px-2 text-[13px] shadow-sm outline-none focus:border-[#0C2D6B]"
              >
                <option value="Todos">Estado</option>
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>

              <select
                value={providerLevelFilter}
                onChange={(e) => setProviderLevelFilter(e.target.value)}
                className="h-11 w-[138px] shrink-0 rounded-xl border border-gray-200 bg-white px-2 text-[13px] shadow-sm outline-none focus:border-[#0C2D6B]"
              >
                <option value="Todos">Desempeño</option>
                <option value="Verde">Verde</option>
                <option value="Amarillo">Amarillo</option>
                <option value="Rojo">Rojo</option>
              </select>

              <select
                value={providerSatFilter}
                onChange={(e) => setProviderSatFilter(e.target.value)}
                className="h-11 w-[138px] shrink-0 rounded-xl border border-gray-200 bg-white px-2 text-[13px] shadow-sm outline-none focus:border-[#0C2D6B]"
              >
                <option value="Todos">Estado SAT</option>
                <option value="vigente">Vigente</option>
                <option value="no_vigente">No vigente</option>
                <option value="pendiente">Pendiente</option>
              </select>

              <button
                type="button"
                onClick={clearCrmFilters}
                className="inline-flex h-11 w-[142px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-orange-200 bg-white px-3 text-[13px] font-bold text-[#FF6A00] shadow-sm transition hover:border-[#FF6A00] hover:bg-orange-50"
              >
                <X className="h-4 w-4" />
                Limpiar filtros
              </button>

              <button
                type="button"
                onClick={() => openProvider("create")}
                className="inline-flex h-11 w-[176px] shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0C2D6B] px-3 text-[13px] font-bold text-white shadow-sm hover:bg-[#143C8C]"
              >
                <Plus className="h-4 w-4" />
                Nuevo Proveedor
              </button>

              <button
                type="button"
                onClick={exportProviders}
                className="inline-flex h-11 w-[94px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#22C55E] px-3 text-[13px] font-bold text-white shadow-sm hover:bg-[#16A34A]"
              >
                <Download className="h-4 w-4" />
                Excel
              </button>
            </div>
          </div>

          <div className="px-4 py-3 text-sm font-bold text-gray-400">
            {sortedProviders.length} de {providers.length} proveedores visibles
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="bg-[#F3F4F6] text-[#0C2D6B]">
                <tr>
                  <SortableTh field="providerCode" className="px-3 py-3">Código</SortableTh>
                  <SortableTh field="providerName" className="px-3 py-3">Proveedor</SortableTh>
                  <SortableTh field="providerNit" className="px-3 py-3">NIT</SortableTh>
                  <SortableTh field="providerService" className="px-3 py-3">Servicio principal</SortableTh>
                  <SortableTh field="providerContact" className="px-3 py-3">Contacto principal</SortableTh>
                  <SortableTh field="providerPerformance" className="px-3 py-3">Desempeño</SortableTh>
                  <SortableTh field="providerSat" className="px-3 py-3">SAT</SortableTh>
                  <SortableTh field="providerStatus" className="px-3 py-3">Estado</SortableTh>
                  <th className="px-3 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedProviders.map((p) => {
                  const contact = providerMainContact(p.id);
                  const service = providerMainService(p.id);
                  const perf = providerPerformanceFor(p.id)?.nivel || p.desempeno || "Amarillo";
                  const sat = providerComplianceFor(p.id)?.estado_sat || p.estado_sat || "pendiente";
                  const status = providerStatusName(p);
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 align-top">
                      <td className="px-3 py-3 font-bold text-[#0C2D6B]">{p.codigo_proveedor}</td>
                      <td className="px-3 py-3"><p className="font-bold text-[#0C2D6B]">{p.razon_social}</p>{p.nombre_comercial && <p className="text-xs text-gray-400 mt-0.5">{p.nombre_comercial}</p>}</td>
                      <td className="px-3 py-3">{p.nit}</td>
                      <td className="px-3 py-3">{service?.nombre_servicio_proveedor || "-"}</td>
                      <td className="px-3 py-3"><p className="font-semibold">{fullContactName(contact as any) || "-"}</p><p className="text-xs text-gray-400 mt-0.5">{contact?.cargo || ""}</p></td>
                      <td className="px-3 py-3"><span className="inline-flex items-center gap-1.5 font-bold"><span className={`w-2.5 h-2.5 rounded-full ${perf === "Verde" ? "bg-green-500" : perf === "Rojo" ? "bg-red-500" : "bg-yellow-400"}`} />{perf}</span></td>
                      <td className="px-3 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${sat === "vigente" ? "bg-green-100 text-green-700" : sat === "no_vigente" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{sat === "vigente" ? "Vigente" : sat === "no_vigente" ? "No vigente" : "Pendiente"}</span></td>
                      <td className="px-3 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${status === "Activo" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{status}</span></td>
                      <td className="px-3 py-3"><div className="flex justify-end gap-1">
                        <button onClick={() => providerPdf(p)} className="h-8 w-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50" title="PDF"><Download className="w-4 h-4 mx-auto" /></button>
                        <button onClick={() => openProvider("view", p)} className="h-8 w-8 rounded-lg border border-blue-100 bg-blue-50 text-[#0C2D6B]" title="Ver"><Eye className="w-4 h-4 mx-auto" /></button>
                        <button onClick={() => openProvider("edit", p)} className="h-8 w-8 rounded-lg border border-orange-100 bg-orange-50 text-[#FF6A00]" title="Editar"><Edit2 className="w-4 h-4 mx-auto" /></button>
                        <button onClick={() => setProviderDeleteId(p.id)} className="h-8 w-8 rounded-lg border border-red-100 bg-red-50 text-red-600" title="Eliminar"><Trash2 className="w-4 h-4 mx-auto" /></button>
                      </div></td>
                    </tr>
                  );
                })}
                {!sortedProviders.length && <tr><td colSpan={9} className="px-6 py-10 text-center text-gray-500">No hay proveedores que coincidan con los filtros.</td></tr>}
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

      {/* ==================================================== */}
      {/* COTIZACIONES */}
      {/* ==================================================== */}
      {activeTab === "cotizaciones" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-[390px]">
              <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cotización, cliente o NIT..." className="w-full h-11 pl-12 pr-4 bg-white border border-gray-200 rounded-xl text-sm outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-[190px] h-11 px-4 bg-white border border-gray-200 rounded-xl text-sm outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20">
              <option value="Todos">Todos</option>
              <option value="Borrador">Borrador</option>
              <option value="Enviada">Enviada</option>
              <option value="Aprobada">Aprobada</option>
            </select>

            <button
              type="button"
              onClick={clearCrmFilters}
              className="h-11 rounded-xl border border-orange-200 bg-white px-4 text-sm font-bold text-[#FF6A00] shadow-sm transition hover:border-[#FF6A00] hover:bg-orange-50"
            >
              <X className="inline-block w-4 h-4 mr-1" />
              Limpiar filtros y orden
            </button>

            <div className="flex gap-2 ml-0 xl:ml-auto">
              <button onClick={() => openQuote("create")} className="h-12 bg-[#0C2D6B] text-white px-6 rounded-xl text-base font-bold flex items-center gap-2.5 shadow-sm hover:bg-[#143C8C]"><Plus className="w-5 h-5" /> Nueva Cotización</button>
              <button onClick={exportQuotes} className="h-11 bg-[#22C55E] text-white px-4 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#16A34A]"><Download className="w-4 h-4" /> Excel</button>
            </div>
          </div>

          <div className="px-4 pt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-bold text-gray-400">{sortedQuotes.length} de {quoteViews.length} cotizaciones visibles</span>

          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-[#F3F4F6] text-[#0C2D6B]">
                <tr>
                  <SortableTh field="quoteNumber" className="px-4 py-3">No. Cotización</SortableTh>
                  <SortableTh field="clientName" className="px-4 py-3">Cliente</SortableTh>
                  <SortableTh field="contact" className="px-4 py-3">Contacto</SortableTh>
                  <SortableTh field="date" className="px-4 py-3">Fecha</SortableTh>
                  <SortableTh field="status" className="px-4 py-3">Estado</SortableTh>
                  <SortableTh field="total" className="px-4 py-3">Total</SortableTh>
                  <th className="px-4 py-3 text-right text-[#0C2D6B]">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedQuotes.map((q) => (
                  <tr key={q.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold text-[#0C2D6B]">{q.quoteNumber}</td>
                    <td className="px-4 py-3 max-w-[220px]"><p className="truncate font-medium" title={q.clientName}>{q.clientName}</p></td>
                    <td className="px-4 py-3 max-w-[180px]"><p className="truncate" title={q.contact}>{q.contact}</p></td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(q.date)}</td>
                    <td className="px-4 py-3">
                      <div className="relative inline-block min-w-[118px]">
                        <select
                          value={q.status}
                          onChange={(e) => changeQuoteStatus(q.id, e.target.value as QuoteStatus)}
                          className={`w-full h-8 appearance-none rounded-lg border px-3 pr-8 text-xs font-bold outline-none cursor-pointer transition-colors ${
                            q.status === "Aprobada"
                              ? "bg-green-100 text-green-700 border-green-200"
                              : q.status === "Enviada"
                              ? "bg-blue-100 text-blue-700 border-blue-200"
                              : "bg-gray-100 text-gray-700 border-gray-200"
                          }`}
                          title="Cambiar estado de la cotización"
                        >
                          <option value="Borrador">Borrador</option>
                          <option value="Enviada">Enviada</option>
                          <option value="Aprobada">Aprobada</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-70" />
                      </div>
                    </td>
                    <td className="px-4 py-3 font-bold text-[#22C55E]">{moneyQuote(q.total, q.currency)}</td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-1">
                      <button onClick={() => openQuote("view", q)} className="h-8 px-2 rounded text-gray-500 hover:text-[#0C2D6B] hover:bg-blue-50 flex items-center gap-1"><Eye className="w-4 h-4" /><span className="hidden xl:inline text-xs">Ver</span></button>
                      <button onClick={() => openQuote("edit", q)} className="h-8 px-2 rounded text-gray-500 hover:text-[#FF6A00] hover:bg-orange-50 flex items-center gap-1"><Edit2 className="w-4 h-4" /><span className="hidden xl:inline text-xs">Editar</span></button>
                      <button onClick={() => generarPDFCotizacion(quoteLegacyForPdf(q) as any)} className="h-8 px-2 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 flex items-center gap-1"><Download className="w-4 h-4" /><span className="hidden xl:inline text-xs">PDF</span></button>
                      <button onClick={() => setDeleteModal({ open: true, type: "quote", id: q.id })} className="h-8 px-2 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 flex items-center gap-1"><Trash2 className="w-4 h-4" /><span className="hidden xl:inline text-xs">Eliminar</span></button>
                    </div></td>
                  </tr>
                ))}
                {!sortedQuotes.length && <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No hay cotizaciones que coincidan con los filtros.</td></tr>}
              </tbody>
            </table>
          </div>

          <PaginationControls
            page={quotePage}
            totalPages={quoteTotalPages}
            rowsPerPage={rowsPerPage}
            totalItems={sortedQuotes.length}
            itemLabel="cotizaciones filtradas"
            onPageChange={setQuotePage}
            onRowsPerPageChange={setRowsPerPage}
          />
        </div>
      )}

      {/* ==================================================== */}
      {/* DRAWER CLIENTE */}
      {/* ==================================================== */}
      {clientModal.open && (
        <div className="fixed inset-0 z-[120] bg-black/50 flex justify-end">
          <div className="bg-white w-full max-w-2xl h-full flex flex-col shadow-2xl">
            <div className="px-6 py-4 bg-[#0C2D6B] text-white flex items-center justify-between">
              <div>
                <p className="text-xs text-white/60 uppercase tracking-widest">Expediente del cliente</p>
                <h2 className="text-xl font-bold">{clientModal.mode === "create" ? "Nuevo Cliente" : clientModal.mode === "edit" ? "Editar Cliente" : "Detalle Cliente"}</h2>
              </div>
              <button
                onClick={() => {
                  setNewClientContacts([]);
                  setNewClientPhones([]);
                  setClientModal({
                    open: false,
                    mode: "create",
                    value: {},
                  });
                  setClientReturnTarget(null);
                }}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {clientModal.mode === "create" ? (
                <div className="space-y-6" data-enter-form>
                  <ErrorSummary
                    errors={clientErrors}
                    title="Revisa los campos del cliente:"
                  />

                  <div>
                    <div className="mb-4 border-b pb-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#0C2D6B]">
                        Información de la empresa
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-bold text-gray-700">
                          Código
                        </label>
                        <input
                          disabled
                          value={
                            clientModal.value
                              .codigo_cliente || ""
                          }
                          className={baseInput}
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-bold text-gray-700">
                          Estado *
                        </label>
                        <select
                          data-enter-item="true"
                          onKeyDown={moveWithEnter}
                          value={Number(
                            clientModal.value
                              .estado_cliente_id || 1
                          )}
                          onChange={(e) =>
                            setClientModal((current) => ({
                              ...current,
                              value: {
                                ...current.value,
                                estado_cliente_id:
                                  Number(e.target.value),
                              },
                            }))
                          }
                          className={inputClass()}
                        >
                          <option value={1}>Activo</option>
                          <option value={2}>Inactivo</option>
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className="mb-1 block text-xs font-bold text-gray-700">
                          Nombre de empresa / razón social *
                        </label>
                        <input
                          autoFocus
                          data-enter-item="true"
                          onKeyDown={moveWithEnter}
                          maxLength={120}
                          value={
                            clientModal.value
                              .nombre_empresa || ""
                          }
                          onChange={(e) => {
                            setClientErrors((current) => ({
                              ...current,
                              nombre_empresa: "",
                            }));

                            setClientModal((current) => ({
                              ...current,
                              value: {
                                ...current.value,
                                nombre_empresa:
                                  capitalizeCommercialTyping(
                                    e.target.value,
                                    120
                                  ),
                              },
                            }));
                          }}
                          className={inputClass(
                            clientErrors.nombre_empresa
                          )}
                          placeholder="Distribuidora Maya del Norte, S.A."
                        />
                        <ErrorText
                          value={
                            clientErrors.nombre_empresa
                          }
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-bold text-gray-700">
                          NIT *
                        </label>
                        <input
                          data-enter-item="true"
                          onKeyDown={moveWithEnter}
                          maxLength={20}
                          value={
                            clientModal.value.nit || ""
                          }
                          onChange={(e) => {
                            setClientErrors((current) => ({
                              ...current,
                              nit: "",
                            }));

                            setClientModal((current) => ({
                              ...current,
                              value: {
                                ...current.value,
                                nit: cleanNit(
                                  e.target.value
                                ),
                              },
                            }));
                          }}
                          className={inputClass(
                            clientErrors.nit
                          )}
                          placeholder="5487963-2"
                        />
                        <ErrorText
                          value={clientErrors.nit}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="mb-1 block text-xs font-bold text-gray-700">
                          Dirección
                        </label>
                        <input
                          data-enter-item="true"
                          onKeyDown={moveWithEnter}
                          maxLength={180}
                          value={
                            clientModal.value
                              .direccion || ""
                          }
                          onChange={(e) =>
                            setClientModal((current) => ({
                              ...current,
                              value: {
                                ...current.value,
                                direccion:
                                  capitalizeAddressTyping(
                                    e.target.value,
                                    180
                                  ),
                              },
                            }))
                          }
                          className={inputClass()}
                          placeholder="5a. Avenida 3-42 Zona 1, Cobán"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#0C2D6B]">
                          Contactos del cliente
                        </h3>
                        <p className="mt-0.5 text-[11px] text-gray-400">
                          Puedes agregar varios contactos y varios teléfonos por cada uno.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          openContact("create", -1)
                        }
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#FF6A00] px-3 text-xs font-bold text-white shadow-sm hover:bg-[#e95f00]"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Nuevo contacto
                      </button>
                    </div>

                    {clientErrors.contactos && (
                      <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                        {clientErrors.contactos}
                      </div>
                    )}

                    {!newClientContacts.length ? (
                      <p className="py-5 text-sm italic text-gray-400">
                        Sin contactos registrados.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {[...newClientContacts]
                          .sort((a, b) => {
                            if (
                              Boolean(a.es_principal) !==
                              Boolean(b.es_principal)
                            ) {
                              return a.es_principal ? -1 : 1;
                            }

                            return Number(b.id) - Number(a.id);
                          })
                          .map((contact) => {
                            const contactPhones =
                              newClientPhonesFor(
                                contact.id
                              );

                            return (
                              <div
                                key={contact.id}
                                className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="font-bold text-gray-800">
                                        {fullContactName(
                                          contact
                                        )}
                                      </p>

                                      {contact.es_principal && (
                                        <span className="rounded bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                                          Principal
                                        </span>
                                      )}

                                      {!contact.estado && (
                                        <span className="rounded bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                                          Inactivo
                                        </span>
                                      )}
                                    </div>

                                    <p className="mt-0.5 text-xs text-gray-500">
                                      {contact.cargo ||
                                        "Sin cargo"}
                                      {contact.correo
                                        ? ` · ${contact.correo}`
                                        : ""}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openContact(
                                          "edit",
                                          -1,
                                          contact
                                        )
                                      }
                                      className="rounded-lg p-2 text-gray-400 hover:bg-orange-50 hover:text-[#FF6A00]"
                                      title="Editar contacto"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        openPhone(
                                          "create",
                                          contact.id
                                        )
                                      }
                                      className="rounded-lg p-2 text-gray-400 hover:bg-blue-50 hover:text-[#0C2D6B]"
                                      title="Agregar teléfono"
                                    >
                                      <Phone className="h-4 w-4" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeNewClientContact(
                                          contact.id
                                        )
                                      }
                                      className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
                                      title="Quitar contacto"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  {contactPhones.length ? (
                                    contactPhones.map(
                                      (phone) => (
                                        <button
                                          key={phone.id}
                                          type="button"
                                          onClick={() =>
                                            openPhone(
                                              "edit",
                                              contact.id,
                                              phone
                                            )
                                          }
                                          className="rounded-lg border bg-white px-2.5 py-1.5 text-xs text-gray-600 hover:border-[#0C2D6B] hover:text-[#0C2D6B]"
                                          title="Editar teléfono"
                                        >
                                          {formatPhone(
                                            phone
                                          )}{" "}
                                          ·{" "}
                                          {
                                            phone.tipo_telefono
                                          }
                                          {phone.es_principal
                                            ? " · Principal"
                                            : ""}
                                        </button>
                                      )
                                    )
                                  ) : (
                                    <span className="text-xs text-gray-400">
                                      Sin teléfonos
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>
              ) : clientModal.mode === "edit" && currentClient ? (
                <div className="space-y-6" data-enter-form>
                  <ErrorSummary
                    errors={clientErrors}
                    title="Revisa los campos del cliente:"
                  />

                  <div>
                    <div className="mb-4 flex items-center justify-between border-b pb-3">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#0C2D6B]">
                          Información de la empresa
                        </h3>
                        <p className="mt-0.5 text-[11px] text-gray-400">
                          Los datos del expediente pueden modificarse.
                        </p>
                      </div>

                      <span className="rounded-full bg-orange-50 px-3 py-1 text-[11px] font-bold text-[#FF6A00]">
                        Editable
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-bold text-gray-500">
                          Código
                        </label>
                        <input
                          disabled
                          value={
                            clientModal.value
                              .codigo_cliente || ""
                          }
                          className={`${baseInput} bg-gray-50 font-bold text-[#0C2D6B]`}
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-bold text-gray-500">
                          Estado *
                        </label>
                        <select
                          data-enter-item="true"
                          onKeyDown={moveWithEnter}
                          value={Number(
                            clientModal.value
                              .estado_cliente_id || 1
                          )}
                          onChange={(e) =>
                            setClientModal((current) => ({
                              ...current,
                              value: {
                                ...current.value,
                                estado_cliente_id:
                                  Number(e.target.value),
                              },
                            }))
                          }
                          className={inputClass()}
                        >
                          <option value={1}>Activo</option>
                          <option value={2}>Inactivo</option>
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className="mb-1 block text-xs font-bold text-gray-500">
                          Empresa *
                        </label>
                        <input
                          autoFocus
                          data-enter-item="true"
                          onKeyDown={moveWithEnter}
                          maxLength={120}
                          value={
                            clientModal.value
                              .nombre_empresa || ""
                          }
                          onChange={(e) => {
                            setClientErrors((current) => ({
                              ...current,
                              nombre_empresa: "",
                            }));

                            setClientModal((current) => ({
                              ...current,
                              value: {
                                ...current.value,
                                nombre_empresa:
                                  capitalizeCommercialTyping(
                                    e.target.value,
                                    120
                                  ),
                              },
                            }));
                          }}
                          className={inputClass(
                            clientErrors.nombre_empresa
                          )}
                        />
                        <ErrorText
                          value={
                            clientErrors.nombre_empresa
                          }
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-bold text-gray-500">
                          NIT *
                        </label>
                        <input
                          data-enter-item="true"
                          onKeyDown={moveWithEnter}
                          maxLength={20}
                          value={
                            clientModal.value.nit || ""
                          }
                          onChange={(e) => {
                            setClientErrors((current) => ({
                              ...current,
                              nit: "",
                            }));

                            setClientModal((current) => ({
                              ...current,
                              value: {
                                ...current.value,
                                nit: cleanNit(
                                  e.target.value
                                ),
                              },
                            }));
                          }}
                          className={inputClass(
                            clientErrors.nit
                          )}
                        />
                        <ErrorText
                          value={clientErrors.nit}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="mb-1 block text-xs font-bold text-gray-500">
                          Dirección
                        </label>
                        <input
                          data-enter-item="true"
                          onKeyDown={moveWithEnter}
                          maxLength={180}
                          value={
                            clientModal.value
                              .direccion || ""
                          }
                          onChange={(e) =>
                            setClientModal((current) => ({
                              ...current,
                              value: {
                                ...current.value,
                                direccion:
                                  capitalizeAddressTyping(
                                    e.target.value,
                                    180
                                  ),
                              },
                            }))
                          }
                          className={inputClass()}
                        />
                      </div>

                      {currentClient.estado_cliente_id ===
                        2 && (
                        <div className="md:col-span-2 rounded-xl border border-orange-200 bg-orange-50 p-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-[#FF6A00]">
                            Motivo de inactivación
                          </p>
                          <p className="mt-1 text-sm text-gray-700">
                            {currentClient
                              .motivo_inactivacion ||
                              "Sin motivo registrado"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#0C2D6B]">
                          Contactos del cliente
                        </h3>
                        <p className="mt-0.5 text-[11px] text-gray-400">
                          Los teléfonos se administran por separado desde el ícono de teléfono.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          openContact(
                            "create",
                            currentClient.id
                          )
                        }
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#FF6A00] px-3 text-xs font-bold text-white shadow-sm hover:bg-[#e95f00]"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Nuevo contacto
                      </button>
                    </div>

                    {!currentClientContacts.length ? (
                      <p className="py-5 text-sm italic text-gray-400">
                        Sin contactos registrados.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {currentClientContacts.map(
                          (contact) => {
                            const contactPhones =
                              phones
                                .filter(
                                  (phone) =>
                                    Number(
                                      phone.contacto_id
                                    ) ===
                                    Number(contact.id)
                                )
                                .sort((a, b) => {
                                  if (
                                    Boolean(
                                      a.es_principal
                                    ) !==
                                    Boolean(
                                      b.es_principal
                                    )
                                  ) {
                                    return a.es_principal
                                      ? -1
                                      : 1;
                                  }

                                  return (
                                    Number(b.id) -
                                    Number(a.id)
                                  );
                                });

                            return (
                              <div
                                key={contact.id}
                                className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="font-bold text-gray-800">
                                        {fullContactName(
                                          contact
                                        )}
                                      </p>

                                      {contact.es_principal && (
                                        <span className="rounded bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                                          Principal
                                        </span>
                                      )}

                                      {!contact.estado && (
                                        <span className="rounded bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                                          Inactivo
                                        </span>
                                      )}
                                    </div>

                                    <p className="mt-0.5 text-xs text-gray-500">
                                      {contact.cargo ||
                                        "Sin cargo"}
                                      {contact.correo
                                        ? ` · ${contact.correo}`
                                        : ""}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openContact(
                                          "edit",
                                          currentClient.id,
                                          contact
                                        )
                                      }
                                      className="rounded-lg p-2 text-gray-400 hover:bg-orange-50 hover:text-[#FF6A00]"
                                      title="Editar contacto"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        openPhone(
                                          "create",
                                          contact.id
                                        )
                                      }
                                      className="rounded-lg p-2 text-gray-400 hover:bg-blue-50 hover:text-[#0C2D6B]"
                                      title="Agregar teléfono"
                                    >
                                      <Phone className="h-4 w-4" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDeleteModal({
                                          open: true,
                                          type: "contact",
                                          id: contact.id,
                                        })
                                      }
                                      className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
                                      title="Eliminar contacto"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  {contactPhones.length ? (
                                    contactPhones.map(
                                      (phone) => (
                                        <button
                                          key={phone.id}
                                          type="button"
                                          onClick={() =>
                                            openPhone(
                                              "edit",
                                              contact.id,
                                              phone
                                            )
                                          }
                                          className="rounded-lg border bg-white px-2.5 py-1.5 text-xs text-gray-600 hover:border-[#0C2D6B] hover:text-[#0C2D6B]"
                                          title="Editar teléfono"
                                        >
                                          {formatPhone(
                                            phone
                                          )}{" "}
                                          ·{" "}
                                          {
                                            phone.tipo_telefono
                                          }
                                          {phone.es_principal
                                            ? " · Principal"
                                            : ""}
                                        </button>
                                      )
                                    )
                                  ) : (
                                    <span className="text-xs text-gray-400">
                                      Sin teléfonos
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : currentClient ? (
                <div className="space-y-6">
                  <div>
                    <div className="mb-3 flex items-center justify-between border-b pb-2">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#0C2D6B]">
                          Información de la empresa
                        </h3>
                        <p className="mt-0.5 text-[11px] text-gray-400">
                          Vista de consulta · solo lectura
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><p className="text-xs text-gray-400">Código</p><p className="font-bold text-[#0C2D6B]">{currentClient.codigo_cliente}</p></div>
                      <div><p className="text-xs text-gray-400">Estado</p><span className={`inline-block mt-1 px-2 py-1 rounded text-xs font-bold ${currentClient.estado_cliente_id === 1 ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"}`}>{estadoClienteNombre(currentClient.estado_cliente_id)}</span></div>
                      <div className="col-span-2"><p className="text-xs text-gray-400">Empresa</p><p className="font-bold text-lg">{currentClient.nombre_empresa}</p></div>
                      <div><p className="text-xs text-gray-400">NIT</p><p>{currentClient.nit}</p></div>
                      <div className="col-span-2"><p className="text-xs text-gray-400">Dirección</p><p>{currentClient.direccion || "-"}</p></div>

                      {currentClient.estado_cliente_id === 2 && (
                        <div className="col-span-2 rounded-xl border border-orange-200 bg-orange-50 p-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-[#FF6A00]">
                            Motivo de inactivación
                          </p>
                          <p className="mt-1 text-sm font-medium text-gray-700">
                            {currentClient.motivo_inactivacion || "Sin motivo registrado"}
                          </p>
                          {currentClient.fecha_inactivacion && (
                            <p className="mt-1 text-xs text-gray-500">
                              Fecha: {new Date(currentClient.fecha_inactivacion).toLocaleString("es-GT")}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="mb-3 border-b pb-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#0C2D6B]">
                        Contactos del cliente
                      </h3>
                    </div>

                    {!currentClientContacts.length ? <p className="text-sm text-gray-400 italic py-4">Sin contactos registrados.</p> : (
                      <div className="space-y-3">
                        {currentClientContacts.map((ct) => {
                          const ctPhones = phones.filter((p) => p.contacto_id === ct.id).sort((a, b) => b.id - a.id);
                          return (
                            <div key={ct.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                              <div className="flex justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-bold text-gray-800">{fullContactName(ct)}</p>
                                    {ct.es_principal && <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-bold">Principal</span>}
                                    {!ct.estado && <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-600 text-[10px] font-bold">Inactivo</span>}
                                  </div>
                                  <p className="text-xs text-gray-500">{ct.cargo || "Sin cargo"}{ct.correo ? ` · ${ct.correo}` : ""}</p>
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {ctPhones.map((p) => (
                                  <span
                                    key={p.id}
                                    className="rounded-lg border bg-white px-2.5 py-1.5 text-xs text-gray-600"
                                  >
                                    {formatPhone(p)} ·{" "}
                                    {p.tipo_telefono}
                                    {p.es_principal
                                      ? " · Principal"
                                      : ""}
                                  </span>
                                ))}
                                {!ctPhones.length && <span className="text-xs text-gray-400">Sin teléfonos</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="p-4 border-t bg-white flex justify-end gap-2">
              <button
                onClick={() => {
                  setClientModal({
                    open: false,
                    mode: "create",
                    value: {},
                  });
                  setNewClientContacts([]);
                  setNewClientPhones([]);
                  setClientReturnTarget(null);
                }}
                className="h-10 px-4 rounded-lg font-bold text-gray-600 hover:bg-gray-100"
              >
                {clientModal.mode === "view"
                  ? "Cerrar"
                  : "Cancelar"}
              </button>
              {clientModal.mode !== "view" && <button data-enter-save="true" onClick={saveClientData} className="h-10 px-5 rounded-lg font-bold bg-[#0C2D6B] text-white hover:bg-[#143C8C]">Guardar cliente</button>}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL CONTACTO */}
      {/* ==================================================== */}
      {contactModal.open && (
        <div className="fixed inset-0 z-[130] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-[#0C2D6B] px-6 py-4 flex justify-between items-center">
              <h2 className="text-white font-bold text-lg">{contactModal.mode === "edit" ? "Editar contacto" : "Nuevo contacto"}</h2>
              <button onClick={() => setContactModal({ open: false, mode: "create", value: {}, clientId: null })} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4" data-enter-form>
              <ErrorSummary errors={contactErrors} title="Revisa los datos del contacto:" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-gray-700 mb-1 first-letter:uppercase">Primer nombre *</label><input autoFocus data-enter-item="true" onKeyDown={moveWithEnter} maxLength={30} value={contactModal.value.primer_nombre || ""} onChange={(e) => { setContactErrors((x) => ({ ...x, primer_nombre: "" })); setContactModal((p) => ({ ...p, value: { ...p.value, primer_nombre: capitalizePersonTyping(e.target.value, 35) } })); }} className={inputClass(contactErrors.primer_nombre)} /><ErrorText value={contactErrors.primer_nombre} /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1 first-letter:uppercase">Segundo nombre</label><input data-enter-item="true" onKeyDown={moveWithEnter} maxLength={30} value={contactModal.value.segundo_nombre || ""} onChange={(e) => setContactModal((p) => ({ ...p, value: { ...p.value, segundo_nombre: capitalizePersonTyping(e.target.value, 35) } }))} className={inputClass()} /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1 first-letter:uppercase">Primer apellido *</label><input data-enter-item="true" onKeyDown={moveWithEnter} maxLength={35} value={contactModal.value.primer_apellido || ""} onChange={(e) => { setContactErrors((x) => ({ ...x, primer_apellido: "" })); setContactModal((p) => ({ ...p, value: { ...p.value, primer_apellido: capitalizePersonTyping(e.target.value, 35) } })); }} className={inputClass(contactErrors.primer_apellido)} /><ErrorText value={contactErrors.primer_apellido} /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1 first-letter:uppercase">Segundo apellido</label><input data-enter-item="true" onKeyDown={moveWithEnter} maxLength={35} value={contactModal.value.segundo_apellido || ""} onChange={(e) => setContactModal((p) => ({ ...p, value: { ...p.value, segundo_apellido: capitalizePersonTyping(e.target.value, 35) } }))} className={inputClass()} /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1 first-letter:uppercase">Cargo</label><input data-enter-item="true" onKeyDown={moveWithEnter} maxLength={60} value={contactModal.value.cargo || ""} onChange={(e) => setContactModal((p) => ({ ...p, value: { ...p.value, cargo: capitalizeRoleTyping(e.target.value, 60) } }))} className={inputClass()} /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1 first-letter:uppercase">Correo</label><input data-enter-item="true" onKeyDown={moveWithEnter} type="email" maxLength={150} value={contactModal.value.correo || ""} onChange={(e) => { setContactErrors((x) => ({ ...x, correo: "" })); setContactModal((p) => ({ ...p, value: { ...p.value, correo: cleanEmail(e.target.value) } })); }} className={inputClass(contactErrors.correo)} placeholder="maria.lopez@empresa.com.gt" /><ErrorText value={contactErrors.correo} /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1 first-letter:uppercase">Contacto principal</label><select data-enter-item="true" onKeyDown={moveWithEnter} value={contactModal.value.es_principal ? "1" : "0"} onChange={(e) => setContactModal((p) => ({ ...p, value: { ...p.value, es_principal: e.target.value === "1" } }))} className={inputClass()}><option value="1">Sí</option><option value="0">No</option></select></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1 first-letter:uppercase">Estado</label><select data-enter-item="true" onKeyDown={moveWithEnter} value={contactModal.value.estado === false ? "0" : "1"} onChange={(e) => setContactModal((p) => ({ ...p, value: { ...p.value, estado: e.target.value === "1" } }))} className={inputClass()}><option value="1">Activo</option><option value="0">Inactivo</option></select></div>
              </div>
            </div>
            <div className="px-6 pb-6 flex justify-end gap-2"><button onClick={() => setContactModal({ open: false, mode: "create", value: {}, clientId: null })} className="h-10 px-4 border rounded-lg text-sm font-bold">Cancelar</button><button data-enter-save="true" onClick={saveContactData} className="h-10 px-5 bg-[#FF6A00] text-white rounded-lg text-sm font-bold">Guardar contacto</button></div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL TELÉFONO */}
      {/* ==================================================== */}
      {phoneModal.open && (
        <div className="fixed inset-0 z-[140] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-[#0C2D6B] px-6 py-4 flex justify-between items-center"><h2 className="text-white font-bold">{phoneModal.mode === "edit" ? "Editar teléfono" : "Nuevo teléfono"}</h2><button onClick={() => setPhoneModal({ open: false, mode: "create", value: {}, contactId: null })} className="text-white/70"><X className="w-5 h-5" /></button></div>
            <div className="p-6 space-y-4" data-enter-form>
              <ErrorSummary errors={phoneErrors} title="Revisa el teléfono:" />
              <div className="grid grid-cols-[150px_1fr] gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 first-letter:uppercase">Prefijo *</label>
                  <select
                    autoFocus
                    data-enter-item="true"
                    onKeyDown={moveWithEnter}
                    value={phoneModal.value.prefijo_telefonico_id || getPhonePrefix().id}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      const limit = phoneDigitsLimit(id);
                      setPhoneErrors({});
                      setPhoneModal((p) => ({
                        ...p,
                        value: {
                          ...p.value,
                          prefijo_telefonico_id: id,
                          telefono: cleanPhone(String(p.value.telefono || ""), limit),
                        },
                      }));
                    }}
                    className={inputClass(phoneErrors.prefijo)}
                  >
                    {prefixOptions.map((p) => (
                      <option key={p.id} value={p.id}>{p.prefijo} · {p.pais}</option>
                    ))}
                  </select>
                  <ErrorText value={phoneErrors.prefijo} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 first-letter:uppercase">Número *</label>
                  <input
                    data-enter-item="true"
                    onKeyDown={moveWithEnter}
                    inputMode="numeric"
                    value={phoneModal.value.telefono || ""}
                    maxLength={phoneDigitsLimit(phoneModal.value.prefijo_telefonico_id)}
                    onChange={(e) => {
                      const limit = phoneDigitsLimit(phoneModal.value.prefijo_telefonico_id);
                      setPhoneErrors({});
                      setPhoneModal((p) => ({ ...p, value: { ...p.value, telefono: cleanPhone(e.target.value, limit) } }));
                    }}
                    className={inputClass(phoneErrors.telefono)}
                    placeholder={getPhonePrefix(phoneModal.value.prefijo_telefonico_id).ejemplo?.replace(getPhonePrefix(phoneModal.value.prefijo_telefonico_id).prefijo, "").trim() || "55555555"}
                    title="Ingrese solo números, sin guiones ni espacios."
                  />
                  <p className="mt-1 text-[11px] text-gray-400">Solo números · {phoneDigitsLimit(phoneModal.value.prefijo_telefonico_id)} dígitos para {getPhonePrefix(phoneModal.value.prefijo_telefonico_id).pais}</p>
                  <ErrorText value={phoneErrors.telefono} />
                </div>
              </div>
              <div><label className="block text-xs font-bold text-gray-700 mb-1 first-letter:uppercase">Tipo de teléfono</label><select data-enter-item="true" onKeyDown={moveWithEnter} value={phoneModal.value.tipo_telefono || "Móvil"} onChange={(e) => setPhoneModal((p) => ({ ...p, value: { ...p.value, tipo_telefono: e.target.value } }))} className={inputClass()}><option>Móvil</option><option>Oficina</option><option>WhatsApp</option><option>Emergencia</option><option>Otro</option></select></div>
              <div><label className="block text-xs font-bold text-gray-700 mb-1 first-letter:uppercase">¿Es principal?</label><select data-enter-item="true" onKeyDown={moveWithEnter} value={phoneModal.value.es_principal ? "1" : "0"} onChange={(e) => setPhoneModal((p) => ({ ...p, value: { ...p.value, es_principal: e.target.value === "1" } }))} className={inputClass()}><option value="1">Sí</option><option value="0">No</option></select></div>
            </div>
            <div className="px-6 pb-6 flex justify-between gap-2">
              {phoneModal.mode === "edit" &&
              phoneModal.value.id ? (
                Number(phoneModal.contactId) < 0 ? (
                  <button
                    onClick={() =>
                      removeNewClientPhone(
                        Number(
                          phoneModal.value.id
                        )
                      )
                    }
                    className="h-10 px-4 text-red-600 font-bold text-sm hover:bg-red-50 rounded-lg"
                  >
                    Eliminar
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      setDeleteModal({
                        open: true,
                        type: "phone",
                        id: Number(
                          phoneModal.value.id
                        ),
                      })
                    }
                    className="h-10 px-4 text-red-600 font-bold text-sm hover:bg-red-50 rounded-lg"
                  >
                    Eliminar
                  </button>
                )
              ) : (
                <div />
              )}
              <div className="flex gap-2"><button onClick={() => setPhoneModal({ open: false, mode: "create", value: {}, contactId: null })} className="h-10 px-4 border rounded-lg text-sm font-bold">Cancelar</button><button data-enter-save="true" onClick={savePhoneData} className="h-10 px-5 bg-[#0C2D6B] text-white rounded-lg text-sm font-bold">Guardar</button></div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL OPORTUNIDAD */}
      {/* ==================================================== */}
      {leadModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-[#0C2D6B] text-white flex justify-between items-center">
              <div><p className="text-xs text-white/60 uppercase tracking-widest">Seguimiento comercial</p><h2 className="text-xl font-bold">{leadModal.mode === "create" ? "Nueva Oportunidad" : leadModal.mode === "edit" ? "Editar Oportunidad" : "Detalle de Oportunidad"}</h2></div>
              <button onClick={() => setLeadModal({ open: false, mode: "create", value: {} })}><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 space-y-4" data-enter-form>
              {leadModal.mode !== "view" && <ErrorSummary errors={leadErrors} title="Revisa los campos de la oportunidad:" />}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-gray-700 mb-1 first-letter:uppercase">Código</label><input disabled value={leadModal.value.codigo_oportunidad || ""} className={baseInput} /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1 first-letter:uppercase">Etapa *</label><select disabled={leadModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} value={Number(leadModal.value.estado_id || 1)} onChange={(e) => { setLeadErrors((x) => ({ ...x, estado_id: "" })); setLeadModal((p) => ({ ...p, value: { ...p.value, estado_id: Number(e.target.value) } })); }} className={inputClass(leadErrors.estado_id)}><option value={1}>Prospecto</option><option value={2}>Cotizado</option><option value={3}>Negociación</option><option value={4}>Ganado</option><option value={5}>Perdido</option></select><ErrorText value={leadErrors.estado_id} /></div>
                <div className="sm:col-span-2"><label className="block text-xs font-bold text-gray-700 mb-1 first-letter:uppercase">Nombre de la oportunidad *</label><input autoFocus disabled={leadModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} maxLength={100} value={leadModal.value.nombre_oportunidad || ""} onChange={(e) => { setLeadErrors((x) => ({ ...x, nombre_oportunidad: "" })); setLeadModal((p) => ({ ...p, value: { ...p.value, nombre_oportunidad: capitalizeCommercialTyping(e.target.value, 100) } })); }} className={inputClass(leadErrors.nombre_oportunidad)} placeholder="Exportación terrestre de textiles a El Salvador" /><ErrorText value={leadErrors.nombre_oportunidad} /></div>
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label className="block text-xs font-bold text-gray-700 first-letter:uppercase">Cliente *</label>
                    {leadModal.mode !== "view" && (
                      <button
                        type="button"
                        onClick={() => openNewClientFrom("lead")}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#FF6A00] hover:underline"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Cliente nuevo
                      </button>
                    )}
                  </div>
                  <SearchableClientSelect
                    id="oportunidad-cliente"
                    valueId={leadModal.value.cliente_id}
                    clients={clients}
                    disabled={leadModal.mode === "view"}
                    error={leadErrors.cliente_id}
                    placeholder="Buscar cliente por código, empresa o NIT..."
                    onChange={(clientId) => {
                      setLeadErrors((current) => ({
                        ...current,
                        cliente_id: "",
                      }));

                      setLeadModal((current) => ({
                        ...current,
                        value: {
                          ...current.value,
                          cliente_id: clientId,
                        },
                      }));
                    }}
                  />
                  <ErrorText value={leadErrors.cliente_id} />
                </div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1 first-letter:uppercase">Ejecutivo *</label><select disabled={leadModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} value={leadModal.value.ejecutivo_id || ""} onChange={(e) => { setLeadErrors((x) => ({ ...x, ejecutivo_id: "" })); setLeadModal((p) => ({ ...p, value: { ...p.value, ejecutivo_id: Number(e.target.value) || null } })); }} className={inputClass(leadErrors.ejecutivo_id)}><option value="">Seleccione...</option>{salesUsers.map((u) => <option key={u.id} value={u.id}>{fullUserName(u)} ({u.nombre_usuario})</option>)}</select><ErrorText value={leadErrors.ejecutivo_id} /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1 first-letter:uppercase">Modalidad *</label><select disabled={leadModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} value={leadModal.value.modalidad_id || ""} onChange={(e) => { setLeadErrors((x) => ({ ...x, modalidad_id: "" })); setLeadModal((p) => ({ ...p, value: { ...p.value, modalidad_id: Number(e.target.value) || null } })); }} className={inputClass(leadErrors.modalidad_id)}><option value="">Seleccione...</option>{modalidades.map((m) => <option key={m.id} value={m.id}>{m.nombre_modalidad}</option>)}</select><ErrorText value={leadErrors.modalidad_id} /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1 first-letter:uppercase">Probabilidad (%) *</label><input disabled={leadModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} type="text" inputMode="numeric" value={leadModal.value.probabilidad ?? ""} onChange={(e) => { const limpio = cleanInteger(e.target.value, 3); const n = limpio === "" ? undefined : Math.min(100, Number(limpio)); setLeadErrors((x) => ({ ...x, probabilidad: "" })); setLeadModal((p) => ({ ...p, value: { ...p.value, probabilidad: n } })); }} className={inputClass(leadErrors.probabilidad)} /><ErrorText value={leadErrors.probabilidad} /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1 first-letter:uppercase">Monto estimado (Q)</label><input disabled={leadModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} type="text" inputMode="decimal" value={Number(leadModal.value.monto_estimado || 0) === 0 ? "" : String(leadModal.value.monto_estimado)} placeholder="45000" onFocus={(e) => e.currentTarget.select()} onChange={(e) => { const limpio = cleanDecimal(e.target.value); setLeadErrors((x) => ({ ...x, monto_estimado: "" })); setLeadModal((p) => ({ ...p, value: { ...p.value, monto_estimado: limpio === "" ? undefined : Number(limpio) } })); }} className={inputClass(leadErrors.monto_estimado)} /><ErrorText value={leadErrors.monto_estimado} /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1 first-letter:uppercase">Fecha creación *</label><input disabled={leadModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} type="date" value={leadModal.value.fecha_creacion || todayISO()} onChange={(e) => { setLeadErrors((x) => ({ ...x, fecha_creacion: "" })); setLeadModal((p) => ({ ...p, value: { ...p.value, fecha_creacion: e.target.value } })); }} className={inputClass(leadErrors.fecha_creacion)} /><ErrorText value={leadErrors.fecha_creacion} /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1 first-letter:uppercase">Cierre estimado</label><input disabled={leadModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} type="date" value={leadModal.value.fecha_cierre_estimada || ""} onChange={(e) => { setLeadErrors((x) => ({ ...x, fecha_cierre_estimada: "" })); setLeadModal((p) => ({ ...p, value: { ...p.value, fecha_cierre_estimada: e.target.value } })); }} className={inputClass(leadErrors.fecha_cierre_estimada)} /><ErrorText value={leadErrors.fecha_cierre_estimada} /></div>
              </div>
            </div>
            <div className="p-5 border-t bg-gray-50 flex flex-col sm:flex-row justify-between gap-2">
              <div>{leadModal.mode === "view" && currentLeadView && <button onClick={() => setDeleteModal({ open: true, type: "lead", id: currentLeadView.id })} className="h-10 px-4 rounded-lg text-red-600 font-bold hover:bg-red-50 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Eliminar</button>}</div>
              <div className="flex gap-2 justify-end">
                {leadModal.mode === "view" && currentLeadView ? <><button onClick={() => convertLeadToQuote(currentLeadView)} className="h-10 px-4 bg-[#FF6A00] text-white rounded-lg font-bold flex items-center gap-2"><FileText className="w-4 h-4" /> Generar Cotización</button><button onClick={() => openLead("edit", currentLeadView)} className="h-10 px-4 bg-[#0C2D6B] text-white rounded-lg font-bold flex items-center gap-2"><Edit2 className="w-4 h-4" /> Editar</button></> : <><button onClick={() => setLeadModal({ open: false, mode: "create", value: {} })} className="h-10 px-4 rounded-lg font-bold text-gray-600 hover:bg-gray-200">Cancelar</button><button data-enter-save="true" onClick={saveLeadData} className="h-10 px-5 bg-[#FF6A00] text-white rounded-lg font-bold">Guardar oportunidad</button></>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL COTIZACIÓN - FORMATO COMERCIAL TIPO FACTURA */}
      {/* ==================================================== */}
      {quoteModal.open && (
        <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-[96vw] xl:max-w-6xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-5 md:p-6 bg-[#0C2D6B] text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
              <div>
                <p className="text-xs uppercase tracking-widest text-white/65">Documento comercial</p>
                <h2 className="text-xl font-bold">
                  {quoteModal.mode === "create" ? "Nueva Cotización" : quoteModal.mode === "edit" ? "Editar Cotización" : "Documento de Cotización"}
                </h2>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {quoteModal.mode === "view" && (
                  <button
                    onClick={() => {
                      const q = quoteViews.find((item) => item.id === Number(quoteModal.value.id));
                      if (q) generarPDFCotizacion(quoteLegacyForPdf(q) as any);
                    }}
                    className="h-9 px-3 rounded-lg bg-blue-800 hover:bg-blue-900 text-white text-sm font-bold flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Descargar PDF
                  </button>
                )}
                <button onClick={() => setQuoteModal({ open: false, mode: "create", value: {}, details: [] })} className="ml-auto sm:ml-0 text-white/75 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-3 md:p-5 overflow-auto flex-1 bg-gray-100">
              <div className="min-w-[950px] max-w-6xl mx-auto space-y-3">
                {quoteModal.mode !== "view" && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-[#0C2D6B]">
                    Selecciona los datos de la cotización. En <b>Razón social</b> y <b>Contacto</b> puedes escribir para buscar. Presioná <b>Enter</b> para seleccionar el primer resultado y avanzar al siguiente campo.
                  </div>
                )}

                <ErrorSummary errors={quoteErrors} title="Revisa los campos de la cotización:" />

                <div className="bg-[#f2f2f2] border border-black text-[12px] font-sans" data-enter-form>
                  {/* FECHA */}
                  <div className="text-center font-bold border-b border-black py-2 bg-white">
                    FECHA: GUATEMALA,
                    {quoteModal.mode === "view" ? (
                      <span className="ml-2">{formatDate(String(quoteModal.value.fecha_ui || ""))}</span>
                    ) : (
                      <input
                        type="date"
                        data-enter-item="true"
                        onKeyDown={moveWithEnter}
                        value={String(quoteModal.value.fecha_ui || todayISO())}
                        onChange={(e) => setQuoteModal((p) => ({ ...p, value: { ...p.value, fecha_ui: e.target.value } }))}
                        className="ml-2 h-8 w-[170px] rounded border border-blue-300 bg-white px-2 text-center text-[#0C2D6B] font-semibold outline-none focus:border-[#FF6A00] focus:ring-2 focus:ring-[#FF6A00]/20"
                      />
                    )}
                  </div>

                  {/* NÚMERO / ESTADO / CONTACTO */}
                  <div className="grid grid-cols-[1fr_0.75fr_1.35fr] border-b border-black">
                    <div className="border-r border-black p-2 flex items-center gap-2">
                      <span className="font-bold whitespace-nowrap">N° COTIZACIÓN:</span>
                      <input
                        readOnly
                        value={quoteModal.value.codigo_cotizacion || ""}
                        className="h-8 flex-1 min-w-0 rounded border border-gray-300 bg-gray-100 px-2 font-bold text-[#0C2D6B]"
                      />
                    </div>

                    <div className="border-r border-black p-2 flex items-center gap-2">
                      <span className="font-bold whitespace-nowrap">ESTADO:</span>
                      <div className="relative flex-1 min-w-0">
                        <select
                          data-enter-item={quoteModal.mode !== "view" ? "true" : undefined}
                          onKeyDown={quoteModal.mode !== "view" ? moveWithEnter : undefined}
                          value={(quoteModal.value.estado_ui || "Borrador") as QuoteStatus}
                          onChange={(e) => {
                            const nuevoEstado = e.target.value as QuoteStatus;

                            setQuoteModal((p) => ({
                              ...p,
                              value: {
                                ...p.value,
                                estado_ui: nuevoEstado,
                              },
                            }));

                            if (quoteModal.mode === "view" && quoteModal.value.id) {
                              changeQuoteStatus(Number(quoteModal.value.id), nuevoEstado);
                            }
                          }}
                          className={`w-full h-8 appearance-none rounded-lg border px-2 pr-7 text-xs font-bold outline-none cursor-pointer ${
                            quoteModal.value.estado_ui === "Aprobada"
                              ? "bg-green-100 text-green-700 border-green-300"
                              : quoteModal.value.estado_ui === "Enviada"
                              ? "bg-blue-100 text-blue-700 border-blue-300"
                              : "bg-gray-100 text-gray-700 border-gray-300"
                          }`}
                          title="Seleccionar estado de la cotización"
                        >
                          <option value="Borrador">Borrador</option>
                          <option value="Enviada">Enviada</option>
                          <option value="Aprobada">Aprobada</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-70" />
                      </div>
                    </div>

                    <div className="p-2 flex items-center gap-2">
                      <div className="flex flex-col shrink-0">
                        <span className="font-bold whitespace-nowrap">CONTACTO:</span>
                        {quoteModal.mode !== "view" && quoteModal.value.cliente_id && (
                          <button
                            type="button"
                            onClick={() => openContact("create", Number(quoteModal.value.cliente_id))}
                            className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-[#FF6A00] hover:underline"
                          >
                            <UserPlus className="w-3 h-3" /> Contacto nuevo
                          </button>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <SearchableContactSelect
                          id="cotizacion-contacto"
                          valueId={quoteModal.value.contacto_id}
                          contacts={
                            quoteModal.value.cliente_id
                              ? quoteContacts
                              : contacts.filter((contact) => contact.estado !== false)
                          }
                          disabled={quoteModal.mode === "view"}
                          error={quoteErrors.contacto_id}
                          placeholder={
                            quoteModal.value.cliente_id
                              ? "Buscar contacto del cliente..."
                              : "Buscar contacto por nombre, correo o cargo..."
                          }
                          onChange={(contactId) => {
                            const selectedContact = contacts.find(
                              (contact) =>
                                Number(contact.id) === Number(contactId)
                            );

                            setQuoteErrors((current) => ({
                              ...current,
                              contacto_id: "",
                              cliente_id: "",
                            }));

                            setQuoteModal((current) => ({
                              ...current,
                              value: {
                                ...current.value,
                                contacto_id: contactId,
                                // Si el contacto se buscó antes que el cliente,
                                // relaciona automáticamente su empresa.
                                cliente_id: selectedContact
                                  ? Number(selectedContact.cliente_id)
                                  : current.value.cliente_id,
                              },
                            }));
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* RAZÓN SOCIAL / EMAIL */}
                  <div className="grid grid-cols-2 border-b border-black">
                    <div className="border-r border-black p-2 flex items-center gap-2">
                      <div className="flex flex-col shrink-0">
                        <span className="font-bold whitespace-nowrap">RAZÓN SOCIAL:</span>
                        {quoteModal.mode !== "view" && (
                          <button
                            type="button"
                            onClick={() => openNewClientFrom("quote")}
                            className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-[#FF6A00] hover:underline"
                          >
                            <UserPlus className="w-3 h-3" /> Cliente nuevo
                          </button>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <SearchableClientSelect
                          id="cotizacion-cliente"
                          valueId={quoteModal.value.cliente_id}
                          clients={clients}
                          disabled={quoteModal.mode === "view"}
                          error={quoteErrors.cliente_id}
                          placeholder="Buscar cliente por código, empresa o NIT..."
                          onChange={(clientId) => {
                            const principal = clientId
                              ? principalContact(clientId)
                              : undefined;

                            setQuoteErrors((current) => ({
                              ...current,
                              cliente_id: "",
                              contacto_id: "",
                            }));

                            setQuoteModal((current) => ({
                              ...current,
                              value: {
                                ...current.value,
                                cliente_id: clientId,
                                // Al escoger una empresa se propone su contacto
                                // principal, pero el usuario puede buscar otro.
                                contacto_id: principal?.id || null,
                              },
                            }));
                          }}
                        />
                      </div>
                    </div>
                    <div className="p-2 flex items-center gap-2">
                      <span className="font-bold whitespace-nowrap">EMAIL:</span>
                      <input readOnly value={quoteContact?.correo || ""} className="h-8 flex-1 min-w-0 rounded border border-gray-300 bg-white px-2 text-blue-700" placeholder="Correo del contacto" />
                    </div>
                  </div>

                  {/* TELEFONOS */}
                  <div className="border-b border-black p-2 text-center font-bold bg-white">
                    NÚMERO TELEFÓNICO: {quoteContactPhones.length ? quoteContactPhones.map((p) => formatPhone(p)).join(" / ") : "Seleccione un contacto con teléfono registrado"}
                  </div>

                  {/* CABECERA AZUL */}
                  <div className="grid grid-cols-3 bg-[#0C2D6B] text-white font-bold text-center">
                    <div className="border border-black p-2">EJECUTIVO VENTAS</div>
                    <div className="border border-black p-2">EXP / IMP</div>
                    <div className="border border-black p-2">FORMA DE PAGO</div>
                  </div>

                  <div className="grid grid-cols-3 border-b border-black text-center">
                    <div className="border border-black p-2">
                      {quoteModal.mode === "view" ? (
                        <span className="font-semibold">{fullUserName(quoteExecutive) || "-"}</span>
                      ) : (
                        <select
                          data-enter-item="true"
                          onKeyDown={moveWithEnter}
                          value={quoteModal.value.ejecutivo_id || ""}
                          onChange={(e) => { setQuoteErrors((x) => ({ ...x, ejecutivo_id: "" })); setQuoteModal((p) => ({ ...p, value: { ...p.value, ejecutivo_id: Number(e.target.value) || null } })); }}
                          className={`w-full h-8 rounded border bg-white px-2 font-semibold text-[#0C2D6B] outline-none ${quoteErrors.ejecutivo_id ? "border-red-400" : "border-blue-300 focus:border-[#FF6A00]"}`}
                        >
                          <option value="">Seleccione...</option>
                          {salesUsers.map((u) => <option key={u.id} value={u.id}>{fullUserName(u)}</option>)}
                        </select>
                      )}
                    </div>
                    <div className="border border-black p-2">
                      {quoteModal.mode === "view" ? (
                        <span className="font-semibold">{quoteModality?.nombre_modalidad || "-"}</span>
                      ) : (
                        <select
                          data-enter-item="true"
                          onKeyDown={moveWithEnter}
                          value={quoteModal.value.modalidad_id || ""}
                          onChange={(e) => { setQuoteErrors((x) => ({ ...x, modalidad_id: "" })); setQuoteModal((p) => ({ ...p, value: { ...p.value, modalidad_id: Number(e.target.value) || null } })); }}
                          className={`w-full h-8 rounded border bg-white px-2 font-semibold text-[#0C2D6B] outline-none ${quoteErrors.modalidad_id ? "border-red-400" : "border-blue-300 focus:border-[#FF6A00]"}`}
                        >
                          <option value="">Seleccione...</option>
                          {modalidades.map((m) => <option key={m.id} value={m.id}>{m.nombre_modalidad}</option>)}
                        </select>
                      )}
                    </div>
                    <div className="border border-black p-2">
                      {quoteModal.mode === "view" ? (
                        <span className="font-semibold">{quotePayment?.nombre_forma_pago || "-"}</span>
                      ) : (
                        <select
                          data-enter-item="true"
                          onKeyDown={moveWithEnter}
                          value={quoteModal.value.forma_pago_id || ""}
                          onChange={(e) => { setQuoteErrors((x) => ({ ...x, forma_pago_id: "" })); setQuoteModal((p) => ({ ...p, value: { ...p.value, forma_pago_id: Number(e.target.value) || null } })); }}
                          className={`w-full h-8 rounded border bg-white px-2 font-semibold text-[#0C2D6B] outline-none ${quoteErrors.forma_pago_id ? "border-red-400" : "border-blue-300 focus:border-[#FF6A00]"}`}
                        >
                          <option value="">Seleccione...</option>
                          {formasPago.map((f) => <option key={f.id} value={f.id}>{f.nombre_forma_pago}</option>)}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* BULTOS / PESO / VOLUMEN */}
                  <div className="grid grid-cols-6 border-b border-black text-center">
                    <div className="border border-black p-2 font-bold">TOTAL DE BULTOS</div>
                    <div className="border border-black p-2 font-bold text-[#0C2D6B]">{quoteTotalPackages || "-"}</div>
                    <div className="border border-black p-2 font-bold">PESO (TON):</div>
                    <div className="border border-black p-2">
                      <input
                        disabled={quoteModal.mode === "view"}
                        data-enter-item="true"
                        onKeyDown={moveWithEnter}
                        type="text"
                        inputMode="decimal"
                        value={quoteModal.value.peso_ui || ""}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => setQuoteModal((p) => ({ ...p, value: { ...p.value, peso_ui: cleanDecimal(e.target.value, 8, 2) } }))}
                        placeholder="12.5"
                        className="w-full h-8 rounded border border-blue-300 bg-white px-2 text-center font-semibold outline-none focus:border-[#FF6A00]"
                      />
                    </div>
                    <div className="border border-black p-2 font-bold">VOLUMEN (PIES):</div>
                    <div className="border border-black p-2">
                      <input
                        disabled={quoteModal.mode === "view"}
                        data-enter-item="true"
                        onKeyDown={moveWithEnter}
                        type="text"
                        inputMode="decimal"
                        value={quoteModal.value.volumen_ui || ""}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => setQuoteModal((p) => ({ ...p, value: { ...p.value, volumen_ui: cleanDecimal(e.target.value, 8, 2) } }))}
                        placeholder="35"
                        className="w-full h-8 rounded border border-blue-300 bg-white px-2 text-center font-semibold outline-none focus:border-[#FF6A00]"
                      />
                    </div>
                  </div>

                  {/* DESCRIPCIÓN CARGA */}
                  <div className="grid grid-cols-6 border-b border-black">
                    <div className="col-span-1 bg-[#FF6A00] text-white font-bold flex items-center justify-center text-center px-2">
                      DESCRIPCIÓN DE LA CARGA
                    </div>
                    <div className="col-span-5">
                      <div className="border-b border-black p-2 flex items-center gap-2">
                        <span className="font-bold">ORIGEN:</span>
                        {quoteModal.mode === "view" ? (
                          <span className="font-semibold">{quoteOrigin ? `${quoteOrigin.nombre_ubicacion}, ${quoteOrigin.pais}` : "-"}</span>
                        ) : (
                          <div className="flex flex-1 items-start gap-2">
                            <SearchableLocationSelect
                              id="origen-cotizacion"
                              valueId={quoteModal.value.origen_id}
                              locations={ubicaciones}
                              disabled={quoteModal.mode === "view"}
                              error={quoteErrors.origen_id}
                              placeholder="Buscar origen..."
                              onChange={(id) => {
                                setQuoteErrors((x) => ({ ...x, origen_id: "" }));
                                setQuoteModal((p) => ({ ...p, value: { ...p.value, origen_id: id } }));
                              }}
                            />
                            <button type="button" onClick={openNewRoute} className="h-8 shrink-0 rounded-lg bg-[#FF6A00] px-3 text-xs font-bold text-white inline-flex items-center gap-1.5 hover:bg-[#e65f00]">
                              <Route className="w-3.5 h-3.5" /> Nueva ruta
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="border-b border-black p-2 flex items-center gap-2">
                        <span className="font-bold">DESTINO:</span>
                        {quoteModal.mode === "view" ? (
                          <span className="font-semibold">{quoteDestination ? `${quoteDestination.nombre_ubicacion}, ${quoteDestination.pais}` : "-"}</span>
                        ) : (
                          <div className="flex flex-1 items-start gap-2">
                            <SearchableLocationSelect
                              id="destino-cotizacion"
                              valueId={quoteModal.value.destino_id}
                              locations={ubicaciones}
                              disabled={quoteModal.mode === "view"}
                              error={quoteErrors.destino_id}
                              placeholder="Buscar destino..."
                              onChange={(id) => {
                                setQuoteErrors((x) => ({ ...x, destino_id: "" }));
                                setQuoteModal((p) => ({ ...p, value: { ...p.value, destino_id: id } }));
                              }}
                            />
                            <button type="button" onClick={openNewRoute} className="h-8 shrink-0 rounded-lg bg-[#FF6A00] px-3 text-xs font-bold text-white inline-flex items-center gap-1.5 hover:bg-[#e65f00]">
                              <Route className="w-3.5 h-3.5" /> Nueva ruta
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="border-b border-black p-2 flex items-center gap-2">
                        <span className="font-bold">TIPO DE CARGA:</span>
                        <input
                          disabled={quoteModal.mode === "view"}
                          data-enter-item="true"
                          onKeyDown={moveWithEnter}
                          value={quoteModal.value.tipo_carga_ui || ""}
                          onChange={(e) => setQuoteModal((p) => ({ ...p, value: { ...p.value, tipo_carga_ui: capitalizeCommercialTyping(e.target.value, 80) } }))}
                          placeholder="Maquinaria industrial empacada"
                          className="h-8 flex-1 rounded border border-blue-300 bg-white px-2 font-semibold text-[#0C2D6B] outline-none focus:border-[#FF6A00]"
                        />
                      </div>

                      <div className="bg-[#0C2D6B] text-white text-center p-1 font-semibold">CARGA GENERAL NO PELIGROSA</div>
                      <div className="bg-[#0C2D6B] text-white text-center p-1 font-semibold">SERVICIO: MERCADERÍA GENERAL NO PELIGROSA</div>

                      <div className="bg-white text-center border-t border-black p-1.5">
                        <div className="font-bold text-black mb-1">TARIFA EXPRESADA EN {quoteModal.value.moneda_ui === "USD" ? "DÓLARES" : "QUETZALES"}</div>
                        {quoteModal.mode === "view" ? (
                          <span className="inline-block min-w-[170px] h-7 leading-7 rounded border border-gray-300 bg-gray-100 font-semibold text-[#0C2D6B]">{quoteModal.value.moneda_ui === "USD" ? "USD - Dólares" : "GTQ - Quetzales"}</span>
                        ) : (
                          <select
                            data-enter-item="true"
                            onKeyDown={moveWithEnter}
                            value={quoteModal.value.moneda_ui || "GTQ"}
                            onChange={(e) => setQuoteModal((p) => ({ ...p, value: { ...p.value, moneda_ui: e.target.value as "USD" | "GTQ" } }))}
                            className="mx-auto block h-7 w-[170px] rounded border border-blue-300 bg-white px-2 font-semibold text-[#0C2D6B] outline-none focus:border-[#FF6A00]"
                          >
                            <option value="GTQ">GTQ - Quetzales</option>
                            <option value="USD">USD - Dólares</option>
                          </select>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* DETALLE */}
                  <table className="w-full border-collapse">
                    <thead className="bg-[#FF6A00] text-white">
                      <tr>
                        <th className="border border-black p-1">CANT.</th>
                        <th className="border border-black p-1">DESCRIPCIÓN</th>
                        <th className="border border-black p-1">VENTA</th>
                        <th className="border border-black p-1">TOTAL CON IVA</th>
                        <th className="border border-black p-1">MONEDA</th>
                        <th className="border border-black p-1">DÍAS</th>
                        {quoteModal.mode !== "view" && <th className="border border-black p-1">ACCIONES</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {quoteModal.details.map((d) => (
                        <tr key={d.id}>
                          <td className="border border-black p-1 w-[80px]">
                            <input
                              disabled={quoteModal.mode === "view"}
                              data-enter-item="true"
                              onKeyDown={moveWithEnter}
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={6}
                              value={String(d.cantidad ?? "")}
                              onFocus={(e) => e.currentTarget.select()}
                              onChange={(e) => {
                                const limpio = cleanInteger(e.target.value, 6);
                                updateQuoteDetail(d.id, "cantidad", limpio);
                                setQuoteErrors((x) => ({ ...x, details: "" }));
                              }}
                              className="w-full h-8 rounded border border-blue-200 bg-white text-center font-semibold outline-none focus:border-[#FF6A00]"
                            />
                          </td>
                          <td className="border border-black p-1">
                            <input
                              disabled={quoteModal.mode === "view"}
                              data-enter-item="true"
                              onKeyDown={moveWithEnter}
                              maxLength={50}
                              value={d.descripcion}
                              onChange={(e) => {
                                updateQuoteDetail(d.id, "descripcion", capitalizeCommercialTyping(e.target.value, 50));
                                setQuoteErrors((x) => ({ ...x, details: "" }));
                              }}
                              placeholder="Transporte FTL Guatemala - Puerto Barrios"
                              className="w-full h-8 rounded border border-blue-200 bg-white px-2 font-semibold outline-none focus:border-[#FF6A00]"
                            />
                          </td>
                          <td className="border border-black p-1 w-[150px]">
                            <input
                              disabled={quoteModal.mode === "view"}
                              data-enter-item="true"
                              onKeyDown={moveWithEnter}
                              type="text"
                              inputMode="decimal"
                              value={String(d.precio_unitario ?? "")}
                              placeholder="2500"
                              onFocus={(e) => e.currentTarget.select()}
                              onChange={(e) => {
                                const limpio = cleanDecimal(e.target.value);
                                updateQuoteDetail(d.id, "precio_unitario", limpio);
                                setQuoteErrors((x) => ({ ...x, details: "" }));
                              }}
                              className="w-full h-8 rounded border border-blue-300 bg-white px-2 text-right font-semibold text-[#0C2D6B] outline-none focus:border-[#FF6A00] focus:ring-2 focus:ring-[#FF6A00]/20"
                            />
                          </td>
                          <td className="border border-black p-2 text-right font-bold whitespace-nowrap">{moneyQuote(Number(d.cantidad || 0) * Number(d.precio_unitario || 0) * 1.12, (quoteModal.value.moneda_ui || "GTQ") as "USD" | "GTQ")}</td>
                          <td className="border border-black p-2 text-center font-bold">{quoteModal.value.moneda_ui || "GTQ"}</td>
                          <td className="border border-black p-1 w-[85px]">
                            <input
                              disabled={quoteModal.mode === "view"}
                              data-enter-item="true"
                              onKeyDown={moveWithEnter}
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={4}
                              value={String(d.dias_ui ?? "")}
                              onFocus={(e) => e.currentTarget.select()}
                              onChange={(e) => {
                                const limpio = cleanInteger(e.target.value, 4);
                                updateQuoteDetail(d.id, "dias_ui", limpio);
                                setQuoteErrors((x) => ({ ...x, details: "" }));
                              }}
                              className="w-full h-8 rounded border border-blue-200 bg-white text-center font-semibold outline-none focus:border-[#FF6A00]"
                            />
                          </td>
                          {quoteModal.mode !== "view" && (
                            <td className="border border-black p-1 text-center w-[80px]">
                              <button type="button" onClick={() => setQuoteModal((p) => ({ ...p, details: p.details.filter((x) => x.id !== d.id) }))} className="p-2 text-red-600 hover:bg-red-50 rounded" title="Eliminar línea"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {quoteModal.mode !== "view" && (
                    <div className="p-2 bg-white border-x border-b border-black">
                      <button type="button" onClick={() => setQuoteModal((p) => ({ ...p, details: [...p.details, blankDetail(Number(p.value.id || 0))] }))} className="h-8 px-3 rounded bg-[#0C2D6B] text-white text-xs font-bold flex items-center gap-1">
                        <Plus className="w-3.5 h-3.5" /> Agregar línea
                      </button>
                    </div>
                  )}

                  {/* TOTALES */}
                  <div className="grid grid-cols-3 border border-black bg-white">
                    <div className="p-2 text-center"><span className="text-gray-500">SUBTOTAL</span><div className="font-bold text-[#0C2D6B]">{moneyQuote(quoteSubtotal, (quoteModal.value.moneda_ui || "GTQ") as "USD" | "GTQ")}</div></div>
                    <div className="p-2 text-center border-x border-black"><span className="text-gray-500">IVA 12%</span><div className="font-bold text-[#0C2D6B]">{moneyQuote(quoteIva, (quoteModal.value.moneda_ui || "GTQ") as "USD" | "GTQ")}</div></div>
                    <div className="p-2 text-center"><span className="text-gray-500">TOTAL</span><div className="font-bold text-lg text-[#22C55E]">{moneyQuote(quoteTotal, (quoteModal.value.moneda_ui || "GTQ") as "USD" | "GTQ")}</div></div>
                  </div>

                  <div className="bg-blue-200 text-center border-x border-b border-black p-2 font-bold">NO INCLUYE ROJOS, SEGUROS, IMPUESTOS</div>

                  <div className="border-x border-b border-black p-2 bg-white">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-bold whitespace-nowrap">DÍAS DE CRÉDITO:</span>

                      {quoteModal.mode === "view" ? (
                        <span className="font-semibold text-[#0C2D6B]">
                          {quotePayment?.nombre_forma_pago || "Sin seleccionar"}
                        </span>
                      ) : (
                        <select
                          data-enter-item="true"
                          onKeyDown={moveWithEnter}
                          value={quoteModal.value.forma_pago_id || ""}
                          onChange={(e) => {
                            setQuoteErrors((current) => ({
                              ...current,
                              forma_pago_id: "",
                            }));

                            setQuoteModal((current) => ({
                              ...current,
                              value: {
                                ...current.value,
                                forma_pago_id: Number(e.target.value) || null,
                              },
                            }));
                          }}
                          className={`h-9 min-w-[220px] rounded-lg border bg-white px-3 font-semibold text-[#0C2D6B] outline-none ${
                            quoteErrors.forma_pago_id
                              ? "border-red-400"
                              : "border-blue-300 focus:border-[#FF6A00]"
                          }`}
                        >
                          <option value="">Seleccione...</option>
                          {formasPago.map((forma) => (
                            <option key={forma.id} value={forma.id}>
                              {forma.nombre_forma_pago}
                            </option>
                          ))}
                        </select>
                      )}

                      {quoteModal.mode !== "view" && (
                        <span className="text-[10px] text-gray-500">
                          Puedes elegir Contado, 15 días o 30 días según lo registrado en Formas de pago.
                        </span>
                      )}
                    </div>

                    {quoteErrors.forma_pago_id && (
                      <p className="mt-1 text-xs font-semibold text-red-600">
                        {quoteErrors.forma_pago_id}
                      </p>
                    )}
                  </div>

                  {/* NOTAS + FIRMA */}
                  <div className="p-4 text-[#d97706] text-[11px] bg-white border-x border-b border-black">
                    <div className="flex justify-between gap-8">
                      <div className="w-1/2">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="font-bold">Nuestra cotización NO incluye:</p>

                          {quoteModal.mode !== "view" && (
                            <button
                              type="button"
                              onClick={() =>
                                setQuoteModal((current) => ({
                                  ...current,
                                  value: {
                                    ...current.value,
                                    no_incluye_ui: [
                                      ...(
                                        current.value.no_incluye_ui ||
                                        QUOTE_NO_INCLUYE_DEFAULT
                                      ),
                                      "",
                                    ],
                                  },
                                }))
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-orange-300 bg-orange-50 px-2 py-1 text-[10px] font-bold text-[#d97706] hover:bg-orange-100"
                            >
                              <Plus className="h-3 w-3" />
                              Agregar
                            </button>
                          )}
                        </div>

                        {quoteModal.mode === "view" ? (
                          <ul className="list-disc ml-5 space-y-1">
                            {(quoteModal.value.no_incluye_ui || QUOTE_NO_INCLUYE_DEFAULT).map(
                              (item, index) => (
                                <li key={`no-incluye-view-${index}`}>
                                  {item}
                                </li>
                              )
                            )}
                          </ul>
                        ) : (
                          <div className="space-y-2">
                            {(quoteModal.value.no_incluye_ui || QUOTE_NO_INCLUYE_DEFAULT).map(
                              (item, index) => (
                                <div
                                  key={`no-incluye-edit-${index}`}
                                  className="flex items-center gap-2"
                                >
                                  <span className="shrink-0 text-[#d97706]">•</span>

                                  <input
                                    data-enter-item="true"
                                    onKeyDown={moveWithEnter}
                                    value={item}
                                    onChange={(e) => {
                                      const value = e.target.value;

                                      setQuoteModal((current) => {
                                        const next = [
                                          ...(
                                            current.value.no_incluye_ui ||
                                            QUOTE_NO_INCLUYE_DEFAULT
                                          ),
                                        ];

                                        next[index] = value;

                                        return {
                                          ...current,
                                          value: {
                                            ...current.value,
                                            no_incluye_ui: next,
                                          },
                                        };
                                      });
                                    }}
                                    placeholder="Escribe una exclusión..."
                                    className="h-8 flex-1 rounded-lg border border-orange-200 bg-orange-50/40 px-2 text-[11px] text-[#d97706] outline-none focus:border-[#FF6A00]"
                                  />

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setQuoteModal((current) => ({
                                        ...current,
                                        value: {
                                          ...current.value,
                                          no_incluye_ui: (
                                            current.value.no_incluye_ui ||
                                            QUOTE_NO_INCLUYE_DEFAULT
                                          ).filter((_, itemIndex) => itemIndex !== index),
                                        },
                                      }))
                                    }
                                    className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                                    title="Eliminar condición"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-center w-1/2">
                        <p className="text-blue-900 font-bold mb-8">FIRMA DE ACEPTACIÓN DE TARIFA:</p>
                        <div className="border-b border-blue-900 w-3/4 mx-auto h-10" />
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="font-bold">Notas importantes:</p>

                        {quoteModal.mode !== "view" && (
                          <button
                            type="button"
                            onClick={() =>
                              setQuoteModal((current) => ({
                                ...current,
                                value: {
                                  ...current.value,
                                  notas_importantes_ui: [
                                    ...(
                                      current.value.notas_importantes_ui ||
                                      QUOTE_NOTAS_IMPORTANTES_DEFAULT
                                    ),
                                    "",
                                  ],
                                },
                              }))
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-orange-300 bg-orange-50 px-2 py-1 text-[10px] font-bold text-[#d97706] hover:bg-orange-100"
                          >
                            <Plus className="h-3 w-3" />
                            Agregar nota
                          </button>
                        )}
                      </div>

                      {quoteModal.mode === "view" ? (
                        <ul className="list-disc ml-5 space-y-1">
                          {(quoteModal.value.notas_importantes_ui || QUOTE_NOTAS_IMPORTANTES_DEFAULT).map(
                            (item, index) => (
                              <li key={`nota-view-${index}`}>{item}</li>
                            )
                          )}
                        </ul>
                      ) : (
                        <div className="space-y-2">
                          {(quoteModal.value.notas_importantes_ui || QUOTE_NOTAS_IMPORTANTES_DEFAULT).map(
                            (item, index) => (
                              <div
                                key={`nota-edit-${index}`}
                                className="flex items-center gap-2"
                              >
                                <span className="shrink-0 text-[#d97706]">•</span>

                                <input
                                  data-enter-item="true"
                                  onKeyDown={moveWithEnter}
                                  value={item}
                                  onChange={(e) => {
                                    const value = e.target.value;

                                    setQuoteModal((current) => {
                                      const next = [
                                        ...(
                                          current.value.notas_importantes_ui ||
                                          QUOTE_NOTAS_IMPORTANTES_DEFAULT
                                        ),
                                      ];

                                      next[index] = value;

                                      return {
                                        ...current,
                                        value: {
                                          ...current.value,
                                          notas_importantes_ui: next,
                                        },
                                      };
                                    });
                                  }}
                                  placeholder="Escribe una nota importante..."
                                  className="h-8 flex-1 rounded-lg border border-orange-200 bg-orange-50/40 px-2 text-[11px] text-[#d97706] outline-none focus:border-[#FF6A00]"
                                />

                                <button
                                  type="button"
                                  onClick={() =>
                                    setQuoteModal((current) => ({
                                      ...current,
                                      value: {
                                        ...current.value,
                                        notas_importantes_ui: (
                                          current.value.notas_importantes_ui ||
                                          QUOTE_NOTAS_IMPORTANTES_DEFAULT
                                        ).filter((_, itemIndex) => itemIndex !== index),
                                      },
                                    }))
                                  }
                                  className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                                  title="Eliminar nota"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-5">
                      <p className="font-bold mb-2">Observaciones de la cotización:</p>
                      <textarea
                        disabled={quoteModal.mode === "view"}
                        data-enter-item="true"
                        onKeyDown={moveWithEnter}
                        rows={3}
                        maxLength={180}
                        value={quoteModal.value.observaciones_ui || ""}
                        onChange={(e) =>
                          setQuoteModal((p) => ({
                            ...p,
                            value: {
                              ...p.value,
                              observaciones_ui: e.target.value,
                            },
                          }))
                        }
                        placeholder="Escribe una observación específica para esta cotización..."
                        className="w-full rounded border border-orange-200 bg-orange-50/40 p-2 text-gray-700 outline-none focus:border-[#FF6A00]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t bg-white flex justify-end gap-2 shrink-0">
              <button onClick={() => setQuoteModal({ open: false, mode: "create", value: {}, details: [] })} className="h-10 px-4 rounded-lg font-bold text-gray-600 hover:bg-gray-100">
                {quoteModal.mode === "view" ? "Cerrar" : "Cancelar"}
              </button>
              {quoteModal.mode !== "view" && (
                <button data-enter-save="true" onClick={saveQuoteData} className="h-10 px-5 rounded-lg font-bold bg-[#0C2D6B] text-white hover:bg-[#143C8C]">
                  Guardar Cotización
                </button>
              )}
            </div>
          </div>
        </div>
      )}


      {/* ==================================================== */}
      {/* MODAL NUEVA RUTA DESDE COTIZACIÓN */}
      {/* ==================================================== */}
      {routeModalOpen && (
        <div className="fixed inset-0 z-[260] bg-black/55 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-[#0C2D6B] text-white px-5 py-4 flex items-center justify-between">
              <div><p className="text-xs uppercase tracking-widest text-white/60">Cotizaciones</p><h2 className="text-xl font-bold">Nueva ruta</h2></div>
              <button onClick={() => setRouteModalOpen(false)} className="p-2 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4" data-enter-form>
              {routeErrors.general && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{routeErrors.general}</div>}
              <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-[#0C2D6B]">Crea la ruta una sola vez. Al guardarla, el origen y destino quedarán seleccionados automáticamente en la cotización.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-gray-700">Origen *</label><input data-enter-item="true" onKeyDown={moveWithEnter} value={routeDraft.origen} onChange={(e) => setRouteDraft((p) => ({ ...p, origen: capitalizeCommercialTyping(e.target.value, 100) }))} placeholder="Ej. Bofasa Villa Canales" className={inputClass(routeErrors.origen)} /><ErrorText value={routeErrors.origen} /></div>
                <div><label className="text-xs font-bold text-gray-700">País origen</label><input data-enter-item="true" onKeyDown={moveWithEnter} value={routeDraft.pais_origen} onChange={(e) => setRouteDraft((p) => ({ ...p, pais_origen: cleanRoleTyping(e.target.value, 60) }))} className={inputClass()} /></div>
                <div><label className="text-xs font-bold text-gray-700">Destino *</label><input data-enter-item="true" onKeyDown={moveWithEnter} value={routeDraft.destino} onChange={(e) => setRouteDraft((p) => ({ ...p, destino: capitalizeCommercialTyping(e.target.value, 100) }))} placeholder="Ej. Fraijanes" className={inputClass(routeErrors.destino)} /><ErrorText value={routeErrors.destino} /></div>
                <div><label className="text-xs font-bold text-gray-700">País destino</label><input data-enter-item="true" onKeyDown={moveWithEnter} value={routeDraft.pais_destino} onChange={(e) => setRouteDraft((p) => ({ ...p, pais_destino: cleanRoleTyping(e.target.value, 60) }))} className={inputClass()} /></div>
                <div><label className="text-xs font-bold text-gray-700">Nombre de ruta</label><input data-enter-item="true" onKeyDown={moveWithEnter} value={routeDraft.nombre_ruta} onChange={(e) => setRouteDraft((p) => ({ ...p, nombre_ruta: capitalizeCommercialTyping(e.target.value, 100) }))} placeholder="Se genera automáticamente si lo dejas vacío" className={inputClass()} /></div>
                <div><label className="text-xs font-bold text-gray-700">Distancia (km)</label><input data-enter-item="true" onKeyDown={moveWithEnter} inputMode="decimal" value={routeDraft.distancia_km} onChange={(e) => setRouteDraft((p) => ({ ...p, distancia_km: cleanDecimal(e.target.value, 8, 2) }))} placeholder="0" className={inputClass()} /></div>
              </div>
            </div>
            <div className="border-t p-4 flex justify-end gap-2"><button onClick={() => setRouteModalOpen(false)} className="h-10 px-4 rounded-lg font-bold text-gray-600 hover:bg-gray-100">Cancelar</button><button data-enter-save="true" onClick={saveNewRoute} className="h-10 px-5 rounded-lg bg-[#0C2D6B] text-white font-bold inline-flex items-center gap-2"><Save className="w-4 h-4" /> Guardar ruta</button></div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* EXPEDIENTE DE PROVEEDOR */}
      {/* ==================================================== */}
      {providerModal.open && (
        <div className="fixed inset-0 z-[240] bg-black/50 flex justify-end">
          <div className="bg-white w-full max-w-4xl h-full flex flex-col shadow-2xl">
            <div className="px-6 py-4 bg-[#0C2D6B] text-white flex items-center justify-between shrink-0">
              <div><p className="text-xs text-white/60 uppercase tracking-widest">Expediente del proveedor</p><h2 className="text-xl font-bold">{providerModal.mode === "create" ? "Nuevo Proveedor" : providerModal.mode === "edit" ? "Editar Proveedor" : "Detalle Proveedor"}</h2></div>
              <button onClick={() => setProviderModal({ open: false, mode: "create", value: {} })} className="p-2 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 bg-[#F8FAFC] space-y-4" data-enter-form>
              <ErrorSummary errors={providerErrors} title="Revisa los datos del proveedor" />

              <section className="rounded-xl border bg-white p-5">
                <div className="border-b pb-3 mb-4"><h3 className="font-bold text-[#0C2D6B]">Información del proveedor</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="text-xs font-bold text-gray-700">Código</label><input readOnly value={providerModal.value.codigo_proveedor || "Automático"} className={`${inputClass()} bg-gray-100`} /></div>
                  <div><label className="text-xs font-bold text-gray-700">Estado</label><select disabled={providerModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} value={providerModal.value.estado_id || 1} onChange={(e) => setProviderModal((p) => ({ ...p, value: { ...p.value, estado_id: Number(e.target.value) } }))} className={inputClass()}>{providerStates.length ? providerStates.map((s: any) => <option key={s.id} value={s.id}>{s.nombre_estado_proveedor}</option>) : <><option value={1}>Activo</option><option value={2}>Inactivo</option></>}</select></div>
                  <div><label className="text-xs font-bold text-gray-700">Razón social *</label><input disabled={providerModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} value={providerModal.value.razon_social || ""} onChange={(e) => setProviderModal((p) => ({ ...p, value: { ...p.value, razon_social: capitalizeCommercialTyping(e.target.value, 140) } }))} className={inputClass(providerErrors.razon_social)} /><ErrorText value={providerErrors.razon_social} /></div>
                  <div><label className="text-xs font-bold text-gray-700">Nombre comercial</label><input disabled={providerModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} value={providerModal.value.nombre_comercial || ""} onChange={(e) => setProviderModal((p) => ({ ...p, value: { ...p.value, nombre_comercial: capitalizeCommercialTyping(e.target.value, 120) } }))} className={inputClass()} /></div>
                  <div><label className="text-xs font-bold text-gray-700">NIT *</label><input disabled={providerModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} value={providerModal.value.nit || ""} onChange={(e) => setProviderModal((p) => ({ ...p, value: { ...p.value, nit: cleanNit(e.target.value) } }))} className={inputClass(providerErrors.nit)} /><ErrorText value={providerErrors.nit} /></div>
                  <div><label className="text-xs font-bold text-gray-700">Correo general</label><input disabled={providerModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} value={providerModal.value.correo || ""} onChange={(e) => setProviderModal((p) => ({ ...p, value: { ...p.value, correo: cleanEmail(e.target.value) } }))} className={inputClass(providerErrors.correo)} /><ErrorText value={providerErrors.correo} /></div>
                  <div><label className="text-xs font-bold text-gray-700">Teléfono general</label><input disabled={providerModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} inputMode="numeric" value={providerModal.value.telefono || ""} onChange={(e) => setProviderModal((p) => ({ ...p, value: { ...p.value, telefono: cleanPhone(e.target.value, 15) } }))} className={inputClass()} /></div>
                </div>
              </section>

              <section className="rounded-xl border bg-white p-5">
                <div className="flex items-center justify-between border-b pb-3 mb-4"><div><h3 className="font-bold text-[#0C2D6B]">Contactos del proveedor</h3><p className="text-xs text-gray-500">Puedes registrar varios y marcar uno como principal.</p></div>{providerModal.mode !== "view" && <button onClick={addProviderContact} className="h-9 px-3 rounded-lg bg-[#FF6A00] text-white text-xs font-bold inline-flex items-center gap-1"><UserPlus className="w-4 h-4" /> Nuevo contacto</button>}</div>
                <div className="space-y-3">
                  {providerContactDraft.map((c, index) => (
                    <div key={c.id} className="rounded-xl border bg-gray-50 p-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        <input disabled={providerModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} placeholder="Primer nombre *" value={c.primer_nombre} onChange={(e) => patchProviderContact(c.id, { primer_nombre: capitalizePersonTyping(e.target.value) })} className={inputClass(providerErrors[`contacto_${index}`])} />
                        <input disabled={providerModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} placeholder="Segundo nombre" value={c.segundo_nombre || ""} onChange={(e) => patchProviderContact(c.id, { segundo_nombre: capitalizePersonTyping(e.target.value) })} className={inputClass()} />
                        <input disabled={providerModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} placeholder="Primer apellido *" value={c.primer_apellido} onChange={(e) => patchProviderContact(c.id, { primer_apellido: capitalizePersonTyping(e.target.value) })} className={inputClass(providerErrors[`contacto_${index}`])} />
                        <input disabled={providerModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} placeholder="Segundo apellido" value={c.segundo_apellido || ""} onChange={(e) => patchProviderContact(c.id, { segundo_apellido: capitalizePersonTyping(e.target.value) })} className={inputClass()} />
                        <input disabled={providerModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} placeholder="Cargo" value={c.cargo || ""} onChange={(e) => patchProviderContact(c.id, { cargo: capitalizeRoleTyping(e.target.value) })} className={inputClass()} />
                        <input disabled={providerModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} placeholder="Correo" value={c.correo || ""} onChange={(e) => patchProviderContact(c.id, { correo: cleanEmail(e.target.value) })} className={inputClass(providerErrors[`correo_contacto_${index}`])} />
                        <input disabled={providerModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} placeholder="Teléfono" inputMode="numeric" value={c.telefono || ""} onChange={(e) => patchProviderContact(c.id, { telefono: cleanPhone(e.target.value, 15) })} className={inputClass()} />
                        <label className="h-10 rounded-lg border bg-white px-3 text-xs font-bold flex items-center gap-2"><input type="checkbox" disabled={providerModal.mode === "view"} checked={c.es_principal} onChange={(e) => patchProviderContact(c.id, { es_principal: e.target.checked })} /> Principal</label>
                        {providerModal.mode !== "view" && <button onClick={() => setProviderContactDraft((rows) => rows.filter((x) => x.id !== c.id))} className="h-10 rounded-lg bg-red-50 text-red-600"><Trash2 className="w-4 h-4 mx-auto" /></button>}
                      </div>
                    </div>
                  ))}
                  {!providerContactDraft.length && <p className="text-sm italic text-gray-400">Sin contactos registrados.</p>}
                </div>
              </section>

              <section className="rounded-xl border bg-white p-5">
                <div className="flex items-center justify-between border-b pb-3 mb-4"><h3 className="font-bold text-[#0C2D6B]">Servicios</h3>{providerModal.mode !== "view" && <button onClick={addProviderService} className="h-9 px-3 rounded-lg bg-[#0C2D6B] text-white text-xs font-bold inline-flex items-center gap-1"><Plus className="w-4 h-4" /> Agregar servicio</button>}</div>
                <div className="space-y-2">{providerServiceDraft.map((s) => <div key={s.id} className="grid grid-cols-[1fr_120px_44px] gap-2"><input disabled={providerModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} value={s.nombre_servicio_proveedor} onChange={(e) => patchProviderService(s.id, { nombre_servicio_proveedor: capitalizeCommercialTyping(e.target.value, 100) })} placeholder="Transporte FTL" className={inputClass()} /><label className="h-10 rounded-lg border px-3 text-xs font-bold flex items-center gap-2"><input type="checkbox" disabled={providerModal.mode === "view"} checked={s.es_principal} onChange={(e) => patchProviderService(s.id, { es_principal: e.target.checked })} /> Principal</label>{providerModal.mode !== "view" ? <button onClick={() => setProviderServiceDraft((rows) => rows.filter((x) => x.id !== s.id))} className="h-10 rounded-lg bg-red-50 text-red-600"><Trash2 className="w-4 h-4 mx-auto" /></button> : <span />}</div>)}</div>
              </section>

              <section className="rounded-xl border bg-white p-5">
                <div className="border-b pb-3 mb-4"><h3 className="font-bold text-[#0C2D6B]">Cumplimiento</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="text-xs font-bold text-gray-700">Estado SAT</label><select disabled={providerModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} value={providerComplianceDraft.estado_sat} onChange={(e) => setProviderComplianceDraft((p) => ({ ...p, estado_sat: e.target.value as ProviderSat }))} className={inputClass()}><option value="vigente">Vigente</option><option value="no_vigente">No vigente</option><option value="pendiente">Pendiente</option></select></div><div className="grid grid-cols-2 gap-2">{[["lista_clinton","Lista Clinton"],["rtu_validado","RTU"],["licencia_validada","Licencias"],["cuenta_validada","Cuenta bancaria"]].map(([field,label]) => <label key={field} className="rounded-lg border bg-gray-50 px-3 py-2 text-xs font-bold flex items-center gap-2"><input type="checkbox" disabled={providerModal.mode === "view"} checked={Boolean((providerComplianceDraft as any)[field])} onChange={(e) => setProviderComplianceDraft((p) => ({ ...p, [field]: e.target.checked }))} /> {label}</label>)}</div></div>
              </section>

              <section className="rounded-xl border bg-white p-5">
                <div className="border-b pb-3 mb-4"><h3 className="font-bold text-[#0C2D6B]">Desempeño</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">{(["Verde","Amarillo","Rojo"] as ProviderLevel[]).map((level) => <button type="button" key={level} disabled={providerModal.mode === "view"} onClick={() => setProviderPerformanceDraft((p) => ({ ...p, nivel: level }))} className={`h-11 rounded-xl border font-bold inline-flex items-center justify-center gap-2 ${providerPerformanceDraft.nivel === level ? level === "Verde" ? "bg-green-50 border-green-400" : level === "Rojo" ? "bg-red-50 border-red-400" : "bg-yellow-50 border-yellow-400" : "bg-white"}`}><span className={`w-3 h-3 rounded-full ${level === "Verde" ? "bg-green-500" : level === "Rojo" ? "bg-red-500" : "bg-yellow-400"}`} /> {level}</button>)}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="text-xs font-bold text-gray-700">Fecha de evaluación</label><input type="date" disabled={providerModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} value={providerPerformanceDraft.fecha || ""} onChange={(e) => setProviderPerformanceDraft((p) => ({ ...p, fecha: e.target.value }))} className={inputClass()} /></div><div /><div><label className="text-xs font-bold text-gray-700">Historial</label><textarea disabled={providerModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} rows={4} value={providerPerformanceDraft.historial || ""} onChange={(e) => setProviderPerformanceDraft((p) => ({ ...p, historial: e.target.value }))} className="w-full rounded-xl border border-gray-300 p-3 text-sm outline-none focus:border-[#0C2D6B] disabled:bg-gray-100" /></div><div><label className="text-xs font-bold text-gray-700">Hallazgos</label><textarea disabled={providerModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} rows={4} value={providerPerformanceDraft.hallazgos || ""} onChange={(e) => setProviderPerformanceDraft((p) => ({ ...p, hallazgos: e.target.value }))} className="w-full rounded-xl border border-gray-300 p-3 text-sm outline-none focus:border-[#0C2D6B] disabled:bg-gray-100" /></div></div>
              </section>
            </div>

            <div className="border-t bg-white p-4 flex justify-end gap-2 shrink-0"><button onClick={() => setProviderModal({ open: false, mode: "create", value: {} })} className="h-10 px-4 rounded-lg font-bold text-gray-600 hover:bg-gray-100">{providerModal.mode === "view" ? "Cerrar" : "Cancelar"}</button>{providerModal.mode === "view" ? <button onClick={() => setProviderModal((p) => ({ ...p, mode: "edit" }))} className="h-10 px-5 rounded-lg bg-[#FF6A00] text-white font-bold inline-flex items-center gap-2"><Edit2 className="w-4 h-4" /> Editar</button> : <button data-enter-save="true" onClick={saveProvider} className="h-10 px-5 rounded-lg bg-[#0C2D6B] text-white font-bold inline-flex items-center gap-2"><Save className="w-4 h-4" /> Guardar proveedor</button>}</div>
          </div>
        </div>
      )}

      {providerDeleteId && (
        <div className="fixed inset-0 z-[280] bg-black/60 flex items-center justify-center p-4"><div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 text-center"><div className="w-14 h-14 mx-auto rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4"><Trash2 className="w-7 h-7" /></div><h3 className="text-xl font-bold">¿Eliminar proveedor?</h3><p className="text-sm text-gray-500 mt-2 mb-5">Si tiene operaciones relacionadas no se borrará el historial; se marcará como Inactivo.</p><div className="flex gap-3"><button onClick={() => setProviderDeleteId(null)} className="flex-1 h-10 rounded-lg border font-bold text-gray-600">Cancelar</button><button onClick={deleteProvider} className="flex-1 h-10 rounded-lg bg-red-600 text-white font-bold">Continuar</button></div></div></div>
      )}

      {/* ==================================================== */}
      {/* CONFIRMACIÓN DE BAJA / REACTIVACIÓN / ELIMINACIÓN */}
      {/* ==================================================== */}
      {deleteModal.open && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmación de eliminación"
        >
          <div className="relative z-[301] w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            {deleteModal.type === "client" ||
            deleteModal.type === "clientPermanent" ? (
              <>
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
                    deleteModal.type === "clientPermanent"
                      ? "bg-red-100 text-red-700"
                      : clientStatusActionIsReactivate
                      ? "bg-green-100 text-green-600"
                      : "bg-red-100 text-red-600"
                  }`}
                >
                  {deleteModal.type === "clientPermanent" ? (
                    <Trash2 className="w-7 h-7" />
                  ) : clientStatusActionIsReactivate ? (
                    <UserCheck className="w-7 h-7" />
                  ) : (
                    <UserX className="w-7 h-7" />
                  )}
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {deleteModal.type === "clientPermanent"
                    ? "¿Eliminar cliente definitivamente?"
                    : clientStatusActionIsReactivate
                    ? "¿Reactivar cliente?"
                    : "¿Dar de baja al cliente?"}
                </h3>

                <p className="font-bold text-[#0C2D6B] mb-2">
                  {clientForStatusAction?.nombre_empresa || "Cliente seleccionado"}
                </p>

                <p className="text-gray-500 text-sm mb-4">
                  {deleteModal.type === "clientPermanent"
                    ? "Esta acción es irreversible. Solo se permitirá si el cliente no tiene relaciones que deban conservarse. Si tiene historial comercial u operativo, deberás inactivarlo."
                    : clientStatusActionIsReactivate
                    ? "El cliente volverá a estar disponible para nuevos procesos comerciales."
                    : "El cliente quedará inactivo, pero se conservarán su información, contactos, oportunidades, cotizaciones e historial relacionados."}
                </p>

                {deleteModal.type === "client" &&
                !clientStatusActionIsReactivate && (
                  <div className="mb-5 text-left">
                    <label className="mb-1 block text-xs font-bold text-gray-700 first-letter:uppercase">
                      ¿Por qué se inactiva? *
                    </label>
                    <textarea
                      autoFocus
                      rows={3}
                      maxLength={250}
                      value={clientInactiveReason}
                      onChange={(e) =>
                        setClientInactiveReason(
                          e.target.value.replace(/\s{2,}/g, " ").slice(0, 250)
                        )
                      }
                      placeholder="Ejemplo: Cliente solicitó suspensión temporal de servicios."
                      className="w-full resize-none rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#FF6A00] focus:ring-2 focus:ring-[#FF6A00]/20"
                    />
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span className={clientInactiveReason.trim().length < 5 ? "text-red-500" : "text-green-600"}>
                        {clientInactiveReason.trim().length < 5
                          ? "Es obligatorio indicar un motivo."
                          : "Motivo listo para guardar."}
                      </span>
                      <span className="text-gray-400">
                        {clientInactiveReason.length}/250
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setDeleteModal({ open: false, type: null, id: null });
                      setClientInactiveReason("");
                    }}
                    className="flex-1 h-10 cursor-pointer rounded-lg font-bold text-gray-600 transition hover:bg-gray-100"
                  >
                    Cancelar
                  </button>

                  <button
                    onClick={executeDelete}
                    disabled={
                      deleteModal.type === "client" &&
                      !clientStatusActionIsReactivate &&
                      clientInactiveReason.trim().length < 5
                    }
                    className={`flex-1 h-10 cursor-pointer rounded-lg font-bold text-white transition disabled:cursor-not-allowed disabled:bg-gray-300 ${
                      deleteModal.type === "clientPermanent"
                        ? "bg-red-700 hover:bg-red-800"
                        : clientStatusActionIsReactivate
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    {deleteModal.type === "clientPermanent"
                      ? "Sí, eliminar definitivamente"
                      : clientStatusActionIsReactivate
                      ? "Reactivar"
                      : "Dar de baja"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-7 h-7" />
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  ¿Eliminar registro?
                </h3>

                <p className="text-gray-500 text-sm mb-6">
                  La eliminación respetará las relaciones del sistema. Si el registro posee dependencias, el backend impedirá su eliminación.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteModal({ open: false, type: null, id: null })}
                    className="flex-1 h-10 cursor-pointer rounded-lg font-bold text-gray-600 transition hover:bg-gray-100"
                  >
                    Cancelar
                  </button>

                  <button
                    onClick={executeDelete}
                    className="flex-1 h-10 cursor-pointer rounded-lg bg-red-600 font-bold text-white transition hover:bg-red-700"
                  >
                    Sí, eliminar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* NOTICE */}
      {notice && (
        <div className={`fixed bottom-6 right-6 z-[120] max-w-sm px-4 py-3 rounded-xl shadow-lg text-white flex items-center gap-2 ${notice.type === "success" ? "bg-[#0C2D6B]" : "bg-red-600"}`}>
          {notice.type === "success" ? <CheckCircle2 className="w-5 h-5 text-green-300" /> : <AlertTriangle className="w-5 h-5" />}
          <span className="text-sm font-medium">{notice.text}</span>
        </div>
      )}
    </div>
  );
}