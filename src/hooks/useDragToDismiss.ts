import React, { useRef, useState, useCallback, useEffect } from 'react';

export interface UseDragToDismissOptions {
  /**
   * Callback invoked when sheet dismissal is triggered and the exit animation finishes.
   */
  onClose: () => void;

  /**
   * Minimum vertical displacement in pixels required to dismiss on finger release.
   * Default: 80
   */
  threshold?: number;

  /**
   * Minimum downward velocity in px/ms required to dismiss on release (flick gesture).
   * Default: 0.5
   */
  velocityThreshold?: number;

  /**
   * Ref to the inner scrollable container. If provided, dragging from the content
   * body only starts if scrollTop <= maxScrollTop (allowing normal scroll otherwise).
   */
  scrollRef?: React.RefObject<HTMLElement | null>;

  /**
   * Maximum scroll offset considered "at the top" to allow dragging.
   * Default: 4
   */
  maxScrollTop?: number;

  /**
   * Vertical distance in px to translate the sheet down during exit animation.
   * Default: window.innerHeight || 800
   */
  exitDistance?: number;

  /**
   * Duration of exit animation in milliseconds before onClose is called.
   * Default: 200
   */
  exitDuration?: number;

  /**
   * Whether gesture dismissal is disabled (e.g. on desktop screens or during modal transitions).
   * Default: false
   */
  disabled?: boolean;
}

export interface UseDragToDismissReturn {
  /** Current vertical translation displacement in pixels (>= 0) */
  dragY: number;

  /** Whether the user is currently touching and dragging the sheet */
  isDragging: boolean;

  /** Whether the sheet has triggered dismissal and is currently animating out */
  isDismissing: boolean;

  /** Event handlers to attach to the top drag handle element */
  handleProps: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onTouchCancel: (e: React.TouchEvent) => void;
  };

  /** Event handlers to attach to the sheet content / body */
  contentProps: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onTouchCancel: (e: React.TouchEvent) => void;
  };

  /** Inline styles providing real-time transform and transition for the sheet container */
  sheetStyle: React.CSSProperties;

  /** Manually reset drag displacement to 0 */
  resetDrag: () => void;
}

/**
 * Reusable drag-to-dismiss gesture hook for mobile bottom sheets, modals, and menus.
 *
 * Implements:
 * - Direct handle dragging (bypassing scroll check)
 * - Body dragging gated by inner scroll check (`scrollTop <= maxScrollTop`)
 * - Upward resistance (clamped to 0 to prevent negative space gaps)
 * - Threshold (> 80px) and velocity-based flick (> 0.5px/ms) dismissal
 * - Smooth transition exit animation with timer cleanup
 */
export function useDragToDismiss({
  onClose,
  threshold = 80,
  velocityThreshold = 0.5,
  scrollRef,
  maxScrollTop = 4,
  exitDistance,
  exitDuration = 200,
  disabled = false,
}: UseDragToDismissOptions): UseDragToDismissReturn {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const lastTimeRef = useRef(0);
  const velocityRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isDismissingRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  // Clear pending exit timer on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const startDrag = useCallback(
    (e: React.TouchEvent, checkScroll: boolean) => {
      if (disabled || isDismissingRef.current) return;

      // Gate body drag by inner scroll container position
      if (checkScroll && scrollRef?.current) {
        if (scrollRef.current.scrollTop > maxScrollTop) {
          return;
        }
      }

      const clientY = e.touches[0].clientY;
      startYRef.current = clientY;
      currentYRef.current = clientY;
      lastTimeRef.current = Date.now();
      velocityRef.current = 0;

      isDraggingRef.current = true;
      setIsDragging(true);
    },
    [disabled, maxScrollTop, scrollRef]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDraggingRef.current || isDismissingRef.current || disabled) return;

      const clientY = e.touches[0].clientY;
      const delta = clientY - startYRef.current;
      const now = Date.now();
      const dt = now - lastTimeRef.current;

      if (dt > 0) {
        velocityRef.current = (clientY - currentYRef.current) / dt;
        lastTimeRef.current = now;
      }
      currentYRef.current = clientY;

      // Only allow downward movement (clamp upward drags to 0 for solid bottom-sheet physics)
      if (delta > 0) {
        setDragY(delta);
      } else {
        setDragY(0);
      }
    },
    [disabled]
  );

  const handleTouchEnd = useCallback(() => {
    if (!isDraggingRef.current || isDismissingRef.current || disabled) return;

    isDraggingRef.current = false;
    setIsDragging(false);

    const delta = currentYRef.current - startYRef.current;
    const velocity = velocityRef.current;

    // Trigger dismissal if dragged beyond threshold OR flicked quickly downward
    const isFlick = delta > 20 && velocity > velocityThreshold;
    const isPastThreshold = delta > threshold;

    if (isPastThreshold || isFlick) {
      isDismissingRef.current = true;
      setIsDismissing(true);

      const resolvedExit =
        exitDistance ?? (typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 800);

      setDragY(resolvedExit);

      timeoutRef.current = window.setTimeout(() => {
        onClose();
        setDragY(0);
        isDismissingRef.current = false;
        setIsDismissing(false);
      }, exitDuration);
    } else {
      // Snap back into resting position
      setDragY(0);
    }
  }, [disabled, exitDistance, exitDuration, onClose, threshold, velocityThreshold]);

  const handleTouchCancel = useCallback(() => {
    if (!isDraggingRef.current || isDismissingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    setDragY(0);
  }, []);

  const handleProps = {
    onTouchStart: (e: React.TouchEvent) => startDrag(e, false),
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel,
  };

  const contentProps = {
    onTouchStart: (e: React.TouchEvent) => startDrag(e, true),
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel,
  };

  const sheetStyle: React.CSSProperties = disabled
    ? {}
    : {
        transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
        transition: isDragging
          ? 'none'
          : dragY > 0
          ? 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
          : undefined,
      };

  const resetDrag = useCallback(() => {
    setDragY(0);
    isDraggingRef.current = false;
    isDismissingRef.current = false;
    setIsDragging(false);
    setIsDismissing(false);
  }, []);

  return {
    dragY,
    isDragging,
    isDismissing,
    handleProps,
    contentProps,
    sheetStyle,
    resetDrag,
  };
}
