import React, { useEffect, useRef } from 'react';
import { useSharedSessionStore } from '../../services/sharedSessionService';

export const SharedSessionCursors: React.FC = () => {
  const { isInSession, participants, myParticipantId, broadcastCursor } = useSharedSessionStore();
  const rafRef = useRef<number | null>(null);
  const posRef = useRef<{ pctX: number; pctY: number } | null>(null);

  useEffect(() => {
    if (!isInSession) return;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      let clientX = 0;
      let clientY = 0;

      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = e.clientX;
        clientY = e.clientY;
      } else {
        return;
      }

      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      posRef.current = {
        pctX: (clientX / w) * 100,
        pctY: (clientY / h) * 100,
      };

      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          if (posRef.current) {
            broadcastCursor(posRef.current.pctX, posRef.current.pctY);
          }
        });
      }
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
    };
  }, [isInSession, broadcastCursor]);

  if (!isInSession) return null;

  // Render all other participants who have an active cursor updated in the last 15 seconds
  const otherParticipants = participants.filter(
    (p) => p.id !== myParticipantId && p.cursor && Date.now() - p.cursor.updatedAt < 15000
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden select-none">
      {otherParticipants.map((p) => {
        const { pctX, pctY } = p.cursor!;
        return (
          <div
            key={p.id}
            className="absolute pointer-events-none will-change-transform"
            style={{
              left: 0,
              top: 0,
              transform: `translate3d(calc(${pctX}vw - 2px), calc(${pctY}vh - 2px), 0)`,
              transition: 'transform 20ms linear',
            }}
          >
            {/* SVG Mouse Pointer Cursor */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              className="drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] filter"
              style={{ color: p.color }}
            >
              <path
                d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.86a.5.5 0 0 0-.85.35z"
                fill="currentColor"
                stroke="#000"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>

            {/* Name Badge */}
            <div
              className="ml-4 -mt-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white shadow-xl whitespace-nowrap flex items-center gap-1.5 border border-black/20"
              style={{
                backgroundColor: p.color,
                boxShadow: `0 4px 14px ${p.color}40`,
              }}
            >
              <span>{p.name}</span>
              {p.isHost && (
                <span className="text-[9px] bg-black/30 px-1 rounded uppercase tracking-wider font-extrabold">
                  Anfitrión
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
