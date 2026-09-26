import { Home, LogIn, ShieldX } from "lucide-react";
import { Link } from "react-router";

export function NotFound({ unauthorized = false }: { unauthorized?: boolean }) {
  return (
    <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl">
        <div className="bg-gradient-to-r from-[#0C2D6B] to-[#143C8C] px-7 py-7 text-white">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10">
              <ShieldX className="h-7 w-7 text-[#FF9B55]" />
            </div>

            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-100">
                GL365 ERP
              </p>
              <h1 className="mt-1 text-4xl font-black">Error 404</h1>
            </div>
          </div>
        </div>

        <div className="px-7 py-8 text-center">
          <h2 className="text-2xl font-black text-[#0C2D6B]">
            {unauthorized
              ? "No tienes acceso a este módulo"
              : "Página no encontrada"}
          </h2>

          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
            {unauthorized
              ? "El enlace que intentaste abrir no está habilitado para tu rol. Puedes regresar al panel principal o volver al inicio de sesión."
              : "La dirección ingresada no existe dentro del sistema. Verifica el enlace o utiliza una de las opciones siguientes."}
          </p>

          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link
              to="/dashboard"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0C2D6B] px-5 py-3 text-sm font-black text-white transition hover:bg-[#143C8C]"
            >
              <Home className="h-4 w-4" />
              Volver al dashboard
            </Link>

            <Link
              to="/login"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:border-[#FF6A00] hover:bg-orange-50 hover:text-[#C85100]"
            >
              <LogIn className="h-4 w-4" />
              Volver al login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}