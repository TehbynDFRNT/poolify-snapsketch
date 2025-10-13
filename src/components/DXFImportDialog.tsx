import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { DXFPoolData } from '@/utils/dxfParser';

interface DXFImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poolData: DXFPoolData | null;
  onImport: (name: string) => Promise<void>;
}

export function DXFImportDialog({ open, onOpenChange, poolData, onImport }: DXFImportDialogProps) {
  const [poolName, setPoolName] = useState(poolData?.name || '');
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async () => {
    if (!poolName.trim()) {
      return;
    }

    setIsImporting(true);
    try {
      await onImport(poolName.trim());
      onOpenChange(false);
    } finally {
      setIsImporting(false);
    }
  };

  if (!poolData) {
    return null;
  }

  const widthMeters = (poolData.boundingBox.width / 1000).toFixed(1);
  const heightMeters = (poolData.boundingBox.height / 1000).toFixed(1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import DXF Pool</DialogTitle>
          <DialogDescription>
            Review the pool data extracted from the DXF file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="pool-name">Pool Name</Label>
            <Input
              id="pool-name"
              value={poolName}
              onChange={(e) => setPoolName(e.target.value)}
              placeholder="Enter pool name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Dimensions:</span>
              <p className="font-medium">{widthMeters}m × {heightMeters}m</p>
            </div>
            <div>
              <span className="text-muted-foreground">Vertices:</span>
              <p className="font-medium">{poolData.outline.length} points</p>
            </div>
          </div>

          <div className="text-sm">
            <span className="text-muted-foreground">Zone of Influence:</span>
            <p className="font-medium">
              {poolData.zoneOfInfluence ? `Included (${poolData.zoneOfInfluence.length} points)` : 'Not found'}
            </p>
          </div>

          {(poolData.deepEndPosition || poolData.shallowEndPosition) && (
            <div className="text-sm">
              <span className="text-muted-foreground">End Positions:</span>
              <p className="font-medium">
                {poolData.deepEndPosition && 'Deep End detected'}
                {poolData.deepEndPosition && poolData.shallowEndPosition && ' • '}
                {poolData.shallowEndPosition && 'Shallow End detected'}
              </p>
            </div>
          )}

          {/* Simple preview visualization */}
          <div className="border rounded-md p-4 bg-muted/50">
            <svg
              viewBox={`0 0 ${poolData.boundingBox.width} ${poolData.boundingBox.height}`}
              className="w-full h-48"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Pool outline */}
              <polyline
                points={poolData.outline.map(p => `${p.x},${p.y}`).join(' ')}
                fill="hsl(var(--primary) / 0.1)"
                stroke="hsl(var(--primary))"
                strokeWidth="2"
              />
              
              {/* Zone of influence */}
              {poolData.zoneOfInfluence && (
                <polyline
                  points={poolData.zoneOfInfluence.map(p => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth="1"
                  strokeDasharray="5,5"
                />
              )}
            </svg>
            <p className="text-xs text-muted-foreground text-center mt-2">Preview (not to scale)</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!poolName.trim() || isImporting}>
            {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import Pool
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
