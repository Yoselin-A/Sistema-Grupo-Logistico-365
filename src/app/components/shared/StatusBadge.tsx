interface StatusBadgeProps {
  estado: string;
  tipo?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export function StatusBadge({ estado, tipo = 'neutral' }: StatusBadgeProps) {
  const tipoClasses = {
    success: 'bg-green-100 text-green-700 border-green-200',
    warning: 'bg-orange-100 text-orange-700 border-orange-200',
    danger: 'bg-red-100 text-red-700 border-red-200',
    info: 'bg-blue-100 text-blue-700 border-blue-200',
    neutral: 'bg-gray-100 text-gray-700 border-gray-200'
  };

  return (
    <span className={`
      inline-flex items-center px-2 sm:px-3 py-1 rounded-full
      text-xs font-semibold border
      ${tipoClasses[tipo]}
    `}>
      {estado}
    </span>
  );
}
