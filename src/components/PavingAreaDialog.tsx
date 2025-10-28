import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { validateBoundary, fillAreaWithPavers, calculateStatistics } from '@/utils/pavingFill';
import { TILE_SIZES, TileSize, TileOrientation } from '@/constants/tileConfig';

interface Point {
  x: number;
  y: number;
}

interface PavingAreaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boundary: Point[];
  onConfirm: (config: PavingConfig) => void;
}

export interface PavingConfig {
  paverSize: TileSize;
  paverOrientation: TileOrientation;
  showEdgePavers: boolean;
  wastagePercentage: number;
}

export const PavingAreaDialog = ({ open, onOpenChange, boundary, onConfirm }: PavingAreaDialogProps) => {
  const [paverSize, setPaverSize] = useState<TileSize>('400x400');
  const [paverOrientation, setPaverOrientation] = useState<TileOrientation>('vertical');
  const [showEdgePavers, setShowEdgePavers] = useState(true);
  const [includeWastage, setIncludeWastage] = useState(true);
  const [wastagePercentage, setWastagePercentage] = useState(15);

  // Calculate preview statistics
  const previewStats = calculatePreviewStats(
    boundary,
    paverSize,
    paverOrientation,
    showEdgePavers,
    includeWastage ? wastagePercentage : 0
  );

  const handleConfirm = () => {
    // Validate that area can fit pavers before confirming
    const validation = validateBoundary(boundary, paverSize, paverOrientation);
    
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid paving area');
      return;
    }
    
    onConfirm({
      paverSize,
      paverOrientation,
      showEdgePavers,
      wastagePercentage: includeWastage ? wastagePercentage : 0,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Fill Paving Area</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Paver Size */}
          <div className="space-y-3">
            <Label>Paver Size</Label>
            <RadioGroup value={paverSize} onValueChange={(value) => setPaverSize(value as TileSize)}>
              {Object.entries(TILE_SIZES).map(([key, tile]) => (
                <div key={key} className="flex items-center space-x-2">
                  <RadioGroupItem value={key} id={`size-${key}`} />
                  <Label htmlFor={`size-${key}`} className="cursor-pointer font-normal">
                    {tile.label} {tile.width === tile.height ? '(square)' : '(rectangle)'}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Orientation (only for non-square tiles) */}
          {TILE_SIZES[paverSize].width !== TILE_SIZES[paverSize].height && (
            <div className="space-y-3">
              <Label>Paver Orientation</Label>
              <RadioGroup value={paverOrientation} onValueChange={(value) => setPaverOrientation(value as TileOrientation)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="vertical" id="orient-vertical" />
                  <Label htmlFor="orient-vertical" className="cursor-pointer font-normal">
                    Vertical ({TILE_SIZES[paverSize].width}mm wide × {TILE_SIZES[paverSize].height}mm long)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="horizontal" id="orient-horizontal" />
                  <Label htmlFor="orient-horizontal" className="cursor-pointer font-normal">
                    Horizontal ({TILE_SIZES[paverSize].height}mm wide × {TILE_SIZES[paverSize].width}mm long)
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Edge Treatment */}
          <div className="space-y-3">
            <Label>Edge Treatment</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edge-pavers"
                  checked={showEdgePavers}
                  onCheckedChange={(checked) => setShowEdgePavers(!!checked)}
                />
                <Label htmlFor="edge-pavers" className="cursor-pointer font-normal">
                  Show edge pavers (cuts required)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="wastage"
                  checked={includeWastage}
                  onCheckedChange={(checked) => setIncludeWastage(!!checked)}
                />
                <Label htmlFor="wastage" className="cursor-pointer font-normal">
                  Include wastage
                </Label>
              </div>
            </div>

            {includeWastage && (
              <Select value={String(wastagePercentage)} onValueChange={(value) => setWastagePercentage(Number(value))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10% wastage</SelectItem>
                  <SelectItem value="15">15% wastage (recommended)</SelectItem>
                  <SelectItem value="20">20% wastage</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Preview */}
          <div className="bg-muted rounded-lg p-3 space-y-2">
            <h4 className="font-semibold text-sm">Preview</h4>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>• Full pavers:</span>
                <span className="font-medium">{previewStats.fullPavers} ({previewStats.fullArea} m²)</span>
              </div>
              {showEdgePavers && (
                <div className="flex justify-between text-orange-600">
                  <span>• Edge pavers:</span>
                  <span className="font-medium">{previewStats.edgePavers} (cutting required)</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t">
                <span>• Total area:</span>
                <span className="font-medium">{previewStats.totalArea} m²</span>
              </div>
              {includeWastage && (
                <div className="flex justify-between text-primary pt-1 border-t font-semibold">
                  <span>• With wastage:</span>
                  <span>{previewStats.orderQuantity} pavers (order qty)</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Fill Area
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Helper function to calculate preview statistics
function calculatePreviewStats(
  boundary: Point[],
  paverSize: TileSize,
  orientation: TileOrientation,
  showEdgePavers: boolean,
  wastagePercentage: number
) {
  // Use the same logic as the canvas to avoid discrepancies
  const pavers = fillAreaWithPavers(boundary, paverSize, orientation, showEdgePavers);
  const stats = calculateStatistics(pavers, wastagePercentage);

  // Derive full area from the first paver size if available
  let fullArea = 0;
  if (pavers.length > 0) {
    const mmW = (pavers[0] as any).mmWidth ?? 400;
    const mmH = (pavers[0] as any).mmHeight ?? 400;
    const areaPerPaver = (mmW * mmH) / 1_000_000; // m²
    fullArea = stats.fullPavers * areaPerPaver;
  }

  return {
    fullPavers: stats.fullPavers,
    edgePavers: showEdgePavers ? stats.edgePavers : 0,
    totalArea: stats.totalArea.toFixed(2),
    fullArea: fullArea.toFixed(2),
    orderQuantity: stats.orderQuantity,
  };
}

function getPaverDimensions(paverSize: TileSize, orientation: TileOrientation) {
  const tile = TILE_SIZES[paverSize];
  if (tile.width === tile.height) {
    return { width: tile.width, height: tile.height };
  }
  return orientation === 'vertical'
    ? { width: tile.width, height: tile.height }
    : { width: tile.height, height: tile.width };
}

function getBoundingBox(points: Point[]) {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}
