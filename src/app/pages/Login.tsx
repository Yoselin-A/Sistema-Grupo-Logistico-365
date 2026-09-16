import { useRef, useState } from "react";
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
  Route,
  MapPinned,
  PackageCheck,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";

import logoImage from "../../assets/614cb11181e5d72cb3a39a09d833f4775b7fc7ce.png";
import fondoOficina from "../../assets/fondo-oficina-gl365.jpg";

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_URL || "/api";

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
      className={`flex items-center gap-1.5 text-xs ${
        ok ? "text-green-600" : "text-gray-400"
      }`}
    >
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { setRole, setUserName } = useAuth();

  const loginFormRef = useRef<HTMLFormElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

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
      {/*
        UNA SOLA PANTALLA:
        h-screen + overflow-hidden evita que el login principal genere scroll.
        Los modales sí pueden desplazarse internamente en pantallas pequeñas.
      */}
      <style>{`
        @keyframes glFadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes glFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes glTruckFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }

        @keyframes glGlow {
          0%, 100% { opacity: .35; transform: scale(1); }
          50% { opacity: .7; transform: scale(1.12); }
        }

        @keyframes glRouteMove {
          0% {
            left: 12%;
            opacity: 0;
            transform: translate(-50%, -50%) scale(.88);
          }
          10% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          88% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            left: 88%;
            opacity: 0;
            transform: translate(-50%, -50%) scale(.88);
          }
        }

        @keyframes glShine {
          0% { transform: translateX(-130%) skewX(-18deg); }
          55%, 100% { transform: translateX(230%) skewX(-18deg); }
        }

        .gl-fade-up { animation: glFadeUp .65s ease-out both; }
        .gl-fade-up-delay { animation: glFadeUp .75s .12s ease-out both; }
        .gl-fade-in { animation: glFadeIn .8s ease-out both; }
        .gl-truck-float { animation: glTruckFloat 3.2s ease-in-out infinite; }
        .gl-glow { animation: glGlow 5s ease-in-out infinite; }
        .gl-route-cargo {
          animation: glRouteMove 6.2s linear infinite;
          box-shadow:
            0 0 0 1px rgba(255,255,255,.12),
            0 8px 22px rgba(0,0,0,.24),
            0 0 18px rgba(255,106,0,.28);
        }

        .gl-route-cargo::after {
          content: "";
          position: absolute;
          right: 100%;
          top: 50%;
          width: 28px;
          height: 1px;
          transform: translateY(-50%);
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255,138,50,.72)
          );
        }

        .gl-login-button { position: relative; overflow: hidden; }
        .gl-login-button::after {
          content: "";
          position: absolute;
          top: -30%;
          bottom: -30%;
          width: 38%;
          left: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.22), transparent);
          animation: glShine 4.2s ease-in-out infinite;
          pointer-events: none;
        }

        .gl-feature-card { transition: transform .25s ease, background-color .25s ease, border-color .25s ease; }
        .gl-feature-card:hover { transform: translateY(-4px); background-color: rgba(255,255,255,.15); border-color: rgba(255,138,50,.55); }

        @media (prefers-reduced-motion: reduce) {
          .gl-fade-up, .gl-fade-up-delay, .gl-fade-in, .gl-truck-float, .gl-glow, .gl-route-cargo, .gl-login-button::after {
            animation: none !important;
          }
        }

        @media (max-height: 760px) {
          .gl-login-brand { margin-bottom: .6rem !important; }
          .gl-login-card { padding-top: 1.15rem !important; padding-bottom: 1.15rem !important; }
          .gl-login-card-title { margin-bottom: .8rem !important; }
          .gl-login-field { height: 46px !important; }
          .gl-login-submit { height: 48px !important; }
          .gl-login-form { gap: .65rem !important; }
          .gl-login-foot { margin-top: .5rem !important; }
          .gl-hero-features { margin-top: 1rem !important; }
          .gl-hero-bottom { margin-top: .8rem !important; }
        }
      `}</style>

      <div className="h-screen overflow-hidden bg-white flex flex-col">
        {/* HEADER */}
        <header className="h-[60px] shrink-0 bg-white border-b border-gray-100 shadow-sm flex items-center justify-between px-5 lg:px-7">
          <img
            src={logoImage}
            alt="Grupo Logístico 365"
            className="h-11 object-contain"
          />

          <div className="hidden md:flex items-center gap-2 rounded-full border border-gray-100 bg-gray-50 px-4 py-2 text-[11px] font-semibold text-gray-500">
            <Truck className="h-4 w-4 text-[#FF6A00]" />
            Transporte · Logística · Operaciones
          </div>
        </header>

        <main className="flex flex-1 min-h-0">
          {/* LOGIN GRANDE Y PROFESIONAL */}
          <section className="relative w-full lg:w-1/2 bg-[#0C2D6B] flex items-center justify-center px-5 lg:px-10 py-3 overflow-hidden">
            <div className="gl-glow absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#FF6A00]/15 blur-3xl" />
            <div className="absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-white/[0.06] blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(255,255,255,0.06),transparent_25%)]" />

            <div className="relative z-10 w-full max-w-[500px]">
              <div className="gl-login-brand gl-fade-up text-center mb-4">
                <h1 className="text-[31px] lg:text-[36px] leading-tight font-extrabold tracking-tight text-white">
                  Grupo Logístico <span className="text-[#FF6A00]">365</span>
                </h1>

                <p className="mt-2 text-[15px] text-blue-100">
                  Sistema de gestión para transporte de carga, viajes y operaciones logísticas
                </p>
              </div>

              <div className="gl-login-card gl-fade-up-delay relative overflow-hidden rounded-[24px] bg-white px-8 py-8 shadow-[0_24px_70px_rgba(2,12,35,0.38)] border border-white/90">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#0C2D6B] via-[#FF6A00] to-[#0C2D6B]" />

                <div className="gl-login-card-title mb-4 text-center">
                  <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-[#0C2D6B]/[0.06]">
                    <Lock className="h-5 w-5 text-[#0C2D6B]" />
                  </div>
                  <h2 className="text-[26px] font-extrabold tracking-tight text-[#0C2D6B]">
                    Iniciar sesión
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Accede al control de transporte, rutas y entregas de GL365
                  </p>
                </div>

                {message && (
                  <div
                    className={`mb-4 rounded-xl px-4 py-3 text-sm flex items-center gap-2 ${
                      alertType === "success"
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-red-50 text-red-700 border border-red-200"
                    }`}
                  >
                    {alertType === "success" ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                    )}
                    <span>{message}</span>
                  </div>
                )}

                <form
                  ref={loginFormRef}
                  onSubmit={login}
                  className="gl-login-form flex flex-col gap-4"
                  noValidate
                >
                  <div>
                    <label className="mb-1.5 block text-sm font-bold text-gray-700">
                      Usuario o correo
                    </label>
                    <div className="group relative">
                      <UserRound className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 transition group-focus-within:text-[#FF6A00]" />
                      <input
                        type="text"
                        value={acceso}
                        onChange={(e) => {
                          setAcceso(e.target.value);
                          limpiarMensaje();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            passwordInputRef.current?.focus();
                          }
                        }}
                        className="gl-login-field h-[54px] w-full rounded-2xl border border-gray-300 bg-white pl-12 pr-4 text-[15px] outline-none transition-all duration-200 focus:border-[#0C2D6B] focus:ring-4 focus:ring-[#0C2D6B]/10"
                        placeholder="Ingresa tu usuario o correo"
                        autoComplete="username"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-bold text-gray-700">
                      Contraseña
                    </label>
                    <div className="group relative">
                      <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 transition group-focus-within:text-[#FF6A00]" />
                      <input
                        ref={passwordInputRef}
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          limpiarMensaje();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();

                            if (!loadingLogin) {
                              loginFormRef.current?.requestSubmit();
                            }
                          }
                        }}
                        className="gl-login-field h-[54px] w-full rounded-2xl border border-gray-300 bg-white pl-12 pr-12 text-[15px] outline-none transition-all duration-200 focus:border-[#0C2D6B] focus:ring-4 focus:ring-[#0C2D6B]/10"
                        placeholder="Ingresa tu contraseña"
                        autoComplete="current-password"
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition hover:bg-blue-50 hover:text-[#0C2D6B]"
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loadingLogin}
                    className="gl-login-button gl-login-submit mt-1 flex h-[54px] w-full items-center justify-center gap-2.5 rounded-2xl bg-[#0C2D6B] text-[17px] font-extrabold text-white shadow-[0_10px_24px_rgba(12,45,107,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#143C8C] hover:shadow-[0_14px_30px_rgba(12,45,107,0.35)] active:translate-y-0 active:bg-[#FF6A00] disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    {loadingLogin ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Ingresando...
                      </>
                    ) : (
                      <>
                        <Truck className="h-5 w-5" />
                        Ingresar al sistema
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-3 py-1">
                    <div className="h-px flex-1 bg-gray-100" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                      Acceso seguro
                    </span>
                    <div className="h-px flex-1 bg-gray-100" />
                  </div>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        limpiarSolicitud();
                        setAccesoSolicitud(acceso);
                        setModalSolicitudOpen(true);
                      }}
                      className="text-sm font-semibold text-[#0C2D6B] underline decoration-[#FF6A00]/50 underline-offset-4 transition hover:text-[#FF6A00]"
                    >
                      Solicitar cambio de contraseña
                    </button>
                  </div>
                </form>
              </div>

              <div className="gl-login-foot gl-fade-in mt-3 flex items-center justify-center gap-2 text-xs text-blue-100">
                <span className="h-2 w-2 rounded-full bg-[#FF6A00] shadow-[0_0_10px_rgba(255,106,0,.65)]" />
                Control de transporte, rutas, viajes, flota y entregas
              </div>
            </div>
          </section>

          {/* HERO LOGÍSTICO */}
          <section
            className="hidden lg:block lg:w-1/2 relative overflow-hidden bg-cover bg-center"
            style={{ backgroundImage: `url(${fondoOficina})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#0C2D6B]/78 via-[#0C2D6B]/58 to-[#071E49]/86" />
            <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#061B42]/90 to-transparent" />
            <div className="gl-glow absolute right-[8%] top-[7%] h-44 w-44 rounded-full bg-[#FF6A00]/10 blur-3xl" />

            {/* Ruta animada */}

            <div className="relative z-10 flex h-full items-center justify-center px-10 xl:px-14">
              <div className="gl-fade-up w-full max-w-[640px] text-center text-white">
                <div className="mx-auto mb-4 flex h-[82px] w-[82px] items-center justify-center rounded-[26px] border border-white/20 bg-white/10 backdrop-blur-md shadow-2xl">
                  <Truck className="h-11 w-11 text-[#FF6A00]" />
                </div>

                <p className="mb-3 text-[12px] font-extrabold uppercase tracking-[0.30em] text-[#FFB27A]">
                  Transporte terrestre y logística
                </p>

                <div className="relative mx-auto mb-5 h-10 w-full max-w-[560px]">
                  <div className="absolute left-[8%] right-[8%] top-1/2 h-px -translate-y-1/2 border-t border-dashed border-white/30" />

                  <div className="absolute left-[8%] top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full border border-[#FF8A32]/70 bg-[#0C2D6B] shadow-[0_0_10px_rgba(255,106,0,.28)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#FF8A32]" />
                  </div>

                  <div className="absolute right-[8%] top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full border border-[#FF8A32]/70 bg-[#0C2D6B] shadow-[0_0_10px_rgba(255,106,0,.28)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#FF8A32]" />
                  </div>

                  <div className="gl-route-cargo absolute top-1/2 z-20 flex h-9 w-11 -translate-y-1/2 items-center justify-center rounded-xl border border-white/20 bg-[#102F6E]/95 backdrop-blur-md">
                    <Truck className="h-5 w-5 text-[#FF8A32]" />
                  </div>
                </div>

                <h2 className="mx-auto max-w-[610px] text-[29px] xl:text-[35px] font-extrabold leading-[1.16] tracking-tight">
                  Movemos cada operación con control,
                  <span className="text-[#FF8A32]">
                    {" "}trazabilidad y eficiencia.
                  </span>
                </h2>

                <p className="mx-auto mt-3 max-w-[550px] text-[14px] leading-relaxed text-blue-100">
                  Centraliza viajes de carga, rutas, unidades, clientes, costos y entregas
                  para mantener la operación de transporte organizada de principio a fin.
                </p>

                <div className="gl-hero-features mx-auto mt-5 grid max-w-[590px] grid-cols-3 gap-3">
                  <div className="gl-feature-card rounded-2xl border border-white/15 bg-white/10 px-4 py-4 backdrop-blur-sm">
                    <Route className="mx-auto mb-2 h-6 w-6 text-[#FF8A32]" />
                    <p className="text-sm font-bold">Rutas</p>
                    <p className="mt-0.5 text-[11px] text-blue-100">Origen y destino</p>
                  </div>

                  <div className="gl-feature-card rounded-2xl border border-white/15 bg-white/10 px-4 py-4 backdrop-blur-sm">
                    <MapPinned className="mx-auto mb-2 h-6 w-6 text-[#FF8A32]" />
                    <p className="text-sm font-bold">Viajes</p>
                    <p className="mt-0.5 text-[11px] text-blue-100">Seguimiento operativo</p>
                  </div>

                  <div className="gl-feature-card rounded-2xl border border-white/15 bg-white/10 px-4 py-4 backdrop-blur-sm">
                    <PackageCheck className="mx-auto mb-2 h-6 w-6 text-[#FF8A32]" />
                    <p className="text-sm font-bold">Entregas</p>
                    <p className="mt-0.5 text-[11px] text-blue-100">Control de servicio</p>
                  </div>
                </div>

                <div className="gl-hero-bottom mx-auto mt-5 flex max-w-[540px] items-center justify-center gap-3 rounded-2xl border border-white/15 bg-[#071E49]/40 px-5 py-3.5 backdrop-blur-md shadow-xl">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF6A00]/15">
                    <Truck className="h-5 w-5 text-[#FF8A32]" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-white">
                      Grupo Logístico 365
                    </p>
                    <p className="text-[11px] text-blue-100">
                      Plataforma de control para una operación de transporte más eficiente.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* MODAL SOLICITAR CAMBIO */}
      {modalSolicitudOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between bg-[#0C2D6B] px-6 py-4">
              <div className="flex items-center gap-3">
                <KeyRound className="h-5 w-5 text-white" />
                <h2 className="text-lg font-bold text-white">
                  Solicitar cambio de contraseña
                </h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  setModalSolicitudOpen(false);
                  limpiarSolicitud();
                }}
                className="text-white/70 transition hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={enviarSolicitudCambio} className="space-y-4 p-6">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm leading-relaxed text-gray-600">
                Ingrese su usuario o correo y la nueva contraseña que desea utilizar.
                La solicitud quedará en estado <strong>pendiente</strong> hasta que
                Gerencia la autorice.
              </div>

              {solicitudError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{solicitudError}</span>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Usuario o correo
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={accesoSolicitud}
                    onChange={(e) => {
                      setAccesoSolicitud(e.target.value);
                      setSolicitudError("");
                    }}
                    className="h-11 w-full rounded-lg border border-gray-300 pl-10 pr-4 text-sm outline-none focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/30"
                    placeholder="Ingresa tu usuario o correo"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Nueva contraseña solicitada
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showNuevaPassword ? "text" : "password"}
                    value={nuevaPassword}
                    onChange={(e) => {
                      setNuevaPassword(e.target.value);
                      setSolicitudError("");
                    }}
                    className="h-11 w-full rounded-lg border border-gray-300 pl-10 pr-10 text-sm outline-none focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/30"
                    placeholder="Nueva contraseña"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNuevaPassword(!showNuevaPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-[#0C2D6B]"
                  >
                    {showNuevaPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {nuevaPassword && (
                  <div className="mt-2 space-y-1">
                    <PasswordRule ok={reglasPassword.longitud} text="Mínimo 8 caracteres" />
                    <PasswordRule ok={reglasPassword.mayuscula} text="Al menos una letra mayúscula" />
                    <PasswordRule ok={reglasPassword.minuscula} text="Al menos una letra minúscula" />
                    <PasswordRule ok={reglasPassword.numero} text="Al menos un número" />
                    <PasswordRule ok={reglasPassword.especial} text="Al menos un carácter especial" />
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Confirmar nueva contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showConfirmarPassword ? "text" : "password"}
                    value={confirmarPassword}
                    onChange={(e) => {
                      setConfirmarPassword(e.target.value);
                      setSolicitudError("");
                    }}
                    className="h-11 w-full rounded-lg border border-gray-300 pl-10 pr-10 text-sm outline-none focus:border-[#0C2D6B] focus:ring-2 focus:ring-[#0C2D6B]/30"
                    placeholder="Confirma la contraseña"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmarPassword(!showConfirmarPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-[#0C2D6B]"
                  >
                    {showConfirmarPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
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
                  className="h-11 flex-1 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={loadingSolicitud}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#FF6A00] text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-70"
                >
                  {loadingSolicitud ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
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
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-9 w-9 text-green-600" />
            </div>

            <h2 className="mb-2 text-xl font-bold text-gray-800">
              Solicitud enviada
            </h2>

            <p className="mb-6 text-sm leading-relaxed text-gray-600">
              La solicitud de cambio de contraseña fue registrada correctamente y
              enviada a Gerencia.
              <br />
              <br />
              La nueva contraseña se habilitará únicamente cuando la solicitud sea
              autorizada.
            </p>

            <button
              type="button"
              onClick={() => setModalExitoOpen(false)}
              className="h-11 w-full rounded-lg bg-[#0C2D6B] font-bold text-white transition hover:bg-[#143C8C]"
            >
              Aceptar
            </button>
          </div>
        </div>
      )}
    </>
  );
}