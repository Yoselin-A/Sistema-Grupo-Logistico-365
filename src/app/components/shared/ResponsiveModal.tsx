import { ReactNode, useEffect, useId } from 'react';
import { X } from 'lucide-react';

interface ResponsiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  titulo: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'full';
}

export function ResponsiveModal({
  isOpen,
  onClose,
  titulo,
  children,
  footer,
  size = 'md'
}: ResponsiveModalProps) {
  const titleId = useId();
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", onKey); };
  }, [isOpen, onClose]);
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-2xl',
    lg: 'sm:max-w-4xl',
    full: 'sm:max-w-6xl'
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="min-h-screen px-0 sm:px-4 flex items-center justify-center">
        <div className={`
          gl365-modal relative bg-white w-full min-w-0
          sm:rounded-2xl sm:shadow-2xl
          h-[100dvh] sm:h-auto sm:max-h-[90dvh]
          flex flex-col
          ${sizeClasses[size]}
        `} role="dialog" aria-modal="true" aria-labelledby={titleId}>

          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 sticky top-0 bg-white sm:rounded-t-2xl">
            <h2 id={titleId} className="min-w-0 break-words text-lg sm:text-xl font-bold text-[#0C2D6B]">{titulo}</h2>
            <button
              type="button"
              aria-label="Cerrar ventana"
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="shrink-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 border-t border-gray-200 sticky bottom-0 bg-white sm:rounded-b-2xl">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
