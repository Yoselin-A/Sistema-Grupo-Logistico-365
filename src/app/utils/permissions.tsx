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
  | "mantenimiento";

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
];

export const permisosPorRol: Record<UserRole, ModuleKey[]> = {
  administrador: todosLosModulos,

  gerencia: todosLosModulos,

  finanzas: [
    "dashboard",
    "facturacion",
    "reportes",
    "ia",
  ],

  ventas: [
    "dashboard",
    "crm",
    "reportes",
    "ia",
  ],

  operaciones: [
    "dashboard",
    "operaciones",
    "reportes",
    "ia",
  ],

  logistica: [
    "dashboard",
    "logistica",
    "flota",
    "rutas",
    "reportes",
    "ia",
  ],

  facturacion: [
    "dashboard",
    "facturacion",
    "reportes",
    "ia",
  ],

  // Compatibilidad mientras existan usuarios antiguos con rol "compras".
  compras: [
    "dashboard",
    "operaciones",
    "reportes",
    "ia",
  ],

  mensajeria: ["dashboard"],
};

export function canAccessModule(
  role: UserRole | string | null | undefined,
  module: ModuleKey
) {
  if (!role) return false;

  const normalizedRole = String(role)
    .trim()
    .toLowerCase() as UserRole;

  return Boolean(
    permisosPorRol[normalizedRole]?.includes(module)
  );
}