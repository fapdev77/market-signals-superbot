import React, { useState, useRef, useEffect, useLayoutEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type TooltipPosition = 
  | 'top' 
  | 'top-left' 
  | 'top-right' 
  | 'bottom' 
  | 'bottom-left' 
  | 'bottom-right' 
  | 'left' 
  | 'right';

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
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [computedPosition, setComputedPosition] = useState<TooltipPosition>(position);
  const [shiftX, setShiftX] = useState<number>(0);
  const [shiftY, setShiftY] = useState<number>(0);
  const [arrowCoord, setArrowCoord] = useState<number | null>(null);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      // Hide if element is scrolled out of viewport
      if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
        setIsVisible(false);
      } else {
        setTargetRect(rect);
      }
    }
  };

  const show = () => {
    if (disabled || !content) return;
    timeoutRef.current = setTimeout(() => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setTargetRect(rect);
        setComputedPosition(position);
        setShiftX(0);
        setShiftY(0);
        setArrowCoord(null);
        setIsVisible(true);
      }
    }, delay);
  };

  const hide = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
    setShiftX(0);
    setShiftY(0);
    setArrowCoord(null);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
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

  // Viewport Collision Detection & Adaptive Placement
  useLayoutEffect(() => {
    if (!isVisible || !targetRect || !tooltipRef.current) {
      return;
    }

    const tooltipEl = tooltipRef.current;
    const tWidth = tooltipEl.offsetWidth || 240;
    const tHeight = tooltipEl.offsetHeight || 80;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const margin = 12; // Safety boundary padding from screen edges

    let effectivePos = position;

    // 1. Resolve Best Placement (Auto-flip if off-screen)
    if (position === 'left') {
      const spaceLeft = targetRect.left;
      if (spaceLeft < tWidth + margin) {
        const spaceRight = viewportW - targetRect.right;
        if (spaceRight >= tWidth + margin) {
          effectivePos = 'right';
        } else {
          // If neither side fits (mobile/small screen), place vertically
          effectivePos = targetRect.top > tHeight + margin ? 'top' : 'bottom';
        }
      }
    } else if (position === 'right') {
      const spaceRight = viewportW - targetRect.right;
      if (spaceRight < tWidth + margin) {
        const spaceLeft = targetRect.left;
        if (spaceLeft >= tWidth + margin) {
          effectivePos = 'left';
        } else {
          effectivePos = targetRect.top > tHeight + margin ? 'top' : 'bottom';
        }
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

    // Auto-adjust horizontal alignment for top/bottom if close to window edges
    if (effectivePos === 'top' || effectivePos === 'bottom') {
      const centerX = targetRect.left + targetRect.width / 2;
      if (centerX + tWidth / 2 > viewportW - margin) {
        effectivePos = effectivePos === 'top' ? 'top-right' : 'bottom-right';
      } else if (centerX - tWidth / 2 < margin) {
        effectivePos = effectivePos === 'top' ? 'top-left' : 'bottom-left';
      }
    }

    setComputedPosition(effectivePos);

    // 2. Measure actual tooltip rectangle in the new effective position
    // Calculate initial estimated coordinates
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
      // Clamp arrow inside tooltip bounds with 14px padding from corners
      const clampedArrowX = Math.max(14, Math.min(tWidth - 14, relativeArrowX));
      setArrowCoord(clampedArrowX);
    } else {
      const targetCenterY = targetRect.top + targetRect.height / 2;
      const relativeArrowY = targetCenterY - finalTop;
      const clampedArrowY = Math.max(14, Math.min(tHeight - 14, relativeArrowY));
      setArrowCoord(clampedArrowY);
    }
  }, [isVisible, targetRect, position]);

  // Helper to compute tooltip styles in fixed coordinates (using portal)
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
      maxWidth: 'min(380px, calc(100vw - 24px))',
      zIndex: 999999,
      ...(shiftX !== 0 ? { marginLeft: `${shiftX}px` } : {}),
      ...(shiftY !== 0 ? { marginTop: `${shiftY}px` } : {})
    };
  };

  // Dynamic Arrow style & classes
  const getArrowStyleAndClass = () => {
    const isVertical = computedPosition.startsWith('top') || computedPosition.startsWith('bottom');

    let baseClass = 'absolute w-0 h-0 pointer-events-none border-4 ';
    let inlineStyle: React.CSSProperties = {};

    if (computedPosition.startsWith('top')) {
      baseClass += 'top-full border-t-neutral-800 border-x-transparent border-b-transparent';
      if (arrowCoord !== null) {
        inlineStyle = { left: `${arrowCoord}px`, transform: 'translateX(-50%)' };
      } else {
        baseClass += computedPosition === 'top-left' ? ' left-4' : computedPosition === 'top-right' ? ' right-4' : ' left-1/2 -translate-x-1/2';
      }
    } else if (computedPosition.startsWith('bottom')) {
      baseClass += 'bottom-full border-b-neutral-800 border-x-transparent border-t-transparent';
      if (arrowCoord !== null) {
        inlineStyle = { left: `${arrowCoord}px`, transform: 'translateX(-50%)' };
      } else {
        baseClass += computedPosition === 'bottom-left' ? ' left-4' : computedPosition === 'bottom-right' ? ' right-4' : ' left-1/2 -translate-x-1/2';
      }
    } else if (computedPosition === 'left') {
      baseClass += 'left-full border-l-neutral-800 border-y-transparent border-r-transparent';
      if (arrowCoord !== null) {
        inlineStyle = { top: `${arrowCoord}px`, transform: 'translateY(-50%)' };
      } else {
        baseClass += ' top-1/2 -translate-y-1/2';
      }
    } else if (computedPosition === 'right') {
      baseClass += 'right-full border-r-neutral-800 border-y-transparent border-l-transparent';
      if (arrowCoord !== null) {
        inlineStyle = { top: `${arrowCoord}px`, transform: 'translateY(-50%)' };
      } else {
        baseClass += ' top-1/2 -translate-y-1/2';
      }
    }

    return { baseClass, inlineStyle };
  };

  const arrowInfo = getArrowStyleAndClass();

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

      {isVisible && !disabled && targetRect && typeof document !== 'undefined' && createPortal(
        <div
          ref={tooltipRef}
          role="tooltip"
          className="pointer-events-none transition-opacity duration-150 ease-out whitespace-normal px-3 py-2 text-xs rounded-lg shadow-2xl bg-neutral-900/95 border border-neutral-700/80 backdrop-blur-md text-neutral-200 font-sans"
          style={getTooltipStyle()}
        >
          {title && (
            <div className="flex items-center justify-between gap-2 pb-1 mb-1 border-b border-white/10 font-semibold text-white">
              <span>{title}</span>
              {badge && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                  {badge}
                </span>
              )}
            </div>
          )}
          <div className="text-[11px] leading-relaxed text-neutral-300 font-normal">
            {content}
          </div>
          <div 
            className={arrowInfo.baseClass}
            style={arrowInfo.inlineStyle}
          />
        </div>,
        document.body
      )}
    </div>
  );
};

