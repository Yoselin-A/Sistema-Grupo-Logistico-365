import { useState } from 'react';
import { Edit, Trash2, Eye } from 'lucide-react';
import { TablaDefinicion, Campo } from '../../data/tableDefinitions';
import { ResponsiveTable } from './ResponsiveTable';
import { ResponsiveModal } from './ResponsiveModal';
import { StatusBadge } from './StatusBadge';
import { ActionButtons } from './ActionButtons';

interface CRUDTableProps {
  tabla: TablaDefinicion;
  datos: any[];
  onGuardar: (dato: any) => void;
  onEliminar: (id: number) => void;
  onActualizar: (dato: any) => void;
}

export function CRUDTable({
  tabla,
  datos,
  onGuardar,
  onEliminar,
  onActualizar
}: CRUDTableProps) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modo, setModo] = useState<'ver' | 'editar' | 'nuevo'>('ver');
  const [registroActual, setRegistroActual] = useState<any>(null);
  const [busqueda, setBusqueda] = useState('');
  const [modalEliminar, setModalEliminar] = useState<any>(null);

  // Filtrar datos
  const datosFiltrados = datos.filter(dato =>
    tabla.camposTabla.some(campo =>
      String(dato[campo] || '').toLowerCase().includes(busqueda.toLowerCase())
    )
  );

  // Crear registro vacío
  const crearRegistroVacio = () => {
    const registro: any = { id: 0 };
    tabla.campos.forEach(campo => {
      registro[campo.nombre] = '';
    });
    return registro;
  };

  // Obtener tipo de badge según valor
  const obtenerTipoBadge = (valor: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' => {
    const valorLower = valor?.toLowerCase() || '';
    if (valorLower.includes('activo') || valorLower.includes('disponible') || valorLower.includes('día') ||
        valorLower.includes('completado') || valorLower.includes('entregado') || valorLower.includes('ganado') ||
        valorLower.includes('aceptada') || valorLower.includes('sí') || valorLower.includes('cumplido')) {
      return 'success';
    }
    if (valorLower.includes('pendiente') || valorLower.includes('proceso') || valorLower.includes('ruta') ||
        valorLower.includes('enviada') || valorLower.includes('programado') || valorLower.includes('parcial')) {
      return 'warning';
    }
    if (valorLower.includes('crítico') || valorLower.includes('vencida') || valorLower.includes('rechazada') ||
        valorLower.includes('perdido') || valorLower.includes('servicio') || valorLower.includes('no') ||
        valorLower.includes('incumplido') || valorLower.includes('cancelado')) {
      return 'danger';
    }
    if (valorLower.includes('mantenimiento') || valorLower.includes('destino') || valorLower.includes('borrador')) {
      return 'info';
    }
    return 'neutral';
  };

  // Renderizar valor de celda
  const renderizarValor = (campo: string, valor: any) => {
    if (!valor) return '-';

    // Si es un campo de estado, mostrar badge
    if (campo.toLowerCase().includes('estado') || campo.toLowerCase().includes('activo') ||
        campo.toLowerCase().includes('prioridad') || campo.toLowerCase().includes('cumplimiento')) {
      return <StatusBadge estado={String(valor)} tipo={obtenerTipoBadge(String(valor))} />;
    }

    return String(valor);
  };

  // Columnas de la tabla
  const columnas = tabla.camposTabla.map(campo => ({
    header: campo.charAt(0).toUpperCase() + campo.slice(1).replace(/([A-Z])/g, ' $1'),
    accessor: campo,
    render: (valor: any) => renderizarValor(campo, valor)
  }));

  // Agregar columna de acciones
  columnas.push({
    header: 'Acciones',
    accessor: 'id',
    render: (_: any, row: any) => (
      <div className="flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setRegistroActual(row);
            setModo('ver');
            setModalAbierto(true);
          }}
          className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
          title="Ver"
        >
          <Eye className="w-4 h-4 text-blue-600" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setRegistroActual(row);
            setModo('editar');
            setModalAbierto(true);
          }}
          className="p-2 hover:bg-green-50 rounded-lg transition-colors"
          title="Editar"
        >
          <Edit className="w-4 h-4 text-green-600" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setModalEliminar(row);
          }}
          className="p-2 hover:bg-red-50 rounded-lg transition-colors"
          title="Eliminar"
        >
          <Trash2 className="w-4 h-4 text-red-600" />
        </button>
      </div>
    )
  });

  // Render mobile card
  const renderMobileCard = (row: any) => (
    <div className="space-y-3">
      {tabla.camposTabla.slice(0, 4).map((campo, idx) => (
        <div key={idx} className="flex justify-between items-start">
          <span className="text-xs font-semibold text-gray-500 uppercase">
            {campo.charAt(0).toUpperCase() + campo.slice(1).replace(/([A-Z])/g, ' $1')}
          </span>
          <span className="text-sm font-medium text-right">
            {renderizarValor(campo, row[campo])}
          </span>
        </div>
      ))}
      <div className="flex gap-2 pt-2 border-t border-gray-100">
        <button
          onClick={() => {
            setRegistroActual(row);
            setModo('ver');
            setModalAbierto(true);
          }}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-50 text-blue-700 px-3 py-2 rounded-lg text-sm font-medium min-h-[44px]"
        >
          <Eye className="w-4 h-4" />
          Ver
        </button>
        <button
          onClick={() => {
            setRegistroActual(row);
            setModo('editar');
            setModalAbierto(true);
          }}
          className="flex-1 flex items-center justify-center gap-2 bg-green-50 text-green-700 px-3 py-2 rounded-lg text-sm font-medium min-h-[44px]"
        >
          <Edit className="w-4 h-4" />
          Editar
        </button>
        <button
          onClick={() => setModalEliminar(row)}
          className="flex items-center justify-center gap-2 bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm font-medium min-h-[44px]"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // Renderizar campo de formulario
  const renderizarCampo = (campo: Campo, deshabilitado: boolean = false) => {
    const valor = registroActual?.[campo.nombre] || '';
    const onChange = (nuevoValor: any) => {
      setRegistroActual({ ...registroActual, [campo.nombre]: nuevoValor });
    };

    const estilosInput = `w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[#0C2D6B] focus:border-transparent min-h-[44px] ${
      deshabilitado ? 'bg-gray-50 text-gray-600' : ''
    }`;

    switch (campo.tipo) {
      case 'textarea':
        return (
          <textarea
            value={valor}
            onChange={(e) => onChange(e.target.value)}
            disabled={deshabilitado}
            rows={3}
            className={`${estilosInput} resize-none`}
          />
        );

      case 'select':
        return (
          <select
            value={valor}
            onChange={(e) => onChange(e.target.value)}
            disabled={deshabilitado}
            className={estilosInput}
          >
            <option value="">Seleccionar...</option>
            {campo.opciones?.map((opcion, idx) => (
              <option key={idx} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>
        );

      default:
        return (
          <input
            type={campo.tipo}
            value={valor}
            onChange={(e) => onChange(e.target.value)}
            disabled={deshabilitado}
            required={campo.requerido}
            className={estilosInput}
          />
        );
    }
  };

  // Guardar registro
  const handleGuardar = () => {
    if (modo === 'nuevo') {
      onGuardar({ ...registroActual, id: Date.now() });
    } else if (modo === 'editar') {
      onActualizar(registroActual);
    }
    setModalAbierto(false);
    setRegistroActual(null);
  };

  return (
    <div className="space-y-6">
      {/* Búsqueda y Acciones */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <input
          type="text"
          placeholder={`Buscar en ${tabla.nombrePlural.toLowerCase()}...`}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="flex-1 max-w-md border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[#0C2D6B] focus:border-transparent min-h-[44px]"
        />
        <ActionButtons
          onNuevo={() => {
            setRegistroActual(crearRegistroVacio());
            setModo('nuevo');
            setModalAbierto(true);
          }}
          labelNuevo={`Nuevo ${tabla.nombre}`}
          mostrarExportar={false}
        />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm">
        <ResponsiveTable
          columns={columnas}
          data={datosFiltrados}
          mobileCardRender={renderMobileCard}
        />
      </div>

      {/* Modal Ver/Editar/Nuevo */}
      <ResponsiveModal
        isOpen={modalAbierto}
        onClose={() => {
          setModalAbierto(false);
          setRegistroActual(null);
        }}
        titulo={
          modo === 'nuevo' ? `Nuevo ${tabla.nombre}` :
          modo === 'editar' ? `Editar ${tabla.nombre}` :
          `Ver ${tabla.nombre}`
        }
        footer={
          modo !== 'ver' ? (
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
                  setRegistroActual(null);
                }}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-300 font-semibold min-h-[44px]"
              >
                Cancelar
              </button>
            </div>
          ) : undefined
        }
      >
        {registroActual && (
          <form className="space-y-4">
            {tabla.campos.map((campo, idx) => (
              <div key={idx}>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {campo.nombre.charAt(0).toUpperCase() + campo.nombre.slice(1).replace(/([A-Z])/g, ' $1')}
                  {campo.requerido && <span className="text-red-500 ml-1">*</span>}
                </label>
                {renderizarCampo(campo, modo === 'ver')}
              </div>
            ))}
          </form>
        )}
      </ResponsiveModal>

      {/* Modal Eliminar */}
      {modalEliminar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-[#0C2D6B] mb-3">
              Eliminar {tabla.nombre}
            </h3>
            <p className="text-gray-600 mb-6">
              ¿Está seguro de que desea eliminar este registro? Esta acción no se puede deshacer.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  onEliminar(modalEliminar.id);
                  setModalEliminar(null);
                }}
                className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-lg hover:bg-red-700 font-semibold min-h-[44px]"
              >
                Eliminar
              </button>
              <button
                onClick={() => setModalEliminar(null)}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-300 font-semibold min-h-[44px]"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
