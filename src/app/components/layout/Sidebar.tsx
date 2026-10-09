import { useEffect, useState } from "react";
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
  Target,
  Building2,
  ClipboardList,
  PackageOpen,
  Route,
  Globe2,
  MapPinned,
  UserRound,
  X,
} from "lucide-react";
import { cn } from "../../utils/cn";
import { useAuth } from "../../context/AuthContext";
import { canAccessModule } from "../../utils/permissions";

export function Sidebar({ isOpen = false, onClose }: any) {
  const location = useLocation();
  const { role, permissions, sessionReady, logout } = useAuth();

  const params = new URLSearchParams(location.search);
  const tabActual = String(params.get("tab") || "").toLowerCase();

  const [openCRM, setOpenCRM] = useState(
    location.pathname === "/crm"
  );

  const [openOperaciones, setOpenOperaciones] = useState(
    location.pathname === "/operaciones"
  );

  const [openLogistica, setOpenLogistica] = useState(
    location.pathname === "/logistica" ||
      location.pathname === "/flota" ||
      location.pathname === "/rutas"
  );

  const [openRecursos, setOpenRecursos] = useState(
    location.pathname === "/proveedores" || location.pathname === "/flota" || location.pathname === "/pilotos" || (location.pathname === "/crm" && tabActual === "proveedores")
  );

  const puedeModulo = (module: Parameters<typeof canAccessModule>[1]) =>
    sessionReady && canAccessModule(role, module, permissions);

  const puedeGrupoLogistica =
    puedeModulo("logistica") || puedeModulo("flota") || puedeModulo("rutas");

  const puedeGrupoRecursos = puedeModulo("proveedores") || puedeModulo("flota") || puedeModulo("pilotos");

  const cerrarEnMovil = () => {
    if (onClose) onClose();
  };

  useEffect(() => {
    if (location.pathname === "/crm") {
      setOpenCRM(true);
    }

    if (location.pathname === "/operaciones") {
      setOpenOperaciones(true);
    }

    if (location.pathname === "/logistica" || location.pathname === "/rutas") {
      setOpenLogistica(true);
    }

    if (location.pathname === "/proveedores" || location.pathname === "/flota" || location.pathname === "/pilotos" || (location.pathname === "/crm" && tabActual === "proveedores")) {
      setOpenRecursos(true);
    }
  }, [location.pathname, tabActual]);

  const menuClass = (path: string) =>
    cn(
      "flex items-center gap-3 px-5 py-3 text-sm font-semibold transition-colors border-r-4",
      location.pathname === path
        ? "bg-white/15 text-white border-[#FF6A00]"
        : "text-blue-100 border-transparent hover:bg-white/10 hover:text-white"
    );

  const parentButtonClass = (active: boolean) =>
    cn(
      "w-full flex items-center justify-between px-5 py-3 text-sm font-semibold transition-colors border-r-4",
      active
        ? "bg-white/15 text-white border-[#FF6A00]"
        : "text-blue-100 border-transparent hover:bg-white/10 hover:text-white"
    );

  const submenuClass = (
    path: string,
    tab?: string
  ) => {
    const tabEfectivo =
      location.pathname === "/crm" && !tabActual
        ? "oportunidades"
        : tabActual;

    const activo =
      location.pathname === path &&
      (tab ? tabEfectivo === tab : !tabEfectivo);

    return cn(
      "flex items-center gap-2 pl-12 pr-4 py-2.5 text-sm transition-colors border-r-4",
      activo
        ? "bg-white/15 text-white font-bold border-[#FF6A00]"
        : "text-blue-100 border-transparent hover:bg-white/10 hover:text-white"
    );
  };

  return (
    <aside
      aria-label="Menú principal"
      className={cn(
        "gl365-sidebar w-52 bg-gradient-to-b from-[#0C2D6B] to-[#081F4A] h-screen h-[100dvh] flex flex-col fixed left-0 top-0 z-50 transition-transform duration-300",
        isOpen
          ? "translate-x-0"
          : "-translate-x-full lg:translate-x-0"
      )}
    >
      {/* LOGO */}
      <div className="shrink-0 flex items-center justify-between px-5 py-5 border-b border-[#143C8C]">
        <h1 className="text-white text-xl font-bold leading-tight">
          GL365 ERP
        </h1>
        <button type="button" onClick={onClose} aria-label="Cerrar menú" className="lg:hidden flex h-11 w-11 items-center justify-center rounded-lg text-white hover:bg-white/10"><X className="h-5 w-5" /></button>
      </div>

      {/* NAV */}
      <nav className="min-h-0 flex-1 overflow-y-auto py-4">
        <Link
          to="/dashboard"
          onClick={cerrarEnMovil}
          className={menuClass("/dashboard")}
        >
          <Home className="w-5 h-5 text-blue-200 shrink-0" />
          <span className="truncate">Inicio</span>
        </Link>

        {/* CRM Y VENTAS */}
        {puedeModulo("crm") && (
          <>
            <button
              type="button"
              onClick={() => setOpenCRM(!openCRM)}
              className={parentButtonClass(
                location.pathname === "/crm"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Users className="w-5 h-5 text-blue-200 shrink-0" />
                <span className="truncate">
                  CRM y Ventas
                </span>
              </div>

              <ChevronDown
                className={cn(
                  "w-4 h-4 text-blue-200 transition-transform",
                  openCRM && "rotate-180"
                )}
              />
            </button>

            {openCRM && (
              <div className="flex flex-col">
                <Link
                  to="/crm?tab=oportunidades"
                  onClick={cerrarEnMovil}
                  className={submenuClass(
                    "/crm",
                    "oportunidades"
                  )}
                >
                  <Target className="w-4 h-4 shrink-0" />
                  <span>Oportunidades</span>
                </Link>

                <Link
                  to="/crm?tab=clientes"
                  onClick={cerrarEnMovil}
                  className={submenuClass(
                    "/crm",
                    "clientes"
                  )}
                >
                  <Building2 className="w-4 h-4 shrink-0" />
                  <span>Clientes</span>
                </Link>

                <Link
                  to="/crm?tab=cotizaciones"
                  onClick={cerrarEnMovil}
                  className={submenuClass(
                    "/crm",
                    "cotizaciones"
                  )}
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <span>Cotizaciones</span>
                </Link>

              </div>
            )}
          </>
        )}

        {/* OPERACIONES */}
        {puedeModulo("operaciones") && (
          <>
            <button
              type="button"
              onClick={() =>
                setOpenOperaciones(!openOperaciones)
              }
              className={parentButtonClass(
                location.pathname === "/operaciones"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <ShoppingCart className="w-5 h-5 text-blue-200 shrink-0" />
                <span className="truncate">
                  Operaciones
                </span>
              </div>

              <ChevronDown
                className={cn(
                  "w-4 h-4 text-blue-200 transition-transform",
                  openOperaciones && "rotate-180"
                )}
              />
            </button>

            {openOperaciones && (
              <div className="flex flex-col">
                <Link
                  to="/operaciones?tab=local"
                  onClick={cerrarEnMovil}
                  className={submenuClass(
                    "/operaciones",
                    "local"
                  )}
                >
                  <Truck className="w-4 h-4 shrink-0" />
                  <span>Local</span>
                </Link>

                <Link
                  to="/operaciones?tab=fiduca"
                  onClick={cerrarEnMovil}
                  className={submenuClass(
                    "/operaciones",
                    "fiduca"
                  )}
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <span>FYDUCA</span>
                </Link>

                <Link
                  to="/operaciones?tab=centroamerica"
                  onClick={cerrarEnMovil}
                  className={submenuClass(
                    "/operaciones",
                    "centroamerica"
                  )}
                >
                  <MapPinned className="w-4 h-4 shrink-0" />
                  <span>Centroamérica</span>
                </Link>

                <Link
                  to="/operaciones?tab=internacional"
                  onClick={cerrarEnMovil}
                  className={submenuClass(
                    "/operaciones",
                    "internacional"
                  )}
                >
                  <Globe2 className="w-4 h-4 shrink-0" />
                  <span>Internacional</span>
                </Link>
              </div>
            )}
          </>
        )}

        {/* PRICING: Proveedores, Flota y Pilotos */}
        {puedeGrupoRecursos && (
          <>
            <button
              type="button"
              onClick={() => setOpenRecursos(!openRecursos)}
              className={parentButtonClass(
                location.pathname === "/proveedores" ||
                location.pathname === "/flota" ||
                location.pathname === "/pilotos"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <PackageOpen className="w-5 h-5 text-blue-200 shrink-0" />
                <span className="truncate">Pricing</span>
              </div>
              <ChevronDown className={cn("w-4 h-4 text-blue-200 transition-transform", openRecursos && "rotate-180")} />
            </button>

            {openRecursos && (
              <div className="flex flex-col">
                {puedeModulo("proveedores") && (
                  <Link to="/proveedores" onClick={cerrarEnMovil} className={submenuClass("/proveedores")}>
                    <Building2 className="w-4 h-4 shrink-0"/><span>Proveedores</span>
                  </Link>
                )}
                {puedeModulo("flota") && (
                  <Link to="/flota" onClick={cerrarEnMovil} className={submenuClass("/flota")}>
                    <Truck className="w-4 h-4 shrink-0"/><span>Flota</span>
                  </Link>
                )}
                {puedeModulo("pilotos") && (
                  <Link to="/pilotos" onClick={cerrarEnMovil} className={submenuClass("/pilotos")}>
                    <UserRound className="w-4 h-4 shrink-0"/><span>Pilotos</span>
                  </Link>
                )}
              </div>
            )}
          </>
        )}

        {/* LOGÍSTICA */}
        {puedeGrupoLogistica && (
          <>
            <button
              type="button"
              onClick={() =>
                setOpenLogistica(!openLogistica)
              }
              className={parentButtonClass(
                location.pathname === "/logistica" ||
                  location.pathname === "/rutas"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Truck className="w-5 h-5 text-blue-200 shrink-0" />
                <span className="truncate">
                  Logística
                </span>
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
                {puedeModulo("logistica") && (
                  <Link
                    to="/logistica"
                    onClick={cerrarEnMovil}
                    className={submenuClass("/logistica")}
                  >
                    <Truck className="w-4 h-4 shrink-0" />
                    <span>Gestión</span>
                  </Link>
                )}


                {puedeModulo("rutas") && (
                  <Link
                    to="/rutas"
                    onClick={cerrarEnMovil}
                    className={submenuClass("/rutas")}
                  >
                    <Route className="w-4 h-4 shrink-0" />
                    <span>Rutas</span>
                  </Link>
                )}
              </div>
            )}
          </>
        )}

        {/* COMPROBANTES */}
        {puedeModulo("facturacion") && (
          <Link
            to="/facturacion"
            onClick={cerrarEnMovil}
            className={menuClass("/facturacion")}
          >
            <FileText className="w-5 h-5 text-blue-200 shrink-0" />
            <span className="truncate">
              Comprobantes
            </span>
          </Link>
        )}

        {/* REPORTES */}
        {puedeModulo("reportes") && (
          <Link
            to="/reportes"
            onClick={cerrarEnMovil}
            className={menuClass("/reportes")}
          >
            <BarChart3 className="w-5 h-5 text-blue-200 shrink-0" />
            <span className="truncate">
              Reportes
            </span>
          </Link>
        )}

        {/* IA */}
        {puedeModulo("ia") && (
          <Link
            to="/ia"
            onClick={cerrarEnMovil}
            className={cn(
              menuClass("/ia"),
              "notranslate"
            )}
            translate="no"
          >
            <Brain className="w-5 h-5 text-blue-200 shrink-0" />
            <span
              className="truncate notranslate"
              translate="no"
            >
              IA
            </span>
          </Link>
        )}

        {/* MANTENIMIENTO */}
        {puedeModulo("mantenimiento") && (
          <Link
            to="/mantenimiento"
            onClick={cerrarEnMovil}
            className={menuClass("/mantenimiento")}
          >
            <Settings className="w-5 h-5 text-blue-200 shrink-0" />
            <span className="truncate">
              Mantenimiento
            </span>
          </Link>
        )}
      </nav>

      {/* LOGOUT */}
      <div className="shrink-0 p-4 border-t border-[#143C8C] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={async () => {
            await (window as any).gl365AuditLogout?.();
            logout();
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
