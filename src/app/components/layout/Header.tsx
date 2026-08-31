import { Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import logoImage from '../../../assets/614cb11181e5d72cb3a39a09d833f4775b7fc7ce.png';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { role, userName } = useAuth();

  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 shadow-sm flex items-center justify-between z-20 relative h-16 sticky top-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <Menu className="w-6 h-6 text-[#0C2D6B]" />
        </button>

        <img
          src={logoImage}
          alt="Grupo Logístico 365"
          className="h-8 sm:h-10 w-auto object-contain"
        />
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-bold text-[#0C2D6B]">{userName}</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{role}</p>
        </div>

        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#0C2D6B] flex items-center justify-center text-white font-bold shadow-sm text-sm">
          {userName.charAt(0)}
        </div>
      </div>
    </header>
  );
}