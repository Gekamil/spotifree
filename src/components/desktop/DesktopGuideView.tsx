import React, { useState } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';

export const DesktopGuideView: React.FC = () => {
  const { setActiveMainTab } = useUIStore();

  const [cookieInput, setCookieInput] = useState<string>(() => {
    return typeof window !== 'undefined'
      ? window.localStorage.getItem('user_spotify_cookie') || ''
      : '';
  });
  const [playlistUrlInput, setPlaylistUrlInput] = useState('');
  const [cookieSaved, setCookieSaved] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const handleSaveCookie = async () => {
    const val = cookieInput.trim();
    if (!val) return;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('user_spotify_cookie', val);
      setCookieSaved(true);
      setTimeout(() => setCookieSaved(false), 4000);
    }
    // Initialize session with saved cookie
    await useSpotifyDataStore.getState().initialize();
  };

  const handleImportPlaylist = async () => {
    const raw = playlistUrlInput.trim();
    if (!raw) return;

    // Extract playlist ID from URL or bare ID
    const match = raw.match(/playlist\/([a-zA-Z0-9]+)/) || raw.match(/^([a-zA-Z0-9]{22})$/);
    const id = match ? match[1] : raw;

    setImporting(true);
    setImportMessage(null);

    try {
      const res = await fetch(`/api/spotify/playlist/${encodeURIComponent(id)}`);
      if (res.ok) {
        const playlist = await res.json();
        if (playlist && playlist.name) {
          useSpotifyDataStore.getState().cachePlaylistDetails(playlist);
          const currentList = useSpotifyDataStore.getState().playlists;
          if (!currentList.some((p) => p.id === playlist.id)) {
            const updated = [playlist, ...currentList];
            useSpotifyDataStore.setState({
              playlists: updated,
              isAuthenticated: true,
            });
            if (typeof window !== 'undefined') {
              window.localStorage.setItem('user_imported_playlists', JSON.stringify(updated));
            }
          }
          setImportMessage(`Lista importada con éxito: ${playlist.name}`);
          setPlaylistUrlInput('');
          return;
        }
      }
      setImportMessage('No se pudo cargar la lista. Comprueba que el enlace sea correcto y público.');
    } catch (err: any) {
      setImportMessage('Error de red al importar la lista.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="select-none min-h-full pb-24 bg-[#121212] px-8 pt-6 space-y-8 font-['SpotifyMixUI',-apple-system,BlinkMacSystemFont,system-ui,sans-serif]">
      {/* Top Bar Navigation inside Main Panel */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setActiveMainTab('home')}
          className="w-8 h-8 rounded-full bg-black/60 hover:bg-black text-[#b3b3b3] hover:text-white flex items-center justify-center transition-all cursor-pointer"
          title="Volver al inicio"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11.03.47a.75.75 0 0 1 0 1.06L4.56 8l6.47 6.47a.75.75 0 1 1-1.06 1.06L2.44 8 9.97.47a.75.75 0 0 1 1.06 0" />
          </svg>
        </button>
        <span className="text-xs font-bold text-[#b3b3b3] tracking-wider uppercase">
          Ayuda y conexión de cuenta
        </span>
      </div>

      {/* Hero Header */}
      <div className="space-y-2 border-b border-white/5 pb-6">
        <h1 className="text-3xl font-extrabold text-white tracking-tight font-['SpotifyMixUITitle']">
          Conexión con Spotify
        </h1>
        <p className="text-sm text-[#b3b3b3] max-w-2xl leading-relaxed">
          Para sincronizar tu biblioteca y tus listas de reproducción sin restricciones, puedes conectar tu sesión de Spotify mediante la cookie segura de navegación o importar directamente enlaces de tus listas.
        </p>
      </div>

      {/* Method 1: Cookie sp_dc (Spotube Method) */}
      <div className="bg-[#181818] rounded-xl p-6 border border-white/5 space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/10 text-white">
              Método 1
            </span>
            <h2 className="text-lg font-bold text-white font-['SpotifyMixUITitle']">
              Sincronización por cookie de sesión (sp_dc)
            </h2>
          </div>
          <p className="text-xs text-[#b3b3b3] leading-relaxed">
            Este método consulta la API del reproductor web de Spotify sin restricciones de cuenta de desarrollador. Tu cookie se guarda exclusivamente en el almacenamiento local de tu navegador.
          </p>
        </div>

        {/* Numbered Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-[#1f1f1f] p-4 rounded-lg flex items-start gap-3 border border-white/5">
            <span className="w-6 h-6 rounded-full bg-white text-black font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
              1
            </span>
            <div className="text-xs space-y-1">
              <p className="font-bold text-white">Inicia sesión en Spotify Web</p>
              <p className="text-[#a7a7a7] leading-relaxed">
                Abre una pestaña en tu navegador e inicia sesión en <span className="text-white font-mono">open.spotify.com</span>.
              </p>
            </div>
          </div>

          <div className="bg-[#1f1f1f] p-4 rounded-lg flex items-start gap-3 border border-white/5">
            <span className="w-6 h-6 rounded-full bg-white text-black font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
              2
            </span>
            <div className="text-xs space-y-1">
              <p className="font-bold text-white">Abre las Herramientas de desarrollador</p>
              <p className="text-[#a7a7a7] leading-relaxed">
                Pulsa la tecla <kbd className="bg-[#2a2a2a] px-1.5 py-0.5 rounded text-white font-mono">F12</kbd> (o clic derecho en cualquier lugar y elige <em>Inspeccionar</em>).
              </p>
            </div>
          </div>

          <div className="bg-[#1f1f1f] p-4 rounded-lg flex items-start gap-3 border border-white/5">
            <span className="w-6 h-6 rounded-full bg-white text-black font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
              3
            </span>
            <div className="text-xs space-y-1">
              <p className="font-bold text-white">Accede a la sección de Cookies</p>
              <p className="text-[#a7a7a7] leading-relaxed">
                Ve a la pestaña <strong>Aplicación</strong> (o <strong>Almacenamiento</strong> en Firefox), despliega <strong>Cookies</strong> y haz clic en <span className="text-white font-mono">https://open.spotify.com</span>.
              </p>
            </div>
          </div>

          <div className="bg-[#1f1f1f] p-4 rounded-lg flex items-start gap-3 border border-white/5">
            <span className="w-6 h-6 rounded-full bg-white text-black font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
              4
            </span>
            <div className="text-xs space-y-1">
              <p className="font-bold text-white">Copia el valor de sp_dc</p>
              <p className="text-[#a7a7a7] leading-relaxed">
                Encuentra la fila con nombre <code className="bg-[#2a2a2a] text-[#1ed760] px-1 rounded font-mono">sp_dc</code>, haz doble clic sobre su valor y cópialo.
              </p>
            </div>
          </div>
        </div>

        {/* Direct Paste & Save Input */}
        <div className="pt-2 border-t border-white/5 space-y-3">
          <label className="text-xs font-bold text-[#b3b3b3] block">
            Pegar cookie de sesión (sp_dc)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={cookieInput}
              onChange={(e) => setCookieInput(e.target.value)}
              placeholder="AQD..."
              className="flex-1 bg-[#121212] border border-white/10 rounded-md px-3.5 py-2 text-xs text-white placeholder:text-[#666] outline-none focus:border-white transition-colors"
            />
            <button
              onClick={handleSaveCookie}
              className="bg-white hover:bg-[#f0f0f0] active:scale-98 text-black text-xs font-bold px-5 py-2 rounded-full transition-transform shrink-0 cursor-pointer shadow"
            >
              Conectar y guardar
            </button>
          </div>
          {cookieSaved && (
            <p className="text-xs font-semibold text-[#1ed760] animate-in fade-in">
              Cookie guardada correctamente en este dispositivo.
            </p>
          )}
        </div>
      </div>

      {/* Method 2: Import by Link (Instant) */}
      <div className="bg-[#181818] rounded-xl p-6 border border-white/5 space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/10 text-white">
              Método 2
            </span>
            <h2 className="text-lg font-bold text-white font-['SpotifyMixUITitle']">
              Importar lista de Spotify por enlace directo
            </h2>
          </div>
          <p className="text-xs text-[#b3b3b3] leading-relaxed">
            Sin necesidad de extraer cookies ni configurar claves. Abre cualquier lista en Spotify, copia el enlace para compartir y pégalo a continuación.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={playlistUrlInput}
              onChange={(e) => setPlaylistUrlInput(e.target.value)}
              placeholder="https://open.spotify.com/playlist/..."
              className="flex-1 bg-[#121212] border border-white/10 rounded-md px-3.5 py-2 text-xs text-white placeholder:text-[#666] outline-none focus:border-white transition-colors"
            />
            <button
              onClick={handleImportPlaylist}
              disabled={importing}
              className="bg-[#1ed760] hover:bg-[#1fdf64] active:scale-98 text-black text-xs font-bold px-5 py-2 rounded-full transition-transform shrink-0 cursor-pointer shadow disabled:opacity-50"
            >
              {importing ? 'Importando...' : 'Importar lista'}
            </button>
          </div>

          {importMessage && (
            <p className="text-xs font-semibold text-[#1ed760] animate-in fade-in">
              {importMessage}
            </p>
          )}
        </div>
      </div>

      {/* Navigation back to Settings */}
      <div className="flex justify-start">
        <button
          onClick={() => setActiveMainTab('settings')}
          className="text-xs font-bold text-[#b3b3b3] hover:text-white transition-colors flex items-center gap-2 py-2"
        >
          <span>Ir a Configuración avanzada</span>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.97 11.03a.75.75 0 0 0 1.06 0L8 8.56l1.97 2.47a.75.75 0 1 0 1.06-1.06L8.56 7.5l2.47-1.97a.75.75 0 0 0-1.06-1.06L7.5 6.94 5.53 4.47a.75.75 0 0 0-1.06 1.06L6.94 7.5 4.47 9.97a.75.75 0 0 0 0 1.06z" />
          </svg>
        </button>
      </div>
    </div>
  );
};
