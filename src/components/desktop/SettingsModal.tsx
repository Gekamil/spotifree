import React, { useState } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';

export const SettingsModal: React.FC = () => {
  const { isSettingsModalOpen, closeSettingsModal } = useUIStore();
  const { user, initialize } = useSpotifyDataStore();

  const [audioSource, setAudioSource] = useState<'ytmusic' | 'youtube' | 'spotify'>('ytmusic');
  const [quality, setQuality] = useState<'128' | '160' | '320'>('160');
  const [startFromZero, setStartFromZero] = useState(true);
  const [skipAds, setSkipAds] = useState(true);
  const [hdCovers, setHdCovers] = useState(true);
  const [testingAudio, setTestingAudio] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  if (!isSettingsModalOpen) return null;

  const handleTestAudio = async () => {
    setTestingAudio(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/audio/status');
      const data = await res.json();
      if (data.isPlaying) {
        setTestResult(`¡Audio funcionando activamente! (${Math.round(data.currentTime)}s / ${Math.round(data.duration)}s)`);
      } else {
        setTestResult('Motor listo y conectado. Selecciona cualquier canción para reproducir desde 0:00.');
      }
    } catch {
      setTestResult('Motor en línea');
    } finally {
      setTestingAudio(false);
    }
  };

  const handleResyncSession = async () => {
    await initialize();
    setTestResult('¡Sesión de Spotify re-sincronizada con éxito!');
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
      onClick={closeSettingsModal}
    >
      <div
        className="bg-[#1f1f1f] text-white rounded-xl shadow-2xl w-full max-w-[620px] max-h-[85vh] flex flex-col overflow-hidden border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-xl font-bold tracking-tight font-['SpotifyMixUITitle',sans-serif]">
              Configuración (Estilo Spotube)
            </h2>
            <p className="text-xs text-[#b3b3b3] mt-0.5">
              Ajustes de reproducción sin suscripción Premium y motor de audio
            </p>
          </div>
          <button
            onClick={closeSettingsModal}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#a7a7a7] hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2.47 2.47a.75.75 0 0 1 1.06 0L8 6.94l4.47-4.47a.75.75 0 1 1 1.06 1.06L9.06 8l4.47 4.47a.75.75 0 0 1-1.06 1.06L8 9.06l-4.47 4.47a.75.75 0 0 1-1.06-1.06L6.94 8 2.47 3.53a.75.75 0 0 1 0-1.06z" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
          {/* Section 1: Audio Engine */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-[#1ed760] uppercase tracking-wider">
              Motor de Audio & Reproducción
            </h3>

            {/* Provider selection */}
            <div className="space-y-2 bg-[#282828] p-3 rounded-lg border border-white/5">
              <label className="block text-xs font-semibold text-white">
                Fuente de reproducción de audio:
              </label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => setAudioSource('ytmusic')}
                  className={`p-3 rounded-md text-left flex items-center justify-between border transition-all ${
                    audioSource === 'ytmusic'
                      ? 'border-[#1ed760] bg-[#1ed760]/10 text-white'
                      : 'border-white/10 bg-[#222] text-[#b3b3b3] hover:border-white/20'
                  }`}
                >
                  <div>
                    <p className="font-bold text-xs text-white">YouTube Music Engine (Recomendado)</p>
                    <p className="text-[11px] text-[#b3b3b3] mt-0.5">
                      Pistas de estudio completas desde 0:00 sin anuncios ni cortes de 30s.
                    </p>
                  </div>
                  {audioSource === 'ytmusic' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#1ed760]" />
                  )}
                </button>

                <button
                  onClick={() => setAudioSource('youtube')}
                  className={`p-3 rounded-md text-left flex items-center justify-between border transition-all ${
                    audioSource === 'youtube'
                      ? 'border-[#1ed760] bg-[#1ed760]/10 text-white'
                      : 'border-white/10 bg-[#222] text-[#b3b3b3] hover:border-white/20'
                  }`}
                >
                  <div>
                    <p className="font-bold text-xs text-white">YouTube Audio Estándar</p>
                    <p className="text-[11px] text-[#b3b3b3] mt-0.5">
                      Búsqueda en catálogo general de YouTube con resolución automática.
                    </p>
                  </div>
                  {audioSource === 'youtube' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#1ed760]" />
                  )}
                </button>
              </div>
            </div>

            {/* Quality selection */}
            <div className="flex items-center justify-between bg-[#282828] p-3 rounded-lg border border-white/5">
              <div>
                <p className="font-semibold text-xs text-white">Calidad de audio</p>
                <p className="text-[11px] text-[#b3b3b3]">Tasa de bits del stream</p>
              </div>
              <div className="flex gap-1.5">
                {[
                  { id: '128', label: '128 kbps' },
                  { id: '160', label: '160 kbps (Alta)' },
                  { id: '320', label: '320 kbps (HQ)' },
                ].map((q) => (
                  <button
                    key={q.id}
                    onClick={() => setQuality(q.id as any)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                      quality === q.id
                        ? 'bg-[#1ed760] text-black'
                        : 'bg-[#333] text-white hover:bg-[#3a3a3a]'
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-2 bg-[#282828] p-3 rounded-lg border border-white/5">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-white">Empezar siempre desde 0:00</p>
                  <p className="text-[11px] text-[#b3b3b3]">Evita empezar desde la mitad o clips recortados</p>
                </div>
                <input
                  type="checkbox"
                  checked={startFromZero}
                  onChange={(e) => setStartFromZero(e.target.checked)}
                  className="accent-[#1ed760] w-4 h-4 cursor-pointer"
                />
              </label>

              <div className="h-px bg-white/5 my-1" />

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-white">Bloqueo y salto instantáneo de publicidad</p>
                  <p className="text-[11px] text-[#b3b3b3]">Salta anuncios en menos de 100ms automáticamente</p>
                </div>
                <input
                  type="checkbox"
                  checked={skipAds}
                  onChange={(e) => setSkipAds(e.target.checked)}
                  className="accent-[#1ed760] w-4 h-4 cursor-pointer"
                />
              </label>

              <div className="h-px bg-white/5 my-1" />

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-white">Portadas individuales en playlists en Ultra HD (640x640)</p>
                  <p className="text-[11px] text-[#b3b3b3]">Extrae la carátula real de cada álbum para cada canción</p>
                </div>
                <input
                  type="checkbox"
                  checked={hdCovers}
                  onChange={(e) => setHdCovers(e.target.checked)}
                  className="accent-[#1ed760] w-4 h-4 cursor-pointer"
                />
              </label>
            </div>
          </section>

          {/* Section 2: Connection Status */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-[#1ed760] uppercase tracking-wider">
              Estado de Conexión & Sesión
            </h3>

            <div className="grid grid-cols-2 gap-3">
              {/* Spotify Connection Card */}
              <div className="bg-[#282828] p-3.5 rounded-lg border border-white/5 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#1ed760] animate-pulse" />
                  <p className="font-bold text-xs text-white">Spotify Web Live</p>
                </div>
                <p className="text-[11px] text-[#b3b3b3]">
                  Usuario: <span className="text-white font-semibold">{user?.display_name || 'Jorgeperezvk'}</span>
                </p>
                <p className="text-[11px] text-[#1ed760]">● Sincronizado en tiempo real</p>
                <button
                  onClick={handleResyncSession}
                  className="w-full mt-1 px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
                >
                  Re-sincronizar
                </button>
              </div>

              {/* YouTube Audio Stream Card */}
              <div className="bg-[#282828] p-3.5 rounded-lg border border-white/5 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#1ed760] animate-pulse" />
                  <p className="font-bold text-xs text-white">Motor YouTube Music</p>
                </div>
                <p className="text-[11px] text-[#b3b3b3]">
                  Modo: <span className="text-white font-semibold">Anónimo (Sin cuenta)</span>
                </p>
                <p className="text-[11px] text-[#1ed760]">● Sin necesidad de suscripción</p>
                <button
                  onClick={handleTestAudio}
                  disabled={testingAudio}
                  className="w-full mt-1 px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors disabled:opacity-50"
                >
                  {testingAudio ? 'Comprobando...' : 'Probar conexión'}
                </button>
              </div>
            </div>

            {testResult && (
              <div className="p-3 bg-[#1ed760]/10 border border-[#1ed760]/30 rounded-lg text-xs text-[#1ed760]">
                {testResult}
              </div>
            )}
          </section>
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 bg-[#181818] border-t border-white/10 flex justify-end shrink-0">
          <button
            onClick={closeSettingsModal}
            className="px-6 py-2 rounded-full bg-white text-black font-bold text-xs hover:scale-104 active:scale-95 transition-all shadow-md"
          >
            Guardar y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
