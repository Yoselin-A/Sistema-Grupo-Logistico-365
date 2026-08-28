import { FileText, FileSpreadsheet, Plus, Search, Filter } from 'lucide-react';

interface ActionButtonsProps {
  onNuevo?: () => void;
  onExportPDF?: () => void;
  onExportExcel?: () => void;
  onBuscar?: () => void;
  onFiltrar?: () => void;
  labelNuevo?: string;
  mostrarExportar?: boolean;
  mostrarBuscar?: boolean;
  mostrarFiltrar?: boolean;
}

export function ActionButtons({
  onNuevo,
  onExportPDF,
  onExportExcel,
  onBuscar,
  onFiltrar,
  labelNuevo = 'Nuevo',
  mostrarExportar = true,
  mostrarBuscar = false,
  mostrarFiltrar = false
}: ActionButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2 sm:gap-3">
      {onNuevo && (
        <button
          onClick={onNuevo}
          className="flex items-center gap-2 bg-[#0C2D6B] text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg hover:bg-[#0A2555] transition-colors text-sm font-medium min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{labelNuevo}</span>
          <span className="sm:hidden">+</span>
        </button>
      )}

      {mostrarBuscar && onBuscar && (
        <button
          onClick={onBuscar}
          className="flex items-center gap-2 bg-gray-100 text-gray-700 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium min-h-[44px]"
        >
          <Search className="w-4 h-4" />
          <span className="hidden sm:inline">Buscar</span>
        </button>
      )}

      {mostrarFiltrar && onFiltrar && (
        <button
          onClick={onFiltrar}
          className="flex items-center gap-2 bg-gray-100 text-gray-700 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium min-h-[44px]"
        >
          <Filter className="w-4 h-4" />
          <span className="hidden sm:inline">Filtros</span>
        </button>
      )}

      {mostrarExportar && (
        <>
          {onExportPDF && (
            <button
              onClick={onExportPDF}
              className="flex items-center gap-2 bg-red-600 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium min-h-[44px]"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">PDF</span>
            </button>
          )}
          {onExportExcel && (
            <button
              onClick={onExportExcel}
              className="flex items-center gap-2 bg-green-600 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium min-h-[44px]"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Excel</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
