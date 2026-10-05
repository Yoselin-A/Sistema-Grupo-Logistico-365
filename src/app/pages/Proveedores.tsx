import { useEffect, useMemo, useState } from "react";

import {

  AlertTriangle,

  Building2,

  CheckCircle2,

  Download,

  Edit3,

  Eye,

  FileDown,

  FileSpreadsheet,

  Plus,

  RefreshCw,

  Search,

  Trash2,

  UserPlus,

  X,

} from "lucide-react";

import jsPDF from "jspdf";

import autoTable from "jspdf-autotable";

import * as XLSX from "xlsx";

import logoGl365 from "../../assets/614cb11181e5d72cb3a39a09d833f4775b7fc7ce.png";



type Proveedor = {

  id: number;

  codigo_proveedor: string;

  razon_social: string;

  nombre_comercial?: string | null;

  nit: string;

  estado_id?: number;

  estado?: string;

  nombre_estado_proveedor?: string;

  correo?: string | null;

  telefono?: string | null;

  servicio_principal?: string | null;

  desempeno?: "Verde" | "Amarillo" | "Rojo" | string;

  historial?: string | null;

  hallazgos?: string | null;

  fecha_evaluacion?: string | null;

  estado_sat?: string | null;

  lista_clinton?: number | boolean;

  rtu_validado?: number | boolean;

  licencia_validada?: number | boolean;

  cuenta_validada?: number | boolean;

};



type ContactoProveedor = {

  id?: number | string;

  proveedor_id?: number;

  primer_nombre: string;

  segundo_nombre?: string;

  primer_apellido: string;

  segundo_apellido?: string;

  cargo?: string;

  correo?: string;

  telefono?: string;

  es_principal?: number | boolean;

  estado?: number | boolean;

};



type ServicioProveedor = {

  id?: number | string;

  proveedor_id?: number;

  codigo_servicio?: string;

  nombre_servicio_proveedor: string;

  es_principal?: number | boolean;

};



type CumplimientoProveedor = {

  id?: number;

  proveedor_id?: number;

  estado_sat: "vigente" | "no_vigente" | "pendiente" | string;

  lista_clinton: boolean;

  rtu_validado: boolean;

  licencia_validada: boolean;

  cuenta_validada: boolean;

};



type DesempenoProveedor = {

  id?: number;

  proveedor_id?: number;

  nivel: "Verde" | "Amarillo" | "Rojo" | string;

  historial?: string;

  hallazgos?: string;

  fecha?: string;

};



type ProviderPayload = {

  proveedores: Proveedor[];

  contactosProveedor: ContactoProveedor[];

  serviciosProveedor: ServicioProveedor[];

  cumplimientosProveedor: CumplimientoProveedor[];

  desempenosProveedor: DesempenoProveedor[];

  estadosProveedor: Array<{ id: number; nombre_estado_proveedor?: string; nombre?: string }>;

};



type ProviderForm = {

  razon_social: string;

  nombre_comercial: string;

  nit: string;

  correo: string;

  telefono: string;

  estado_id: number;

};


type ToastMessage = {
  message: string;
  type: "success" | "error";
};



const EMPTY_FORM: ProviderForm = {

  razon_social: "",

  nombre_comercial: "",

  nit: "",

  correo: "",

  telefono: "",

  estado_id: 1,

};



const EMPTY_COMPLIANCE: CumplimientoProveedor = {

  estado_sat: "pendiente",

  lista_clinton: false,

  rtu_validado: false,

  licencia_validada: false,

  cuenta_validada: false,

};



const EMPTY_PERFORMANCE: DesempenoProveedor = {

  nivel: "Amarillo",

  historial: "",

  hallazgos: "",

  fecha: new Date().toISOString().slice(0, 10),

};



const inputClass =

  "w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-[#0C2D6B] focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-gray-500";



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



function providerState(provider: Proveedor) {

  return (

    provider.nombre_estado_proveedor ||

    provider.estado ||

    (Number(provider.estado_id) === 2 ? "Inactivo" : "Activo")

  );

}



function normalizePerformance(value?: string | null) {

  const text = String(value || "Amarillo").toLowerCase();

  if (text.includes("verd")) return "Verde";

  if (text.includes("roj")) return "Rojo";

  return "Amarillo";

}



function normalizeSat(value?: string | null) {

  const text = String(value || "pendiente").toLowerCase();

  if (text.includes("no")) return "no_vigente";

  if (text.includes("vig")) return "vigente";

  return "pendiente";

}



function fullContactName(contact?: ContactoProveedor | null) {

  if (!contact) return "Sin contacto";

  return [

    contact.primer_nombre,

    contact.segundo_nombre,

    contact.primer_apellido,

    contact.segundo_apellido,

  ]

    .filter(Boolean)

    .join(" ");

}



function bool(value: unknown) {

  return value === true || value === 1 || value === "1";

}



function performanceBadge(level: string) {

  const normalized = normalizePerformance(level);

  if (normalized === "Verde") return "bg-green-100 text-green-700 border-green-200";

  if (normalized === "Rojo") return "bg-red-100 text-red-700 border-red-200";

  return "bg-yellow-100 text-yellow-700 border-yellow-200";

}



function satBadge(state: string) {

  const normalized = normalizeSat(state);

  if (normalized === "vigente") return "bg-green-100 text-green-700";

  if (normalized === "no_vigente") return "bg-red-100 text-red-700";

  return "bg-yellow-100 text-yellow-700";

}



function stateBadge(state: string) {

  return state.toLowerCase().includes("activ") && !state.toLowerCase().includes("inactiv")

    ? "bg-blue-100 text-blue-700"

    : "bg-gray-100 text-gray-600";

}



function displaySat(value?: string | null) {

  const state = normalizeSat(value);

  if (state === "vigente") return "Vigente";

  if (state === "no_vigente") return "No vigente";

  return "Pendiente";

}



function formatDate(value?: string | null) {

  if (!value) return "Sin registrar";

  const raw = String(value).slice(0, 10);

  const [year, month, day] = raw.split("-");

  return year && month && day ? `${day}/${month}/${year}` : value;

}




function correoValido(value?: string | null) {
  const correo = String(value ?? "").trim();
  if (!correo) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

function avanzarConEnter(event: React.KeyboardEvent<HTMLElement>) {
  if (event.key !== "Enter" || event.shiftKey) return;

  const actual = event.target as HTMLElement;
  if (
    actual.tagName === "TEXTAREA" ||
    (actual instanceof HTMLInputElement &&
      ["checkbox", "radio", "button", "submit"].includes(actual.type))
  ) return;

  const campos = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])'
    )
  ).filter((campo) => {
    const estilo = window.getComputedStyle(campo);
    return campo.tabIndex >= 0 && estilo.display !== "none" && estilo.visibility !== "hidden";
  });

  const indice = campos.indexOf(actual);
  if (indice >= 0 && indice < campos.length - 1) {
    event.preventDefault();
    campos[indice + 1].focus();
  }
}

export function Proveedores() {

  const [providers, setProviders] = useState<Proveedor[]>([]);

  const [contacts, setContacts] = useState<ContactoProveedor[]>([]);

  const [services, setServices] = useState<ServicioProveedor[]>([]);

  const [compliances, setCompliances] = useState<CumplimientoProveedor[]>([]);

  const [performances, setPerformances] = useState<DesempenoProveedor[]>([]);

  const [providerStates, setProviderStates] = useState<ProviderPayload["estadosProveedor"]>([]);



  const [query, setQuery] = useState("");

  const [stateFilter, setStateFilter] = useState("todos");

  const [performanceFilter, setPerformanceFilter] = useState("todos");

  const [satFilter, setSatFilter] = useState("todos");

  const [pageSize, setPageSize] = useState(10);

  const [page, setPage] = useState(1);

  const [sortField, setSortField] = useState<"codigo" | "proveedor" | "nit" | "servicio" | "contacto" | "desempeno" | "sat" | "estado">("codigo");

  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");



  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);

  const [modalMode, setModalMode] = useState<"create" | "edit" | "view">("create");

  const [selected, setSelected] = useState<Proveedor | null>(null);

  const [form, setForm] = useState<ProviderForm>(EMPTY_FORM);

  const [contactDraft, setContactDraft] = useState<ContactoProveedor[]>([]);

  const [serviceDraft, setServiceDraft] = useState<ServicioProveedor[]>([]);

  const [complianceDraft, setComplianceDraft] = useState<CumplimientoProveedor>(EMPTY_COMPLIANCE);

  const [performanceDraft, setPerformanceDraft] = useState<DesempenoProveedor>(EMPTY_PERFORMANCE);

  const [deleteTarget, setDeleteTarget] = useState<Proveedor | null>(null);

  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState<ToastMessage | null>(null);



  const load = async () => {

    setLoading(true);

    try {

      const data = (await api("/proveedores")) as ProviderPayload | Proveedor[];

      if (Array.isArray(data)) {

        setProviders(data);

        setContacts([]);

        setServices([]);

        setCompliances([]);

        setPerformances([]);

        setProviderStates([]);

      } else {

        setProviders(Array.isArray(data?.proveedores) ? data.proveedores : []);

        setContacts(Array.isArray(data?.contactosProveedor) ? data.contactosProveedor : []);

        setServices(Array.isArray(data?.serviciosProveedor) ? data.serviciosProveedor : []);

        setCompliances(Array.isArray(data?.cumplimientosProveedor) ? data.cumplimientosProveedor : []);

        setPerformances(Array.isArray(data?.desempenosProveedor) ? data.desempenosProveedor : []);

        setProviderStates(Array.isArray(data?.estadosProveedor) ? data.estadosProveedor : []);

      }

      setError("");

    } catch (err: any) {

      setError(err?.message || "No se pudieron cargar los proveedores.");

    } finally {

      setLoading(false);

    }

  };



  useEffect(() => {

    load();

  }, []);


  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [toast]);


  const showToast = (message: string, type: ToastMessage["type"] = "success") => {
    setToast({ message, type });
  };



  const contactsFor = (providerId: number) =>

    contacts.filter((item) => Number(item.proveedor_id) === Number(providerId) && item.estado !== 0);



  const servicesFor = (providerId: number) =>

    services.filter((item) => Number(item.proveedor_id) === Number(providerId));



  const principalContactFor = (providerId: number) => {

    const list = contactsFor(providerId);

    return list.find((item) => bool(item.es_principal)) || list[0] || null;

  };



  const principalServiceFor = (provider: Proveedor) => {

    const list = servicesFor(provider.id);

    return (

      list.find((item) => bool(item.es_principal))?.nombre_servicio_proveedor ||

      list[0]?.nombre_servicio_proveedor ||

      provider.servicio_principal ||

      "Sin registrar"

    );

  };



  const complianceFor = (provider: Proveedor) => {

    const list = compliances.filter((item) => Number(item.proveedor_id) === Number(provider.id));

    return (

      list[0] || {

        ...EMPTY_COMPLIANCE,

        estado_sat: normalizeSat(provider.estado_sat),

        lista_clinton: bool(provider.lista_clinton),

        rtu_validado: bool(provider.rtu_validado),

        licencia_validada: bool(provider.licencia_validada),

        cuenta_validada: bool(provider.cuenta_validada),

      }

    );

  };



  const performanceFor = (provider: Proveedor) => {

    const list = performances

      .filter((item) => Number(item.proveedor_id) === Number(provider.id))

      .sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")));

    return (

      list[0] || {

        ...EMPTY_PERFORMANCE,

        nivel: normalizePerformance(provider.desempeno),

        historial: provider.historial || "",

        hallazgos: provider.hallazgos || "",

        fecha: provider.fecha_evaluacion?.slice(0, 10) || "",

      }

    );

  };



  const filtered = useMemo(() => {

    const text = query.trim().toLowerCase();

    return providers.filter((provider) => {

      const contact = principalContactFor(provider.id);

      const service = principalServiceFor(provider);

      const performance = normalizePerformance(performanceFor(provider).nivel);

      const sat = normalizeSat(complianceFor(provider).estado_sat);

      const state = providerState(provider).toLowerCase();

      const haystack = [

        provider.codigo_proveedor,

        provider.razon_social,

        provider.nombre_comercial,

        provider.nit,

        provider.correo,

        provider.telefono,

        fullContactName(contact),

        contact?.cargo,

        contact?.correo,

        contact?.telefono,

        service,

      ]

        .filter(Boolean)

        .join(" ")

        .toLowerCase();



      const matchesQuery = !text || haystack.includes(text);

      const matchesState = stateFilter === "todos" || state === stateFilter;

      const matchesPerformance =

        performanceFilter === "todos" || performance.toLowerCase() === performanceFilter;

      const matchesSat = satFilter === "todos" || sat === satFilter;

      return matchesQuery && matchesState && matchesPerformance && matchesSat;

    });

  }, [providers, contacts, services, compliances, performances, query, stateFilter, performanceFilter, satFilter]);



  const sorted = useMemo(() => {

    const rows = [...filtered];

    rows.sort((a, b) => {

      const contactA = principalContactFor(a.id);

      const contactB = principalContactFor(b.id);

      const values: Record<string, [string, string]> = {

        codigo: [a.codigo_proveedor || "", b.codigo_proveedor || ""],

        proveedor: [a.razon_social || "", b.razon_social || ""],

        nit: [a.nit || "", b.nit || ""],

        servicio: [principalServiceFor(a), principalServiceFor(b)],

        contacto: [fullContactName(contactA), fullContactName(contactB)],

        desempeno: [normalizePerformance(performanceFor(a).nivel), normalizePerformance(performanceFor(b).nivel)],

        sat: [normalizeSat(complianceFor(a).estado_sat), normalizeSat(complianceFor(b).estado_sat)],

        estado: [providerState(a), providerState(b)],

      };

      const [left, right] = values[sortField];

      const result = left.localeCompare(right, "es", { numeric: true, sensitivity: "base" });

      return sortDirection === "asc" ? result : -result;

    });

    return rows;

  }, [filtered, sortField, sortDirection, contacts, services, compliances, performances]);



  useEffect(() => {

    setPage(1);

  }, [query, stateFilter, performanceFilter, satFilter, pageSize]);



  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));

  const currentPage = Math.min(page, totalPages);

  const visibleRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);



  const activeCount = providers.filter((provider) => providerState(provider).toLowerCase() === "activo").length;

  const redCount = providers.filter((provider) => normalizePerformance(performanceFor(provider).nivel) === "Rojo").length;

  const satNotCurrent = providers.filter((provider) => normalizeSat(complianceFor(provider).estado_sat) === "no_vigente").length;



  const resetView = () => {
    setQuery("");
    setStateFilter("todos");
    setPerformanceFilter("todos");
    setSatFilter("todos");
    setSortField("codigo");
    setSortDirection("desc");
    setPageSize(10);
    setPage(1);
  };

  const sortBy = (field: typeof sortField) => {

    if (sortField === field) {

      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));

    } else {

      setSortField(field);

      setSortDirection("asc");

    }

  };



  const openCreate = () => {

    setSelected(null);

    setModalMode("create");

    setForm(EMPTY_FORM);

    setContactDraft([]);

    setServiceDraft([]);

    setComplianceDraft({ ...EMPTY_COMPLIANCE });

    setPerformanceDraft({ ...EMPTY_PERFORMANCE, fecha: new Date().toISOString().slice(0, 10) });

    setError("");

    setModalOpen(true);

  };



  const openProvider = (provider: Proveedor, mode: "edit" | "view") => {

    setSelected(provider);

    setModalMode(mode);

    setForm({

      razon_social: provider.razon_social || "",

      nombre_comercial: provider.nombre_comercial || "",

      nit: provider.nit || "",

      correo: provider.correo || "",

      telefono: provider.telefono || "",

      estado_id: Number(provider.estado_id || (providerState(provider).toLowerCase() === "inactivo" ? 2 : 1)),

    });

    setContactDraft(contactsFor(provider.id).map((item) => ({ ...item })));

    setServiceDraft(servicesFor(provider.id).map((item) => ({ ...item })));

    setComplianceDraft({ ...complianceFor(provider) });

    setPerformanceDraft({ ...performanceFor(provider) });

    setError("");

    setModalOpen(true);

  };



  const addContact = () => {

    setContactDraft((current) => [

      ...current,

      {

        id: `new-${Date.now()}`,

        primer_nombre: "",

        segundo_nombre: "",

        primer_apellido: "",

        segundo_apellido: "",

        cargo: "",

        correo: "",

        telefono: "",

        es_principal: current.length === 0,

        estado: 1,

      },

    ]);

  };



  const patchContact = (index: number, patch: Partial<ContactoProveedor>) => {

    setContactDraft((current) =>

      current.map((item, itemIndex) => {

        if (itemIndex !== index) {

          if (patch.es_principal) return { ...item, es_principal: false };

          return item;

        }

        return { ...item, ...patch };

      })

    );

  };



  const addService = () => {

    setServiceDraft((current) => [

      ...current,

      {

        id: `new-${Date.now()}`,

        nombre_servicio_proveedor: "",

        es_principal: current.length === 0,

      },

    ]);

  };



  const patchService = (index: number, patch: Partial<ServicioProveedor>) => {

    setServiceDraft((current) =>

      current.map((item, itemIndex) => {

        if (itemIndex !== index) {

          if (patch.es_principal) return { ...item, es_principal: false };

          return item;

        }

        return { ...item, ...patch };

      })

    );

  };



  const saveProvider = async () => {

    if (!form.razon_social.trim()) {

      setError("La razón social es obligatoria.");

      return;

    }

    if (!form.nit.trim()) {

      setError("El NIT es obligatorio.");

      return;

    }

    if (!correoValido(form.correo)) {
      setError("El correo general no es válido. Debe incluir @ y un dominio, por ejemplo: nombre@empresa.com");
      return;
    }

    const contactoCorreoInvalido = contactDraft.find(
      (item) => item.correo?.trim() && !correoValido(item.correo)
    );

    if (contactoCorreoInvalido) {
      setError("Hay un correo de contacto no válido. Debe incluir @ y un dominio.");
      return;
    }



    const invalidContact = contactDraft.find(

      (item) => item.primer_nombre.trim() && !item.primer_apellido.trim()

    );

    if (invalidContact) {

      setError("Completa el apellido de los contactos registrados.");

      return;

    }



    setLoading(true);

    try {

      const payload = {

        ...form,

        contactos: contactDraft

          .filter((item) => item.primer_nombre.trim() || item.primer_apellido.trim())

          .map((item) => ({ ...item, id: undefined })),

        servicios: serviceDraft

          .filter((item) => item.nombre_servicio_proveedor.trim())

          .map((item) => ({ ...item, id: undefined })),

        cumplimiento: {

          estado_sat: complianceDraft.estado_sat,

          lista_clinton: bool(complianceDraft.lista_clinton),

          rtu_validado: bool(complianceDraft.rtu_validado),

          licencia_validada: bool(complianceDraft.licencia_validada),

          cuenta_validada: bool(complianceDraft.cuenta_validada),

        },

        desempeno: {

          nivel: normalizePerformance(performanceDraft.nivel),

          historial: performanceDraft.historial || "",

          hallazgos: performanceDraft.hallazgos || "",

          fecha: performanceDraft.fecha || new Date().toISOString().slice(0, 10),

        },

      };



      const wasEditing = Boolean(selected);

      await api(selected ? `/proveedores/${selected.id}` : "/proveedores", {

        method: selected ? "PUT" : "POST",

        body: JSON.stringify(payload),

      });

      setModalOpen(false);
      resetView();
      await load();

      showToast(
        wasEditing
          ? "Proveedor actualizado correctamente."
          : "Proveedor creado correctamente."
      );

    } catch (err: any) {

      setError(err?.message || "No se pudo guardar el proveedor.");

    } finally {

      setLoading(false);

    }

  };



  const deleteProvider = (provider: Proveedor) => {
    setDeleteTarget(provider);
  };



  const confirmDeleteProvider = async () => {
    if (!deleteTarget || deleting) return;

    setDeleting(true);

    try {
      await api(`/proveedores/${deleteTarget.id}`, { method: "DELETE" });

      setDeleteTarget(null);
      resetView();
      await load();
      showToast("Proveedor eliminado correctamente.");
    } catch (err: any) {
      setDeleteTarget(null);
      showToast(err?.message || "No se pudo eliminar el proveedor.", "error");
    } finally {
      setDeleting(false);
    }
  };



  const imageToDataUrl = (src: string): Promise<string> =>

    new Promise((resolve, reject) => {

      const image = new Image();

      image.onload = () => {

        const canvas = document.createElement("canvas");

        canvas.width = image.naturalWidth;

        canvas.height = image.naturalHeight;

        const context = canvas.getContext("2d");

        if (!context) return reject(new Error("No se pudo preparar el logo."));

        context.drawImage(image, 0, 0);

        resolve(canvas.toDataURL("image/png"));

      };

      image.onerror = () => reject(new Error("No se pudo cargar el logo."));

      image.src = src;

    });



  let pdfLogoData: string | null = null;



  const drawPdfHeader = async (doc: jsPDF, title: string, code?: string) => {

    doc.setFillColor(12, 45, 107);

    doc.rect(0, 0, 210, 37, "F");



    // Recuadro blanco para el logotipo oficial.

    doc.setFillColor(255, 255, 255);

    doc.roundedRect(8, 5, 43, 27, 2, 2, "F");

    try {

      if (!pdfLogoData) pdfLogoData = await imageToDataUrl(logoGl365);

      // Mantiene el logo contenido dentro del recuadro para que no se salga.

      doc.addImage(pdfLogoData, "PNG", 11, 7, 37, 23, undefined, "FAST");

    } catch {

      // Si el navegador no puede convertir la imagen, el PDF sigue generándose.

    }



    doc.setTextColor(255, 255, 255);

    doc.setFont("helvetica", "bold");

    doc.setFontSize(18);

    doc.text(title, 202, 16, { align: "right" });

    if (code) {

      doc.setFontSize(9);

      doc.text(code, 202, 24, { align: "right" });

    }

  };



  const downloadProviderPdf = async (provider: Proveedor) => {

    const doc = new jsPDF({ unit: "mm", format: "a4" });

    const providerContacts = contactsFor(provider.id);

    const providerServices = servicesFor(provider.id);

    const principalContact = principalContactFor(provider.id);

    const compliance = complianceFor(provider);

    const performance = performanceFor(provider);



    await drawPdfHeader(doc, "EXPEDIENTE DE PROVEEDOR", provider.codigo_proveedor);



    let y = 47;

    const section = (title: string, subtitle?: string) => {

      doc.setFillColor(239, 244, 255);

      doc.roundedRect(8, y, 194, subtitle ? 15 : 11, 2, 2, "F");

      doc.setTextColor(12, 45, 107);

      doc.setFont("helvetica", "bold");

      doc.setFontSize(11);

      doc.text(title, 12, y + 6);

      if (subtitle) {

        doc.setFont("helvetica", "normal");

        doc.setTextColor(100, 116, 139);

        doc.setFontSize(7.5);

        doc.text(subtitle, 12, y + 11);

      }

      y += subtitle ? 20 : 16;

    };



    section("Información general", "Datos principales y estado actual del proveedor.");

    autoTable(doc, {

      startY: y,

      theme: "plain",

      margin: { left: 10, right: 10 },

      body: [

        ["Razón social", provider.razon_social, "Nombre comercial", provider.nombre_comercial || "Sin registrar"],

        ["NIT", provider.nit, "Servicio principal", principalServiceFor(provider)],

        ["Estado", providerState(provider), "Desempeño", normalizePerformance(performance.nivel)],

        ["Correo general", provider.correo || "Sin registrar", "Teléfono general", provider.telefono || "Sin registrar"],

      ],

      styles: { fontSize: 8.5, cellPadding: 3, lineColor: [220, 228, 240], lineWidth: 0.2 },

      columnStyles: {

        0: { fontStyle: "bold", textColor: [100, 116, 139], cellWidth: 31 },

        1: { fontStyle: "bold", textColor: [15, 23, 42], cellWidth: 63 },

        2: { fontStyle: "bold", textColor: [100, 116, 139], cellWidth: 31 },

        3: { fontStyle: "bold", textColor: [15, 23, 42], cellWidth: 63 },

      },

    });

    y = (doc as any).lastAutoTable.finalY + 7;



    section("Contacto principal", "Información inmediata para comunicación con el proveedor.");

    autoTable(doc, {

      startY: y,

      head: [["Contacto", "Cargo", "Correo", "Teléfono"]],

      body: [[

        fullContactName(principalContact),

        principalContact?.cargo || "Sin registrar",

        principalContact?.correo || "Sin registrar",

        principalContact?.telefono || "Sin registrar",

      ]],

      margin: { left: 10, right: 10 },

      headStyles: { fillColor: [12, 45, 107], textColor: [255, 255, 255], fontSize: 8 },

      bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },

      styles: { cellPadding: 3, lineColor: [220, 228, 240], lineWidth: 0.2 },

    });

    y = (doc as any).lastAutoTable.finalY + 7;



    if (providerContacts.length > 1) {

      section("Contactos registrados", `${providerContacts.length} contacto(s) activo(s) asociado(s) al proveedor.`);

      autoTable(doc, {

        startY: y,

        head: [["#", "Nombre", "Cargo", "Correo", "Teléfono", "Tipo"]],

        body: providerContacts.map((contact, index) => [

          index + 1,

          fullContactName(contact),

          contact.cargo || "-",

          contact.correo || "-",

          contact.telefono || "-",

          bool(contact.es_principal) ? "Principal" : "Adicional",

        ]),

        margin: { left: 10, right: 10 },

        headStyles: { fillColor: [12, 45, 107], textColor: [255, 255, 255], fontSize: 7.5 },

        bodyStyles: { fontSize: 7.2 },

        styles: { cellPadding: 2.3, lineColor: [220, 228, 240], lineWidth: 0.2 },

      });

      y = (doc as any).lastAutoTable.finalY + 7;

    }



    if (y > 240) {

      doc.addPage();

      await drawPdfHeader(doc, "EXPEDIENTE DE PROVEEDOR", `${provider.codigo_proveedor} · Continuación`);

      y = 47;

    }



    section("Servicios", `${providerServices.length} servicio(s) registrado(s).`);

    autoTable(doc, {

      startY: y,

      head: [["Código", "Servicio", "Tipo"]],

      body: providerServices.length

        ? providerServices.map((service) => [

            service.codigo_servicio || "Automático",

            service.nombre_servicio_proveedor,

            bool(service.es_principal) ? "Principal" : "Adicional",

          ])

        : [["-", principalServiceFor(provider), "Principal"]],

      margin: { left: 10, right: 10 },

      headStyles: { fillColor: [12, 45, 107], textColor: [255, 255, 255], fontSize: 8 },

      bodyStyles: { fontSize: 8 },

      styles: { cellPadding: 3, lineColor: [220, 228, 240], lineWidth: 0.2 },

    });

    y = (doc as any).lastAutoTable.finalY + 7;



    if (y > 215) {

      doc.addPage();

      await drawPdfHeader(doc, "EXPEDIENTE DE PROVEEDOR", `${provider.codigo_proveedor} · Continuación`);

      y = 47;

    }



    section("Cumplimiento documental", "Estado de las validaciones utilizadas para el expediente del proveedor.");

    autoTable(doc, {

      startY: y,

      head: [["SAT", "Lista Clinton", "RTU", "Licencias", "Cuenta bancaria"]],

      body: [[

        displaySat(compliance.estado_sat),

        bool(compliance.lista_clinton) ? "Validado" : "Pendiente",

        bool(compliance.rtu_validado) ? "Validado" : "Pendiente",

        bool(compliance.licencia_validada) ? "Validado" : "Pendiente",

        bool(compliance.cuenta_validada) ? "Validado" : "Pendiente",

      ]],

      margin: { left: 10, right: 10 },

      headStyles: { fillColor: [239, 244, 255], textColor: [12, 45, 107], fontSize: 7.5 },

      bodyStyles: { fontSize: 8, fontStyle: "bold" },

      styles: { cellPadding: 3, lineColor: [220, 228, 240], lineWidth: 0.2, halign: "center" },

    });

    y = (doc as any).lastAutoTable.finalY + 7;



    section("Evaluación de desempeño", "Última evaluación registrada para este proveedor.");

    autoTable(doc, {

      startY: y,

      theme: "grid",

      head: [["Nivel", "Fecha de evaluación"]],

      body: [[normalizePerformance(performance.nivel), formatDate(performance.fecha)]],

      margin: { left: 10, right: 10 },

      headStyles: { fillColor: [239, 244, 255], textColor: [12, 45, 107], fontSize: 8 },

      bodyStyles: { fontSize: 9, fontStyle: "bold" },

      styles: { cellPadding: 3, lineColor: [220, 228, 240], lineWidth: 0.2 },

    });

    y = (doc as any).lastAutoTable.finalY + 6;



    autoTable(doc, {

      startY: y,

      head: [["Historial", "Hallazgos"]],

      body: [[performance.historial || "Sin registrar", performance.hallazgos || "Sin registrar"]],

      margin: { left: 10, right: 10 },

      headStyles: { fillColor: [239, 244, 255], textColor: [12, 45, 107], fontSize: 8 },

      bodyStyles: { fontSize: 8 },

      styles: { cellPadding: 4, lineColor: [220, 228, 240], lineWidth: 0.2, minCellHeight: 18 },

    });



    const pages = doc.getNumberOfPages();

    for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {

      doc.setPage(pageNumber);

      doc.setDrawColor(255, 106, 0);

      doc.setLineWidth(0.8);

      doc.line(8, 284, 52, 284);

      doc.setFont("helvetica", "bold");

      doc.setTextColor(12, 45, 107);

      doc.setFontSize(7.5);

      doc.text("Expediente generado desde GL365 ERP", 8, 289);

      doc.setFont("helvetica", "normal");

      doc.setTextColor(100, 116, 139);

      doc.text(`Fecha de generación: ${new Date().toLocaleDateString("es-GT")}`, 8, 293);

      doc.text(`Página ${pageNumber} de ${pages}`, 202, 293, { align: "right" });

    }



    doc.save(`Expediente-${provider.codigo_proveedor}.pdf`);

  };



  const downloadGeneralPdf = () => {

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    doc.setFillColor(12, 45, 107);

    doc.rect(0, 0, 297, 30, "F");

    doc.setTextColor(255, 255, 255);

    doc.setFont("helvetica", "bold");

    doc.setFontSize(18);

    doc.text("REPORTE GENERAL DE PROVEEDORES", 14, 14);

    doc.setFont("helvetica", "normal");

    doc.setFontSize(9);

    doc.text(`GL365 ERP · ${sorted.length} registro(s) · ${new Date().toLocaleDateString("es-GT")}`, 14, 21);



    autoTable(doc, {

      startY: 36,

      head: [["Código", "Proveedor", "NIT", "Servicio principal", "Contacto principal", "Desempeño", "SAT", "Estado"]],

      body: sorted.map((provider) => [

        provider.codigo_proveedor,

        provider.razon_social,

        provider.nit,

        principalServiceFor(provider),

        fullContactName(principalContactFor(provider.id)),

        normalizePerformance(performanceFor(provider).nivel),

        displaySat(complianceFor(provider).estado_sat),

        providerState(provider),

      ]),

      margin: { left: 10, right: 10 },

      headStyles: { fillColor: [12, 45, 107], textColor: [255, 255, 255], fontSize: 8 },

      bodyStyles: { fontSize: 7.2 },

      alternateRowStyles: { fillColor: [248, 250, 252] },

      styles: { cellPadding: 2.5, lineColor: [225, 231, 239], lineWidth: 0.15 },

    });

    doc.save("Reporte-General-Proveedores.pdf");

  };



  const downloadExcel = () => {

    const rows = sorted.map((provider) => {

      const contact = principalContactFor(provider.id);

      return {

        Código: provider.codigo_proveedor,

        "Razón social": provider.razon_social,

        "Nombre comercial": provider.nombre_comercial || "",

        NIT: provider.nit,

        "Servicio principal": principalServiceFor(provider),

        "Contacto principal": fullContactName(contact),

        Cargo: contact?.cargo || "",

        "Correo contacto": contact?.correo || "",

        "Teléfono contacto": contact?.telefono || "",

        "Correo general": provider.correo || "",

        "Teléfono general": provider.telefono || "",

        Desempeño: normalizePerformance(performanceFor(provider).nivel),

        SAT: displaySat(complianceFor(provider).estado_sat),

        Estado: providerState(provider),

      };

    });

    const sheet = XLSX.utils.json_to_sheet(rows);

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, sheet, "Proveedores");

    XLSX.writeFile(workbook, "Proveedores-GL365.xlsx");

  };



  const SortableHeader = ({
    field,
    children,
  }: {
    field: typeof sortField;
    children: React.ReactNode;
  }) => {
    const active = sortField === field;

    return (
      <button
        type="button"
        onClick={() => sortBy(field)}
        className="inline-flex max-w-full items-center gap-1.5 text-left font-bold leading-tight text-[#0C2D6B] transition hover:text-[#FF6A00]"
        title={`Ordenar por ${String(children)}`}
      >
        <span className="min-w-0">{children}</span>
        <span
          className={`shrink-0 text-[12px] font-black leading-none ${
            active ? "text-[#FF6A00]" : "text-gray-300"
          }`}
          aria-hidden="true"
        >
          {active ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    );
  };



  return (

    <div className="p-6 space-y-6">

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        <div>

          <h1 className="text-3xl font-bold text-[#0C2D6B]">Proveedores</h1>

          <p className="mt-1 text-gray-500">Gestión, evaluación y control de proveedores.</p>

        </div>

        <div className="flex flex-wrap gap-3">

          <button onClick={load} disabled={loading} className="inline-flex h-12 items-center gap-2 rounded-2xl border bg-white px-5 font-bold text-[#0C2D6B] shadow-sm hover:bg-gray-50">

            <RefreshCw size={18} className={loading ? "animate-spin" : ""} /> Actualizar

          </button>

          <button onClick={downloadGeneralPdf} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-red-500 px-5 font-bold text-white shadow-sm hover:bg-red-600">

            <FileDown size={18} /> PDF

          </button>

          <button onClick={downloadExcel} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-green-500 px-5 font-bold text-white shadow-sm hover:bg-green-600">

            <FileSpreadsheet size={18} /> Excel

          </button>

        </div>

      </div>



      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <DashboardCard title="Proveedores" value={providers.length} icon={<Building2 />} border="border-b-[#0C2D6B]" />

        <DashboardCard title="Activos" value={activeCount} icon={<CheckCircle2 />} border="border-b-green-500" />

        <DashboardCard title="Riesgo alto" value={redCount} icon={<AlertTriangle />} border="border-b-red-500" />

        <DashboardCard title="SAT no vigente" value={satNotCurrent} icon={<AlertTriangle />} border="border-b-[#FF6A00]" />

      </section>



      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">

        <div>

          <h2 className="flex items-center gap-2 text-2xl font-bold text-[#0C2D6B]">

            <Building2 className="text-[#FF6A00]" /> Proveedores registrados

          </h2>

          <p className="mt-1 text-gray-500">Consulta el expediente, cumplimiento y desempeño de cada proveedor.</p>

        </div>

        <button onClick={openCreate} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#0C2D6B] px-6 font-bold text-white shadow hover:bg-[#092557]">

          <Plus size={20} /> Nuevo Proveedor

        </button>

      </div>



      <section className="rounded-2xl border bg-white p-5 shadow-sm">

        <div className="grid gap-3 xl:grid-cols-[1.5fr_230px_230px_230px_120px]">

          <div className="relative">

            <Search className="absolute left-4 top-3.5 text-gray-400" size={21} />

            <input

              value={query}

              onChange={(event) => setQuery(event.target.value)}

              className="h-12 w-full rounded-2xl border border-gray-200 pl-12 pr-4 outline-none focus:border-[#0C2D6B]"

              placeholder="Código, proveedor, NIT, contacto..."

            />

          </div>

          <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} className="h-12 rounded-2xl border border-gray-200 px-4 outline-none">

            <option value="todos">Todos los estados</option>

            <option value="activo">Activos</option>

            <option value="inactivo">Inactivos</option>

          </select>

          <select value={performanceFilter} onChange={(event) => setPerformanceFilter(event.target.value)} className="h-12 rounded-2xl border border-gray-200 px-4 outline-none">

            <option value="todos">Todo desempeño</option>

            <option value="verde">Verde</option>

            <option value="amarillo">Amarillo</option>

            <option value="rojo">Rojo</option>

          </select>

          <select value={satFilter} onChange={(event) => setSatFilter(event.target.value)} className="h-12 rounded-2xl border border-gray-200 px-4 outline-none">

            <option value="todos">Todo estado SAT</option>

            <option value="vigente">Vigente</option>

            <option value="pendiente">Pendiente</option>

            <option value="no_vigente">No vigente</option>

          </select>

          <button onClick={resetView}

            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-orange-300 font-semibold text-orange-600 hover:bg-orange-50"

          >

            <X size={17} /> Limpiar

          </button>

        </div>

        <div className="mt-4 flex flex-col gap-3 border-t pt-4 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">

          <span className="font-semibold">{sorted.length} de {providers.length} proveedores visibles</span>

          <label className="flex items-center gap-2 font-semibold">

            Mostrar

            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded-lg border px-2 py-1.5 text-[#0C2D6B]">

              <option value={10}>10</option>

              <option value={20}>20</option>

              <option value={50}>50</option>

            </select>

          </label>

        </div>

      </section>



      {error && !modalOpen && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}



      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">

        <div className="w-full">

          <table className="w-full table-fixed border-collapse text-[11px] xl:text-[12px] 2xl:text-[13px]">

            <colgroup>
              <col style={{ width: "8%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "15%" }} />
            </colgroup>

            <thead className="bg-gray-50">

              <tr className="border-b">

                <th className="px-2 py-3 align-middle"><SortableHeader field="codigo">Código</SortableHeader></th>

                <th className="px-2 py-3 align-middle"><SortableHeader field="proveedor">Proveedor</SortableHeader></th>

                <th className="px-2 py-3 align-middle"><SortableHeader field="nit">NIT</SortableHeader></th>

                <th className="px-2 py-3 align-middle"><SortableHeader field="servicio">Servicio principal</SortableHeader></th>

                <th className="px-2 py-3 align-middle"><SortableHeader field="contacto">Contacto principal</SortableHeader></th>

                <th className="px-2 py-3 align-middle"><SortableHeader field="desempeno">Desempeño</SortableHeader></th>

                <th className="px-2 py-3 align-middle"><SortableHeader field="sat">SAT</SortableHeader></th>

                <th className="px-2 py-3 align-middle"><SortableHeader field="estado">Estado</SortableHeader></th>

                <th className="px-2.5 py-3 text-center font-bold text-[#0C2D6B]">Acciones</th>

              </tr>

            </thead>

            <tbody>

              {visibleRows.map((provider) => {

                const contact = principalContactFor(provider.id);

                const performance = normalizePerformance(performanceFor(provider).nivel);

                const sat = normalizeSat(complianceFor(provider).estado_sat);

                const state = providerState(provider);

                return (

                  <tr key={provider.id} className="border-b last:border-b-0 hover:bg-blue-50/30">

                    <td className="whitespace-nowrap px-2 py-3 align-top font-bold text-[#0C2D6B]">{provider.codigo_proveedor}</td>

                    <td className="px-2.5 py-3 align-top">

                      <div className="break-words font-bold text-slate-800">{provider.razon_social}</div>

                      <div className="mt-1 text-xs text-gray-400">{provider.nombre_comercial || "Sin nombre comercial"}</div>

                    </td>

                    <td className="px-2.5 py-3 align-top font-medium">{provider.nit}</td>

                    <td className="px-2.5 py-3 align-top"><div className="break-words">{principalServiceFor(provider)}</div></td>

                    <td className="px-2.5 py-3 align-top">

                      <div className="break-words font-semibold">{fullContactName(contact)}</div>

                      <div className="mt-1 text-xs text-gray-400">{contact?.cargo || "Sin cargo"}</div>

                    </td>

                    <td className="px-2.5 py-3 align-top">

                      <span className={`inline-flex  items-center justify-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${performanceBadge(performance)}`}>

                        <span className={`h-2 w-2 rounded-full ${performance === "Verde" ? "bg-green-500" : performance === "Rojo" ? "bg-red-500" : "bg-yellow-500"}`} />

                        {performance}

                      </span>

                    </td>

                    <td className="px-2.5 py-3 align-top">

                      <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${satBadge(sat)}`}>{displaySat(sat)}</span>

                    </td>

                    <td className="px-2.5 py-3 align-top">

                      <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${stateBadge(state)}`}>{state}</span>

                    </td>

                    <td className="px-1.5 py-3 align-top">

                      <div className="flex flex-nowrap items-center justify-center gap-1 whitespace-nowrap">

                        <ActionButton title="Descargar PDF" className="bg-gray-50 text-gray-500" onClick={() => downloadProviderPdf(provider)}><Download size={15} /></ActionButton>

                        <ActionButton title="Ver" className="bg-blue-50 text-[#0C2D6B]" onClick={() => openProvider(provider, "view")}><Eye size={15} /></ActionButton>

                        <ActionButton title="Editar" className="bg-orange-50 text-orange-600" onClick={() => openProvider(provider, "edit")}><Edit3 size={15} /></ActionButton>

                        <ActionButton title="Eliminar" className="bg-red-50 text-red-600" onClick={() => deleteProvider(provider)}><Trash2 size={15} /></ActionButton>

                      </div>

                    </td>

                  </tr>

                );

              })}

              {!visibleRows.length && (

                <tr><td colSpan={9} className="px-4 py-14 text-center text-gray-400">No hay proveedores que coincidan con los filtros seleccionados.</td></tr>

              )}

            </tbody>

          </table>

        </div>

        <div className="flex flex-col gap-3 border-t bg-gray-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

          <span className="text-sm font-semibold text-gray-500">Página {currentPage} de {totalPages}</span>

          <div className="flex gap-2">

            <button disabled={currentPage <= 1} onClick={() => setPage(1)} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold text-[#0C2D6B] disabled:opacity-40">Primera</button>

            <button disabled={currentPage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold text-[#0C2D6B] disabled:opacity-40">Anterior</button>

            <button disabled={currentPage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold text-[#0C2D6B] disabled:opacity-40">Siguiente</button>

            <button disabled={currentPage >= totalPages} onClick={() => setPage(totalPages)} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold text-[#0C2D6B] disabled:opacity-40">Última</button>

          </div>

        </div>

      </section>



      {deleteTarget && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-[28px] border border-gray-100 bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
              <Trash2 size={28} strokeWidth={2.2} />
            </div>

            <h3 className="mt-4 text-xl font-extrabold text-slate-900">
              ¿Eliminar proveedor?
            </h3>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-500">
              Si tiene operaciones relacionadas no se borrará el historial; se marcará como Inactivo.
            </p>

            <div className="mx-auto mt-3 max-w-sm rounded-xl bg-gray-50 px-4 py-3 text-sm font-bold text-[#0C2D6B]">
              {deleteTarget.razon_social}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="h-11 rounded-xl border border-gray-200 bg-white font-bold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={deleting}
                onClick={confirmDeleteProvider}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting && <RefreshCw size={16} className="animate-spin" />}
                {deleting ? "Procesando..." : "Continuar"}
              </button>
            </div>
          </div>
        </div>
      )}


      {modalOpen && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">

          <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

            <div className="flex items-center justify-between bg-[#0C2D6B] px-6 py-4 text-white">

              <div>

                <div className="text-xs font-semibold uppercase tracking-wide text-blue-200">Expediente del proveedor</div>

                <h2 className="text-xl font-bold">{modalMode === "create" ? "Nuevo Proveedor" : modalMode === "edit" ? "Editar Proveedor" : "Detalle del Proveedor"}</h2>

              </div>

              <button onClick={() => setModalOpen(false)} className="rounded-xl p-2 hover:bg-white/10"><X /></button>

            </div>



            <div className="overflow-y-auto bg-gray-50 p-5" onKeyDown={avanzarConEnter}>

              <div className="space-y-5">

                <FormSection title="Información del proveedor" subtitle="Datos generales y estado actual del proveedor.">

                  <div className="grid gap-4 md:grid-cols-2">

                    <Field label="Código"><input disabled className={inputClass} value={selected?.codigo_proveedor || "Automático"} readOnly /></Field>

                    <Field label="Estado">

                      <select disabled={modalMode === "view"} className={inputClass} value={form.estado_id} onChange={(event) => setForm((current) => ({ ...current, estado_id: Number(event.target.value) }))}>

                        {(providerStates.length ? providerStates : [{ id: 1, nombre_estado_proveedor: "Activo" }, { id: 2, nombre_estado_proveedor: "Inactivo" }]).map((item) => (

                          <option key={item.id} value={item.id}>{item.nombre_estado_proveedor || item.nombre || `Estado ${item.id}`}</option>

                        ))}

                      </select>

                    </Field>

                    <Field label="Razón social *"><input disabled={modalMode === "view"} className={inputClass} value={form.razon_social} onChange={(event) => setForm((current) => ({ ...current, razon_social: event.target.value }))} /></Field>

                    <Field label="Nombre comercial"><input disabled={modalMode === "view"} className={inputClass} value={form.nombre_comercial} onChange={(event) => setForm((current) => ({ ...current, nombre_comercial: event.target.value }))} /></Field>

                    <Field label="NIT *"><input disabled={modalMode === "view"} className={inputClass} value={form.nit} onChange={(event) => setForm((current) => ({ ...current, nit: event.target.value }))} /></Field>

                    <Field label="Correo general">
                      <input
                        disabled={modalMode === "view"}
                        type="email"
                        className={inputClass}
                        value={form.correo}
                        placeholder="nombre@empresa.com"
                        onChange={(event) => {
                          event.currentTarget.setCustomValidity("");
                          setForm((current) => ({ ...current, correo: event.target.value }));
                        }}
                        onBlur={(event) => {
                          if (!correoValido(event.currentTarget.value)) {
                            event.currentTarget.setCustomValidity("Correo inválido. Debe incluir @ y un dominio.");
                            event.currentTarget.reportValidity();
                          } else {
                            event.currentTarget.setCustomValidity("");
                          }
                        }}
                      />
                    </Field>

                    <Field label="Teléfono general"><input disabled={modalMode === "view"} className={inputClass} value={form.telefono} onChange={(event) => setForm((current) => ({ ...current, telefono: event.target.value.replace(/[^0-9]/g, "") }))} /></Field>

                  </div>

                </FormSection>



                <FormSection

                  title="Contactos del proveedor"

                  subtitle="Puedes registrar varios contactos y marcar uno como principal."

                  action={modalMode !== "view" ? <button onClick={addContact} className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#FF6A00] px-3 text-xs font-bold text-white"><UserPlus size={15} /> Nuevo contacto</button> : undefined}

                >

                  {!contactDraft.length && <p className="py-3 text-sm italic text-gray-400">Sin contactos registrados.</p>}

                  <div className="space-y-3">

                    {contactDraft.map((contact, index) => (

                      <div key={String(contact.id || index)} className="rounded-xl border bg-gray-50 p-3">

                        <div className="grid gap-3 md:grid-cols-3">

                          <input disabled={modalMode === "view"} className={inputClass} placeholder="Primer nombre *" value={contact.primer_nombre} onChange={(event) => patchContact(index, { primer_nombre: event.target.value })} />

                          <input disabled={modalMode === "view"} className={inputClass} placeholder="Segundo nombre" value={contact.segundo_nombre || ""} onChange={(event) => patchContact(index, { segundo_nombre: event.target.value })} />

                          <input disabled={modalMode === "view"} className={inputClass} placeholder="Primer apellido *" value={contact.primer_apellido} onChange={(event) => patchContact(index, { primer_apellido: event.target.value })} />

                          <input disabled={modalMode === "view"} className={inputClass} placeholder="Segundo apellido" value={contact.segundo_apellido || ""} onChange={(event) => patchContact(index, { segundo_apellido: event.target.value })} />

                          <input disabled={modalMode === "view"} className={inputClass} placeholder="Cargo" value={contact.cargo || ""} onChange={(event) => patchContact(index, { cargo: event.target.value })} />

                          <input
                            disabled={modalMode === "view"}
                            type="email"
                            className={inputClass}
                            placeholder="Correo"
                            value={contact.correo || ""}
                            onChange={(event) => {
                              event.currentTarget.setCustomValidity("");
                              patchContact(index, { correo: event.target.value });
                            }}
                            onBlur={(event) => {
                              if (!correoValido(event.currentTarget.value)) {
                                event.currentTarget.setCustomValidity("Correo inválido. Debe incluir @ y un dominio.");
                                event.currentTarget.reportValidity();
                              } else {
                                event.currentTarget.setCustomValidity("");
                              }
                            }}
                          />

                          <input disabled={modalMode === "view"} className={inputClass} placeholder="Teléfono" value={contact.telefono || ""} onChange={(event) => patchContact(index, { telefono: event.target.value.replace(/[^0-9]/g, "") })} />

                          <label className="flex h-11 items-center gap-2 rounded-xl border bg-white px-3 text-sm font-semibold text-gray-600">

                            <input disabled={modalMode === "view"} type="checkbox" checked={bool(contact.es_principal)} onChange={(event) => patchContact(index, { es_principal: event.target.checked })} /> Principal

                          </label>

                          {modalMode !== "view" && <button onClick={() => setContactDraft((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-red-50 font-semibold text-red-600"><Trash2 size={16} /> Quitar</button>}

                        </div>

                      </div>

                    ))}

                  </div>

                </FormSection>



                <FormSection

                  title="Servicios"

                  action={modalMode !== "view" ? <button onClick={addService} className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#0C2D6B] px-3 text-xs font-bold text-white"><Plus size={15} /> Agregar servicio</button> : undefined}

                >

                  {!serviceDraft.length && <p className="py-3 text-sm italic text-gray-400">Sin servicios registrados.</p>}

                  <div className="space-y-3">

                    {serviceDraft.map((service, index) => (

                      <div key={String(service.id || index)} className="grid gap-3 md:grid-cols-[1fr_140px_100px]">

                        <input disabled={modalMode === "view"} className={inputClass} placeholder="Nombre del servicio" value={service.nombre_servicio_proveedor} onChange={(event) => patchService(index, { nombre_servicio_proveedor: event.target.value })} />

                        <label className="flex h-11 items-center gap-2 rounded-xl border bg-white px-3 text-sm font-semibold text-gray-600">

                          <input disabled={modalMode === "view"} type="checkbox" checked={bool(service.es_principal)} onChange={(event) => patchService(index, { es_principal: event.target.checked })} /> Principal

                        </label>

                        {modalMode !== "view" && <button onClick={() => setServiceDraft((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="flex h-11 items-center justify-center rounded-xl bg-red-50 text-red-600"><Trash2 size={17} /></button>}

                      </div>

                    ))}

                  </div>

                </FormSection>



                <FormSection title="Cumplimiento">

                  <div className="grid gap-4 md:grid-cols-2">

                    <Field label="Estado SAT">

                      <select disabled={modalMode === "view"} className={inputClass} value={normalizeSat(complianceDraft.estado_sat)} onChange={(event) => setComplianceDraft((current) => ({ ...current, estado_sat: event.target.value }))}>

                        <option value="pendiente">Pendiente</option>

                        <option value="vigente">Vigente</option>

                        <option value="no_vigente">No vigente</option>

                      </select>

                    </Field>

                    <div className="grid grid-cols-2 gap-2">

                      <CheckField disabled={modalMode === "view"} label="Lista Clinton" checked={bool(complianceDraft.lista_clinton)} onChange={(checked) => setComplianceDraft((current) => ({ ...current, lista_clinton: checked }))} />

                      <CheckField disabled={modalMode === "view"} label="RTU" checked={bool(complianceDraft.rtu_validado)} onChange={(checked) => setComplianceDraft((current) => ({ ...current, rtu_validado: checked }))} />

                      <CheckField disabled={modalMode === "view"} label="Licencias" checked={bool(complianceDraft.licencia_validada)} onChange={(checked) => setComplianceDraft((current) => ({ ...current, licencia_validada: checked }))} />

                      <CheckField disabled={modalMode === "view"} label="Cuenta bancaria" checked={bool(complianceDraft.cuenta_validada)} onChange={(checked) => setComplianceDraft((current) => ({ ...current, cuenta_validada: checked }))} />

                    </div>

                  </div>

                </FormSection>



                <FormSection title="Desempeño">

                  <div className="grid gap-3 sm:grid-cols-3">

                    {(["Verde", "Amarillo", "Rojo"] as const).map((level) => (

                      <button

                        key={level}

                        disabled={modalMode === "view"}

                        onClick={() => setPerformanceDraft((current) => ({ ...current, nivel: level }))}

                        className={`h-11 rounded-xl border font-bold transition ${normalizePerformance(performanceDraft.nivel) === level ? performanceBadge(level) : "bg-white text-gray-500"}`}

                      >

                        ● {level}

                      </button>

                    ))}

                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">

                    <Field label="Fecha de evaluación"><input disabled={modalMode === "view"} type="date" className={inputClass} value={performanceDraft.fecha?.slice(0, 10) || ""} onChange={(event) => setPerformanceDraft((current) => ({ ...current, fecha: event.target.value }))} /></Field>

                    <div />

                    <Field label="Historial"><textarea disabled={modalMode === "view"} className="min-h-24 w-full rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-[#0C2D6B]" value={performanceDraft.historial || ""} onChange={(event) => setPerformanceDraft((current) => ({ ...current, historial: event.target.value }))} /></Field>

                    <Field label="Hallazgos"><textarea disabled={modalMode === "view"} className="min-h-24 w-full rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-[#0C2D6B]" value={performanceDraft.hallazgos || ""} onChange={(event) => setPerformanceDraft((current) => ({ ...current, hallazgos: event.target.value }))} /></Field>

                  </div>

                </FormSection>



                {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}

              </div>

            </div>



            <div className="flex flex-wrap items-center justify-end gap-3 border-t bg-white px-6 py-4">

              {selected && <button onClick={() => downloadProviderPdf(selected)} className="mr-auto inline-flex h-11 items-center gap-2 rounded-xl border px-4 font-bold text-[#0C2D6B]"><Download size={17} /> Descargar PDF</button>}

              <button onClick={() => setModalOpen(false)} className="h-11 rounded-xl border px-5 font-semibold text-gray-600">{modalMode === "view" ? "Cerrar" : "Cancelar"}</button>

              {modalMode !== "view" && <button disabled={loading} onClick={saveProvider} className="h-11 rounded-xl bg-[#0C2D6B] px-6 font-bold text-white disabled:opacity-50">{loading ? "Guardando..." : "Guardar proveedor"}</button>}

            </div>

          </div>

        </div>

      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-[100] flex max-w-[92vw] items-center gap-3 rounded-2xl px-4 py-3 text-white shadow-2xl sm:max-w-md ${
            toast.type === "success" ? "bg-[#0C2D6B]" : "bg-red-600"
          }`}
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              toast.type === "success"
                ? "bg-green-500/20 text-green-300"
                : "bg-white/15 text-white"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 size={19} />
            ) : (
              <AlertTriangle size={19} />
            )}
          </div>

          <p className="min-w-0 flex-1 text-sm font-bold leading-5">
            {toast.message}
          </p>

          <button
            type="button"
            onClick={() => setToast(null)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/75 transition hover:bg-white/10 hover:text-white"
            aria-label="Cerrar notificación"
          >
            <X size={16} />
          </button>
        </div>
      )}

    </div>

  );

}



function DashboardCard({ title, value, icon, border }: { title: string; value: number; icon: React.ReactNode; border: string }) {

  return (

    <div className={`rounded-2xl border border-b-4 bg-white p-5 shadow-sm ${border}`}>

      <div className="flex items-center justify-between">

        <div>

          <div className="text-gray-500">{title}</div>

          <div className="mt-1 text-3xl font-bold text-[#0C2D6B]">{value}</div>

        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#0C2D6B]">{icon}</div>

      </div>

    </div>

  );

}



function ActionButton({ title, className, onClick, children }: { title: string; className: string; onClick: () => void; children: React.ReactNode }) {

  return <button type="button" title={title} onClick={onClick} className={`shrink-0 rounded-xl p-2 transition hover:scale-105 ${className}`}>{children}</button>;

}



function FormSection({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {

  return (

    <section className="rounded-2xl border bg-white p-4 shadow-sm">

      <div className="mb-4 flex items-center justify-between gap-3 border-b pb-3">

        <div>

          <h3 className="font-bold text-[#0C2D6B]">{title}</h3>

          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}

        </div>

        {action}

      </div>

      {children}

    </section>

  );

}



function Field({ label, children }: { label: string; children: React.ReactNode }) {

  return <label className="block"><span className="mb-1 block text-xs font-bold text-gray-700">{label}</span>{children}</label>;

}



function CheckField({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {

  return (

    <label className="flex h-11 items-center gap-2 rounded-xl border bg-gray-50 px-3 text-sm font-semibold text-gray-600">

      <input type="checkbox" disabled={disabled} checked={checked} onChange={(event) => onChange(event.target.checked)} /> {label}

    </label>

  );

}