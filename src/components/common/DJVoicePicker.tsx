import React, { useState } from 'react';
import { aiDJVoiceService, DJ_VOICE_OPTIONS, type DJVoiceId } from '../../services/aiDJVoiceService';
import { useLanguageStore } from '../../utils/i18n';

/** "Voz del DJ": pick the AI DJ's voice; tapping a voice plays a short sample */
export const DJVoicePicker: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const isEn = useLanguageStore((s) => s.language === 'en');
  const [voice, setVoice] = useState<DJVoiceId>(() => aiDJVoiceService.getSelectedVoice());
  const [testing, setTesting] = useState<DJVoiceId | null>(null);

  const choose = async (id: DJVoiceId) => {
    setVoice(id);
    setTesting(id);
    try {
      await aiDJVoiceService.testVoice(id);
    } catch {}
    setTesting((t) => (t === id ? null : t));
  };

  return (
    <div className="w-full" translate="no">
      <p className={`${compact ? 'text-[15px]' : 'text-sm'} text-white font-medium`}>{isEn ? 'DJ voice' : 'Voz del DJ'}</p>
      <p className="text-[13px] text-[#a7a7a7] mt-0.5 leading-snug">
        {isEn ? 'Tap a voice to hear it. In English the DJ uses a US voice.' : 'Toca una voz para escucharla.'}
      </p>
      <div className={`mt-3 grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {DJ_VOICE_OPTIONS.map((o) => {
          const selected = voice === o.id;
          return (
            <button
              key={o.id}
              onClick={() => void choose(o.id)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors cursor-pointer ${
                selected ? 'bg-white/[0.14] ring-1 ring-[#1ed760]' : 'bg-[#2a2a2a] hover:bg-[#333]'
              }`}
            >
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  selected ? 'bg-[#1ed760] text-black' : 'bg-white/10 text-white'
                }`}
                aria-hidden="true"
              >
                {testing === o.id ? (
                  <span className="flex items-end gap-[2px] h-3">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="w-[3px] rounded-sm bg-current animate-pulse" style={{ height: 5 + i * 3, animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </span>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zm7 9v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2z" />
                  </svg>
                )}
              </span>
              <span className="min-w-0">
                <span className={`block text-[14px] font-bold truncate ${selected ? 'text-[#1ed760]' : 'text-white'}`}>{o.name}</span>
                <span className="block text-[12px] text-[#a7a7a7] truncate">
                  {o.region} · {isEn ? o.descriptionEn : o.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DJVoicePicker;
