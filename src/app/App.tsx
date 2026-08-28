import "./utils/auditoriaGlobal";
import { Component, type ReactNode } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "./context/AuthContext";

type ErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

function normalizeAuthStorage() {
  const userKeys = ["user", "gl365_user", "usuario", "gl365_usuario"];
  const tokenKeys = ["token", "gl365_token", "auth_token"];

  const savedUser = userKeys
    .map((key) => localStorage.getItem(key))
    .find((value) => value && value !== "undefined" && value !== "null");

  const savedToken = tokenKeys
    .map((key) => localStorage.getItem(key))
    .find((value) => value && value !== "undefined" && value !== "null");

  if (savedUser) {
    try {
      const parsedUser = JSON.parse(savedUser);

      const normalizedRole = String(
        parsedUser.role ||
          parsedUser.rol ||
          parsedUser.nombre_rol ||
          parsedUser.nombreRol ||
          ""
      )
        .toLowerCase()
        .trim();

      const normalizedUser = {
        ...parsedUser,
        role: normalizedRole || parsedUser.role,
      };

      localStorage.setItem("user", JSON.stringify(normalizedUser));
      localStorage.setItem("gl365_user", JSON.stringify(normalizedUser));
    } catch {
      userKeys.forEach((key) => localStorage.removeItem(key));
    }
  }

  if (savedToken) {
    localStorage.setItem("token", savedToken);
    localStorage.setItem("gl365_token", savedToken);
  }
}

class AppErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);

    this.state = {
      hasError: false,
      message: "",
    };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return {
      hasError: true,
      message:
        error?.message ||
        "Ocurrió un error al cargar el sistema. Revisá la consola del navegador.",
    };
  }

  componentDidCatch(error: any) {
    console.error("Error general del sistema GL365:", error);
  }

  clearSessionAndGoLogin = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("gl365_user");
    localStorage.removeItem("token");
    localStorage.removeItem("gl365_token");
    localStorage.removeItem("usuario");
    localStorage.removeItem("gl365_usuario");
    localStorage.removeItem("auth_token");

    window.location.href = "/login";
  };

  reloadPage = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-lg overflow-hidden">
            <div className="bg-[#0C2D6B] px-6 py-5">
              <h1 className="text-white text-xl font-bold">GL365 ERP</h1>
              <p className="text-blue-100 text-sm mt-1">
                No se pudo cargar la pantalla correctamente.
              </p>
            </div>

            <div className="p-6">
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm font-semibold">
                {this.state.message}
              </div>

              <p className="text-gray-500 text-sm mt-4 leading-relaxed">
                Esto puede pasar si la sesión quedó dañada o si un módulo tuvo
                un error al refrescar la página.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  type="button"
                  onClick={this.reloadPage}
                  className="flex-1 h-11 rounded-xl bg-[#0C2D6B] text-white font-bold text-sm hover:bg-[#143C8C]"
                >
                  Recargar
                </button>

                <button
                  type="button"
                  onClick={this.clearSessionAndGoLogin}
                  className="flex-1 h-11 rounded-xl border border-gray-300 bg-white text-gray-700 font-bold text-sm hover:bg-gray-50"
                >
                  Volver al login
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  normalizeAuthStorage();

  return (
    <AppErrorBoundary>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </AppErrorBoundary>
  );
}