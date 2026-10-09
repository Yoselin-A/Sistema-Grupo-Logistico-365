import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock3,
  FileWarning,
  Menu,
  LogOut,
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

type NotificationCategory = "viajes" | "flota" | "pilotos" | "seguridad";

type NotificationItem = {
  id: string;
  title: string;
  description: string;
  type: "route" | "maintenance" | "document" | "warning" | "success";
  category: NotificationCategory;
  path: string;
};

const API_BASE_URL = "/api";
const MAINTENANCE_WARNING_DAYS = 15;
const LICENSE_WARNING_DAYS = 15;

const normalizeText = (value: any) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const pickArray = (source: any, keys: string[]) => {
  const root =
    source?.data && typeof source.data === "object" ? source.data : source;

  for (const key of keys) {
    if (Array.isArray(root?.[key])) return root[key];
  }

  return [];
};

const safeFetch = async (path: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const json = await response.json().catch(() => null);

    if (!response.ok || json?.ok === false) return {};

    return json;
  } catch {
    return {};
  }
};

const dateOnly = (value: any) => {
  const text = String(value ?? "");
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
};

const daysUntil = (value: any) => {
  const date = dateOnly(value);
  if (!date) return null;

  const [year, month, day] = date.split("-").map(Number);
  const now = new Date();

  const todayUtc = Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const targetUtc = Date.UTC(year, month - 1, day);

  return Math.round((targetUtc - todayUtc) / 86400000);
};

const formatDate = (value: any) => {
  const date = dateOnly(value);
  if (!date) return "";

  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
};

const getTripId = (trip: any) =>
  Number(
    trip?.id ??
      trip?.viaje_id ??
      trip?.viajes_id ??
      trip?.id_viaje ??
      0
  );

const getAlertTripId = (alert: any) =>
  Number(
    alert?.viaje_id ??
      alert?.viajes_id ??
      alert?.id_viaje ??
      alert?.viaje?.id ??
      0
  );

const isUnreadAlert = (alert: any) => {
  const readValue =
    alert?.leida ??
    alert?.leido ??
    alert?.read ??
    alert?.is_read ??
    0;

  return !(
    readValue === true ||
    readValue === 1 ||
    String(readValue) === "1"
  );
};

const isOperationalAlert = (alert: any) => {
  const text = normalizeText(
    `${alert?.tipo || ""} ${alert?.descripcion || ""} ${
      alert?.nivel || ""
    }`
  );

  return (
    text.includes("retras") ||
    text.includes("demora") ||
    text.includes("critic") ||
    text.includes("incidencia") ||
    text.includes("atras")
  );
};

export function Header({ onMenuClick }: HeaderProps) {
  const { role, permissions, userName, logout } = useAuth();
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<
    "todas" | NotificationCategory
  >("todas");

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("gl365_theme");
    return saved === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.classList.toggle(
      "dark",
      theme === "dark"
    );
    localStorage.setItem("gl365_theme", theme);
  }, [theme]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocumentClick);

    return () =>
      document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  const canSeeLogistics = canAccessModule(role, "logistica", permissions);
  const canSeeFleet = canAccessModule(role, "flota", permissions);
  const canSeePilots = canAccessModule(role, "pilotos", permissions);

  const loadNotifications = async () => {
    setLoadingNotifications(true);

    try {
      const [
        logisticsResponse,
        fleetResponse,
        pilotsResponse,
        credentialsResponse,
      ] = await Promise.all([
        canSeeLogistics
          ? safeFetch("/logistica/bootstrap")
          : Promise.resolve({}),
        canSeeFleet
          ? safeFetch("/flota/bootstrap")
          : Promise.resolve({}),
        canSeePilots
          ? safeFetch("/pilotos")
          : Promise.resolve({}),
        role === "gerencia"
          ? safeFetch("/auth/solicitudes-credenciales")
          : Promise.resolve({}),
      ]);

      const next: NotificationItem[] = [];

      // =========================================================
      // 1. VIAJES / RETRASOS
      // =========================================================
      // El backend puede devolver la alerta:
      // - unida al viaje, o
      // - en un arreglo independiente "alertas".
      // Aquí se combinan ambas fuentes y se deja UNA alerta por viaje.
      const viajes = pickArray(logisticsResponse, [
        "viajes",
        "viaje",
      ]);

      const alertas = pickArray(logisticsResponse, [
        "alertas",
        "alerta",
        "alertas_viaje",
        "alertasViaje",
      ]);

      const alertasPorViaje = new Map<number, any>();

      alertas
        .filter(
          (alert: any) =>
            isUnreadAlert(alert) && isOperationalAlert(alert)
        )
        .forEach((alert: any) => {
          const tripId = getAlertTripId(alert);

          if (!tripId) return;

          const current = alertasPorViaje.get(tripId);

          // Si hay varias alertas del mismo viaje, se conserva una sola.
          // Se prioriza la de nivel crítico.
          if (!current) {
            alertasPorViaje.set(tripId, alert);
            return;
          }

          const currentLevel = normalizeText(current?.nivel);
          const nextLevel = normalizeText(alert?.nivel);

          if (
            nextLevel.includes("critic") &&
            !currentLevel.includes("critic")
          ) {
            alertasPorViaje.set(tripId, alert);
          }
        });

      const viajesConAlerta = new Set<number>();

      viajes.forEach((trip: any, index: number) => {
        const tripId = getTripId(trip);
        const relatedAlert = tripId
          ? alertasPorViaje.get(tripId)
          : null;

        const stateRaw =
          trip?.nombre_estado_viaje ||
          trip?.estado_viaje ||
          trip?.nombre_estado ||
          trip?.estado ||
          trip?.estado_asignacion ||
          "";

        const state = normalizeText(stateRaw);

        const progress = Number(
          trip?.progreso ??
            trip?.viaje_progreso ??
            0
        );

        const embeddedAlertText = normalizeText(
          `${trip?.alerta_tipo || ""} ${
            trip?.alerta_descripcion || ""
          } ${trip?.alerta_nivel || ""}`
        );

        const delayedOrCritical =
          state.includes("retras") ||
          state.includes("demora") ||
          state.includes("critic") ||
          state.includes("atras") ||
          embeddedAlertText.includes("retras") ||
          embeddedAlertText.includes("demora") ||
          embeddedAlertText.includes("critic") ||
          embeddedAlertText.includes("atras") ||
          Boolean(relatedAlert);

        // Solo la campana de alertas: no agregamos todos los viajes normales.
        if (!delayedOrCritical) return;

        const code =
          trip?.codigo_viaje ||
          trip?.codigo ||
          trip?.numero_viaje ||
          `Viaje ${tripId || index + 1}`;

        const route =
          trip?.ruta ||
          (trip?.origen && trip?.destino
            ? `${trip.origen} → ${trip.destino}`
            : trip?.nombre_ruta || "");

        const alertTitle =
          relatedAlert?.tipo ||
          trip?.alerta_tipo ||
          (stateRaw || "Retraso");

        const alertDescription =
          relatedAlert?.descripcion ||
          trip?.alerta_descripcion ||
          "";

        const descriptionParts = [
          route,
          progress > 0 ? `${progress}% de progreso` : "",
          alertDescription,
        ].filter(Boolean);

        next.push({
          id: `trip-${tripId || code}`,
          title: `${code} · ${alertTitle}`,
          description:
            descriptionParts.join(" · ") ||
            "Viaje con alerta operativa.",
          type: "warning",
          category: "viajes",
          path: "/logistica?tab=viajes",
        });

        if (tripId) viajesConAlerta.add(tripId);
      });

      // Si existe una alerta cuyo viaje no vino en el arreglo "viajes",
      // también se muestra. Así no se pierden retrasos reales del backend.
      alertasPorViaje.forEach((alert: any, tripId: number) => {
        if (viajesConAlerta.has(tripId)) return;

        const code =
          alert?.codigo_viaje ||
          alert?.codigo ||
          `Viaje ${tripId}`;

        next.push({
          id: `trip-${tripId}`,
          title: `${code} · ${alert?.tipo || "Alerta de viaje"}`,
          description:
            alert?.descripcion ||
            "El viaje tiene una alerta operativa pendiente.",
          type: "warning",
          category: "viajes",
          path: "/logistica?tab=viajes",
        });
      });

      // =========================================================
      // 2. MANTENIMIENTO DE FLOTA
      // =========================================================
      const vehicles = pickArray(fleetResponse, [
        "vehiculos",
        "vehiculo",
      ]);

      vehicles.forEach((vehicle: any, index: number) => {
        const maintenanceDate =
          vehicle?.proximo_mantenimiento ||
          vehicle?.ultimo_proximo_mantenimiento ||
          vehicle?.proximo;

        const days = daysUntil(maintenanceDate);

        if (
          days === null ||
          days > MAINTENANCE_WARNING_DAYS
        ) {
          return;
        }

        const code =
          vehicle?.codigo ||
          vehicle?.codigo_vehiculo ||
          `Vehículo ${vehicle?.id ?? index + 1}`;

        const overdue = days < 0;
        const today = days === 0;

        const timing = overdue
          ? `vencido hace ${Math.abs(days)} día${
              Math.abs(days) === 1 ? "" : "s"
            }`
          : today
          ? "programado para hoy"
          : `próximo en ${days} día${days === 1 ? "" : "s"}`;

        next.push({
          id: `maintenance-${vehicle?.id ?? code}`,
          title: `Mantenimiento de ${code}`,
          description: `${timing}${
            maintenanceDate
              ? ` · ${formatDate(maintenanceDate)}`
              : ""
          }`,
          type:
            overdue || today
              ? "warning"
              : "maintenance",
          category: "flota",
          path: "/flota",
        });
      });

      // =========================================================
      // 3. LICENCIAS DE PILOTOS
      // =========================================================
      const pilots = Array.isArray(pilotsResponse)
        ? pilotsResponse
        : Array.isArray((pilotsResponse as any)?.data)
        ? (pilotsResponse as any).data
        : Array.isArray((pilotsResponse as any)?.pilotos)
        ? (pilotsResponse as any).pilotos
        : pickArray(pilotsResponse, [
            "pilotos",
            "piloto",
          ]);

      pilots.forEach((pilot: any, index: number) => {
        const name =
          pilot?.nombre_piloto ||
          [
            pilot?.primer_nombre,
            pilot?.segundo_nombre,
            pilot?.primer_apellido,
            pilot?.segundo_apellido,
          ]
            .filter(Boolean)
            .join(" ") ||
          `Piloto ${pilot?.id ?? index + 1}`;

        const code =
          pilot?.codigo_piloto ||
          `PIL-${pilot?.id ?? index + 1}`;

        // -------------------------
        // LICENCIA
        // -------------------------
        const licenseExpiration =
          pilot?.fecha_vencimiento_licencia ||
          pilot?.vencimiento_licencia;

        const calculatedLicenseDays = daysUntil(
          licenseExpiration
        );

        const licenseDays =
          pilot?.dias_licencia != null
            ? Number(pilot.dias_licencia)
            : calculatedLicenseDays;

        if (
          licenseDays !== null &&
          !Number.isNaN(licenseDays) &&
          licenseDays <= LICENSE_WARNING_DAYS
        ) {
          const license =
            pilot?.licencia ||
            pilot?.numero_licencia ||
            "Sin número";

          const overdue = licenseDays < 0;
          const today = licenseDays === 0;

          const timing = overdue
            ? `vencida hace ${Math.abs(licenseDays)} día${
                Math.abs(licenseDays) === 1 ? "" : "s"
              }`
            : today
            ? "vence hoy"
            : `vence en ${licenseDays} día${
                licenseDays === 1 ? "" : "s"
              }`;

          next.push({
            id: `license-${pilot?.id ?? code}`,
            title: overdue
              ? `Licencia vencida · ${name}`
              : `Licencia próxima a vencer · ${name}`,
            description: `${code} · Licencia ${license} · ${timing}${
              licenseExpiration
                ? ` · ${formatDate(licenseExpiration)}`
                : ""
            }`,
            type: overdue ? "warning" : "document",
            category: "pilotos",
            path: "/pilotos",
          });
        }

        // -------------------------
        // DPI
        // -------------------------
        const dpiExpiration =
          pilot?.fecha_vencimiento_dpi ||
          pilot?.vencimiento_dpi;

        const calculatedDpiDays = daysUntil(dpiExpiration);

        const dpiDays =
          pilot?.dias_dpi != null
            ? Number(pilot.dias_dpi)
            : calculatedDpiDays;

        if (
          dpiDays !== null &&
          !Number.isNaN(dpiDays) &&
          dpiDays <= LICENSE_WARNING_DAYS
        ) {
          const dpi =
            pilot?.dpi ||
            pilot?.numero_dpi ||
            "Sin registrar";

          const overdue = dpiDays < 0;
          const today = dpiDays === 0;

          const timing = overdue
            ? `vencido hace ${Math.abs(dpiDays)} día${
                Math.abs(dpiDays) === 1 ? "" : "s"
              }`
            : today
            ? "vence hoy"
            : `vence en ${dpiDays} día${
                dpiDays === 1 ? "" : "s"
              }`;

          next.push({
            id: `dpi-${pilot?.id ?? code}`,
            title: overdue
              ? `DPI vencido · ${name}`
              : `DPI próximo a vencer · ${name}`,
            description: `${code} · DPI ${dpi} · ${timing}${
              dpiExpiration
                ? ` · ${formatDate(dpiExpiration)}`
                : ""
            }`,
            type: overdue ? "warning" : "document",
            category: "pilotos",
            path: "/pilotos",
          });
        }
      });

      // =========================================================
      // 4. SOLICITUDES DE CREDENCIALES
      // =========================================================
      if (role === "gerencia") {
        const requests = Array.isArray(
          (credentialsResponse as any)?.data
        )
          ? (credentialsResponse as any).data
          : [];

        if (requests.length > 0) {
          next.push({
            id: "credentials-pending",
            title: `${requests.length} solicitud${
              requests.length === 1 ? "" : "es"
            } de contraseña`,
            description:
              "Hay solicitudes pendientes de autorización en el dashboard.",
            type: "warning",
            category: "seguridad",
            path: "/dashboard",
          });
        }
      }

      // =========================================================
      // 5. ELIMINAR DUPLICADOS
      // =========================================================
      const unique = Array.from(
        new Map(
          next.map((notification) => [
            notification.id,
            notification,
          ])
        ).values()
      );

      // Dejamos más espacio porque ahora hay viajes,
      // mantenimiento y documentos de pilotos.
      setNotifications(unique.slice(0, 25));
    } finally {
      setLoadingNotifications(false);
    }
  };

  useEffect(() => {
    if (!role) return;

    loadNotifications();

    const timer = window.setInterval(
      loadNotifications,
      60000
    );

    return () => window.clearInterval(timer);
  }, [role]);

  const notificationCounts = useMemo(() => {
    const counts = {
      todas: notifications.length,
      viajes: 0,
      flota: 0,
      pilotos: 0,
      seguridad: 0,
    };

    notifications.forEach((notification) => {
      counts[notification.category] += 1;
    });

    return counts;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (notificationFilter === "todas") {
      return notifications;
    }

    return notifications.filter(
      (notification) =>
        notification.category === notificationFilter
    );
  }, [notifications, notificationFilter]);

  const categoryLabel: Record<NotificationCategory, string> = {
    viajes: "Viajes",
    flota: "Flota",
    pilotos: "Pilotos",
    seguridad: "Seguridad",
  };

  const categoryDescription: Record<NotificationCategory, string> = {
    viajes: "Retrasos, situaciones críticas e incidencias de viajes.",
    flota: "Mantenimientos vencidos o próximos.",
    pilotos: "Licencias y DPI vencidos o próximos a vencer.",
    seguridad: "Solicitudes o alertas administrativas.",
  };

  const categoryOrder: NotificationCategory[] = [
    "viajes",
    "flota",
    "pilotos",
    "seguridad",
  ];

  const notificationIcon = useMemo(
    () => ({
      route: <Route className="w-4 h-4" />,
      maintenance: <Wrench className="w-4 h-4" />,
      document: <FileWarning className="w-4 h-4" />,
      warning: <AlertTriangle className="w-4 h-4" />,
      success: <CheckCircle2 className="w-4 h-4" />,
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
    <header className="gl365-header bg-white border-b border-gray-200 px-4 sm:px-6 py-3 shadow-sm flex items-center justify-between z-30 relative h-16 sticky top-0">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Abrir menú"
        >
          <Menu className="w-6 h-6 text-[#0C2D6B]" />
        </button>

        <img
          src={logoImage}
          alt="Grupo Logístico 365"
          className="h-7 sm:h-10 max-w-[110px] sm:max-w-[150px] w-auto object-contain"
        />
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-3">
        <button
          type="button"
          onClick={() => { logout(); navigate("/login", { replace: true }); }}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className="lg:hidden flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-[#0C2D6B] hover:bg-gray-50"
        >
          <LogOut className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() =>
            setTheme((current) =>
              current === "dark" ? "light" : "dark"
            )
          }
          className="gl365-icon-button w-10 h-10 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center transition-colors"
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
            <Sun className="w-5 h-5 text-amber-500" />
          ) : (
            <Moon className="w-5 h-5 text-[#0C2D6B]" />
          )}
        </button>

        <div className="relative" ref={panelRef}>
          <button
            type="button"
            onClick={() => {
              setNotificationsOpen(
                (current) => !current
              );

              if (!notificationsOpen) {
                loadNotifications();
              }
            }}
            className="gl365-icon-button relative w-10 h-10 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center transition-colors"
            aria-label="Notificaciones"
            title="Notificaciones"
          >
            <Bell className="w-5 h-5 text-[#0C2D6B]" />

            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-[#FF6A00] text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
                {notifications.length > 9
                  ? "9+"
                  : notifications.length}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="gl365-notification-panel flex max-h-[calc(100dvh-88px)] flex-col fixed left-3 right-3 top-[72px] sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[430px] bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-[#0C2D6B]">
                    Notificaciones
                  </h3>
                  <p className="text-xs text-gray-500">
                    Alertas operativas de GL365
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setNotificationsOpen(false)
                  }
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                  aria-label="Cerrar notificaciones"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="border-b border-gray-100 bg-white px-3 py-3">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {[
                    {
                      key: "todas" as const,
                      label: "Todas",
                      count: notificationCounts.todas,
                    },
                    {
                      key: "viajes" as const,
                      label: "Viajes",
                      count: notificationCounts.viajes,
                    },
                    {
                      key: "flota" as const,
                      label: "Flota",
                      count: notificationCounts.flota,
                    },
                    {
                      key: "pilotos" as const,
                      label: "Pilotos",
                      count: notificationCounts.pilotos,
                    },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setNotificationFilter(item.key)}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition ${
                        notificationFilter === item.key
                          ? "border-[#0C2D6B] bg-[#0C2D6B] text-white"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {item.label}
                      <span
                        className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] ${
                          notificationFilter === item.key
                            ? "bg-white/20 text-white"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {item.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 max-h-[540px] overflow-y-auto">
                {loadingNotifications &&
                notifications.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-gray-500">
                    Cargando notificaciones...
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <CheckCircle2 className="mx-auto mb-2 h-9 w-9 text-green-500" />
                    <p className="font-semibold text-gray-700">
                      Sin alertas en esta categoría
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      No hay notificaciones pendientes.
                    </p>
                  </div>
                ) : notificationFilter === "todas" ? (
                  categoryOrder.map((category) => {
                    const items = notifications.filter(
                      (notification) =>
                        notification.category === category
                    );

                    if (items.length === 0) return null;

                    return (
                      <section key={category}>
                        <div className="sticky top-0 z-10 flex items-center justify-between border-y border-gray-100 bg-gray-50/95 px-4 py-2 backdrop-blur">
                          <div>
                            <p className="text-xs font-black uppercase tracking-wide text-[#0C2D6B]">
                              {categoryLabel[category]}
                            </p>
                            <p className="mt-0.5 text-[10px] text-gray-500">
                              {categoryDescription[category]}
                            </p>
                          </div>

                          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-gray-600 shadow-sm">
                            {items.length}
                          </span>
                        </div>

                        {items.map((notification) => (
                          <button
                            type="button"
                            key={notification.id}
                            onClick={() =>
                              openNotification(notification)
                            }
                            className="gl365-notification-item flex w-full items-start gap-3 border-b border-gray-100 px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-gray-50"
                          >
                            <div
                              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                                notification.type === "warning"
                                  ? "bg-red-50 text-red-600"
                                  : notification.type ===
                                    "maintenance"
                                  ? "bg-orange-50 text-[#FF6A00]"
                                  : notification.type ===
                                    "document"
                                  ? "bg-yellow-50 text-yellow-700"
                                  : notification.type === "route"
                                  ? "bg-blue-50 text-[#0C2D6B]"
                                  : "bg-green-50 text-green-600"
                              }`}
                            >
                              {
                                notificationIcon[
                                  notification.type
                                ]
                              }
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${
                                    notification.category === "viajes"
                                      ? "bg-blue-50 text-[#0C2D6B]"
                                      : notification.category === "flota"
                                      ? "bg-orange-50 text-[#FF6A00]"
                                      : notification.category === "pilotos"
                                      ? "bg-purple-50 text-purple-700"
                                      : "bg-gray-100 text-gray-600"
                                  }`}
                                >
                                  {categoryLabel[notification.category]}
                                </span>
                              </div>

                              <p className="text-sm font-bold leading-snug text-gray-800">
                                {notification.title}
                              </p>
                              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                                {notification.description}
                              </p>
                            </div>
                          </button>
                        ))}
                      </section>
                    );
                  })
                ) : (
                  <>
                    <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-wide text-[#0C2D6B]">
                        {categoryLabel[
                          notificationFilter as NotificationCategory
                        ]}
                      </p>
                      <p className="mt-0.5 text-[10px] text-gray-500">
                        {categoryDescription[
                          notificationFilter as NotificationCategory
                        ]}
                      </p>
                    </div>

                    {filteredNotifications.map((notification) => (
                      <button
                        type="button"
                        key={notification.id}
                        onClick={() =>
                          openNotification(notification)
                        }
                        className="gl365-notification-item flex w-full items-start gap-3 border-b border-gray-100 px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-gray-50"
                      >
                        <div
                          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                            notification.type === "warning"
                              ? "bg-red-50 text-red-600"
                              : notification.type === "maintenance"
                              ? "bg-orange-50 text-[#FF6A00]"
                              : notification.type === "document"
                              ? "bg-yellow-50 text-yellow-700"
                              : notification.type === "route"
                              ? "bg-blue-50 text-[#0C2D6B]"
                              : "bg-green-50 text-green-600"
                          }`}
                        >
                          {notificationIcon[notification.type]}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold leading-snug text-gray-800">
                            {notification.title}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-gray-500">
                            {notification.description}
                          </p>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </div>

              <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock3 className="w-3.5 h-3.5" />
                  Actualización automática
                </span>

                <button
                  type="button"
                  onClick={loadNotifications}
                  className="font-bold text-[#0C2D6B] hover:underline"
                >
                  Actualizar
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0 max-w-[180px] xl:max-w-[260px] text-right hidden sm:block">
          <p className="truncate text-sm font-bold text-[#0C2D6B]" title={userName}>
            {userName}
          </p>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            {role}
          </p>
        </div>

        <div className="shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#0C2D6B] flex items-center justify-center text-white font-bold shadow-sm text-sm">
          {userName.charAt(0)}
        </div>
      </div>
    </header>
  );
}
