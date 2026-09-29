import type { UserRole } from "../context/AuthContext";

export type ModuleKey =
  | "dashboard"
  | "crm"
  | "operaciones"
  | "logistica"
  | "facturacion"
  | "flota"
  | "rutas"
  | "reportes"
  | "ia"
  | "mantenimiento"
  | "seguridad";

const todosLosModulos: ModuleKey[] = [
  "dashboard",
  "crm",
  "operaciones",
  "logistica",
  "facturacion",
  "flota",
  "rutas",
  "reportes",
  "ia",
  "mantenimiento",
  "seguridad",
];

// Compatibilidad con sesiones antiguas. Cuando el backend ya devuelve
// permissions, ese arreglo tiene prioridad y esta matriz deja de decidir.
export const permisosPorRol: Record<string, ModuleKey[]> = {
  administrador: todosLosModulos,
  gerencia: todosLosModulos,
  finanzas: ["dashboard", "facturacion", "reportes", "ia"],
  ventas: ["dashboard", "crm", "reportes", "ia"],
  operaciones: ["dashboard", "operaciones", "reportes", "ia"],
  logistica: ["dashboard", "logistica", "flota", "rutas", "reportes", "ia"],
  facturacion: ["dashboard", "facturacion", "reportes", "ia"],
  compras: ["dashboard", "operaciones", "reportes", "ia"],
  mensajeria: ["dashboard"],
};

export function canAccessModule(
  role: UserRole | string | null | undefined,
  module: ModuleKey,
  permissions: string[] | null = null
) {
  if (!role) return false;

  const normalizedRole = String(role).trim().toLowerCase();

  // Todo usuario autenticado puede entrar al Inicio.
  if (module === "dashboard") return true;

  // Evita que Gerencia quede bloqueada por una configuración accidental.
  if (["gerencia", "administrador"].includes(normalizedRole)) return true;

  // Si el backend ya entregó permisos (aunque sea []), se respetan exactamente.
  if (permissions !== null) {
    const allowed = new Set(
      permissions.map((item) => String(item || "").trim().toLowerCase())
    );

    // Seguridad vive dentro de la pantalla de Mantenimiento.
    if (module === "mantenimiento") {
      return allowed.has("mantenimiento") || allowed.has("seguridad");
    }

    return allowed.has(module);
  }

  // Fallback únicamente para sesiones previas a la migración.
  return Boolean(permisosPorRol[normalizedRole]?.includes(module));
}