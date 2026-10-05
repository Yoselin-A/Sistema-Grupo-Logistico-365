import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  FileDown,
  FileSpreadsheet,
  FileWarning,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

type Piloto = {
  id: number;
  codigo_piloto: string;
  primer_nombre: string;
  segundo_nombre?: string;
  primer_apellido: string;
  segundo_apellido?: string;
  nombre_piloto: string;
  licencia: string;
  dpi?: string;
  nit?: string;
  fecha_nacimiento?: string;
  fecha_emision_licencia?: string;
  fecha_vencimiento_licencia?: string;
  fecha_emision_dpi?: string;
  fecha_vencimiento_dpi?: string;
  dias_licencia?: number | null;
  dias_dpi?: number | null;
};

type FormPiloto = {
  primer_nombre: string;
  segundo_nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  licencia: string;
  dpi: string;
  nit: string;
  fecha_nacimiento: string;
  fecha_emision_licencia: string;
  fecha_vencimiento_licencia: string;
  fecha_emision_dpi: string;
  fecha_vencimiento_dpi: string;
};

type DocumentoFiltro = "todos" | "licencia" | "dpi";
type EstadoFiltro = "todos" | "vigente" | "proximo" | "vencido" | "sin_fecha";
type SortField = "recientes" | "nombre" | "licencia" | "dpi" | "nacimiento";

const EMPTY_FORM: FormPiloto = {
  primer_nombre: "",
  segundo_nombre: "",
  primer_apellido: "",
  segundo_apellido: "",
  licencia: "",
  dpi: "",
  nit: "",
  fecha_nacimiento: "",
  fecha_emision_licencia: "",
  fecha_vencimiento_licencia: "",
  fecha_emision_dpi: "",
  fecha_vencimiento_dpi: "",
};

const inputClass =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-[#0C2D6B] focus:ring-2 focus:ring-blue-100";

async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const json = await response.json().catch(() => null);

  if (!response.ok || json?.ok === false) {
    throw new Error(json?.message || `Error ${response.status}`);
  }

  return json?.data ?? json;
}

function estadoDocumento(dias?: number | null) {
  if (dias == null) {
    return {
      texto: "Sin fecha",
      clase: "bg-gray-100 text-gray-600 border-gray-200",
      nivel: "sin_fecha",
    };
  }

  if (dias < 0) {
    return {
      texto: `Vencido hace ${Math.abs(dias)} días`,
      clase: "bg-red-50 text-red-700 border-red-200",
      nivel: "vencido",
    };
  }

  if (dias <= 15) {
    return {
      texto: `Vence en ${dias} días`,
      clase: "bg-red-50 text-red-700 border-red-200",
      nivel: "proximo",
    };
  }

  if (dias <= 30) {
    return {
      texto: `Vence en ${dias} días`,
      clase: "bg-orange-50 text-orange-700 border-orange-200",
      nivel: "proximo",
    };
  }

  if (dias <= 90) {
    return {
      texto: `Próximo en ${dias} días`,
      clase: "bg-yellow-50 text-yellow-700 border-yellow-200",
      nivel: "proximo",
    };
  }

  return {
    texto: "Vigente",
    clase: "bg-green-50 text-green-700 border-green-200",
    nivel: "vigente",
  };
}

function formatoFecha(fecha?: string) {
  if (!fecha) return "Sin registrar";

  const date = new Date(`${fecha.slice(0, 10)}T12:00:00`);

  if (Number.isNaN(date.getTime())) return "Sin registrar";

  return date.toLocaleDateString("es-GT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function calcularEdad(fecha?: string) {
  if (!fecha) return null;

  const hoy = new Date();
  const nacimiento = new Date(`${fecha.slice(0, 10)}T12:00:00`);

  if (Number.isNaN(nacimiento.getTime())) return null;

  let edad = hoy.getFullYear() - nacimiento.getFullYear();

  const aunNoCumple =
    hoy.getMonth() < nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() &&
      hoy.getDate() < nacimiento.getDate());

  if (aunNoCumple) edad -= 1;

  return edad;
}

function diasOrden(dias?: number | null) {
  if (dias == null) return Number.MAX_SAFE_INTEGER;
  return dias;
}

function FechaNacimiento({
  year,
  month,
  day,
  onYearChange,
  onMonthChange,
  onDayChange,
}: {
  year: string;
  month: string;
  day: string;
  onYearChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  onDayChange: (value: string) => void;
}) {
  const currentYear = new Date().getFullYear();

  const years = Array.from(
    { length: 83 },
    (_, index) => currentYear - 18 - index
  );
  const months = Array.from({ length: 12 }, (_, index) => index + 1);

  const selectedYear = Number(year || currentYear - 18);
  const selectedMonth = Number(month || 1);

  const daysInMonth = new Date(
    selectedYear,
    selectedMonth,
    0
  ).getDate();

  const days = Array.from(
    { length: daysInMonth },
    (_, index) => index + 1
  );

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        <select
          className={inputClass}
          value={year}
          onChange={(event) => onYearChange(event.target.value)}
        >
          <option value="">Año</option>
          {years.map((item) => (
            <option key={item} value={String(item)}>
              {item}
            </option>
          ))}
        </select>

        <select
          className={inputClass}
          value={month}
          onChange={(event) => onMonthChange(event.target.value)}
        >
          <option value="">Mes</option>
          {months.map((item) => (
            <option key={item} value={String(item)}>
              {item}
            </option>
          ))}
        </select>

        <select
          className={inputClass}
          value={day}
          onChange={(event) => onDayChange(event.target.value)}
        >
          <option value="">Día</option>
          {days.map((item) => (
            <option key={item} value={String(item)}>
              {item}
            </option>
          ))}
        </select>
      </div>

      {year && month && day && (
        <div className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-[#0C2D6B]">
          Fecha seleccionada:{" "}
          {String(day).padStart(2, "0")}/
          {String(month).padStart(2, "0")}/{year}
        </div>
      )}
    </div>
  );
}

function moverConEnter(event: React.KeyboardEvent<HTMLElement>) {
  if (event.key !== "Enter" || event.shiftKey) return;

  const actual = event.target as HTMLElement;

  if (
    actual.tagName === "TEXTAREA" ||
    (actual instanceof HTMLInputElement &&
      ["checkbox", "radio", "button", "submit"].includes(actual.type))
  ) {
    return;
  }

  const contenedor = event.currentTarget;
  const campos = Array.from(
    contenedor.querySelectorAll<HTMLElement>(
      'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button[data-save="true"]:not([disabled])'
    )
  ).filter((campo) => {
    const style = window.getComputedStyle(campo);
    return (
      campo.tabIndex >= 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden"
    );
  });

  const index = campos.indexOf(actual);

  if (index >= 0 && index < campos.length - 1) {
    event.preventDefault();
    campos[index + 1].focus();
  }
}

function pdfStatusColor(dias?: number | null): [number, number, number] {
  if (dias == null) return [107, 114, 128];
  if (dias < 0) return [220, 38, 38];
  if (dias <= 30) return [234, 88, 12];
  if (dias <= 90) return [202, 138, 4];
  return [22, 163, 74];
}

function drawPdfHeader(
  pdf: jsPDF,
  title: string,
  subtitle: string,
  code?: string
) {
  const width = pdf.internal.pageSize.getWidth();

  pdf.setFillColor(12, 45, 107);
  pdf.rect(0, 0, width, 38, "F");

  pdf.setFillColor(255, 106, 0);
  pdf.rect(0, 36, width, 2, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text("GL365 ERP", 14, 13);

  pdf.setFontSize(21);
  pdf.text(title, 14, 25);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(subtitle, 14, 32);

  if (code) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(code, width - 14, 24, { align: "right" });
  }
}

function drawPdfSection(
  pdf: jsPDF,
  title: string,
  y: number,
  rows: Array<[string, string]>,
  x = 14,
  width?: number
) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const boxWidth = width || pageWidth - 28;
  const rowHeight = 13;
  const height = 12 + rows.length * rowHeight;

  pdf.setFillColor(244, 247, 252);
  pdf.roundedRect(x, y, boxWidth, height, 3, 3, "F");

  pdf.setTextColor(12, 45, 107);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(title, x + 5, y + 8);

  rows.forEach(([label, value], index) => {
    const rowY = y + 17 + index * rowHeight;

    pdf.setTextColor(107, 114, 128);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text(label.toUpperCase(), x + 5, rowY);

    pdf.setTextColor(31, 41, 55);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(value || "Sin registrar", x + 5, rowY + 5);
  });

  return y + height;
}

export function Pilotos() {
  const [rows, setRows] = useState<Piloto[]>([]);
  const [query, setQuery] = useState("");
  const [documentFilter, setDocumentFilter] =
    useState<DocumentoFiltro>("todos");
  const [statusFilter, setStatusFilter] = useState<EstadoFiltro>("todos");
  const [sortField, setSortField] = useState<SortField>("recientes");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [show, setShow] = useState(9);

  const [modalOpen, setModalOpen] = useState(false);
  const [viewPilot, setViewPilot] = useState<Piloto | null>(null);
  const [editPilot, setEditPilot] = useState<Piloto | null>(null);
  const [form, setForm] = useState<FormPiloto>(EMPTY_FORM);

  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");

  const [pageError, setPageError] = useState("");
  const [modalError, setModalError] = useState("");
  const [saving, setSaving] = useState(false);

  const resetFilters = () => {
    setQuery("");
    setDocumentFilter("todos");
    setStatusFilter("todos");
    setSortField("recientes");
    setSortDirection("desc");
    setShow(9);
  };

  const load = async () => {
    try {
      setPageError("");

      const data = await api("/pilotos");
      const list = Array.isArray(data) ? data : data?.pilotos ?? data?.data ?? [];

      setRows(
        [...list].sort(
          (a: Piloto, b: Piloto) => Number(b.id || 0) - Number(a.id || 0)
        )
      );
    } catch (error: any) {
      setPageError(error?.message || "No se pudieron cargar los pilotos.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const alertRows = useMemo(
    () =>
      rows.filter(
        (pilot) =>
          (pilot.dias_licencia != null && pilot.dias_licencia <= 15) ||
          (pilot.dias_dpi != null && pilot.dias_dpi <= 15)
      ),
    [rows]
  );

  const expiredAlerts = alertRows.filter(
    (pilot) =>
      (pilot.dias_licencia ?? 1) < 0 || (pilot.dias_dpi ?? 1) < 0
  ).length;

  const upcomingAlerts = alertRows.length - expiredAlerts;

  const documentsValid = rows.filter(
    (pilot) =>
      (pilot.dias_licencia == null || pilot.dias_licencia > 15) &&
      (pilot.dias_dpi == null || pilot.dias_dpi > 15)
  ).length;

  const documentsUpcoming = rows.filter(
    (pilot) =>
      (pilot.dias_licencia != null &&
        pilot.dias_licencia >= 0 &&
        pilot.dias_licencia <= 15) ||
      (pilot.dias_dpi != null &&
        pilot.dias_dpi >= 0 &&
        pilot.dias_dpi <= 15)
  ).length;

  const documentsExpired = rows.filter(
    (pilot) =>
      (pilot.dias_licencia != null && pilot.dias_licencia < 0) ||
      (pilot.dias_dpi != null && pilot.dias_dpi < 0)
  ).length;

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();

    let result = rows.filter((pilot) => {
      const searchable = `${pilot.nombre_piloto} ${pilot.codigo_piloto} ${
        pilot.licencia || ""
      } ${pilot.dpi || ""} ${pilot.nit || ""}`.toLowerCase();

      if (term && !searchable.includes(term)) return false;

      const values =
        documentFilter === "licencia"
          ? [pilot.dias_licencia]
          : documentFilter === "dpi"
          ? [pilot.dias_dpi]
          : [pilot.dias_licencia, pilot.dias_dpi];

      if (statusFilter === "vencido") {
        return values.some((value) => value != null && value < 0);
      }

      if (statusFilter === "proximo") {
        return values.some(
          (value) => value != null && value >= 0 && value <= 90
        );
      }

      if (statusFilter === "vigente") {
        return values.every((value) => value != null && value > 90);
      }

      if (statusFilter === "sin_fecha") {
        return values.some((value) => value == null);
      }

      return true;
    });

    result = [...result].sort((a, b) => {
      let comparison = 0;

      if (sortField === "nombre") {
        comparison = a.nombre_piloto.localeCompare(b.nombre_piloto, "es");
      } else if (sortField === "licencia") {
        comparison =
          diasOrden(a.dias_licencia) - diasOrden(b.dias_licencia);
      } else if (sortField === "dpi") {
        comparison = diasOrden(a.dias_dpi) - diasOrden(b.dias_dpi);
      } else if (sortField === "nacimiento") {
        comparison = String(a.fecha_nacimiento || "").localeCompare(
          String(b.fecha_nacimiento || "")
        );
      } else {
        comparison = Number(a.id || 0) - Number(b.id || 0);
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [
    rows,
    query,
    documentFilter,
    statusFilter,
    sortField,
    sortDirection,
  ]);

  const visibleRows =
    show === 9999 ? filteredRows : filteredRows.slice(0, show);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "recientes" ? "desc" : "asc");
    }
  };

  const updateBirthDate = (
    nextYear: string,
    nextMonth: string,
    nextDay: string
  ) => {
    setBirthYear(nextYear);
    setBirthMonth(nextMonth);

    let safeDay = nextDay;

    if (nextYear && nextMonth && nextDay) {
      const maxDay = new Date(
        Number(nextYear),
        Number(nextMonth),
        0
      ).getDate();

      safeDay = String(Math.min(Number(nextDay), maxDay));
    }

    setBirthDay(safeDay);

    setForm((current) => ({
      ...current,
      fecha_nacimiento:
        nextYear && nextMonth && safeDay
          ? `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(
              safeDay
            ).padStart(2, "0")}`
          : "",
    }));
  };

  const openPilot = (pilot?: Piloto) => {
    setEditPilot(pilot || null);

    const birthParts = pilot?.fecha_nacimiento
      ? pilot.fecha_nacimiento.slice(0, 10).split("-")
      : [];

    setBirthYear(birthParts[0] || "");
    setBirthMonth(birthParts[1] ? String(Number(birthParts[1])) : "");
    setBirthDay(birthParts[2] ? String(Number(birthParts[2])) : "");

    setForm(
      pilot
        ? {
            primer_nombre: pilot.primer_nombre || "",
            segundo_nombre: pilot.segundo_nombre || "",
            primer_apellido: pilot.primer_apellido || "",
            segundo_apellido: pilot.segundo_apellido || "",
            licencia: pilot.licencia || "",
            dpi: pilot.dpi || "",
            nit: pilot.nit || "",
            fecha_nacimiento: pilot.fecha_nacimiento?.slice(0, 10) || "",
            fecha_emision_licencia:
              pilot.fecha_emision_licencia?.slice(0, 10) || "",
            fecha_vencimiento_licencia:
              pilot.fecha_vencimiento_licencia?.slice(0, 10) || "",
            fecha_emision_dpi: pilot.fecha_emision_dpi?.slice(0, 10) || "",
            fecha_vencimiento_dpi:
              pilot.fecha_vencimiento_dpi?.slice(0, 10) || "",
          }
        : { ...EMPTY_FORM }
    );

    setModalError("");
    setModalOpen(true);
  };

  const savePilot = async () => {
    setModalError("");

    if (!form.primer_nombre.trim()) {
      setModalError("El primer nombre es obligatorio.");
      return;
    }

    if (!form.primer_apellido.trim()) {
      setModalError("El primer apellido es obligatorio.");
      return;
    }

    if (!form.licencia.trim()) {
      setModalError("La licencia es obligatoria.");
      return;
    }

    const age = calcularEdad(form.fecha_nacimiento);

    if (age != null && age < 18) {
      setModalError("El piloto debe tener 18 años o más.");
      return;
    }

    if (
      form.fecha_emision_licencia &&
      form.fecha_vencimiento_licencia &&
      form.fecha_emision_licencia >= form.fecha_vencimiento_licencia
    ) {
      setModalError(
        "El vencimiento de licencia debe ser posterior a su emisión."
      );
      return;
    }

    if (
      form.fecha_emision_dpi &&
      form.fecha_vencimiento_dpi &&
      form.fecha_emision_dpi >= form.fecha_vencimiento_dpi
    ) {
      setModalError("El vencimiento del DPI debe ser posterior a su emisión.");
      return;
    }

    try {
      setSaving(true);

      await api(editPilot ? `/pilotos/${editPilot.id}` : "/pilotos", {
        method: editPilot ? "PUT" : "POST",
        body: JSON.stringify(form),
      });

      setModalOpen(false);

      // Después de guardar vuelve al estado inicial:
      // el nuevo piloto aparece primero y luego el usuario puede filtrar.
      resetFilters();
      await load();
    } catch (error: any) {
      setModalError(error?.message || "No se pudo guardar el piloto.");
    } finally {
      setSaving(false);
    }
  };

  const deletePilot = async (pilot: Piloto) => {
    if (!confirm(`¿Eliminar al piloto ${pilot.nombre_piloto}?`)) return;

    try {
      await api(`/pilotos/${pilot.id}`, {
        method: "DELETE",
      });

      await load();
    } catch (error: any) {
      alert(error?.message || "No se pudo eliminar el piloto.");
    }
  };

  const downloadPilotPdf = (pilot: Piloto) => {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    drawPdfHeader(
      pdf,
      "EXPEDIENTE DE PILOTO",
      "Control de licencias y documentos de identificación",
      pilot.codigo_piloto
    );

    const age = calcularEdad(pilot.fecha_nacimiento);
    const pageWidth = pdf.internal.pageSize.getWidth();
    const halfWidth = (pageWidth - 34) / 2;

    let y = 48;

    y = drawPdfSection(
      pdf,
      "Información general",
      y,
      [
        ["Piloto", pilot.nombre_piloto],
        ["Fecha de nacimiento", formatoFecha(pilot.fecha_nacimiento)],
        ["Edad", age != null ? `${age} años` : "Sin registrar"],
        ["NIT", pilot.nit || "Sin registrar"],
      ],
      14,
      pageWidth - 28
    );

    y += 7;

    const leftY = drawPdfSection(
      pdf,
      "Licencia de conducir",
      y,
      [
        ["Número", pilot.licencia || "Sin registrar"],
        ["Fecha de emisión", formatoFecha(pilot.fecha_emision_licencia)],
        [
          "Fecha de vencimiento",
          formatoFecha(pilot.fecha_vencimiento_licencia),
        ],
      ],
      14,
      halfWidth
    );

    const rightY = drawPdfSection(
      pdf,
      "Documento personal - DPI",
      y,
      [
        ["Número", pilot.dpi || "Sin registrar"],
        ["Fecha de emisión", formatoFecha(pilot.fecha_emision_dpi)],
        ["Fecha de vencimiento", formatoFecha(pilot.fecha_vencimiento_dpi)],
      ],
      20 + halfWidth,
      halfWidth
    );

    y = Math.max(leftY, rightY) + 8;

    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(14, y, pageWidth - 28, 31, 3, 3, "FD");

    pdf.setTextColor(12, 45, 107);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("Estado documental", 19, y + 8);

    const licenseStatus = estadoDocumento(pilot.dias_licencia);
    const dpiStatus = estadoDocumento(pilot.dias_dpi);

    const licenseColor = pdfStatusColor(pilot.dias_licencia);
    pdf.setFillColor(...licenseColor);
    pdf.roundedRect(19, y + 13, 78, 10, 2, 2, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(9);
    pdf.text(`LICENCIA: ${licenseStatus.text}`, 23, y + 19.5);

    const dpiColor = pdfStatusColor(pilot.dias_dpi);
    pdf.setFillColor(...dpiColor);
    pdf.roundedRect(107, y + 13, 78, 10, 2, 2, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.text(`DPI: ${dpiStatus.text}`, 111, y + 19.5);

    const footerY = pdf.internal.pageSize.getHeight() - 15;

    pdf.setDrawColor(255, 106, 0);
    pdf.setLineWidth(0.8);
    pdf.line(14, footerY - 7, 52, footerY - 7);

    pdf.setTextColor(107, 114, 128);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text("Expediente generado desde GL365 ERP", 14, footerY);
    pdf.text(
      `Fecha de generación: ${new Date().toLocaleDateString("es-GT")}`,
      14,
      footerY + 4
    );

    pdf.save(`piloto-${pilot.codigo_piloto}.pdf`);
  };

  const downloadGeneralPdf = () => {
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    drawPdfHeader(
      pdf,
      "REPORTE GENERAL DE PILOTOS",
      "Documentación, vigencias y control de pilotos"
    );

    const total = filteredRows.length;

    pdf.setFillColor(244, 247, 252);
    pdf.roundedRect(14, 45, 58, 20, 3, 3, "F");
    pdf.roundedRect(77, 45, 58, 20, 3, 3, "F");
    pdf.roundedRect(140, 45, 58, 20, 3, 3, "F");
    pdf.roundedRect(203, 45, 58, 20, 3, 3, "F");

    const metrics = [
      ["Pilotos visibles", String(total)],
      ["Documentación vigente", String(documentsValid)],
      ["Próximos a vencer", String(documentsUpcoming)],
      ["Documentos vencidos", String(documentsExpired)],
    ];

    metrics.forEach(([label, value], index) => {
      const x = 19 + index * 63;

      pdf.setTextColor(107, 114, 128);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text(label, x, 52);

      pdf.setTextColor(12, 45, 107);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(15);
      pdf.text(value, x, 60);
    });

    autoTable(pdf, {
      startY: 72,
      head: [
        [
          "Código",
          "Piloto",
          "Licencia",
          "Estado licencia",
          "DPI",
          "Estado DPI",
          "Nacimiento",
        ],
      ],
      body: filteredRows.map((pilot) => [
        pilot.codigo_piloto,
        pilot.nombre_piloto,
        pilot.licencia || "-",
        estadoDocumento(pilot.dias_licencia).texto,
        pilot.dpi || "-",
        estadoDocumento(pilot.dias_dpi).texto,
        formatoFecha(pilot.fecha_nacimiento),
      ]),
      theme: "grid",
      headStyles: {
        fillColor: [12, 45, 107],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.4,
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      margin: {
        left: 14,
        right: 14,
      },
    });

    pdf.save("pilotos-general.pdf");
  };

  const downloadExcel = () => {
    const sheet = XLSX.utils.json_to_sheet(
      filteredRows.map((pilot) => ({
        Código: pilot.codigo_piloto,
        Piloto: pilot.nombre_piloto,
        Licencia: pilot.licencia,
        "Emisión licencia": pilot.fecha_emision_licencia || "",
        "Vencimiento licencia": pilot.fecha_vencimiento_licencia || "",
        "Estado licencia": estadoDocumento(pilot.dias_licencia).texto,
        DPI: pilot.dpi || "",
        "Emisión DPI": pilot.fecha_emision_dpi || "",
        "Vencimiento DPI": pilot.fecha_vencimiento_dpi || "",
        "Estado DPI": estadoDocumento(pilot.dias_dpi).texto,
        NIT: pilot.nit || "",
        Nacimiento: pilot.fecha_nacimiento || "",
        Edad:
          calcularEdad(pilot.fecha_nacimiento) != null
            ? calcularEdad(pilot.fecha_nacimiento)
            : "",
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Pilotos");
    XLSX.writeFile(workbook, "pilotos.xlsx");
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-[#0C2D6B]">
            <UserRound className="text-[#FF6A00]" />
            Pilotos
          </h1>
          <p className="mt-1 text-gray-500">
            Control de pilotos, licencias y documentos de identificación.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={load}
            className="flex h-12 items-center gap-2 rounded-2xl border bg-white px-5 font-bold text-[#0C2D6B] shadow-sm transition hover:bg-gray-50"
          >
            <RefreshCw size={18} />
            Actualizar
          </button>

          <button
            type="button"
            onClick={downloadGeneralPdf}
            className="flex h-12 items-center gap-2 rounded-2xl bg-red-500 px-5 font-bold text-white shadow-sm transition hover:bg-red-600"
          >
            <FileDown size={18} />
            PDF
          </button>

          <button
            type="button"
            onClick={downloadExcel}
            className="flex h-12 items-center gap-2 rounded-2xl bg-green-500 px-5 font-bold text-white shadow-sm transition hover:bg-green-600"
          >
            <FileSpreadsheet size={18} />
            Excel
          </button>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          label="Pilotos"
          value={rows.length}
          border="border-b-[#0C2D6B]"
          icon={
            <UsersRound className="text-[#0C2D6B]" />
          }
          iconClass="bg-blue-50"
        />

        <DashboardCard
          label="Documentación vigente"
          value={documentsValid}
          border="border-b-green-500"
          icon={<CheckCircle2 className="text-green-600" />}
          iconClass="bg-green-50"
        />

        <DashboardCard
          label="Próximos a vencer"
          value={documentsUpcoming}
          border="border-b-yellow-400"
          icon={<AlertTriangle className="text-yellow-600" />}
          iconClass="bg-yellow-50"
        />

        <DashboardCard
          label="Documentos vencidos"
          value={documentsExpired}
          border="border-b-[#FF6A00]"
          icon={<FileWarning className="text-[#FF6A00]" />}
          iconClass="bg-orange-50"
        />
      </section>

      {alertRows.length > 0 && (
        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex flex-wrap justify-between gap-3 border-b p-5">
            <div className="flex gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-50">
                <AlertTriangle className="text-red-600" />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-[#0C2D6B]">
                  Alertas de documentación{" "}
                  <span className="rounded-full bg-red-50 px-3 py-1 text-xs text-red-600">
                    {alertRows.length} alertas
                  </span>
                </h2>
                <p className="text-gray-500">
                  Se notifican licencias y DPI vencidos o que vencen en los
                  próximos 15 días.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <span className="h-fit rounded-full bg-red-50 px-4 py-2 font-bold text-red-600">
                {expiredAlerts} vencidos
              </span>
              <span className="h-fit rounded-full bg-yellow-50 px-4 py-2 font-bold text-yellow-700">
                {upcomingAlerts} próximos
              </span>
            </div>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {alertRows.map((pilot) => {
              const licenseDays = pilot.dias_licencia;
              const dpiDays = pilot.dias_dpi;

              const useLicense =
                licenseDays != null &&
                (dpiDays == null || licenseDays <= dpiDays);

              const days = useLicense ? licenseDays : dpiDays;
              const status = estadoDocumento(days);

              return (
                <div
                  key={pilot.id}
                  className={`rounded-2xl border border-l-8 p-5 ${
                    (days ?? 0) < 0
                      ? "border-red-200 bg-red-50"
                      : "border-yellow-200 bg-yellow-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-gray-400">
                        PILOTO
                      </div>
                      <div className="truncate text-xl font-bold text-[#0C2D6B]">
                        {pilot.nombre_piloto}
                      </div>
                      <div className="text-gray-500">
                        {useLicense ? "Licencia" : "DPI"}:{" "}
                        {useLicense ? pilot.licencia : pilot.dpi || "Sin registrar"}
                      </div>
                    </div>

                    <span
                      className={`max-w-[140px] rounded-full border px-3 py-1 text-center text-xs font-bold leading-tight ${status.clase}`}
                    >
                      {status.texto}
                    </span>
                  </div>

                  <div className="mt-4 rounded-xl bg-white/70 p-4">
                    <div className="text-xs font-bold text-gray-400">
                      VENCIMIENTO {useLicense ? "LICENCIA" : "DPI"}
                    </div>
                    <div className="text-lg font-bold text-red-600">
                      {formatoFecha(
                        useLicense
                          ? pilot.fecha_vencimiento_licencia
                          : pilot.fecha_vencimiento_dpi
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setViewPilot(pilot)}
                      className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 font-bold text-[#0C2D6B] shadow-sm"
                    >
                      <Eye size={17} />
                      Ver
                    </button>

                    <button
                      type="button"
                      onClick={() => openPilot(pilot)}
                      className="flex items-center gap-2 rounded-xl bg-[#0C2D6B] px-4 py-2 font-bold text-white"
                    >
                      <Edit3 size={17} />
                      Actualizar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#0C2D6B]">
            Pilotos registrados
          </h2>
          <p className="text-gray-500">
            Consulta, filtra y administra los pilotos registrados.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openPilot()}
          className="flex h-12 items-center gap-2 rounded-2xl bg-[#0C2D6B] px-6 font-bold text-white shadow-sm transition hover:bg-[#143C8C]"
        >
          <Plus />
          Nuevo Piloto
        </button>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[minmax(320px,1fr)_230px_230px_auto]">
          <div className="flex h-12 items-center gap-2 rounded-xl border px-4 shadow-sm">
            <Search className="shrink-0 text-gray-400" />
            <input
              className="min-w-0 flex-1 outline-none"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre, DPI, licencia, NIT o código..."
            />
          </div>

          <div className="relative">
            <Filter className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <select
              className="h-12 w-full appearance-none rounded-xl border bg-white pl-11 pr-10 font-medium outline-none shadow-sm focus:border-[#0C2D6B]"
              value={documentFilter}
              onChange={(event) =>
                setDocumentFilter(event.target.value as DocumentoFiltro)
              }
            >
              <option value="todos">Todos los documentos</option>
              <option value="licencia">Licencia</option>
              <option value="dpi">DPI</option>
            </select>
          </div>

          <div className="relative">
            <Filter className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <select
              className="h-12 w-full appearance-none rounded-xl border bg-white pl-11 pr-10 font-medium outline-none shadow-sm focus:border-[#0C2D6B]"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as EstadoFiltro)
              }
            >
              <option value="todos">Todos los estados</option>
              <option value="vigente">Vigentes</option>
              <option value="proximo">Próximos a vencer</option>
              <option value="vencido">Vencidos</option>
              <option value="sin_fecha">Sin fecha</option>
            </select>
          </div>

          <button
            type="button"
            onClick={resetFilters}
            className="h-12 rounded-xl border border-orange-300 px-5 font-semibold text-[#FF6A00] shadow-sm transition hover:bg-orange-50"
          >
            ×&nbsp; Limpiar
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-bold uppercase text-gray-400">
              Ordenar por:
            </span>

            {(
              [
                ["recientes", "Recientes"],
                ["nombre", "Nombre"],
                ["licencia", "Licencia"],
                ["dpi", "DPI"],
                ["nacimiento", "Nacimiento"],
              ] as Array<[SortField, string]>
            ).map(([field, label]) => (
              <button
                key={field}
                type="button"
                onClick={() => toggleSort(field)}
                className={`inline-flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-bold transition ${
                  sortField === field
                    ? "border-[#0C2D6B] bg-blue-50 text-[#0C2D6B]"
                    : "border-gray-200 bg-white text-[#0C2D6B] hover:bg-gray-50"
                }`}
              >
                {label}
                <span className="text-[11px]">
                  {sortField === field
                    ? sortDirection === "asc"
                      ? "↑"
                      : "↓"
                    : "↕"}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <span className="font-semibold">
              {filteredRows.length} de {rows.length} registros visibles
            </span>

            <div className="flex items-center gap-2">
              <span>Mostrar</span>
              <select
                value={show}
                onChange={(event) => setShow(Number(event.target.value))}
                className="rounded-lg border p-2"
              >
                <option value={9}>9</option>
                <option value={18}>18</option>
                <option value={27}>27</option>
                <option value={9999}>Todos</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {pageError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">
          {pageError}
        </div>
      )}

      {visibleRows.length === 0 ? (
        <div className="rounded-2xl border bg-white p-10 text-center shadow-sm">
          <UserRound className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-lg font-bold text-[#0C2D6B]">
            No se encontraron pilotos
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Prueba limpiando los filtros o utilizando otra búsqueda.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleRows.map((pilot) => (
            <PilotCard
              key={pilot.id}
              pilot={pilot}
              onView={() => setViewPilot(pilot)}
              onEdit={() => openPilot(pilot)}
              onPdf={() => downloadPilotPdf(pilot)}
              onDelete={() => deletePilot(pilot)}
            />
          ))}
        </div>
      )}

      {viewPilot && (
        <PilotViewModal
          pilot={viewPilot}
          onClose={() => setViewPilot(null)}
          onEdit={() => {
            const pilot = viewPilot;
            setViewPilot(null);
            openPilot(pilot);
          }}
          onPdf={() => downloadPilotPdf(viewPilot)}
        />
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex justify-between border-b bg-white p-5">
              <div>
                <h2 className="text-xl font-bold text-[#0C2D6B]">
                  {editPilot ? "Editar piloto" : "Nuevo piloto"}
                </h2>
                <p className="text-sm text-gray-500">
                  El piloto debe tener 18 años o más.
                </p>
              </div>

              <button
                type="button"
                onClick={() => !saving && setModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <X />
              </button>
            </div>

            <div
              className="grid gap-4 p-6 md:grid-cols-2"
              onKeyDown={moverConEnter}
            >
              <InputField
                label="Primer nombre *"
                value={form.primer_nombre}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    primer_nombre: value,
                  }))
                }
              />

              <InputField
                label="Segundo nombre"
                value={form.segundo_nombre}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    segundo_nombre: value,
                  }))
                }
              />

              <InputField
                label="Primer apellido *"
                value={form.primer_apellido}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    primer_apellido: value,
                  }))
                }
              />

              <InputField
                label="Segundo apellido"
                value={form.segundo_apellido}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    segundo_apellido: value,
                  }))
                }
              />

              <InputField
                label="Licencia *"
                value={form.licencia}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    licencia: value,
                  }))
                }
              />

              <InputField
                label="DPI"
                value={form.dpi}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    dpi: value,
                  }))
                }
              />

              <InputField
                label="NIT"
                value={form.nit}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    nit: value,
                  }))
                }
              />

              <label>
                <span className="mb-1 block text-xs font-bold text-gray-600">
                  Fecha de nacimiento
                </span>
                <FechaNacimiento
                  year={birthYear}
                  month={birthMonth}
                  day={birthDay}
                  onYearChange={(value) =>
                    updateBirthDate(value, birthMonth, birthDay)
                  }
                  onMonthChange={(value) =>
                    updateBirthDate(birthYear, value, birthDay)
                  }
                  onDayChange={(value) =>
                    updateBirthDate(birthYear, birthMonth, value)
                  }
                />
              </label>

              <DateField
                label="Emisión de licencia"
                value={form.fecha_emision_licencia}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    fecha_emision_licencia: value,
                  }))
                }
              />

              <DateField
                label="Vencimiento de licencia"
                value={form.fecha_vencimiento_licencia}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    fecha_vencimiento_licencia: value,
                  }))
                }
              />

              <DateField
                label="Emisión de DPI"
                value={form.fecha_emision_dpi}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    fecha_emision_dpi: value,
                  }))
                }
              />

              <DateField
                label="Vencimiento de DPI"
                value={form.fecha_vencimiento_dpi}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    fecha_vencimiento_dpi: value,
                  }))
                }
              />

              {modalError && (
                <div className="rounded-xl bg-red-50 p-3 text-red-700 md:col-span-2">
                  {modalError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t p-5">
              <button
                type="button"
                disabled={saving}
                onClick={() => setModalOpen(false)}
                className="h-11 rounded-xl border px-5 transition hover:bg-gray-50 disabled:opacity-60"
              >
                Cancelar
              </button>

              <button
                data-save="true"
                type="button"
                disabled={saving}
                onClick={savePilot}
                className="flex h-11 items-center gap-2 rounded-xl bg-[#0C2D6B] px-5 font-bold text-white transition hover:bg-[#143C8C] disabled:opacity-60"
              >
                {saving && <RefreshCw className="h-4 w-4 animate-spin" />}
                {saving ? "Guardando..." : "Guardar piloto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardCard({
  label,
  value,
  border,
  icon,
  iconClass,
}: {
  label: string;
  value: number;
  border: string;
  icon: React.ReactNode;
  iconClass: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-b-4 bg-white p-5 shadow-sm ${border}`}
    >
      <div className="flex justify-between gap-3">
        <div>
          <div className="text-gray-500">{label}</div>
          <div className="mt-1 text-3xl font-bold text-[#0C2D6B]">{value}</div>
        </div>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconClass}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function PilotCard({
  pilot,
  onView,
  onEdit,
  onPdf,
  onDelete,
}: {
  pilot: Piloto;
  onView: () => void;
  onEdit: () => void;
  onPdf: () => void;
  onDelete: () => void;
}) {
  const licenseStatus = estadoDocumento(pilot.dias_licencia);
  const dpiStatus = estadoDocumento(pilot.dias_dpi);
  const age = calcularEdad(pilot.fecha_nacimiento);

  return (
    <article className="overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50">
              <UserRound className="text-[#0C2D6B]" />
            </div>

            <div className="min-w-0">
              <h3 className="text-lg font-bold leading-tight text-[#0C2D6B]">
                {pilot.nombre_piloto}
              </h3>
              <p className="mt-1 text-xs font-bold text-[#FF6A00]">
                {pilot.codigo_piloto}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {age != null
                  ? `${age} años · NIT ${pilot.nit || "Sin registrar"}`
                  : `NIT ${pilot.nit || "Sin registrar"}`}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <DocumentBox
            title="Licencia"
            number={pilot.licencia || "Sin registrar"}
            expiry={formatoFecha(pilot.fecha_vencimiento_licencia)}
            status={licenseStatus}
          />

          <DocumentBox
            title="DPI"
            number={pilot.dpi || "Sin registrar"}
            expiry={formatoFecha(pilot.fecha_vencimiento_dpi)}
            status={dpiStatus}
          />
        </div>

        <div className="mt-4 rounded-xl bg-gray-50 px-4 py-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
            Fecha de nacimiento
          </div>
          <div className="mt-1 font-semibold text-gray-700">
            {formatoFecha(pilot.fecha_nacimiento)}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t bg-gray-50 px-4 py-3">
        <ActionButton
          title="Ver"
          onClick={onView}
          className="bg-blue-50 text-[#0C2D6B]"
        >
          <Eye size={17} />
        </ActionButton>

        <ActionButton
          title="Editar"
          onClick={onEdit}
          className="bg-orange-50 text-orange-600"
        >
          <Edit3 size={17} />
        </ActionButton>

        <ActionButton
          title="Descargar PDF"
          onClick={onPdf}
          className="bg-green-50 text-green-600"
        >
          <Download size={17} />
        </ActionButton>

        <ActionButton
          title="Eliminar"
          onClick={onDelete}
          className="bg-red-50 text-red-600"
        >
          <Trash2 size={17} />
        </ActionButton>
      </div>
    </article>
  );
}

function DocumentBox({
  title,
  number,
  expiry,
  status,
}: {
  title: string;
  number: string;
  expiry: string;
  status: ReturnType<typeof estadoDocumento>;
}) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
        {title}
      </div>

      <div className="mt-1 break-words text-sm font-bold text-[#0C2D6B]">
        {number}
      </div>

      <div className="mt-2 text-[11px] text-gray-500">
        Vence: <span className="font-semibold">{expiry}</span>
      </div>

      <span
        className={`mt-2 inline-flex max-w-full rounded-full border px-2.5 py-1 text-[10px] font-bold leading-tight ${status.clase}`}
      >
        {status.texto}
      </span>
    </div>
  );
}

function ActionButton({
  title,
  onClick,
  className,
  children,
}: {
  title: string;
  onClick: () => void;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center rounded-xl transition hover:scale-105 ${className}`}
    >
      {children}
    </button>
  );
}

function PilotViewModal({
  pilot,
  onClose,
  onEdit,
  onPdf,
}: {
  pilot: Piloto;
  onClose: () => void;
  onEdit: () => void;
  onPdf: () => void;
}) {
  const age = calcularEdad(pilot.fecha_nacimiento);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 bg-[#0C2D6B] p-5 text-white">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-100">
              Expediente del piloto
            </div>
            <h2 className="mt-1 text-2xl font-bold">{pilot.nombre_piloto}</h2>
            <p className="mt-1 text-sm text-blue-100">{pilot.codigo_piloto}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
          >
            <X />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <ViewBox
              title="Información personal"
              items={[
                ["Piloto", pilot.nombre_piloto],
                ["Código", pilot.codigo_piloto],
                ["Nacimiento", formatoFecha(pilot.fecha_nacimiento)],
                ["Edad", age != null ? `${age} años` : "Sin registrar"],
                ["NIT", pilot.nit || "Sin registrar"],
              ]}
            />

            <ViewBox
              title="Licencia"
              items={[
                ["Número", pilot.licencia || "Sin registrar"],
                ["Emisión", formatoFecha(pilot.fecha_emision_licencia)],
                [
                  "Vencimiento",
                  formatoFecha(pilot.fecha_vencimiento_licencia),
                ],
                ["Estado", estadoDocumento(pilot.dias_licencia).texto],
              ]}
            />

            <ViewBox
              title="Documento Personal de Identificación"
              className="md:col-span-2"
              items={[
                ["DPI", pilot.dpi || "Sin registrar"],
                ["Emisión", formatoFecha(pilot.fecha_emision_dpi)],
                ["Vencimiento", formatoFecha(pilot.fecha_vencimiento_dpi)],
                ["Estado", estadoDocumento(pilot.dias_dpi).texto],
              ]}
            />
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t bg-gray-50 p-4">
          <button
            type="button"
            onClick={onPdf}
            className="flex h-10 items-center gap-2 rounded-xl bg-green-50 px-4 font-bold text-green-700"
          >
            <Download size={17} />
            PDF
          </button>

          <button
            type="button"
            onClick={onEdit}
            className="flex h-10 items-center gap-2 rounded-xl bg-[#0C2D6B] px-4 font-bold text-white"
          >
            <Edit3 size={17} />
            Editar
          </button>
        </div>
      </div>
    </div>
  );
}

function ViewBox({
  title,
  items,
  className = "",
}: {
  title: string;
  items: Array<[string, string]>;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border bg-gray-50 p-5 ${className}`}>
      <h3 className="font-bold text-[#0C2D6B]">{title}</h3>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {items.map(([label, value]) => (
          <div key={label}>
            <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
              {label}
            </div>
            <div className="mt-1 break-words text-sm font-semibold text-gray-700">
              {value || "Sin registrar"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="mb-1 block text-xs font-bold text-gray-600">{label}</span>
      <input
        type="text"
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="mb-1 block text-xs font-bold text-gray-600">{label}</span>
      <input
        type="date"
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}