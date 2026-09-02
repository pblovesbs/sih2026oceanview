import React, { useState, useRef } from 'react';
import { ChevronDown, ChevronRight, GripHorizontal, Minus, Square, X, LucideIcon, Expand } from 'lucide-react';
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
  const [isDragging, setIsDragging] = useState(false);
  const [minimized, setMinimized] = useState(defaultMinimized);
  const [maximized, setMaximized] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only drag if clicking on the header (not buttons inside it)
    if ((e.target as HTMLElement).closest('button')) return;
    
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
    };
    setIsDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const newX = dragRef.current.initialX + dx;
    const newY = dragRef.current.initialY + dy;
    
    // Viewport clamping: prevent dragging off-screen
    const clampedX = Math.max(8, Math.min(window.innerWidth - 80, newX));
    const clampedY = Math.max(8, Math.min(window.innerHeight - 50, newY));

    setPosition({ x: clampedX, y: clampedY });
  };


  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setIsDragging(false);
      dragRef.current = null;
    }
  };

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="absolute z-[40] w-12 h-12 bg-slate-900/80 backdrop-blur-xl border border-cyan-500/50 rounded-full shadow-2xl flex items-center justify-center hover:bg-slate-800 transition-colors pointer-events-auto"
        style={{ left: position.x, top: position.y }}
        title={`Restore ${title}`}
      >
        {Icon ? <Icon className="w-5 h-5 text-cyan-400" /> : <Square className="w-5 h-5 text-cyan-400" />}
      </button>
    );
  }

  const panelStyle = maximized
    ? { left: 0, top: 64, width: '100vw', height: 'calc(100vh - 64px)', position: 'fixed' as const }
    : { left: position.x, top: position.y, touchAction: 'none' };

  return (
    <div
      className={`absolute z-[40] flex flex-col bg-black/60 backdrop-blur-[16px] border border-white/15 rounded-xl shadow-2xl transition-all duration-200 pointer-events-auto ${isDragging ? 'opacity-90' : 'opacity-100'} ${maximized ? 'rounded-none border-none' : ''}`}
      style={panelStyle}
    >
      {/* Header Bar */}
      <div
        className={`flex items-center justify-between px-3 py-2 border-b ${maximized ? '' : 'cursor-grab active:cursor-grabbing'} border-white/10`}
        onPointerDown={maximized ? undefined : onPointerDown}
        onPointerMove={maximized ? undefined : onPointerMove}
        onPointerUp={maximized ? undefined : onPointerUp}
        onPointerCancel={maximized ? undefined : onPointerUp}
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

      {/* Content */}
      <div className="transition-all flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <div className="p-3 h-full">
          {children}
        </div>
      </div>
    </div>
  );
};
