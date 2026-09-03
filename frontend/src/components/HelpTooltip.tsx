import React, { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';

interface HelpTooltipProps {
  title: string;
  description: string;
  significance: string;
  children?: React.ReactNode;
  className?: string;
  /** If true, always renders a standalone ? icon (no children). */
  iconOnly?: boolean;
}

export const HelpTooltip: React.FC<HelpTooltipProps> = ({ title, description, significance, children, className, iconOnly }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({ opacity: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (isHovered && triggerRef.current && popoverRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const popoverRect = popoverRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      
      const tooltipWidth = popoverRect.width || 260; 
      const tooltipHeight = popoverRect.height || 150; 

      const placeRight = triggerRect.right + tooltipWidth < vw;
      const placeBottom = triggerRect.bottom + tooltipHeight < vh;

      let left = placeRight ? triggerRect.right + 8 : triggerRect.left - tooltipWidth - 8;
      let top = placeBottom ? triggerRect.top : triggerRect.bottom - tooltipHeight;

      // Clamp to viewport safe zones
      left = Math.max(8, Math.min(left, vw - tooltipWidth - 8));
      top = Math.max(8, Math.min(top, vh - tooltipHeight - 8));

      setStyle({ left, top, opacity: 1 });
    }
  };

  useLayoutEffect(() => {
    if (isHovered) {
      updatePosition();
      const rafId = requestAnimationFrame(updatePosition);
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      
      return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    } else {
      setStyle({ opacity: 0 });
    }
  }, [isHovered, title, description]);

  // Shared popover markup rendered into a portal so it escapes parent backdrop-filter contexts
  const popover = isHovered && typeof document !== 'undefined' ? createPortal(
    <div 
      ref={popoverRef}
      className="fixed z-[99999] w-64 bg-slate-950 border border-slate-700 shadow-[0_10px_40px_rgba(0,0,0,0.8)] rounded-xl p-3 text-left pointer-events-none transition-opacity duration-150 animate-in fade-in zoom-in-95 origin-top-left"
      style={style}
    >
      <h4 className="text-sm font-semibold text-white mb-1.5 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0"></span>
        {title}
      </h4>
      <p className="text-xs text-slate-300 leading-relaxed mb-2 pb-2 border-b border-white/10">
        {description}
      </p>
      <div className="bg-cyan-950/40 rounded border border-cyan-800/50 p-2">
        <span className="text-xs font-semibold text-cyan-500 mb-1 block">Oceanographic Significance</span>
        <p className="text-xs text-cyan-200/90 leading-relaxed">
          {significance}
        </p>
      </div>
    </div>,
    document.body
  ) : null;

  // Icon-only mode (for DraggablePanel header '?' button)
  if (iconOnly || !children) {
    return (
      <div
        ref={triggerRef}
        className={`relative inline-flex items-center justify-center ${className || ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <HelpCircle className="w-4 h-4 text-slate-400 hover:text-cyan-400 cursor-help transition-colors" />
        {popover}
      </div>
    );
  }

  // Children mode: render children + a small ? icon inline
  return (
    <div
      ref={triggerRef}
      className={`relative inline-flex items-center gap-1 ${className || ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      <HelpCircle className="w-3.5 h-3.5 text-slate-500 hover:text-cyan-400 cursor-help transition-colors shrink-0 opacity-60 group-hover:opacity-100" />
      {popover}
    </div>
  );
};
