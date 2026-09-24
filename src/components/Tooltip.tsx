import React, { useState, useRef, useEffect, useLayoutEffect, useContext, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ThemeContext } from '../context/ThemeContext';

export type TooltipPosition = 
  | 'top' 
  | 'top-left' 
  | 'top-right' 
  | 'bottom' 
  | 'bottom-left' 
  | 'bottom-right' 
  | 'left' 
  | 'right';

export type TooltipVariant = 'auto' | 'dark' | 'light';

export type TooltipBadgeColor = 'amber' | 'cyan' | 'orange' | 'emerald' | 'rose' | 'purple' | 'blue';

export interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  title?: ReactNode;
  badge?: ReactNode;
  badgeColor?: TooltipBadgeColor;
  shortcut?: string;
  icon?: React.ComponentType<{ className?: string }>;
  position?: TooltipPosition;
  variant?: TooltipVariant;
  delay?: number;
  className?: string;
  disabled?: boolean;
  maxWidth?: number | string;
  interactive?: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  title,
  badge,
  badgeColor = 'amber',
  shortcut,
  icon: Icon,
  position = 'top',
  variant = 'auto',
  delay = 120,
  className = '',
  disabled = false,
  maxWidth,
  interactive = false
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [computedPosition, setComputedPosition] = useState<TooltipPosition>(position);
  const [shiftX, setShiftX] = useState<number>(0);
  const [shiftY, setShiftY] = useState<number>(0);
  const [arrowCoord, setArrowCoord] = useState<number | null>(null);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchDismissTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Safely get theme context without hook-in-try-catch violation
  const themeCtx = useContext(ThemeContext);
  const [domIsDark, setDomIsDark] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      return !document.documentElement.classList.contains('theme-light');
    }
    return true;
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const updateDomTheme = () => {
      setDomIsDark(!document.documentElement.classList.contains('theme-light'));
    };
    updateDomTheme();
    const observer = new MutationObserver(updateDomTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    return () => observer.disconnect();
  }, []);

  const isDarkMode = themeCtx ? themeCtx.isDark : domIsDark;
  const isEffectiveDark = variant === 'dark' ? true : variant === 'light' ? false : isDarkMode;

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
        setIsVisible(false);
      } else {
        setTargetRect(rect);
      }
    }
  };

  const show = (isTouch = false) => {
    if (disabled || !content) return;
    
    // Clear any existing dismissal timer
    if (touchDismissTimeoutRef.current) {
      clearTimeout(touchDismissTimeoutRef.current);
      touchDismissTimeoutRef.current = null;
    }

    const triggerDelay = isTouch ? 0 : delay;

    timeoutRef.current = setTimeout(() => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setTargetRect(rect);
        setComputedPosition(position);
        setShiftX(0);
        setShiftY(0);
        setArrowCoord(null);
        setIsVisible(true);

        // Auto-dismiss on touch devices after 3.2 seconds so it never gets stuck
        if (isTouch) {
          touchDismissTimeoutRef.current = setTimeout(() => {
            hide();
          }, 3200);
        }
      }
    }, triggerDelay);
  };

  const hide = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (touchDismissTimeoutRef.current) {
      clearTimeout(touchDismissTimeoutRef.current);
      touchDismissTimeoutRef.current = null;
    }
    setIsVisible(false);
    setShiftX(0);
    setShiftY(0);
    setArrowCoord(null);
  };

  // Close when tapping anywhere outside (especially crucial on mobile/tablets)
  useEffect(() => {
    if (!isVisible) return;

    const handlePointerDownOutside = (e: PointerEvent) => {
      if (
        containerRef.current && 
        !containerRef.current.contains(e.target as Node) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node)
      ) {
        hide();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hide();
      }
    };

    window.addEventListener('pointerdown', handlePointerDownOutside, { capture: true });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDownOutside, { capture: true });
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVisible]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (touchDismissTimeoutRef.current) clearTimeout(touchDismissTimeoutRef.current);
    };
  }, []);

  // Update position on scroll/resize when visible
  useEffect(() => {
    if (!isVisible) return;
    const handleUpdate = () => {
      updateCoords();
    };
    window.addEventListener('scroll', handleUpdate, { passive: true, capture: true });
    window.addEventListener('resize', handleUpdate, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleUpdate, { capture: true });
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isVisible]);

  // Viewport Collision Detection & Precision Adaptive Placement
  useLayoutEffect(() => {
    if (!isVisible || !targetRect || !tooltipRef.current) {
      return;
    }

    const tooltipEl = tooltipRef.current;
    const tWidth = tooltipEl.offsetWidth || 240;
    const tHeight = tooltipEl.offsetHeight || 80;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const margin = 12; // Safety margin from screen borders

    let effectivePos = position;

    // 1. Placement Flipping if clipped
    if (position === 'left') {
      const spaceLeft = targetRect.left;
      if (spaceLeft < tWidth + margin) {
        const spaceRight = viewportW - targetRect.right;
        effectivePos = spaceRight >= tWidth + margin ? 'right' : (targetRect.top > tHeight + margin ? 'top' : 'bottom');
      }
    } else if (position === 'right') {
      const spaceRight = viewportW - targetRect.right;
      if (spaceRight < tWidth + margin) {
        const spaceLeft = targetRect.left;
        effectivePos = spaceLeft >= tWidth + margin ? 'left' : (targetRect.top > tHeight + margin ? 'top' : 'bottom');
      }
    } else if (position.startsWith('top')) {
      const spaceTop = targetRect.top;
      if (spaceTop < tHeight + margin) {
        const spaceBottom = viewportH - targetRect.bottom;
        if (spaceBottom >= spaceTop) {
          effectivePos = position.replace('top', 'bottom') as TooltipPosition;
        }
      }
    } else if (position.startsWith('bottom')) {
      const spaceBottom = viewportH - targetRect.bottom;
      if (spaceBottom < tHeight + margin) {
        const spaceTop = targetRect.top;
        if (spaceTop >= spaceBottom) {
          effectivePos = position.replace('bottom', 'top') as TooltipPosition;
        }
      }
    }

    // Auto-adjust horizontal alignment for top/bottom if close to viewport boundaries
    if (effectivePos === 'top' || effectivePos === 'bottom') {
      const centerX = targetRect.left + targetRect.width / 2;
      if (centerX + tWidth / 2 > viewportW - margin) {
        effectivePos = effectivePos === 'top' ? 'top-right' : 'bottom-right';
      } else if (centerX - tWidth / 2 < margin) {
        effectivePos = effectivePos === 'top' ? 'top-left' : 'bottom-left';
      }
    }

    setComputedPosition(effectivePos);

    // 2. Measure actual tooltip coordinates
    let initLeft = 0;
    let initTop = 0;

    switch (effectivePos) {
      case 'top':
        initLeft = targetRect.left + targetRect.width / 2 - tWidth / 2;
        initTop = targetRect.top - 8 - tHeight;
        break;
      case 'top-left':
        initLeft = targetRect.left;
        initTop = targetRect.top - 8 - tHeight;
        break;
      case 'top-right':
        initLeft = targetRect.right - tWidth;
        initTop = targetRect.top - 8 - tHeight;
        break;
      case 'bottom':
        initLeft = targetRect.left + targetRect.width / 2 - tWidth / 2;
        initTop = targetRect.bottom + 8;
        break;
      case 'bottom-left':
        initLeft = targetRect.left;
        initTop = targetRect.bottom + 8;
        break;
      case 'bottom-right':
        initLeft = targetRect.right - tWidth;
        initTop = targetRect.bottom + 8;
        break;
      case 'left':
        initLeft = targetRect.left - 8 - tWidth;
        initTop = targetRect.top + targetRect.height / 2 - tHeight / 2;
        break;
      case 'right':
        initLeft = targetRect.right + 8;
        initTop = targetRect.top + targetRect.height / 2 - tHeight / 2;
        break;
    }

    // 3. Screen Boundary Clamping
    let newShiftX = 0;
    let newShiftY = 0;

    if (initLeft + tWidth > viewportW - margin) {
      newShiftX = (viewportW - margin) - (initLeft + tWidth);
    } else if (initLeft < margin) {
      newShiftX = margin - initLeft;
    }

    if (initTop + tHeight > viewportH - margin) {
      newShiftY = (viewportH - margin) - (initTop + tHeight);
    } else if (initTop < margin) {
      newShiftY = margin - initTop;
    }

    setShiftX(newShiftX);
    setShiftY(newShiftY);

    // 4. Precision Arrow Centering
    const finalLeft = initLeft + newShiftX;
    const finalTop = initTop + newShiftY;

    if (effectivePos.startsWith('top') || effectivePos.startsWith('bottom')) {
      const targetCenterX = targetRect.left + targetRect.width / 2;
      const relativeArrowX = targetCenterX - finalLeft;
      const clampedArrowX = Math.max(14, Math.min(tWidth - 14, relativeArrowX));
      setArrowCoord(clampedArrowX);
    } else {
      const targetCenterY = targetRect.top + targetRect.height / 2;
      const relativeArrowY = targetCenterY - finalTop;
      const clampedArrowY = Math.max(14, Math.min(tHeight - 14, relativeArrowY));
      setArrowCoord(clampedArrowY);
    }
  }, [isVisible, targetRect, position]);

  // Compute fixed position style
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) return { display: 'none' };

    let top = 0;
    let left = 0;
    let transform = '';

    switch (computedPosition) {
      case 'top':
        top = targetRect.top - 8;
        left = targetRect.left + targetRect.width / 2;
        transform = 'translate(-50%, -100%)';
        break;
      case 'top-left':
        top = targetRect.top - 8;
        left = targetRect.left;
        transform = 'translate(0, -100%)';
        break;
      case 'top-right':
        top = targetRect.top - 8;
        left = targetRect.right;
        transform = 'translate(-100%, -100%)';
        break;
      case 'bottom':
        top = targetRect.bottom + 8;
        left = targetRect.left + targetRect.width / 2;
        transform = 'translate(-50%, 0)';
        break;
      case 'bottom-left':
        top = targetRect.bottom + 8;
        left = targetRect.left;
        transform = 'translate(0, 0)';
        break;
      case 'bottom-right':
        top = targetRect.bottom + 8;
        left = targetRect.right;
        transform = 'translate(-100%, 0)';
        break;
      case 'left':
        top = targetRect.top + targetRect.height / 2;
        left = targetRect.left - 8;
        transform = 'translate(-100%, -50%)';
        break;
      case 'right':
        top = targetRect.top + targetRect.height / 2;
        left = targetRect.right + 8;
        transform = 'translate(0, -50%)';
        break;
    }

    return {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      transform,
      minWidth: '180px',
      maxWidth: maxWidth ? (typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth) : 'min(380px, calc(100vw - 24px))',
      zIndex: 999999,
      pointerEvents: interactive ? 'auto' : 'none',
      ...(shiftX !== 0 ? { marginLeft: `${shiftX}px` } : {}),
      ...(shiftY !== 0 ? { marginTop: `${shiftY}px` } : {})
    };
  };

  // Badge styling depending on color and active theme
  const getBadgeClasses = () => {
    if (isEffectiveDark) {
      switch (badgeColor) {
        case 'cyan':
          return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
        case 'orange':
          return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
        case 'emerald':
          return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
        case 'rose':
          return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
        case 'purple':
          return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
        case 'blue':
          return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
        case 'amber':
        default:
          return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      }
    } else {
      switch (badgeColor) {
        case 'cyan':
          return 'bg-cyan-100 text-cyan-900 border-cyan-300 font-semibold';
        case 'orange':
          return 'bg-orange-100 text-orange-900 border-orange-300 font-semibold';
        case 'emerald':
          return 'bg-emerald-100 text-emerald-900 border-emerald-300 font-semibold';
        case 'rose':
          return 'bg-rose-100 text-rose-900 border-rose-300 font-semibold';
        case 'purple':
          return 'bg-purple-100 text-purple-900 border-purple-300 font-semibold';
        case 'blue':
          return 'bg-blue-100 text-blue-900 border-blue-300 font-semibold';
        case 'amber':
        default:
          return 'bg-amber-100 text-amber-900 border-amber-300 font-semibold';
      }
    }
  };

  // Precise rotated square arrow (never breaks or suffers from global CSS border overrides)
  const renderArrow = () => {
    const isTop = computedPosition.startsWith('top');
    const isBottom = computedPosition.startsWith('bottom');
    const isLeft = computedPosition === 'left';
    const isRight = computedPosition === 'right';

    let arrowStyle: React.CSSProperties = {
      position: 'absolute',
      width: '8px',
      height: '8px',
      transform: 'rotate(45deg)',
      pointerEvents: 'none',
      backgroundColor: isEffectiveDark ? '#0c0f17' : '#ffffff',
    };

    if (isTop) {
      arrowStyle = {
        ...arrowStyle,
        bottom: '-4px',
        left: arrowCoord !== null ? `${arrowCoord}px` : '50%',
        marginLeft: arrowCoord !== null ? '-4px' : '-4px',
        borderRight: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #cbd5e1',
        borderBottom: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #cbd5e1',
      };
    } else if (isBottom) {
      arrowStyle = {
        ...arrowStyle,
        top: '-4px',
        left: arrowCoord !== null ? `${arrowCoord}px` : '50%',
        marginLeft: arrowCoord !== null ? '-4px' : '-4px',
        borderLeft: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #cbd5e1',
        borderTop: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #cbd5e1',
      };
    } else if (isLeft) {
      arrowStyle = {
        ...arrowStyle,
        right: '-4px',
        top: arrowCoord !== null ? `${arrowCoord}px` : '50%',
        marginTop: arrowCoord !== null ? '-4px' : '-4px',
        borderTop: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #cbd5e1',
        borderRight: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #cbd5e1',
      };
    } else if (isRight) {
      arrowStyle = {
        ...arrowStyle,
        left: '-4px',
        top: arrowCoord !== null ? `${arrowCoord}px` : '50%',
        marginTop: arrowCoord !== null ? '-4px' : '-4px',
        borderBottom: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #cbd5e1',
        borderLeft: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #cbd5e1',
      };
    }

    return <div style={arrowStyle} />;
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => show(false)}
      onMouseLeave={hide}
      onFocus={() => show(false)}
      onBlur={hide}
      onTouchStart={() => show(true)}
    >
      {children}

      {isVisible && !disabled && targetRect && typeof document !== 'undefined' && createPortal(
        <div
          ref={tooltipRef}
          role="tooltip"
          className={`ui-tooltip-root transition-all duration-150 ease-out whitespace-normal px-3 py-2 text-xs rounded-xl backdrop-blur-md font-sans select-none ${
            isEffectiveDark 
              ? 'tooltip-mode-dark bg-[#0c0f17]/95 text-slate-100 border border-white/15 shadow-2xl shadow-black/80' 
              : 'tooltip-mode-light bg-white/98 text-slate-800 border border-slate-300 shadow-xl shadow-slate-900/15'
          }`}
          style={{
            ...getTooltipStyle(),
            // Inline high-specificity protection
            color: isEffectiveDark ? '#f1f5f9' : '#1e293b',
            backgroundColor: isEffectiveDark ? 'rgba(12, 15, 23, 0.96)' : 'rgba(255, 255, 255, 0.98)',
            borderColor: isEffectiveDark ? 'rgba(255, 255, 255, 0.15)' : '#cbd5e1'
          }}
        >
          {/* Header Title + Badges + Shortcuts */}
          {(title || badge || shortcut) && (
            <div 
              className={`ui-tooltip-title flex items-center justify-between gap-2 pb-1.5 mb-1.5 font-semibold text-xs border-b ${
                isEffectiveDark ? 'border-white/10 text-white' : 'border-slate-200 text-slate-950 font-bold'
              }`}
              style={{
                color: isEffectiveDark ? '#ffffff' : '#0f172a',
                borderColor: isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0'
              }}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {Icon && <Icon className={`w-3.5 h-3.5 shrink-0 ${isEffectiveDark ? 'text-orange-400' : 'text-orange-600'}`} />}
                <span className="truncate">{title}</span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {badge && (
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase tracking-wider ${getBadgeClasses()}`}>
                    {badge}
                  </span>
                )}
                {shortcut && (
                  <kbd className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                    isEffectiveDark 
                      ? 'bg-white/10 text-slate-300 border-white/20' 
                      : 'bg-slate-100 text-slate-700 border-slate-300'
                  }`}>
                    {shortcut}
                  </kbd>
                )}
              </div>
            </div>
          )}

          {/* Body Content with guaranteed readable typography */}
          <div 
            className={`ui-tooltip-body text-[11px] leading-relaxed font-normal ${
              isEffectiveDark ? 'text-slate-200' : 'text-slate-600'
            }`}
            style={{
              color: isEffectiveDark ? '#e2e8f0' : '#475569'
            }}
          >
            {content}
          </div>

          {/* Dynamic Precision Rotated Arrow */}
          {renderArrow()}
        </div>,
        document.body
      )}
    </div>
  );
};

export const AppTooltip = Tooltip;
export default Tooltip;
