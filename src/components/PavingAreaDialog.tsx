import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { validateBoundary } from '@/utils/pavingFill';

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
  paverSize: '400x400' | '400x600';
  paverOrientation: 'vertical' | 'horizontal';
  showEdgePavers: boolean;
  wastagePercentage: number;
}

export const PavingAreaDialog = ({ open, onOpenChange, boundary, onConfirm }: PavingAreaDialogProps) => {
  const [paverSize, setPaverSize] = useState<'400x400' | '400x600'>('400x400');
  const [paverOrientation, setPaverOrientation] = useState<'vertical' | 'horizontal'>('vertical');
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
            <RadioGroup value={paverSize} onValueChange={(value) => setPaverSize(value as '400x400' | '400x600')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="400x400" id="size-400x400" />
                <Label htmlFor="size-400x400" className="cursor-pointer font-normal">
                  400 × 400mm (square)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="400x600" id="size-400x600" />
                <Label htmlFor="size-400x600" className="cursor-pointer font-normal">
                  400 × 600mm (rectangle)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Orientation (only for 400x600) */}
          {paverSize === '400x600' && (
            <div className="space-y-3">
              <Label>Paver Orientation</Label>
              <RadioGroup value={paverOrientation} onValueChange={(value) => setPaverOrientation(value as 'vertical' | 'horizontal')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="vertical" id="orient-vertical" />
                  <Label htmlFor="orient-vertical" className="cursor-pointer font-normal">
                    Vertical (400mm wide × 600mm long)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="horizontal" id="orient-horizontal" />
                  <Label htmlFor="orient-horizontal" className="cursor-pointer font-normal">
                    Horizontal (600mm wide × 400mm long)
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
  paverSize: '400x400' | '400x600',
  orientation: 'vertical' | 'horizontal',
  showEdgePavers: boolean,
  wastagePercentage: number
) {
  // Get paver dimensions
  const { width: paverWidth, height: paverHeight } = getPaverDimensions(paverSize, orientation);

  // Get bounding box
  const bbox = getBoundingBox(boundary);

  // Calculate approximate counts (simplified for preview)
  const cols = Math.ceil(bbox.width / paverWidth);
  const rows = Math.ceil(bbox.height / paverHeight);
  const totalPavers = cols * rows;

  // Estimate edge pavers (approximately 20-30% of total)
  const edgePavers = Math.round(totalPavers * 0.25);
  const fullPavers = totalPavers - edgePavers;

  // Calculate area
  const paverAreaM2 = (paverWidth * paverHeight) / 1000000;
  const totalArea = (showEdgePavers ? totalPavers : fullPavers) * paverAreaM2;
  const fullArea = fullPavers * paverAreaM2;

  // Calculate order quantity
  const subtotal = showEdgePavers ? totalPavers : fullPavers;
  const wastageAmount = Math.ceil(subtotal * (wastagePercentage / 100));
  const orderQuantity = subtotal + wastageAmount;

  return {
    fullPavers,
    edgePavers: showEdgePavers ? edgePavers : 0,
    totalArea: totalArea.toFixed(2),
    fullArea: fullArea.toFixed(2),
    orderQuantity,
  };
}

function getPaverDimensions(paverSize: '400x400' | '400x600', orientation: 'vertical' | 'horizontal') {
  if (paverSize === '400x400') {
    return { width: 400, height: 400 };
  }
  return orientation === 'vertical' 
    ? { width: 400, height: 600 } 
    : { width: 600, height: 400 };
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
