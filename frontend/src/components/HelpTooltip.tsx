import React, { useState, useRef, useLayoutEffect } from 'react';
import { HelpCircle } from 'lucide-react';

interface HelpTooltipProps {
  title: string;
  description: string;
  significance: string;
  children?: React.ReactNode;
  className?: string;
}

export const HelpTooltip: React.FC<HelpTooltipProps> = ({ title, description, significance, children, className }) => {
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
      // requestAnimationFrame ensures it recalculates right after the DOM has definitively painted the dimensions
      const rafId = requestAnimationFrame(updatePosition);
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true); // true to catch scrolls on inner scrollable divs
      
      return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    } else {
      setStyle({ opacity: 0 });
    }
  }, [isHovered, title, description]);

  return (
    <div 
      className={`relative inline-flex items-center justify-center ${className || ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      ref={triggerRef}
    >
      {children ? children : <HelpCircle className="w-4 h-4 text-slate-400 hover:text-cyan-400 cursor-help transition-colors" />}

      {isHovered && (
        <div 
          ref={popoverRef}
          className="fixed z-[60] w-64 bg-slate-900/95 backdrop-blur-2xl border border-white/15 shadow-2xl rounded-xl p-3 text-left pointer-events-none transition-opacity duration-200 animate-in fade-in zoom-in-95 origin-top-left"
          style={style}
        >
          <h4 className="text-sm font-semibold text-white mb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
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
        </div>
      )}
    </div>
  );
};
