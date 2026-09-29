import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock3,
  Menu,
  Moon,
  Route,
  Sun,
  Wrench,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { canAccessModule } from "../../utils/permissions";
import logoImage from "../../../assets/614cb11181e5d72cb3a39a09d833f4775b7fc7ce.png";

interface HeaderProps {
  onMenuClick?: () => void;
}

type NotificationItem = {
  id: string;
  title: string;
  description: string;
  type: "route" | "maintenance" | "warning" | "success";
  path: string;
};

const API_BASE_URL = "/api";
const MAINTENANCE_WARNING_DAYS = 15;

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const getStoredToken = () => {
  if (typeof window === "undefined") return "";

  const tokenKeys = ["token", "gl365_token", "auth_token"];

  return (
    tokenKeys
      .map((key) => localStorage.getItem(key))
      .find(
        (value) =>
          value &&
          value !== "undefined" &&
          value !== "null"
      ) || ""
  );
};

const pickArray = (source: any, keys: string[]) => {
  const root =
    source?.data && typeof source.data === "object"
      ? source.data
      : source;

  for (const key of keys) {
    if (Array.isArray(root?.[key])) {
      return root[key];
    }
  }

  return [];
};

const safeFetch = async (path: string) => {
  try {
    const token = getStoredToken();

    const headers: HeadersInit = {
      Accept: "application/json",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
      `${API_BASE_URL}${path}`,
      {
        headers,
        credentials: "include",
        cache: "no-store",
      }
    );

    const contentType =
      response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      return {};
    }

    const json = await response.json();

    if (!response.ok || json?.ok === false) {
      return {};
    }

    return json;
  } catch (error) {
    console.error(
      `Error consultando ${path}:`,
      error
    );

    return {};
  }
};

const dateOnly = (value: unknown) => {
  const text = String(value ?? "");

  const match = text.match(
    /^(\d{4})-(\d{2})-(\d{2})/
  );

  return match
    ? `${match[1]}-${match[2]}-${match[3]}`
    : "";
};

const daysUntil = (value: unknown) => {
  const date = dateOnly(value);

  if (!date) {
    return null;
  }

  const [year, month, day] = date
    .split("-")
    .map(Number);

  const now = new Date();

  const todayUtc = Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const targetUtc = Date.UTC(
    year,
    month - 1,
    day
  );

  return Math.round(
    (targetUtc - todayUtc) / 86400000
  );
};

const formatDate = (value: unknown) => {
  const date = dateOnly(value);

  if (!date) {
    return "";
  }

  const [year, month, day] =
    date.split("-");

  return `${day}/${month}/${year}`;
};

export function Header({
  onMenuClick,
}: HeaderProps) {
  const { role, userName, permissions } = useAuth();

  const navigate = useNavigate();

  const panelRef =
    useRef<HTMLDivElement>(null);

  const normalizedRole =
    normalizeText(role);

  const safeUserName = String(
    userName || "Usuario"
  );

  const [
    notificationsOpen,
    setNotificationsOpen,
  ] = useState(false);

  const [
    notifications,
    setNotifications,
  ] = useState<NotificationItem[]>([]);

  const [
    loadingNotifications,
    setLoadingNotifications,
  ] = useState(false);

  const [theme, setTheme] = useState<
    "light" | "dark"
  >(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    const saved =
      localStorage.getItem("gl365_theme");

    if (
      saved === "dark" ||
      saved === "light"
    ) {
      return saved;
    }

    return window.matchMedia?.(
      "(prefers-color-scheme: dark)"
    ).matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    document.documentElement.classList.toggle(
      "dark",
      theme === "dark"
    );

    document.documentElement.dataset.theme =
      theme;

    localStorage.setItem(
      "gl365_theme",
      theme
    );
  }, [theme]);

  useEffect(() => {
    const onDocumentClick = (
      event: MouseEvent
    ) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(
          event.target as Node
        )
      ) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      onDocumentClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        onDocumentClick
      );
    };
  }, []);

  const canSeeLogistics = canAccessModule(role, "logistica", permissions);

  const canSeeFleet = canAccessModule(role, "flota", permissions);

  const loadNotifications = async () => {
    setLoadingNotifications(true);

    try {
      const [
        logisticsResponse,
        fleetResponse,
        credentialsResponse,
      ] = await Promise.all([
        canSeeLogistics
          ? safeFetch(
              "/logistica/bootstrap"
            )
          : Promise.resolve({}),

        canSeeFleet
          ? safeFetch("/flota/bootstrap")
          : Promise.resolve({}),

        (normalizedRole === "gerencia" || normalizedRole === "administrador")
          ? safeFetch(
              "/auth/solicitudes-credenciales"
            )
          : Promise.resolve({}),
      ]);

      const next: NotificationItem[] =
        [];

      /* ==============================
         VIAJES
      ============================== */

      const viajes = pickArray(
        logisticsResponse,
        ["viajes", "viaje"]
      );

      const activeTrips = viajes.filter(
        (trip: any) => {
          const state = normalizeText(
            trip?.nombre_estado_viaje ||
              trip?.estado_viaje ||
              trip?.nombre_estado ||
              trip?.estado ||
              trip?.estado_asignacion
          );

          const progress = Number(
            trip?.progreso ??
              trip?.viaje_progreso ??
              0
          );

          return (
            state.includes("ruta") ||
            state.includes("transito") ||
            state.includes("retras") ||
            state.includes("critic") ||
            (progress > 0 &&
              progress < 100)
          );
        }
      );

      activeTrips
        .slice(0, 6)
        .forEach(
          (
            trip: any,
            index: number
          ) => {
            const code =
              trip?.codigo_viaje ||
              trip?.codigo ||
              trip?.numero_viaje ||
              `Viaje ${
                trip?.id ?? index + 1
              }`;

            const state =
              trip?.nombre_estado_viaje ||
              trip?.estado_viaje ||
              trip?.nombre_estado ||
              trip?.estado ||
              "En ruta";

            const progress = Number(
              trip?.progreso ??
                trip?.viaje_progreso ??
                0
            );

            const route =
              trip?.ruta ||
              (trip?.origen &&
              trip?.destino
                ? `${trip.origen} → ${trip.destino}`
                : trip?.nombre_ruta ||
                  "");

            const normalizedState =
              normalizeText(state);

            next.push({
              id: `trip-${
                trip?.id ?? code
              }-${index}`,

              title: `${code} · ${state}`,

              description: `${
                route
                  ? `${route} · `
                  : ""
              }${progress}% de progreso`,

              type:
                normalizedState.includes(
                  "retras"
                ) ||
                normalizedState.includes(
                  "critic"
                )
                  ? "warning"
                  : "route",

              path:
                "/logistica?tab=viajes",
            });

            if (
              trip?.alerta_id &&
              trip?.alerta_descripcion
            ) {
              next.push({
                id: `trip-alert-${trip.alerta_id}`,

                title:
                  trip?.alerta_tipo ||
                  `Alerta de ${code}`,

                description:
                  trip.alerta_descripcion,

                type: "warning",

                path:
                  "/logistica?tab=viajes",
              });
            }
          }
        );

      /* ==============================
         MANTENIMIENTO
      ============================== */

      const vehicles = pickArray(
        fleetResponse,
        ["vehiculos", "vehiculo"]
      );

      vehicles.forEach(
        (
          vehicle: any,
          index: number
        ) => {
          const maintenanceDate =
            vehicle?.proximo_mantenimiento ||
            vehicle?.ultimo_proximo_mantenimiento ||
            vehicle?.proximo;

          const days = daysUntil(
            maintenanceDate
          );

          if (
            days === null ||
            days >
              MAINTENANCE_WARNING_DAYS
          ) {
            return;
          }

          const code =
            vehicle?.codigo ||
            vehicle?.codigo_vehiculo ||
            vehicle?.placa ||
            `Vehículo ${
              vehicle?.id ?? index + 1
            }`;

          const overdue = days < 0;
          const today = days === 0;

          const timing = overdue
            ? `vencido hace ${Math.abs(
                days
              )} día${
                Math.abs(days) === 1
                  ? ""
                  : "s"
              }`
            : today
              ? "programado para hoy"
              : `próximo en ${days} día${
                  days === 1 ? "" : "s"
                }`;

          next.push({
            id: `maintenance-${
              vehicle?.id ?? code
            }-${index}`,

            title:
              `Mantenimiento de ${code}`,

            description: `${timing}${
              maintenanceDate
                ? ` · ${formatDate(
                    maintenanceDate
                  )}`
                : ""
            }`,

            type:
              overdue || today
                ? "warning"
                : "maintenance",

            path: "/flota",
          });
        }
      );

      /* ==============================
         SOLICITUDES DE CONTRASEÑA
      ============================== */

      if (
        normalizedRole === "gerencia" || normalizedRole === "administrador"
      ) {
        const requests =
          Array.isArray(
            (
              credentialsResponse as any
            )?.data
          )
            ? (
                credentialsResponse as any
              ).data
            : pickArray(
                credentialsResponse,
                [
                  "solicitudes",
                  "solicitud_credencial",
                ]
              );

        const pendingRequests =
          requests.filter(
            (request: any) => {
              const state =
                normalizeText(
                  request?.estado_solicitud ||
                    request?.estado ||
                    request?.status
                );

              return (
                !state ||
                state.includes("pend") ||
                state.includes(
                  "solicit"
                )
              );
            }
          );

        if (
          pendingRequests.length > 0
        ) {
          next.push({
            id: "credentials-pending",

            title: `${
              pendingRequests.length
            } solicitud${
              pendingRequests.length === 1
                ? ""
                : "es"
            } de contraseña`,

            description:
              "Hay solicitudes pendientes de autorización.",

            type: "warning",

            path: "/mantenimiento",
          });
        }
      }

      const priority: Record<
        NotificationItem["type"],
        number
      > = {
        warning: 1,
        maintenance: 2,
        route: 3,
        success: 4,
      };

      next.sort(
        (a, b) =>
          priority[a.type] -
          priority[b.type]
      );

      setNotifications(
        next.slice(0, 12)
      );
    } finally {
      setLoadingNotifications(false);
    }
  };

  useEffect(() => {
    if (!normalizedRole) {
      return;
    }

    loadNotifications();

    const timer =
      window.setInterval(
        loadNotifications,
        60000
      );

    return () => {
      window.clearInterval(timer);
    };
  }, [normalizedRole]);

  const notificationIcon =
    useMemo(
      () => ({
        route: (
          <Route className="w-4 h-4" />
        ),

        maintenance: (
          <Wrench className="w-4 h-4" />
        ),

        warning: (
          <AlertTriangle className="w-4 h-4" />
        ),

        success: (
          <CheckCircle2 className="w-4 h-4" />
        ),
      }),
      []
    );

  const openNotification = (
    notification: NotificationItem
  ) => {
    setNotificationsOpen(false);

    navigate(notification.path);
  };

  return (
    <header
      className="
        gl365-header
        sticky top-0 z-30
        flex h-16 items-center justify-between
        border-b border-gray-200
        bg-white
        px-4 py-3
        shadow-sm
        transition-colors duration-200

        dark:border-[#263244]
        dark:bg-[#0E1A2B]

        sm:px-6
      "
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="
            flex min-h-[44px] min-w-[44px]
            items-center justify-center
            rounded-xl p-2
            transition-colors

            hover:bg-gray-100

            dark:hover:bg-[#172337]

            md:hidden
          "
          aria-label="Abrir menú"
        >
          <Menu
            className="
              h-6 w-6
              text-[#0C2D6B]
              dark:text-[#D7E5FF]
            "
          />
        </button>

        <img
          src={logoImage}
          alt="Grupo Logístico 365"
          className="
            h-8 w-auto
            object-contain
            sm:h-10
          "
        />
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* TEMA */}

        <button
          type="button"
          onClick={() =>
            setTheme((current) =>
              current === "dark"
                ? "light"
                : "dark"
            )
          }
          className="
            gl365-icon-button
            flex h-10 w-10
            items-center justify-center
            rounded-xl
            border border-gray-200
            bg-white
            transition-all duration-200

            hover:bg-gray-50

            dark:border-[#2A3548]
            dark:bg-[#121F31]
            dark:hover:bg-[#19283D]
          "
          aria-label={
            theme === "dark"
              ? "Activar modo claro"
              : "Activar modo oscuro"
          }
          title={
            theme === "dark"
              ? "Modo claro"
              : "Modo oscuro"
          }
        >
          {theme === "dark" ? (
            <Sun
              className="
                h-5 w-5
                text-amber-400
              "
            />
          ) : (
            <Moon
              className="
                h-5 w-5
                text-[#0C2D6B]
              "
            />
          )}
        </button>

        {/* NOTIFICACIONES */}

        <div
          className="relative"
          ref={panelRef}
        >
          <button
            type="button"
            onClick={() => {
              setNotificationsOpen(
                (current) => !current
              );

              if (
                !notificationsOpen
              ) {
                loadNotifications();
              }
            }}
            className="
              gl365-icon-button
              relative
              flex h-10 w-10
              items-center justify-center
              rounded-xl
              border border-gray-200
              bg-white
              transition-all duration-200

              hover:bg-gray-50

              dark:border-[#2A3548]
              dark:bg-[#121F31]
              dark:hover:bg-[#19283D]
            "
            aria-label="Notificaciones"
            title="Notificaciones"
          >
            <Bell
              className="
                h-5 w-5
                text-[#0C2D6B]
                dark:text-[#E6EEF9]
              "
            />

            {notifications.length >
              0 && (
              <span
                className="
                  absolute
                  -right-1 -top-1
                  flex h-5 min-w-5
                  items-center justify-center
                  rounded-full
                  border-2 border-white
                  bg-[#FF6A00]
                  px-1
                  text-[10px]
                  font-bold text-white

                  dark:border-[#0E1A2B]
                "
              >
                {notifications.length >
                9
                  ? "9+"
                  : notifications.length}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div
              className="
                gl365-notification-panel

                absolute
                right-0 top-12
                z-50

                w-[min(92vw,390px)]

                overflow-hidden
                rounded-2xl

                border
                border-gray-200

                bg-white

                shadow-2xl

                dark:border-[#2A3548]
                dark:bg-[#111827]
              "
            >
              <div
                className="
                  flex
                  items-center
                  justify-between
                  gap-3

                  border-b
                  border-gray-100

                  px-4 py-3

                  dark:border-[#263244]
                "
              >
                <div>
                  <h3
                    className="
                      font-bold
                      text-[#0C2D6B]
                      dark:text-[#F8FAFC]
                    "
                  >
                    Notificaciones
                  </h3>

                  <p
                    className="
                      mt-0.5
                      text-xs
                      text-gray-500
                      dark:text-[#94A3B8]
                    "
                  >
                    Alertas operativas
                    de GL365
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setNotificationsOpen(
                      false
                    )
                  }
                  className="
                    rounded-lg
                    p-2
                    text-gray-500
                    transition-colors

                    hover:bg-gray-100

                    dark:text-[#94A3B8]
                    dark:hover:bg-[#1A2638]
                  "
                  aria-label="Cerrar notificaciones"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div
                className="
                  max-h-[420px]
                  overflow-y-auto
                "
              >
                {loadingNotifications &&
                notifications.length ===
                  0 ? (
                  <div
                    className="
                      px-5 py-8
                      text-center
                      text-sm
                      text-gray-500
                      dark:text-[#94A3B8]
                    "
                  >
                    Cargando
                    notificaciones...
                  </div>
                ) : notifications.length ===
                  0 ? (
                  <div
                    className="
                      px-5 py-8
                      text-center
                    "
                  >
                    <CheckCircle2
                      className="
                        mx-auto mb-2
                        h-9 w-9
                        text-green-500
                      "
                    />

                    <p
                      className="
                        font-semibold
                        text-gray-700
                        dark:text-[#F8FAFC]
                      "
                    >
                      Sin alertas
                      pendientes
                    </p>

                    <p
                      className="
                        mt-1
                        text-xs
                        text-gray-500
                        dark:text-[#94A3B8]
                      "
                    >
                      Todo se encuentra
                      al día.
                    </p>
                  </div>
                ) : (
                  notifications.map(
                    (
                      notification
                    ) => (
                      <button
                        type="button"
                        key={
                          notification.id
                        }
                        onClick={() =>
                          openNotification(
                            notification
                          )
                        }
                        className="
                          gl365-notification-item

                          flex w-full
                          items-start
                          gap-3

                          border-b
                          border-gray-100

                          px-4 py-3.5

                          text-left

                          transition-colors

                          last:border-b-0

                          hover:bg-gray-50

                          dark:border-[#263244]
                          dark:hover:bg-[#182437]
                        "
                      >
                        <div
                          className={`
                            mt-0.5
                            flex
                            h-9 w-9
                            shrink-0
                            items-center
                            justify-center
                            rounded-xl

                            ${
                              notification.type ===
                              "warning"
                                ? "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300"

                                : notification.type ===
                                    "maintenance"

                                  ? "bg-orange-50 text-[#FF6A00] dark:bg-orange-950/40 dark:text-orange-300"

                                  : notification.type ===
                                      "route"

                                    ? "bg-blue-50 text-[#0C2D6B] dark:bg-blue-950/40 dark:text-blue-300"

                                    : "bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-300"
                            }
                          `}
                        >
                          {
                            notificationIcon[
                              notification
                                .type
                            ]
                          }
                        </div>

                        <div
                          className="
                            min-w-0
                            flex-1
                          "
                        >
                          <p
                            className="
                              truncate
                              text-sm
                              font-bold
                              text-gray-800
                              dark:text-[#F8FAFC]
                            "
                          >
                            {
                              notification.title
                            }
                          </p>

                          <p
                            className="
                              mt-1
                              text-xs
                              leading-relaxed
                              text-gray-500
                              dark:text-[#AEBBD0]
                            "
                          >
                            {
                              notification.description
                            }
                          </p>
                        </div>
                      </button>
                    )
                  )
                )}
              </div>

              <div
                className="
                  flex
                  items-center
                  justify-between

                  border-t
                  border-gray-100

                  bg-gray-50

                  px-4 py-2.5

                  text-[11px]
                  text-gray-500

                  dark:border-[#263244]
                  dark:bg-[#0F1929]
                  dark:text-[#94A3B8]
                "
              >
                <span
                  className="
                    flex
                    items-center
                    gap-1
                  "
                >
                  <Clock3
                    className="
                      h-3.5 w-3.5
                    "
                  />

                  Actualización
                  automática
                </span>

                <button
                  type="button"
                  onClick={
                    loadNotifications
                  }
                  disabled={
                    loadingNotifications
                  }
                  className="
                    font-bold
                    text-[#0C2D6B]

                    hover:underline

                    disabled:cursor-not-allowed
                    disabled:opacity-50

                    dark:text-[#8FB7FF]
                  "
                >
                  {loadingNotifications
                    ? "Actualizando..."
                    : "Actualizar"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* USUARIO */}

        <div
          className="
            hidden
            text-right
            sm:block
          "
        >
          <p
            className="
              text-sm
              font-bold
              text-[#0C2D6B]
              dark:text-[#F8FAFC]
            "
          >
            {safeUserName}
          </p>

          <p
            className="
              text-[10px]
              font-bold
              uppercase
              tracking-wider
              text-gray-400
              dark:text-[#94A3B8]
            "
          >
            {normalizedRole ||
              "usuario"}
          </p>
        </div>

        <div
          className="
            flex
            h-9 w-9
            items-center
            justify-center

            rounded-full

            bg-[#0C2D6B]

            text-sm
            font-bold
            text-white

            shadow-sm

            ring-1
            ring-[#0C2D6B]/20

            dark:bg-[#173F93]
            dark:ring-white/10

            sm:h-10
            sm:w-10
          "
        >
          {safeUserName
            .charAt(0)
            .toUpperCase()}
        </div>
      </div>
    </header>
  );
}