import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type UserRole =
  | "administrador"
  | "gerencia"
  | "ventas"
  | "operaciones"
  | "logistica"
  | "facturacion"
  | "finanzas"
  | "compras"
  | "mensajeria";

interface AuthContextType {
  role: UserRole | null;
  setRole: (role: UserRole | null) => void;
  userName: string;
  setUserName: (name: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const validRoles: UserRole[] = [
  "administrador",
  "gerencia",
  "ventas",
  "operaciones",
  "logistica",
  "facturacion",
  "finanzas",
  "compras",
  "mensajeria",
];

function normalizeRole(value: any): UserRole | null {
  const role = String(value || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (role === "administracion") return "administrador";
  if (role === "admin") return "administrador";
  if (role === "logística") return "logistica";
  if (role === "facturación") return "facturacion";
  if (role === "operacion") return "operaciones";
  if (role === "operación") return "operaciones";
  if (role === "mensajeria externa") return "mensajeria";
  if (role === "mensajería externa") return "mensajeria";

  return validRoles.includes(role as UserRole) ? (role as UserRole) : null;
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

  const directRole = normalizeRole(localStorage.getItem("role"));

  return directRole;
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

function saveUserPatch(role: UserRole | null, userName: string) {
  const currentUser = getStoredUser() || {};

  const updatedUser = {
    ...currentUser,
    role,
    nombre_completo: userName,
  };

  localStorage.setItem("user", JSON.stringify(updatedUser));
  localStorage.setItem("gl365_user", JSON.stringify(updatedUser));

  if (role) {
    localStorage.setItem("role", role);
  } else {
    localStorage.removeItem("role");
  }

  localStorage.setItem("userName", userName);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [roleState, setRoleState] = useState<UserRole | null>(() =>
    getStoredRole()
  );

  const [userNameState, setUserNameState] = useState<string>(() =>
    getStoredUserName()
  );

  const setRole = (newRole: UserRole | null) => {
    setRoleState(newRole);
    saveUserPatch(newRole, userNameState);
  };

  const setUserName = (name: string) => {
    const cleanName = String(name || "Usuario").trim() || "Usuario";

    setUserNameState(cleanName);
    saveUserPatch(roleState, cleanName);
  };

  const logout = () => {
    fetch("/api/auth/logout", {
      method: "POST",
      keepalive: true,
    }).catch(() => {
      // Aunque falle la llamada, se limpia la sesión local.
    });
    localStorage.removeItem("user");
    localStorage.removeItem("gl365_user");
    localStorage.removeItem("usuario");
    localStorage.removeItem("gl365_usuario");
    localStorage.removeItem("token");
    localStorage.removeItem("gl365_token");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("role");
    localStorage.removeItem("userName");

    setRoleState(null);
    setUserNameState("Usuario");

    window.location.href = "/login";
  };

  useEffect(() => {
    saveUserPatch(roleState, userNameState);
  }, [roleState, userNameState]);

  return (
    <AuthContext.Provider
      value={{
        role: roleState,
        setRole,
        userName: userNameState,
        setUserName,
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
  userName: "Usuario",
  setUserName: () => {},
  logout: () => {},
};

export function useAuth() {
  const context = useContext(AuthContext);

  return context ?? defaultAuth;
}