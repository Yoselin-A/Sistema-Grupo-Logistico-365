// Sistema de almacenamiento persistente con LocalStorage

export interface Client {
  id: string;
  name: string;
  nit: string;
  modality: string;
  creditLine: number;
  status: 'Activo' | 'Inactivo' | 'Pendiente';
  contact?: string;
  origin?: string;
  destination?: string;
  incoterm?: string;
  productType?: string;
  weightVolume?: string;
  packagingType?: string;
  clientNature?: string;
  satValidation?: string;
  clintonInvestigation?: 'Aprobado' | 'Rechazado' | 'Pendiente';
  requestedDocs?: boolean;
}

export interface QuoteService {
  id: string;
  description: string;
  modality: string;
  route: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  days?: number;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  clientId: string;
  clientName: string;
  nit: string;
  contact: string;
  date: string;
  status: 'Borrador' | 'Enviada' | 'Aprobada';
  services: QuoteService[];
  subtotal: number;
  iva: number;
  total: number;
  observations: string;
  email?: string;
  origin?: string;
  destination?: string;
  cargoType?: string;
  weight?: string;
  volume?: string;
  paymentMethod?: string;
  serviceDays?: number;
}

export interface Lead {
  id: string;
  clientName: string;
  type: string;
  executive: string;
  date: string;
  probability: number;
  amount: number;
  stage: 'prospecto' | 'cotizado' | 'negociacion' | 'ganado' | 'perdido';
}

export interface Assignment {
  id: string;
  cliente: string;
  carga: string;
  descarga: string;
  marchamo: string;
  piloto: string;
  licencia: string;
  cabezal: string;
  furgon: string;
  tipo: string;
  origen: string;
  destino: string;
  auxiliar: string;
  km: number;
  doc: string;
  vendedor: string;
  flete: number;
  paradaAdicional: number;
  movFalso: number;
  estadia: number;
  viajeDoble: number;
  otros: number;
  total: number;
  fechaProveedor: string;
  proveedor: string;
  serieProveedor: string;
  numeroProveedor: string;
  fleteProveedor: number;
  cuadrilla: number;
  estadiaProveedor: number;
  totalProveedor: number;
  fechaPagoProveedor: string;
  fechaFactura: string;
  serieFactura: string;
  numeroFactura: string;
  valorFactura: number;
  fechaPagoFactura: string;
}

export interface Provider {
  id: string;
  name: string;
  service: string;
  contact: string;
  rtuValidated: boolean;
  satStatus: 'Solvente' | 'Omiso' | 'Pendiente';
  clintonInvestigation: 'Aprobado' | 'Rechazado' | 'Pendiente';
  pilotLicenseValidated: boolean;
  bankAccountValidated: boolean;
  performance: 'Verde' | 'Amarillo' | 'Rojo';
  history: string;
  findings: string;
  status: 'Activo' | 'Inactivo';
}

export interface Viaje {
  id: number;
  codigo: string;
  ruta: string;
  unidad: string;
  piloto: string;
  progreso: number;
  estado: string;
  eta: string;
  cliente: string;
  fechaSalida: string;
}

export interface Envio {
  id: number;
  codigo: string;
  cliente: string;
  origen: string;
  destino: string;
  direccion: string;
  fecha: string;
  estado: 'Pendiente' | 'En ruta' | 'Entregado';
  observaciones: string;
}

export interface Deposito {
  id: number;
  codigo: string;
  nombre: string;
  ubicacion: string;
  capacidad: string;
  tipo: 'Central' | 'Regional' | 'Temporal';
  estado: 'Activo' | 'Inactivo';
}

export interface Comprobante {
  id: number;
  numero: string;
  cliente: string;
  total: number;
  estado: 'Pagada' | 'Pendiente' | 'Vencida';
  emisor: string;
  fecha: string;
  descripcion: string;
  formaPago: string;
}

const STORAGE_KEYS = {
  CLIENTS: 'gl365_clients',
  QUOTES: 'gl365_quotes',
  LEADS: 'gl365_leads',
  ASSIGNMENTS: 'gl365_assignments',
  PROVIDERS: 'gl365_providers',
  VIAJES: 'gl365_viajes',
  ENVIOS: 'gl365_envios',
  DEPOSITOS: 'gl365_depositos',
  COMPROBANTES: 'gl365_comprobantes'
};

// === CLIENTES ===
export const getClients = (): Client[] => {
  const data = localStorage.getItem(STORAGE_KEYS.CLIENTS);
  return data ? JSON.parse(data) : [];
};

export const saveClient = (client: Client): void => {
  const clients = getClients();
  const index = clients.findIndex(c => c.id === client.id);

  if (index >= 0) {
    clients[index] = client;
  } else {
    clients.push(client);
  }

  localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
};

export const deleteClient = (id: string): void => {
  const clients = getClients().filter(c => c.id !== id);
  localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
};

// === COTIZACIONES ===
export const getQuotes = (): Quote[] => {
  const data = localStorage.getItem(STORAGE_KEYS.QUOTES);
  return data ? JSON.parse(data) : [];
};

export const saveQuote = (quote: Quote): void => {
  const quotes = getQuotes();
  const index = quotes.findIndex(q => q.id === quote.id);

  if (index >= 0) {
    quotes[index] = quote;
  } else {
    quotes.push(quote);
  }

  localStorage.setItem(STORAGE_KEYS.QUOTES, JSON.stringify(quotes));
};

export const deleteQuote = (id: string): void => {
  const quotes = getQuotes().filter(q => q.id !== id);
  localStorage.setItem(STORAGE_KEYS.QUOTES, JSON.stringify(quotes));
};

// === LEADS ===
export const getLeads = (): Lead[] => {
  const data = localStorage.getItem(STORAGE_KEYS.LEADS);
  return data ? JSON.parse(data) : [];
};

export const saveLeads = (leads: Lead[]): void => {
  localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(leads));
};

// === ASIGNACIONES ===
export const getAssignments = (): Assignment[] => {
  const data = localStorage.getItem(STORAGE_KEYS.ASSIGNMENTS);
  return data ? JSON.parse(data) : [];
};

export const saveAssignment = (assignment: Assignment): void => {
  const assignments = getAssignments();
  const index = assignments.findIndex(a => a.id === assignment.id);

  if (index >= 0) {
    assignments[index] = assignment;
  } else {
    assignments.push(assignment);
  }

  localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignments));
};

export const deleteAssignment = (id: string): void => {
  const assignments = getAssignments().filter(a => a.id !== id);
  localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignments));
};

// === PROVEEDORES ===
export const getProviders = (): Provider[] => {
  const data = localStorage.getItem(STORAGE_KEYS.PROVIDERS);
  return data ? JSON.parse(data) : [];
};

export const saveProvider = (provider: Provider): void => {
  const providers = getProviders();
  const index = providers.findIndex(p => p.id === provider.id);

  if (index >= 0) {
    providers[index] = provider;
  } else {
    providers.push(provider);
  }

  localStorage.setItem(STORAGE_KEYS.PROVIDERS, JSON.stringify(providers));
};

export const deleteProvider = (id: string): void => {
  const providers = getProviders().filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEYS.PROVIDERS, JSON.stringify(providers));
};

// === VIAJES ===
export const getViajes = (): Viaje[] => {
  const data = localStorage.getItem(STORAGE_KEYS.VIAJES);
  return data ? JSON.parse(data) : [];
};

export const saveViaje = (viaje: Viaje): void => {
  const viajes = getViajes();
  const index = viajes.findIndex(v => v.id === viaje.id);

  if (index >= 0) {
    viajes[index] = viaje;
  } else {
    viajes.push(viaje);
  }

  localStorage.setItem(STORAGE_KEYS.VIAJES, JSON.stringify(viajes));
};

export const deleteViaje = (id: number): void => {
  const viajes = getViajes().filter(v => v.id !== id);
  localStorage.setItem(STORAGE_KEYS.VIAJES, JSON.stringify(viajes));
};

// === ENVÍOS ===
export const getEnvios = (): Envio[] => {
  const data = localStorage.getItem(STORAGE_KEYS.ENVIOS);
  return data ? JSON.parse(data) : [];
};

export const saveEnvio = (envio: Envio): void => {
  const envios = getEnvios();
  const index = envios.findIndex(e => e.id === envio.id);

  if (index >= 0) {
    envios[index] = envio;
  } else {
    envios.push(envio);
  }

  localStorage.setItem(STORAGE_KEYS.ENVIOS, JSON.stringify(envios));
};

export const deleteEnvio = (id: number): void => {
  const envios = getEnvios().filter(e => e.id !== id);
  localStorage.setItem(STORAGE_KEYS.ENVIOS, JSON.stringify(envios));
};

// === DEPÓSITOS ===
export const getDepositos = (): Deposito[] => {
  const data = localStorage.getItem(STORAGE_KEYS.DEPOSITOS);
  return data ? JSON.parse(data) : [];
};

export const saveDeposito = (deposito: Deposito): void => {
  const depositos = getDepositos();
  const index = depositos.findIndex(d => d.id === deposito.id);

  if (index >= 0) {
    depositos[index] = deposito;
  } else {
    depositos.push(deposito);
  }

  localStorage.setItem(STORAGE_KEYS.DEPOSITOS, JSON.stringify(depositos));
};

export const deleteDeposito = (id: number): void => {
  const depositos = getDepositos().filter(d => d.id !== id);
  localStorage.setItem(STORAGE_KEYS.DEPOSITOS, JSON.stringify(depositos));
};

// === COMPROBANTES ===
export const getComprobantes = (): Comprobante[] => {
  const data = localStorage.getItem(STORAGE_KEYS.COMPROBANTES);
  return data ? JSON.parse(data) : [];
};

export const saveComprobante = (comprobante: Comprobante): void => {
  const comprobantes = getComprobantes();
  const index = comprobantes.findIndex(c => c.id === comprobante.id);

  if (index >= 0) {
    comprobantes[index] = comprobante;
  } else {
    comprobantes.push(comprobante);
  }

  localStorage.setItem(STORAGE_KEYS.COMPROBANTES, JSON.stringify(comprobantes));
};

export const deleteComprobante = (id: number): void => {
  const comprobantes = getComprobantes().filter(c => c.id !== id);
  localStorage.setItem(STORAGE_KEYS.COMPROBANTES, JSON.stringify(comprobantes));
};

// === LIMPIAR TODO ===
export const clearAllData = (): void => {
  localStorage.removeItem(STORAGE_KEYS.CLIENTS);
  localStorage.removeItem(STORAGE_KEYS.QUOTES);
  localStorage.removeItem(STORAGE_KEYS.LEADS);
  localStorage.removeItem(STORAGE_KEYS.ASSIGNMENTS);
  localStorage.removeItem(STORAGE_KEYS.PROVIDERS);
  localStorage.removeItem(STORAGE_KEYS.VIAJES);
  localStorage.removeItem(STORAGE_KEYS.ENVIOS);
  localStorage.removeItem(STORAGE_KEYS.DEPOSITOS);
  localStorage.removeItem(STORAGE_KEYS.COMPROBANTES);
};
