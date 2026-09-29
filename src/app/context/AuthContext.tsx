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
    if (!getStoredUser() && !roleState) return;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      const json = await response.json().catch(() => null);
      if (!response.ok || json?.ok === false) return;

      const user = json?.data || json?.user;
      if (!user) return;

      const nextRole = normalizeRole(user.role || user.nombre_rol);
      const nextPermissions = Array.isArray(user.permissions)
        ? user.permissions.map((item: any) => String(item).toLowerCase())
        : [];
      const nextName = String(user.name || user.nombre_completo || user.nombre_usuario || "Usuario").trim();

      setRoleState(nextRole);
      setPermissionsState(nextPermissions);
      setUserNameState(nextName || "Usuario");

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
    void refreshSession();
    // Solo al montar el proveedor. El middleware consulta MySQL en cada petición;
    // refreshSession actualiza además el menú visible del frontend.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider
      value={{
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