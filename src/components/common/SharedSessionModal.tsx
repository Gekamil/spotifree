import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSharedSessionStore } from '../../services/sharedSessionService';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';

export const SharedSessionModal: React.FC = () => {
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
    isModalOpen,
    setModalOpen,
    createSession,
    joinSession,
    leaveSession,
    terminateSession,
  } = useSharedSessionStore();

  const user = useSpotifyDataStore((s) => s.user);
  const [userName, setUserName] = useState(() => user?.display_name || 'Amigo');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newNameInput, setNewNameInput] = useState('');
  // Mobile swipe-to-dismiss gesture
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    currentYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta > 0) {
      currentYRef.current = e.touches[0].clientY;
      setDragY(delta);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const delta = currentYRef.current - startYRef.current;
    if (delta > 90) {
      setDragY(500);
      setTimeout(() => {
        setModalOpen(false);
        setDragY(0);
      }, 200);
    } else {
      setDragY(0);
    }
  };
  const handleCopyLink = () => {
    if (!sessionLink) return;
    navigator.clipboard.writeText(sessionLink).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    });
  };

  const handleStart = async () => {
    setIsSubmitting(true);
    await createSession(userName);
    setIsSubmitting(false);
  };

  const handleJoin = async () => {
    if (!joinCodeInput.trim()) return;
    setIsSubmitting(true);
    await joinSession(joinCodeInput.trim(), userName);
    setIsSubmitting(false);
  };

  if (!isModalOpen) return null;

  const modal = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2147483647,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        fontFamily: "'SpotifyMixUI', sans-serif",
      }}
      onClick={() => setModalOpen(false)}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '85vh',
          background: '#121212',
          borderTop: '1px solid rgba(255,255,255,0.12)',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          padding: '12px 20px 28px 20px',
          color: 'white',
          position: 'relative',
          boxShadow: '0 -16px 48px rgba(0,0,0,0.85)',
          overflowY: 'auto',
          boxSizing: 'border-box',
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pull Handle with touch drag zone */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ width: '100%', padding: '4px 0 16px 0', display: 'flex', justifyContent: 'center', cursor: 'grab' }}
        >
          <div style={{ width: '36px', height: '4px', background: 'rgba(255,255,255,0.3)', borderRadius: '999px' }} />
        </div>

        {/* Close Button */}
        <button
          onClick={() => setModalOpen(false)}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
            border: 'none',
            color: '#b3b3b3',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
          }}
          onMouseOver={(e) => { (e.currentTarget.style.background = 'rgba(255,255,255,0.15)'); (e.currentTarget.style.color = 'white'); }}
          onMouseOut={(e) => { (e.currentTarget.style.background = 'rgba(255,255,255,0.05)'); (e.currentTarget.style.color = '#b3b3b3'); }}
        >
          ✕
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(30,215,96,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#1ed760' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              <path d="M4.5 10c1.38 0 2.5-1.12 2.5-2.5S5.88 5 4.5 5 2 6.12 2 7.5 3.12 10 4.5 10zm-1.5 3.5C1.84 14.16 0 15.33 0 17v2h6v-2c0-1.67-1.84-2.84-3-3.5z"/>
              <path d="M19.5 10c1.38 0 2.5-1.12 2.5-2.5S20.88 5 19.5 5 17 6.12 17 7.5s1.12 2.5 2.5 2.5zm1.5 3.5c1.16.66 3 1.83 3 3.5v2h-6v-2c0-1.67 1.84-2.84 3-3.5z"/>
            </svg>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 900, letterSpacing: '-0.5px', fontFamily: "'SpotifyMixUITitle', sans-serif" }}>
              Sesión compartida
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#b3b3b3' }}>
              {isInSession ? `Sala en vivo · Código ${sessionId}` : 'Escucha y controla música con tus amigos'}
            </p>
          </div>
        </div>

        {/* Content */}
        {!isInSession ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#b3b3b3', lineHeight: 1.6 }}>
              Inicia una sesión para que tus amigos se conecten. Veréis el ratón del otro en tiempo real y escucharéis la música sincronizada al mismo segundo.
            </p>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#b3b3b3', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
                Tu nombre en la sesión
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Nombre para mostrar"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                onFocus={(e) => (e.target.style.borderColor = '#1ed760')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
              />
            </div>

            <button
              onClick={handleStart}
              disabled={isSubmitting}
              style={{ width: '100%', padding: '13px', borderRadius: '999px', background: '#1ed760', border: 'none', color: '#000', fontWeight: 900, fontSize: '14px', cursor: isSubmitting ? 'wait' : 'pointer', letterSpacing: '0.3px', boxShadow: '0 4px 24px rgba(30,215,96,0.25)', opacity: isSubmitting ? 0.7 : 1 }}
            >
              {isSubmitting ? 'Iniciando...' : 'Iniciar sesión compartida'}
            </button>

            <div style={{ paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="Pegar código de sesión"
                maxLength={8}
                style={{ flex: 1, padding: '8px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '2px', outline: 'none' }}
                onFocus={(e) => (e.target.style.borderColor = '#1ed760')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
              />
              <button
                onClick={handleJoin}
                disabled={isSubmitting || !joinCodeInput.trim()}
                style={{ padding: '8px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', fontWeight: 700, fontSize: '12px', cursor: 'pointer', opacity: (!joinCodeInput.trim() || isSubmitting) ? 0.4 : 1 }}
              >
                Unirse
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Share Link */}
            <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#b3b3b3', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Enlace para tus amigos
                </span>
                <span style={{ fontSize: '12px', color: '#1ed760', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#1ed760', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                  En vivo
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  readOnly
                  value={sessionLink || ''}
                  style={{ flex: 1, padding: '6px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.9)', fontSize: '11px', fontFamily: 'monospace', outline: 'none' }}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={handleCopyLink}
                  style={{ padding: '6px 12px', borderRadius: '8px', background: isCopied ? '#1ed760' : 'white', border: 'none', color: '#000', fontWeight: 700, fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                >
                  {isCopied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            {/* Participants */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#b3b3b3', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                Participantes ({participants.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                {participants.map((p) => (
                  <div
                    key={p.id}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '10px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    {p.id === myParticipantId && editingName ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                        <input
                          type="text"
                          value={newNameInput}
                          onChange={(e) => setNewNameInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              updateMyName(newNameInput);
                              setEditingName(false);
                            } else if (e.key === 'Escape') {
                              setEditingName(false);
                            }
                          }}
                          autoFocus
                          maxLength={24}
                          style={{ padding: '2px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.1)', border: '1px solid #1ed760', color: 'white', fontSize: '12px', outline: 'none', width: '110px' }}
                        />
                        <button
                          onClick={() => {
                            updateMyName(newNameInput);
                            setEditingName(false);
                          }}
                          style={{ color: '#1ed760', background: 'none', border: 'none', fontWeight: 900, cursor: 'pointer', padding: '2px 6px' }}
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setEditingName(false)}
                          style={{ color: '#b3b3b3', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', fontWeight: 700 }}>{p.name}</span>
                        {p.id === myParticipantId && (
                          <button
                            onClick={() => {
                              setNewNameInput(p.name);
                              setEditingName(true);
                            }}
                            style={{ background: 'none', border: 'none', color: '#b3b3b3', padding: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            title="Cambiar mi nombre"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '2px 8px', borderRadius: '999px', fontWeight: 700, background: 'rgba(255,255,255,0.05)', color: '#b3b3b3' }}>
                      {p.isHost ? 'Anfitrión' : 'Invitado'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Library / Music Switcher */}
            <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'white' }}>
                  Vista de música
                </span>
                <span style={{ fontSize: '10px', color: '#1ed760', fontWeight: 800, textTransform: 'uppercase' }}>
                  {libraryViewMode === 'host' ? 'Anfitrión' : 'Mi biblioteca'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', padding: '4px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px' }}>
                <button
                  onClick={() => setLibraryViewMode('host')}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: '12px',
                    cursor: 'pointer',
                    background: libraryViewMode === 'host' ? '#1ed760' : 'transparent',
                    color: libraryViewMode === 'host' ? '#000' : '#b3b3b3',
                  }}
                >
                  Anfitrión
                </button>
                <button
                  onClick={() => setLibraryViewMode('my')}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: '12px',
                    cursor: 'pointer',
                    background: libraryViewMode === 'my' ? '#ffffff' : 'transparent',
                    color: libraryViewMode === 'my' ? '#000' : '#b3b3b3',
                  }}
                >
                  Mi biblioteca
                </button>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: '#b3b3b3', lineHeight: 1.4 }}>
                {libraryViewMode === 'host'
                  ? `Viendo la música y cola de ${hostName || 'el anfitrión'}.`
                  : 'Navega por tus propias canciones. Lo que reproduzcas sonará para ambos.'}
              </p>
            </div>

            {/* Guest notice */}
            {!isHost && (
              <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)', fontSize: '12px', color: '#b3b3b3', lineHeight: 1.5 }}>
                Estás en la sesión como invitado. Puedes cambiar canciones y abrir playlists. Los ajustes están protegidos.
              </div>
            )}

            {/* Actions */}
            <div style={{ paddingTop: '8px' }}>
              {isHost ? (
                <button
                  onClick={terminateSession}
                  style={{ width: '100%', padding: '10px', borderRadius: '999px', background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)', color: '#fca5a5', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                >
                  Finalizar sesión para todos
                </button>
              ) : (
                <button
                  onClick={leaveSession}
                  style={{ width: '100%', padding: '10px', borderRadius: '999px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                >
                  Salir de la sesión
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};
