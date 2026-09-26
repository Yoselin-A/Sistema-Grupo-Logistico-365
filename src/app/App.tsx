import "./utils/auditoriaGlobal";

import {
  Component,
  type ReactNode,
} from "react";

import {
  RouterProvider,
} from "react-router";

import {
  router,
} from "./routes";

import {
  AuthProvider,
} from "./context/AuthContext";

type ErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

/* =====================================================
   TEMA
===================================================== */

function applySavedTheme() {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined"
  ) {
    return;
  }

  const savedTheme =
    localStorage.getItem(
      "gl365_theme"
    );

  let theme:
    | "light"
    | "dark";

  if (
    savedTheme === "dark" ||
    savedTheme === "light"
  ) {
    theme = savedTheme;
  } else {
    theme =
      window.matchMedia?.(
        "(prefers-color-scheme: dark)"
      ).matches
        ? "dark"
        : "light";
  }

  document.documentElement
    .classList
    .toggle(
      "dark",
      theme === "dark"
    );

  document.documentElement
    .dataset.theme = theme;

  localStorage.setItem(
    "gl365_theme",
    theme
  );
}

/* =====================================================
   SESIÓN
===================================================== */

function normalizeAuthStorage() {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  const userKeys = [
    "user",
    "gl365_user",
    "usuario",
    "gl365_usuario",
  ];

  const tokenKeys = [
    "token",
    "gl365_token",
    "auth_token",
  ];

  const savedUser =
    userKeys
      .map((key) =>
        localStorage.getItem(
          key
        )
      )
      .find(
        (value) =>
          value &&
          value !==
            "undefined" &&
          value !== "null"
      );

  const savedToken =
    tokenKeys
      .map((key) =>
        localStorage.getItem(
          key
        )
      )
      .find(
        (value) =>
          value &&
          value !==
            "undefined" &&
          value !== "null"
      );

  if (savedUser) {
    try {
      const parsedUser =
        JSON.parse(
          savedUser
        );

      const normalizedRole =
        String(
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

        role:
          normalizedRole ||
          parsedUser.role,
      };

      localStorage.setItem(
        "user",
        JSON.stringify(
          normalizedUser
        )
      );

      localStorage.setItem(
        "gl365_user",
        JSON.stringify(
          normalizedUser
        )
      );
    } catch (error) {
      console.error(
        "No se pudo recuperar el usuario guardado:",
        error
      );

      userKeys.forEach(
        (key) =>
          localStorage.removeItem(
            key
          )
      );
    }
  }

  if (savedToken) {
    localStorage.setItem(
      "token",
      savedToken
    );

    localStorage.setItem(
      "gl365_token",
      savedToken
    );
  }
}

/*
 * Se ejecutan antes del render.
 *
 * Así evitamos que la página
 * aparezca blanca un instante
 * antes de activar modo oscuro.
 */
applySavedTheme();
normalizeAuthStorage();

/* =====================================================
   ERROR BOUNDARY
===================================================== */

class AppErrorBoundary extends Component<
  {
    children: ReactNode;
  },
  ErrorBoundaryState
> {
  constructor(props: {
    children: ReactNode;
  }) {
    super(props);

    this.state = {
      hasError: false,
      message: "",
    };
  }

  static getDerivedStateFromError(
    error: any
  ): ErrorBoundaryState {
    return {
      hasError: true,

      message:
        error?.message ||
        "Ocurrió un error al cargar el sistema. Revisá la consola del navegador.",
    };
  }

  componentDidCatch(
    error: any
  ) {
    console.error(
      "Error general del sistema GL365:",
      error
    );
  }

  clearSessionAndGoLogin =
    () => {
      /*
       * No borramos
       * gl365_theme.
       *
       * Así conserva
       * el modo claro/oscuro
       * al cerrar sesión.
       */

      localStorage.removeItem(
        "user"
      );

      localStorage.removeItem(
        "gl365_user"
      );

      localStorage.removeItem(
        "token"
      );

      localStorage.removeItem(
        "gl365_token"
      );

      localStorage.removeItem(
        "usuario"
      );

      localStorage.removeItem(
        "gl365_usuario"
      );

      localStorage.removeItem(
        "auth_token"
      );

      window.location.href =
        "/login";
    };

  reloadPage = () => {
    window.location.reload();
  };

  render() {
    if (
      this.state.hasError
    ) {
      return (
        <div
          className="
            flex
            min-h-screen
            items-center
            justify-center

            bg-[#F5F6FA]

            p-6

            transition-colors

            dark:bg-[#0B1220]
          "
        >
          <div
            className="
              w-full
              max-w-lg

              overflow-hidden

              rounded-2xl

              border
              border-gray-100

              bg-white

              shadow-xl

              dark:border-[#2A3548]
              dark:bg-[#111827]

              dark:shadow-2xl
              dark:shadow-black/40
            "
          >
            <div
              className="
                bg-[#0C2D6B]
                px-6 py-5

                dark:bg-[#10295D]
              "
            >
              <h1
                className="
                  text-xl
                  font-bold
                  text-white
                "
              >
                GL365 ERP
              </h1>

              <p
                className="
                  mt-1
                  text-sm
                  text-blue-100
                "
              >
                No se pudo cargar
                la pantalla
                correctamente.
              </p>
            </div>

            <div className="p-6">
              <div
                className="
                  rounded-xl

                  border
                  border-red-200

                  bg-red-50

                  px-4 py-3

                  text-sm
                  font-semibold
                  text-red-700

                  dark:border-red-900/70
                  dark:bg-red-950/40
                  dark:text-red-300
                "
              >
                {
                  this.state
                    .message
                }
              </div>

              <p
                className="
                  mt-4
                  text-sm
                  leading-relaxed
                  text-gray-500

                  dark:text-[#AEBBD0]
                "
              >
                Esto puede pasar
                si la sesión quedó
                dañada o si un
                módulo tuvo un
                error al refrescar
                la página.
              </p>

              <div
                className="
                  mt-6
                  flex
                  flex-col
                  gap-3

                  sm:flex-row
                "
              >
                <button
                  type="button"
                  onClick={
                    this.reloadPage
                  }
                  className="
                    h-11
                    flex-1

                    rounded-xl

                    bg-[#0C2D6B]

                    text-sm
                    font-bold
                    text-white

                    transition-colors

                    hover:bg-[#143C8C]

                    dark:bg-[#173F93]
                    dark:hover:bg-[#1D4FAF]
                  "
                >
                  Recargar
                </button>

                <button
                  type="button"
                  onClick={
                    this
                      .clearSessionAndGoLogin
                  }
                  className="
                    h-11
                    flex-1

                    rounded-xl

                    border
                    border-gray-300

                    bg-white

                    text-sm
                    font-bold
                    text-gray-700

                    transition-colors

                    hover:bg-gray-50

                    dark:border-[#34435A]
                    dark:bg-[#151F2F]
                    dark:text-[#F8FAFC]
                    dark:hover:bg-[#1A273A]
                  "
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

/* =====================================================
   APP
===================================================== */

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <RouterProvider
          router={router}
        />
      </AuthProvider>
    </AppErrorBoundary>
  );
}