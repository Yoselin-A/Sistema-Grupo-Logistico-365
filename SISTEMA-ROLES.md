# Sistema de Roles - Grupo Logístico 365

## Descripción General

El sistema ERP Grupo Logístico 365 implementa un sistema de control de acceso basado en roles que permite diferenciar las funcionalidades disponibles según el tipo de usuario.

## Roles Implementados

### 1. Administrador
- **Acceso**: Completo a todos los módulos del sistema
- **Módulos disponibles**:
  - ✅ Inicio (Dashboard)
  - ✅ CRM y Ventas
  - ✅ Operaciones y Compras
  - ✅ Logística
  - ✅ Facturación
  - ✅ Envíos
  - ✅ Flota
  - ✅ Rutas
  - ✅ Reportes
  - ✅ Documentos
  - ✅ **Mantenimiento** (exclusivo)

### 2. Empleado (Colaborador)
- **Acceso**: Limitado a módulos operativos
- **Módulos disponibles**:
  - ✅ Inicio (Dashboard)
  - ✅ CRM y Ventas
  - ✅ Operaciones y Compras
  - ✅ Logística
  - ✅ Facturación
  - ✅ Envíos
  - ✅ Flota
  - ✅ Rutas
  - ✅ Reportes
  - ✅ Documentos
  - ❌ **Mantenimiento** (no tiene acceso)

## Cómo Funciona

### Autenticación
1. El usuario accede a la pantalla de login en `/login`
2. Selecciona su rol: **Administrador** o **Empleado**
3. Ingresa credenciales (para demo: admin@gl365.com / admin123)
4. El sistema guarda el rol en el contexto global de la aplicación

### Autorización
- El **Sidebar** filtra automáticamente las opciones del menú según el rol
- El **Header** muestra el nombre del usuario y su rol
- Los empleados NO ven la opción "Mantenimiento" en el menú lateral

## Cambio de Rol (Solo Demo)

Para demostración, el Dashboard incluye un banner que permite cambiar entre roles:
- Haz clic en el botón "Cambiar a Empleado/Administrador"
- El sistema actualiza automáticamente el menú lateral
- Verifica que el módulo de Mantenimiento aparece/desaparece según el rol

## Diseño Visual

### Colores Corporativos
- **Azul Primario**: `#1E3A8A` - Usado en sidebar, títulos y elementos principales
- **Naranja Acento**: `#F97316` - Usado en indicadores activos y avatares
- **Verde**: `#22C55E` - Usado para estados positivos y éxito
- **Amarillo**: `#F59E0B` - Usado para advertencias
- **Rojo**: `#EF4444` - Usado para alertas críticas

### Componentes Clave
- **Sidebar**: Fondo azul oscuro (`#1E3A8A`) con items filtrados por rol
- **Header**: Breadcrumbs y avatar con rol del usuario
- **Dashboard**: KPIs con bordes de colores y tendencias
- **Login**: Diseño split-screen con formulario blanco y fondo azul

## Implementación Técnica

### Contexto de Autenticación
```typescript
// /src/app/context/AuthContext.tsx
export type UserRole = 'administrador' | 'empleado';
```

### Filtrado de Menú
```typescript
// /src/app/components/layout/Sidebar.tsx
const menuItems = [
  // ...
  { path: '/mantenimiento', label: 'Mantenimiento', icon: Settings, roles: ['administrador'] },
];

const filteredMenuItems = menuItems.filter(item => 
  item.roles.includes(role)
);
```

## Seguridad

⚠️ **IMPORTANTE**: Este es un sistema de demostración frontend. En producción, se debe implementar:
- Autenticación backend con JWT o similar
- Validación de permisos en el servidor
- Rutas protegidas con middleware
- Tokens de sesión seguros
- Base de datos para gestión de usuarios y roles

## Próximos Pasos

Para un sistema de producción, considerar:
1. Integrar con backend real (Supabase, Firebase, custom API)
2. Agregar más roles (Supervisor, Conductor, etc.)
3. Implementar permisos granulares por función
4. Agregar logs de auditoría
5. Sistema de recuperación de contraseña
6. Autenticación de dos factores (2FA)
