import React, { useState } from 'react';
import { DJ_FX_LEVEL_KEY, getDJFxLevel, type DJFxLevel } from '../../services/djMixPlanner';
import { useLanguageStore } from '../../utils/i18n';

/** "Efectos de DJ": how strong the build-up riser and the APK's real filter moves are. */
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
          ? 'The riser before a build-up and, in the app, the real bass and filter moves in each change.'
          : 'La subida antes de un Subidón y, en la app, el movimiento real de graves y filtro en cada cambio.'}
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
