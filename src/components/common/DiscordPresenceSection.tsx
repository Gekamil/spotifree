import React, { useState, useEffect } from 'react';
import { useDiscordPresenceStore } from '../../services/discordPresenceService';
import { usePlayerStore, resolveTrackCover } from '../../store/usePlayerStore';

export const DiscordPresenceSection: React.FC<{ variant?: 'mobile' | 'desktop' }> = ({ variant = 'desktop' }) => {
  const {
    enabled,
    bridgeActive,
    discordConnected,
    clientId,
    setEnabled,
    setClientId,
    checkStatus,
  } = useDiscordPresenceStore();

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const progressMs = usePlayerStore((s) => s.progressMs);

  const [isChecking, setIsChecking] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customIdInput, setCustomIdInput] = useState(clientId || '');

  useEffect(() => {
    setCustomIdInput(clientId || '');
  }, [clientId]);

  const handleManualCheck = async () => {
    setIsChecking(true);
    await checkStatus();
    setTimeout(() => setIsChecking(false), 600);
  };

  const handleSaveClientId = async () => {
    await setClientId(customIdInput.trim());
  };

  // Preview track data
  const previewTitle = currentTrack?.name || 'Ojitos Lindos';
  const previewArtist = currentTrack?.artists?.map((a) => a.name).join(', ') || 'Bad Bunny, Bomba Estéreo';
  const previewAlbum = currentTrack?.album?.name || 'Un Verano Sin Ti';
  const previewCover = currentTrack ? (resolveTrackCover(currentTrack) || currentTrack.album?.images?.[0]?.url) : 'https://i.scdn.co/image/ab67616d0000b27349d694203245f241a1bcaa70';

  const durationSec = Math.floor((currentTrack?.duration_ms || 258000) / 1000);
  const currentSec = Math.min(durationSec, Math.floor((progressMs || 74000) / 1000));
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };
  const progressPercent = Math.min(100, Math.max(0, (currentSec / durationSec) * 100));

  return (
    <section className="space-y-4 font-['SpotifyMixUI']">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Discord Icon */}
          <div className="w-10 h-10 rounded-xl bg-[#5865F2]/20 border border-[#5865F2]/30 flex items-center justify-center shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#5865F2">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white font-['SpotifyMixUITitle']">Discord Rich Presence</h3>
            <p className="text-xs text-[#a7a7a7]">
              Muestra automáticamente tu música en tu perfil de Discord con carátula, artista y progreso en tiempo real.
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled(!enabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            enabled ? 'bg-[#1ed760]' : 'bg-[#535353]'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="space-y-4">
          {/* Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#181818] border border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              {discordConnected ? (
                <>
                  <span className="relative flex w-3 h-3">
                    <span className="absolute inline-flex w-full h-full rounded-full bg-[#1ed760] opacity-75 animate-ping" />
                    <span className="relative inline-flex w-3 h-3 rounded-full bg-[#1ed760]" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-white">Sincronizado con Discord</p>
                    <p className="text-[11px] text-[#1ed760]">Tu música se está transmitiendo en directo a tu perfil</p>
                  </div>
                </>
              ) : bridgeActive ? (
                <>
                  <span className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                  <div>
                    <p className="text-xs font-bold text-white">Puente local activo</p>
                    <p className="text-[11px] text-[#a7a7a7]">Abre tu aplicación de Discord en tu PC para enlazar</p>
                  </div>
                </>
              ) : (
                <>
                  <span className="w-3 h-3 rounded-full bg-[#535353]" />
                  <div>
                    <p className="text-xs font-bold text-[#b3b3b3]">Puente local no detectado</p>
                    <p className="text-[11px] text-[#a7a7a7]">Ejecuta en tu terminal: <code className="text-[#1ed760] font-mono">npm run discord</code> o inicia el servidor</p>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={handleManualCheck}
              disabled={isChecking}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 hover:bg-white/15 active:scale-95 text-white transition-all cursor-pointer disabled:opacity-50"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={isChecking ? 'animate-spin' : ''}
              >
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
              </svg>
              {isChecking ? 'Comprobando...' : 'Comprobar'}
            </button>
          </div>

          {/* Interactive Discord Profile Card Preview */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-[#b3b3b3] uppercase tracking-wider">
              Vista previa en tu perfil de Discord
            </span>

            <div className={`rounded-2xl bg-[#2b2d31] border border-white/[0.08] p-4 text-white shadow-xl ${variant === 'mobile' ? 'w-full' : 'max-w-md'}`}>
              {/* Discord Header */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[11px] font-extrabold text-[#949ba4] tracking-wider uppercase">
                  Escuchando a Spotify
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isPlaying ? 'bg-[#1ed760]/20 text-[#1ed760]' : 'bg-white/10 text-[#a7a7a7]'}`}>
                  {isPlaying ? 'EN DIRECTO' : 'EN PAUSA'}
                </span>
              </div>

              {/* Body */}
              <div className="flex gap-3.5 items-start">
                {/* Album Cover Thumbnail with Spotifree badge */}
                <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-[#1e1f22] border border-white/10 shadow-md">
                  <img
                    src={previewCover}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://spotifree.app/icon-512.png';
                    }}
                  />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#1ed760] flex items-center justify-center p-0.5 shadow-md">
                    <svg viewBox="0 0 24 24" fill="black" className="w-3.5 h-3.5">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 12l8-5v10z" fill="#121212" />
                    </svg>
                  </div>
                </div>

                {/* Song info */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-white truncate hover:underline cursor-pointer">
                    {previewTitle}
                  </h4>
                  <p className="text-xs text-[#dbdee1] truncate mt-0.5">
                    de {previewArtist}
                  </p>
                  <p className="text-xs text-[#949ba4] truncate mt-0.5">
                    en {previewAlbum}
                  </p>
                </div>
              </div>

              {/* Progress timeline */}
              <div className="mt-3.5 pt-3 border-t border-white/[0.06] space-y-1.5">
                <div className="w-full h-1 bg-[#4e5058] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-[#949ba4] font-mono">
                  <span>{formatTime(currentSec)}</span>
                  <span>{formatTime(durationSec)}</span>
                </div>
              </div>

              {/* Discord Button */}
              <div className="mt-3">
                <div className="w-full py-1.5 px-3 rounded-md bg-[#4e5058]/40 hover:bg-[#4e5058]/60 text-xs font-semibold text-center text-white cursor-pointer transition-colors border border-white/[0.06]">
                  Escuchar en Spotifree
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Accordion for Custom Discord Application ID */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-[#a7a7a7] hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform duration-200 ${showAdvanced ? 'rotate-90' : ''}`}
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
              Opciones avanzadas (Personalizar Client ID de Discord)
            </button>

            {showAdvanced && (
              <div className="mt-2.5 p-3.5 rounded-xl bg-[#181818] border border-white/[0.06] space-y-2.5 animate-in fade-in duration-200">
                <p className="text-xs text-[#a7a7a7]">
                  Por defecto, Spotifree utiliza el ID oficial de música para mostrar la presencia automáticamente. Si has creado tu propia aplicación en <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" className="text-[#1ed760] underline">Discord Developer Portal</a> llamada "Spotifree", pega tu Application ID aquí:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customIdInput}
                    onChange={(e) => setCustomIdInput(e.target.value)}
                    placeholder="714912685713424424"
                    className="flex-1 bg-[#121212] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[#1ed760]"
                  />
                  <button
                    type="button"
                    onClick={handleSaveClientId}
                    className="px-3 py-1.5 rounded-lg bg-[#1ed760] text-black text-xs font-bold hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
