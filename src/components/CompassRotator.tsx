import { useState, useRef, useEffect } from 'react';
import { RotateCw } from 'lucide-react';

interface CompassRotatorProps {
  rotation: number; // Current rotation in degrees
  onChange: (rotation: number) => void;
  visible: boolean;
}

export const CompassRotator = ({ rotation, onChange, visible }: CompassRotatorProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const compassRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!compassRef.current) return;

      const rect = compassRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;

      // Calculate angle in degrees (0° = North/Up, clockwise)
      let angle = Math.atan2(deltaX, -deltaY) * (180 / Math.PI);

      // Normalize to 0-360
      if (angle < 0) angle += 360;

      // Round to nearest 1 degree
      angle = Math.round(angle);

      onChange(angle);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onChange]);

  const handleReset = () => {
    onChange(0);
  };

  if (!visible) return null;

  return (
    <div className="absolute bottom-4 left-4 z-50 flex flex-col items-center gap-2">
      {/* Compass Circle */}
      <div
        ref={compassRef}
        className="relative w-20 h-20 rounded-full bg-background border-2 border-border shadow-lg cursor-grab active:cursor-grabbing select-none"
        onMouseDown={() => setIsDragging(true)}
        style={{ touchAction: 'none' }}
      >
        {/* Cardinal directions */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="absolute top-1 text-xs font-bold text-foreground">N</div>
          <div className="absolute bottom-1 text-xs font-bold text-muted-foreground">S</div>
          <div className="absolute right-1 text-xs font-bold text-muted-foreground">E</div>
          <div className="absolute left-1 text-xs font-bold text-muted-foreground">W</div>
        </div>

        {/* Rotating needle */}
        <div
          className="absolute inset-0 flex items-center justify-center transition-transform"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div className="w-1 h-8 bg-red-500 rounded-full" style={{ marginTop: '-16px' }}></div>
        </div>

        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 bg-foreground rounded-full"></div>
        </div>
      </div>

      {/* Rotation Display and Reset */}
      <div className="flex items-center gap-2 bg-background border border-border rounded-md px-2 py-1 shadow-sm">
        <span className="text-xs font-medium text-foreground">
          {rotation}°
        </span>
        <button
          onClick={handleReset}
          className="p-1 hover:bg-accent rounded transition-colors"
          title="Reset rotation"
        >
          <RotateCw className="w-3 h-3 text-muted-foreground hover:text-foreground" />
        </button>
      </div>
    </div>
  );
};
