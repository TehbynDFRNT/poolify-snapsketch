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

  // Auto-scale and center content to fit canvas
  const getScaledData = () => {
    if (!poolOutline || poolOutline.length === 0) {
      return { scaledOutline: [], scaledPavers: [], scale: 1, offset: { x: 0, y: 0 } };
    }

    // Find bounds of all elements
    let minX = poolOutline[0].x;
    let maxX = poolOutline[0].x;
    let minY = poolOutline[0].y;
    let maxY = poolOutline[0].y;

    poolOutline.forEach(p => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });

    // Include pavers in bounds if they exist
    if (copingLayout?.pavers) {
      copingLayout.pavers.forEach(paver => {
        const px = paver.position.x;
        const py = paver.position.y;
        const w = paver.dimensions.width;
        const h = paver.dimensions.height;
        
        minX = Math.min(minX, px - w);
        maxX = Math.max(maxX, px + w);
        minY = Math.min(minY, py - h);
        maxY = Math.max(maxY, py + h);
      });
    }

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // Calculate scale with padding
    const padding = 50;
    const scaleX = contentWidth > 0 ? (width - padding * 2) / contentWidth : 1;
    const scaleY = contentHeight > 0 ? (height - padding * 2) / contentHeight : 1;
    const scale = Math.min(scaleX, scaleY);

    // Calculate offset to center content
    const offset = {
      x: padding + (width - padding * 2 - contentWidth * scale) / 2 - minX * scale,
      y: padding + (height - padding * 2 - contentHeight * scale) / 2 - minY * scale
    };

    // Scale outline points
    const scaledOutline = poolOutline.map(p => ({
      x: p.x * scale + offset.x,
      y: p.y * scale + offset.y
    }));

    // Scale pavers
    const scaledPavers = copingLayout?.pavers?.map(paver => ({
      ...paver,
      position: {
        x: paver.position.x * scale + offset.x,
        y: paver.position.y * scale + offset.y
      },
      dimensions: {
        width: paver.dimensions.width * scale,
        height: paver.dimensions.height * scale
      }
    })) || [];

    return { scaledOutline, scaledPavers, scale, offset };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const { scaledOutline, scaledPavers } = getScaledData();

    ctx.save();

    // Draw pool outline
    if (scaledOutline.length > 2) {
      ctx.beginPath();
      ctx.moveTo(scaledOutline[0].x, scaledOutline[0].y);
      
      for (let i = 1; i < scaledOutline.length; i++) {
        ctx.lineTo(scaledOutline[i].x, scaledOutline[i].y);
      }
      
      ctx.closePath();
      ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
      ctx.fill();
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Draw pavers
    if (scaledPavers.length > 0) {
      scaledPavers.forEach(paver => {
        ctx.save();
        ctx.translate(paver.position.x, paver.position.y);
        ctx.rotate((paver.rotation * Math.PI) / 180);

        const fillColor = 
          paver.type === 'corner' ? '#D4A574' :
          paver.type === 'stripe_cut' ? '#B8956A' :
          '#C9A66B';

        const groutAdjust = (GROUT_WIDTH * (Math.min(scaledOutline.length > 0 ? 0.5 : 1, 1))) / 2;
        
        ctx.fillStyle = fillColor;
        ctx.fillRect(
          -groutAdjust, 
          -groutAdjust, 
          paver.dimensions.width - GROUT_WIDTH * 0.5, 
          paver.dimensions.height - GROUT_WIDTH * 0.5
        );

        ctx.strokeStyle = '#8B6F47';
        ctx.lineWidth = 1;
        ctx.strokeRect(
          -groutAdjust, 
          -groutAdjust, 
          paver.dimensions.width - GROUT_WIDTH * 0.5, 
          paver.dimensions.height - GROUT_WIDTH * 0.5
        );

        ctx.restore();
      });
    }

    ctx.restore();
  }, [poolOutline, copingLayout, width, height]);

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
