import { useDesignStore } from '@/store/designStore';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

// Detect touch devices including iPads (which may report as desktop)
function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const checkTouch = () => {
      // Check for touch capability
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      // Check for iPad specifically (iPadOS 13+ reports as Mac)
      const isIPad = /iPad/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      // Check for mobile/tablet user agents
      const isMobileUA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      setIsTouch(hasTouch && (isIPad || isMobileUA || window.innerWidth < 1024));
    };

    checkTouch();
    window.addEventListener('resize', checkTouch);
    return () => window.removeEventListener('resize', checkTouch);
  }, []);

  return isTouch;
}

export function FloatingShiftToggle() {
  const shiftPressed = useDesignStore((state) => state.shiftPressed);
  const setShiftPressed = useDesignStore((state) => state.setShiftPressed);
  const isTouchDevice = useIsTouchDevice();

  // Only show on touch devices (mobile, tablet, iPad)
  if (!isTouchDevice) return null;

  return (
    <button
      onClick={() => setShiftPressed(!shiftPressed)}
      className={cn(
        'w-14 h-14 rounded-full flex items-center justify-center',
        'border-2 shadow-lg transition-all duration-200',
        'touch-manipulation select-none',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary',
        shiftPressed
          ? 'bg-primary border-primary text-primary-foreground shadow-primary/25'
          : 'bg-background border-border text-muted-foreground hover:border-primary/50'
      )}
      title={shiftPressed ? 'Shift mode ON (tap to disable)' : 'Shift mode OFF (tap to enable)'}
      aria-pressed={shiftPressed}
      aria-label="Toggle shift mode"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(
          'w-6 h-6 transition-transform',
          shiftPressed && 'scale-110'
        )}
      >
        {/* Shift arrow icon */}
        <path d="M12 19V5" />
        <path d="M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
