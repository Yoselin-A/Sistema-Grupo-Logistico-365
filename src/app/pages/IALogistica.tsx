import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
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
  FileText,
  Target,
  Package,
  ReceiptText,
  WalletCards,
  TrendingDown,
  UserRoundCog,
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

function cleanAiText(value: unknown) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function stripMarkdown(value: string) {
  return value
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*>\s?/, "")
    .trim();
}

function isMarkdownSeparator(line: string) {
  const clean = line.trim();

  if (!clean.includes("|")) return false;

  const cells = clean
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

  return (
    cells.length > 1 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell))
  );
}

function parseMarkdownRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => stripMarkdown(cell));
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
      viajes: Array.isArray(raw?.logistics?.viajes)
        ? raw.logistics.viajes
        : [],
      alertas: Array.isArray(raw?.logistics?.alertas)
        ? raw.logistics.alertas
        : [],
    },
    fleet: {
      vehiculos: Array.isArray(raw?.fleet?.vehiculos)
        ? raw.fleet.vehiculos
        : [],
    },
    finance: {
      comprobantes: Array.isArray(raw?.finance?.comprobantes)
        ? raw.finance.comprobantes
        : [],
      operaciones: Array.isArray(raw?.finance?.operaciones)
        ? raw.finance.operaciones
        : [],
    },
    commercial: {
      oportunidades: Array.isArray(raw?.commercial?.oportunidades)
        ? raw.commercial.oportunidades
        : [],
    },
    suppliers: {
      proveedores: Array.isArray(raw?.suppliers?.proveedores)
        ? raw.suppliers.proveedores
        : [],
    },
    routes: {
      rutas: Array.isArray(raw?.routes?.rutas)
        ? raw.routes.rutas
        : [],
    },
  };
}

function AssistantTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="my-4 w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="w-full max-w-full overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[600px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="bg-[#0C2D6B] text-white">
              {headers.map((header, index) => (
                <th
                  key={`${header}-${index}`}
                  className="whitespace-nowrap border-r border-white/10 px-4 py-3 font-black last:border-r-0"
                >
                  {header || `Columna ${index + 1}`}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={`row-${rowIndex}`}
                className={`border-b border-slate-100 last:border-b-0 ${
                  rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/80"
                }`}
              >
                {headers.map((_, cellIndex) => (
                  <td
                    key={`cell-${rowIndex}-${cellIndex}`}
                    className={`max-w-[300px] px-4 py-3 align-top leading-5 text-slate-600 ${
                      cellIndex === 0
                        ? "font-bold text-[#0C2D6B]"
                        : "font-medium"
                    }`}
                  >
                    <span className="whitespace-normal break-words">
                      {row[cellIndex] || "-"}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NumberedSection({
  number,
  title,
}: {
  number: string;
  title: string;
}) {
  return (
    <div className="mt-5 flex items-start gap-2.5 first:mt-0">
      <span className="mt-0.5 flex h-7 min-w-7 items-center justify-center rounded-lg bg-[#0C2D6B] px-1.5 text-[11px] font-black text-white">
        {number}
      </span>
      <h4 className="pt-0.5 text-[14px] font-black leading-6 text-[#0C2D6B]">
        {title}
      </h4>
    </div>
  );
}

function AssistantMessageContent({ text }: { text: string }) {
  const lines = cleanAiText(text).split("\n");
  const blocks: ReactNode[] = [];

  let index = 0;

  while (index < lines.length) {
    const trimmed = lines[index].trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    // Tabla Markdown:
    // | Columna | Columna |
    // | --- | --- |
    // | dato | dato |
    if (
      trimmed.includes("|") &&
      index + 1 < lines.length &&
      isMarkdownSeparator(lines[index + 1])
    ) {
      const headers = parseMarkdownRow(lines[index]);
      const rows: string[][] = [];
      let cursor = index + 2;

      while (
        cursor < lines.length &&
        lines[cursor].trim() &&
        lines[cursor].includes("|")
      ) {
        rows.push(parseMarkdownRow(lines[cursor]));
        cursor += 1;
      }

      if (headers.length > 1 && rows.length) {
        blocks.push(
          <AssistantTable
            key={`table-${index}`}
            headers={headers}
            rows={rows}
          />
        );
      }

      index = cursor;
      continue;
    }

    // Encabezados Markdown.
    if (/^#{1,4}\s+/.test(trimmed)) {
      const title = stripMarkdown(
        trimmed.replace(/^#{1,4}\s+/, "")
      );

      blocks.push(
        <h3
          key={`heading-${index}`}
          className="mt-5 border-b border-slate-100 pb-2 text-[15px] font-black text-[#0C2D6B] first:mt-0"
        >
          {title}
        </h3>
      );

      index += 1;
      continue;
    }

    // Secciones numeradas.
    if (/^\d+\.\s+/.test(trimmed) && trimmed.length < 140) {
      blocks.push(
        <NumberedSection
          key={`section-${index}`}
          number={trimmed.match(/^\d+/)?.[0] || ""}
          title={stripMarkdown(
            trimmed.replace(/^\d+\.\s+/, "")
          )}
        />
      );

      index += 1;
      continue;
    }

    // Viñetas.
    if (/^[-•]\s+/.test(trimmed)) {
      const items: string[] = [];
      let cursor = index;

      while (
        cursor < lines.length &&
        /^[-•]\s+/.test(lines[cursor].trim())
      ) {
        items.push(
          stripMarkdown(
            lines[cursor].trim().replace(/^[-•]\s+/, "")
          )
        );
        cursor += 1;
      }

      blocks.push(
        <ul
          key={`list-${index}`}
          className="my-3 space-y-2 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3"
        >
          {items.map((item, itemIndex) => (
            <li
              key={`${itemIndex}-${item}`}
              className="flex items-start gap-2.5 text-[13px] leading-6 text-slate-600"
            >
              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF6A00]" />
              <span className="min-w-0">{item}</span>
            </li>
          ))}
        </ul>
      );

      index = cursor;
      continue;
    }

    // Texto normal: agrupamos varias líneas para que no quede
    // una oración aislada por renglón.
    const paragraph: string[] = [trimmed];
    let cursor = index + 1;

    while (cursor < lines.length) {
      const next = lines[cursor].trim();

      if (
        !next ||
        /^#{1,4}\s+/.test(next) ||
        /^\d+\.\s+/.test(next) ||
        /^[-•]\s+/.test(next) ||
        (next.includes("|") &&
          cursor + 1 < lines.length &&
          isMarkdownSeparator(lines[cursor + 1]))
      ) {
        break;
      }

      paragraph.push(next);
      cursor += 1;
    }

    blocks.push(
      <p
        key={`paragraph-${index}`}
        className="my-2 whitespace-pre-wrap text-[13.5px] leading-7 text-slate-600"
      >
        {stripMarkdown(paragraph.join(" "))}
      </p>
    );

    index = cursor;
  }

  return <div className="min-w-0">{blocks}</div>;
}

export function IALogistica() {
  const [context, setContext] =
    useState<IABootstrapData>(EMPTY_CONTEXT);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [provider, setProvider] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [thinking, setThinking] = useState(false);
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState("");

  // El chat inicia vacío. Solo se muestra contenido cuando el usuario
  // escribe una consulta o presiona uno de los botones rápidos.
  const [chat, setChat] = useState<ChatMessage[]>([]);

  const chatBodyRef = useRef<HTMLDivElement | null>(null);
  const assistantSectionRef = useRef<HTMLDivElement | null>(null);

  const loadContext = async () => {
    setLoading(true);
    setApiError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/ia/bootstrap`
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload?.ok === false) {
        throw new Error(
          payload?.message ||
            "No se pudo cargar la información de IA."
        );
      }

      setContext(
        normalizeApiContext(payload?.data || {})
      );
      setDiagnostics(payload?.diagnostics || null);
      setProvider(payload?.provider || null);
    } catch (error: any) {
      console.error("Error IA Logística:", error);
      setApiError(
        error?.message ||
          "No se pudo conectar con la API de IA logística."
      );
      setContext(EMPTY_CONTEXT);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadContext();
  }, []);

  // Desplaza únicamente el panel interno del chat.
  // No mueve la página completa.
  useEffect(() => {
    const element = chatBodyRef.current;

    if (!element) return;

    window.setTimeout(() => {
      element.scrollTo({
        top: element.scrollHeight,
        behavior: "smooth",
      });
    }, 80);
  }, [chat, thinking]);

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
        detail:
          "Requieren revisión inmediata en Logística.",
      });
    }

    if (summary.viajesRetraso > 0) {
      items.push({
        level: "warning",
        title: `${summary.viajesRetraso} viaje(s) con retraso`,
        detail:
          "Validar incidencia, ETA y comunicación con cliente.",
      });
    }

    if (summary.saldoVencido > 0) {
      items.push({
        level: "warning",
        title: `${money(summary.saldoVencido)} vencido`,
        detail:
          "Existen comprobantes vencidos según estado oficial.",
      });
    }

    if (summary.proveedoresRiesgo > 0) {
      items.push({
        level: "warning",
        title: `${summary.proveedoresRiesgo} proveedor(es) a revisar`,
        detail:
          "Hay señales de cumplimiento o desempeño que necesitan seguimiento.",
      });
    }

    if (summary.vehiculosMantenimiento > 0) {
      items.push({
        level: "warning",
        title: `${summary.vehiculosMantenimiento} vehículo(s) con atención`,
        detail:
          "Revisar mantenimiento o disponibilidad operativa.",
      });
    }

    if (!items.length) {
      items.push({
        level: "good",
        title: "Sin prioridades críticas",
        detail:
          "Los indicadores principales se encuentran estables.",
      });
    }

    return items.slice(0, 5);
  }, [summary]);

  const quickPrompts = [
    {
      label: "Información del sistema",
      value:
        "Dame una descripción clara de la información disponible en GL365, organizada por módulos, con los principales totales registrados en MySQL.",
      icon: Database,
    },
    {
      label: "Informe PRO",
      value:
        "Dame un informe ejecutivo profesional del sistema GL365 con hallazgos clave, riesgos, prioridades y acciones recomendadas para gerencia.",
      icon: Sparkles,
    },
    {
      label: "Plan de acción",
      value:
        "Genera un plan de acción gerencial con prioridades, responsables sugeridos y acciones concretas para mejorar logística, cobranza, flota y ventas.",
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
      value:
        "Analiza la cobranza y los saldos vencidos",
      icon: CircleDollarSign,
    },
    {
      label: "Rentabilidad",
      value:
        "Analiza la rentabilidad de las operaciones",
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
    {
      label: "Clientes",
      value: "Dame un resumen de los clientes registrados y los principales datos disponibles.",
      icon: Users,
    },
    {
      label: "Cotizaciones",
      value: "Analiza las cotizaciones registradas, sus estados y los datos comerciales más relevantes.",
      icon: FileText,
    },
    {
      label: "Oportunidades",
      value: "Muéstrame un resumen de las oportunidades comerciales activas, etapas y valores.",
      icon: Target,
    },
    {
      label: "Servicios de transporte",
      value: "Dame un resumen de los servicios de transporte registrados, sus estados, origen, destino y clientes.",
      icon: Package,
    },
    {
      label: "Rutas",
      value: "Analiza las rutas registradas, origen, destino, distancia, tiempo y costo.",
      icon: RouteIcon,
    },
    {
      label: "Facturación vencida",
      value: "Muéstrame los comprobantes o saldos vencidos que requieren seguimiento.",
      icon: ReceiptText,
    },
    {
      label: "Costos operativos",
      value: "Analiza los costos operativos registrados y señala los más relevantes.",
      icon: WalletCards,
    },
    {
      label: "Márgenes bajos",
      value: "Identifica operaciones con margen bajo o negativo y explica cuáles requieren atención.",
      icon: TrendingDown,
    },
    {
      label: "Operaciones finalizadas",
      value: "Resume las operaciones finalizadas y sus principales resultados.",
      icon: CheckCircle2,
    },
    {
      label: "Usuarios",
      value: "Dame un resumen de los usuarios y roles registrados, sin mostrar contraseñas, hashes ni credenciales.",
      icon: UserRoundCog,
    },
    {
      label: "Estado SAT",
      value: "Analiza el estado SAT y cumplimiento de los proveedores registrados.",
      icon: ShieldCheck,
    },
  ];

  const send = async (forcedText?: string) => {
    const question = String(
      forcedText ?? input
    ).trim();

    if (thinking) return;

    if (!question) {
      setInputError("Escribí una consulta antes de enviarla.");
      return;
    }

    setInputError("");

    // Se limpia inmediatamente el textarea cuando la consulta
    // fue aceptada, antes de esperar la respuesta del backend.
    setInput("");

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: question,
      createdAt: new Date().toISOString(),
    };

    // Cada consulta nueva reemplaza la conversación anterior.
    // Así en pantalla queda únicamente la pregunta actual y su respuesta.
    setChat([userMessage]);
    setThinking(true);

    // Esta instrucción solo mejora la presentación de la
    // respuesta. La pregunta que ve el usuario permanece intacta.
    const formattedQuestion =
      `${question}\n\n` +
      "Presentá la respuesta de forma profesional y fácil de leer. " +
      "Usá secciones breves, viñetas y cifras claras. " +
      "Si comparás varios registros, usá una tabla Markdown con pocas columnas, encabezados cortos y solo la información necesaria. " +
      "No hagás tablas demasiado anchas. No inventés datos.";

    try {
      const response = await fetch(
        `${API_BASE_URL}/ia/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: formattedQuestion,
          }),
        }
      );

      const payload = await response
        .json()
        .catch(() => ({}));

      if (!response.ok || payload?.ok === false) {
        throw new Error(
          payload?.message ||
            "No se pudo procesar la pregunta."
        );
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

      setDiagnostics(
        payload?.diagnostics || diagnostics
      );
      setProvider(payload?.provider || provider);

      setChat((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text:
            payload?.answer ||
            "No se recibió respuesta de la IA.",
          createdAt: new Date().toISOString(),
          provider:
            payload?.provider?.name === "groq"
              ? `Groq · ${
                  payload?.provider?.model || "modelo"
                }`
              : "Análisis local",
          warning:
            payload?.warning ||
            payload?.provider?.warning ||
            null,
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
            `Detalle: ${
              error?.message || "Error desconocido"
            }\n\n` +
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
    const base =
      question.trim() ||
      "Dame un análisis gerencial completo del sistema GL365.";

    return (
      "Respondé como asesor gerencial de GL365, usando únicamente los datos reales disponibles en MySQL.\n\n" +
      `Consulta principal: ${base}\n\n` +
      "Entregá la respuesta con este formato profesional:\n" +
      "1. Resumen ejecutivo.\n" +
      "2. Hallazgos clave con cifras.\n" +
      "3. Riesgos o prioridades.\n" +
      "4. Acciones recomendadas para gerencia, logística, cobranza o ventas según aplique.\n" +
      "5. Conclusión breve y útil.\n\n" +
      "Cuando compares varios registros, usá una tabla Markdown clara, con pocas columnas y encabezados cortos. " +
      "Para explicaciones generales usá viñetas y secciones en lugar de tablas innecesarias.\n\n" +
      "No inventés datos. Si un dato no existe en el sistema, indicá que no está registrado."
    ).slice(0, 1500);
  };

  const improvePrompt = () => {
    setInput(buildProPrompt(input));
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      void send();
    }
  };

  const groqReady = Boolean(
    provider?.groqConfigured ||
      provider?.used ||
      provider?.name === "groq"
  );

  const diagnosticsErrors = Array.isArray(
    diagnostics?.errors
  )
    ? diagnostics.errors
    : [];

  const sendQuickPrompt = (value: string) => {
    // Enviamos la consulta elegida.
    void send(value);

    // Después de pulsar un botón rápido, llevamos al usuario
    // al inicio del asistente para que pueda ver la respuesta.
    window.setTimeout(() => {
      assistantSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
  };

  const clearConversation = () => {
    localStorage.removeItem("gl365_ia_messages");
    localStorage.removeItem(
      "gl365_ia_logistica_messages"
    );
    localStorage.removeItem(
      "ia_logistica_messages"
    );

    setChat([]);
    setInput("");
    setInputError("");
    setApiError("");
  };

  return (
    <div className="min-h-screen w-full min-w-0 max-w-full overflow-x-hidden bg-[#F3F4F6] px-4 py-5 text-[#071B3A] lg:px-5">
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
                        groqReady
                          ? "bg-green-500"
                          : "bg-amber-500"
                      }`}
                    />

                    {groqReady
                      ? "Groq conectado"
                      : "Groq conectado / respaldo local"}
                  </span>
                </div>

                <p className="mt-2 max-w-4xl text-base leading-relaxed text-slate-500 lg:text-lg">
                  Asistente IA conectado a MySQL para apoyar
                  decisiones de logística, flota, cobranza,
                  rentabilidad, ventas y proveedores.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadContext()}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0C2D6B] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#082557] disabled:opacity-60 sm:w-auto"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  loading ? "animate-spin" : ""
                }`}
              />
              Actualizar información
            </button>
          </div>
        </div>

        {(apiError ||
          loading ||
          diagnosticsErrors.length > 0) && (
          <div
            className={`rounded-2xl border px-5 py-4 text-sm font-semibold ${
              apiError ||
              diagnosticsErrors.length > 0
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-blue-100 bg-blue-50 text-[#0C2D6B]"
            }`}
          >
            {apiError ||
              (diagnosticsErrors.length > 0
                ? `La IA cargó parcialmente. Revisá diagnostics.errors: ${diagnosticsErrors
                    .map(
                      (row: any) => row.tabla
                    )
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
            value={String(
              summary.vehiculosDisponibles
            )}
            detail={`${summary.vehiculosMantenimiento} requieren atención`}
            tone="green"
          />

          <MiniKpi
            icon={CircleDollarSign}
            label="Saldo por cobrar"
            value={money(summary.saldoPorCobrar)}
            detail={`${money(
              summary.saldoVencido
            )} vencido`}
            tone="orange"
          />

          <MiniKpi
            icon={TrendingUp}
            label="Pipeline ponderado"
            value={money(
              summary.pipelinePonderado
            )}
            detail={`${summary.oportunidadesActivas} oportunidades activas`}
            tone="purple"
          />
        </div>

        <div
          ref={assistantSectionRef}
          className="grid min-w-0 scroll-mt-24 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-stretch"
        >
          {/* CHAT */}
          <Card className="flex h-full min-h-[880px] min-w-0 flex-col overflow-hidden border border-gray-100 p-0 shadow-sm">
            <div className="flex shrink-0 flex-col gap-2.5 border-b border-gray-100 px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#0C2D6B]">
                  <Bot className="h-5 w-5" />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-black text-[#0C2D6B]">
                      Asistente empresarial
                    </h2>

                    <span className="rounded-full bg-[#0C2D6B]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#0C2D6B]">
                      Modo PRO
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-400">
                    Consulta información real de los módulos
                    GL365 con análisis ejecutivo
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500">
                  <Database className="h-3.5 w-3.5" />
                  {summary.clientes || 0} clientes ·{" "}
                  {summary.rutas || 0} rutas ·{" "}
                  {summary.vehiculos || 0} vehículos
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

            {/* CHAT BODY */}
            <div
              ref={chatBodyRef}
              className="min-h-[210px] flex-1 space-y-4 overflow-y-auto overscroll-contain border-y border-gray-100 bg-[#FAFBFD] px-4 py-4"
            >
              {chat.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={`min-w-0 max-w-[96%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm md:max-w-[90%] ${
                      message.role === "user"
                        ? "rounded-br-md bg-[#0C2D6B] text-white"
                        : "rounded-bl-md border border-gray-100 bg-white text-gray-700"
                    }`}
                  >
                    {message.provider &&
                      message.role ===
                        "assistant" && (
                        <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-slate-400">
                          <Sparkles className="h-3 w-3" />
                          {message.provider}
                        </div>
                      )}

                    {message.role ===
                    "assistant" ? (
                      <AssistantMessageContent
                        text={message.text}
                      />
                    ) : (
                      <div className="whitespace-pre-wrap text-[14px] leading-7">
                        {cleanAiText(message.text)}
                      </div>
                    )}

                    {message.warning && (
                      <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
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
                          style={{
                            animationDelay:
                              "120ms",
                          }}
                        />
                        <span
                          className="h-2 w-2 animate-bounce rounded-full bg-[#FF6A00]"
                          style={{
                            animationDelay:
                              "240ms",
                          }}
                        />
                      </div>

                      <span className="text-xs text-gray-400">
                        Analizando datos reales...
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* INPUT + CONSULTAS RÁPIDAS */}
            <div className="shrink-0 border-t border-gray-100 bg-white p-3.5">
              <div className="flex items-end gap-3">
                <div
                  className={`min-w-0 flex-1 rounded-2xl border bg-gray-50 transition focus-within:bg-white focus-within:ring-2 ${
                    inputError
                      ? "border-red-400 focus-within:border-red-500 focus-within:ring-red-100"
                      : "border-gray-200 focus-within:border-[#0C2D6B] focus-within:ring-[#0C2D6B]/10"
                  }`}
                >
                  <textarea
                    value={input}
                    onChange={(event) => {
                      setInput(event.target.value);
                      if (inputError && event.target.value.trim()) {
                        setInputError("");
                      }
                    }}
                    onKeyDown={handleKeyDown}
                    rows={2}
                    maxLength={1500}
                    placeholder="Preguntá cualquier dato del sistema: clientes, viajes, rutas, flota, facturación, proveedores, oportunidades..."
                    className="min-h-[70px] w-full resize-none bg-transparent px-4 py-3 text-sm leading-6 outline-none placeholder:text-slate-400"
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

                      <span>
                        Enter para enviar · Shift + Enter para nueva línea
                      </span>
                    </div>

                    <span>{input.length}/1500</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={thinking}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FF6A00] text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[#e95f00] disabled:translate-y-0 disabled:opacity-40"
                  title="Enviar"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>

              {inputError && (
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {inputError}
                </div>
              )}

              <div className="mt-2.5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Consultas rápidas
                  </p>

                  <span className="hidden text-[10px] text-gray-400 sm:inline">
                    También podés escribir cualquier consulta del sistema
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 overflow-visible">
                  {quickPrompts.map((prompt) => {
                    const Icon = prompt.icon;

                    return (
                      <button
                        key={prompt.label}
                        type="button"
                        onClick={() => sendQuickPrompt(prompt.value)}
                        disabled={thinking}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[9.5px] font-bold text-slate-600 transition hover:border-[#0C2D6B] hover:bg-[#0C2D6B] hover:text-white disabled:opacity-50"
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {prompt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>

          {/* PANEL DERECHO - MISMO ALTO QUE EL CHAT */}
          <Card className="flex min-h-[880px] self-stretch flex-col overflow-visible border border-gray-100 p-0 shadow-sm">
            {/* ENCABEZADO */}
            <div className="shrink-0 border-b border-gray-100 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-[#0C2D6B]" />
                  <div>
                    <h3 className="font-black text-[#0C2D6B]">
                      Resumen inteligente
                    </h3>
                    <p className="text-[10px] text-gray-400">
                      Estado actual del sistema GL365
                    </p>
                  </div>
                </div>

                <span className="rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-black text-green-700">
                  MySQL conectado
                </span>
              </div>
            </div>

            {/* CONTENIDO - SIN SCROLL */}
            <div className="flex flex-1 flex-col gap-2.5 p-3 pb-5">
              {/* ATENCIÓN PRIORITARIA */}
              <section className="shrink-0">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-[#FF6A00]" />
                    <h3 className="text-sm font-black text-[#0C2D6B]">
                      Atención prioritaria
                    </h3>
                  </div>

                  <span className="rounded-full bg-orange-50 px-2 py-1 text-[9px] font-black text-orange-700">
                    {priorityItems.length} aviso{priorityItems.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  {priorityItems.map((item, index) => (
                    <PriorityItem
                      key={`${item.title}-${index}`}
                      {...item}
                    />
                  ))}
                </div>
              </section>

              {/* INFORMACIÓN CONSULTABLE */}
              <section className="shrink-0 rounded-2xl border border-slate-100 bg-slate-50/60 p-2.5 dark:border-[#2A3950] dark:bg-[#111827]">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-[#0C2D6B]" />
                    <h3 className="text-sm font-black text-[#0C2D6B] dark:text-[#F8FAFC]">
                      Información consultable
                    </h3>
                  </div>

                  <span className="text-[9px] font-bold text-gray-400">
                    Datos reales
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <ContextTile
                    icon={Truck}
                    label="Logística"
                    value={`${summary.viajesTotal ?? context.logistics.viajes.length} viajes`}
                  />
                  <ContextTile
                    icon={Gauge}
                    label="Flota"
                    value={`${summary.vehiculos ?? context.fleet.vehiculos.length} vehículos`}
                  />
                  <ContextTile
                    icon={CircleDollarSign}
                    label="Finanzas"
                    value={`${summary.comprobantes ?? context.finance.comprobantes.length} comprobantes`}
                  />
                  <ContextTile
                    icon={Users}
                    label="Comercial"
                    value={`${summary.oportunidadesActivas ?? context.commercial.oportunidades.length} oportunidades`}
                  />
                  <ContextTile
                    icon={Building2}
                    label="Proveedores"
                    value={`${summary.proveedores ?? context.suppliers.proveedores.length} registros`}
                  />
                  <ContextTile
                    icon={RouteIcon}
                    label="Rutas"
                    value={`${summary.rutas ?? context.routes.rutas.length} rutas`}
                  />
                </div>
              </section>

              {/* IA + BD */}
              <section className="shrink-0 rounded-2xl bg-gradient-to-r from-[#0C2D6B] to-[#123B82] p-3 text-white shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                      <ShieldCheck className="h-4 w-4 text-[#FFB37A]" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-black">
                        IA + base de datos
                      </p>
                      <p className="truncate text-[10px] text-white/70">
                        {groqReady ? "Groq activo" : "Respaldo local"} · credenciales protegidas
                      </p>
                    </div>
                  </div>

                  <span className="max-w-[145px] shrink-0 truncate rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-bold text-white/90">
                    {provider?.model || "modelo IA"}
                  </span>
                </div>
              </section>

              {/* VIAJES RECIENTES */}
              <section className="shrink-0 overflow-visible rounded-2xl border border-gray-100 bg-white p-3 dark:border-[#2A3950] dark:bg-[#111827]">
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[#FF6A00]" />
                    <h3 className="text-sm font-black text-[#0C2D6B] dark:text-[#F8FAFC]">
                      Viajes recientes
                    </h3>
                  </div>

                  <span className="rounded-full bg-slate-50 px-2 py-1 text-[9px] font-bold text-gray-400 dark:bg-[#172337] dark:text-[#9FB0C6]">
                    Últimos 3
                  </span>
                </div>

                {context.logistics.viajes.length > 0 ? (
                  <div className="space-y-2">
                    {context.logistics.viajes.slice(0, 3).map((row) => (
                      <div
                        key={row.id}
                        className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-[#304057] dark:bg-[#151F2F]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-black text-[#0C2D6B] dark:text-[#EAF2FF]">
                              {row.codigo}
                            </p>

                            <p
                              className="mt-0.5 truncate text-[9.5px] text-slate-500 dark:text-[#AEBBD0]"
                              title={row.ruta}
                            >
                              {row.ruta || "Ruta no registrada"}
                            </p>
                          </div>

                          <div className="shrink-0 text-right">
                            <span className="inline-flex max-w-[105px] truncate rounded-full bg-white px-2 py-1 text-[8.5px] font-bold text-slate-500 shadow-sm dark:border dark:border-[#3A4B63] dark:bg-[#0F1929] dark:text-[#D7E3F4]">
                              {row.estado || "Sin estado"}
                            </span>

                            <p className="mt-1 text-[10px] font-black text-[#FF6A00]">
                              {pct(row.progreso)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-[#26344A]">
                          <div
                            className="h-full rounded-full bg-[#FF6A00]"
                            style={{
                              width: `${Math.max(
                                0,
                                Math.min(100, Number(row.progreso || 0))
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-[80px] items-center justify-center rounded-xl bg-slate-50 text-center text-xs text-gray-400">
                    Sin viajes recientes.
                  </div>
                )}
              </section>
            </div>
          </Card>
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
  tone:
    | "blue"
    | "green"
    | "orange"
    | "purple";
}) {
  const color =
    tone === "green"
      ? "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-300"
      : tone === "orange"
      ? "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300"
      : tone === "purple"
      ? "bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-300"
      : "bg-blue-50 text-[#0C2D6B] dark:bg-blue-500/10 dark:text-blue-300";

  return (
    <Card className="min-w-0 border border-gray-100 p-4 shadow-sm dark:border-[#2A3950] dark:bg-[#111827]">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${color}`}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-500 dark:text-[#AEBBD0]">
            {label}
          </p>

          <p className="mt-1 whitespace-nowrap text-[clamp(1.05rem,1.7vw,1.25rem)] font-black tabular-nums text-[#0C2D6B] dark:text-[#F8FAFC]">
            {value}
          </p>

          <p className="mt-1 text-[11px] leading-4 text-gray-400 dark:text-[#91A3BA]">
            {detail}
          </p>
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
    <div
      className={`rounded-xl border px-3 py-1.5 ${style}`}
    >
      <div className="flex gap-2">
        {icon}

        <div className="min-w-0">
          <p className="text-[13px] font-black leading-5 text-gray-800">
            {title}
          </p>

          <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-gray-500">
            {detail}
          </p>
        </div>
      </div>
    </div>
  );
}

function ContextTile({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-100 bg-white p-2 dark:border-[#2E3D53] dark:bg-[#151F2F]">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-[#0C2D6B] shadow-sm dark:bg-[#0F1929] dark:text-[#9CC0FF] dark:ring-1 dark:ring-[#3A4B63]">
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold text-slate-400 dark:text-[#91A3BA]">
            {label}
          </p>
          <p className="truncate text-[12px] font-black text-[#0C2D6B] dark:text-[#F8FAFC]">
            {value}
          </p>
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
    <div className="flex min-w-0 items-center justify-between gap-3 border-b border-gray-100 py-2.5 last:border-0">
      <div className="flex min-w-0 items-center gap-2 text-sm text-gray-600">
        <Icon className="h-4 w-4 shrink-0 text-gray-400" />
        <span className="truncate">
          {label}
        </span>
      </div>

      <span className="shrink-0 whitespace-nowrap text-xs font-black text-[#0C2D6B]">
        {value}
      </span>
    </div>
  );
}