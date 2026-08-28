import React from "react";
import { createBrowserRouter, Navigate, useLocation } from "react-router";
import { useAuth } from "./context/AuthContext";

// Páginas
import Login from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { CRM } from "./pages/CRM";
import { Operaciones } from "./pages/Operaciones";
import { Logistica } from "./pages/Logistica";
import { Facturacion } from "./pages/Facturacion";
import { Flota } from "./pages/Flota";
import { Rutas } from "./pages/Rutas";
import { Reportes } from "./pages/Reportes";
import { IALogistica } from "./pages/IALogistica";
import { Mantenimiento } from "./pages/Mantenimiento";

// Layout
import { MainLayout } from "./components/layout/MainLayout";

/* ===============================
   PANTALLA DE CARGA BONITA
================================ */
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F3F4F6]">
      <div className="bg-white rounded-xl shadow px-8 py-6 text-center">
        <div className="w-10 h-10 border-4 border-[#0C2D6B] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-[#0C2D6B] font-bold">Cargando sistema...</p>
      </div>
    </div>
  );
}

/* ===============================
   OBTENER SESIÓN GUARDADA
================================ */
function obtenerUsuarioLocal() {
  try {
    const user = localStorage.getItem("user");

    if (!user) return null;

    return JSON.parse(user);
  } catch {
    localStorage.removeItem("user");
    return null;
  }
}

/* ===============================
   PROTECCIÓN DE RUTAS
================================ */
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  const location = useLocation();

  const usuarioLocal = obtenerUsuarioLocal();
  const roleFinal = role || usuarioLocal?.role || "";

  /*
    Antes se quedaba en Cargando... porque role podía quedar en null.
    Ahora, si existe sesión en localStorage, deja pasar al usuario.
  */
  if (!roleFinal) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

/* ===============================
   RUTAS DEL SISTEMA
================================ */
export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/login" replace />,
  },

  {
    path: "/login",
    element: <Login />,
  },

  {
    path: "/dashboard",
    element: (
      <PrivateRoute>
        <MainLayout
          title="Panel de Control"
          breadcrumbs={["Inicio", "Panel de Control"]}
        />
      </PrivateRoute>
    ),
    children: [{ index: true, element: <Dashboard /> }],
  },

  {
    path: "/crm",
    element: (
      <PrivateRoute>
        <MainLayout
          title="CRM y Ventas"
          breadcrumbs={["Inicio", "CRM y Ventas"]}
        />
      </PrivateRoute>
    ),
    children: [{ index: true, element: <CRM /> }],
  },

  {
    path: "/operaciones",
    element: (
      <PrivateRoute>
        <MainLayout
          title="Operaciones"
          breadcrumbs={["Inicio", "Operaciones"]}
        />
      </PrivateRoute>
    ),
    children: [{ index: true, element: <Operaciones /> }],
  },

  {
    path: "/logistica",
    element: (
      <PrivateRoute>
        <MainLayout
          title="Logística"
          breadcrumbs={["Inicio", "Logística"]}
        />
      </PrivateRoute>
    ),
    children: [{ index: true, element: <Logistica /> }],
  },

  {
    path: "/facturacion",
    element: (
      <PrivateRoute>
        <MainLayout
          title="Comprobantes"
          breadcrumbs={["Inicio", "Comprobantes"]}
        />
      </PrivateRoute>
    ),
    children: [{ index: true, element: <Facturacion /> }],
  },

  {
    path: "/flota",
    element: (
      <PrivateRoute>
        <MainLayout title="Flota" breadcrumbs={["Inicio", "Flota"]} />
      </PrivateRoute>
    ),
    children: [{ index: true, element: <Flota /> }],
  },

  {
    path: "/rutas",
    element: (
      <PrivateRoute>
        <MainLayout title="Rutas" breadcrumbs={["Inicio", "Rutas"]} />
      </PrivateRoute>
    ),
    children: [{ index: true, element: <Rutas /> }],
  },

  {
    path: "/reportes",
    element: (
      <PrivateRoute>
        <MainLayout
          title="Reportes"
          breadcrumbs={["Inicio", "Reportes"]}
        />
      </PrivateRoute>
    ),
    children: [{ index: true, element: <Reportes /> }],
  },

  {
    path: "/ia",
    element: (
      <PrivateRoute>
        <MainLayout
          title="IA Logística"
          breadcrumbs={["Inicio", "IA Logística"]}
        />
      </PrivateRoute>
    ),
    children: [{ index: true, element: <IALogistica /> }],
  },

  {
    path: "/mantenimiento",
    element: (
      <PrivateRoute>
        <MainLayout
          title="Mantenimiento"
          breadcrumbs={["Inicio", "Mantenimiento"]}
        />
      </PrivateRoute>
    ),
    children: [{ index: true, element: <Mantenimiento /> }],
  },

  {
    path: "*",
    element: <Navigate to="/dashboard" replace />,
  },
]);