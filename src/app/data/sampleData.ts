// Datos de ejemplo iniciales para el sistema
export const datosEjemplo: Record<string, any[]> = {
  // CATÁLOGOS
  'Estados de Cliente': [
    { id: 1, nombre: 'Prospecto', descripcion: 'Cliente potencial', activo: 'Sí' },
    { id: 2, nombre: 'Activo', descripcion: 'Cliente activo', activo: 'Sí' },
    { id: 3, nombre: 'Inactivo', descripcion: 'Cliente inactivo', activo: 'No' }
  ],
  'Estados de Envío': [
    { id: 1, nombre: 'Recolección', orden: 1, descripcion: 'En proceso de recolección' },
    { id: 2, nombre: 'En ruta', orden: 2, descripcion: 'Mercancía en tránsito' },
    { id: 3, nombre: 'Entregado', orden: 4, descripcion: 'Entrega completada' }
  ],
  'Estados de Factura': [
    { id: 1, nombre: 'Pendiente', descripcion: 'Factura sin pagar' },
    { id: 2, nombre: 'Pagada', descripcion: 'Factura pagada' }
  ],
  'Estados de Vehículo': [
  { id: 1, nombre: 'Disponible', descripcion: 'Vehículo listo para operar' },
  { id: 2, nombre: 'En ruta', descripcion: 'Vehículo en operación' },
  { id: 3, nombre: 'Mantenimiento', descripcion: 'Vehículo en servicio técnico' },
  { id: 4, nombre: 'Fuera de servicio', descripcion: 'Vehículo no disponible' }
],
  'Estados de Ruta': [
  { id: 1, nombre: 'Activa', descripcion: 'Ruta disponible para operaciones' },
  { id: 2, nombre: 'Inactiva', descripcion: 'Ruta deshabilitada' },
  { id: 3, nombre: 'En mantenimiento', descripcion: 'Ruta temporalmente suspendida' }
],
'Estados de Proveedor': [
  { id: 1, nombre: 'Activo', descripcion: 'Proveedor operativo' },
  { id: 2, nombre: 'Inactivo', descripcion: 'Proveedor no disponible' },
  { id: 3, nombre: 'Suspendido', descripcion: 'Proveedor bloqueado temporalmente' }
],
'Estados de Venta': [
  { id: 1, nombre: 'Pendiente', descripcion: 'Venta en proceso' },
  { id: 2, nombre: 'Confirmada', descripcion: 'Venta aprobada' },
  { id: 3, nombre: 'Cancelada', descripcion: 'Venta anulada' }
],
'Estados de Mantenimiento': [
  { id: 1, nombre: 'Programado', descripcion: 'Mantenimiento agendado' },
  { id: 2, nombre: 'En proceso', descripcion: 'Mantenimiento en ejecución' },
  { id: 3, nombre: 'Finalizado', descripcion: 'Mantenimiento completado' }
],
'Frecuencias de Ruta': [
  { id: 1, nombre: 'Diaria', descripcion: 'Se ejecuta todos los días' },
  { id: 2, nombre: 'Semanal', descripcion: 'Se ejecuta una vez por semana' },
  { id: 3, nombre: 'Quincenal', descripcion: 'Cada 15 días' },
  { id: 4, nombre: 'Mensual', descripcion: 'Una vez al mes' }
],
  'Modalidades': [
    { id: 1, nombre: 'Full Truck Load', codigo: 'FTL', descripcion: 'Camión completo' },
    { id: 2, nombre: 'Less Than Truckload', codigo: 'LTL', descripcion: 'Carga consolidada' }
  ],
  'Tipos de Vehículo': [
    { id: 1, nombre: 'Tracto camión', capacidad: 40000, unidad: 'kg' },
    { id: 2, nombre: 'Camión 3.5 ton', capacidad: 3500, unidad: 'kg' }
  ],
  'Incoterms': [
    { id: 1, codigo: 'EXW', nombre: 'Ex Works', descripcion: 'Entrega en establecimiento' },
    { id: 2, codigo: 'FOB', nombre: 'Free On Board', descripcion: 'Libre a bordo' }
  ],
  'Formas de Pago': [
    { id: 1, nombre: 'Transferencia', codigo: 'TRANS', requiereReferencia: 'Sí' },
    { id: 2, nombre: 'Efectivo', codigo: 'EFEC', requiereReferencia: 'No' }
  ],

  // SEGURIDAD
  'Usuarios': [
    { id: 1, nombre: 'Juan Admin', email: 'admin@gl365.com', rol: 'administrador', activo: 'Sí' },
    { id: 2, nombre: 'María García', email: 'mgarcia@gl365.com', rol: 'colaborador', activo: 'Sí' }
  ],
  'Roles': [
    { id: 1, nombre: 'Administrador', descripcion: 'Acceso total', permisos: 'Todos' },
    { id: 2, nombre: 'Colaborador', descripcion: 'Acceso limitado', permisos: 'CRM, Logística' }
  ],

  // CLIENTES
  'Clientes': [
    { id: 1, nombre: 'Distribuidora ABC', nit: '12345678-9', telefono: '2234-5678', email: 'contacto@abc.com', direccion: 'Guatemala, zona 10', estado: 'Activo' },
    { id: 2, nombre: 'Logística GT', nit: '98765432-1', telefono: '2345-6789', email: 'info@logisticagt.com', direccion: 'Villa Nueva', estado: 'Activo' }
  ],

  // CRM
  'Oportunidades': [
    { id: 1, cliente: 'Distribuidora ABC', titulo: 'Contrato anual', valor: 250000, probabilidad: 75, estado: 'Propuesta', fechaCierre: '2026-05-15' }
  ],

  // COTIZACIONES
  'Cotizaciones': [
    { id: 1, numero: 'COT-001', cliente: 'Distribuidora ABC', fecha: '2026-04-15', validez: '2026-05-15', total: 45000, estado: 'Enviada' }
  ],

  // LOGÍSTICA
  'Rutas': [
    { id: 1, codigo: 'GT-SV-01', origen: 'Guatemala', destino: 'El Salvador', distancia: 285, tiempoEstimado: 5, activo: 'Sí' }
  ],
  'Vehículos': [
    { id: 1, placa: 'FL-001', marca: 'Volvo', modelo: 'FH16', año: 2022, tipo: 'Tracto camión', capacidad: 40000, estado: 'Disponible' }
  ],
  'Envíos': [
    { id: 1, codigo: 'ENV-001', cliente: 'Distribuidora ABC', ruta: 'GT-SV-01', vehiculo: 'FL-001', peso: 2500, estado: 'En ruta', fechaSalida: '2026-04-20', fechaEntrega: '2026-04-21' }
  ],
  'Alertas': [
    { id: 1, tipo: 'Retraso', titulo: 'Retraso en ruta', descripcion: 'Tráfico pesado', prioridad: 'Media', fecha: '2026-04-20' }
  ],
  'Depósitos': [
    { id: 1, codigo: 'DEP-GT-01', nombre: 'Almacén Central', direccion: 'Guatemala', capacidad: 5000, estado: 'Activo' }
  ],
  // 🔥 NUEVAS TABLAS LOGÍSTICAS

'Ruta Historial': [
  {
    id: 1,
    ruta: 'GT-SV-01',
    fecha: '2026-04-01',
    costo: 450
  },
  {
    id: 2,
    ruta: 'GT-SV-01',
    fecha: '2026-04-10',
    costo: 470
  }
],

'Vehículo Asignación': [
  {
    id: 1,
    vehiculo: 'FL-001',
    viaje: 'VIA-001',
    fecha: '2026-04-20'
  }
],

'Viajes Asignaciones': [
  {
    id: 1,
    viaje: 'VIA-001',
    asignacion: 'ASG-001'
  }
],

'Unidades': [
  {
    id: 1,
    codigo: 'UNI-001',
    tipo: 'Camión pesado',
    estado: 'Activo'
  }
],

'Pilotos': [
  {
    id: 1,
    nombre: 'Pedro Ruiz',
    licencia: 'A123456',
    telefono: '5555-5555'
  }
],

  // PROVEEDORES
  'Proveedores': [
    { id: 1, nombre: 'Combustibles del Sur', nit: '11111111-1', telefono: '2111-1111', email: 'info@combustibles.com', direccion: 'Escuintla', estado: 'Activo' }
  ],

  // FACTURACIÓN
  'Facturas': [
    { id: 1, numero: 'FAC-001', cliente: 'Distribuidora ABC', fecha: '2026-04-01', vencimiento: '2026-04-30', subtotal: 40000, impuestos: 4800, total: 44800, estado: 'Pendiente' }
  ],

  // OPERACIONES
  'Asignaciones': [
    { id: 1, codigo: 'ASG-001', vehiculo: 'FL-001', ruta: 'GT-SV-01', fecha: '2026-04-20', estado: 'En proceso' }
  ],

  // MANTENIMIENTO
'Mantenimientos': [
  {
    id: 1,
    vehiculo: 'FL-001', 
    descripcion: 'Cambio de aceite y filtros',
    fecha: '2026-04-01',
    proximo: '2026-07-01',
    estado: 'Pendiente',
    costo: 2500
  },
  {
    id: 2,
    vehiculo: 'FL-001',
    tipo: 'Correctivo',
    descripcion: 'Reparación de frenos',
    fecha: '2026-05-10',
    proximo: null,
    estado: 'En proceso',
    costo: 3200
  }
]
};
