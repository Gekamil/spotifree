import React, { useState } from 'react';
import { DJ_FX_LEVEL_KEY, getDJFxLevel, type DJFxLevel } from '../../services/djMixPlanner';
import { useLanguageStore } from '../../utils/i18n';

/** "Efectos de DJ": how strong the impacts / risers / rolls on DJ transitions are. */
export const DJEffectsSelector: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const isEn = useLanguageStore((s) => s.language === 'en');
  const [level, setLevel] = useState<DJFxLevel>(() => getDJFxLevel());
  const opts: Array<{ id: DJFxLevel; es: string; en: string }> = [
    { id: 'off', es: 'No', en: 'Off' },
    { id: 'soft', es: 'Suaves', en: 'Soft' },
    { id: 'normal', es: 'Normales', en: 'Normal' },
    { id: 'intense', es: 'Intensos', en: 'Intense' },
  ];
  const choose = (id: DJFxLevel) => {
    setLevel(id);
    try {
      window.localStorage.setItem(DJ_FX_LEVEL_KEY, id);
    } catch {}
  };
  return (
    <div className="w-full" translate="no">
      <p className={`${compact ? 'text-[15px]' : 'text-sm'} text-white font-medium`}>{isEn ? 'DJ effects' : 'Efectos de DJ'}</p>
      <p className="text-[13px] text-[#a7a7a7] mt-0.5 leading-snug">
        {isEn
          ? 'Impacts, risers and rolls that play when the DJ changes song.'
          : 'Golpes, subidas y redobles que suenan cuando el DJ cambia de canción.'}
      </p>
      <div className="mt-3 inline-flex p-1 rounded-full bg-[#2a2a2a]">
        {opts.map((o) => (
          <button
            key={o.id}
            onClick={() => choose(o.id)}
            className={`h-8 px-4 rounded-full text-[13px] font-bold transition-colors cursor-pointer ${
              level === o.id ? 'bg-white text-black' : 'text-[#b3b3b3] hover:text-white'
            }`}
          >
            {isEn ? o.en : o.es}
          </button>
        ))}
      </div>
    </div>
  );
};

export default DJEffectsSelector;
