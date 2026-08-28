import { useState } from "react";
import { Outlet, Navigate, useLocation } from "react-router";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useAuth } from "../../context/AuthContext";

interface MainLayoutProps {
  title?: string;
  breadcrumbs?: string[];
}

const routeRoles: Record<string, string[]> = {
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
  "/crm": ["gerencia", "ventas"],
  "/operaciones": ["gerencia", "operaciones", "compras"],
  "/logistica": ["gerencia", "logistica", "mensajeria"],
  "/facturacion": ["gerencia", "facturacion", "finanzas"],
  "/flota": ["gerencia", "logistica"],
  "/rutas": ["gerencia", "logistica"],
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
  "/mantenimiento": ["gerencia"],
};

export function MainLayout({ title, breadcrumbs }: MainLayoutProps) {
  const { role } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentPath = location.pathname;
  const allowedRoles = routeRoles[currentPath] || ["gerencia"];

  if (!allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex bg-[#F3F4F6]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col w-full md:ml-52">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 sm:p-5 md:p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
