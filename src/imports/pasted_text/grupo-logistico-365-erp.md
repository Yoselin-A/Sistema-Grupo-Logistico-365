Diseña un sistema ERP logístico profesional llamado "Grupo Logístico 365" con un estilo corporativo, moderno, limpio y empresarial.

🎯 OBJETIVO:
Crear una interfaz completa con pantalla de login y dashboard funcional, incluyendo control de roles (Administrador y Empleado), navegación lateral y módulos principales.

---

🎨 ESTILO VISUAL:
- Corporativo, sobrio, moderno (tipo SAP, Oracle, SaaS empresarial)
- Bordes redondeados (12px–16px)
- Sombras suaves
- Espaciado consistente (8px grid)
- UI limpia, internacional

---

🎨 COLORES:
- Azul oscuro principal: #0C2D6B
- Azul secundario: #143C8C
- Naranja corporativo: #FF6A00
- Fondo gris claro: #F3F4F6
- Blanco: #FFFFFF
- Texto oscuro: #111827

---

🔐 PANTALLA LOGIN:

📐 Layout:
- Frame 1440x900
- Dividido en dos columnas (50% / 50%)

🟦 LADO IZQUIERDO:
- Fondo azul oscuro (#0C2D6B)
- Contenido centrado verticalmente
- Logo real de la empresa arriba
- Texto:
  - "Grupo Logístico 365" (color naranja)
  - "Sistema de Gestión Operativa" (blanco)

🖼️ LADO DERECHO:
- Imagen de camión/logística
- Overlay azul oscuro con opacidad 70%

🧊 TARJETA LOGIN:
- Centrada
- Fondo blanco
- Border radius 16px
- Sombra suave
- Línea superior naranja (detalle corporativo)

📌 Contenido:

1. Título: "Iniciar Sesión"

2. Selector tipo tabs:
- Administrador (activo)
- Empleado (inactivo)

3. Caja de credenciales:
- Admin: admin@gl365.com / admin123
- Empleado: empleado@gl365.com / emp123

4. Input correo
5. Input contraseña

6. Botón:
- Azul oscuro
- Hover naranja (#FF6A00)

7. Mensaje de error:
- Mostrar cuando credenciales son incorrectas

8. Link:
- "¿Olvidaste tu contraseña?"

---

📊 DASHBOARD PRINCIPAL:

📐 Layout:
- Header superior
- Sidebar izquierda
- Área principal

---

🔵 HEADER:
- Fondo azul oscuro
- Logo empresa
- Usuario activo (Admin o Empleado)
- Avatar circular

---

📌 SIDEBAR (MENÚ LATERAL):

Color: azul oscuro
Iconos blancos

Menú:
- Inicio
- CRM y Ventas
- Operaciones
- Logística
- Facturación
- Envíos
- Flota
- Rutas
- Reportes
- Documentos
- Mantenimiento (solo visible para ADMIN)
- Cerrar Sesión

---

⚠️ REGLAS DE ROLES:

- Administrador:
  - Acceso completo
  - Ve "Mantenimiento"

- Empleado:
  - NO ve "Mantenimiento"

---

📊 PANEL DE CONTROL (INICIO):

Fondo: gris claro (#F3F4F6)

Título:
"Panel de Control"

---

🧩 SECCIÓN 1: MÓDULOS PRINCIPALES (cards clickeables)

- CRM y Ventas
- Operaciones
- Logística
- Facturación

Cada card:
- Fondo blanco
- Icono
- Título
- Línea inferior naranja

---

📊 SECCIÓN 2: KPIs

Cards:
- Envíos activos
- Entregas hoy
- En tránsito
- Pendientes
- Flota disponible
- Alertas

---

📋 SECCIÓN 3:

- Alertas inteligentes
- Actividad reciente

---

🚪 FUNCIONALIDAD:

- Sidebar navegable
- Click en módulos cambia vista
- "Cerrar Sesión" regresa al login
- Tabs en login cambian tipo de usuario
- Mostrar error si login falla

---

🎯 COMPONENTES:

- Botones (primary azul, hover naranja)
- Inputs con iconos
- Cards KPI
- Tablas
- Badges de estado
- Sidebar reusable
- Header reusable

---

⚡ INTERACCIONES:

- Hover en botones
- Hover en menú lateral
- Click navegación
- Transiciones suaves

---

🎯 RESULTADO FINAL:

Un sistema ERP logístico completo, con login funcional, dashboard profesional, control de roles, navegación clara y diseño corporativo listo para desarrollo real.