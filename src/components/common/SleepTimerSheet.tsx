import { useEffect, useState } from 'react';
import { SLEEP_MINUTES, SLEEP_TIMER_SHEET_EVENT, useSleepTimer } from '../../services/sleepTimer';
import { showGlobalToast } from '../../utils/globalToast';
import { useLanguageStore } from '../../utils/i18n';
import { useIsMobile } from '../../utils/useIsMobile';

const fmtLeft = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
};

/** "Temporizador de apagado": like Spotify's sleep timer sheet */
export default function SleepTimerSheet() {
  const [open, setOpen] = useState(false);
  const [, tick] = useState(0);
  const { endsAt, trackId, start, endOfTrack, cancel } = useSleepTimer();
  const en = useLanguageStore((s) => s.language) === 'en';
  const isMobile = useIsMobile();

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(SLEEP_TIMER_SHEET_EVENT, onOpen);
    return () => window.removeEventListener(SLEEP_TIMER_SHEET_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onBack = (e: Event) => {
      (e as CustomEvent).detail?.setHandled?.();
      setOpen(false);
    };
    const t = window.setInterval(() => tick((x) => x + 1), 1000);
    window.addEventListener('keydown', onKey);
    window.addEventListener('spotifree_android_back', onBack);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('spotifree_android_back', onBack);
    };
  }, [open]);

  if (!open) return null;

  const active = endsAt !== null || Boolean(trackId);
  const pick = (fn: () => void, msg: string) => {
    fn();
    showGlobalToast(msg);
    setOpen(false);
  };
  const minutesLabel = (m: number) => (m === 60 ? (en ? '1 hour' : '1 hora') : `${m} ${en ? 'minutes' : 'minutos'}`);

  const Option = ({ label, selected, onClick }: { label: string; selected?: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-md px-3 py-3.5 text-left text-[16px] text-white hover:bg-white/[0.07] active:bg-white/10"
    >
      <span className={selected ? 'font-bold text-[#1ed760]' : ''}>{label}</span>
      {selected && (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="#1ed760" className="shrink-0">
          <path d="M15.53 2.47a.75.75 0 0 1 0 1.06L4.907 14.153.47 9.716a.75.75 0 0 1 1.06-1.06l3.377 3.376L14.47 2.47a.75.75 0 0 1 1.06 0" />
        </svg>
      )}
    </button>
  );

  return (
    <div
      className={`fixed inset-0 z-[2500] bg-black/60 ${isMobile ? 'flex items-end' : 'flex items-center justify-center'}`}
      onClick={() => setOpen(false)}
    >
      <div
        translate="no"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={
          isMobile
            ? 'w-full rounded-t-2xl bg-[#1f1f1f] pb-[calc(env(safe-area-inset-bottom,0px)+12px)] animate-slide-up-modal'
            : 'w-[400px] rounded-lg bg-[#282828] pb-3 shadow-[0_16px_48px_rgba(0,0,0,.6)]'
        }
      >
        {isMobile && <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-white/25" />}
        <div className="px-5 pt-4 pb-2">
          <h2 className="text-[20px] font-bold text-white">{en ? 'Sleep timer' : 'Temporizador de apagado'}</h2>
          <p className="mt-0.5 text-[14px] text-[#b3b3b3]">
            {endsAt !== null
              ? `${en ? 'Music stops in' : 'La música se parará en'} ${fmtLeft(endsAt - Date.now())}`
              : trackId
                ? en
                  ? 'Music stops at the end of this song'
                  : 'La música se parará al acabar esta canción'
                : en
                  ? 'Stop the music after a while'
                  : 'Para la música pasado un rato'}
          </p>
        </div>
        <div className="px-2">
          {SLEEP_MINUTES.map((m) => (
            <Option
              key={m}
              label={minutesLabel(m)}
              onClick={() => pick(() => start(m), `${en ? 'Sleep timer set:' : 'Temporizador:'} ${minutesLabel(m)}`)}
            />
          ))}
          <Option
            label={en ? 'End of song' : 'Al acabar la canción'}
            selected={Boolean(trackId)}
            onClick={() => pick(endOfTrack, en ? 'Music stops at the end of this song' : 'La música se parará al acabar esta canción')}
          />
          {active && (
            <Option
              label={en ? 'Turn off timer' : 'Desactivar temporizador'}
              onClick={() => pick(cancel, en ? 'Sleep timer off' : 'Temporizador desactivado')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
