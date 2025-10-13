import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCreatePoolVariant, useUpdatePoolVariant, PoolVariant } from '@/hooks/usePoolVariants';
import { calculatePoolCoping, DEFAULT_COPING_OPTIONS, CopingConfig } from '@/utils/copingCalculation';
import { Calculator } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface PoolEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pool?: PoolVariant;
}

export const PoolEditorDialog = ({ open, onOpenChange, pool }: PoolEditorDialogProps) => {
  const [poolName, setPoolName] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [shallowX, setShallowX] = useState('');
  const [shallowY, setShallowY] = useState('');
  const [deepX, setDeepX] = useState('');
  const [deepY, setDeepY] = useState('');
  const [copingOptions, setCopingOptions] = useState<any[]>(DEFAULT_COPING_OPTIONS);
  const [calculatedLayouts, setCalculatedLayouts] = useState<any[]>([]);

  const createMutation = useCreatePoolVariant();
  const updateMutation = useUpdatePoolVariant();

  useEffect(() => {
    if (pool) {
      setPoolName(pool.pool_name);
      setNotes(pool.notes || '');
      setStatus((pool.status as 'draft' | 'published') || 'draft');
      
      if (pool.shallow_end_position) {
        setShallowX(String(pool.shallow_end_position.x));
        setShallowY(String(pool.shallow_end_position.y));
      }
      if (pool.deep_end_position) {
        setDeepX(String(pool.deep_end_position.x));
        setDeepY(String(pool.deep_end_position.y));
      }

      // Load coping options from pool
      if (pool.coping_options && Array.isArray(pool.coping_options) && pool.coping_options.length > 0) {
        setCopingOptions(pool.coping_options as any[]);
      } else {
        setCopingOptions(DEFAULT_COPING_OPTIONS);
      }

      // Calculate dimensions from outline
      if (pool.outline && pool.outline.length > 0) {
        const xs = pool.outline.map(p => p.x);
        const ys = pool.outline.map(p => p.y);
        const w = Math.max(...xs) - Math.min(...xs);
        const h = Math.max(...ys) - Math.min(...ys);
        setLength(String(w));
        setWidth(String(h));
      }
    } else {
      // Reset for new pool
      setPoolName('');
      setLength('');
      setWidth('');
      setNotes('');
      setStatus('draft');
      setShallowX('');
      setShallowY('');
      setDeepX('');
      setDeepY('');
      setCopingOptions(DEFAULT_COPING_OPTIONS);
      setCalculatedLayouts([]);
    }
  }, [pool, open]);

  const generateRectangleOutline = () => {
    const l = parseFloat(length);
    const w = parseFloat(width);
    if (isNaN(l) || isNaN(w)) return [];
    
    return [
      { x: 0, y: 0 },
      { x: l, y: 0 },
      { x: l, y: w },
      { x: 0, y: w },
      { x: 0, y: 0 }
    ];
  };

  const handleCalculateAllCoping = () => {
    const l = parseFloat(length);
    const w = parseFloat(width);
    
    if (isNaN(l) || isNaN(w)) {
      return;
    }

    const poolData = {
      id: pool?.id || 'temp',
      name: poolName,
      length: l,
      width: w,
      outline: generateRectangleOutline(),
      shallowEnd: { x: 150, y: w / 2, label: 'SE' },
      deepEnd: { x: l - 150, y: w / 2, label: 'DE' },
      color: '#3B82F6'
    };

    // Calculate layouts for all coping options
    const layouts = copingOptions.map(config => ({
      config,
      calculation: calculatePoolCoping(poolData, config as CopingConfig)
    }));

    setCalculatedLayouts(layouts);
  };

  const handleSave = async () => {
    const l = parseFloat(length);
    const w = parseFloat(width);

    if (!poolName || isNaN(l) || isNaN(w)) {
      return;
    }

    const outline = generateRectangleOutline();
    const shallowPos = shallowX && shallowY ? { x: parseFloat(shallowX), y: parseFloat(shallowY) } : null;
    const deepPos = deepX && deepY ? { x: parseFloat(deepX), y: parseFloat(deepY) } : null;

    const poolData: any = {
      pool_name: poolName,
      outline,
      shallow_end_position: shallowPos,
      deep_end_position: deepPos,
      notes,
      status,
      coping_options: copingOptions,
      features: [],
    };

    if (pool) {
      await updateMutation.mutateAsync({ id: pool.id, ...poolData });
    } else {
      await createMutation.mutateAsync(poolData);
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pool ? 'Edit Pool' : 'Create New Pool'}</DialogTitle>
          <DialogDescription>
            {pool ? 'Update pool configuration' : 'Add a new pool to the library'}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="positions">Positions</TabsTrigger>
            <TabsTrigger value="coping">Coping Options</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div>
              <Label htmlFor="pool-name">Pool Name</Label>
              <Input
                id="pool-name"
                placeholder="e.g., Oxford 7.0 × 3.0m"
                value={poolName}
                onChange={(e) => setPoolName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="length">Length (mm)</Label>
                <Input
                  id="length"
                  type="number"
                  placeholder="7000"
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="width">Width (mm)</Label>
                <Input
                  id="width"
                  type="number"
                  placeholder="3000"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Internal notes about this pool..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>

            <div>
              <Label>Status</Label>
              <RadioGroup value={status} onValueChange={(v) => setStatus(v as any)} className="mt-2 space-y-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="draft" id="draft" />
                  <Label htmlFor="draft" className="font-normal cursor-pointer">
                    Draft (not visible in pool selector)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="published" id="published" />
                  <Label htmlFor="published" className="font-normal cursor-pointer">
                    Published (available in pool selector)
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </TabsContent>

          <TabsContent value="positions" className="space-y-4">
            <div>
              <Label className="text-base font-semibold">Shallow End Position</Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <Label htmlFor="shallow-x">X Coordinate</Label>
                  <Input
                    id="shallow-x"
                    type="number"
                    placeholder="150"
                    value={shallowX}
                    onChange={(e) => setShallowX(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="shallow-y">Y Coordinate</Label>
                  <Input
                    id="shallow-y"
                    type="number"
                    placeholder="1500"
                    value={shallowY}
                    onChange={(e) => setShallowY(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-base font-semibold">Deep End Position</Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <Label htmlFor="deep-x">X Coordinate</Label>
                  <Input
                    id="deep-x"
                    type="number"
                    placeholder="6850"
                    value={deepX}
                    onChange={(e) => setDeepX(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="deep-y">Y Coordinate</Label>
                  <Input
                    id="deep-y"
                    type="number"
                    placeholder="1500"
                    value={deepY}
                    onChange={(e) => setDeepY(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="coping" className="space-y-4">
            <div>
              <Label className="text-base font-semibold">Default Coping Options</Label>
              <p className="text-sm text-muted-foreground mt-1">
                This pool will have 3 standard coping configurations available
              </p>
            </div>

            <div className="space-y-3">
              {copingOptions.map((option, idx) => (
                <Card key={option.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{option.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Tile: {option.tile.along}×{option.tile.inward}mm | 
                        Rows: SE={option.rows.shallow}, Sides={option.rows.sides}, DE={option.rows.deep}
                      </p>
                    </div>
                    {calculatedLayouts[idx] && (
                      <div className="text-right text-sm">
                        <p className="font-semibold">{calculatedLayouts[idx].calculation.totalArea.toFixed(2)} m²</p>
                        <p className="text-xs text-muted-foreground">
                          {calculatedLayouts[idx].calculation.totalPavers} pavers
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleCalculateAllCoping}
              className="w-full"
              disabled={!length || !width}
            >
              <Calculator className="w-4 h-4 mr-2" />
              Calculate All Coping Layouts
            </Button>

            {calculatedLayouts.length > 0 && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-semibold mb-2">All coping options calculated successfully!</p>
                <p className="text-xs text-muted-foreground">
                  Users will be able to select from these 3 configurations when adding the pool.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1">
            {pool ? 'Update Pool' : 'Create Pool'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};