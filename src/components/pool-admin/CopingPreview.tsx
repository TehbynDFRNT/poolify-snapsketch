import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface Point {
  x: number;
  y: number;
}

interface CopingPaver {
  id: string;
  position: Point;
  dimensions: { width: number; height: number };
  rotation: number;
  type: 'corner' | 'full' | 'stripe_cut';
  cut_width?: number;
}

interface CopingPreviewProps {
  poolOutline: Point[];
  copingLayout: {
    pavers: CopingPaver[];
    metadata: any;
  } | null;
  width?: number;
  height?: number;
}

export default function CopingPreview({ 
  poolOutline, 
  copingLayout, 
  width = 900, 
  height = 600 
}: CopingPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const GROUT_WIDTH = 5;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    if (poolOutline && poolOutline.length > 2) {
      ctx.beginPath();
      ctx.moveTo(poolOutline[0].x, poolOutline[0].y);
      
      for (let i = 1; i < poolOutline.length; i++) {
        ctx.lineTo(poolOutline[i].x, poolOutline[i].y);
      }
      
      ctx.closePath();
      ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
      ctx.fill();
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    if (copingLayout?.pavers) {
      copingLayout.pavers.forEach(paver => {
        ctx.save();
        ctx.translate(paver.position.x, paver.position.y);
        ctx.rotate((paver.rotation * Math.PI) / 180);

        const fillColor = 
          paver.type === 'corner' ? '#D4A574' :
          paver.type === 'stripe_cut' ? '#B8956A' :
          '#C9A66B';

        ctx.fillStyle = fillColor;
        ctx.fillRect(
          -GROUT_WIDTH / 2, 
          -GROUT_WIDTH / 2, 
          paver.dimensions.width - GROUT_WIDTH, 
          paver.dimensions.height - GROUT_WIDTH
        );

        ctx.strokeStyle = '#8B6F47';
        ctx.lineWidth = 1;
        ctx.strokeRect(
          -GROUT_WIDTH / 2, 
          -GROUT_WIDTH / 2, 
          paver.dimensions.width - GROUT_WIDTH, 
          paver.dimensions.height - GROUT_WIDTH
        );

        ctx.restore();
      });
    }

    ctx.restore();
  }, [poolOutline, copingLayout, width, height, zoom, pan]);

  const handleZoomIn = () => setZoom(Math.min(zoom * 1.2, 3));
  const handleZoomOut = () => setZoom(Math.max(zoom / 1.2, 0.3));
  const handleZoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  if (!poolOutline || poolOutline.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-muted rounded">
        <p className="text-muted-foreground">No pool outline to preview</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="border rounded bg-background"
      />

      <div className="absolute top-4 right-4 flex gap-2 bg-card rounded shadow-lg p-2">
        <Button size="sm" variant="outline" onClick={handleZoomOut}>
          −
        </Button>
        <Button size="sm" variant="outline" onClick={handleZoomReset}>
          {Math.round(zoom * 100)}%
        </Button>
        <Button size="sm" variant="outline" onClick={handleZoomIn}>
          +
        </Button>
      </div>

      <div className="mt-4 flex gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-400 border border-blue-600"></div>
          <span>Pool</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4" style={{ backgroundColor: '#D4A574', border: '1px solid #8B6F47' }}></div>
          <span>Corner Pavers</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4" style={{ backgroundColor: '#C9A66B', border: '1px solid #8B6F47' }}></div>
          <span>Full Pavers</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4" style={{ backgroundColor: '#B8956A', border: '1px solid #8B6F47' }}></div>
          <span>Stripe Pavers</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-muted"></div>
          <span>Grout ({GROUT_WIDTH}mm)</span>
        </div>
      </div>
    </div>
  );
}
