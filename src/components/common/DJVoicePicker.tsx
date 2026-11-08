import React, { useEffect, useRef, useState } from 'react';
import { aiDJVoiceService, DJ_VOICE_OPTIONS, type DJVoiceId } from '../../services/aiDJVoiceService';
import { useLanguageStore } from '../../utils/i18n';
import { MobileSheet } from '../mobile/MobileSheet';

/**
 * "Voz del DJ", the way Spotify's settings look: one row with the chosen voice. On the phone
 * it opens a sheet (like the "..." menus); on the computer, a dropdown list. Each voice can be
 * heard before choosing it.
 */
export const DJVoicePicker: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const isEn = useLanguageStore((s) => s.language === 'en');
  const [voice, setVoice] = useState<DJVoiceId>(() => aiDJVoiceService.getSelectedVoice());
  const [testing, setTesting] = useState<DJVoiceId | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const current = DJ_VOICE_OPTIONS.find((o) => o.id === voice) || DJ_VOICE_OPTIONS[0];

  const preview = async (id: DJVoiceId) => {
    if (testing === id) {
      aiDJVoiceService.stopSpeaking();
      setTesting(null);
      return;
    }
    setTesting(id);
    try {
      // Only listens: the chosen voice stays the same
      await aiDJVoiceService.previewVoice(id);
    } catch {}
    setTesting((t) => (t === id ? null : t));
  };

  const choose = (id: DJVoiceId) => {
    const changed = voice !== id;
    aiDJVoiceService.setSelectedVoice(id);
    setVoice(id);
    if (changed && testing !== id) void preview(id);
    if (!compact) setOpen(false);
  };

  // Desktop dropdown: close on outside click / Escape
  useEffect(() => {
    if (!open || compact) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, compact]);

  const PlayIcon = ({ id }: { id: DJVoiceId }) =>
    testing === id ? (
      <span className="flex items-end gap-[2px] h-3" aria-hidden="true">
        <span className="w-[3px] rounded-sm bg-current animate-spotify-eq-1" />
        <span className="w-[3px] rounded-sm bg-current animate-spotify-eq-2" />
        <span className="w-[3px] rounded-sm bg-current animate-spotify-eq-3" />
      </span>
    ) : (
      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288z" />
      </svg>
    );

  const Check = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="#1ed760" aria-hidden="true">
      <path d="M15.53 2.47a.75.75 0 0 1 0 1.06L4.907 14.153.47 9.716a.75.75 0 0 1 1.06-1.06l3.377 3.376L14.47 2.47a.75.75 0 0 1 1.06 0z" />
    </svg>
  );

  const voiceRow = (o: (typeof DJ_VOICE_OPTIONS)[number], big: boolean) => {
    const selected = o.id === voice;
    return (
      <div
        key={o.id}
        className={`flex items-center gap-3 rounded-lg ${big ? 'px-2 py-2.5' : 'px-3 py-2'} ${big ? 'active:bg-white/10' : 'hover:bg-white/10'} transition-colors`}
      >
        <button
          onClick={() => void preview(o.id)}
          className={`${big ? 'w-10 h-10' : 'w-8 h-8'} rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
            testing === o.id ? 'bg-[#1ed760] text-black' : 'bg-white/10 text-white hover:bg-white/20'
          }`}
          aria-label={`${isEn ? 'Hear' : 'Escuchar'} ${o.name}`}
        >
          <PlayIcon id={o.id} />
        </button>
        <button onClick={() => choose(o.id)} className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer">
          <span className="flex-1 min-w-0">
            <span className={`block ${big ? 'text-[15px]' : 'text-sm'} font-bold truncate ${selected ? 'text-[#1ed760]' : 'text-white'}`}>{o.name}</span>
            <span className="block text-xs text-[#a7a7a7] truncate">
              {o.region} · {isEn ? o.descriptionEn : o.description}
            </span>
          </span>
          {selected && <Check />}
        </button>
      </div>
    );
  };

  const label = isEn ? 'DJ voice' : 'Voz del DJ';
  const hint = isEn ? 'In English the DJ uses a US voice.' : 'La voz con la que te habla el DJ.';

  if (compact) {
    return (
      <div className="w-full" translate="no">
        <button onClick={() => setOpen(true)} className="w-full flex items-center justify-between gap-3 text-left cursor-pointer active:opacity-70">
          <span className="min-w-0">
            <span className="block text-[15px] text-white font-medium">{label}</span>
            <span className="block text-[13px] text-[#a7a7a7] truncate">
              {current.name} · {current.region}
            </span>
          </span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="#a7a7a7" aria-hidden="true">
            <path d="M4.97.47a.75.75 0 0 0 0 1.06L11.44 8l-6.47 6.47a.75.75 0 1 0 1.06 1.06L13.56 8 6.03.47a.75.75 0 0 0-1.06 0" />
          </svg>
        </button>
        <MobileSheet
          open={open}
          onClose={() => {
            aiDJVoiceService.stopSpeaking();
            setTesting(null);
            setOpen(false);
          }}
          closeLabel={isEn ? 'Done' : 'Listo'}
        >
          <div className="pb-3 border-b border-white/10">
            <p className="text-base font-bold text-white font-['SpotifyMixUITitle']">{label}</p>
            <p className="text-xs text-[#b3b3b3] mt-0.5">{isEn ? 'Tap ▶ to hear a voice, tap the name to choose it.' : 'Toca ▶ para escuchar una voz y su nombre para elegirla.'}</p>
          </div>
          <div className="space-y-0.5">{DJ_VOICE_OPTIONS.map((o) => voiceRow(o, true))}</div>
        </MobileSheet>
      </div>
    );
  }

  return (
    <div className="w-full flex items-center justify-between gap-6" translate="no">
      <div className="min-w-0">
        <p className="text-sm text-white font-medium">{label}</p>
        <p className="text-[13px] text-[#a7a7a7] mt-0.5 leading-snug">{hint}</p>
      </div>
      <div ref={boxRef} className="relative shrink-0">
        <button
          onClick={() => setOpen((v) => !v)}
          className="h-8 min-w-[180px] pl-3 pr-2.5 rounded-[4px] bg-[#2a2a2a] hover:bg-[#333] border border-transparent hover:border-white/10 flex items-center justify-between gap-3 text-sm text-white cursor-pointer transition-colors"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="truncate">{current.name}</span>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true">
            <path d="M14 6l-6 6-6-6h12z" />
          </svg>
        </button>
        {open && (
          <div
            role="listbox"
            className="absolute right-0 top-full mt-1 z-50 w-[320px] max-h-[360px] overflow-y-auto rounded-[4px] bg-[#282828] p-1 shadow-[0_16px_24px_rgba(0,0,0,0.3),0_6px_8px_rgba(0,0,0,0.2)] animate-in fade-in zoom-in-95 duration-150 origin-top-right"
          >
            {DJ_VOICE_OPTIONS.map((o) => voiceRow(o, false))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DJVoicePicker;
