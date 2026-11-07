import { useEffect, useState } from 'react';
import { importExternalPlaylist } from '../../utils/playlistImporter';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { showGlobalToast } from '../../utils/globalToast';
import { CloseNativeIcon, ImportNativeIcon, PasteNativeIcon } from '../icons/SpotifyNativeIcons';

export const IMPORT_PLAYLIST_EVENT = 'spotifree:open-import-playlist';
export function openImportPlaylistDialog() {
  window.dispatchEvent(new CustomEvent(IMPORT_PLAYLIST_EVENT));
}

const SOURCES = ['YouTube Music', 'YouTube', 'Apple Music', 'Spotify'];

/** Desktop "Importar playlist", styled like Spotify's "Editar información" dialog */
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

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(text.trim());
    } catch {
      setError('No se pudo leer el portapapeles. Pega el enlace con Ctrl+V.');
    }
  };

  return (
    <div className="fixed inset-0 z-[2500] flex items-center justify-center bg-black/70 font-['SpotifyMixUI']" onClick={() => !busy && setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-playlist-title"
        onClick={(e) => e.stopPropagation()}
        className="w-[524px] max-w-[92vw] rounded-lg bg-[#282828] p-6 shadow-[0_4px_60px_rgba(0,0,0,.5)] text-white animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between">
          <h2 id="import-playlist-title" className="text-[24px] font-bold tracking-tight font-['SpotifyMixUITitle']">
            Importar playlist
          </h2>
          <button
            onClick={() => setOpen(false)}
            disabled={busy}
            aria-label="Cerrar"
            className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-[#b3b3b3] hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
          >
            <CloseNativeIcon size={16} />
          </button>
        </div>

        <div className="mt-4 flex gap-4">
          <div className="w-[120px] h-[120px] shrink-0 rounded-[4px] bg-[#3e3e3e] shadow-[0_4px_60px_rgba(0,0,0,.5)] flex items-center justify-center text-[#7f7f7f]">
            <ImportNativeIcon size={48} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] text-[#b3b3b3] leading-snug">
              Pega el enlace de una playlist o un álbum, o escribe canciones, una por línea («Canción - Artista»).
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {SOURCES.map((s) => (
                <span key={s} className="px-2.5 py-0.5 rounded-full bg-white/[0.07] text-[12px] font-bold text-white/85">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="relative mt-4">
          <textarea
            autoFocus
            rows={3}
            value={url}
            disabled={busy}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && /^https?:\/\//.test(url.trim())) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="https://music.youtube.com/playlist?list=…"
            className="block w-full resize-none rounded-[4px] border border-transparent bg-[#3e3e3e] px-3 py-2.5 pr-24 text-[14px] text-white outline-none placeholder:text-[#8a8a8a] focus:border-[#535353] focus:bg-[#333] transition-colors"
          />
          <button
            onClick={() => void paste()}
            disabled={busy}
            className="absolute right-2 bottom-2 flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-bold text-white/90 hover:text-white hover:bg-white/10 disabled:opacity-40"
          >
            <PasteNativeIcon size={14} />
            Pegar
          </button>
        </div>

        {busy && (
          <div className="mt-3 space-y-1.5">
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full bg-[#1ed760] transition-all duration-300"
                style={{ width: progress ? `${(progress[0] / Math.max(1, progress[1])) * 100}%` : '6%' }}
              />
            </div>
            <p className="text-[12px] tabular-nums text-[#b3b3b3]">
              {progress ? `Buscando canciones ${progress[0]} de ${progress[1]}` : 'Leyendo la playlist…'}
            </p>
          </div>
        )}
        {error && <p className="mt-3 text-[14px] text-[#f3727f]">{error}</p>}

        <div className="mt-5 flex items-center justify-between gap-4">
          <p className="text-[11px] text-[#a7a7a7] leading-snug">
            Las canciones que no estén en el catálogo se guardan igual y se pueden escuchar.
          </p>
          <button
            onClick={() => void submit()}
            disabled={busy || !url.trim()}
            className="shrink-0 h-12 px-8 rounded-full bg-white text-black text-[16px] font-bold hover:scale-[1.04] active:scale-100 transition-transform disabled:opacity-50 disabled:hover:scale-100"
          >
            {busy ? 'Importando…' : 'Importar'}
          </button>
        </div>
      </div>
    </div>
  );
}
