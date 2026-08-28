type AuditUser = {
  id?: string | number;
  usuario_id?: string | number;
  user_id?: string | number;
  userName?: string;
  nombre_usuario?: string;
  nombre?: string;
  name?: string;
  email?: string;
  correo?: string;
  role?: string;
  rol?: string;
  nombre_rol?: string;
};

declare global {
  interface Window {
    __GL365_AUDIT_INSTALLED__?: boolean;
    gl365AuditLogout?: () => Promise<void>;
  }
}

const API_BASE =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_URL) ||
  "http://localhost:3001/api";

const STORAGE_KEYS = [
  "gl365_user",
  "gl365User",
  "gl365_auth_user",
  "authUser",
  "currentUser",
  "usuario",
  "user",
];

function readUser(): AuditUser {
  for (const key of STORAGE_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // Ignorar datos no JSON
    }
  }

  return {
    userName: localStorage.getItem("userName") || localStorage.getItem("nombre_usuario") || "",
    email: localStorage.getItem("email") || "",
    role: localStorage.getItem("role") || localStorage.getItem("rol") || "",
  };
}

function auditHeaders(): Record<string, string> {
  const user = readUser();

  const id = user.id || user.usuario_id || user.user_id || "";
  const name =
    user.userName ||
    user.nombre_usuario ||
    user.nombre ||
    user.name ||
    localStorage.getItem("userName") ||
    "Usuario del sistema";

  const email = user.email || user.correo || localStorage.getItem("email") || "";
  const role = user.role || user.rol || user.nombre_rol || localStorage.getItem("role") || "";

  return {
    "X-GL365-User-Id": String(id || ""),
    "X-GL365-User-Name": String(name || "Usuario del sistema"),
    "X-GL365-User-Email": String(email || ""),
    "X-GL365-User-Role": String(role || ""),
  };
}

function moduloFromPath(pathname: string) {
  const path = pathname.toLowerCase();

  if (path.includes("crm")) return "CRM y Ventas";
  if (path.includes("operaciones")) return "Operaciones y Compras";
  if (path.includes("logistica") && path.includes("flota")) return "Flota";
  if (path.includes("flota")) return "Flota";
  if (path.includes("rutas")) return "Rutas";
  if (path.includes("logistica")) return "Logística";
  if (path.includes("comprobantes")) return "Comprobantes";
  if (path.includes("reportes")) return "Reportes";
  if (path.includes("ia")) return "IA Logística";
  if (path.includes("mantenimiento")) return "Mantenimiento";
  if (path.includes("dashboard") || path.includes("inicio")) return "Inicio";

  return "";
}

async function postAudit(path: string, body: Record<string, unknown>) {
  try {
    await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...auditHeaders(),
      },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    // No bloquear el sistema si auditoría falla
  }
}

let lastModule = "";
let lastModuleAt = 0;

function registerModuleAccess() {
  const modulo = moduloFromPath(window.location.pathname);
  if (!modulo) return;

  const now = Date.now();
  const sameModuleRecently = modulo === lastModule && now - lastModuleAt < 120000;

  if (sameModuleRecently) return;

  lastModule = modulo;
  lastModuleAt = now;

  postAudit("/auditoria/sesion/modulo", {
    modulo,
    ruta: window.location.pathname,
  });
}

function patchNavigation() {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function pushStatePatched(...args) {
    const result = originalPushState.apply(this, args as any);
    setTimeout(registerModuleAccess, 200);
    return result;
  };

  history.replaceState = function replaceStatePatched(...args) {
    const result = originalReplaceState.apply(this, args as any);
    setTimeout(registerModuleAccess, 200);
    return result;
  };

  window.addEventListener("popstate", () => setTimeout(registerModuleAccess, 200));
  setTimeout(registerModuleAccess, 600);
}

function patchFetch() {
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const isApi = url.includes("/api") || url.startsWith(API_BASE) || url.includes("localhost:3001");

    if (!isApi) return originalFetch(input, init);

    const headers = new Headers(init.headers || {});

    Object.entries(auditHeaders()).forEach(([key, value]) => {
      if (!headers.has(key)) headers.set(key, value);
    });

    return originalFetch(input, {
      ...init,
      headers,
    });
  };
}

if (!window.__GL365_AUDIT_INSTALLED__) {
  window.__GL365_AUDIT_INSTALLED__ = true;

  patchFetch();
  patchNavigation();

  window.gl365AuditLogout = async () => {
    await postAudit("/auditoria/sesion/salida", {
      ruta: window.location.pathname,
    });
  };
}

export {};