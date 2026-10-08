# Validación de interfaz — 8 de octubre de 2026

## Cambios
- El grupo Recursos del menú se llama Pricing; contiene Proveedores, Flota y Pilotos.
- El menú se abre como panel en teléfonos y tablets; el contenido dispone de todo el ancho hasta 1024 px.
- Formularios, tarjetas, pestañas CRM y tablas compartidas se adaptan al ancho disponible. Las tablas extensas conservan desplazamiento horizontal dentro de su contenedor.
- Las notificaciones quedan dentro de la pantalla y permiten desplazamiento interno.
- El modo oscuro mejora textos, bordes, estados, gráficas, controles y visibilidad del logo.
- Las ventanas compartidas utilizan la altura visible del dispositivo y admiten cierre con Escape.

## Comprobaciones realizadas
- Inicio de sesión con el usuario de prueba autorizado y carga de datos desde MySQL.
- Dashboard, CRM, Operaciones, Proveedores, Flota, Pilotos, Logística, Rutas, Comprobantes, Reportes, IA y Mantenimiento en 360 px: sin controles fuera del ancho visible, exceptuando tablas con desplazamiento interno.
- Revisión de los módulos en 768 px y modo claro; revisión visual de reportes en escritorio de 1440 px y modo oscuro.
- Apertura y cancelación del formulario Nuevo Comprobante en teléfono.
- Apertura de Pricing, navegación a Pilotos y cierre automático del menú.
- Panel de notificaciones a 360 px: borde inferior dentro de los 800 px de altura.
- Cierre de sesión desde el encabezado móvil: retorno a /login.
- Consola del navegador sin errores durante la revisión de módulos.
- npm run build: compilación de producción correcta. Permanece la advertencia existente por tamaño del paquete JavaScript.

Estas comprobaciones cubren navegación y presentación. No sustituyen una prueba completa de cada operación de creación, modificación y eliminación.
