import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useSharedSessionStore, type SessionParticipant } from '../../services/sharedSessionService';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { showGlobalToast } from '../../utils/globalToast';
import { handleImageError } from '../../utils/imageFallback';
import { EditNativeIcon, FriendsNativeIcon, LinkNativeIcon, ShareNativeIcon } from '../icons/SpotifyNativeIcons';

const initial = (name: string) => (name || '?').trim().charAt(0).toUpperCase() || '?';

/** A participant's round avatar: their colour and initial (like Spotify Jam's avatars) */
const Avatar: React.FC<{ name: string; color: string; size?: number; ring?: string }> = ({ name, color, size = 40, ring }) => (
  <span
    className="rounded-full flex items-center justify-center font-bold text-black shrink-0 select-none"
    style={{
      width: size,
      height: size,
      background: color || '#1ed760',
      fontSize: Math.round(size * 0.42),
      boxShadow: ring ? `0 0 0 3px ${ring}` : undefined,
    }}
    aria-hidden="true"
  >
    {initial(name)}
  </span>
);

/**
 * "Escuchar juntos" (Spotify Jam style). Same content on the phone (bottom sheet,
 * SharedSessionModal) and on the computer (right panel, DesktopRightSidebar).
 * `surface` is the background colour behind it (used for the avatar rings).
 */
export const SharedSessionPanel: React.FC<{ surface: string; compact?: boolean }> = ({ surface, compact }) => {
  const {
    isInSession,
    isHost,
    sessionId,
    sessionLink,
    hostName,
    participants,
    myParticipantId,
    libraryViewMode,
    setLibraryViewMode,
    updateMyName,
    createSession,
    joinSession,
    leaveSession,
    terminateSession,
  } = useSharedSessionStore();
  const user = useSpotifyDataStore((s) => s.user);
  const currentTrack = usePlayerStore((s) => s.currentTrack);

  const [userName, setUserName] = useState(() => user?.display_name || 'Amigo');
  const [editingStartName, setEditingStartName] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState<'start' | 'join' | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionLink) {
      setQr(null);
      return;
    }
    QRCode.toDataURL(sessionLink, { margin: 1, width: 264, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [sessionLink]);

  const start = async () => {
    setBusy('start');
    await createSession(userName.trim() || 'Anfitrión');
    setBusy(null);
  };
  const join = async () => {
    if (!joinCode.trim()) return;
    setBusy('join');
    setJoinError(null);
    const ok = await joinSession(joinCode.trim(), userName.trim() || 'Amigo');
    setBusy(null);
    if (!ok) setJoinError('No se encontró esa sesión. Revisa el código.');
  };
  const copyLink = async () => {
    if (!sessionLink) return;
    try {
      await navigator.clipboard.writeText(sessionLink);
      showGlobalToast('Enlace copiado');
    } catch {
      showGlobalToast('No se pudo copiar el enlace');
    }
  };
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const shareLink = async () => {
    if (!sessionLink) return;
    try {
      await navigator.share({ title: 'Escuchar juntos en Spotifree', text: '¡Únete a mi sesión en Spotifree!', url: sessionLink });
    } catch {}
  };
  const saveName = () => {
    if (newName.trim()) void updateMyName(newName.trim());
    setEditingName(false);
  };

  const pill = 'h-12 rounded-full font-bold text-[15px] transition-transform active:scale-[0.97] disabled:opacity-50';
  const gap = compact ? 'space-y-6' : 'space-y-7';

  // ------------------------------------------------------------------ not in a session
  if (!isInSession) {
    const me = { name: userName || 'Tú', color: '#1ed760' };
    return (
      <div className={`${gap} font-['SpotifyMixUI'] text-white`}>
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center -space-x-3">
            <Avatar name={me.name} color={me.color} size={64} ring={surface} />
            <span className="w-16 h-16 rounded-full bg-[#3e3e3e] flex items-center justify-center text-white" style={{ boxShadow: `0 0 0 3px ${surface}` }}>
              <FriendsNativeIcon size={26} className="currentColor" />
            </span>
          </div>
          <h2 className="mt-5 text-[24px] font-bold tracking-tight font-['SpotifyMixUITitle'] leading-tight">Escuchad juntos</h2>
          <p className="mt-2 text-[14px] text-[#b3b3b3] leading-snug max-w-[320px]">
            Inicia una sesión y comparte el enlace: sonará la misma canción a la vez para todos y podréis elegir música entre todos.
          </p>
        </div>

        <div className="space-y-3">
          <button onClick={() => void start()} disabled={busy !== null} className={`${pill} w-full bg-[#1ed760] text-black hover:bg-[#3be477]`}>
            {busy === 'start' ? 'Iniciando…' : 'Empezar sesión'}
          </button>
          <div className="text-center text-[13px] text-[#b3b3b3]">
            {editingStartName ? (
              <span className="inline-flex items-center gap-2">
                <input
                  autoFocus
                  value={userName}
                  maxLength={24}
                  onChange={(e) => setUserName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingStartName(false)}
                  onBlur={() => setEditingStartName(false)}
                  className="w-40 h-8 rounded-[4px] bg-[#3e3e3e] px-2 text-white text-[13px] outline-none focus:ring-1 focus:ring-white/40"
                />
              </span>
            ) : (
              <>
                Te verán como <span className="font-bold text-white">{userName || 'Amigo'}</span>
                <span className="mx-1.5 text-[#7c7c7c]">·</span>
                <button onClick={() => setEditingStartName(true)} className="font-bold text-white underline underline-offset-2 decoration-white/40 hover:decoration-white">
                  Cambiar
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 text-[12px] font-bold text-[#7c7c7c] uppercase tracking-wider">
          <span className="h-px flex-1 bg-white/10" />o<span className="h-px flex-1 bg-white/10" />
        </div>

        <div className="space-y-2.5">
          <p className="text-[16px] font-bold">¿Te han invitado?</p>
          <p className="text-[13px] text-[#b3b3b3] -mt-1.5">Abre el enlace que te han pasado o escribe el código de la sesión.</p>
          <div className="flex gap-2">
            <input
              value={joinCode}
              maxLength={8}
              onChange={(e) => {
                setJoinCode(e.target.value.toUpperCase().replace(/\s+/g, ''));
                setJoinError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && void join()}
              placeholder="CÓDIGO"
              className="min-w-0 flex-1 h-12 rounded-[4px] bg-[#3e3e3e] focus:bg-[#333] border border-transparent focus:border-[#535353] px-3 text-center text-[16px] font-bold tracking-[0.3em] uppercase text-white outline-none placeholder:text-[#7c7c7c] placeholder:tracking-[0.2em] placeholder:font-normal"
            />
            <button
              onClick={() => void join()}
              disabled={busy !== null || !joinCode.trim()}
              className={`${pill} px-6 border border-[#7c7c7c] text-white hover:border-white shrink-0`}
            >
              {busy === 'join' ? 'Uniendo…' : 'Unirse'}
            </button>
          </div>
          {joinError && <p className="text-[13px] text-[#f3727f]">{joinError}</p>}
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------ in a session
  const host = participants.find((p) => p.isHost);
  const sorted: SessionParticipant[] = [...participants].sort((a, b) => Number(b.isHost) - Number(a.isHost));
  const cover = currentTrack?.album?.images?.[0]?.url;

  return (
    <div className={`${gap} font-['SpotifyMixUI'] text-white`}>
      {/* Header: whose session, who is in it */}
      <div className="flex flex-col items-center text-center">
        <div className="flex items-center -space-x-2.5">
          {sorted.slice(0, 5).map((p) => (
            <Avatar key={p.id} name={p.name} color={p.color} size={48} ring={surface} />
          ))}
          {sorted.length > 5 && (
            <span className="w-12 h-12 rounded-full bg-[#3e3e3e] flex items-center justify-center text-[14px] font-bold" style={{ boxShadow: `0 0 0 3px ${surface}` }}>
              +{sorted.length - 5}
            </span>
          )}
        </div>
        <h2 className="mt-4 text-[24px] font-bold tracking-tight font-['SpotifyMixUITitle'] leading-tight">
          {isHost ? 'Tu sesión' : `Sesión de ${host?.name || hostName || 'tu amigo'}`}
        </h2>
        <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-[#b3b3b3]">
          <span className="w-2 h-2 rounded-full bg-[#1ed760] animate-pulse" />
          En directo · {participants.length} {participants.length === 1 ? 'persona' : 'personas'}
        </p>
      </div>

      {/* What is playing for everyone */}
      {currentTrack && (
        <div className="flex items-center gap-3 rounded-md bg-white/[0.07] p-2 pr-3">
          <img src={cover} alt="" onError={handleImageError} className="w-12 h-12 rounded-[4px] object-cover shrink-0 bg-[#282828]" />
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#1ed760]">Sonando para todos</p>
            <p className="truncate text-[14px] font-bold">{currentTrack.name}</p>
            <p className="truncate text-[13px] text-[#b3b3b3]">{(currentTrack.artists || []).map((a) => a.name).join(', ')}</p>
          </div>
        </div>
      )}

      {/* Invite */}
      <div className="rounded-lg bg-white/[0.07] p-4">
        <p className="text-[16px] font-bold">Invita a tus amigos</p>
        <p className="mt-0.5 text-[13px] text-[#b3b3b3]">Escanea el código con la cámara o comparte el enlace.</p>
        <div className="mt-4 flex items-center gap-4">
          <div className="w-[116px] h-[116px] shrink-0 rounded-md bg-white p-1.5 flex items-center justify-center">
            {qr ? <img src={qr} alt="Código QR para unirse" className="w-full h-full" /> : <div className="w-full h-full animate-pulse bg-black/10 rounded" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#b3b3b3]">Código</p>
            <p className="font-mono text-[24px] font-bold tracking-[0.18em] select-all leading-tight">{sessionId}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => void copyLink()}
                className="h-9 px-4 rounded-full bg-white text-black text-[13px] font-bold flex items-center gap-1.5 hover:scale-[1.04] active:scale-95 transition-transform"
              >
                <LinkNativeIcon size={15} />
                Copiar enlace
              </button>
              {canShare && (
                <button
                  onClick={() => void shareLink()}
                  className="h-9 px-4 rounded-full border border-[#7c7c7c] text-white text-[13px] font-bold flex items-center gap-1.5 hover:border-white active:scale-95 transition-transform"
                >
                  <ShareNativeIcon size={14} />
                  Compartir
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* People */}
      <div>
        <p className="text-[16px] font-bold mb-2">Personas</p>
        <div className="space-y-1">
          {sorted.map((p) => {
            const isMe = p.id === myParticipantId;
            return (
              <div key={p.id} className="flex items-center gap-3 py-1.5">
                <Avatar name={p.name} color={p.color} size={40} />
                {isMe && editingName ? (
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <input
                      autoFocus
                      value={newName}
                      maxLength={24}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveName();
                        if (e.key === 'Escape') setEditingName(false);
                      }}
                      className="min-w-0 flex-1 h-9 rounded-[4px] bg-[#3e3e3e] px-2.5 text-[14px] text-white outline-none focus:ring-1 focus:ring-white/40"
                    />
                    <button onClick={saveName} className="h-8 px-3 rounded-full bg-white text-black text-[13px] font-bold shrink-0">
                      Guardar
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold">
                        {p.name}
                        {isMe && <span className="font-normal text-[#b3b3b3]"> (tú)</span>}
                      </p>
                      <p className="text-[13px] text-[#b3b3b3]">{p.isHost ? 'Anfitrión' : 'Invitado'}</p>
                    </div>
                    {isMe && (
                      <button
                        onClick={() => {
                          setNewName(p.name);
                          setEditingName(true);
                        }}
                        aria-label="Cambiar mi nombre"
                        title="Cambiar mi nombre"
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[#b3b3b3] hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <EditNativeIcon size={16} />
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Guests: whose library they browse */}
      {!isHost && (
        <div>
          <p className="text-[16px] font-bold">Qué ves en tu biblioteca</p>
          <div className="mt-2.5 flex gap-2">
            {(
              [
                ['host', `De ${host?.name || hostName || 'el anfitrión'}`],
                ['my', 'La mía'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setLibraryViewMode(mode)}
                className={`h-8 px-3.5 rounded-full text-[13px] font-bold transition-colors ${
                  libraryViewMode === mode ? 'bg-[#1ed760] text-black' : 'bg-white/[0.07] text-white hover:bg-white/[0.12]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-[#b3b3b3] leading-snug">
            {libraryViewMode === 'host'
              ? 'Ves las playlists y la cola del anfitrión.'
              : 'Ves tus playlists. Lo que pongas sonará para todos.'}
          </p>
        </div>
      )}

      <p className="text-[13px] text-[#b3b3b3] leading-snug">
        {isHost
          ? 'Todos escuchan tu música y tu cola. Cualquiera puede poner canciones.'
          : 'Puedes poner canciones y abrir playlists. Los ajustes los controla el anfitrión.'}
      </p>

      <button
        onClick={() => void (isHost ? terminateSession() : leaveSession())}
        className={`${pill} w-full border border-[#7c7c7c] text-white hover:border-white`}
      >
        {isHost ? 'Finalizar sesión para todos' : 'Salir de la sesión'}
      </button>
    </div>
  );
};

export default SharedSessionPanel;
