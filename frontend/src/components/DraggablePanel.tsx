import React, { useState, useRef, useEffect } from 'react';
import { GripHorizontal, Minus, Square, X, LucideIcon, Expand } from 'lucide-react';
import { HelpTooltip } from './HelpTooltip';

interface DraggablePanelProps {
  id: string;
  title: string;
  icon?: LucideIcon;
  initialPosition: { x: number; y: number };
  children: React.ReactNode;
  help?: {
    description: string;
    significance: string;
  };
  defaultMinimized?: boolean;
  onClose?: () => void;
  allowMaximize?: boolean;
}

export const DraggablePanel: React.FC<DraggablePanelProps> = ({
  id,
  title,
  icon: Icon,
  initialPosition,
  children,
  help,
  defaultMinimized = false,
  onClose,
  allowMaximize = false,
}) => {
  const [position, setPosition] = useState(initialPosition);
  const [minimized, setMinimized] = useState(defaultMinimized);
  const [maximized, setMaximized] = useState(false);
  const [isMinDragging, setIsMinDragging] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const minRef = useRef<HTMLDivElement>(null);
  const currentCoords = useRef(initialPosition);
  const dragState = useRef({ startX: 0, startY: 0, originX: 0, originY: 0, dragging: false });
  const minDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; hasMoved: boolean } | null>(null);
  const rafId = useRef<number | null>(null);
  const pendingCoords = useRef<{ x: number; y: number } | null>(null);

  // Sync coords ref when position state changes (e.g. initialPosition changes)
  useEffect(() => {
    currentCoords.current = position;
  }, [position]);

  // Clean up any pending animation frame on unmount
  useEffect(() => {
    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  const flushTransform = () => {
    rafId.current = null;
    if (!pendingCoords.current) return;
    const { x, y } = pendingCoords.current;
    currentCoords.current = { x, y };
    const target = minimized ? minRef.current : panelRef.current;
    if (target) {
      target.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
  };

  // ── Drag Handling for Open Panel ───────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only drag if not clicking buttons or interactive inputs inside
    if ((e.target as HTMLElement).closest('button, input, select, textarea, a')) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}

    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: currentCoords.current.x,
      originY: currentCoords.current.y,
      dragging: true,
    };

    if (panelRef.current) {
      panelRef.current.style.setProperty('will-change', 'transform');
      panelRef.current.style.transition = 'none';
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.dragging) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;

    // Viewport clamping
    const clampedX = Math.max(8, Math.min(window.innerWidth - 80, dragState.current.originX + dx));
    const clampedY = Math.max(8, Math.min(window.innerHeight - 50, dragState.current.originY + dy));

    pendingCoords.current = { x: clampedX, y: clampedY };

    if (rafId.current === null) {
      rafId.current = requestAnimationFrame(flushTransform);
    }
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.dragging) return;
    dragState.current.dragging = false;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}

    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }

    if (pendingCoords.current) {
      currentCoords.current = pendingCoords.current;
      setPosition(pendingCoords.current);
      pendingCoords.current = null;
    }

    if (panelRef.current) {
      panelRef.current.style.removeProperty('will-change');
      panelRef.current.style.transition = '';
    }
  };

  // ── Drag & Click Handling for Minimized Icon ─────────────────────────────
  const onMinPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}

    minDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: currentCoords.current.x,
      originY: currentCoords.current.y,
      hasMoved: false,
    };

    if (minRef.current) {
      minRef.current.style.setProperty('will-change', 'transform');
      minRef.current.style.transition = 'none';
    }
  };

  const onMinPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!minDragRef.current) return;
    const dx = e.clientX - minDragRef.current.startX;
    const dy = e.clientY - minDragRef.current.startY;

    if (!minDragRef.current.hasMoved && Math.hypot(dx, dy) > 4) {
      minDragRef.current.hasMoved = true;
      setIsMinDragging(true);
    }

    if (minDragRef.current.hasMoved) {
      const clampedX = Math.max(8, Math.min(window.innerWidth - 56, minDragRef.current.originX + dx));
      const clampedY = Math.max(8, Math.min(window.innerHeight - 56, minDragRef.current.originY + dy));
      pendingCoords.current = { x: clampedX, y: clampedY };
      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(flushTransform);
      }
    }
  };

  const onMinPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!minDragRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}

    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }

    if (!minDragRef.current.hasMoved) {
      // Single click/tap with no drag -> restore panel
      setMinimized(false);
    } else if (pendingCoords.current) {
      currentCoords.current = pendingCoords.current;
      setPosition(pendingCoords.current);
      pendingCoords.current = null;
    }

    if (minRef.current) {
      minRef.current.style.removeProperty('will-change');
      minRef.current.style.transition = '';
    }

    minDragRef.current = null;
    setIsMinDragging(false);
  };

  if (minimized) {
    return (
      <div
        ref={minRef}
        onPointerDown={onMinPointerDown}
        onPointerMove={onMinPointerMove}
        onPointerUp={onMinPointerUp}
        onPointerCancel={onMinPointerUp}
        onLostPointerCapture={onMinPointerUp}
        className={`absolute z-[40] w-12 h-12 bg-slate-900/85 backdrop-blur-xl border border-cyan-500/50 rounded-full shadow-2xl flex items-center justify-center pointer-events-auto cursor-grab active:cursor-grabbing select-none transition-transform ${
          isMinDragging
            ? 'scale-110 ring-2 ring-cyan-400 shadow-cyan-500/40 bg-slate-800'
            : 'hover:bg-slate-800 hover:scale-105'
        }`}
        style={{
          left: 0,
          top: 0,
          transform: `translate3d(${currentCoords.current.x}px, ${currentCoords.current.y}px, 0)`,
          touchAction: 'none',
        }}
        title={`Click to restore or drag to move ${title}`}
      >
        {Icon ? <Icon className="w-5 h-5 text-cyan-400 pointer-events-none" /> : <Square className="w-5 h-5 text-cyan-400 pointer-events-none" />}
      </div>
    );
  }

  const panelStyle: React.CSSProperties = maximized
    ? { left: 0, top: 64, width: '100vw', height: 'calc(100vh - 64px)', position: 'fixed', transform: 'none' }
    : {
        left: 0,
        top: 0,
        transform: `translate3d(${currentCoords.current.x}px, ${currentCoords.current.y}px, 0)`,
      };

  const dragProps = maximized ? {} : {
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onLostPointerCapture: endDrag,
    style: { touchAction: 'none' as const },
  };

  return (
    <div
      ref={panelRef}
      className={`absolute z-[40] flex flex-col bg-black/60 backdrop-blur-[16px] border border-white/15 rounded-xl shadow-2xl pointer-events-auto ${
        maximized ? 'rounded-none border-none' : ''
      }`}
      style={panelStyle}
    >
      {/* Invisible Border Drag Handles with touchAction: none */}
      {!maximized && (
        <>
          <div className="absolute top-0 left-0 right-0 h-3 cursor-grab active:cursor-grabbing z-50 rounded-t-xl" {...dragProps} />
          <div className="absolute bottom-0 left-0 right-0 h-3 cursor-grab active:cursor-grabbing z-50 rounded-b-xl" {...dragProps} />
          <div className="absolute left-0 top-0 bottom-0 w-3 cursor-grab active:cursor-grabbing z-50 rounded-l-xl" {...dragProps} />
          <div className="absolute right-0 top-0 bottom-0 w-3 cursor-grab active:cursor-grabbing z-50 rounded-r-xl" {...dragProps} />
        </>
      )}

      {/* Header Bar */}
      <div
        className={`flex items-center justify-between px-3 py-2 border-b ${maximized ? '' : 'cursor-grab active:cursor-grabbing'} border-white/10`}
        {...dragProps}
      >
        <div className="flex items-center gap-2">
          {!maximized && <GripHorizontal className="w-4 h-4 text-slate-500" />}
          {Icon && <Icon className="w-4 h-4 text-cyan-400" />}
          <h3 className="text-sm font-semibold text-slate-200 select-none">
            {title}
          </h3>
          {help && (
            <div className="ml-1 flex items-center justify-center">
              <HelpTooltip
                title={title}
                description={help.description}
                significance={help.significance}
                iconOnly={true}
              />
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMinimized(true)}
            className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          
          {allowMaximize && (
            <button
              onClick={() => setMaximized(!maximized)}
              className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title={maximized ? "Restore" : "Maximize"}
            >
              {maximized ? <Square className="w-3.5 h-3.5" /> : <Expand className="w-3.5 h-3.5" />}
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors ml-1"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content — native touch-action and scrolling preserved */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar" style={{ maxHeight: maximized ? 'calc(100vh - 108px)' : '70vh' }}>
        <div className="p-3 h-full">
          {children}
        </div>
      </div>
    </div>
  );
};
