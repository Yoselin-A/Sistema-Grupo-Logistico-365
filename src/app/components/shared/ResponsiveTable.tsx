import { ReactNode } from 'react';

interface Column {
  header: string;
  accessor: string;
  render?: (value: any, row: any) => ReactNode;
  className?: string;
}

interface ResponsiveTableProps {
  columns: Column[];
  data: any[];
  onRowClick?: (row: any) => void;
  mobileCardRender?: (row: any, index: number) => ReactNode;
}

export function ResponsiveTable({
  columns,
  data,
  onRowClick,
  mobileCardRender
}: ResponsiveTableProps) {

  // Vista Desktop: Tabla tradicional
  const DesktopView = () => (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b-2 border-gray-200">
          <tr>
            {columns.map((col, idx) => (
              <th
                key={idx}
                className="text-left px-4 py-3 font-semibold text-gray-700"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              onClick={() => onRowClick?.(row)}
              className={`
                hover:bg-gray-50 transition-colors
                ${onRowClick ? 'cursor-pointer' : ''}
              `}
            >
              {columns.map((col, colIdx) => (
                <td
                  key={colIdx}
                  className={`px-4 py-3 ${col.className || ''}`}
                >
                  {col.render
                    ? col.render(row[col.accessor], row)
                    : row[col.accessor]
                  }
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Vista Móvil: Cards compactas
  const MobileView = () => (
    <div className="md:hidden space-y-3">
      {data.map((row, idx) => (
        <div
          key={idx}
          onClick={() => onRowClick?.(row)}
          className={`
            bg-white rounded-lg border border-gray-200 p-4 shadow-sm
            ${onRowClick ? 'cursor-pointer active:bg-gray-50' : ''}
          `}
        >
          {mobileCardRender ? (
            mobileCardRender(row, idx)
          ) : (
            <div className="space-y-2">
              {columns.map((col, colIdx) => (
                <div key={colIdx} className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-gray-500 uppercase">
                    {col.header}
                  </span>
                  <span className={`text-sm font-medium text-right ${col.className || ''}`}>
                    {col.render
                      ? col.render(row[col.accessor], row)
                      : row[col.accessor]
                    }
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <>
      <DesktopView />
      <MobileView />
    </>
  );
}
