import { useEffect, useMemo, useRef, useState } from "react";
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
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { generarPDFCotizacion } from "../services/pdfGenerator";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

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
// La BD normalizada actual de cotizaciones no contiene fecha, estado,
// moneda, peso, volumen u observaciones. Esos datos se conservan aquí
// como metadata visual del PROTOTIPO para no perder el diseño comercial.
// Los campos que sí representan la tabla cotizaciones son las FK y el
// codigo_cotizacion.
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
  created_at: string;
  updated_at: string;
  // Campo de presentación equivalente a JOIN con estados_cliente.
  nombre_estado_cliente?: string;
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
}

interface CotizacionDetalleRow {
  id: number;
  cotizacion_id: number;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  dias_ui: number;
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
};

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_URL || "http://localhost:3001/api";

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

// Para escribir en formularios sin perder espacios.
// Antes se aplicaba titleCase en cada tecla y eso hacía que,
// al escribir un espacio al final, se borrara y la siguiente palabra quedara pegada.
const cleanCommercialTyping = (value: string, max = 120) =>
  cleanCompany(value).replace(/\s{2,}/g, " ").slice(0, max);

const cleanAddressText = (value: string, max = 180) => titleCaseCompany(cleanAddress(value)).slice(0, max);

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

function generarPDFCliente(
  client: ClienteRow,
  contacts: ContactoClienteRow[],
  phones: TelefonoContactoRow[]
) {
  const doc = new jsPDF();
  doc.setFillColor(12, 45, 107);
  doc.rect(0, 0, 210, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text("Detalle de Cliente", 105, 18, { align: "center" });
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);

  let y = 42;
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

  y += 4;
  doc.setFont(undefined, "bold");
  doc.text("Contactos", 20, y);
  y += 7;

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
  const [activeTab, setActiveTab] = useState<"seguimiento" | "clientes" | "cotizaciones">("seguimiento");

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

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [leadStageFilter, setLeadStageFilter] = useState("Todos");
  const [sortField, setSortField] = useState("date");
  const [crmSortDirection, setCrmSortDirection] = useState<CrmSortDirection>("desc");

  const [clientModal, setClientModal] = useState<{ open: boolean; mode: ModalMode; value: Partial<ClienteRow> }>({ open: false, mode: "create", value: {} });
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});

  const [contactModal, setContactModal] = useState<{ open: boolean; mode: ModalMode; value: Partial<ContactoClienteRow>; clientId: number | null }>({ open: false, mode: "create", value: {}, clientId: null });
  const [contactErrors, setContactErrors] = useState<FieldErrors>({});

  const [phoneModal, setPhoneModal] = useState<{ open: boolean; mode: ModalMode; value: Partial<TelefonoContactoRow>; contactId: number | null }>({ open: false, mode: "create", value: {}, contactId: null });
  const [phoneErrors, setPhoneErrors] = useState<FieldErrors>({});

  const [leadModal, setLeadModal] = useState<{ open: boolean; mode: ModalMode; value: Partial<OportunidadRow> }>({ open: false, mode: "create", value: {} });
  const [leadErrors, setLeadErrors] = useState<FieldErrors>({});

  const [quoteModal, setQuoteModal] = useState<{ open: boolean; mode: ModalMode; value: Partial<CotizacionRow>; details: CotizacionDetalleRow[] }>({ open: false, mode: "create", value: {}, details: [] });
  const [quoteErrors, setQuoteErrors] = useState<FieldErrors>({});

  const [deleteModal, setDeleteModal] = useState<{ open: boolean; type: "client" | "contact" | "phone" | "lead" | "quote" | null; id: number | null }>({ open: false, type: null, id: null });

  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const firstQuoteFieldRef = useRef<HTMLSelectElement | null>(null);

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

      setClients(
        clientesBD.map((c: any) => ({
          ...c,
          id: Number(c.id),
          estado_cliente_id: Number(c.estado_cliente_id || 1),
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
        cotizacionesBD.map((q: any, index: number) => ({
          id: Number(q.id) || index + 1,
          codigo_cotizacion: q.codigo_cotizacion || q.numero_cotizacion || `COT-${String(index + 1).padStart(3, "0")}`,
          cliente_id: q.cliente_id ? Number(q.cliente_id) : null,
          contacto_id: q.contacto_id ? Number(q.contacto_id) : null,
          ejecutivo_id: q.ejecutivo_id ? Number(q.ejecutivo_id) : null,
          modalidad_id: q.modalidad_id ? Number(q.modalidad_id) : null,
          forma_pago_id: q.forma_pago_id ? Number(q.forma_pago_id) : null,
          origen_id: q.origen_id ? Number(q.origen_id) : null,
          destino_id: q.destino_id ? Number(q.destino_id) : null,
          fecha_ui: String(q.fecha_ui || q.fecha || q.created_at || todayISO()).slice(0, 10),
          estado_ui: (q.estado_ui || q.estado || "Borrador") as QuoteStatus,
          moneda_ui: q.moneda_ui === "USD" || q.moneda === "USD" ? "USD" : "GTQ",
          tipo_carga_ui: q.tipo_carga_ui || q.tipo_carga || q.nombre_modalidad || "",
          peso_ui: q.peso_ui || q.peso || "",
          volumen_ui: q.volumen_ui || q.volumen || "",
          observaciones_ui: q.observaciones_ui || q.observaciones || "",
        }))
      );

      setQuoteDetails(
        detallesBD.map((d: any, index: number) => ({
          id: Number(d.id) || index + 1,
          cotizacion_id: Number(d.cotizacion_id),
          descripcion: d.descripcion || "",
          cantidad: Number(d.cantidad ?? 1),
          precio_unitario: Number(d.precio_unitario ?? 0),
          dias_ui: Number(d.dias_ui ?? d.dias ?? 1),
        }))
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
    }
  };

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    setSearchQuery("");
    setStatusFilter("Todos");
    setLeadStageFilter("Todos");

    if (activeTab === "seguimiento") {
      setSortField("date");
      setCrmSortDirection("desc");
    } else if (activeTab === "clientes") {
      setSortField("nombre_empresa");
      setCrmSortDirection("asc");
    } else {
      setSortField("date");
      setCrmSortDirection("desc");
    }
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
          quantity: d.cantidad,
          unitPrice: d.precio_unitario,
          subtotal: d.cantidad * d.precio_unitario,
          days: d.dias_ui || 1,
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
      const ac = principalContact(a.id);
      const bc = principalContact(b.id);

      const av =
        sortField === "codigo_cliente" ? a.codigo_cliente :
        sortField === "nit" ? a.nit :
        sortField === "estado" ? estadoClienteNombre(a.estado_cliente_id) :
        sortField === "contacto" ? fullContactName(ac) :
        a.nombre_empresa;

      const bv =
        sortField === "codigo_cliente" ? b.codigo_cliente :
        sortField === "nit" ? b.nit :
        sortField === "estado" ? estadoClienteNombre(b.estado_cliente_id) :
        sortField === "contacto" ? fullContactName(bc) :
        b.nombre_empresa;

      return compareValues(av, bv);
    });
    return rows;
  }, [filteredClients, contacts, sortField, crmSortDirection]);

  const filteredLeads = useMemo(() => {
    const s = searchQuery.trim().toLowerCase();
    return leads.filter((l) => {
      const matches =
        !s ||
        l.code.toLowerCase().includes(s) ||
        l.clientName.toLowerCase().includes(s) ||
        l.opportunityName.toLowerCase().includes(s) ||
        l.type.toLowerCase().includes(s) ||
        l.executive.toLowerCase().includes(s);

      const stageMatches = leadStageFilter === "Todos" || l.stage === leadStageFilter;
      return matches && stageMatches;
    });
  }, [leads, searchQuery, leadStageFilter]);

  const sortedLeads = useMemo(() => {
    const stageOrder: Record<Stage, number> = { prospecto: 1, cotizado: 2, negociacion: 3, ganado: 4, perdido: 5 };
    const rows = [...filteredLeads];

    rows.sort((a, b) => {
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

      return compareValues(av, bv);
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
      const av =
        sortField === "quoteNumber" ? a.quoteNumber :
        sortField === "clientName" ? a.clientName :
        sortField === "status" ? a.status :
        sortField === "total" ? a.total :
        sortField === "contact" ? a.contact :
        a.date;

      const bv =
        sortField === "quoteNumber" ? b.quoteNumber :
        sortField === "clientName" ? b.clientName :
        sortField === "status" ? b.status :
        sortField === "total" ? b.total :
        sortField === "contact" ? b.contact :
        b.date;

      return compareValues(av, bv);
    });
    return rows;
  }, [filteredQuotes, sortField, crmSortDirection]);

  // ----------------------------------------------------------
  // CLIENT CRUD
  // ----------------------------------------------------------

  const openClient = (mode: ModalMode, client?: ClienteRow) => {
    setClientErrors({});
    setClientModal({
      open: true,
      mode,
      value:
        client ||
        ({
          codigo_cliente: nextCode(clients, "codigo_cliente", "CLI"),
          nombre_empresa: "",
          nit: "",
          direccion: "",
          estado_cliente_id: 1,
        } as Partial<ClienteRow>),
    });
  };

  const validateClient = () => {
    const v = clientModal.value;
    const e: FieldErrors = {};
    if (!String(v.nombre_empresa || "").trim()) e.nombre_empresa = "El nombre de la empresa es obligatorio.";
    if (!String(v.nit || "").trim()) e.nit = "El NIT es obligatorio.";
    const duplicate = clients.some((c) => c.nit.trim().toLowerCase() === String(v.nit || "").trim().toLowerCase() && c.id !== Number(v.id));
    if (duplicate) e.nit = "Ya existe un cliente registrado con ese NIT.";
    setClientErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveClientData = async () => {
    if (!validateClient()) return;

    const payload = {
      codigo_cliente: clientModal.value.codigo_cliente,
      nombre_empresa: cleanCommercialText(String(clientModal.value.nombre_empresa || ""), 120),
      nit: String(clientModal.value.nit || "").trim(),
      direccion: cleanAddressText(String(clientModal.value.direccion || ""), 180),
      estado_cliente_id: Number(clientModal.value.estado_cliente_id || 1),
    };

    try {
      if (clientModal.mode === "create") {
        await apiSendCRM("/clientes", "POST", payload);
      } else if (clientModal.mode === "edit" && clientModal.value.id) {
        await apiSendCRM(`/clientes/${clientModal.value.id}`, "PUT", payload);
      }

      await reload();
      setSearchQuery("");
      setStatusFilter("Todos");
      setActiveTab("clientes");
      setClientModal({ open: false, mode: "create", value: {} });
      showNotice("success", clientModal.mode === "create" ? "Cliente guardado correctamente en MySQL." : "Cliente actualizado correctamente en MySQL.");
    } catch (error: any) {
      showNotice("error", error.message || "No se pudo guardar el cliente en MySQL.");
    }
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

  const openContact = (mode: ModalMode, clientId: number, contact?: ContactoClienteRow) => {
    setContactErrors({});
    setContactModal({
      open: true,
      mode,
      clientId,
      value:
        contact ||
        ({
          cliente_id: clientId,
          primer_nombre: "",
          segundo_nombre: "",
          primer_apellido: "",
          segundo_apellido: "",
          cargo: "",
          correo: "",
          es_principal: !contacts.some((c) => c.cliente_id === clientId),
          estado: true,
        } as Partial<ContactoClienteRow>),
    });
  };

  const validateContact = () => {
    const v = contactModal.value;
    const e: FieldErrors = {};
    if (!String(v.primer_nombre || "").trim()) e.primer_nombre = "El primer nombre es obligatorio.";
    if (!String(v.primer_apellido || "").trim()) e.primer_apellido = "El primer apellido es obligatorio.";
    if (v.correo && !validEmail(String(v.correo))) e.correo = "Ingresa un correo electrónico válido.";
    setContactErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveContactData = async () => {
    if (!validateContact() || !contactModal.clientId) return;

    const payload = {
      cliente_id: contactModal.clientId,
      primer_nombre: cleanPersonName(String(contactModal.value.primer_nombre || ""), 35),
      segundo_nombre: cleanPersonName(String(contactModal.value.segundo_nombre || ""), 35),
      primer_apellido: cleanPersonName(String(contactModal.value.primer_apellido || ""), 35),
      segundo_apellido: cleanPersonName(String(contactModal.value.segundo_apellido || ""), 35),
      cargo: cleanRoleText(String(contactModal.value.cargo || ""), 60),
      correo: cleanEmail(String(contactModal.value.correo || "")),
      es_principal: Boolean(contactModal.value.es_principal),
      estado: contactModal.value.estado !== false,
    };

    try {
      if (contactModal.mode === "create") {
        await apiSendCRM("/contactos-cliente", "POST", payload);
      } else if (contactModal.value.id) {
        await apiSendCRM(`/contactos-cliente/${contactModal.value.id}`, "PUT", payload);
      }

      await reload();
      setContactModal({ open: false, mode: "create", value: {}, clientId: null });
      showNotice("success", "Contacto guardado correctamente en MySQL.");
    } catch (error: any) {
      showNotice("error", error.message || "No se pudo guardar el contacto en MySQL.");
    }
  };

  // ----------------------------------------------------------
  // PHONE CRUD
  // ----------------------------------------------------------

  const openPhone = (mode: ModalMode, contactId: number, phone?: TelefonoContactoRow) => {
    setPhoneErrors({});
    const defaultPrefix = prefijos.find((p) => p.codigo_pais === "GT") || PREFIJOS_DEFAULT[0];
    setPhoneModal({
      open: true,
      mode,
      contactId,
      value:
        phone
          ? {
              ...phone,
              telefono: cleanPhone(String(phone.telefono || ""), phoneDigitsLimit(phone.prefijo_telefonico_id || defaultPrefix.id)),
              prefijo_telefonico_id: phone.prefijo_telefonico_id || defaultPrefix.id,
            }
          : ({
              contacto_id: contactId,
              prefijo_telefonico_id: defaultPrefix.id,
              telefono: "",
              tipo_telefono: "Móvil",
              es_principal: !phones.some((p) => p.contacto_id === contactId),
            } as Partial<TelefonoContactoRow>),
    });
  };

  const validatePhone = () => {
    const v = phoneModal.value;
    const e: FieldErrors = {};
    const prefix = getPhonePrefix(v.prefijo_telefonico_id);
    const limit = phoneDigitsLimit(v.prefijo_telefonico_id);
    const digits = cleanPhone(String(v.telefono || ""), limit);

    if (!v.prefijo_telefonico_id) e.prefijo = "Selecciona el prefijo del país.";
    if (!digits) e.telefono = "El teléfono es obligatorio.";
    else if (digits.length !== limit) e.telefono = `${prefix.prefijo} debe tener exactamente ${limit} dígitos.`;

    setPhoneErrors(e);
    return Object.keys(e).length === 0;
  };

  const savePhoneData = async () => {
    if (!validatePhone() || !phoneModal.contactId) return;

    const limit = phoneDigitsLimit(phoneModal.value.prefijo_telefonico_id);
    const payload = {
      contacto_id: phoneModal.contactId,
      prefijo_telefonico_id: Number(phoneModal.value.prefijo_telefonico_id || 1),
      telefono: cleanPhone(String(phoneModal.value.telefono || ""), limit),
      tipo_telefono: String(phoneModal.value.tipo_telefono || "Otro"),
      es_principal: Boolean(phoneModal.value.es_principal),
    };

    try {
      if (phoneModal.mode === "create") {
        await apiSendCRM("/telefonos-contacto", "POST", payload);
      } else if (phoneModal.value.id) {
        await apiSendCRM(`/telefonos-contacto/${phoneModal.value.id}`, "PUT", payload);
      }

      await reload();
      setPhoneModal({ open: false, mode: "create", value: {}, contactId: null });
      showNotice("success", "Teléfono guardado correctamente en MySQL.");
    } catch (error: any) {
      showNotice("error", error.message || "No se pudo guardar el teléfono en MySQL.");
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

    const bad = quoteModal.details.find((d) => !d.descripcion.trim() || d.descripcion.trim().length > 50 || Number(d.cantidad) <= 0 || Number(d.precio_unitario) < 0 || Number(d.dias_ui) <= 0);
    if (bad) e.details = "Cada línea debe tener descripción (máx. 50), cantidad mayor a 0, precio válido y días mayor a 0.";

    setQuoteErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveQuoteData = async () => {
    if (!validateQuote()) return;

    const services = quoteModal.details.map((d) => ({
      id: d.id,
      description: d.descripcion.trim().slice(0, 50),
      descripcion: d.descripcion.trim().slice(0, 50),
      quantity: Number(d.cantidad || 1),
      cantidad: Number(d.cantidad || 1),
      unitPrice: Number(d.precio_unitario || 0),
      precio_unitario: Number(d.precio_unitario || 0),
      days: Number(d.dias_ui || 1),
      dias_ui: Number(d.dias_ui || 1),
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
      tipo_carga_ui: quoteModal.value.tipo_carga_ui,
      peso_ui: quoteModal.value.peso_ui,
      volumen_ui: quoteModal.value.volumen_ui,
      observaciones_ui: quoteModal.value.observaciones_ui,
      services,
    };

    try {
      if (quoteModal.mode === "create") {
        await apiSendCRM("/cotizaciones", "POST", payload);
      } else if (quoteModal.value.id) {
        await apiSendCRM(`/cotizaciones/${quoteModal.value.id}`, "PUT", payload);
      }

      await reload();
      setQuoteModal({ open: false, mode: "create", value: {}, details: [] });
      showNotice("success", "Cotización guardada correctamente en MySQL.");
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
      await apiSendCRM(`/cotizaciones/${id}/estado`, "PATCH", { estado: status, estado_ui: status });
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
      const subtotal = det.reduce((s, d) => s + d.cantidad * d.precio_unitario, 0);
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
        services: det.map((d) => ({ id: String(d.id), description: d.descripcion, modality: "", route: "", quantity: d.cantidad, unitPrice: d.precio_unitario, subtotal: d.cantidad * d.precio_unitario, days: d.dias_ui })),
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
  // DELETE
  // ----------------------------------------------------------

  const executeDelete = async () => {
    if (!deleteModal.type || !deleteModal.id) return;
    const id = deleteModal.id;

    const endpointByType: Record<string, string> = {
      client: `/clientes/${id}`,
      contact: `/contactos-cliente/${id}`,
      phone: `/telefonos-contacto/${id}`,
      lead: `/oportunidades/${id}`,
      quote: `/cotizaciones/${id}`,
    };

    try {
      await apiSendCRM(endpointByType[deleteModal.type], "DELETE");
      await reload();
      setClientModal({ open: false, mode: "create", value: {} });
      setContactModal({ open: false, mode: "create", value: {}, clientId: null });
      setPhoneModal({ open: false, mode: "create", value: {}, contactId: null });
      setLeadModal({ open: false, mode: "create", value: {} });
      setQuoteModal({ open: false, mode: "create", value: {}, details: [] });
      setDeleteModal({ open: false, type: null, id: null });
      showNotice("success", "Registro eliminado o inactivado correctamente en MySQL.");
    } catch (error: any) {
      setDeleteModal({ open: false, type: null, id: null });
      showNotice("error", error.message || "No se pudo eliminar el registro en MySQL.");
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

  const totalWon = leads.filter((l) => l.stage === "ganado").reduce((s, l) => s + l.amount, 0);
  const totalQuoteGTQ = quoteViews.reduce((s, q) => s + (q.currency === "USD" ? q.total * 7.8 : q.total), 0);

  const kpis =
    activeTab === "seguimiento"
      ? [
          { title: "Oportunidades activas", value: leads.length, icon: Target, color: "blue" as const },
          { title: "Tasa de cierre", value: leads.length ? `${Math.round((leads.filter((l) => l.stage === "ganado").length / leads.length) * 100)}%` : "0%", icon: TrendingUp, color: "green" as const },
          { title: "Oportunidades registradas", value: leads.length, icon: FileText, color: "orange" as const },
          { title: "Valor ganado", value: moneyGTQ(totalWon), icon: DollarSign, color: "blue" as const },
        ]
      : activeTab === "clientes"
      ? [
          { title: "Total clientes", value: clients.length, icon: Users, color: "blue" as const },
          { title: "Clientes activos", value: clients.filter((c) => c.estado_cliente_id === 1).length, icon: TrendingUp, color: "green" as const },
          { title: "Clientes inactivos", value: clients.filter((c) => c.estado_cliente_id === 2).length, icon: FileText, color: "orange" as const },
          { title: "Contactos registrados", value: contacts.length, icon: UserPlus, color: "blue" as const },
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
  const currentClientContacts = currentClient ? contacts.filter((c) => c.cliente_id === currentClient.id) : [];

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
  });


  const hasActiveCrmFilters = Boolean(searchQuery.trim()) || statusFilter !== "Todos" || leadStageFilter !== "Todos";

  const clearCrmFilters = () => {
    setSearchQuery("");
    setStatusFilter("Todos");
    setLeadStageFilter("Todos");
    setSortField("");
    setCrmSortDirection("asc");
  };

  const sortIcon = (field: string) => {
    if (sortField !== field) return "↕";
    return crmSortDirection === "asc" ? "↑" : "↓";
  };

  const handleColumnSort = (field: string) => {
    if (sortField === field) {
      setCrmSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

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
  }) => (
    <th className={className}>
      <button
        type="button"
        onClick={() => handleColumnSort(field)}
        className={`inline-flex items-center gap-0.5 text-[13px] font-bold transition-colors hover:text-[#FF6A00] ${sortField === field ? "text-[#FF6A00]" : "text-[#0C2D6B]"}`}
        title="Ordenar ascendente o descendente"
      >
        <span>{children}</span>
        <span className={`text-[9px] leading-none ${sortField === field ? "text-[#FF6A00]" : "text-gray-300"}`}>{sortIcon(field)}</span>
      </button>
    </th>
  );

  const SortChip = ({ field, label }: { field: string; label: string }) => (
    <button
      type="button"
      onClick={() => handleColumnSort(field)}
      className={`h-8 rounded-full border px-3 text-[11px] font-bold transition-colors ${sortField === field ? "border-orange-200 bg-white text-[#FF6A00] shadow-sm" : "border-gray-200 bg-white text-[#0C2D6B] hover:bg-blue-50"}`}
      title="Ordenar ascendente o descendente"
    >
      {label} <span className="ml-1 text-[9px] leading-none">{sortIcon(field)}</span>
    </button>
  );

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
        <div className="flex border-b border-gray-200 gap-6 min-w-max">
          {[
            ["seguimiento", "Seguimiento de Ventas"],
            ["clientes", "Clientes"],
            ["cotizaciones", "Cotizaciones"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => {
                setActiveTab(id as any);
                setSearchQuery("");
                setStatusFilter("Todos");
                setLeadStageFilter("Todos");
              }}
              className={`pb-3 font-semibold text-sm relative ${activeTab === id ? "text-[#0C2D6B]" : "text-gray-500 hover:text-gray-700"}`}
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
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar oportunidad..." className="w-full h-11 pl-12 pr-4 bg-white border border-gray-200 rounded-xl text-sm outline-none shadow-sm focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/20" />
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
              Limpiar
            </button>

            <button onClick={() => openLead("create")} className="h-11 bg-[#0C2D6B] text-white px-4 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#143C8C] ml-0 xl:ml-auto">
              <Plus className="w-4 h-4" /> Nueva oportunidad
            </button>
            <button onClick={exportLeads} className="h-11 bg-[#22C55E] text-white px-4 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#16A34A]">
              <Download className="w-4 h-4" /> Excel
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-bold text-gray-400">{sortedLeads.length} de {leads.length} oportunidades visibles</span>

          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-gray-400 uppercase tracking-wide">Ordenar por:</span>
            <SortChip field="date" label="Fecha" />
            <SortChip field="amount" label="Monto" />
            <SortChip field="probability" label="Probabilidad" />
            <SortChip field="clientName" label="Cliente" />
            <SortChip field="opportunityName" label="Oportunidad" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 pb-3">
            {[
              { id: "prospecto", label: "Prospecto", border: "border-l-gray-400", badge: "bg-gray-200" },
              { id: "cotizado", label: "Cotizado", border: "border-l-blue-400", badge: "bg-blue-100" },
              { id: "negociacion", label: "Negociación", border: "border-l-[#FF6A00]", badge: "bg-orange-100" },
              { id: "ganado", label: "Ganado", border: "border-l-[#22C55E]", badge: "bg-green-100" },
              { id: "perdido", label: "Perdido", border: "border-l-red-500", badge: "bg-red-100" },
            ].map((col) => {
              const rows = sortedLeads.filter((l) => l.stage === col.id);
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
              Limpiar
            </button>

            <div className="flex gap-2 ml-0 xl:ml-auto">
              <button onClick={() => openClient("create")} className="h-11 bg-[#0C2D6B] text-white px-4 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#143C8C]">
                <Plus className="w-4 h-4" /> Nuevo Cliente
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
                {sortedClients.map((c) => {
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
                          <button onClick={() => setDeleteModal({ open: true, type: "client", id: c.id })} className="w-8 h-8 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 flex items-center justify-center" title="Eliminar cliente" aria-label="Eliminar cliente"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!sortedClients.length && <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No se encontraron clientes.</td></tr>}
              </tbody>
            </table>
          </div>
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
              Limpiar
            </button>

            <div className="flex gap-2 ml-0 xl:ml-auto">
              <button onClick={() => openQuote("create")} className="h-11 bg-[#0C2D6B] text-white px-4 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#143C8C]"><Plus className="w-4 h-4" /> Nueva Cotización</button>
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
                {sortedQuotes.map((q) => (
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
        </div>
      )}

      {/* ==================================================== */}
      {/* DRAWER CLIENTE */}
      {/* ==================================================== */}
      {clientModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-end">
          <div className="bg-white w-full max-w-2xl h-full flex flex-col shadow-2xl">
            <div className="px-6 py-4 bg-[#0C2D6B] text-white flex items-center justify-between">
              <div>
                <p className="text-xs text-white/60 uppercase tracking-widest">Expediente del cliente</p>
                <h2 className="text-xl font-bold">{clientModal.mode === "create" ? "Nuevo Cliente" : clientModal.mode === "edit" ? "Editar Cliente" : "Detalle Cliente"}</h2>
              </div>
              <button onClick={() => setClientModal({ open: false, mode: "create", value: {} })}><X className="w-6 h-6" /></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {clientModal.mode !== "view" ? (
                <div className="space-y-5" data-enter-form>
                  <ErrorSummary errors={clientErrors} title="Revisa los campos del cliente:" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Código</label>
                      <input disabled value={clientModal.value.codigo_cliente || ""} className={baseInput} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Estado *</label>
                      <select data-enter-item="true" onKeyDown={moveWithEnter} value={Number(clientModal.value.estado_cliente_id || 1)} onChange={(e) => setClientModal((p) => ({ ...p, value: { ...p.value, estado_cliente_id: Number(e.target.value) } }))} className={inputClass()}>
                        <option value={1}>Activo</option><option value={2}>Inactivo</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Nombre de empresa / razón social *</label>
                      <input autoFocus data-enter-item="true" onKeyDown={moveWithEnter} maxLength={120} value={clientModal.value.nombre_empresa || ""} onChange={(e) => { setClientErrors((x) => ({ ...x, nombre_empresa: "" })); setClientModal((p) => ({ ...p, value: { ...p.value, nombre_empresa: cleanCommercialText(e.target.value, 120) } })); }} className={inputClass(clientErrors.nombre_empresa)} placeholder="Distribuidora Maya del Norte, S.A." />
                      <ErrorText value={clientErrors.nombre_empresa} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">NIT *</label>
                      <input data-enter-item="true" onKeyDown={moveWithEnter} maxLength={20} value={clientModal.value.nit || ""} onChange={(e) => { setClientErrors((x) => ({ ...x, nit: "" })); setClientModal((p) => ({ ...p, value: { ...p.value, nit: cleanNit(e.target.value) } })); }} className={inputClass(clientErrors.nit)} placeholder="5487963-2" />
                      <ErrorText value={clientErrors.nit} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Dirección</label>
                      <input data-enter-item="true" onKeyDown={moveWithEnter} maxLength={180} value={clientModal.value.direccion || ""} onChange={(e) => setClientModal((p) => ({ ...p, value: { ...p.value, direccion: cleanAddressText(e.target.value, 180) } }))} className={inputClass()} placeholder="5a. Avenida 3-42 Zona 1, Cobán" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 italic">Los contactos y teléfonos se agregan después de guardar el cliente, de acuerdo con las tablas contactos_cliente y telefonos_contacto.</p>
                </div>
              ) : currentClient ? (
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between border-b pb-2 mb-3">
                      <h3 className="text-xs font-bold text-[#0C2D6B] uppercase tracking-wider">Información de la empresa</h3>
                      <div className="flex gap-2">
                        <button onClick={() => openClient("edit", currentClient)} className="h-8 px-3 bg-orange-50 text-[#FF6A00] rounded-lg text-xs font-bold flex items-center gap-1"><Edit2 className="w-3.5 h-3.5" /> Editar</button>
                        <button onClick={() => setDeleteModal({ open: true, type: "client", id: currentClient.id })} className="h-8 px-3 bg-red-50 text-red-600 rounded-lg text-xs font-bold flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Eliminar</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><p className="text-xs text-gray-400">Código</p><p className="font-bold text-[#0C2D6B]">{currentClient.codigo_cliente}</p></div>
                      <div><p className="text-xs text-gray-400">Estado</p><span className={`inline-block mt-1 px-2 py-1 rounded text-xs font-bold ${currentClient.estado_cliente_id === 1 ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"}`}>{estadoClienteNombre(currentClient.estado_cliente_id)}</span></div>
                      <div className="col-span-2"><p className="text-xs text-gray-400">Empresa</p><p className="font-bold text-lg">{currentClient.nombre_empresa}</p></div>
                      <div><p className="text-xs text-gray-400">NIT</p><p>{currentClient.nit}</p></div>
                      <div className="col-span-2"><p className="text-xs text-gray-400">Dirección</p><p>{currentClient.direccion || "-"}</p></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between border-b pb-2 mb-3">
                      <h3 className="text-xs font-bold text-[#0C2D6B] uppercase tracking-wider">Contactos del cliente</h3>
                      <button onClick={() => openContact("create", currentClient.id)} className="h-8 px-3 bg-[#FF6A00] text-white rounded-lg text-xs font-bold flex items-center gap-1"><UserPlus className="w-3.5 h-3.5" /> Nuevo contacto</button>
                    </div>

                    {!currentClientContacts.length ? <p className="text-sm text-gray-400 italic py-4">Sin contactos registrados.</p> : (
                      <div className="space-y-3">
                        {currentClientContacts.map((ct) => {
                          const ctPhones = phones.filter((p) => p.contacto_id === ct.id);
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
                                <div className="flex gap-1 h-fit">
                                  <button onClick={() => openContact("edit", currentClient.id, ct)} className="p-1.5 text-gray-400 hover:text-[#FF6A00] hover:bg-orange-50 rounded" title="Editar contacto"><Edit2 className="w-4 h-4" /></button>
                                  <button onClick={() => openPhone("create", ct.id)} className="p-1.5 text-gray-400 hover:text-[#0C2D6B] hover:bg-blue-50 rounded" title="Agregar teléfono"><Phone className="w-4 h-4" /></button>
                                  <button onClick={() => setDeleteModal({ open: true, type: "contact", id: ct.id })} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Eliminar contacto"><Trash2 className="w-4 h-4" /></button>
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {ctPhones.map((p) => (
                                  <button key={p.id} onClick={() => openPhone("edit", ct.id, p)} className="px-2.5 py-1.5 bg-white border rounded-lg text-xs text-gray-600 hover:border-[#0C2D6B]">
                                    {formatPhone(p)} · {p.tipo_telefono}{p.es_principal ? " · Principal" : ""}
                                  </button>
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
              <button onClick={() => setClientModal({ open: false, mode: "create", value: {} })} className="h-10 px-4 rounded-lg font-bold text-gray-600 hover:bg-gray-100">{clientModal.mode === "view" ? "Cerrar" : "Cancelar"}</button>
              {clientModal.mode !== "view" && <button data-enter-save="true" onClick={saveClientData} className="h-10 px-5 rounded-lg font-bold bg-[#0C2D6B] text-white hover:bg-[#143C8C]">Guardar cliente</button>}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL CONTACTO */}
      {/* ==================================================== */}
      {contactModal.open && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-[#0C2D6B] px-6 py-4 flex justify-between items-center">
              <h2 className="text-white font-bold text-lg">{contactModal.mode === "edit" ? "Editar contacto" : "Nuevo contacto"}</h2>
              <button onClick={() => setContactModal({ open: false, mode: "create", value: {}, clientId: null })} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4" data-enter-form>
              <ErrorSummary errors={contactErrors} title="Revisa los datos del contacto:" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Primer nombre *</label><input autoFocus data-enter-item="true" onKeyDown={moveWithEnter} maxLength={30} value={contactModal.value.primer_nombre || ""} onChange={(e) => { setContactErrors((x) => ({ ...x, primer_nombre: "" })); setContactModal((p) => ({ ...p, value: { ...p.value, primer_nombre: cleanPersonName(e.target.value, 35) } })); }} className={inputClass(contactErrors.primer_nombre)} /><ErrorText value={contactErrors.primer_nombre} /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Segundo nombre</label><input data-enter-item="true" onKeyDown={moveWithEnter} maxLength={30} value={contactModal.value.segundo_nombre || ""} onChange={(e) => setContactModal((p) => ({ ...p, value: { ...p.value, segundo_nombre: cleanPersonName(e.target.value, 35) } }))} className={inputClass()} /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Primer apellido *</label><input data-enter-item="true" onKeyDown={moveWithEnter} maxLength={35} value={contactModal.value.primer_apellido || ""} onChange={(e) => { setContactErrors((x) => ({ ...x, primer_apellido: "" })); setContactModal((p) => ({ ...p, value: { ...p.value, primer_apellido: cleanPersonName(e.target.value, 35) } })); }} className={inputClass(contactErrors.primer_apellido)} /><ErrorText value={contactErrors.primer_apellido} /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Segundo apellido</label><input data-enter-item="true" onKeyDown={moveWithEnter} maxLength={35} value={contactModal.value.segundo_apellido || ""} onChange={(e) => setContactModal((p) => ({ ...p, value: { ...p.value, segundo_apellido: cleanPersonName(e.target.value, 35) } }))} className={inputClass()} /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Cargo</label><input data-enter-item="true" onKeyDown={moveWithEnter} maxLength={60} value={contactModal.value.cargo || ""} onChange={(e) => setContactModal((p) => ({ ...p, value: { ...p.value, cargo: cleanRoleText(e.target.value, 60) } }))} className={inputClass()} /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Correo</label><input data-enter-item="true" onKeyDown={moveWithEnter} type="email" maxLength={150} value={contactModal.value.correo || ""} onChange={(e) => { setContactErrors((x) => ({ ...x, correo: "" })); setContactModal((p) => ({ ...p, value: { ...p.value, correo: cleanEmail(e.target.value) } })); }} className={inputClass(contactErrors.correo)} placeholder="maria.lopez@empresa.com.gt" /><ErrorText value={contactErrors.correo} /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Contacto principal</label><select data-enter-item="true" onKeyDown={moveWithEnter} value={contactModal.value.es_principal ? "1" : "0"} onChange={(e) => setContactModal((p) => ({ ...p, value: { ...p.value, es_principal: e.target.value === "1" } }))} className={inputClass()}><option value="1">Sí</option><option value="0">No</option></select></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Estado</label><select data-enter-item="true" onKeyDown={moveWithEnter} value={contactModal.value.estado === false ? "0" : "1"} onChange={(e) => setContactModal((p) => ({ ...p, value: { ...p.value, estado: e.target.value === "1" } }))} className={inputClass()}><option value="1">Activo</option><option value="0">Inactivo</option></select></div>
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
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-[#0C2D6B] px-6 py-4 flex justify-between items-center"><h2 className="text-white font-bold">{phoneModal.mode === "edit" ? "Editar teléfono" : "Nuevo teléfono"}</h2><button onClick={() => setPhoneModal({ open: false, mode: "create", value: {}, contactId: null })} className="text-white/70"><X className="w-5 h-5" /></button></div>
            <div className="p-6 space-y-4" data-enter-form>
              <ErrorSummary errors={phoneErrors} title="Revisa el teléfono:" />
              <div className="grid grid-cols-[150px_1fr] gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Prefijo *</label>
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
                  <label className="block text-xs font-bold text-gray-700 mb-1">Número *</label>
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
              <div><label className="block text-xs font-bold text-gray-700 mb-1">Tipo de teléfono</label><select data-enter-item="true" onKeyDown={moveWithEnter} value={phoneModal.value.tipo_telefono || "Móvil"} onChange={(e) => setPhoneModal((p) => ({ ...p, value: { ...p.value, tipo_telefono: e.target.value } }))} className={inputClass()}><option>Móvil</option><option>Oficina</option><option>WhatsApp</option><option>Emergencia</option><option>Otro</option></select></div>
              <div><label className="block text-xs font-bold text-gray-700 mb-1">¿Es principal?</label><select data-enter-item="true" onKeyDown={moveWithEnter} value={phoneModal.value.es_principal ? "1" : "0"} onChange={(e) => setPhoneModal((p) => ({ ...p, value: { ...p.value, es_principal: e.target.value === "1" } }))} className={inputClass()}><option value="1">Sí</option><option value="0">No</option></select></div>
            </div>
            <div className="px-6 pb-6 flex justify-between gap-2">
              {phoneModal.mode === "edit" && phoneModal.value.id ? <button onClick={() => setDeleteModal({ open: true, type: "phone", id: Number(phoneModal.value.id) })} className="h-10 px-4 text-red-600 font-bold text-sm hover:bg-red-50 rounded-lg">Eliminar</button> : <div />}
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
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Código</label><input disabled value={leadModal.value.codigo_oportunidad || ""} className={baseInput} /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Etapa *</label><select disabled={leadModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} value={Number(leadModal.value.estado_id || 1)} onChange={(e) => { setLeadErrors((x) => ({ ...x, estado_id: "" })); setLeadModal((p) => ({ ...p, value: { ...p.value, estado_id: Number(e.target.value) } })); }} className={inputClass(leadErrors.estado_id)}><option value={1}>Prospecto</option><option value={2}>Cotizado</option><option value={3}>Negociación</option><option value={4}>Ganado</option><option value={5}>Perdido</option></select><ErrorText value={leadErrors.estado_id} /></div>
                <div className="sm:col-span-2"><label className="block text-xs font-bold text-gray-700 mb-1">Nombre de la oportunidad *</label><input autoFocus disabled={leadModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} maxLength={100} value={leadModal.value.nombre_oportunidad || ""} onChange={(e) => { setLeadErrors((x) => ({ ...x, nombre_oportunidad: "" })); setLeadModal((p) => ({ ...p, value: { ...p.value, nombre_oportunidad: cleanCommercialTyping(e.target.value, 100) } })); }} className={inputClass(leadErrors.nombre_oportunidad)} placeholder="Exportación terrestre de textiles a El Salvador" /><ErrorText value={leadErrors.nombre_oportunidad} /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Cliente *</label><select disabled={leadModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} value={leadModal.value.cliente_id || ""} onChange={(e) => { setLeadErrors((x) => ({ ...x, cliente_id: "" })); setLeadModal((p) => ({ ...p, value: { ...p.value, cliente_id: Number(e.target.value) || null } })); }} className={inputClass(leadErrors.cliente_id)}><option value="">Seleccione...</option>{clients.filter((c) => c.estado_cliente_id === 1).map((c) => <option key={c.id} value={c.id}>{c.codigo_cliente} · {c.nombre_empresa}</option>)}</select><ErrorText value={leadErrors.cliente_id} /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Ejecutivo *</label><select disabled={leadModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} value={leadModal.value.ejecutivo_id || ""} onChange={(e) => { setLeadErrors((x) => ({ ...x, ejecutivo_id: "" })); setLeadModal((p) => ({ ...p, value: { ...p.value, ejecutivo_id: Number(e.target.value) || null } })); }} className={inputClass(leadErrors.ejecutivo_id)}><option value="">Seleccione...</option>{salesUsers.map((u) => <option key={u.id} value={u.id}>{fullUserName(u)} ({u.nombre_usuario})</option>)}</select><ErrorText value={leadErrors.ejecutivo_id} /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Modalidad *</label><select disabled={leadModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} value={leadModal.value.modalidad_id || ""} onChange={(e) => { setLeadErrors((x) => ({ ...x, modalidad_id: "" })); setLeadModal((p) => ({ ...p, value: { ...p.value, modalidad_id: Number(e.target.value) || null } })); }} className={inputClass(leadErrors.modalidad_id)}><option value="">Seleccione...</option>{modalidades.map((m) => <option key={m.id} value={m.id}>{m.nombre_modalidad}</option>)}</select><ErrorText value={leadErrors.modalidad_id} /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Probabilidad (%) *</label><input disabled={leadModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} type="text" inputMode="numeric" value={leadModal.value.probabilidad ?? 0} onChange={(e) => { const n = Math.min(100, Number(cleanInteger(e.target.value, 3) || 0)); setLeadErrors((x) => ({ ...x, probabilidad: "" })); setLeadModal((p) => ({ ...p, value: { ...p.value, probabilidad: n } })); }} className={inputClass(leadErrors.probabilidad)} /><ErrorText value={leadErrors.probabilidad} /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Monto estimado (Q)</label><input disabled={leadModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} type="text" inputMode="decimal" value={Number(leadModal.value.monto_estimado || 0) === 0 ? "" : String(leadModal.value.monto_estimado)} placeholder="45000" onFocus={(e) => e.currentTarget.select()} onChange={(e) => { const limpio = cleanDecimal(e.target.value); setLeadErrors((x) => ({ ...x, monto_estimado: "" })); setLeadModal((p) => ({ ...p, value: { ...p.value, monto_estimado: limpio === "" ? undefined : Number(limpio) } })); }} className={inputClass(leadErrors.monto_estimado)} /><ErrorText value={leadErrors.monto_estimado} /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Fecha creación *</label><input disabled={leadModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} type="date" value={leadModal.value.fecha_creacion || todayISO()} onChange={(e) => { setLeadErrors((x) => ({ ...x, fecha_creacion: "" })); setLeadModal((p) => ({ ...p, value: { ...p.value, fecha_creacion: e.target.value } })); }} className={inputClass(leadErrors.fecha_creacion)} /><ErrorText value={leadErrors.fecha_creacion} /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Cierre estimado</label><input disabled={leadModal.mode === "view"} data-enter-item="true" onKeyDown={moveWithEnter} type="date" value={leadModal.value.fecha_cierre_estimada || ""} onChange={(e) => { setLeadErrors((x) => ({ ...x, fecha_cierre_estimada: "" })); setLeadModal((p) => ({ ...p, value: { ...p.value, fecha_cierre_estimada: e.target.value } })); }} className={inputClass(leadErrors.fecha_cierre_estimada)} /><ErrorText value={leadErrors.fecha_cierre_estimada} /></div>
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
                    Selecciona los datos de la cotización. Presioná <b>Enter</b> para avanzar al siguiente campo. Los datos del cliente, contacto y ejecutivo se relacionan con la base normalizada.
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
                      <span className="font-bold whitespace-nowrap">CONTACTO:</span>
                      <select
                        disabled={quoteModal.mode === "view"}
                        data-enter-item="true"
                        onKeyDown={moveWithEnter}
                        value={quoteModal.value.contacto_id || ""}
                        onChange={(e) => {
                          setQuoteErrors((x) => ({ ...x, contacto_id: "" }));
                          setQuoteModal((p) => ({ ...p, value: { ...p.value, contacto_id: Number(e.target.value) || null } }));
                        }}
                        className={`h-8 flex-1 rounded border px-2 bg-white font-semibold outline-none ${quoteErrors.contacto_id ? "border-red-400" : "border-blue-300 focus:border-[#FF6A00]"}`}
                      >
                        <option value="">Seleccione contacto...</option>
                        {quoteContacts.map((c) => <option key={c.id} value={c.id}>{fullContactName(c)}{c.es_principal ? " · Principal" : ""}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* RAZÓN SOCIAL / EMAIL */}
                  <div className="grid grid-cols-2 border-b border-black">
                    <div className="border-r border-black p-2 flex items-center gap-2">
                      <span className="font-bold whitespace-nowrap">RAZÓN SOCIAL:</span>
                      <select
                        ref={firstQuoteFieldRef}
                        disabled={quoteModal.mode === "view"}
                        data-enter-item="true"
                        onKeyDown={moveWithEnter}
                        value={quoteModal.value.cliente_id || ""}
                        onChange={(e) => {
                          const id = Number(e.target.value) || null;
                          const pc = id ? principalContact(id) : undefined;
                          setQuoteErrors((x) => ({ ...x, cliente_id: "", contacto_id: "" }));
                          setQuoteModal((p) => ({ ...p, value: { ...p.value, cliente_id: id, contacto_id: pc?.id || null } }));
                        }}
                        className={`h-8 flex-1 min-w-0 rounded border px-2 bg-white font-semibold outline-none ${quoteErrors.cliente_id ? "border-red-400" : "border-blue-300 focus:border-[#FF6A00]"}`}
                      >
                        <option value="">Seleccione cliente...</option>
                        {clients.filter((c) => c.estado_cliente_id === 1).map((c) => <option key={c.id} value={c.id}>{c.codigo_cliente} · {c.nombre_empresa}</option>)}
                      </select>
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
                        inputMode="decimal"
                        value={quoteModal.value.peso_ui || ""}
                        onChange={(e) => setQuoteModal((p) => ({ ...p, value: { ...p.value, peso_ui: cleanDecimal(e.target.value) } }))}
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
                        inputMode="decimal"
                        value={quoteModal.value.volumen_ui || ""}
                        onChange={(e) => setQuoteModal((p) => ({ ...p, value: { ...p.value, volumen_ui: cleanDecimal(e.target.value) } }))}
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
                        )}
                      </div>

                      <div className="border-b border-black p-2 flex items-center gap-2">
                        <span className="font-bold">DESTINO:</span>
                        {quoteModal.mode === "view" ? (
                          <span className="font-semibold">{quoteDestination ? `${quoteDestination.nombre_ubicacion}, ${quoteDestination.pais}` : "-"}</span>
                        ) : (
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
                        )}
                      </div>

                      <div className="border-b border-black p-2 flex items-center gap-2">
                        <span className="font-bold">TIPO DE CARGA:</span>
                        <input
                          disabled={quoteModal.mode === "view"}
                          data-enter-item="true"
                          onKeyDown={moveWithEnter}
                          value={quoteModal.value.tipo_carga_ui || ""}
                          onChange={(e) => setQuoteModal((p) => ({ ...p, value: { ...p.value, tipo_carga_ui: cleanCommercialText(e.target.value, 80) } }))}
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
                              value={d.cantidad}
                              onFocus={(e) => e.currentTarget.select()}
                              onChange={(e) => {
                                const limpio = cleanInteger(e.target.value, 6);
                                updateQuoteDetail(d.id, "cantidad", Math.max(1, Number(limpio) || 1));
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
                              onChange={(e) => updateQuoteDetail(d.id, "descripcion", cleanCommercialText(e.target.value, 50))}
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
                              value={Number(d.precio_unitario || 0) === 0 ? "" : String(d.precio_unitario)}
                              placeholder="2500"
                              onFocus={(e) => e.currentTarget.select()}
                              onChange={(e) => { const limpio = cleanDecimal(e.target.value); updateQuoteDetail(d.id, "precio_unitario", limpio === "" ? 0 : Number(limpio)); }}
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
                              value={d.dias_ui}
                              onFocus={(e) => e.currentTarget.select()}
                              onChange={(e) => {
                                const limpio = cleanInteger(e.target.value, 4);
                                updateQuoteDetail(d.id, "dias_ui", Math.max(1, Number(limpio) || 1));
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

                  <div className="border-x border-b border-black p-2 bg-white flex items-center gap-2">
                    <span className="font-bold">DÍAS DE CRÉDITO:</span>
                    <span className="font-semibold text-[#0C2D6B]">{quotePayment?.nombre_forma_pago || "Seleccione forma de pago"}</span>
                  </div>

                  {/* NOTAS + FIRMA */}
                  <div className="p-4 text-[#d97706] text-[11px] bg-white border-x border-b border-black">
                    <div className="flex justify-between gap-8">
                      <div className="w-1/2">
                        <p className="font-bold mb-2">Nuestra cotización NO incluye:</p>
                        <ul className="list-disc ml-5 space-y-1">
                          <li>Maniobras (carga y descarga)</li>
                          <li>Seguro de cargas</li>
                          <li>Custodios y/o patrullas para unidades en modalidad FTL (cotizado por aparte)</li>
                          <li>Estadías</li>
                          <li>Selectivos rojos</li>
                          <li>Gastos por cuenta ajena</li>
                        </ul>
                      </div>
                      <div className="text-center w-1/2">
                        <p className="text-blue-900 font-bold mb-8">FIRMA DE ACEPTACIÓN DE TARIFA:</p>
                        <div className="border-b border-blue-900 w-3/4 mx-auto h-10" />
                      </div>
                    </div>

                    <div className="mt-6">
                      <p className="font-bold mb-2">Notas importantes:</p>
                      <ul className="list-disc ml-5 space-y-1">
                        <li>Cotización basada en datos proporcionados.</li>
                        <li>Para movimientos locales deberán reservar las unidades con 24 Hrs de anticipación.</li>
                        <li>En temporada alta las unidades deberán ser reservadas con un promedio de 48 Hrs antes del posicionamiento.</li>
                        <li>Logistics Group 365 no asume penalizaciones por atrasos, conflictos sociales, clima, etc.</li>
                        <li>Todo movimiento en falso se cobrará el flete.</li>
                        <li>Los custodios se cotizan por evento dependiendo la ruta.</li>
                      </ul>
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
                        onChange={(e) => setQuoteModal((p) => ({ ...p, value: { ...p.value, observaciones_ui: e.target.value } }))}
                        placeholder="Entrega programada con 48 horas de anticipación."
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
      {/* DELETE CONFIRMATION */}
      {/* ==================================================== */}
      {deleteModal.open && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl p-6 text-center">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 className="w-7 h-7" /></div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">¿Eliminar registro?</h3>
            <p className="text-gray-500 text-sm mb-6">La eliminación respetará las relaciones del prototipo. Si existen registros relacionados, se solicitará inactivar el registro en lugar de eliminarlo.</p>
            <div className="flex gap-3"><button onClick={() => setDeleteModal({ open: false, type: null, id: null })} className="flex-1 h-10 rounded-lg font-bold text-gray-600 hover:bg-gray-100">Cancelar</button><button onClick={executeDelete} className="flex-1 h-10 rounded-lg font-bold bg-red-600 text-white hover:bg-red-700">Sí, eliminar</button></div>
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