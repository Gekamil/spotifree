import { useEffect, useRef, useState } from 'react';
import type { Track } from '../../types/spotify';
import { STORY_CARD_EVENT, renderStoryCard, type StoryBackground } from '../../utils/storyCard';
import { fetchLyricsUnified, parseEnhancedLyrics } from '../../utils/lyricsService';
import { extractDominantColorFromImage } from '../../utils/spotifyColor';
import { isNativeMediaAvailable, shareImageNative } from '../../services/nativeMedia';
import { showGlobalToast } from '../../utils/globalToast';
import { useLanguageStore } from '../../utils/i18n';
import { useIsMobile } from '../../utils/useIsMobile';

const MAX_LINES = 4;

/** "Compartir en stories": pick lyric lines and a background, then share the image */
export default function StoryCardSheet() {
  const [track, setTrack] = useState<Track | null>(null);
  const [lines, setLines] = useState<string[] | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [bg, setBg] = useState<StoryBackground>('color');
  const [color, setColor] = useState('#1db954');
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const en = useLanguageStore((s) => s.language) === 'en';
  const isMobile = useIsMobile();

  useEffect(() => {
    const onOpen = (e: Event) => {
      const t = (e as CustomEvent).detail?.track as Track | undefined;
      if (!t) return;
      setTrack(t);
      setLines(null);
      setPicked([]);
      setPreview(null);
      setBg('color');
      void extractDominantColorFromImage(t.album?.images?.[0]?.url).then((hex) => hex && setColor(hex));
      void fetchLyricsUnified(t.name, t.artists?.[0]?.name || '', (t.duration_ms || 0) / 1000)
        .then((res) => {
          const raw = res.syncedLyrics
            ? parseEnhancedLyrics(res.syncedLyrics).map((l) => l.text)
            : String(res.plainLyrics || '').split('\n');
          const clean: string[] = [];
          for (const l of raw.map((x) => (x || '').trim()).filter(Boolean)) if (clean[clean.length - 1] !== l) clean.push(l);
          setLines(clean);
        })
        .catch(() => setLines([]));
    };
    window.addEventListener(STORY_CARD_EVENT, onOpen);
    return () => window.removeEventListener(STORY_CARD_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!track) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setTrack(null);
    const onBack = (e: Event) => {
      (e as CustomEvent).detail?.setHandled?.();
      setTrack(null);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('spotifree_android_back', onBack);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('spotifree_android_back', onBack);
    };
  }, [track]);

  // Re-draw the preview when something changes
  useEffect(() => {
    if (!track) return;
    let cancelled = false;
    const chosen = [...picked].sort((a, b) => a - b).map((i) => (lines || [])[i]).filter(Boolean);
    void renderStoryCard({ track, color, background: bg, lyricLines: chosen }).then((c) => {
      if (cancelled) return;
      canvasRef.current = c;
      try {
        setPreview(c.toDataURL('image/jpeg', 0.82));
      } catch {
        setPreview(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [track, picked, bg, color, lines]);

  if (!track) return null;

  const toggleLine = (i: number) => {
    setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : p.length >= MAX_LINES ? p : [...p, i]));
  };

  const fileName = `${(track.name || 'cancion').replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40)}-spotifree.png`;
  const shareText = `${track.name} · ${(track.artists || []).map((a) => a.name).join(', ')} — en Spotifree`;

  const download = (dataUrl: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const share = async (mode: 'share' | 'save') => {
    const c = canvasRef.current;
    if (!c) return;
    setBusy(true);
    try {
      const png = c.toDataURL('image/png');
      if (mode === 'share' && isNativeMediaAvailable()) {
        if (await shareImageNative(png.split(',')[1], shareText)) return;
      }
      if (mode === 'share' && navigator.canShare) {
        const blob = await (await fetch(png)).blob();
        const file = new File([blob], fileName, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: shareText });
          return;
        }
      }
      download(png);
      showGlobalToast(en ? 'Image saved' : 'Imagen guardada');
    } catch (e: any) {
      if (e?.name !== 'AbortError') showGlobalToast(en ? 'Could not share the image' : 'No se pudo compartir la imagen');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[2500] bg-black/70 ${isMobile ? 'flex items-end' : 'flex items-center justify-center'}`}
      onClick={() => setTrack(null)}
    >
      <div
        translate="no"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={
          isMobile
            ? 'w-full max-h-[94vh] overflow-y-auto rounded-t-2xl bg-[#1f1f1f] pb-[calc(env(safe-area-inset-bottom,0px)+16px)] animate-slide-up-modal'
            : 'w-[760px] max-h-[88vh] overflow-hidden rounded-lg bg-[#282828] shadow-[0_16px_48px_rgba(0,0,0,.6)] flex'
        }
      >
        {isMobile && <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-white/25" />}
        <div className={isMobile ? 'px-5 pt-3' : 'w-[300px] shrink-0 bg-black/30 p-5 flex items-center justify-center'}>
          <div className={`mx-auto overflow-hidden rounded-xl bg-black/40 ${isMobile ? 'w-[46%]' : 'w-full'}`} style={{ aspectRatio: '9 / 16' }}>
            {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full animate-pulse bg-white/5" />}
          </div>
        </div>
        <div className={isMobile ? 'px-5 pt-4' : 'flex-1 min-w-0 p-6 flex flex-col'}>
          <h2 className="text-[20px] font-bold text-white">{en ? 'Share to stories' : 'Compartir en stories'}</h2>
          <p className="mt-0.5 text-[13px] text-[#b3b3b3]">
            {en ? `Pick up to ${MAX_LINES} lyric lines (optional).` : `Elige hasta ${MAX_LINES} líneas de la letra (opcional).`}
          </p>

          <div className="mt-3 inline-flex p-1 rounded-full bg-[#2a2a2a] self-start">
            {(['color', 'cover'] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBg(b)}
                className={`h-8 px-4 rounded-full text-[13px] font-bold transition-colors ${bg === b ? 'bg-white text-black' : 'text-[#b3b3b3] hover:text-white'}`}
              >
                {b === 'color' ? (en ? 'Colour' : 'Color') : en ? 'Cover' : 'Portada'}
              </button>
            ))}
          </div>

          <div className={`mt-3 space-y-1 overflow-y-auto pr-1 ${isMobile ? 'max-h-[34vh]' : 'flex-1 min-h-0'}`}>
            {lines === null ? (
              [0, 1, 2, 3].map((i) => <div key={i} className="h-9 animate-pulse rounded bg-white/5" />)
            ) : lines.length === 0 ? (
              <p className="py-4 text-[13px] text-[#b3b3b3]">{en ? 'No lyrics for this song.' : 'Esta canción no tiene letra.'}</p>
            ) : (
              lines.map((l, i) => {
                const on = picked.includes(i);
                return (
                  <button
                    key={i}
                    onClick={() => toggleLine(i)}
                    className={`block w-full rounded-md px-3 py-2 text-left text-[15px] font-bold transition-colors ${
                      on ? 'bg-white text-black' : 'text-white/80 hover:bg-white/[0.07]'
                    }`}
                  >
                    {l}
                  </button>
                );
              })
            )}
          </div>

          <div className={`flex gap-3 ${isMobile ? 'mt-4' : 'mt-5 justify-end'}`}>
            <button
              onClick={() => void share('save')}
              disabled={busy || !preview}
              className={`rounded-full border border-white/30 px-5 py-2.5 text-[14px] font-bold text-white hover:border-white disabled:opacity-50 ${isMobile ? 'flex-1' : ''}`}
            >
              {en ? 'Save' : 'Guardar'}
            </button>
            <button
              onClick={() => void share('share')}
              disabled={busy || !preview}
              className={`rounded-full bg-[#1ed760] px-6 py-2.5 text-[14px] font-bold text-black hover:bg-[#3be477] disabled:opacity-50 ${isMobile ? 'flex-1' : ''}`}
            >
              {busy ? '…' : en ? 'Share' : 'Compartir'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
