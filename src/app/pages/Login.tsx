import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Mail,
  Lock,
  Truck,
  Eye,
  EyeOff,
  KeyRound,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  UserRound,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";

import logoImage from "../../assets/614cb11181e5d72cb3a39a09d833f4775b7fc7ce.png";
import fondoOficina from "../../assets/fondo-oficina-gl365.jpg";

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_URL || "http://localhost:3001/api";

type AlertType = "error" | "success" | "";

const limpiarTexto = (value: string) => value.trim();

const esCorreoValido = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const validarPasswordSegura = (password: string) => ({
  longitud: password.length >= 8,
  mayuscula: /[A-Z]/.test(password),
  minuscula: /[a-z]/.test(password),
  numero: /[0-9]/.test(password),
  especial: /[^A-Za-z0-9]/.test(password),
});

const passwordCumpleReglas = (password: string) => {
  const reglas = validarPasswordSegura(password);
  return Object.values(reglas).every(Boolean);
};

function PasswordRule({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div
      className={`flex items-center gap-1 text-xs ${
        ok ? "text-green-600" : "text-gray-400"
      }`}
    >
      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { setRole, setUserName } = useAuth();

  const [acceso, setAcceso] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loadingLogin, setLoadingLogin] = useState(false);

  const [alertType, setAlertType] = useState<AlertType>("");
  const [message, setMessage] = useState("");

  const [modalSolicitudOpen, setModalSolicitudOpen] = useState(false);
  const [modalExitoOpen, setModalExitoOpen] = useState(false);

  const [accesoSolicitud, setAccesoSolicitud] = useState("");
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [showNuevaPassword, setShowNuevaPassword] = useState(false);
  const [showConfirmarPassword, setShowConfirmarPassword] = useState(false);
  const [loadingSolicitud, setLoadingSolicitud] = useState(false);
  const [solicitudError, setSolicitudError] = useState("");

  const reglasPassword = validarPasswordSegura(nuevaPassword);

  const mostrarMensaje = (type: AlertType, text: string) => {
    setAlertType(type);
    setMessage(text);
  };

  const limpiarMensaje = () => {
    setAlertType("");
    setMessage("");
  };

  const limpiarSolicitud = () => {
    setAccesoSolicitud("");
    setNuevaPassword("");
    setConfirmarPassword("");
    setShowNuevaPassword(false);
    setShowConfirmarPassword(false);
    setSolicitudError("");
  };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    limpiarMensaje();

    const cleanAcceso = limpiarTexto(acceso);
    const cleanPassword = password.trim();

    if (!cleanAcceso || !cleanPassword) {
      mostrarMensaje("error", "Ingresa tu usuario o correo y contraseña.");
      return;
    }

    if (cleanAcceso.includes("@") && !esCorreoValido(cleanAcceso)) {
      mostrarMensaje("error", "Ingresa un correo electrónico válido.");
      return;
    }

    try {
      setLoadingLogin(true);

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          identificador: cleanAcceso,
          usuario: cleanAcceso,
          email: cleanAcceso,
          password: cleanPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.ok === false) {
        mostrarMensaje(
          "error",
          data.message || "Usuario, correo o contraseña incorrectos."
        );
        return;
      }

      const userData = data.user;

      localStorage.setItem("user", JSON.stringify(userData));

      setRole(userData.role);
      setUserName(userData.name);

      mostrarMensaje("success", `Bienvenido/a ${userData.name}`);

      setTimeout(() => {
        navigate("/dashboard");
      }, 350);
    } catch (error) {
      console.error("Error en login:", error);
      mostrarMensaje("error", "No se pudo conectar con el backend.");
    } finally {
      setLoadingLogin(false);
    }
  };

  const enviarSolicitudCambio = async (e: React.FormEvent) => {
    e.preventDefault();
    setSolicitudError("");

    const cleanAcceso = limpiarTexto(accesoSolicitud);
    const cleanNuevaPassword = nuevaPassword.trim();
    const cleanConfirmarPassword = confirmarPassword.trim();

    if (!cleanAcceso) {
      setSolicitudError("Ingresa tu usuario o correo.");
      return;
    }

    if (cleanAcceso.includes("@") && !esCorreoValido(cleanAcceso)) {
      setSolicitudError("Ingresa un correo electrónico válido.");
      return;
    }

    if (!cleanNuevaPassword) {
      setSolicitudError("Ingresa la nueva contraseña que deseas solicitar.");
      return;
    }

    if (!passwordCumpleReglas(cleanNuevaPassword)) {
      setSolicitudError("La contraseña debe cumplir todas las reglas indicadas.");
      return;
    }

    if (cleanNuevaPassword !== cleanConfirmarPassword) {
      setSolicitudError("La confirmación de contraseña no coincide.");
      return;
    }

    try {
      setLoadingSolicitud(true);

      const response = await fetch(
        `${API_BASE_URL}/auth/solicitar-cambio-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            identificador: cleanAcceso,
            usuario: cleanAcceso,
            email: cleanAcceso,
            nuevaPassword: cleanNuevaPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || data.ok === false) {
        setSolicitudError(
          data.message || "No se pudo enviar la solicitud a Gerencia."
        );
        return;
      }

      setModalSolicitudOpen(false);
      limpiarSolicitud();
      setModalExitoOpen(true);
    } catch (error) {
      console.error("Error al solicitar cambio:", error);
      setSolicitudError("No se pudo conectar con el backend.");
    } finally {
      setLoadingSolicitud(false);
    }
  };

  return (
    <>
      <div className="h-screen overflow-hidden flex flex-col bg-white">
        {/* HEADER */}
        <header className="h-[58px] bg-white flex items-center px-6 shadow-sm border-b border-gray-100 shrink-0">
          <img
            src={logoImage}
            alt="Grupo Logístico 365"
            className="h-11 object-contain"
          />
        </header>

        <div className="flex flex-1 min-h-0">
          {/* LADO IZQUIERDO */}
          <div className="w-full lg:w-1/2 bg-[#0C2D6B] flex items-center justify-center px-6 py-6">
            <div className="w-full max-w-[390px]">
              <h1 className="text-3xl font-bold text-[#FF6A00] text-center mb-1">
                Grupo Logístico 365
              </h1>

              <p className="text-blue-100 text-center text-xs mb-6">
                Sistema de Gestión Operativa
              </p>

              <div className="bg-white rounded-xl shadow-2xl px-7 py-6">
                <h2 className="text-lg font-bold text-[#0C2D6B] text-center mb-5">
                  Iniciar Sesión
                </h2>

                {message && (
                  <div
                    className={`mb-4 rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${
                      alertType === "success"
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-red-50 text-red-700 border border-red-200"
                    }`}
                  >
                    {alertType === "success" ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                    )}

                    <span>{message}</span>
                  </div>
                )}

                <form onSubmit={login} className="space-y-4" noValidate>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Usuario o correo
                    </label>

                    <div className="relative">
                      <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />

                      <input
                        type="text"
                        value={acceso}
                        onChange={(e) => {
                          setAcceso(e.target.value);
                          limpiarMensaje();
                        }}
                        className="w-full h-11 rounded-lg border border-gray-300 pl-10 pr-4 outline-none text-sm focus:ring-2 focus:ring-[#0C2D6B]/30 focus:border-[#0C2D6B]"
                        placeholder="Ingresa tu usuario o correo"
                        autoComplete="username"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Contraseña
                    </label>

                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />

                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          limpiarMensaje();
                        }}
                        className="w-full h-11 rounded-lg border border-gray-300 pl-10 pr-10 outline-none text-sm focus:ring-2 focus:ring-[#0C2D6B]/30 focus:border-[#0C2D6B]"
                        placeholder="Ingresa tu contraseña"
                        autoComplete="current-password"
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0C2D6B] transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loadingLogin}
                    className="w-full h-11 rounded-lg bg-[#0C2D6B] text-white font-bold hover:bg-[#143C8C] active:bg-[#FF6A00] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {loadingLogin ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Ingresando...
                      </>
                    ) : (
                      "Ingresar"
                    )}
                  </button>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        limpiarSolicitud();
                        setAccesoSolicitud(acceso);
                        setModalSolicitudOpen(true);
                      }}
                      className="text-xs text-[#0C2D6B] hover:text-[#FF6A00] underline underline-offset-2 font-semibold transition-colors"
                    >
                      Solicitar cambio de contraseña
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* LADO DERECHO */}
          <div
            className="hidden lg:block lg:w-1/2 relative overflow-hidden bg-cover bg-center"
            style={{
              backgroundImage: `url(${fondoOficina})`,
            }}
          >
            <div className="absolute inset-0 bg-[#0C2D6B]/55" />

            <div className="absolute inset-0 flex items-center justify-center text-center p-10">
              <div>
                <Truck className="w-14 h-14 text-[#FF6A00] mx-auto mb-4" />

                <h2 className="text-white text-2xl font-bold mb-2">
                  Control Logístico Inteligente
                </h2>

                <p className="text-blue-100 text-sm">
                  Optimiza rutas, costos y operaciones en tiempo real
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL SOLICITAR CAMBIO */}
      {modalSolicitudOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-[#0C2D6B] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <KeyRound className="w-5 h-5 text-white" />

                <h2 className="text-white font-bold text-lg">
                  Solicitar cambio de contraseña
                </h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  setModalSolicitudOpen(false);
                  limpiarSolicitud();
                }}
                className="text-white/70 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={enviarSolicitudCambio} className="p-6 space-y-4">
              <div className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3 leading-relaxed">
                Ingrese su usuario o correo y la nueva contraseña que desea
                utilizar. La solicitud quedará en estado{" "}
                <strong>pendiente</strong> hasta que Gerencia la autorice.
              </div>

              {solicitudError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{solicitudError}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Usuario o correo
                </label>

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />

                  <input
                    type="text"
                    value={accesoSolicitud}
                    onChange={(e) => {
                      setAccesoSolicitud(e.target.value);
                      setSolicitudError("");
                    }}
                    className="w-full pl-10 pr-4 h-11 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0C2D6B]/30 focus:border-[#0C2D6B]"
                    placeholder="Ingresa tu usuario o correo"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Nueva contraseña solicitada
                </label>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />

                  <input
                    type={showNuevaPassword ? "text" : "password"}
                    value={nuevaPassword}
                    onChange={(e) => {
                      setNuevaPassword(e.target.value);
                      setSolicitudError("");
                    }}
                    className="w-full pl-10 pr-10 h-11 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0C2D6B]/30 focus:border-[#0C2D6B]"
                    placeholder="Nueva contraseña"
                    required
                  />

                  <button
                    type="button"
                    onClick={() => setShowNuevaPassword(!showNuevaPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0C2D6B] transition-colors"
                  >
                    {showNuevaPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {nuevaPassword && (
                  <div className="mt-2 space-y-1">
                    <PasswordRule
                      ok={reglasPassword.longitud}
                      text="Mínimo 8 caracteres"
                    />
                    <PasswordRule
                      ok={reglasPassword.mayuscula}
                      text="Al menos una letra mayúscula"
                    />
                    <PasswordRule
                      ok={reglasPassword.minuscula}
                      text="Al menos una letra minúscula"
                    />
                    <PasswordRule
                      ok={reglasPassword.numero}
                      text="Al menos un número"
                    />
                    <PasswordRule
                      ok={reglasPassword.especial}
                      text="Al menos un carácter especial"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Confirmar nueva contraseña
                </label>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />

                  <input
                    type={showConfirmarPassword ? "text" : "password"}
                    value={confirmarPassword}
                    onChange={(e) => {
                      setConfirmarPassword(e.target.value);
                      setSolicitudError("");
                    }}
                    className="w-full pl-10 pr-10 h-11 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0C2D6B]/30 focus:border-[#0C2D6B]"
                    placeholder="Confirma la contraseña"
                    required
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmarPassword(!showConfirmarPassword)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0C2D6B] transition-colors"
                  >
                    {showConfirmarPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalSolicitudOpen(false);
                    limpiarSolicitud();
                  }}
                  className="flex-1 h-11 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={loadingSolicitud}
                  className="flex-1 h-11 rounded-lg bg-[#FF6A00] text-white text-sm font-bold hover:bg-orange-600 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {loadingSolicitud ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Enviar solicitud"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SOLICITUD ENVIADA */}
      {modalExitoOpen && (
        <div className="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9 text-green-600" />
            </div>

            <h2 className="text-xl font-bold text-gray-800 mb-2">
              Solicitud enviada
            </h2>

            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              La solicitud de cambio de contraseña fue registrada correctamente
              y enviada a Gerencia.
              <br />
              <br />
              La nueva contraseña se habilitará únicamente cuando la solicitud
              sea autorizada.
            </p>

            <button
              type="button"
              onClick={() => setModalExitoOpen(false)}
              className="w-full h-11 rounded-lg bg-[#0C2D6B] text-white font-bold hover:bg-[#143C8C] transition-colors"
            >
              Aceptar
            </button>
          </div>
        </div>
      )}
    </>
  );
}