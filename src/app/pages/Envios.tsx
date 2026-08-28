import { useState } from 'react';
import { Truck, Package, CheckCircle, Clock, Plus } from 'lucide-react';
import { KPICard } from '../components/shared/KPICard';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ActionButtons } from '../components/shared/ActionButtons';
import { ResponsiveTable } from '../components/shared/ResponsiveTable';
import { ResponsiveModal } from '../components/shared/ResponsiveModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface Envio {
  id: number;
  codigo: string;
  cliente: string;
  ruta: string;
  piloto: string;
  estado: 'Recolección' | 'En ruta' | 'En destino' | 'Entregado';
  progreso: number;
  eta: string;
  peso?: number;
}

export function Envios() {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Envio | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const [envios, setEnvios] = useState<Envio[]>([
    {
      id: 1,
      codigo: 'ENV-001',
      cliente: 'Distribuidora ABC',
      ruta: 'Guatemala → Salvador',
      piloto: 'María García',
      progreso: 50,
      estado: 'En ruta',
      eta: '16:45',
      peso: 2500
    },
    {
      id: 2,
      codigo: 'ENV-002',
      cliente: 'Logística GT',
      ruta: 'Escuintla → Guatemala',
      piloto: 'Juan Pérez',
      progreso: 25,
      estado: 'Recolección',
      eta: '12:30',
      peso: 1800
    },
    {
      id: 3,
      codigo: 'ENV-003',
      cliente: 'Retail Express',
      ruta: 'Quetzaltenango → Retalhuleu',
      piloto: 'Carlos López',
      progreso: 75,
      estado: 'En destino',
      eta: '18:20',
      peso: 3200
    },
    {
      id: 4,
      codigo: 'ENV-004',
      cliente: 'Importadora Maya',
      ruta: 'Petén → Guatemala',
      piloto: 'Luis Méndez',
      progreso: 100,
      estado: 'Entregado',
      eta: '09:15',
      peso: 4100
    }
  ]);

  // Filtrar envíos
  const enviosFiltrados = envios.filter(e =>
    e.codigo.toLowerCase().includes(busqueda.toLowerCase()) ||
    e.cliente.toLowerCase().includes(busqueda.toLowerCase()) ||
    e.ruta.toLowerCase().includes(busqueda.toLowerCase())
  );

  // KPIs
  const totalEnvios = envios.length;
  const enRuta = envios.filter(e => e.estado === 'En ruta').length;
  const entregados = envios.filter(e => e.estado === 'Entregado').length;
  const pendientes = envios.filter(e => e.estado === 'Recolección').length;

  // Función para obtener tipo de badge
  const obtenerTipoBadge = (estado: string): 'success' | 'warning' | 'info' | 'neutral' => {
    switch (estado) {
      case 'Entregado': return 'success';
      case 'En destino': return 'info';
      case 'En ruta': return 'warning';
      default: return 'neutral';
    }
  };

  // Exportar PDF
  const exportarPDF = () => {
    const doc = new jsPDF();

    doc.setFillColor(12, 45, 107);
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text('Grupo Logístico 365', 14, 20);
    doc.setFontSize(12);
    doc.text('Reporte de Envíos', 14, 30);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')}`, 14, 50);

    autoTable(doc, {
      startY: 60,
      head: [['Código', 'Cliente', 'Ruta', 'Piloto', 'Estado', 'ETA']],
      body: enviosFiltrados.map(e => [
        e.codigo,
        e.cliente,
        e.ruta,
        e.piloto,
        e.estado,
        e.eta
      ]),
      theme: 'grid',
      headStyles: { fillColor: [12, 45, 107] }
    });

    doc.save('envios-reporte.pdf');
  };

  // Exportar Excel
  const exportarExcel = () => {
    const datos = enviosFiltrados.map(e => ({
      Código: e.codigo,
      Cliente: e.cliente,
      Ruta: e.ruta,
      Piloto: e.piloto,
      Estado: e.estado,
      'ETA': e.eta,
      'Peso (kg)': e.peso || 0,
      'Progreso (%)': e.progreso
    }));

    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Envíos');
    XLSX.writeFile(wb, 'envios-reporte.xlsx');
  };

  // Guardar envío
  const handleGuardar = () => {
    if (editando) {
      if (editando.id) {
        // Editar existente
        setEnvios(envios.map(e => e.id === editando.id ? editando : e));
      } else {
        // Crear nuevo
        const nuevoEnvio = {
          ...editando,
          id: Date.now(),
          codigo: `ENV-${String(Date.now()).slice(-3)}`
        };
        setEnvios([nuevoEnvio, ...envios]);
      }
    }
    setModalAbierto(false);
    setEditando(null);
  };

  // Columnas de tabla
  const columnas = [
    {
      header: 'Código',
      accessor: 'codigo',
      className: 'font-semibold text-[#0C2D6B]'
    },
    {
      header: 'Cliente',
      accessor: 'cliente'
    },
    {
      header: 'Ruta',
      accessor: 'ruta',
      className: 'text-gray-600'
    },
    {
      header: 'Piloto',
      accessor: 'piloto'
    },
    {
      header: 'Estado',
      accessor: 'estado',
      render: (valor: string) => <StatusBadge estado={valor} tipo={obtenerTipoBadge(valor)} />
    },
    {
      header: 'Progreso',
      accessor: 'progreso',
      render: (valor: number) => (
        <div className="flex items-center gap-2">
          <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#22C55E]"
              style={{ width: `${valor}%` }}
            />
          </div>
          <span className="text-xs font-semibold">{valor}%</span>
        </div>
      )
    }
  ];

  // Render mobile card
  const renderMobileCard = (envio: Envio) => (
    <div className="space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-bold text-[#0C2D6B]">{envio.codigo}</p>
          <p className="text-sm text-gray-500">{envio.cliente}</p>
        </div>
        <StatusBadge estado={envio.estado} tipo={obtenerTipoBadge(envio.estado)} />
      </div>
      <div className="text-sm">
        <p className="text-gray-600"><span className="font-semibold">Ruta:</span> {envio.ruta}</p>
        <p className="text-gray-600"><span className="font-semibold">Piloto:</span> {envio.piloto}</p>
        <p className="text-gray-600"><span className="font-semibold">ETA:</span> {envio.eta}</p>
      </div>
      <div className="pt-2 border-t">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">Progreso</span>
          <span className="text-xs font-bold text-[#0C2D6B]">{envio.progreso}%</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#22C55E]"
            style={{ width: `${envio.progreso}%` }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-8">
      {/* Título */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0C2D6B] flex items-center gap-3">
          <Truck className="w-7 h-7 sm:w-8 sm:h-8" />
          Seguimiento de Envíos
        </h1>
        <p className="text-sm sm:text-base text-gray-500 mt-1">
          Control y rastreo de envíos en tiempo real
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          titulo="Total Envíos"
          valor={totalEnvios}
          icono={Package}
          color="blue"
        />
        <KPICard
          titulo="En Ruta"
          valor={enRuta}
          icono={Truck}
          color="orange"
        />
        <KPICard
          titulo="Entregados"
          valor={entregados}
          icono={CheckCircle}
          color="green"
        />
        <KPICard
          titulo="Pendientes"
          valor={pendientes}
          icono={Clock}
          color="red"
        />
      </div>

      {/* Búsqueda y Acciones */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <input
          type="text"
          placeholder="Buscar envío..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="flex-1 max-w-md border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[#0C2D6B] focus:border-transparent min-h-[44px]"
        />
        <ActionButtons
          onNuevo={() => {
            setEditando({
              id: 0,
              codigo: '',
              cliente: '',
              ruta: '',
              piloto: '',
              estado: 'Recolección',
              progreso: 25,
              eta: ''
            });
            setModalAbierto(true);
          }}
          labelNuevo="Nuevo Envío"
          onExportPDF={exportarPDF}
          onExportExcel={exportarExcel}
        />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm">
        <ResponsiveTable
          columns={columnas}
          data={enviosFiltrados}
          mobileCardRender={renderMobileCard}
          onRowClick={(envio) => {
            setEditando(envio);
            setModalAbierto(true);
          }}
        />
      </div>

      {/* Modal */}
      <ResponsiveModal
        isOpen={modalAbierto}
        onClose={() => {
          setModalAbierto(false);
          setEditando(null);
        }}
        titulo={editando?.id ? 'Editar Envío' : 'Nuevo Envío'}
        footer={
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleGuardar}
              className="flex-1 bg-[#0C2D6B] text-white px-4 py-2.5 rounded-lg hover:bg-[#0A2555] font-semibold min-h-[44px]"
            >
              Guardar
            </button>
            <button
              onClick={() => {
                setModalAbierto(false);
                setEditando(null);
              }}
              className="flex-1 bg-gray-200 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-300 font-semibold min-h-[44px]"
            >
              Cancelar
            </button>
          </div>
        }
      >
        {editando && (
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Cliente
              </label>
              <input
                type="text"
                value={editando.cliente}
                onChange={(e) => setEditando({ ...editando, cliente: e.target.value })}
                placeholder="Nombre del cliente"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[#0C2D6B] focus:border-transparent min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Ruta
              </label>
              <input
                type="text"
                value={editando.ruta}
                onChange={(e) => setEditando({ ...editando, ruta: e.target.value })}
                placeholder="Origen → Destino"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[#0C2D6B] focus:border-transparent min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Piloto
              </label>
              <input
                type="text"
                value={editando.piloto}
                onChange={(e) => setEditando({ ...editando, piloto: e.target.value })}
                placeholder="Nombre del piloto"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[#0C2D6B] focus:border-transparent min-h-[44px]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Estado
                </label>
                <select
                  value={editando.estado}
                  onChange={(e) => {
                    const estado = e.target.value as Envio['estado'];
                    const progresoMap = {
                      'Recolección': 25,
                      'En ruta': 50,
                      'En destino': 75,
                      'Entregado': 100
                    };
                    setEditando({ ...editando, estado, progreso: progresoMap[estado] });
                  }}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[#0C2D6B] focus:border-transparent min-h-[44px]"
                >
                  <option value="Recolección">Recolección</option>
                  <option value="En ruta">En ruta</option>
                  <option value="En destino">En destino</option>
                  <option value="Entregado">Entregado</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ETA
                </label>
                <input
                  type="time"
                  value={editando.eta}
                  onChange={(e) => setEditando({ ...editando, eta: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[#0C2D6B] focus:border-transparent min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Peso (kg)
              </label>
              <input
                type="number"
                value={editando.peso || ''}
                onChange={(e) => setEditando({ ...editando, peso: Number(e.target.value) })}
                placeholder="2500"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[#0C2D6B] focus:border-transparent min-h-[44px]"
              />
            </div>
          </form>
        )}
      </ResponsiveModal>
    </div>
  );
}
