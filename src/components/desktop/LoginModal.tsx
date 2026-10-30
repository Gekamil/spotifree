import React from 'react';
import { SpotifreeAuthCard } from '../common/SpotifreeAuthCard';
import { useUIStore } from '../../store/useUIStore';

export const LoginModal: React.FC = () => {
  const { isLoginModalOpen, closeLoginModal } = useUIStore();

  if (!isLoginModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in duration-150 font-['SpotifyMixUI']">
      <div className="bg-[#121212] w-full max-w-[420px] rounded-2xl border border-[#282828] shadow-2xl flex flex-col font-sans relative max-h-[92vh] overflow-y-auto">
        {/* Close Button top-right */}
        <button
          onClick={closeLoginModal}
          className="absolute right-4 top-4 w-8 h-8 rounded-full text-[#b3b3b3] hover:text-white flex items-center justify-center transition-colors cursor-pointer z-10 hover:bg-[#282828]"
          title="Cerrar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>

        {/* Modal Header */}
        <div className="px-8 pt-8 pb-3 flex flex-col items-center">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="white" className="mb-3">
            <path d="M12 2C6.477 2 2 6.477 2 12c0 5.524 4.477 10 10 10s10-4.476 10-10c0-5.523-4.477-10-10-10zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.435-5.308-1.76-8.793-.963-.335.077-.67-.133-.746-.468-.077-.334.132-.67.467-.746 3.808-.87 7.076-.496 9.722 1.115.294.18.386.563.207.855zm1.226-2.72c-.226.367-.706.482-1.072.257-2.687-1.652-6.785-2.131-9.965-1.166-.413.127-.848-.106-.973-.518-.125-.413.108-.848.52-.973 3.632-1.102 8.147-.568 11.233 1.328.366.226.481.707.257 1.072zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71c-.494.15-1.018-.13-1.168-.624-.15-.494.13-1.018.624-1.168 3.532-1.073 9.404-.866 13.115 1.337.445.264.59.838.327 1.282-.264.443-.838.59-1.28.327z" />
          </svg>

          <h1 className="text-2xl font-bold text-white font-title text-center tracking-tight leading-snug">
            Iniciar sesión en Spotifree
          </h1>
          <p className="text-xs text-[#a7a7a7] text-center mt-1">
            Crea tu cuenta o inicia sesión con tu correo y contraseña para sincronizar tus canciones y listas.
          </p>
        </div>

        {/* Modal Body */}
        <div className="px-6 pb-6 pt-2 space-y-4">
          <SpotifreeAuthCard
            showCookieInput={false}
            onAuthSuccess={() => setTimeout(closeLoginModal, 600)}
          />
        </div>
      </div>
    </div>
  );
};
