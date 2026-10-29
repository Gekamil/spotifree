import React, { useState } from 'react';

interface MessagesNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MessagesNotificationsModal: React.FC<MessagesNotificationsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'novedades' | 'mensajes'>('novedades');
  const [messageText, setMessageText] = useState('');
  const [sentSuccess, setSentSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('spotifree_sent_messages');
        const list = raw ? JSON.parse(raw) : [];
        list.push({ text: messageText.trim(), date: new Date().toISOString() });
        window.localStorage.setItem('spotifree_sent_messages', JSON.stringify(list));
      } catch {}
    }

    setMessageText('');
    setSentSuccess(true);
    setTimeout(() => setSentSuccess(false), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md font-['SpotifyMixUI'] select-none animate-fade-in">
      <div className="relative w-full max-w-md bg-[#242424] text-white rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#1ed760]/20 flex items-center justify-center text-[#1ed760]">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1.5a4 4 0 0 0-4 4v3.268l-.938 1.876A1 1 0 0 0 3.956 12h8.088a1 1 0 0 0 .894-1.356L12 8.768V5.5a4 4 0 0 0-4-4zM2.5 5.5a5.5 5.5 0 1 1 11 0v3.01l1.042 2.084A2.5 2.5 0 0 1 12.044 13.5H3.956a2.5 2.5 0 0 1-2.498-2.906L2.5 8.51V5.5zM6 14.5a2 2 0 1 0 4 0H6z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-white font-['SpotifyMixUITitle']">
              Novedades y Mensajes
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-[#b3b3b3] hover:text-white transition-colors cursor-pointer text-sm"
          >
            ✕
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-white/10 px-5 pt-2 gap-4">
          <button
            onClick={() => setActiveTab('novedades')}
            className={`pb-2 text-xs font-bold transition-colors border-b-2 ${
              activeTab === 'novedades'
                ? 'border-[#1ed760] text-white'
                : 'border-transparent text-[#b3b3b3] hover:text-white'
            }`}
          >
            Novedades
          </button>
          <button
            onClick={() => setActiveTab('mensajes')}
            className={`pb-2 text-xs font-bold transition-colors border-b-2 ${
              activeTab === 'mensajes'
                ? 'border-[#1ed760] text-white'
                : 'border-transparent text-[#b3b3b3] hover:text-white'
            }`}
          >
            Enviar Mensaje
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {activeTab === 'novedades' ? (
            <div className="space-y-3">
              <div className="p-3.5 bg-[#181818] rounded-xl border border-white/5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">Reproductor en pantalla de bloqueo</span>
                  <span className="text-[10px] text-[#1ed760] font-bold">NUEVO</span>
                </div>
                <p className="text-[#b3b3b3] leading-relaxed text-[11px]">
                  Ahora puedes apagar la pantalla del móvil y controlar la música con carátula, scrubber y controles nativos idénticos a Spotify.
                </p>
              </div>

              <div className="p-3.5 bg-[#181818] rounded-xl border border-white/5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">Carátulas individuales por canción</span>
                  <span className="text-[10px] text-[#1ed760] font-bold">ACTUALIZADO</span>
                </div>
                <p className="text-[#b3b3b3] leading-relaxed text-[11px]">
                  Las canciones dentro de las listas en móvil ahora cargan su carátula original de álbum en alta resolución.
                </p>
              </div>

              <div className="p-3.5 bg-[#181818] rounded-xl border border-white/5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">Personalización con GIFs</span>
                  <span className="text-[10px] text-[#1ed760] font-bold">NUEVO</span>
                </div>
                <p className="text-[#b3b3b3] leading-relaxed text-[11px]">
                  Sube tus propios avatares o banners animados (GIF o imágenes) desde «Editar perfil».
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSendMessage} className="space-y-3.5">
              <p className="text-[#b3b3b3] text-[11px]">
                Escribe un mensaje, sugerencia o feedback para el equipo de desarrollo:
              </p>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Escribe tu mensaje aquí..."
                rows={4}
                className="w-full p-3 bg-[#181818] border border-white/10 rounded-xl text-white text-xs outline-none focus:border-[#1ed760] resize-none"
              />
              {sentSuccess && (
                <div className="p-2.5 bg-[#1ed760]/10 border border-[#1ed760]/30 rounded-lg text-[#1ed760] text-xs font-bold text-center">
                  ✓ ¡Mensaje enviado con éxito!
                </div>
              )}
              <button
                type="submit"
                disabled={!messageText.trim()}
                className={`w-full py-2.5 rounded-full font-bold text-xs transition-all ${
                  messageText.trim()
                    ? 'bg-[#1ed760] text-black active:scale-98 shadow-md'
                    : 'bg-white/10 text-white/30 cursor-not-allowed'
                }`}
              >
                Enviar Mensaje
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
