import { useState } from "react";
import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router";

import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useAuth } from "../../context/AuthContext";

interface MainLayoutProps {
  title?: string;
  breadcrumbs?: string[];
}

const routeRoles: Record<
  string,
  string[]
> = {
  "/dashboard": [
    "gerencia",
    "logistica",
    "ventas",
    "operaciones",
    "facturacion",
    "finanzas",
    "compras",
    "mensajeria",
  ],

  "/crm": [
    "gerencia",
    "ventas",
  ],

  "/operaciones": [
    "gerencia",
    "operaciones",
    "compras",
  ],

  "/logistica": [
    "gerencia",
    "logistica",
    "mensajeria",
  ],

  "/facturacion": [
    "gerencia",
    "facturacion",
    "finanzas",
  ],

  "/flota": [
    "gerencia",
    "logistica",
  ],

  "/rutas": [
    "gerencia",
    "logistica",
  ],

  "/reportes": [
    "gerencia",
    "logistica",
    "ventas",
    "operaciones",
    "facturacion",
    "finanzas",
    "compras",
  ],

  "/ia": [
    "gerencia",
    "logistica",
    "ventas",
    "operaciones",
    "facturacion",
    "finanzas",
    "compras",
  ],

  "/mantenimiento": [
    "gerencia",
  ],
};

const normalizeRole = (
  value: unknown
) =>
  String(value ?? "")
    .toLowerCase()
    .trim();

export function MainLayout(
  _props: MainLayoutProps
) {
  const { role } = useAuth();

  const location =
    useLocation();

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  const normalizedRole =
    normalizeRole(role);

  const currentPath =
    location.pathname;

  /*
   * Busca la ruta protegida
   * más específica.
   *
   * Esto permite:
   *
   * /crm
   * /crm/...
   * /logistica
   * /logistica/...
   *
   * sin afectar una ruta 404.
   */
  const matchedRoute =
    Object.keys(routeRoles)
      .sort(
        (a, b) =>
          b.length - a.length
      )
      .find(
        (path) =>
          currentPath === path ||
          currentPath.startsWith(
            `${path}/`
          )
      );

  const allowedRoles =
    matchedRoute
      ? routeRoles[matchedRoute]
      : null;

  if (
    allowedRoles &&
    !allowedRoles.includes(
      normalizedRole
    )
  ) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  return (
    <div
      className="
        gl365-app-shell

        flex
        min-h-screen

        bg-[#F3F4F6]
        text-slate-900

        transition-colors
        duration-200

        dark:bg-[#0B1220]
        dark:text-[#F8FAFC]
      "
    >
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() =>
          setSidebarOpen(false)
        }
      />

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Cerrar menú lateral"
          className="
            fixed
            inset-0
            z-40

            bg-black/50
            backdrop-blur-[1px]

            md:hidden
          "
          onClick={() =>
            setSidebarOpen(false)
          }
        />
      )}

      <div
        className="
          flex
          min-w-0
          flex-1
          flex-col

          md:ml-52
        "
      >
        <Header
          onMenuClick={() =>
            setSidebarOpen(true)
          }
        />

        <main
          className="
            min-w-0
            max-w-full
            flex-1

            overflow-x-hidden
            overflow-y-auto

            bg-[#F3F4F6]

            p-4

            transition-colors
            duration-200

            dark:bg-[#0B1220]

            sm:p-5
            md:p-6
          "
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}