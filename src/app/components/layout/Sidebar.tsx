import { Link, useLocation } from "react-router";
import {
  Home,
  Users,
  ShoppingCart,
  FileText,
  Truck,
  BarChart3,
  Settings,
  LogOut,
  Brain,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { cn } from "../../utils/cn";
import { useAuth } from "../../context/AuthContext";

export function Sidebar({ isOpen = false, onClose }: any) {
  const location = useLocation();
  const { role } = useAuth();

  const [openLogistica, setOpenLogistica] = useState(true);

  const puede = (roles: string[]) => roles.includes(role);

  const cerrarEnMovil = () => {
    if (onClose) onClose();
  };

  const menuClass = (path: string) =>
    cn(
      "flex items-center gap-3 px-5 py-3 text-sm font-semibold transition-colors border-r-4",
      location.pathname === path
        ? "bg-white/15 text-white border-[#FF6A00]"
        : "text-blue-100 border-transparent hover:bg-white/10 hover:text-white"
    );

  const submenuClass = (path: string) =>
    cn(
      "pl-12 pr-5 py-2.5 text-sm transition-colors border-r-4",
      location.pathname === path
        ? "bg-white/15 text-white font-bold border-[#FF6A00]"
        : "text-blue-100 border-transparent hover:bg-white/10 hover:text-white"
    );

  return (
    <aside
      className={cn(
        "w-52 bg-gradient-to-b from-[#0C2D6B] to-[#081F4A] h-screen flex flex-col fixed left-0 top-0 z-50 transition-transform duration-300",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
    >
      {/* LOGO */}
      <div className="px-5 py-5 border-b border-[#143C8C]">
        <h1 className="text-white text-xl font-bold leading-tight">
          GL365 ERP
        </h1>
      </div>

      {/* NAV */}
      <nav className="flex-1 overflow-y-auto py-4">
        <Link to="/dashboard" onClick={cerrarEnMovil} className={menuClass("/dashboard")}>
          <Home className="w-5 h-5 text-blue-200 shrink-0" />
          <span className="truncate">Inicio</span>
        </Link>

        {puede(["gerencia", "ventas"]) && (
          <Link to="/crm" onClick={cerrarEnMovil} className={menuClass("/crm")}>
            <Users className="w-5 h-5 text-blue-200 shrink-0" />
            <span className="truncate">CRM y Ventas</span>
          </Link>
        )}

        {puede(["gerencia", "operaciones", "compras"]) && (
          <Link
            to="/operaciones"
            onClick={cerrarEnMovil}
            className={menuClass("/operaciones")}
          >
            <ShoppingCart className="w-5 h-5 text-blue-200 shrink-0" />
            <span className="truncate">Operaciones</span>
          </Link>
        )}

        {puede(["gerencia", "logistica", "mensajeria"]) && (
          <>
            <button
              type="button"
              onClick={() => setOpenLogistica(!openLogistica)}
              className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-blue-100 hover:bg-white/10 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Truck className="w-5 h-5 text-blue-200 shrink-0" />
                <span className="truncate">Logística</span>
              </div>

              <ChevronDown
                className={cn(
                  "w-4 h-4 text-blue-200 transition-transform",
                  openLogistica && "rotate-180"
                )}
              />
            </button>

            {openLogistica && (
              <div className="flex flex-col">
                <Link
                  to="/logistica"
                  onClick={cerrarEnMovil}
                  className={submenuClass("/logistica")}
                >
                  Gestión
                </Link>

                {puede(["gerencia", "logistica"]) && (
                  <>
                    <Link
                      to="/flota"
                      onClick={cerrarEnMovil}
                      className={submenuClass("/flota")}
                    >
                      Flota
                    </Link>

                    <Link
                      to="/rutas"
                      onClick={cerrarEnMovil}
                      className={submenuClass("/rutas")}
                    >
                      Rutas
                    </Link>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {puede(["gerencia", "facturacion", "finanzas"]) && (
          <Link
            to="/facturacion"
            onClick={cerrarEnMovil}
            className={menuClass("/facturacion")}
          >
            <FileText className="w-5 h-5 text-blue-200 shrink-0" />
            <span className="truncate">Comprobantes</span>
          </Link>
        )}

        {puede(["gerencia", "facturacion", "finanzas", "ventas", "operaciones", "compras", "logistica"]) && (
          <Link
            to="/reportes"
            onClick={cerrarEnMovil}
            className={menuClass("/reportes")}
          >
            <BarChart3 className="w-5 h-5 text-blue-200 shrink-0" />
            <span className="truncate">Reportes</span>
          </Link>
        )}

        {puede(["gerencia", "facturacion", "finanzas", "ventas", "operaciones", "compras", "logistica"]) && (
          <Link
            to="/ia"
            onClick={cerrarEnMovil}
            className={cn(menuClass("/ia"), "notranslate")}
            translate="no"
          >
            <Brain className="w-5 h-5 text-blue-200 shrink-0" />
            <span className="truncate notranslate" translate="no">
              IA
            </span>
          </Link>
        )}

        {puede(["gerencia"]) && (
          <Link
            to="/mantenimiento"
            onClick={cerrarEnMovil}
            className={menuClass("/mantenimiento")}
          >
            <Settings className="w-5 h-5 text-blue-200 shrink-0" />
            <span className="truncate">Mantenimiento</span>
          </Link>
        )}
      </nav>

      {/* LOGOUT */}
<div className="p-4 border-t border-[#143C8C]">
  <button
    type="button"
    onClick={async () => {
      await (window as any).gl365AuditLogout?.();

      localStorage.removeItem("user");
      window.location.href = "/login";
    }}
    className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-semibold text-blue-100 hover:bg-white/10 hover:text-white transition-colors"
  >
    <LogOut className="w-5 h-5 text-blue-200 shrink-0" />
    <span>Salir</span>
  </button>
</div>
    </aside>
  );
}