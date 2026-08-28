import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  AlertTriangle,
  Bot,
  Brain,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Database,
  Gauge,
  MapPin,
  RefreshCw,
  X,
  Route as RouteIcon,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Truck,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";
import { Card } from "../components/ui/Card";

const API_BASE_URL = "/api";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  createdAt: string;
  provider?: string;
  warning?: string | null;
}

interface IABootstrapData {
  summary: {
    generatedAt?: string;
    viajesTotal?: number;
    viajesActivos: number;
    viajesRetraso: number;
    viajesCriticos: number;
    vehiculosDisponibles: number;
    vehiculosMantenimiento: number;
    saldoPorCobrar: number;
    saldoVencido: number;
    oportunidadesActivas: number;
    pipelinePonderado: number;
    proveedoresRiesgo: number;
    margenOperativo: number;
    clientes?: number;
    rutas?: number;
    comprobantes?: number;
    asignaciones?: number;
    vehiculos?: number;
    proveedores?: number;
    cotizaciones?: number;
  };
  logistics: {
    viajes: any[];
    alertas: any[];
  };
  fleet: {
    vehiculos: any[];
  };
  finance: {
    comprobantes: any[];
    operaciones: any[];
  };
  commercial: {
    oportunidades: any[];
  };
  suppliers: {
    proveedores: any[];
  };
  routes: {
    rutas: any[];
  };
}

const EMPTY_CONTEXT: IABootstrapData = {
  summary: {
    viajesActivos: 0,
    viajesRetraso: 0,
    viajesCriticos: 0,
    vehiculosDisponibles: 0,
    vehiculosMantenimiento: 0,
    saldoPorCobrar: 0,
    saldoVencido: 0,
    oportunidadesActivas: 0,
    pipelinePonderado: 0,
    proveedoresRiesgo: 0,
    margenOperativo: 0,
    clientes: 0,
    rutas: 0,
    comprobantes: 0,
    asignaciones: 0,
    vehiculos: 0,
    proveedores: 0,
    cotizaciones: 0,
  },
  logistics: {
    viajes: [],
    alertas: [],
  },
  fleet: {
    vehiculos: [],
  },
  finance: {
    comprobantes: [],
    operaciones: [],
  },
  commercial: {
    oportunidades: [],
  },
  suppliers: {
    proveedores: [],
  },
  routes: {
    rutas: [],
  },
};

function n(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown) {
  return `Q ${n(value).toLocaleString("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function cleanAiText(value: unknown) {
  return String(value ?? "").replace(/\*\*/g, "");
}

function pct(value: unknown) {
  return `${n(value).toLocaleString("es-GT", {
    maximumFractionDigits: 1,
  })}%`;
}


function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}


function normalizeApiContext(raw: any): IABootstrapData {
  const summary = {
    ...EMPTY_CONTEXT.summary,
    ...(raw?.summary || {}),
  };

  return {
    ...EMPTY_CONTEXT,
    ...(raw || {}),
    summary,
    logistics: {
      viajes: Array.isArray(raw?.logistics?.viajes) ? raw.logistics.viajes : [],
      alertas: Array.isArray(raw?.logistics?.alertas) ? raw.logistics.alertas : [],
    },
    fleet: {
      vehiculos: Array.isArray(raw?.fleet?.vehiculos) ? raw.fleet.vehiculos : [],
    },
    finance: {
      comprobantes: Array.isArray(raw?.finance?.comprobantes) ? raw.finance.comprobantes : [],
      operaciones: Array.isArray(raw?.finance?.operaciones) ? raw.finance.operaciones : [],
    },
    commercial: {
      oportunidades: Array.isArray(raw?.commercial?.oportunidades) ? raw.commercial.oportunidades : [],
    },
    suppliers: {
      proveedores: Array.isArray(raw?.suppliers?.proveedores) ? raw.suppliers.proveedores : [],
    },
    routes: {
      rutas: Array.isArray(raw?.routes?.rutas) ? raw.routes.rutas : [],
    },
  };
}


export function IALogistica() {
  const [context, setContext] = useState<IABootstrapData>(EMPTY_CONTEXT);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [provider, setProvider] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [thinking, setThinking] = useState(false);
  const [input, setInput] = useState("");

  const [chat, setChat] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text:
        "Hola, soy GL365 Intelligence.\n\n" +
        "Puedo analizar la información real de MySQL para ayudarte con logística, flota, cobranza, rentabilidad, ventas y proveedores.\n\n" +
        "Probá preguntándome: ¿Qué requiere atención hoy?",
      createdAt: new Date().toISOString(),
      provider: "Sistema",
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const loadContext = async () => {
    setLoading(true);
    setApiError("");

    try {
      const response = await fetch(`${API_BASE_URL}/ia/bootstrap`);
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.message || "No se pudo cargar la información de IA.");
      }

      setContext(normalizeApiContext(payload?.data || {}));
      setDiagnostics(payload?.diagnostics || null);
      setProvider(payload?.provider || null);
    } catch (error: any) {
      console.error("Error IA Logística:", error);
      setApiError(error?.message || "No se pudo conectar con la API de IA logística.");
      setContext(EMPTY_CONTEXT);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContext();
  }, []);

  // Se deja sin scroll automático para que la pantalla no se baje sola.
  // El usuario puede revisar la conversación manualmente dentro del panel del chat.

  const summary = context.summary;

  const priorityItems = useMemo(() => {
    const items: {
      level: "critical" | "warning" | "good";
      title: string;
      detail: string;
    }[] = [];

    if (summary.viajesCriticos > 0) {
      items.push({
        level: "critical",
        title: `${summary.viajesCriticos} viaje(s) crítico(s)`,
        detail: "Requieren revisión inmediata en Logística.",
      });
    }

    if (summary.viajesRetraso > 0) {
      items.push({
        level: "warning",
        title: `${summary.viajesRetraso} viaje(s) con retraso`,
        detail: "Validar incidencia, ETA y comunicación con cliente.",
      });
    }

    if (summary.saldoVencido > 0) {
      items.push({
        level: "warning",
        title: `${money(summary.saldoVencido)} vencido`,
        detail: "Existen comprobantes vencidos según estado oficial.",
      });
    }

    if (summary.proveedoresRiesgo > 0) {
      items.push({
        level: "warning",
        title: `${summary.proveedoresRiesgo} proveedor(es) a revisar`,
        detail: "Hay señales de cumplimiento o desempeño que necesitan seguimiento.",
      });
    }

    if (summary.vehiculosMantenimiento > 0) {
      items.push({
        level: "warning",
        title: `${summary.vehiculosMantenimiento} vehículo(s) con atención`,
        detail: "Revisar mantenimiento o disponibilidad operativa.",
      });
    }

    if (!items.length) {
      items.push({
        level: "good",
        title: "Sin prioridades críticas",
        detail: "Los indicadores principales se encuentran estables.",
      });
    }

    return items.slice(0, 5);
  }, [summary]);

  const quickPrompts = [
    {
      label: "Informe PRO",
      value: "Dame un informe ejecutivo profesional del sistema GL365 con hallazgos clave, riesgos, prioridades y acciones recomendadas para gerencia.",
      icon: Sparkles,
    },
    {
      label: "Plan de acción",
      value: "Genera un plan de acción gerencial con prioridades, responsables sugeridos y acciones concretas para mejorar logística, cobranza, flota y ventas.",
      icon: ShieldCheck,
    },
    {
      label: "Resumen gerencial",
      value: "Dame un resumen gerencial del sistema",
      icon: Brain,
    },
    {
      label: "Riesgos de hoy",
      value: "¿Qué requiere atención hoy?",
      icon: AlertTriangle,
    },
    {
      label: "Viajes con retraso",
      value: "Muéstrame los viajes con retraso",
      icon: Truck,
    },
    {
      label: "Viajes críticos",
      value: "Muéstrame los viajes críticos",
      icon: XCircle,
    },
    {
      label: "Flota disponible",
      value: "¿Qué vehículos están disponibles?",
      icon: Gauge,
    },
    {
      label: "Mantenimiento",
      value: "¿Qué vehículos requieren mantenimiento?",
      icon: Wrench,
    },
    {
      label: "Cobranza",
      value: "Analiza la cobranza y los saldos vencidos",
      icon: CircleDollarSign,
    },
    {
      label: "Rentabilidad",
      value: "Analiza la rentabilidad de las operaciones",
      icon: TrendingUp,
    },
    {
      label: "Pipeline comercial",
      value: "Analiza las oportunidades comerciales",
      icon: Users,
    },
    {
      label: "Proveedores",
      value: "¿Qué proveedores requieren revisión?",
      icon: Building2,
    },
  ];

  const send = async (forcedText?: string) => {
    const question = String(forcedText ?? input).trim();

    if (!question || thinking) return;

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: question,
      createdAt: new Date().toISOString(),
    };

    setChat((prev) => [...prev, userMessage]);
    setInput("");
    setThinking(true);

    try {
      const response = await fetch(`${API_BASE_URL}/ia/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: question }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.message || "No se pudo procesar la pregunta.");
      }

      if (payload?.summary) {
        setContext((prev) => ({
          ...prev,
          summary: {
            ...prev.summary,
            ...payload.summary,
          },
        }));
      }

      setDiagnostics(payload?.diagnostics || diagnostics);
      setProvider(payload?.provider || provider);

      setChat((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: payload?.answer || "No se recibió respuesta de la IA.",
          createdAt: new Date().toISOString(),
          provider: payload?.provider?.name === "groq" ? `Groq · ${payload?.provider?.model || "modelo"}` : "Análisis local",
          warning: payload?.warning || payload?.provider?.warning || null,
        },
      ]);
    } catch (error: any) {
      console.error("Error chat IA:", error);

      setChat((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          text:
            "No pude procesar la consulta con la API de IA.\n\n" +
            `Detalle: ${error?.message || "Error desconocido"}\n\n` +
            "Revisá que el backend esté encendido y que el archivo ia.routes.js actualizado esté instalado.",
          createdAt: new Date().toISOString(),
          provider: "Sistema",
        },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const buildProPrompt = (question: string) => {
    const base = question.trim() || "Dame un análisis gerencial completo del sistema GL365.";

    return (
      "Respondé como asesor gerencial de GL365, usando únicamente los datos reales disponibles en MySQL.\n\n" +
      `Consulta principal: ${base}\n\n` +
      "Entregá la respuesta con este formato profesional:\n" +
      "1. Resumen ejecutivo.\n" +
      "2. Hallazgos clave con cifras.\n" +
      "3. Riesgos o prioridades.\n" +
      "4. Acciones recomendadas para gerencia, logística, cobranza o ventas según aplique.\n" +
      "5. Conclusión breve y útil.\n\n" +
      "No inventés datos. Si un dato no existe en el sistema, indicá que no está registrado."
    ).slice(0, 1500);
  };

  const improvePrompt = () => {
    setInput(buildProPrompt(input));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  const groqReady = Boolean(provider?.groqConfigured || provider?.used || provider?.name === "groq");
  const diagnosticsErrors = Array.isArray(diagnostics?.errors) ? diagnostics.errors : [];


  const clearConversation = () => {
    localStorage.removeItem("gl365_ia_messages");
    localStorage.removeItem("gl365_ia_logistica_messages");
    localStorage.removeItem("ia_logistica_messages");
    setChat([]);
    setInput("");
    setApiError("");
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#F3F4F6] px-4 py-5 text-[#071B3A] lg:px-5">
      <div className="space-y-5 pb-4">
        {/* HEADER */}
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0C2D6B] text-white shadow-sm">
                <Sparkles className="h-6 w-6" />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-black leading-tight text-[#0C2D6B] lg:text-4xl">
                    GL365 Intelligence
                  </h1>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black ${
                      groqReady
                        ? "bg-green-50 text-green-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        groqReady ? "bg-green-500" : "bg-amber-500"
                      }`}
                    />
                    {groqReady ? "Groq conectado" : "Groq conectado / respaldo local"}
                  </span>
                </div>

                <p className="mt-2 max-w-4xl text-base leading-relaxed text-slate-500 lg:text-lg">
                  Asistente IA conectado a MySQL para apoyar decisiones de logística, flota, cobranza, rentabilidad, ventas y proveedores.
                </p>
              </div>
            </div>

            <button
              onClick={loadContext}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0C2D6B] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#082557] disabled:opacity-60 sm:w-auto"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Actualizar información
            </button>
          </div>
        </div>

        {(apiError || loading || diagnosticsErrors.length > 0) && (
          <div
            className={`rounded-2xl border px-5 py-4 text-sm font-semibold ${
              apiError || diagnosticsErrors.length > 0
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-blue-100 bg-blue-50 text-[#0C2D6B]"
            }`}
          >
            {apiError ||
              (diagnosticsErrors.length > 0
                ? `La IA cargó parcialmente. Revisá diagnostics.errors: ${diagnosticsErrors
                    .map((row: any) => row.tabla)
                    .join(", ")}`
                : "Cargando información real desde MySQL...")}
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MiniKpi
            icon={Truck}
            label="Viajes activos"
            value={String(summary.viajesActivos)}
            detail={`${summary.viajesRetraso} alerta retraso · ${summary.viajesCriticos} crítico`}
            tone="blue"
          />

          <MiniKpi
            icon={CheckCircle2}
            label="Flota disponible"
            value={String(summary.vehiculosDisponibles)}
            detail={`${summary.vehiculosMantenimiento} requieren atención`}
            tone="green"
          />

          <MiniKpi
            icon={CircleDollarSign}
            label="Saldo por cobrar"
            value={money(summary.saldoPorCobrar)}
            detail={`${money(summary.saldoVencido)} vencido`}
            tone="orange"
          />

          <MiniKpi
            icon={TrendingUp}
            label="Pipeline ponderado"
            value={money(summary.pipelinePonderado)}
            detail={`${summary.oportunidadesActivas} oportunidades activas`}
            tone="purple"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
          {/* CHAT */}
          <Card className="flex h-[760px] max-h-[calc(100vh-105px)] min-h-[660px] min-w-0 flex-col overflow-hidden border border-gray-100 p-0 shadow-sm">
            <div className="shrink-0 flex flex-col gap-3 border-b border-gray-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#0C2D6B]">
                  <Bot className="h-5 w-5" />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-black text-[#0C2D6B]">Asistente empresarial</h2>
                    <span className="rounded-full bg-[#0C2D6B]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#0C2D6B]">
                      Modo PRO
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Consulta información real de los módulos GL365 con análisis ejecutivo
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500">
                  <Database className="h-3.5 w-3.5" />
                  {summary.clientes || 0} clientes · {summary.rutas || 0} rutas · {summary.vehiculos || 0} vehículos
                </div>

                <button
                  type="button"
                  onClick={clearConversation}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-[#0C2D6B] shadow-sm transition hover:border-[#FF6B00] hover:bg-orange-50 hover:text-[#FF6B00]"
                  title="Limpiar conversación"
                >
                  <X className="h-3.5 w-3.5" />
                  Limpiar
                </button>
              </div>
            </div>

            {/* QUICK ACTIONS */}
            <div className="px-5 pt-4">
              <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-gray-400">
                Preguntas sugeridas
              </p>

              <div className="flex max-h-[92px] flex-wrap gap-2 overflow-y-auto pb-1 pr-1">
                {quickPrompts.map((prompt) => {
                  const Icon = prompt.icon;

                  return (
                    <button
                      key={prompt.label}
                      onClick={() => send(prompt.value)}
                      disabled={thinking}
                      className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs font-bold text-gray-600 transition hover:bg-[#0C2D6B] hover:text-white disabled:opacity-50"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {prompt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CHAT BODY */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain border-y border-gray-100 bg-[#FAFBFC] px-5 py-4">
              {chat.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm md:max-w-[78%] ${
                      message.role === "user"
                        ? "rounded-br-md bg-[#0C2D6B] text-white"
                        : "rounded-bl-md border border-gray-100 bg-white text-gray-700"
                    }`}
                  >
                    {message.provider && message.role === "assistant" && (
                      <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-slate-400">
                        <Sparkles className="h-3 w-3" />
                        {message.provider}
                      </div>
                    )}

                    <div className="whitespace-pre-wrap text-[14px] leading-7">{cleanAiText(message.text)}</div>

                    {message.warning && (
                      <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                        {message.warning}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {thinking && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md border border-gray-100 bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-[#FF6A00]" />
                        <span
                          className="h-2 w-2 animate-bounce rounded-full bg-[#FF6A00]"
                          style={{ animationDelay: "120ms" }}
                        />
                        <span
                          className="h-2 w-2 animate-bounce rounded-full bg-[#FF6A00]"
                          style={{ animationDelay: "240ms" }}
                        />
                      </div>

                      <span className="text-xs text-gray-400">Analizando datos reales...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* INPUT */}
            <div className="shrink-0 bg-white p-4">
              <div className="flex items-end gap-3">
                <div className="flex-1 rounded-2xl border border-gray-200 bg-gray-50 transition focus-within:border-[#0C2D6B] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0C2D6B]/10">
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={3}
                    maxLength={1500}
                    placeholder="Escribí una consulta o usá Mejorar PRO para convertirla en una pregunta gerencial..."
                    className="min-h-[92px] w-full resize-none bg-transparent px-4 py-3 text-sm leading-6 outline-none"
                  />

                  <div className="flex flex-col gap-2 px-4 pb-3 text-[10px] text-gray-400 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={improvePrompt}
                        disabled={thinking}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#0C2D6B]/15 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#0C2D6B] shadow-sm transition hover:border-[#FF6A00] hover:bg-orange-50 hover:text-[#FF6A00] disabled:opacity-50"
                        title="Convertir la consulta en una pregunta más profesional"
                      >
                        <Sparkles className="h-3 w-3" />
                        Mejorar PRO
                      </button>

                      <span>Enter para enviar · Shift + Enter para nueva línea</span>
                    </div>

                    <span>{input.length}/1500</span>
                  </div>
                </div>

                <button
                  onClick={() => send()}
                  disabled={!input.trim() || thinking}
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FF6A00] text-white shadow-sm transition hover:bg-[#e95f00] disabled:opacity-40"
                  title="Enviar"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>
          </Card>

          {/* PANEL DERECHO */}
          <div className="max-h-none space-y-4 overflow-visible pr-0 xl:h-[760px] xl:max-h-[calc(100vh-105px)] xl:min-h-[660px] xl:overflow-y-auto xl:pr-1">
            <Card className="border border-gray-100 p-4 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#FF6A00]" />
                <h3 className="font-black text-[#0C2D6B]">Atención prioritaria</h3>
              </div>

              <div className="space-y-3">
                {priorityItems.map((item, index) => (
                  <PriorityItem key={`${item.title}-${index}`} {...item} />
                ))}
              </div>
            </Card>

            <Card className="border border-gray-100 p-4 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Database className="h-4 w-4 text-[#0C2D6B]" />
                <h3 className="font-black text-[#0C2D6B]">Información consultable</h3>
              </div>

              <ContextRow icon={Truck} label="Logística" value={`${summary.viajesTotal ?? context.logistics.viajes.length} viajes`} />
              <ContextRow icon={Gauge} label="Flota" value={`${summary.vehiculos ?? context.fleet.vehiculos.length} vehículos`} />
              <ContextRow icon={CircleDollarSign} label="Finanzas" value={`${summary.comprobantes ?? context.finance.comprobantes.length} comprobantes`} />
              <ContextRow icon={Users} label="Comercial" value={`${summary.oportunidadesActivas ?? context.commercial.oportunidades.length} oportunidades`} />
              <ContextRow icon={Building2} label="Proveedores" value={`${summary.proveedores ?? context.suppliers.proveedores.length} registros`} />
              <ContextRow icon={RouteIcon} label="Rutas" value={`${summary.rutas ?? context.routes.rutas.length} rutas`} />
            </Card>

            <Card className="border border-gray-100 bg-[#0C2D6B] p-5 text-white shadow-sm">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#FF9A4A]" />
                <h3 className="font-black">Conexión segura</h3>
              </div>

              <p className="mt-3 text-xs leading-5 text-white/75">
                La llave de Groq queda en el backend con <b>GROQ_API_KEY</b>. El frontend solo consulta tu API local, por eso no expone credenciales.
              </p>

              <div className="mt-4 rounded-2xl bg-white/10 p-3 text-xs text-white/80">
                Modelo: {provider?.model || "configurable en .env"}
              </div>
            </Card>

            {context.logistics.viajes.length > 0 && (
              <Card className="border border-gray-100 p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#0C2D6B]" />
                  <h3 className="font-black text-[#0C2D6B]">Viajes recientes</h3>
                </div>

                <div className="space-y-3">
                  {context.logistics.viajes.slice(0, 5).map((row) => (
                    <div key={row.id} className="rounded-2xl border border-slate-100 p-3">
                      <p className="font-black text-[#0C2D6B]">{row.codigo}</p>
                      <p className="mt-1 text-xs text-slate-500">{row.ruta}</p>
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-slate-500">{row.estado}</span>
                        <span className="font-black text-[#FF6A00]">{pct(row.progreso)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniKpi({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "green" | "orange" | "purple";
}) {
  const color =
    tone === "green"
      ? "bg-green-50 text-green-600"
      : tone === "orange"
      ? "bg-orange-50 text-orange-600"
      : tone === "purple"
      ? "bg-purple-50 text-purple-600"
      : "bg-blue-50 text-[#0C2D6B]";

  return (
    <Card className="border border-gray-100 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${color}`}>
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-500">{label}</p>
          <p className="mt-1 break-words text-xl font-black text-[#0C2D6B]">{value}</p>
          <p className="mt-1 text-[11px] text-gray-400">{detail}</p>
        </div>
      </div>
    </Card>
  );
}

function PriorityItem({
  level,
  title,
  detail,
}: {
  level: "critical" | "warning" | "good";
  title: string;
  detail: string;
}) {
  const style =
    level === "critical"
      ? "border-red-100 bg-red-50"
      : level === "warning"
      ? "border-orange-100 bg-orange-50"
      : "border-green-100 bg-green-50";

  const icon =
    level === "critical" ? (
      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
    ) : level === "warning" ? (
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
    ) : (
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
    );

  return (
    <div className={`rounded-xl border p-3 ${style}`}>
      <div className="flex gap-2">
        {icon}
        <div>
          <p className="text-sm font-black text-gray-800">{title}</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function ContextRow({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-100 py-2.5 last:border-0">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Icon className="h-4 w-4 text-gray-400" />
        {label}
      </div>

      <span className="text-xs font-black text-[#0C2D6B]">{value}</span>
    </div>
  );
}