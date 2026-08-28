import { LucideIcon } from 'lucide-react';
import {
  List,
  Users,
  Shield,
  Building2,
  Handshake,
  DollarSign,
  Truck,
  Package,
  FileText,
  Settings,
  Wrench,
  ClipboardList,
  MapPin,
  Calendar,
  CreditCard,
  AlertCircle,
  Archive,
  Factory,
  Navigation
} from 'lucide-react';

export interface Campo {
  nombre: string;
  tipo: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'email' | 'tel' | 'time';
  requerido?: boolean;
  opciones?: { valor: string; etiqueta: string }[];
  relacionCon?: string;
}

export interface TablaDefinicion {
  nombre: string;
  nombrePlural: string;
  icono: LucideIcon;
  descripcion: string;
  categoria: string;
  soloAdmin?: boolean;
  campos: Campo[];
  camposTabla: string[];
}

export const tablas: TablaDefinicion[] = [
  // === CATÁLOGOS ===
  {
    nombre: 'Estado Cliente',
    nombrePlural: 'Estados de Cliente',
    icono: List,
    descripcion: 'Estados del ciclo de vida del cliente',
    categoria: 'Catálogos',
    campos: [
      { nombre: 'nombre', tipo: 'text', requerido: true },
      { nombre: 'descripcion', tipo: 'textarea' },
      { nombre: 'activo', tipo: 'select', opciones: [{ valor: 'Sí', etiqueta: 'Sí' }, { valor: 'No', etiqueta: 'No' }] }
    ],
    camposTabla: ['nombre', 'descripcion', 'activo']
  },
  {
    nombre: 'Estado Envío',
    nombrePlural: 'Estados de Envío',
    icono: List,
    descripcion: 'Estados del proceso de envío',
    categoria: 'Catálogos',
    campos: [
      { nombre: 'nombre', tipo: 'text', requerido: true },
      { nombre: 'orden', tipo: 'number' },
      { nombre: 'descripcion', tipo: 'textarea' }
    ],
    camposTabla: ['nombre', 'orden', 'descripcion']
  },
  {
    nombre: 'Estado Factura',
    nombrePlural: 'Estados de Factura',
    icono: List,
    descripcion: 'Estados del ciclo de facturación',
    categoria: 'Catálogos',
    campos: [
      { nombre: 'nombre', tipo: 'text', requerido: true },
      { nombre: 'descripcion', tipo: 'textarea' }
    ],
    camposTabla: ['nombre', 'descripcion']
  },
  {
    nombre: 'Estado Vehículo',
    nombrePlural: 'Estados de Vehículo',
    icono: List,
    descripcion: 'Estados operativos de vehículos',
    categoria: 'Catálogos',
    campos: [
      { nombre: 'nombre', tipo: 'text', requerido: true },
    ],
    camposTabla: ['nombre']
  },
  {
    nombre: 'Estado Ruta',
    nombrePlural: 'Estados de Ruta',
    icono: List,
    descripcion: 'Estados de disponibilidad de rutas',
    categoria: 'Catálogos',
    campos: [
      { nombre: 'nombre', tipo: 'text', requerido: true },
    ],
    camposTabla: ['nombre']
  },
  {
    nombre: 'Estado Proveedor',
    nombrePlural: 'Estados de Proveedor',
    icono: List,
    descripcion: 'Estados de relación con proveedores',
    categoria: 'Catálogos',
    campos: [
      { nombre: 'nombre', tipo: 'text', requerido: true },
      { nombre: 'descripcion', tipo: 'textarea' }
    ],
    camposTabla: ['nombre', 'descripcion']
  },
  {
    nombre: 'Estado Venta',
    nombrePlural: 'Estados de Venta',
    icono: List,
    descripcion: 'Estados del proceso de venta',
    categoria: 'Catálogos',
    campos: [
      { nombre: 'nombre', tipo: 'text', requerido: true },
      { nombre: 'orden', tipo: 'number' },
      { nombre: 'descripcion', tipo: 'textarea' }
    ],
    camposTabla: ['nombre', 'orden', 'descripcion']
  },
  {
    nombre: 'Estado Mantenimiento',
    nombrePlural: 'Estados de Mantenimiento',
    icono: List,
    descripcion: 'Estados de mantenimiento vehicular',
    categoria: 'Catálogos',
    campos: [
      { nombre: 'nombre', tipo: 'text', requerido: true },
      { nombre: 'descripcion', tipo: 'textarea' },
      { nombre: 'prioridad', tipo: 'select', opciones: [
        { valor: 'Baja', etiqueta: 'Baja' },
        { valor: 'Media', etiqueta: 'Media' },
        { valor: 'Alta', etiqueta: 'Alta' }
      ]}
    ],
    camposTabla: ['nombre', 'prioridad', 'descripcion']
  },
  {
    nombre: 'Modalidad',
    nombrePlural: 'Modalidades',
    icono: List,
    descripcion: 'Modalidades de transporte (FTL, LTL, etc.)',
    categoria: 'Catálogos',
    campos: [
      { nombre: 'nombre', tipo: 'text', requerido: true },
      { nombre: 'codigo', tipo: 'text' },
      { nombre: 'descripcion', tipo: 'textarea' }
    ],
    camposTabla: ['codigo', 'nombre', 'descripcion']
  },
  {
    nombre: 'Tipo de Vehículo',
    nombrePlural: 'Tipos de Vehículo',
    icono: Truck,
    descripcion: 'Clasificación de vehículos',
    categoria: 'Catálogos',
    campos: [
      { nombre: 'nombre', tipo: 'text', requerido: true },
      { nombre: 'capacidad', tipo: 'number' },
      { nombre: 'unidad', tipo: 'select', opciones: [
        { valor: 'kg', etiqueta: 'Kilogramos' },
        { valor: 'm3', etiqueta: 'Metros cúbicos' }
      ]}
    ],
    camposTabla: ['nombre', 'capacidad', 'unidad']
  },
  {
    nombre: 'Frecuencia Ruta',
    nombrePlural: 'Frecuencias de Ruta',
    icono: Calendar,
    descripcion: 'Frecuencia de operación de rutas',
    categoria: 'Catálogos',
    campos: [
      { nombre: 'nombre', tipo: 'text', requerido: true },
      { nombre: 'dias', tipo: 'number' },
      { nombre: 'descripcion', tipo: 'textarea' }
    ],
    camposTabla: ['nombre', 'dias', 'descripcion']
  },
  {
    nombre: 'Incoterm',
    nombrePlural: 'Incoterms',
    icono: FileText,
    descripcion: 'Términos de comercio internacional',
    categoria: 'Catálogos',
    campos: [
      { nombre: 'codigo', tipo: 'text', requerido: true },
      { nombre: 'nombre', tipo: 'text', requerido: true },
      { nombre: 'descripcion', tipo: 'textarea' }
    ],
    camposTabla: ['codigo', 'nombre', 'descripcion']
  },
  {
    nombre: 'Forma de Pago',
    nombrePlural: 'Formas de Pago',
    icono: CreditCard,
    descripcion: 'Métodos de pago disponibles',
    categoria: 'Catálogos',
    campos: [
      { nombre: 'nombre', tipo: 'text', requerido: true },
      { nombre: 'codigo', tipo: 'text' },
      { nombre: 'requiereReferencia', tipo: 'select', opciones: [
        { valor: 'Sí', etiqueta: 'Sí' },
        { valor: 'No', etiqueta: 'No' }
      ]}
    ],
    camposTabla: ['codigo', 'nombre', 'requiereReferencia']
  },
  {
    nombre: 'Tipo Depósito',
    nombrePlural: 'Tipos de Depósito',
    icono: Archive,
    descripcion: 'Clasificación de depósitos',
    categoria: 'Catálogos',
    campos: [
      { nombre: 'nombre', tipo: 'text', requerido: true },
      { nombre: 'capacidadMinima', tipo: 'number' },
      { nombre: 'capacidadMaxima', tipo: 'number' },
      { nombre: 'descripcion', tipo: 'textarea' }
    ],
    camposTabla: ['nombre', 'capacidadMinima', 'capacidadMaxima']
  },

  // === SEGURIDAD ===
  {
    nombre: 'Usuario',
    nombrePlural: 'Usuarios',
    icono: Users,
    descripcion: 'Usuarios del sistema',
    categoria: 'Seguridad',
    soloAdmin: true,
    campos: [
      { nombre: 'nombre', tipo: 'text', requerido: true },
      { nombre: 'email', tipo: 'email', requerido: true },
      { nombre: 'rol', tipo: 'select', opciones: [
        { valor: 'administrador', etiqueta: 'Administrador' },
        { valor: 'colaborador', etiqueta: 'Colaborador' }
      ]},
      { nombre: 'activo', tipo: 'select', opciones: [
        { valor: 'Sí', etiqueta: 'Sí' },
        { valor: 'No', etiqueta: 'No' }
      ]}
    ],
    camposTabla: ['nombre', 'email', 'rol', 'activo']
  },
  {
    nombre: 'Rol',
    nombrePlural: 'Roles',
    icono: Shield,
    descripcion: 'Roles y permisos del sistema',
    categoria: 'Seguridad',
    soloAdmin: true,
    campos: [
      { nombre: 'nombre', tipo: 'text', requerido: true },
      { nombre: 'descripcion', tipo: 'textarea' },
      { nombre: 'permisos', tipo: 'textarea' }
    ],
    camposTabla: ['nombre', 'descripcion']
  },

  // === CLIENTES ===
  {
    nombre: 'Cliente',
    nombrePlural: 'Clientes',
    icono: Building2,
    descripcion: 'Clientes del sistema',
    categoria: 'Clientes',
    campos: [
      { nombre: 'nombre', tipo: 'text', requerido: true },
      { nombre: 'nit', tipo: 'text' },
      { nombre: 'telefono', tipo: 'tel' },
      { nombre: 'email', tipo: 'email' },
      { nombre: 'direccion', tipo: 'textarea' },
      { nombre: 'estado', tipo: 'text' }
    ],
    camposTabla: ['nombre', 'nit', 'telefono', 'email', 'estado']
  },
  {
    nombre: 'Contacto Cliente',
    nombrePlural: 'Contactos de Cliente',
    icono: Users,
    descripcion: 'Contactos de cada cliente',
    categoria: 'Clientes',
    campos: [
      { nombre: 'cliente', tipo: 'text', requerido: true },
      { nombre: 'nombre', tipo: 'text', requerido: true },
      { nombre: 'cargo', tipo: 'text' },
      { nombre: 'telefono', tipo: 'tel' },
      { nombre: 'email', tipo: 'email' }
    ],
    camposTabla: ['cliente', 'nombre', 'cargo', 'telefono', 'email']
  },
  {
    nombre: 'Cliente Operación',
    nombrePlural: 'Cliente Operación',
    icono: Building2,
    descripcion: 'Operaciones por cliente',
    categoria: 'Clientes',
    campos: [
      { nombre: 'cliente', tipo: 'text', requerido: true },
      { nombre: 'fecha', tipo: 'date', requerido: true },
      { nombre: 'tipo', tipo: 'select', opciones: [
        { valor: 'Envío', etiqueta: 'Envío' },
        { valor: 'Cotización', etiqueta: 'Cotización' },
        { valor: 'Factura', etiqueta: 'Factura' }
      ]},
      { nombre: 'monto', tipo: 'number' },
      { nombre: 'descripcion', tipo: 'textarea' }
    ],
    camposTabla: ['cliente', 'fecha', 'tipo', 'monto']
  },

  // === CRM ===
  {
    nombre: 'Oportunidad',
    nombrePlural: 'Oportunidades',
    icono: Handshake,
    descripcion: 'Oportunidades de venta',
    categoria: 'CRM',
    campos: [
      { nombre: 'cliente', tipo: 'text', requerido: true },
      { nombre: 'titulo', tipo: 'text', requerido: true },
      { nombre: 'valor', tipo: 'number' },
      { nombre: 'probabilidad', tipo: 'number' },
      { nombre: 'estado', tipo: 'select', opciones: [
        { valor: 'Prospecto', etiqueta: 'Prospecto' },
        { valor: 'Calificado', etiqueta: 'Calificado' },
        { valor: 'Propuesta', etiqueta: 'Propuesta' },
        { valor: 'Ganado', etiqueta: 'Ganado' },
        { valor: 'Perdido', etiqueta: 'Perdido' }
      ]},
      { nombre: 'fechaCierre', tipo: 'date' }
    ],
    camposTabla: ['cliente', 'titulo', 'valor', 'probabilidad', 'estado']
  },

  // === COTIZACIONES ===
  {
    nombre: 'Cotización',
    nombrePlural: 'Cotizaciones',
    icono: FileText,
    descripcion: 'Cotizaciones enviadas',
    categoria: 'Cotizaciones',
    campos: [
      { nombre: 'numero', tipo: 'text', requerido: true },
      { nombre: 'cliente', tipo: 'text', requerido: true },
      { nombre: 'fecha', tipo: 'date', requerido: true },
      { nombre: 'validez', tipo: 'date' },
      { nombre: 'total', tipo: 'number' },
      { nombre: 'estado', tipo: 'select', opciones: [
        { valor: 'Borrador', etiqueta: 'Borrador' },
        { valor: 'Enviada', etiqueta: 'Enviada' },
        { valor: 'Aceptada', etiqueta: 'Aceptada' },
        { valor: 'Rechazada', etiqueta: 'Rechazada' }
      ]}
    ],
    camposTabla: ['numero', 'cliente', 'fecha', 'total', 'estado']
  },
  {
    nombre: 'Detalle Cotización',
    nombrePlural: 'Detalles de Cotización',
    icono: FileText,
    descripcion: 'Líneas de detalle de cotizaciones',
    categoria: 'Cotizaciones',
    campos: [
      { nombre: 'cotizacion', tipo: 'text', requerido: true },
      { nombre: 'descripcion', tipo: 'text', requerido: true },
      { nombre: 'cantidad', tipo: 'number', requerido: true },
      { nombre: 'precioUnitario', tipo: 'number', requerido: true },
      { nombre: 'subtotal', tipo: 'number' }
    ],
    camposTabla: ['cotizacion', 'descripcion', 'cantidad', 'precioUnitario']
  },

  // === LOGÍSTICA ===
  {
    nombre: 'Ruta',
    nombrePlural: 'Rutas',
    icono: MapPin,
    descripcion: 'Rutas de transporte',
    categoria: 'Logística',
    campos: [
      { nombre: 'codigo', tipo: 'text', requerido: true },
      { nombre: 'origen', tipo: 'text', requerido: true },
      { nombre: 'destino', tipo: 'text', requerido: true },
      { nombre: 'distancia', tipo: 'number' },
      { nombre: 'tiempoEstimado', tipo: 'number' },
      { nombre: 'activo', tipo: 'select', opciones: [
        { valor: 'Sí', etiqueta: 'Sí' },
        { valor: 'No', etiqueta: 'No' }
      ]}
    ],
    camposTabla: ['codigo', 'origen', 'destino', 'distancia', 'tiempoEstimado']
  },
  {
    nombre: 'Vehículo',
    nombrePlural: 'Vehículos',
    icono: Truck,
    descripcion: 'Flota de vehículos',
    categoria: 'Logística',
    campos: [
      { nombre: 'placa', tipo: 'text', requerido: true },
      { nombre: 'marca', tipo: 'text' },
      { nombre: 'modelo', tipo: 'text' },
      { nombre: 'año', tipo: 'number' },
      { nombre: 'tipo', tipo: 'text' },
      { nombre: 'capacidad', tipo: 'number' },
      { nombre: 'estado', tipo: 'select', opciones: [
        { valor: 'Disponible', etiqueta: 'Disponible' },
        { valor: 'En ruta', etiqueta: 'En ruta' },
        { valor: 'Mantenimiento', etiqueta: 'Mantenimiento' },
        { valor: 'Fuera de servicio', etiqueta: 'Fuera de servicio' }
      ]}
    ],
    camposTabla: ['placa', 'marca', 'modelo', 'tipo', 'estado']
  },
  {
    nombre: 'Viaje',
    nombrePlural: 'Viajes',
    icono: Navigation,
    descripcion: 'Viajes programados y realizados',
    categoria: 'Logística',
    campos: [
      { nombre: 'codigo', tipo: 'text', requerido: true },
      { nombre: 'ruta', tipo: 'text', requerido: true },
      { nombre: 'vehiculo', tipo: 'text' },
      { nombre: 'fechaSalida', tipo: 'date', requerido: true },
      { nombre: 'fechaLlegada', tipo: 'date' },
      { nombre: 'estado', tipo: 'select', opciones: [
        { valor: 'Programado', etiqueta: 'Programado' },
        { valor: 'En curso', etiqueta: 'En curso' },
        { valor: 'Completado', etiqueta: 'Completado' },
        { valor: 'Cancelado', etiqueta: 'Cancelado' }
      ]}
    ],
    camposTabla: ['codigo', 'ruta', 'vehiculo', 'estado']
  },
  {
    nombre: 'Envío',
    nombrePlural: 'Envíos',
    icono: Package,
    descripcion: 'Envíos realizados',
    categoria: 'Logística',
    campos: [
      { nombre: 'codigo', tipo: 'text', requerido: true },
      { nombre: 'cliente', tipo: 'text', requerido: true },
      { nombre: 'ruta', tipo: 'text' },
      { nombre: 'vehiculo', tipo: 'text' },
      { nombre: 'peso', tipo: 'number' },
      { nombre: 'estado', tipo: 'text' },
      { nombre: 'fechaSalida', tipo: 'date' },
      { nombre: 'fechaEntrega', tipo: 'date' }
    ],
    camposTabla: ['codigo', 'cliente', 'ruta', 'estado', 'fechaEntrega']
  },
  {
    nombre: 'Historial Envío',
    nombrePlural: 'Historial de Envíos',
    icono: ClipboardList,
    descripcion: 'Registro histórico de envíos',
    categoria: 'Logística',
    campos: [
      { nombre: 'envio', tipo: 'text', requerido: true },
      { nombre: 'fecha', tipo: 'date', requerido: true },
      { nombre: 'accion', tipo: 'text', requerido: true },
      { nombre: 'usuario', tipo: 'text' },
      { nombre: 'observaciones', tipo: 'textarea' }
    ],
    camposTabla: ['envio', 'fecha', 'accion', 'usuario']
  },
  {
  nombre: 'Tracking Viaje',
  nombrePlural: 'Tracking de Viaje',
  icono: Navigation,
  descripcion: 'Seguimiento GPS en tiempo real de viajes',
  categoria: 'Logística',
  campos: [
    { nombre: 'viajes_id', tipo: 'number', requerido: true },
    { nombre: 'latitud', tipo: 'number', requerido: true },
    { nombre: 'longitud', tipo: 'number', requerido: true },
    { nombre: 'estado_id', tipo: 'number', requerido: true },
    { nombre: 'porcentaje', tipo: 'number' },
    { nombre: 'velocidad', tipo: 'number' },
    { nombre: 'observacion', tipo: 'textarea' },
    { nombre: 'fecha', tipo: 'date', requerido: true }
  ],
  camposTabla: ['viajes_id', 'latitud', 'longitud', 'porcentaje', 'fecha']
},
  {
    nombre: 'Alerta',
    nombrePlural: 'Alertas',
    icono: AlertCircle,
    descripcion: 'Alertas del sistema',
    categoria: 'Logística',
    campos: [
      { nombre: 'tipo', tipo: 'select', opciones: [
        { valor: 'Retraso', etiqueta: 'Retraso' },
        { valor: 'Mantenimiento', etiqueta: 'Mantenimiento' },
        { valor: 'Documento', etiqueta: 'Documento' },
        { valor: 'Crítica', etiqueta: 'Crítica' }
      ]},
      { nombre: 'titulo', tipo: 'text', requerido: true },
      { nombre: 'descripcion', tipo: 'textarea' },
      { nombre: 'prioridad', tipo: 'select', opciones: [
        { valor: 'Baja', etiqueta: 'Baja' },
        { valor: 'Media', etiqueta: 'Media' },
        { valor: 'Alta', etiqueta: 'Alta' }
      ]},
      { nombre: 'fecha', tipo: 'date' }
    ],
    camposTabla: ['tipo', 'titulo', 'prioridad', 'fecha']
  },
  {
    nombre: 'Ubicación',
    nombrePlural: 'Ubicaciones',
    icono: MapPin,
    descripcion: 'Puntos geográficos del sistema',
    categoria: 'Logística',
    campos: [
      { nombre: 'nombre', tipo: 'text', requerido: true },
      { nombre: 'direccion', tipo: 'textarea' },
      { nombre: 'ciudad', tipo: 'text' },
      { nombre: 'pais', tipo: 'text' },
      { nombre: 'latitud', tipo: 'number' },
      { nombre: 'longitud', tipo: 'number' }
    ],
    camposTabla: ['nombre', 'ciudad', 'pais']
  },
  {
    nombre: 'Depósito',
    nombrePlural: 'Depósitos',
    icono: Archive,
    descripcion: 'Almacenes y depósitos',
    categoria: 'Logística',
    campos: [
      { nombre: 'codigo', tipo: 'text', requerido: true },
      { nombre: 'nombre', tipo: 'text', requerido: true },
      { nombre: 'direccion', tipo: 'textarea' },
      { nombre: 'capacidad', tipo: 'number' },
      { nombre: 'estado', tipo: 'select', opciones: [
        { valor: 'Activo', etiqueta: 'Activo' },
        { valor: 'Inactivo', etiqueta: 'Inactivo' }
      ]}
    ],
    camposTabla: ['codigo', 'nombre', 'capacidad', 'estado']
  },

  // 🔥 NUEVAS TABLAS LOGÍSTICAS AVANZADAS
{
  nombre: 'Ruta Historial',
  nombrePlural: 'Ruta Historial',
  icono: MapPin,
  descripcion: 'Histórico de costos de rutas',
  categoria: 'Logística',
  campos: [
    { nombre: 'ruta', tipo: 'text', requerido: true },
    { nombre: 'fecha', tipo: 'date', requerido: true },
    { nombre: 'costo', tipo: 'number' }
  ],
  camposTabla: ['ruta', 'fecha', 'costo']
},
{
  nombre: 'Vehículo Asignación',
  nombrePlural: 'Vehículo Asignación',
  icono: Truck,
  descripcion: 'Asignación de vehículos a viajes',
  categoria: 'Logística',
  campos: [
    { nombre: 'vehiculo', tipo: 'text', requerido: true },
    { nombre: 'viaje', tipo: 'text', requerido: true },
    { nombre: 'fecha', tipo: 'date' }
  ],
  camposTabla: ['vehiculo', 'viaje', 'fecha']
},
{
  nombre: 'Viajes Asignaciones',
  nombrePlural: 'Viajes Asignaciones',
  icono: Navigation,
  descripcion: 'Relación entre viajes y asignaciones',
  categoria: 'Logística',
  campos: [
    { nombre: 'viaje', tipo: 'text', requerido: true },
    { nombre: 'asignacion', tipo: 'text', requerido: true }
  ],
  camposTabla: ['viaje', 'asignacion']
},
{
  nombre: 'Unidades',
  nombrePlural: 'Unidades',
  icono: Truck,
  descripcion: 'Unidades operativas',
  categoria: 'Logística',
  campos: [
    { nombre: 'codigo', tipo: 'text', requerido: true },
    { nombre: 'tipo', tipo: 'text' },
    { nombre: 'estado', tipo: 'text' }
  ],
  camposTabla: ['codigo', 'tipo', 'estado']
},
{
  nombre: 'Piloto',
  nombrePlural: 'Pilotos',
  icono: Users,
  descripcion: 'Conductores del sistema',
  categoria: 'Logística',
  campos: [
    { nombre: 'nombre', tipo: 'text', requerido: true },
    { nombre: 'licencia', tipo: 'text' },
    { nombre: 'telefono', tipo: 'tel' }
  ],
  camposTabla: ['nombre', 'licencia', 'telefono']
},
  
  // === PROVEEDORES ===
  {
    nombre: 'Proveedor',
    nombrePlural: 'Proveedores',
    icono: Factory,
    descripcion: 'Proveedores de servicios',
    categoria: 'Proveedores',
    campos: [
      { nombre: 'nombre', tipo: 'text', requerido: true },
      { nombre: 'nit', tipo: 'text' },
      { nombre: 'telefono', tipo: 'tel' },
      { nombre: 'email', tipo: 'email' },
      { nombre: 'direccion', tipo: 'textarea' },
      { nombre: 'estado', tipo: 'select', opciones: [
        { valor: 'Activo', etiqueta: 'Activo' },
        { valor: 'Inactivo', etiqueta: 'Inactivo' }
      ]}
    ],
    camposTabla: ['nombre', 'nit', 'telefono', 'email', 'estado']
  },
  {
    nombre: 'Cumplimiento Proveedor',
    nombrePlural: 'Cumplimiento de Proveedores',
    icono: Factory,
    descripcion: 'Registro de cumplimiento de proveedores',
    categoria: 'Proveedores',
    campos: [
      { nombre: 'proveedor', tipo: 'text', requerido: true },
      { nombre: 'fecha', tipo: 'date', requerido: true },
      { nombre: 'cumplimiento', tipo: 'select', opciones: [
        { valor: 'Cumplido', etiqueta: 'Cumplido' },
        { valor: 'Parcial', etiqueta: 'Parcial' },
        { valor: 'Incumplido', etiqueta: 'Incumplido' }
      ]},
      { nombre: 'observaciones', tipo: 'textarea' }
    ],
    camposTabla: ['proveedor', 'fecha', 'cumplimiento']
  },
  {
    nombre: 'Servicio Proveedor',
    nombrePlural: 'Servicios de Proveedor',
    icono: Factory,
    descripcion: 'Servicios ofrecidos por proveedores',
    categoria: 'Proveedores',
    campos: [
      { nombre: 'proveedor', tipo: 'text', requerido: true },
      { nombre: 'nombre', tipo: 'text', requerido: true },
      { nombre: 'descripcion', tipo: 'textarea' },
      { nombre: 'precioBase', tipo: 'number' }
    ],
    camposTabla: ['proveedor', 'nombre', 'precioBase']
  },
  {
    nombre: 'Desempeño Proveedor',
    nombrePlural: 'Desempeño de Proveedores',
    icono: Factory,
    descripcion: 'Evaluación de desempeño',
    categoria: 'Proveedores',
    campos: [
      { nombre: 'proveedor', tipo: 'text', requerido: true },
      { nombre: 'fecha', tipo: 'date', requerido: true },
      { nombre: 'calificacion', tipo: 'number' },
      { nombre: 'observaciones', tipo: 'textarea' }
    ],
    camposTabla: ['proveedor', 'fecha', 'calificacion']
  },
  {
    nombre: 'Pago Proveedor',
    nombrePlural: 'Pagos a Proveedores',
    icono: DollarSign,
    descripcion: 'Pagos realizados a proveedores',
    categoria: 'Proveedores',
    campos: [
      { nombre: 'proveedor', tipo: 'text', requerido: true },
      { nombre: 'fecha', tipo: 'date', requerido: true },
      { nombre: 'monto', tipo: 'number', requerido: true },
      { nombre: 'formaPago', tipo: 'text' },
      { nombre: 'referencia', tipo: 'text' }
    ],
    camposTabla: ['proveedor', 'fecha', 'monto', 'formaPago']
  },

  // === FACTURACIÓN ===
  {
    nombre: 'Factura',
    nombrePlural: 'Facturas',
    icono: FileText,
    descripcion: 'Facturas emitidas',
    categoria: 'Facturación',
    campos: [
      { nombre: 'numero', tipo: 'text', requerido: true },
      { nombre: 'cliente', tipo: 'text', requerido: true },
      { nombre: 'fecha', tipo: 'date', requerido: true },
      { nombre: 'vencimiento', tipo: 'date' },
      { nombre: 'subtotal', tipo: 'number' },
      { nombre: 'impuestos', tipo: 'number' },
      { nombre: 'total', tipo: 'number' },
      { nombre: 'estado', tipo: 'text' }
    ],
    camposTabla: ['numero', 'cliente', 'fecha', 'total', 'estado']
  },
  {
    nombre: 'Detalle Factura',
    nombrePlural: 'Detalles de Factura',
    icono: FileText,
    descripcion: 'Líneas de detalle de facturas',
    categoria: 'Facturación',
    campos: [
      { nombre: 'factura', tipo: 'text', requerido: true },
      { nombre: 'descripcion', tipo: 'text', requerido: true },
      { nombre: 'cantidad', tipo: 'number', requerido: true },
      { nombre: 'precioUnitario', tipo: 'number', requerido: true },
      { nombre: 'subtotal', tipo: 'number' }
    ],
    camposTabla: ['factura', 'descripcion', 'cantidad', 'precioUnitario']
  },
  {
    nombre: 'Pago',
    nombrePlural: 'Pagos',
    icono: DollarSign,
    descripcion: 'Pagos recibidos',
    categoria: 'Facturación',
    campos: [
      { nombre: 'factura', tipo: 'text', requerido: true },
      { nombre: 'fecha', tipo: 'date', requerido: true },
      { nombre: 'monto', tipo: 'number', requerido: true },
      { nombre: 'formaPago', tipo: 'text' },
      { nombre: 'referencia', tipo: 'text' }
    ],
    camposTabla: ['factura', 'fecha', 'monto', 'formaPago']
  },

  // === OPERACIONES ===
  {
    nombre: 'Asignación',
    nombrePlural: 'Asignaciones',
    icono: ClipboardList,
    descripcion: 'Asignaciones de recursos',
    categoria: 'Operaciones',
    campos: [
      { nombre: 'codigo', tipo: 'text', requerido: true },
      { nombre: 'vehiculo', tipo: 'text' },
      { nombre: 'ruta', tipo: 'text' },
      { nombre: 'fecha', tipo: 'date', requerido: true },
      { nombre: 'estado', tipo: 'select', opciones: [
        { valor: 'Programado', etiqueta: 'Programado' },
        { valor: 'En proceso', etiqueta: 'En proceso' },
        { valor: 'Completado', etiqueta: 'Completado' }
      ]}
    ],
    camposTabla: ['codigo', 'vehiculo', 'ruta', 'fecha', 'estado']
  },
  {
    nombre: 'Costo Asignación',
    nombrePlural: 'Costos de Asignación',
    icono: DollarSign,
    descripcion: 'Costos operativos de asignaciones',
    categoria: 'Operaciones',
    campos: [
      { nombre: 'asignacion', tipo: 'text', requerido: true },
      { nombre: 'concepto', tipo: 'text', requerido: true },
      { nombre: 'monto', tipo: 'number', requerido: true },
      { nombre: 'fecha', tipo: 'date' },
      { nombre: 'observaciones', tipo: 'textarea' }
    ],
    camposTabla: ['asignacion', 'concepto', 'monto', 'fecha']
  },

  // === AUDITORÍA ===
  {
    nombre: 'Auditoría',
    nombrePlural: 'Auditoría',
    icono: ClipboardList,
    descripcion: 'Registro de auditoría del sistema',
    categoria: 'Auditoría',
    soloAdmin: true,
    campos: [
      { nombre: 'fecha', tipo: 'date', requerido: true },
      { nombre: 'usuario', tipo: 'text', requerido: true },
      { nombre: 'accion', tipo: 'text', requerido: true },
      { nombre: 'tabla', tipo: 'text' },
      { nombre: 'registro', tipo: 'text' },
      { nombre: 'detalles', tipo: 'textarea' }
    ],
    camposTabla: ['fecha', 'usuario', 'accion', 'tabla']
  },

  // === MANTENIMIENTO ===
{
  nombre: 'Mantenimiento',
  nombrePlural: 'Mantenimientos',
  icono: Wrench,
  descripcion: 'Mantenimiento de vehículos',
  categoria: 'Mantenimiento',

  campos: [
    {
      nombre: 'vehiculo_id',
      tipo: 'select',
      requerido: true,
      relacionCon: 'Vehículos' // 🔥 AQUÍ está la clave
    },
    {
      nombre: 'tipo',
      tipo: 'select',
      opciones: [
        { valor: 'Preventivo', etiqueta: 'Preventivo' },
        { valor: 'Correctivo', etiqueta: 'Correctivo' },
        { valor: 'Inspección', etiqueta: 'Inspección' }
      ]
    },
    {
      nombre: 'fecha',
      tipo: 'date',
      requerido: true
    },
    {
      nombre: 'proximo',
      tipo: 'date'
    },
    {
      nombre: 'descripcion',
      tipo: 'textarea'
    },
    {
      nombre: 'costo',
      tipo: 'number'
    },
    {
      nombre: 'estado_id',
      tipo: 'select',
      requerido: true,
      relacionCon: 'Estados de Mantenimiento'
    },
    {
      nombre: 'prioridad',
      tipo: 'select',
      opciones: [
        { valor: 'Baja', etiqueta: 'Baja' },
        { valor: 'Media', etiqueta: 'Media' },
        { valor: 'Alta', etiqueta: 'Alta' }
      ]
    }
  ],

  camposTabla: [
    'vehiculo_id',
    'tipo',
    'fecha',
    'proximo',
    'estado_id',
    'prioridad'
  ]
} ];

export const categorias = [
  { nombre: 'Catálogos', icono: List, color: 'blue' },
  { nombre: 'Seguridad', icono: Shield, color: 'red' },
  { nombre: 'Clientes', icono: Building2, color: 'green' },
  { nombre: 'CRM', icono: Handshake, color: 'purple' },
  { nombre: 'Cotizaciones', icono: FileText, color: 'orange' },
  { nombre: 'Logística', icono: Truck, color: 'blue' },
  { nombre: 'Proveedores', icono: Factory, color: 'gray' },
  { nombre: 'Facturación', icono: DollarSign, color: 'green' },
  { nombre: 'Operaciones', icono: ClipboardList, color: 'indigo' },
  { nombre: 'Auditoría', icono: ClipboardList, color: 'red' },
  { nombre: 'Mantenimiento', icono: Wrench, color: 'orange' }
];
