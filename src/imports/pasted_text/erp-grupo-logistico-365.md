Mejora completamente el sistema ERP "Grupo Logístico 365" para que sea un sistema funcional profesional tipo SAP / Odoo.

---

🎯 1. CORREGIR ESTRUCTURA (PROBLEMA PRINCIPAL)

El sistema actualmente tiene el contenido centrado, lo cual hace que la barra lateral se vea flotante.

SOLUCIÓN OBLIGATORIA:

Crear layout principal:

[ SIDEBAR FIJA | CONTENIDO DINÁMICO ]

SIDEBAR:

- Posición fija (fixed)
- Pegada al borde izquierdo (left: 0)
- Altura completa (100vh)
- Ancho fijo: 240px
- Color: #0C2D6B
- SIN sombras externas
- SIN bordes redondeados externos
- NO debe verse como tarjeta

CONTENIDO:

- Debe iniciar después del sidebar
- margin-left: 240px
- width: 100%
- NO usar max-width ni centrado (NO mx-auto)

---

🎯 2. NAVEGACIÓN REAL ENTRE MÓDULOS

Los módulos deben ser completamente funcionales:

- CRM y Ventas
- Operaciones
- Logística
- Facturación

Cada uno debe abrir su propia vista dinámica (no solo UI estática)

---

🎯 3. CRUD COMPLETO EN TODOS LOS MÓDULOS

Cada módulo debe tener:

✔ Crear (Nuevo registro)
✔ Leer (Ver detalle)
✔ Actualizar (Editar)
✔ Eliminar (Con confirmación)

---

📌 CRM Y VENTAS

- Gestión de clientes
- Pipeline de ventas
- Cotizaciones

CRUD en:

- Clientes
- Cotizaciones
- Oportunidades

---

📌 OPERACIONES

- Asignación de unidades
- Control de proveedores

CRUD en:

- Asignaciones
- Proveedores

---

📌 LOGÍSTICA (MUY IMPORTANTE)

- Registro de envíos
- Rastreo
- Rutas
- Flota

CRUD en:

- Envíos
- Rutas
- Unidades
- Depósitos

---

📌 FACTURACIÓN

- Facturas
- Pagos

CRUD en:

- Facturas
- Clientes financieros

---

🎯 4. EXPORTACIÓN (MUY IMPORTANTE)

Agregar en tablas principales:

BOTONES:

- Exportar PDF
- Exportar Excel

---

📄 PDF:

- Logo arriba
- Título del reporte
- Fecha de generación
- Tabla completa
- Totales

---

📊 EXCEL:

- Exportar datos en formato tabla
- Columnas organizadas
- Compatible con Excel

---

🎯 5. MODALES FUNCIONALES

Cada acción debe abrir:

VER → Modal con detalle  
EDITAR → Formulario editable  
ELIMINAR → Confirmación  

---

🎯 6. ALERTAS INTERACTIVAS

Las alertas deben ser clickeables:

Al hacer click:

Mostrar:

- Descripción completa
- Unidad
- Ruta
- Fecha
- Estado

Acciones:

- Marcar como leída
- Marcar como resuelta
- Eliminar

---

🎯 7. FILTROS Y BÚSQUEDA

Agregar en todas las tablas:

- Buscador
- Filtros por estado
- Filtros por fecha
- Paginación

---

🎯 8. DISEÑO PROFESIONAL

Colores:

- Azul oscuro: #0C2D6B
- Azul secundario: #143C8C
- Naranja: #FF6A00
- Fondo gris claro

---

🎯 9. RESULTADO FINAL

El sistema debe parecer:

✔ Sistema real funcional  
✔ Navegación completa  
✔ Sidebar fija correctamente  
✔ CRUD completo en todos los módulos  
✔ Exportación PDF y Excel  
✔ Interacciones reales  

NO generar solo diseño estático.

Debe ser un sistema ERP realista, moderno y profesional.