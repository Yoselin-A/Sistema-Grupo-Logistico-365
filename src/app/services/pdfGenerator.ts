import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Client, Quote, Assignment, Provider } from './storage';

// === GENERAR PDF DE CLIENTE ===
export const generarPDFCliente = (client: Client) => {
  const doc = new jsPDF();

  // === ENCABEZADO ===
  doc.setFillColor(12, 45, 107); // #0C2D6B
  doc.rect(0, 0, 210, 45, 'F');

  // Logo/Nombre empresa
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('LOGISTICS GROUP 365', 15, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Gestión de Clientes - Expediente Completo', 15, 27);
  doc.text('Guatemala, Centroamérica', 15, 32);
  doc.text('Tel: +502 2203-0353 | info@logisticsgroup365.com', 15, 37);

  // Tipo de documento
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('EXPEDIENTE DE CLIENTE', 130, 20);

  // === INFORMACIÓN BÁSICA ===
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  let yPos = 55;

  doc.setFillColor(12, 45, 107);
  doc.setTextColor(255, 255, 255);
  doc.rect(15, yPos, 180, 8, 'F');
  doc.text('INFORMACIÓN BÁSICA', 20, yPos + 5);

  yPos += 15;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);

  // Cliente
  doc.setFont('helvetica', 'bold');
  doc.text('Razón Social:', 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(client.name, 55, yPos);

  // NIT
  doc.setFont('helvetica', 'bold');
  doc.text('NIT:', 130, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(client.nit, 145, yPos);

  yPos += 7;

  // Contacto
  if (client.contact) {
    doc.setFont('helvetica', 'bold');
    doc.text('Contacto Principal:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(client.contact, 55, yPos);
  }

  // Estado
  doc.setFont('helvetica', 'bold');
  doc.text('Estado:', 130, yPos);
  doc.setFont('helvetica', 'normal');

  if (client.status === 'Activo') {
    doc.setTextColor(34, 197, 94); // verde
  } else if (client.status === 'Pendiente') {
    doc.setTextColor(249, 115, 22); // naranja
  } else {
    doc.setTextColor(156, 163, 175); // gris
  }
  doc.text(client.status, 145, yPos);
  doc.setTextColor(0, 0, 0);

  yPos += 12;

  // === DETALLES OPERATIVOS ===
  doc.setFillColor(12, 45, 107);
  doc.setTextColor(255, 255, 255);
  doc.rect(15, yPos, 180, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('DETALLES OPERATIVOS', 20, yPos + 5);

  yPos += 15;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const detalles = [
    ['Modalidad de Servicio:', client.modality || 'N/A'],
    ['Incoterm:', client.incoterm || 'N/A'],
    ['Origen:', client.origin || 'N/A'],
    ['Destino:', client.destination || 'N/A'],
    ['Tipo de Producto:', client.productType || 'N/A'],
    ['Peso y Volumen:', client.weightVolume || 'N/A']
  ];

  detalles.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(value, 70, yPos);
    yPos += 6;
  });

  yPos += 6;

  // === CUMPLIMIENTO Y FINANZAS ===
  doc.setFillColor(12, 45, 107);
  doc.setTextColor(255, 255, 255);
  doc.rect(15, yPos, 180, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('CUMPLIMIENTO Y FINANZAS', 20, yPos + 5);

  yPos += 15;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');

  // Línea de crédito
  doc.setFont('helvetica', 'bold');
  doc.text('Línea de Crédito:', 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(34, 197, 94);
  doc.text(`$${client.creditLine.toLocaleString('en-US')} USD`, 70, yPos);
  doc.setTextColor(0, 0, 0);

  yPos += 7;

  // Validación SAT
  if (client.satValidation) {
    doc.setFont('helvetica', 'bold');
    doc.text('Validación SAT:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(client.satValidation, 70, yPos);
    yPos += 7;
  }

  // Investigación Clinton
  doc.setFont('helvetica', 'bold');
  doc.text('Lista Clinton:', 20, yPos);
  doc.setFont('helvetica', 'normal');

  const clintonStatus = client.clintonInvestigation || 'Pendiente';
  if (clintonStatus === 'Aprobado') {
    doc.setTextColor(34, 197, 94);
  } else if (clintonStatus === 'Rechazado') {
    doc.setTextColor(239, 68, 68);
  } else {
    doc.setTextColor(249, 115, 22);
  }
  doc.text(clintonStatus, 70, yPos);
  doc.setTextColor(0, 0, 0);

  yPos += 7;

  // Documentos completos
  doc.setFont('helvetica', 'bold');
  doc.text('Documentos Obligatorios:', 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(client.requestedDocs ? '✓ Completos' : '✗ Pendientes', 70, yPos);

  // === PIE DE PÁGINA ===
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'italic');
  doc.text(
    'Documento generado por Logistics Group 365 - Sistema ERP',
    105,
    pageHeight - 15,
    { align: 'center' }
  );
  doc.text(
    `Fecha de generación: ${new Date().toLocaleString('es-ES')}`,
    105,
    pageHeight - 10,
    { align: 'center' }
  );

  // === GUARDAR PDF ===
  doc.save(`Cliente_${client.name.replace(/\s+/g, '_')}.pdf`);
};

// === GENERAR PDF DE COTIZACIÓN (FORMATO IDÉNTICO AL MODAL) ===
export const generarPDFCotizacion = (quote: Quote) => {
  const doc = new jsPDF();
  const q: any = quote;

  // Márgenes
  const margin = 15;
  let yPos = 15;

  // Medidas generales
  const pageWidth = doc.internal.pageSize.getWidth();
  const tableWidth = 180;
  const centerX = pageWidth / 2;

  // Moneda
  const moneda = String(q.currency || q.moneda || 'USD').toUpperCase() === 'GTQ'
    ? 'GTQ'
    : 'USD';

  const simboloMoneda = moneda === 'GTQ' ? 'Q' : '$';
  const nombreMoneda = moneda === 'GTQ' ? 'QUETZALES' : 'DÓLARES';

  // Servicios
  const servicios = Array.isArray(q.services) && q.services.length > 0
    ? q.services
    : [
        {
          quantity: q.cantidad || 1,
          description: q.descripcion_servicio || q.descripcion || q.cargoType || q.tipo_carga || 'Servicio logístico',
          unitPrice: q.venta || q.subtotal || 0,
          days: q.dias_servicio || q.dias || 1,
        },
      ];

  const servicioPrincipal: any = servicios[0] || {};

  // Datos principales
  const numeroCotizacion =
    q.quoteNumber ||
    q.numero_cotizacion ||
    q.numero ||
    `COT-${String(q.id || 0).padStart(3, '0')}`;

  const razonSocial =
    q.clientName ||
    q.razon_social ||
    q.cliente ||
    q.nombre_empresa ||
    'Cliente sin nombre';

  const contacto =
    q.contact ||
    q.contacto ||
    q.representante ||
    '-';

  const correo =
    q.email ||
    q.correo ||
    '-';

  const fecha =
    q.date ||
    q.fecha ||
    new Date().toLocaleDateString('es-GT');

  const ejecutivoVentas =
    q.salesExecutive ||
    q.ejecutivo_ventas ||
    q.ejecutivo ||
    'ENMA GARCIA BACHEZ';

  const modalidad =
    q.eximp ||
    q.modality ||
    q.modalidad ||
    servicioPrincipal.modality ||
    'FTL';

  const formaPago =
    q.paymentMethod ||
    q.forma_pago ||
    'CONTADO';

  const origen =
    q.origin ||
    q.origen ||
    '-';

  const destino =
    q.destination ||
    q.destino ||
    '-';

  const tipoCarga =
    q.cargoType ||
    q.tipo_carga ||
    servicioPrincipal.description ||
    '-';

  const peso =
    q.weight ||
    q.peso ||
    '-';

  const volumen =
    q.volume ||
    q.volumen ||
    '-';

  const bultos =
    q.bultos_pallets ||
    q.total_bultos ||
    q.bultos ||
    '';

  const limpiarNumero = (valor: any) => {
    const numero = Number(
      String(valor ?? 0)
        .replace('Q', '')
        .replace('$', '')
        .replace(/,/g, '')
        .trim()
    );

    return Number.isFinite(numero) ? numero : 0;
  };

  const agregarUnidad = (valor: any, unidad: string) => {
    const texto = String(valor ?? '').trim();

    if (!texto || texto === '-') return '-';

    const textoMayuscula = texto.toUpperCase();

    if (
      textoMayuscula.includes('TON') ||
      textoMayuscula.includes('PIE') ||
      textoMayuscula.includes('M3') ||
      textoMayuscula.includes('KG')
    ) {
      return texto;
    }

    return `${texto} ${unidad}`;
  };

  const formatearMonto = (valor: any) => {
    return `${simboloMoneda}${limpiarNumero(valor).toLocaleString('es-GT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const obtenerVentaServicio = (servicio: any) => {
    return limpiarNumero(
      servicio.unitPrice ??
        servicio.precio_unitario ??
        servicio.venta ??
        q.venta ??
        q.subtotal ??
        0
    );
  };

  const obtenerCantidadServicio = (servicio: any) => {
    const cantidad = limpiarNumero(servicio.quantity ?? servicio.cantidad ?? q.cantidad ?? 1);
    return cantidad > 0 ? cantidad : 1;
  };

  const obtenerTotalServicio = (servicio: any) => {
    const totalGuardado = limpiarNumero(servicio.total ?? servicio.subtotal_con_iva ?? q.total);

    if (totalGuardado > 0) return totalGuardado;

    const cantidad = obtenerCantidadServicio(servicio);
    const venta = obtenerVentaServicio(servicio);

    return venta * cantidad * 1.12;
  };

  // === HEADER: FECHA ===
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(margin, yPos, tableWidth, 8);
  doc.text(`FECHA: GUATEMALA, ${fecha}`, centerX, yPos + 5, { align: 'center' });
  yPos += 8;

  // === FILA 1: N° Cotización y Contacto ===
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  doc.rect(margin, yPos, 90, 7);
  doc.text(`N° Cotización: ${numeroCotizacion}`, margin + 2, yPos + 5);

  doc.rect(margin + 90, yPos, 90, 7);
  doc.text(`CONTACTO: ${contacto}`, margin + 92, yPos + 5);
  yPos += 7;

  // === FILA 2: Razón Social y Email ===
  doc.rect(margin, yPos, 90, 7);
  doc.text(`RAZÓN SOCIAL: ${razonSocial}`, margin + 2, yPos + 5);

  doc.rect(margin + 90, yPos, 90, 7);
  doc.text(`EMAIL: ${correo}`, margin + 92, yPos + 5);
  yPos += 7;

  // === TELÉFONOS ===
  doc.rect(margin, yPos, tableWidth, 7);
  doc.setFont('helvetica', 'bold');
  doc.text('NÚMERO TELEFÓNICO: +502 2203-0353 Y +502 5843-5687', centerX, yPos + 5, {
    align: 'center',
  });
  yPos += 7;

  // === HEADER AZUL: Ejecutivo, Exp/Imp, Forma de Pago ===
  doc.setFillColor(12, 45, 107);
  doc.rect(margin, yPos, 60, 7, 'F');
  doc.rect(margin + 60, yPos, 60, 7, 'F');
  doc.rect(margin + 120, yPos, 60, 7, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('EJECUTIVO VENTAS', margin + 30, yPos + 5, { align: 'center' });
  doc.text('EXP / IMP', margin + 90, yPos + 5, { align: 'center' });
  doc.text('FORMA DE PAGO', margin + 150, yPos + 5, { align: 'center' });
  yPos += 7;

  // Valores
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.rect(margin, yPos, 60, 7);
  doc.rect(margin + 60, yPos, 60, 7);
  doc.rect(margin + 120, yPos, 60, 7);

  doc.text(String(ejecutivoVentas).toUpperCase(), margin + 30, yPos + 5, { align: 'center' });
  doc.text(String(modalidad).toUpperCase(), margin + 90, yPos + 5, { align: 'center' });
  doc.text(String(formaPago).toUpperCase(), margin + 150, yPos + 5, { align: 'center' });
  yPos += 7;

  // === PESO Y VOLUMEN ===
  doc.setFont('helvetica', 'bold');
  doc.rect(margin, yPos, 30, 7);
  doc.text('TOTAL BULTOS', margin + 15, yPos + 5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.rect(margin + 30, yPos, 30, 7);
  doc.text(String(bultos), margin + 45, yPos + 5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.rect(margin + 60, yPos, 20, 7);
  doc.text('PESO:', margin + 70, yPos + 5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.rect(margin + 80, yPos, 30, 7);
  doc.text(agregarUnidad(peso, 'TON'), margin + 95, yPos + 5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.rect(margin + 110, yPos, 25, 7);
  doc.text('VOL M3:', margin + 122.5, yPos + 5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.rect(margin + 135, yPos, 45, 7);
  doc.text(agregarUnidad(volumen, 'PIES³'), margin + 157.5, yPos + 5, { align: 'center' });
  yPos += 7;

  // === DESCRIPCIÓN DE LA CARGA ===
  // Son 6 filas de 6 mm: origen, destino, tipo, carga, servicio y tarifa.
  const descStartY = yPos;
  const rowHeight = 6;
  const descHeight = rowHeight * 6;

  doc.setFillColor(255, 106, 0);
  doc.rect(margin, descStartY, 35, descHeight, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const descText = doc.splitTextToSize('DESCRIPCIÓN DE LA CARGA', 31);
  doc.text(descText, margin + 17.5, descStartY + descHeight / 2 - 2, {
    align: 'center',
  });

  // Datos de carga
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  doc.rect(margin + 35, yPos, 145, rowHeight);
  doc.text(`ORIGEN: ${origen}`, margin + 37, yPos + 4);
  yPos += rowHeight;

  doc.rect(margin + 35, yPos, 145, rowHeight);
  doc.text(`DESTINO: ${destino}`, margin + 37, yPos + 4);
  yPos += rowHeight;

  doc.rect(margin + 35, yPos, 145, rowHeight);
  doc.text(`TIPO DE CARGA: ${tipoCarga}`, margin + 37, yPos + 4);
  yPos += rowHeight;

  doc.setFillColor(12, 45, 107);
  doc.rect(margin + 35, yPos, 145, rowHeight, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('CARGA GENERAL NO PELIGROSA', margin + 107.5, yPos + 4, { align: 'center' });
  yPos += rowHeight;

  doc.setFillColor(12, 45, 107);
  doc.rect(margin + 35, yPos, 145, rowHeight, 'F');
  doc.text('SERVICIO: MERCADERÍA GENERAL NO PELIGROSA', margin + 107.5, yPos + 4, {
    align: 'center',
  });
  yPos += rowHeight;

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.rect(margin + 35, yPos, 145, rowHeight);
  doc.text(`TARIFA EXPRESADA EN ${nombreMoneda}`, margin + 107.5, yPos + 4, {
    align: 'center',
  });
  yPos += rowHeight + 3;

  // === TABLA DE SERVICIOS ===
  const serviciosData = servicios.map((servicio: any) => {
    const cantidad = obtenerCantidadServicio(servicio);
    const venta = obtenerVentaServicio(servicio);
    const totalConIva = obtenerTotalServicio(servicio);
    const descripcionServicio =
      servicio.description ||
      servicio.descripcion ||
      q.descripcion_servicio ||
      q.descripcion ||
      tipoCarga ||
      '-';

    return [
      String(cantidad),
      descripcionServicio,
      formatearMonto(venta),
      formatearMonto(totalConIva),
      moneda,
      String(servicio.days || servicio.dias || q.dias_servicio || q.dias || 1),
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [['CANT.', 'DESCRIPCIÓN', 'VENTA', 'TOTAL CON IVA', 'MONEDA', 'DÍAS']],
    body: serviciosData,
    theme: 'grid',
    tableWidth,
    headStyles: {
      fillColor: [255, 106, 0],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [0, 0, 0],
      valign: 'middle',
      cellPadding: 2,
      minCellHeight: 8,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 14 },
      1: { cellWidth: 76 },
      2: { halign: 'right', cellWidth: 25 },
      3: { halign: 'right', cellWidth: 30 },
      4: { halign: 'center', cellWidth: 22, minCellWidth: 22 },
      5: { halign: 'center', cellWidth: 13 },
    },
    margin: { left: margin, right: margin },
    styles: {
      overflow: 'linebreak',
      lineColor: [153, 153, 153],
      lineWidth: 0.2,
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 5;

  // === NO INCLUYE ===
  doc.setFillColor(173, 216, 230);
  doc.rect(margin, yPos, tableWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text('NO INCLUYE ROJOS, SEGUROS, IMPUESTOS', centerX, yPos + 5, {
    align: 'center',
  });
  yPos += 10;

  // === NOTAS Y FIRMA ===
  doc.setFontSize(7);
  doc.setTextColor(217, 119, 6);
  doc.setFont('helvetica', 'bold');
  doc.text('Nuestra cotización NO incluye:', margin, yPos);
  yPos += 4;

  doc.setFont('helvetica', 'normal');
  const exclusiones = [
    '• Maniobras (carga y descarga)',
    '• Seguro de cargas',
    '• Custodios y/o patrullas para unidades en modalidad FTL',
    '• Estadías',
    '• Selectivos rojos',
    '• Gastos por cuenta ajena',
  ];

  exclusiones.forEach((item) => {
    doc.text(item, margin + 5, yPos);
    yPos += 3;
  });

  yPos += 3;

  doc.setFont('helvetica', 'bold');
  doc.text('Notas importantes:', margin, yPos);
  yPos += 4;

  doc.setFont('helvetica', 'normal');
  const notas = [
    '• Cotización basada en datos proporcionados.',
    '• Para movimientos locales deberán reservar las unidades con 24 Hrs de anticipación.',
    '• En temporada alta las unidades deberán ser reservadas con 48 Hrs antes del posicionamiento.',
    '• Logistics Group 365 no asume penalizaciones por atrasos, conflictos sociales o clima.',
    '• Todo movimiento en falso se cobrará el flete.',
    '• Los custodios y/o patrullas se cotizan por evento dependiendo la ruta.',
  ];

  notas.forEach((item) => {
    doc.text(item, margin + 5, yPos);
    yPos += 3;
  });

  // === FIRMA ===
  const firmaY = yPos - 36;
  doc.setTextColor(12, 45, 107);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('FIRMA DE ACEPTACIÓN DE TARIFA:', 140, firmaY);

  doc.setDrawColor(12, 45, 107);
  doc.line(135, firmaY + 15, 190, firmaY + 15);

  // === PIE DE PÁGINA ===
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'italic');
  doc.text(
    'Documento generado por Logistics Group 365 ERP',
    centerX,
    pageHeight - 10,
    { align: 'center' }
  );
  doc.text(
    `Generado: ${new Date().toLocaleString('es-GT')}`,
    centerX,
    pageHeight - 5,
    { align: 'center' }
  );

  // === GUARDAR PDF ===
  doc.save(`Cotizacion_${numeroCotizacion}.pdf`);
};


// === GENERAR PDF DE ASIGNACIÓN DE VIAJE ===
export const generarPDFAsignacion = (assignment: Assignment) => {
  const doc = new jsPDF();

  // === ENCABEZADO ===
  doc.setFillColor(12, 45, 107);
  doc.rect(0, 0, 210, 45, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('LOGISTICS GROUP 365', 15, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Control de Operaciones y Viajes', 15, 27);
  doc.text('Guatemala, Centroamérica', 15, 32);
  doc.text('Tel: +502 2203-0353 | operaciones@gl365.com', 15, 37);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('REPORTE DE VIAJE', 140, 20);

  // === INFORMACIÓN DEL VIAJE ===
  doc.setTextColor(0, 0, 0);
  let yPos = 55;

  // Cliente y Vendedor
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Cliente:', 15, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(assignment.cliente, 45, yPos);

  doc.setFont('helvetica', 'bold');
  doc.text('Vendedor:', 120, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(assignment.vendedor || '-', 145, yPos);
  yPos += 7;

  // Fechas
  doc.setFont('helvetica', 'bold');
  doc.text('Fecha Carga:', 15, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(assignment.carga, 45, yPos);

  doc.setFont('helvetica', 'bold');
  doc.text('Fecha Descarga:', 120, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(assignment.descarga, 155, yPos);
  yPos += 7;

  // Ruta
  doc.setFont('helvetica', 'bold');
  doc.text('Ruta:', 15, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(`${assignment.origen} → ${assignment.destino}`, 45, yPos);
  yPos += 7;

  // Marchamo
  if (assignment.marchamo) {
    doc.setFont('helvetica', 'bold');
    doc.text('Marchamo:', 15, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(assignment.marchamo, 45, yPos);
    yPos += 7;
  }

  yPos += 5;

  // === UNIDAD Y PILOTO ===
  doc.setFillColor(12, 45, 107);
  doc.setTextColor(255, 255, 255);
  doc.rect(15, yPos, 180, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('UNIDAD Y PILOTO', 20, yPos + 5);

  yPos += 12;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');

  doc.setFont('helvetica', 'bold');
  doc.text('Piloto:', 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(assignment.piloto, 50, yPos);
  yPos += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Licencia:', 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(assignment.licencia, 50, yPos);
  yPos += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Cabezal:', 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(`${assignment.cabezal} (${assignment.tipo})`, 50, yPos);
  yPos += 6;

  if (assignment.furgon) {
    doc.setFont('helvetica', 'bold');
    doc.text('Furgón:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(assignment.furgon, 50, yPos);
    yPos += 6;
  }

  if (assignment.auxiliar) {
    doc.setFont('helvetica', 'bold');
    doc.text('Auxiliar:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(assignment.auxiliar, 50, yPos);
    yPos += 6;
  }

  yPos += 5;

  // === COSTOS ===
  doc.setFillColor(255, 106, 0);
  doc.setTextColor(255, 255, 255);
  doc.rect(15, yPos, 180, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('DESGLOSE DE COSTOS', 20, yPos + 5);

  yPos += 12;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');

  const costos = [
    ['Flete', assignment.flete],
    ['Parada Adicional', assignment.paradaAdicional],
    ['Movimiento en Falso', assignment.movFalso],
    ['Estadía', assignment.estadia],
    ['Viaje Doble', assignment.viajeDoble],
    ['Otros', assignment.otros]
  ];

  costos.forEach(([concepto, valor]) => {
    doc.setFont('helvetica', 'normal');
    doc.text(concepto, 20, yPos);
    doc.setFont('helvetica', 'bold');
    doc.text(`Q${valor.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`, 190, yPos, { align: 'right' });
    yPos += 6;
  });

  // Total
  doc.setDrawColor(12, 45, 107);
  doc.setLineWidth(0.8);
  doc.line(20, yPos, 190, yPos);
  yPos += 7;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(12, 45, 107);
  doc.text('TOTAL CLIENTE:', 20, yPos);
  doc.setTextColor(34, 197, 94);
  doc.setFontSize(14);
  doc.text(`Q${assignment.total.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`, 190, yPos, { align: 'right' });

  yPos += 10;

  // === INFORMACIÓN DEL PROVEEDOR ===
  if (assignment.proveedor) {
    doc.setFillColor(12, 45, 107);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.rect(15, yPos, 180, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMACIÓN DEL PROVEEDOR', 20, yPos + 5);

    yPos += 12;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');

    doc.setFont('helvetica', 'bold');
    doc.text('Proveedor:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(assignment.proveedor, 50, yPos);
    yPos += 6;

    if (assignment.serieProveedor) {
      doc.setFont('helvetica', 'bold');
      doc.text('Serie:', 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(assignment.serieProveedor, 50, yPos);

      if (assignment.numeroProveedor) {
        doc.setFont('helvetica', 'bold');
        doc.text('Número:', 100, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(assignment.numeroProveedor, 125, yPos);
      }
      yPos += 6;
    }

    const costosProveedor = [
      ['Flete Proveedor', assignment.fleteProveedor],
      ['Cuadrilla', assignment.cuadrilla],
      ['Estadía', assignment.estadiaProveedor]
    ];

    costosProveedor.forEach(([concepto, valor]) => {
      doc.setFont('helvetica', 'normal');
      doc.text(concepto, 20, yPos);
      doc.setFont('helvetica', 'bold');
      doc.text(`Q${valor.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`, 190, yPos, { align: 'right' });
      yPos += 6;
    });

    doc.setDrawColor(12, 45, 107);
    doc.line(20, yPos, 190, yPos);
    yPos += 7;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(12, 45, 107);
    doc.text('TOTAL PROVEEDOR:', 20, yPos);
    doc.setTextColor(239, 68, 68);
    doc.setFontSize(14);
    doc.text(`Q${assignment.totalProveedor.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`, 190, yPos, { align: 'right' });

    yPos += 10;

    // Margen
    const margen = assignment.total - assignment.totalProveedor;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('MARGEN:', 20, yPos);
    doc.setTextColor(margen >= 0 ? 34 : 239, margen >= 0 ? 197 : 68, margen >= 0 ? 94 : 68);
    doc.text(`Q${margen.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`, 190, yPos, { align: 'right' });
  }

  // === PIE DE PÁGINA ===
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'italic');
  doc.text(
    'Documento generado por Logistics Group 365 - Operaciones',
    105,
    pageHeight - 10,
    { align: 'center' }
  );
  doc.text(
    `Generado: ${new Date().toLocaleString('es-ES')}`,
    105,
    pageHeight - 5,
    { align: 'center' }
  );

  // === GUARDAR PDF ===
  doc.save(`Viaje_${assignment.cliente.replace(/\s+/g, '_')}_${assignment.cabezal}.pdf`);
};

// === GENERAR PDF DE PROVEEDOR ===
export const generarPDFProveedor = (provider: Provider) => {
  const doc = new jsPDF();

  // === ENCABEZADO ===
  doc.setFillColor(12, 45, 107);
  doc.rect(0, 0, 210, 45, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('LOGISTICS GROUP 365', 15, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Gestión de Proveedores - Expediente Completo', 15, 27);
  doc.text('Guatemala, Centroamérica', 15, 32);
  doc.text('Tel: +502 2203-0353 | compras@gl365.com', 15, 37);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('EXPEDIENTE PROVEEDOR', 125, 20);

  // === INFORMACIÓN BÁSICA ===
  doc.setTextColor(0, 0, 0);
  let yPos = 55;

  doc.setFillColor(12, 45, 107);
  doc.setTextColor(255, 255, 255);
  doc.rect(15, yPos, 180, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMACIÓN BÁSICA', 20, yPos + 5);

  yPos += 15;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);

  // Nombre
  doc.setFont('helvetica', 'bold');
  doc.text('Razón Social:', 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(provider.name, 55, yPos);
  yPos += 7;

  // Servicio
  doc.setFont('helvetica', 'bold');
  doc.text('Servicio Principal:', 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(provider.service, 55, yPos);
  yPos += 7;

  // Contacto
  doc.setFont('helvetica', 'bold');
  doc.text('Contacto:', 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(provider.contact, 55, yPos);
  yPos += 7;

  // Estado
  doc.setFont('helvetica', 'bold');
  doc.text('Estado:', 20, yPos);
  doc.setFont('helvetica', 'normal');
  if (provider.status === 'Activo') {
    doc.setTextColor(34, 197, 94);
  } else {
    doc.setTextColor(156, 163, 175);
  }
  doc.text(provider.status, 55, yPos);
  doc.setTextColor(0, 0, 0);
  yPos += 12;

  // === CUMPLIMIENTO ===
  doc.setFillColor(12, 45, 107);
  doc.setTextColor(255, 255, 255);
  doc.rect(15, yPos, 180, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('CUMPLIMIENTO Y VALIDACIONES', 20, yPos + 5);

  yPos += 15;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');

  // Estado SAT
  doc.setFont('helvetica', 'bold');
  doc.text('Estado SAT:', 20, yPos);
  doc.setFont('helvetica', 'normal');
  if (provider.satStatus === 'Solvente') {
    doc.setTextColor(34, 197, 94);
  } else if (provider.satStatus === 'Omiso') {
    doc.setTextColor(239, 68, 68);
  } else {
    doc.setTextColor(249, 115, 22);
  }
  doc.text(provider.satStatus, 55, yPos);
  doc.setTextColor(0, 0, 0);
  yPos += 7;

  // Lista Clinton
  doc.setFont('helvetica', 'bold');
  doc.text('Lista Clinton:', 20, yPos);
  doc.setFont('helvetica', 'normal');
  if (provider.clintonInvestigation === 'Aprobado') {
    doc.setTextColor(34, 197, 94);
  } else if (provider.clintonInvestigation === 'Rechazado') {
    doc.setTextColor(239, 68, 68);
  } else {
    doc.setTextColor(249, 115, 22);
  }
  doc.text(provider.clintonInvestigation, 55, yPos);
  doc.setTextColor(0, 0, 0);
  yPos += 7;

  // Validaciones
  const validaciones = [
    ['RTU Validado', provider.rtuValidated],
    ['Licencias de Piloto Validadas', provider.pilotLicenseValidated],
    ['Cuenta Bancaria Validada', provider.bankAccountValidated]
  ];

  validaciones.forEach(([label, validated]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(validated ? 34 : 239, validated ? 197 : 68, validated ? 94 : 68);
    doc.text(validated ? '✓ Sí' : '✗ No', 80, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 6;
  });

  yPos += 6;

  // === EVALUACIÓN DE DESEMPEÑO ===
  doc.setFillColor(255, 106, 0);
  doc.setTextColor(255, 255, 255);
  doc.rect(15, yPos, 180, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('EVALUACIÓN DE DESEMPEÑO', 20, yPos + 5);

  yPos += 15;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');

  // Desempeño
  doc.setFont('helvetica', 'bold');
  doc.text('Evaluación General:', 20, yPos);
  doc.setFont('helvetica', 'normal');

  if (provider.performance === 'Verde') {
    doc.setTextColor(34, 197, 94);
    doc.text('● VERDE - Excelente', 70, yPos);
  } else if (provider.performance === 'Amarillo') {
    doc.setTextColor(250, 204, 21);
    doc.text('● AMARILLO - Aceptable', 70, yPos);
  } else {
    doc.setTextColor(239, 68, 68);
    doc.text('● ROJO - Deficiente', 70, yPos);
  }
  doc.setTextColor(0, 0, 0);
  yPos += 10;

  // Historial
  if (provider.history) {
    doc.setFont('helvetica', 'bold');
    doc.text('Historial de Desempeño:', 20, yPos);
    yPos += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const historialLines = doc.splitTextToSize(provider.history, 170);
    doc.text(historialLines, 20, yPos);
    yPos += historialLines.length * 5 + 5;
    doc.setFontSize(10);
  }

  // Hallazgos
  if (provider.findings) {
    doc.setFont('helvetica', 'bold');
    doc.text('Hallazgos y No Conformidades:', 20, yPos);
    yPos += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(239, 68, 68);
    const hallazgosLines = doc.splitTextToSize(provider.findings, 170);
    doc.text(hallazgosLines, 20, yPos);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
  }

  // === PIE DE PÁGINA ===
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'italic');
  doc.text(
    'Documento generado por Logistics Group 365 - Gestión de Proveedores',
    105,
    pageHeight - 10,
    { align: 'center' }
  );
  doc.text(
    `Generado: ${new Date().toLocaleString('es-ES')}`,
    105,
    pageHeight - 5,
    { align: 'center' }
  );

  // === GUARDAR PDF ===
  doc.save(`Proveedor_${provider.name.replace(/\s+/g, '_')}.pdf`);
};