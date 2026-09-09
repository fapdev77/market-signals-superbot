import React, { useState, useRef, useEffect, ReactNode } from 'react';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  title?: string;
  badge?: string;
  position?: TooltipPosition;
  delay?: number;
  className?: string;
  disabled?: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  title,
  badge,
  position = 'top',
  delay = 150,
  className = '',
  disabled = false
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const show = () => {
    if (disabled || !content) return;
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hide = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Position classes
  const positionClasses: Record<TooltipPosition, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  // Arrow classes
  const arrowClasses: Record<TooltipPosition, string> = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-neutral-800 border-x-transparent border-b-transparent border-4',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-neutral-800 border-x-transparent border-t-transparent border-4',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-neutral-800 border-y-transparent border-r-transparent border-4',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-neutral-800 border-y-transparent border-l-transparent border-4'
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}

      {isVisible && !disabled && (
        <div
          role="tooltip"
          className={`absolute z-[9999] pointer-events-none transition-opacity duration-150 ease-out whitespace-normal max-w-xs sm:max-w-sm px-3 py-2 text-xs rounded-lg shadow-2xl bg-neutral-900/95 border border-neutral-700/80 backdrop-blur-md text-neutral-200 ${positionClasses[position]}`}
          style={{ minWidth: '160px' }}
        >
          {title && (
            <div className="flex items-center justify-between gap-2 pb-1 mb-1 border-b border-white/10 font-semibold text-white">
              <span>{title}</span>
              {badge && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {badge}
                </span>
              )}
            </div>
          )}
          <div className="text-[11px] leading-relaxed text-neutral-300 font-normal">
            {content}
          </div>
          <div className={`absolute w-0 h-0 pointer-events-none ${arrowClasses[position]}`} />
        </div>
      )}
    </div>
  );
};
