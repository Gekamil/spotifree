import React, { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSharedSessionStore } from '../../services/sharedSessionService';
import { forgetListenFriend, initListenFriends, useListenFriends } from '../../services/listenFriends';

function ago(ts: number): string {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'ahora mismo';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

const Avatar: React.FC<{ name: string; color: string; avatar?: string; size?: number; ring?: boolean }> = ({ name, color, avatar, size = 44, ring }) => (
  <div
    className={`relative rounded-full overflow-hidden shrink-0 flex items-center justify-center font-bold text-black ${ring ? 'ring-2 ring-[#1ed760] ring-offset-2 ring-offset-[#181818]' : ''}`}
    style={{ width: size, height: size, backgroundColor: color || '#535353', fontSize: size * 0.4 }}
  >
    {avatar ? (
      <img
        src={avatar}
        alt=""
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover"
        onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
      />
    ) : (
      (name || '?').charAt(0).toUpperCase()
    )}
  </div>
);

/** Settings › "Escuchar juntos": who is listening with you now, and who you listened with before */
export const ListeningFriendsSection: React.FC<{ variant?: 'mobile' | 'desktop' }> = () => {
  useEffect(() => initListenFriends(), []);
  const { isInSession, participants, me } = useSharedSessionStore(
    useShallow((s) => ({ isInSession: s.isInSession, participants: s.participants, me: s.myParticipantId }))
  );
  const recent = useListenFriends((s) => s.recent);
  const live = isInSession ? participants : [];
  const liveNames = new Set(live.map((p) => p.name.trim().toLowerCase()));
  const past = recent.filter((f) => !liveNames.has(f.name.trim().toLowerCase()));

  return (
    <section className="space-y-3 font-['SpotifyMixUI']">
      <h3 className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">Escuchar juntos</h3>
      <div className="rounded-2xl bg-[#181818] border border-white/[0.06] overflow-hidden">
        {live.length > 0 ? (
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="relative flex w-2.5 h-2.5">
                <span className="absolute inline-flex w-full h-full rounded-full bg-[#1ed760] opacity-60 animate-ping" />
                <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-[#1ed760]" />
              </span>
              <span className="text-[14px] font-bold">Escuchando ahora · {live.length} {live.length === 1 ? 'persona' : 'personas'}</span>
            </div>
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1">
              {live.map((p) => (
                <div key={p.id} className="w-16 shrink-0 flex flex-col items-center text-center gap-1.5 animate-in fade-in zoom-in-95 duration-300">
                  <Avatar name={p.name} color={p.color} avatar={p.avatar} size={52} ring={p.isHost} />
                  <span className="text-[12px] font-bold truncate w-full">{p.id === me ? 'Tú' : p.name}</span>
                  <span className="text-[10px] text-[#a7a7a7] -mt-1">{p.isHost ? 'Anfitrión' : 'Invitado'}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => useSharedSessionStore.getState().setModalOpen(true)}
            className="w-full flex items-center gap-3 p-4 text-left active:bg-white/[0.04] hover:bg-white/[0.03] transition-colors cursor-pointer"
          >
            <div className="w-11 h-11 rounded-full bg-[#2a2a2a] flex items-center justify-center shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                <circle cx="12" cy="8" r="3" />
                <path d="M12 12.5c-2.6 0-5 1.3-5 3.2V18h10v-2.3c0-1.9-2.4-3.2-5-3.2z" />
                <circle cx="5" cy="10" r="2.2" opacity="0.7" />
                <circle cx="19" cy="10" r="2.2" opacity="0.7" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold">Empieza una sesión</p>
              <p className="text-[12px] text-[#a7a7a7]">Escucha a la vez con tus amigos y aparecerán aquí</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#a7a7a7] shrink-0">
              <path d="M5.5 2.5l6 5.5-6 5.5V2.5z" />
            </svg>
          </button>
        )}

        {past.length > 0 && (
          <div className="border-t border-white/[0.06] px-2 py-2">
            <p className="px-2 pt-1 pb-2 text-[12px] font-bold text-[#a7a7a7]">Has escuchado con</p>
            {past.map((f) => (
              <div key={f.id} className="group flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.04] transition-colors">
                <Avatar name={f.name} color={f.color} avatar={f.avatar} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold truncate">{f.name}</p>
                  <p className="text-[12px] text-[#a7a7a7]">
                    {f.wasHost ? 'Anfitrión · ' : ''}
                    {ago(f.lastSeen)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => forgetListenFriend(f.id)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#727272] hover:text-white hover:bg-white/10 transition-colors cursor-pointer opacity-70 group-hover:opacity-100"
                  aria-label={`Quitar a ${f.name}`}
                  title="Quitar de la lista"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M2.47 2.47a.75.75 0 0 1 1.06 0L8 6.94l4.47-4.47a.75.75 0 1 1 1.06 1.06L9.06 8l4.47 4.47a.75.75 0 0 1-1.06 1.06L8 9.06l-4.47 4.47a.75.75 0 0 1-1.06-1.06L6.94 8 2.47 3.53a.75.75 0 0 1 0-1.06z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
