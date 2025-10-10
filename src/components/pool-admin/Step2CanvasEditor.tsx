import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, Check } from 'lucide-react';
import { parseDxfFile, ParsedPool } from '@/utils/dxfParser';
import { toast } from 'sonner';

interface Point {
  x: number;
  y: number;
}

interface Step2Props {
  poolData: any;
  setPoolData: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
  onSaveDraft: () => void;
}

export default function Step2CanvasEditor({ poolData, setPoolData, onNext, onBack, onSaveDraft }: Step2Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState('add_point');
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [gridVisible, setGridVisible] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  const CANVAS_WIDTH = 1200;
  const CANVAS_HEIGHT = 900;
  const GRID_SIZE = 10; // 100mm at 1:100 scale
  const POINT_RADIUS = 6;
  
  const [ghostPoint, setGhostPoint] = useState<Point | null>(null);
  const [importedPools, setImportedPools] = useState<ParsedPool[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const snapToGrid = (value: number) => {
    if (!snapEnabled) return value;
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  };
  
  // Calculate distance between two points (in mm at 1:100 scale)
  const calculateDistance = (p1: Point, p2: Point) => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy) * 100; // Convert to mm (1 unit = 100mm)
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw grid
    if (gridVisible) {
      for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE) {
        const isMajor = x % (GRID_SIZE * 10) === 0;
        ctx.strokeStyle = isMajor ? '#cbd5e1' : '#e5e7eb';
        ctx.lineWidth = isMajor ? 1 : 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      
      for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE) {
        const isMajor = y % (GRID_SIZE * 10) === 0;
        ctx.strokeStyle = isMajor ? '#cbd5e1' : '#e5e7eb';
        ctx.lineWidth = isMajor ? 1 : 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }
    }

    // Draw pool outline
    if (poolData.outline_points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(poolData.outline_points[0].x, poolData.outline_points[0].y);
      
      for (let i = 1; i < poolData.outline_points.length; i++) {
        ctx.lineTo(poolData.outline_points[i].x, poolData.outline_points[i].y);
      }
      
      if (poolData.outline_points.length >= 3) {
        ctx.closePath();
        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.fill();
      }
      
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    // Draw line measurements
    if (poolData.outline_points.length > 1) {
      ctx.fillStyle = '#000';
      ctx.font = 'bold 12px sans-serif';
      
      for (let i = 0; i < poolData.outline_points.length - 1; i++) {
        const p1 = poolData.outline_points[i];
        const p2 = poolData.outline_points[i + 1];
        const distance = calculateDistance(p1, p2);
        
        // Calculate midpoint
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        
        // Format distance
        const distanceText = distance >= 1000 
          ? `${(distance / 1000).toFixed(2)}m`
          : `${Math.round(distance)}mm`;
        
        // Draw measurement background
        const textMetrics = ctx.measureText(distanceText);
        const padding = 4;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(
          midX - textMetrics.width / 2 - padding,
          midY - 8 - padding,
          textMetrics.width + padding * 2,
          16 + padding * 2
        );
        
        // Draw measurement text
        ctx.fillStyle = '#1E40AF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(distanceText, midX, midY);
      }
    }
    
    // Draw ghost line measurement (line being drawn)
    if (ghostPoint && poolData.outline_points.length > 0 && tool === 'add_point') {
      const lastPoint = poolData.outline_points[poolData.outline_points.length - 1];
      const distance = calculateDistance(lastPoint, ghostPoint);
      
      // Draw ghost line
      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(ghostPoint.x, ghostPoint.y);
      ctx.strokeStyle = '#9CA3AF';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Draw ghost measurement
      const midX = (lastPoint.x + ghostPoint.x) / 2;
      const midY = (lastPoint.y + ghostPoint.y) / 2;
      
      const distanceText = distance >= 1000 
        ? `${(distance / 1000).toFixed(2)}m`
        : `${Math.round(distance)}mm`;
      
      const textMetrics = ctx.measureText(distanceText);
      const padding = 4;
      ctx.fillStyle = 'rgba(156, 163, 175, 0.9)';
      ctx.fillRect(
        midX - textMetrics.width / 2 - padding,
        midY - 8 - padding,
        textMetrics.width + padding * 2,
        16 + padding * 2
      );
      
      ctx.fillStyle = '#6B7280';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(distanceText, midX, midY);
    }

    // Draw points
    poolData.outline_points.forEach((point: any, index: number) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, POINT_RADIUS, 0, Math.PI * 2);
      
      if (selectedPointIndex === index) {
        ctx.fillStyle = '#EF4444';
      } else if (hoveredPointIndex === index) {
        ctx.fillStyle = '#F59E0B';
      } else {
        ctx.fillStyle = '#3B82F6';
      }
      
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.fillStyle = '#000';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${index + 1}`, point.x + 10, point.y - 10);
    });
  }, [poolData.outline_points, gridVisible, selectedPointIndex, hoveredPointIndex, ghostPoint, tool]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = snapToGrid(e.clientX - rect.left);
    const y = snapToGrid(e.clientY - rect.top);

    if (tool === 'add_point') {
      setPoolData({
        ...poolData,
        outline_points: [...poolData.outline_points, { x, y }]
      });
    } else if (tool === 'delete_point') {
      const clickedIndex = findPointAt(x, y);
      if (clickedIndex !== -1) {
        const newPoints = poolData.outline_points.filter((_: any, i: number) => i !== clickedIndex);
        setPoolData({ ...poolData, outline_points: newPoints });
      }
    }
  };

  const findPointAt = (x: number, y: number): number => {
    return poolData.outline_points.findIndex((point: any) => {
      const dx = point.x - x;
      const dy = point.y - y;
      return Math.sqrt(dx * dx + dy * dy) < POINT_RADIUS + 5;
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = snapToGrid(e.clientX - rect.left);
    const y = snapToGrid(e.clientY - rect.top);
    
    const hoveredIndex = findPointAt(x, y);
    setHoveredPointIndex(hoveredIndex);
    
    if (tool === 'add_point' && poolData.outline_points.length > 0) {
      setGhostPoint({ x, y });
    } else {
      setGhostPoint(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.dxf')) {
      toast.error('Please upload a DXF file');
      return;
    }
    
    try {
      const text = await file.text();
      const pools = parseDxfFile(text);
      
      if (pools.length === 0) {
        toast.error('No pool shapes found in DXF file');
        return;
      }
      
      setImportedPools(pools);
      setShowImportDialog(true);
      toast.success(`Found ${pools.length} pool shapes!`);
    } catch (error) {
      console.error('Error parsing DXF:', error);
      toast.error('Failed to parse DXF file');
    }
  };
  
  const importPool = (pool: ParsedPool) => {
    // Convert DXF coordinates to canvas coordinates
    // DXF is in mm, canvas uses 10px = 100mm scale
    const canvasPoints = pool.outlinePoints.map(p => ({
      x: p.x / 100, // Convert mm to canvas units (1 unit = 100mm)
      y: p.y / 100
    }));
    
    // Update pool data
    setPoolData({
      ...poolData,
      pool_name: pool.name.split(' ')[0], // e.g., "Serenity"
      variant_name: pool.name,
      display_name: pool.name,
      length: pool.dimensions.length,
      width: pool.dimensions.width,
      outline_points: canvasPoints
    });
    
    setShowImportDialog(false);
    setImportedPools([]);
    toast.success(`Imported ${pool.name}`);
  };

  const closeOutline = () => {
    if (poolData.outline_points.length >= 3) {
      const firstPoint = poolData.outline_points[0];
      setPoolData({
        ...poolData,
        outline_points: [...poolData.outline_points, firstPoint]
      });
    }
  };

  const deletePoint = (index: number) => {
    const newPoints = poolData.outline_points.filter((_: any, i: number) => i !== index);
    setPoolData({ ...poolData, outline_points: newPoints });
  };

  const isClosed = poolData.outline_points.length >= 4 &&
    poolData.outline_points[0].x === poolData.outline_points[poolData.outline_points.length - 1]?.x &&
    poolData.outline_points[0].y === poolData.outline_points[poolData.outline_points.length - 1]?.y;

  return (
    <>
      {/* Import Dialog */}
      {showImportDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-[600px] max-h-[80vh] p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Select Pool to Import</h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setShowImportDialog(false);
                    setImportedPools([]);
                  }}
                >
                  Cancel
                </Button>
              </div>
              
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {importedPools.map((pool, index) => (
                    <Card 
                      key={index}
                      className="p-4 cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => importPool(pool)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold">{pool.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {(pool.dimensions.length / 1000).toFixed(1)}m × {(pool.dimensions.width / 1000).toFixed(1)}m
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {pool.outlinePoints.length} points
                          </p>
                        </div>
                        <Check className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </Card>
        </div>
      )}
    
      <div className="bg-card rounded-lg shadow">
        <div className="flex">
          {/* Tools Sidebar */}
          <div className="w-56 border-r p-4 space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold">Import Pool</h3>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".dxf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="w-full justify-start gap-2"
              >
                <Upload className="w-4 h-4" />
                Import DXF
              </Button>
            </div>
            
            <div className="border-t pt-4 space-y-2">
              <h3 className="font-semibold mb-4">Drawing Tools</h3>
          
              <Button
                variant={tool === 'add_point' ? 'default' : 'outline'}
                className="w-full justify-start"
                onClick={() => setTool('add_point')}
              >
                📐 Add Point
              </Button>
              
              <Button
                variant={tool === 'delete_point' ? 'default' : 'outline'}
                className="w-full justify-start"
                onClick={() => setTool('delete_point')}
              >
                🗑️ Delete Point
              </Button>
            </div>

            <div className="border-t pt-4 space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={gridVisible}
                onChange={(e) => setGridVisible(e.target.checked)}
              />
              <span className="text-sm">Show Grid</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={snapEnabled}
                onChange={(e) => setSnapEnabled(e.target.checked)}
              />
              <span className="text-sm">Snap to Grid</span>
            </label>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground mb-2">
              Points: {poolData.outline_points.length}
            </p>
            {!isClosed && poolData.outline_points.length >= 3 && (
              <Button
                size="sm"
                className="w-full"
                onClick={closeOutline}
              >
                ✓ Close Outline
              </Button>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 p-6">
          <div className="border rounded bg-background" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              onClick={handleCanvasClick}
              onMouseMove={handleMouseMove}
              className="cursor-crosshair"
            />
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            {tool === 'add_point' && '📐 Click on canvas to add outline points'}
            {tool === 'delete_point' && '🗑️ Click points to delete them'}
          </p>
        </div>

        {/* Points List */}
        <div className="w-64 border-l p-4">
          <h3 className="font-semibold mb-4">Outline Points</h3>
          <div className="space-y-2 max-h-[800px] overflow-y-auto">
            {poolData.outline_points.map((point: any, index: number) => (
              <div 
                key={index} 
                className="flex items-center justify-between text-sm p-2 bg-muted rounded hover:bg-muted/80"
                onMouseEnter={() => setHoveredPointIndex(index)}
                onMouseLeave={() => setHoveredPointIndex(null)}
              >
                <span className="font-mono">
                  {index + 1}. ({point.x}, {point.y})
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deletePoint(index)}
                  className="h-6 w-6 p-0"
                >
                  ×
                </Button>
              </div>
            ))}
            {poolData.outline_points.length === 0 && (
              <p className="text-sm text-muted-foreground">No points yet</p>
            )}
          </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between p-6 border-t">
          <Button variant="outline" onClick={onBack}>
            ← Back
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onSaveDraft}>
              💾 Save Draft
            </Button>
            <Button 
              onClick={onNext}
              disabled={poolData.outline_points.length < 3 || !isClosed}
            >
              Next: Features →
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
