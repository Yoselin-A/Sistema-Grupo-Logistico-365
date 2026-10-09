import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

// Los roles ahora pueden ser creados desde Mantenimiento, por eso ya no se
// limitan a una unión fija de nombres. Los roles conocidos se normalizan para
// conservar compatibilidad con el sistema existente.
export type UserRole = string;

interface AuthContextType {
  sessionReady: boolean;
  role: UserRole | null;
  setRole: (role: UserRole | null) => void;
  permissions: string[] | null;
  setPermissions: (permissions: string[] | null) => void;
  userName: string;
  setUserName: (name: string) => void;
  refreshSession: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "/api";

function normalizeRole(value: any): UserRole | null {
  let role = String(value || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!role) return null;

  if (role === "administracion" || role === "admin") role = "administrador";
  if (role === "operacion") role = "operaciones";
  if (role === "mensajeria externa") role = "mensajeria";

  return role
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || null;
}

function getStoredUser() {
  const keys = ["user", "gl365_user", "usuario", "gl365_usuario"];

  for (const key of keys) {
    const saved = localStorage.getItem(key);
    if (!saved || saved === "undefined" || saved === "null") continue;

    try {
      return JSON.parse(saved);
    } catch {
      localStorage.removeItem(key);
    }
  }

  return null;
}

function getStoredRole(): UserRole | null {
  const user = getStoredUser();

  const roleFromUser = normalizeRole(
    user?.role ||
      user?.rol ||
      user?.nombre_rol ||
      user?.nombreRol ||
      user?.nombre_role
  );

  if (roleFromUser) return roleFromUser;
  return normalizeRole(localStorage.getItem("role"));
}

function getStoredPermissions(): string[] | null {
  const user = getStoredUser();

  if (Array.isArray(user?.permissions)) {
    return user.permissions
      .map((item: any) => String(item || "").trim().toLowerCase())
      .filter(Boolean);
  }

  // null significa "sesión antigua sin permisos dinámicos". Así permissions.tsx
  // puede usar temporalmente la matriz legacy hasta que /auth/me sincronice.
  return null;
}

function getStoredUserName() {
  const user = getStoredUser();

  const fullName = [
    user?.primer_nombre,
    user?.segundo_nombre,
    user?.primer_apellido,
    user?.segundo_apellido,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    fullName ||
    user?.nombre_completo ||
    user?.nombre ||
    user?.name ||
    user?.nombre_usuario ||
    localStorage.getItem("userName") ||
    "Usuario"
  );
}

function saveUserPatch(
  role: UserRole | null,
  userName: string,
  permissions: string[] | null
) {
  if (!role) return; // No crea una sesión ficticia en la pantalla de login.
  const currentUser = getStoredUser() || {};

  const updatedUser: Record<string, any> = {
    ...currentUser,
    role,
    nombre_completo: userName,
  };

  if (permissions !== null) {
    updatedUser.permissions = permissions;
  }

  localStorage.setItem("user", JSON.stringify(updatedUser));
  localStorage.setItem("gl365_user", JSON.stringify(updatedUser));

  if (role) localStorage.setItem("role", role);
  else localStorage.removeItem("role");

  localStorage.setItem("userName", userName);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionReady, setSessionReady] = useState(() => !getStoredRole());
  const [roleState, setRoleState] = useState<UserRole | null>(() => getStoredRole());
  const [permissionsState, setPermissionsState] = useState<string[] | null>(() =>
    getStoredPermissions()
  );
  const [userNameState, setUserNameState] = useState<string>(() =>
    getStoredUserName()
  );

  const setRole = (newRole: UserRole | null) => {
    const normalized = normalizeRole(newRole);
    setRoleState(normalized);
    saveUserPatch(normalized, userNameState, permissionsState);
  };

  const setPermissions = (permissions: string[] | null) => {
    const normalized = Array.isArray(permissions)
      ? Array.from(
          new Set(
            permissions
              .map((item) => String(item || "").trim().toLowerCase())
              .filter(Boolean)
          )
        )
      : null;

    setPermissionsState(normalized);
    setSessionReady(true);
    saveUserPatch(getStoredRole() || roleState, userNameState, normalized);
  };

  const setUserName = (name: string) => {
    const cleanName = String(name || "Usuario").trim() || "Usuario";
    setUserNameState(cleanName);
    saveUserPatch(
      getStoredRole() || roleState,
      cleanName,
      getStoredPermissions() ?? permissionsState
    );
  };

  const refreshSession = async () => {
    if (!getStoredRole()) return;
    const identity = getStoredUser()?.id;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      const json = await response.json().catch(() => null);
      if (identity !== getStoredUser()?.id) return;
      if (response.status === 401 || response.status === 403) { logout(); return; }
      if (!response.ok || json?.ok === false) return;

      const user = json?.data || json?.user;
      if (!user) return;
      // Una respuesta de la sesión anterior no puede reemplazar otro login.

      const nextRole = normalizeRole(user.role || user.nombre_rol);
      const nextPermissions = Array.isArray(user.permissions)
        ? user.permissions.map((item: any) => String(item).toLowerCase())
        : [];
      const nextName = String(user.name || user.nombre_completo || user.nombre_usuario || "Usuario").trim();

      setRoleState(nextRole);
      setPermissionsState(current => JSON.stringify(current) === JSON.stringify(nextPermissions) ? current : nextPermissions);
      setUserNameState(nextName || "Usuario");
      setSessionReady(true);

      const updatedUser = {
        ...(getStoredUser() || {}),
        ...user,
        role: nextRole,
        permissions: nextPermissions,
        nombre_completo: nextName || "Usuario",
      };

      localStorage.setItem("user", JSON.stringify(updatedUser));
      localStorage.setItem("gl365_user", JSON.stringify(updatedUser));
      if (nextRole) localStorage.setItem("role", nextRole);
      localStorage.setItem("userName", nextName || "Usuario");
    } catch {
      // La sesión local sigue funcionando si el backend todavía no responde.
    }
  };

  const logout = () => {
    fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      keepalive: true,
    }).catch(() => {});

    [
      "user",
      "gl365_user",
      "usuario",
      "gl365_usuario",
      "token",
      "gl365_token",
      "auth_token",
      "role",
      "userName",
    ].forEach((key) => localStorage.removeItem(key));

    setRoleState(null);
    setPermissionsState(null);
    setUserNameState("Usuario");
    window.location.href = "/login";
  };

  useEffect(() => {
    saveUserPatch(roleState, userNameState, permissionsState);
  }, [roleState, userNameState, permissionsState]);

  useEffect(() => {
    const sync = () => { if (!document.hidden) void refreshSession(); };
    sync();
    const timer = window.setInterval(sync, 5000);
    window.addEventListener("focus", sync);
    window.addEventListener("storage", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", sync);
      window.removeEventListener("storage", sync);
      document.removeEventListener("visibilitychange", sync);
    };
    // Los permisos del menú se sincronizan también en sesiones ya abiertas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider
      value={{
        sessionReady,
        role: roleState,
        setRole,
        permissions: permissionsState,
        setPermissions,
        userName: userNameState,
        setUserName,
        refreshSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

const defaultAuth: AuthContextType = {
  sessionReady: false,
  role: null,
  setRole: () => {},
  permissions: null,
  setPermissions: () => {},
  userName: "Usuario",
  setUserName: () => {},
  refreshSession: async () => {},
  logout: () => {},
};

export function useAuth() {
  const context = useContext(AuthContext);
  return context ?? defaultAuth;
}
