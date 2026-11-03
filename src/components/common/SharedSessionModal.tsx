import React, { useState } from 'react';
import { useSharedSessionStore } from '../../services/sharedSessionService';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';

export const SharedSessionModal: React.FC = () => {
  const {
    isInSession,
    isHost,
    sessionId,
    sessionLink,
    participants,
    isModalOpen,
    setModalOpen,
    createSession,
    joinSession,
    leaveSession,
    terminateSession,
  } = useSharedSessionStore();

  const user = useSpotifyDataStore((s) => s.user);
  const [userName, setUserName] = useState(() => user?.display_name || 'Amigo');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isModalOpen) return null;

  const handleCopyLink = () => {
    if (!sessionLink) return;
    navigator.clipboard.writeText(sessionLink).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    });
  };

  const handleStart = async () => {
    setIsSubmitting(true);
    await createSession(userName);
    setIsSubmitting(false);
  };

  const handleJoin = async () => {
    if (!joinCodeInput.trim()) return;
    setIsSubmitting(true);
    await joinSession(joinCodeInput.trim(), userName);
    setIsSubmitting(false);
  };

  return (
    <div
      className="fixed inset-0 z-[99999] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none font-['SpotifyMixUI']"
      onClick={() => setModalOpen(false)}
    >
      <div
        className="w-full max-w-md bg-[#181818] border border-white/10 rounded-2xl shadow-2xl p-6 text-white relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={() => setModalOpen(false)}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-[#b3b3b3] hover:text-white transition-colors cursor-pointer"
          title="Cerrar"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-full bg-[#1ed760]/20 text-[#1ed760] flex items-center justify-center shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              <path d="M4.5 10c1.38 0 2.5-1.12 2.5-2.5S5.88 5 4.5 5 2 6.12 2 7.5 3.12 10 4.5 10zm-1.5 3.5C1.84 14.16 0 15.33 0 17v2h6v-2c0-1.67-1.84-2.84-3-3.5z"/>
              <path d="M19.5 10c1.38 0 2.5-1.12 2.5-2.5S20.88 5 19.5 5 17 6.12 17 7.5s1.12 2.5 2.5 2.5zm1.5 3.5c1.16.66 3 1.83 3 3.5v2h-6v-2c0-1.67 1.84-2.84 3-3.5z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight font-['SpotifyMixUITitle']">
              Sesión compartida
            </h2>
            <p className="text-xs text-[#b3b3b3]">
              {isInSession ? `Sala en vivo • Código ${sessionId}` : 'Escucha y controla música con tus amigos'}
            </p>
          </div>
        </div>

        {/* Not in Session: Create or Join */}
        {!isInSession ? (
          <div className="space-y-4">
            <p className="text-sm text-[#b3b3b3] leading-relaxed">
              Inicia una sesión para que tus amigos se conecten. Veréis el ratón del otro en tiempo real, podréis interactuar con las playlists y escuchar las canciones sincronizadas al mismo segundo.
            </p>

            <div>
              <label className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider block mb-1.5">
                Tu nombre en la sesión
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Nombre para mostrar"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#1ed760] transition-colors"
              />
            </div>

            <button
              onClick={handleStart}
              disabled={isSubmitting}
              className="w-full py-3 rounded-full bg-[#1ed760] text-black font-black text-sm tracking-wide hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-[#1ed760]/20 flex items-center justify-center gap-2"
            >
              <span>{isSubmitting ? 'Iniciando...' : 'Iniciar Sesión Compartida'}</span>
            </button>

            <div className="pt-3 border-t border-white/10 flex items-center gap-2">
              <input
                type="text"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="Pegar código de sesión"
                maxLength={8}
                className="flex-1 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm uppercase tracking-wider focus:outline-none focus:border-[#1ed760]"
              />
              <button
                onClick={handleJoin}
                disabled={isSubmitting || !joinCodeInput.trim()}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer transition-all disabled:opacity-40"
              >
                Unirse
              </button>
            </div>
          </div>
        ) : (
          /* Currently in Session */
          <div className="space-y-5">
            {/* Share Link Banner */}
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">
                  Enlace para tus amigos
                </span>
                <span className="text-xs text-[#1ed760] font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#1ed760] animate-ping inline-block" />
                  En vivo
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={sessionLink || ''}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5 text-xs text-white/90 font-mono truncate select-all"
                />
                <button
                  onClick={handleCopyLink}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isCopied
                      ? 'bg-[#1ed760] text-black shadow-md'
                      : 'bg-white text-black hover:scale-102 active:scale-95'
                  }`}
                >
                  {isCopied ? '¡Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>

            {/* Participants List */}
            <div>
              <div className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider mb-2.5">
                Participantes ({participants.length})
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-black/25 border border-white/5"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="text-xs font-bold text-white">
                        {p.name}
                      </span>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold bg-white/5 text-[#b3b3b3]">
                      {p.isHost ? '👑 Anfitrión' : 'Invitado'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Guest Security Notice */}
            {!isHost && (
              <div className="p-2.5 rounded-lg bg-white/5 text-[11px] text-[#b3b3b3] leading-relaxed border border-white/5">
                🔒 Estás en la sesión como invitado. Puedes cambiar de canción y hacer clic en playlists. El acceso a los ajustes de configuración está protegido.
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-between gap-3">
              {isHost ? (
                <button
                  onClick={terminateSession}
                  className="w-full py-2.5 rounded-full bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 font-bold text-xs transition-all cursor-pointer"
                >
                  Finalizar sesión para todos
                </button>
              ) : (
                <button
                  onClick={leaveSession}
                  className="w-full py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all cursor-pointer"
                >
                  Salir de la sesión
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
