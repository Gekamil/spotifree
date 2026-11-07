import { useEffect, useState } from 'react';
import { importExternalPlaylist } from '../../utils/playlistImporter';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { showGlobalToast } from '../../utils/globalToast';

export const IMPORT_PLAYLIST_EVENT = 'spotifree:open-import-playlist';
export function openImportPlaylistDialog() {
  window.dispatchEvent(new CustomEvent(IMPORT_PLAYLIST_EVENT));
}

/** Desktop "Importar playlist" (the phone uses the same importer from its Crear sheet) */
export default function ImportPlaylistDialog() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<[number, number] | null>(null);

  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      setError(null);
    };
    window.addEventListener(IMPORT_PLAYLIST_EVENT, onOpen);
    return () => window.removeEventListener(IMPORT_PLAYLIST_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy]);

  if (!open) return null;

  const submit = async () => {
    if (!url.trim() || busy) return;
    setBusy(true);
    setError(null);
    setProgress(null);
    const user = useSpotifyDataStore.getState().user;
    const res = await importExternalPlaylist(url.trim(), user || undefined, (d, t) => setProgress([d, t]));
    setBusy(false);
    setProgress(null);
    if (!res.success || !res.playlist) {
      setError(res.error || 'No se pudo importar la playlist.');
      return;
    }
    useSpotifyDataStore.getState().addCustomPlaylist(res.playlist);
    window.dispatchEvent(new CustomEvent('spotifree_open_playlist', { detail: res.playlist }));
    if (typeof res.total === 'number' && typeof res.matched === 'number') {
      showGlobalToast(`«${res.playlist.name}»: ${res.matched} de ${res.total} canciones encontradas`);
    }
    setUrl('');
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[2500] flex items-center justify-center bg-black/60" onClick={() => !busy && setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-[480px] max-w-[92vw] rounded-lg bg-[#282828] p-6 shadow-[0_16px_48px_rgba(0,0,0,.6)] text-white"
      >
        <h2 className="text-2xl font-bold">Importar playlist</h2>
        <p className="mt-1 text-sm text-[#b3b3b3]">
          Pega el enlace de una playlist de YouTube Music, YouTube, Apple Music o Spotify, o escribe canciones línea por línea («Canción - Artista»).
        </p>
        <textarea
          autoFocus
          rows={3}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && /^https?:\/\//.test(url.trim())) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="https://music.youtube.com/playlist?list=..."
          className="mt-4 w-full resize-none rounded bg-[#3e3e3e] px-3 py-2 text-sm text-white outline-none placeholder:text-[#8a8a8a] focus:ring-1 focus:ring-white/40"
        />
        {error && <p className="mt-2 text-sm text-[#f3727f]">{error}</p>}
        {busy && (
          <div className="mt-3 space-y-1.5">
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full bg-[#1ed760] transition-all duration-300"
                style={{ width: progress ? `${(progress[0] / Math.max(1, progress[1])) * 100}%` : '8%' }}
              />
            </div>
            <p className="text-xs tabular-nums text-[#b3b3b3]">
              {progress ? `Buscando canciones ${progress[0]} de ${progress[1]}` : 'Leyendo la playlist…'}
            </p>
          </div>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={() => setOpen(false)}
            disabled={busy}
            className="rounded-full px-5 py-2 text-sm font-bold text-[#b3b3b3] hover:text-white disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={() => void submit()}
            disabled={busy || !url.trim()}
            className="rounded-full bg-[#1ed760] px-6 py-2 text-sm font-bold text-black hover:scale-[1.03] hover:bg-[#3be477] disabled:opacity-50 disabled:hover:scale-100"
          >
            {busy ? 'Importando…' : 'Importar'}
          </button>
        </div>
      </div>
    </div>
  );
}
