interface StatusBadgeProps {
  estado: string;
  tipo?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export function StatusBadge({ estado, tipo = 'neutral' }: StatusBadgeProps) {
  const tipoClasses = {
    success: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-300 dark:border-green-400/30',
    warning: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-400/30',
    danger: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-400/30',
    info: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-400/30',
    neutral: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-400/30'
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