import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  titulo: string;
  valor: string | number;
  subtitulo?: string;
  icono: LucideIcon;
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
  onClick?: () => void;
  tendencia?: {
    valor: string;
    positiva: boolean;
  };
}

export function KPICard({
  titulo,
  valor,
  subtitulo,
  icono: Icono,
  color = 'blue',
  onClick,
  tendencia
}: KPICardProps) {
  const colorClasses = {
    blue: {
      border: 'border-l-[#0C2D6B]',
      bg: 'bg-blue-50',
      text: 'text-[#0C2D6B]'
    },
    green: {
      border: 'border-l-[#22C55E]',
      bg: 'bg-green-50',
      text: 'text-[#22C55E]'
    },
    orange: {
      border: 'border-l-[#F97316]',
      bg: 'bg-orange-50',
      text: 'text-[#F97316]'
    },
    red: {
      border: 'border-l-[#EF4444]',
      bg: 'bg-red-50',
      text: 'text-[#EF4444]'
    },
    purple: {
      border: 'border-l-[#8B5CF6]',
      bg: 'bg-purple-50',
      text: 'text-[#8B5CF6]'
    }
  };

  const colors = colorClasses[color];

  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-xl p-4 sm:p-6 shadow-sm border-l-4
        ${colors.border}
        ${onClick ? 'cursor-pointer hover:shadow-md' : ''}
        transition-all duration-200
      `}
    >
      <div className="flex justify-between items-start mb-3 sm:mb-4">
        <div className={`p-2 sm:p-3 rounded-xl ${colors.bg} ${colors.text}`}>
          <Icono className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        {tendencia && (
          <div className={`text-xs sm:text-sm font-semibold ${
            tendencia.positiva ? 'text-[#22C55E]' : 'text-[#EF4444]'
          }`}>
            {tendencia.valor}
          </div>
        )}
      </div>
      <div>
        <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1">{titulo}</p>
        <h3 className="text-2xl sm:text-3xl font-bold text-[#0C2D6B]">{valor}</h3>
        {subtitulo && <p className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-2">{subtitulo}</p>}
      </div>
    </div>
  );
}
