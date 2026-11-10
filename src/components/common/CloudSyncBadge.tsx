import React, { useEffect, useState } from 'react';
import { useCloudSync, getSavedSpotifreeAccount } from '../../services/spotifreeAuth';

function ago(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 10) return 'ahora mismo';
  if (s < 60) return `hace ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  return `hace ${Math.round(m / 60)} h`;
}

/** Real state of the account's sync (saving, saved, offline, error, only on this device) */
export const CloudSyncBadge: React.FC = () => {
  const { state, savedAt, receivedAt, error } = useCloudSync();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 15000);
    return () => clearInterval(t);
  }, []);
  const hasAccount = Boolean(getSavedSpotifreeAccount()?.uid);
  const last = Math.max(savedAt, receivedAt);

  let color = '#1ed760';
  let text = 'Sincronizado';
  if (!hasAccount || state === 'local') {
    color = '#a7a7a7';
    text = 'Solo en este dispositivo';
  } else if (state === 'saving') {
    color = '#ffffff';
    text = 'Guardando…';
  } else if (state === 'offline') {
    color = '#f59b23';
    text = 'Sin conexión: se guardará al volver';
  } else if (state === 'error') {
    color = '#f3727f';
    text = `No se pudo guardar (${error})`;
  } else if (last) {
    text = `Guardado ${ago(last)}`;
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold" style={{ color }} role="status">
      <span className="relative flex w-2 h-2">
        {state === 'saving' && <span className="absolute inline-flex w-full h-full rounded-full opacity-60 animate-ping" style={{ backgroundColor: color }} />}
        <span className="relative inline-flex w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      </span>
      {text}
    </span>
  );
};
