import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { useAuth } from "../../context/AuthContext";

import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface MainLayoutProps {
  title?: string;
  breadcrumbs?: string[];
}

/*
 * La autorización de rutas se realiza en routes.tsx mediante PrivateRoute
 * y canAccessModule(). Antes este layout tenía una segunda lista fija de
 * roles que bloqueaba cualquier rol personalizado aunque tuviera permisos.
 */
export function MainLayout(_props: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { refreshSession } = useAuth();

  useEffect(() => {
    void refreshSession();
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onDesktop = () => { if (desktop.matches) setSidebarOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    desktop.addEventListener("change", onDesktop);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      desktop.removeEventListener("change", onDesktop);
    };
  }, [sidebarOpen]);

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
        onClose={() => setSidebarOpen(false)}
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
            lg:hidden
          "
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:ml-52">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main
          className="
            gl365-main min-w-0
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
