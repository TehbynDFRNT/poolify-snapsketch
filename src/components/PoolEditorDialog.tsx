import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreatePoolVariant, useUpdatePoolVariant, PoolVariant } from '@/hooks/usePoolVariants';
import { PoolShapePreview } from './PoolShapePreview';
import {
  PoolShapeType,
  POOL_SHAPE_TEMPLATES,
  RectangleParams,
  TShapeParams,
  getDefaultEndPositions,
} from '@/constants/poolShapeTemplates';

interface PoolEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pool?: PoolVariant;
}

export const PoolEditorDialog = ({ open, onOpenChange, pool }: PoolEditorDialogProps) => {
  const [poolName, setPoolName] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');

  // Shape configuration
  const [shapeType, setShapeType] = useState<PoolShapeType>('rectangle');

  // Rectangle params
  const [length, setLength] = useState('7000');
  const [width, setWidth] = useState('3000');

  // T-shape params
  const [mainLength, setMainLength] = useState('7000');
  const [mainWidth, setMainWidth] = useState('3000');
  const [extensionLength, setExtensionLength] = useState('2000');
  const [extensionWidth, setExtensionWidth] = useState('1000');
  const [extensionPosition, setExtensionPosition] = useState<'center' | 'left' | 'right'>('center');

  // End positions
  const [shallowX, setShallowX] = useState('');
  const [shallowY, setShallowY] = useState('');
  const [deepX, setDeepX] = useState('');
  const [deepY, setDeepY] = useState('');

  const createMutation = useCreatePoolVariant();
  const updateMutation = useUpdatePoolVariant();

  // Detect shape type from existing outline
  const detectShapeType = (outline: Array<{ x: number; y: number }>): PoolShapeType => {
    if (!outline || outline.length === 0) return 'rectangle';
    // Count unique vertices (excluding closing point)
    const uniquePoints = outline.length > 0 &&
      outline[0].x === outline[outline.length - 1].x &&
      outline[0].y === outline[outline.length - 1].y
      ? outline.length - 1
      : outline.length;

    if (uniquePoints <= 4) return 'rectangle';
    if (uniquePoints <= 8) return 't-shape';
    return 'rectangle'; // fallback
  };

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

      // Detect and set shape type from outline
      if (pool.outline && pool.outline.length > 0) {
        const detected = detectShapeType(pool.outline);
        setShapeType(detected);

        const xs = pool.outline.map(p => p.x);
        const ys = pool.outline.map(p => p.y);
        const w = Math.max(...xs) - Math.min(...xs);
        const h = Math.max(...ys) - Math.min(...ys);

        if (detected === 'rectangle') {
          setLength(String(w));
          setWidth(String(h));
        } else {
          // For T-shape, try to extract dimensions (simplified)
          setMainLength(String(w));
          setMainWidth(String(h * 0.75)); // approximate
          setExtensionLength(String(w * 0.3));
          setExtensionWidth(String(h * 0.25));
        }
      }
    } else {
      // Reset for new pool
      setPoolName('');
      setNotes('');
      setStatus('draft');
      setShapeType('rectangle');
      setLength('7000');
      setWidth('3000');
      setMainLength('7000');
      setMainWidth('3000');
      setExtensionLength('2000');
      setExtensionWidth('1000');
      setExtensionPosition('center');
      setShallowX('');
      setShallowY('');
      setDeepX('');
      setDeepY('');
    }
  }, [pool, open]);

  // Generate outline based on current shape type and params
  const currentOutline = useMemo(() => {
    const template = POOL_SHAPE_TEMPLATES[shapeType];
    if (!template) return [];

    if (shapeType === 'rectangle') {
      const params: RectangleParams = {
        length: parseFloat(length) || 7000,
        width: parseFloat(width) || 3000,
      };
      return template.generateOutline(params);
    } else if (shapeType === 't-shape') {
      const params: TShapeParams = {
        mainLength: parseFloat(mainLength) || 7000,
        mainWidth: parseFloat(mainWidth) || 3000,
        extensionLength: parseFloat(extensionLength) || 2000,
        extensionWidth: parseFloat(extensionWidth) || 1000,
        extensionPosition,
      };
      return template.generateOutline(params);
    }

    return [];
  }, [shapeType, length, width, mainLength, mainWidth, extensionLength, extensionWidth, extensionPosition]);

  // Get current params for default end positions
  const currentParams = useMemo(() => {
    if (shapeType === 'rectangle') {
      return {
        length: parseFloat(length) || 7000,
        width: parseFloat(width) || 3000,
      } as RectangleParams;
    } else {
      return {
        mainLength: parseFloat(mainLength) || 7000,
        mainWidth: parseFloat(mainWidth) || 3000,
        extensionLength: parseFloat(extensionLength) || 2000,
        extensionWidth: parseFloat(extensionWidth) || 1000,
        extensionPosition,
      } as TShapeParams;
    }
  }, [shapeType, length, width, mainLength, mainWidth, extensionLength, extensionWidth, extensionPosition]);

  // Auto-set end positions when shape changes
  const handleSetDefaultPositions = () => {
    const defaults = getDefaultEndPositions(currentOutline, shapeType, currentParams);
    setShallowX(String(Math.round(defaults.shallow.x)));
    setShallowY(String(Math.round(defaults.shallow.y)));
    setDeepX(String(Math.round(defaults.deep.x)));
    setDeepY(String(Math.round(defaults.deep.y)));
  };

  const handleSave = async () => {
    if (!poolName || currentOutline.length < 4) {
      return;
    }

    const shallowPos = shallowX && shallowY ? { x: parseFloat(shallowX), y: parseFloat(shallowY) } : null;
    const deepPos = deepX && deepY ? { x: parseFloat(deepX), y: parseFloat(deepY) } : null;

    const poolData: any = {
      pool_name: poolName,
      outline: currentOutline,
      shallow_end_position: shallowPos,
      deep_end_position: deepPos,
      notes,
      status,
      features: [],
    };

    if (pool) {
      await updateMutation.mutateAsync({ id: pool.id, ...poolData });
    } else {
      await createMutation.mutateAsync(poolData);
    }

    onOpenChange(false);
  };

  // Parse end positions for preview
  const shallowEnd = shallowX && shallowY ? { x: parseFloat(shallowX), y: parseFloat(shallowY) } : null;
  const deepEnd = deepX && deepY ? { x: parseFloat(deepX), y: parseFloat(deepY) } : null;

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
            <TabsTrigger value="shape">Shape</TabsTrigger>
            <TabsTrigger value="positions">Positions</TabsTrigger>
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

          <TabsContent value="shape" className="space-y-4">
            <div>
              <Label>Shape Type</Label>
              <RadioGroup
                value={shapeType}
                onValueChange={(v) => setShapeType(v as PoolShapeType)}
                className="mt-2 grid grid-cols-2 gap-2"
              >
                <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted">
                  <RadioGroupItem value="rectangle" id="shape-rectangle" />
                  <Label htmlFor="shape-rectangle" className="font-normal cursor-pointer flex-1">
                    <div className="font-medium">Rectangle</div>
                    <div className="text-xs text-muted-foreground">Standard rectangular pool</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted">
                  <RadioGroupItem value="t-shape" id="shape-tshape" />
                  <Label htmlFor="shape-tshape" className="font-normal cursor-pointer flex-1">
                    <div className="font-medium">T-Shape</div>
                    <div className="text-xs text-muted-foreground">Pool with bench extension</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Rectangle dimensions */}
            {shapeType === 'rectangle' && (
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
            )}

            {/* T-shape dimensions */}
            {shapeType === 't-shape' && (
              <div className="space-y-4">
                <div className="text-sm font-medium text-muted-foreground">Main Body</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="main-length">Length (mm)</Label>
                    <Input
                      id="main-length"
                      type="number"
                      placeholder="7000"
                      value={mainLength}
                      onChange={(e) => setMainLength(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="main-width">Width (mm)</Label>
                    <Input
                      id="main-width"
                      type="number"
                      placeholder="3000"
                      value={mainWidth}
                      onChange={(e) => setMainWidth(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="text-sm font-medium text-muted-foreground">Bench Extension</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ext-length">Length (mm)</Label>
                    <Input
                      id="ext-length"
                      type="number"
                      placeholder="2000"
                      value={extensionLength}
                      onChange={(e) => setExtensionLength(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ext-width">Width (mm)</Label>
                    <Input
                      id="ext-width"
                      type="number"
                      placeholder="1000"
                      value={extensionWidth}
                      onChange={(e) => setExtensionWidth(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="ext-position">Extension Position</Label>
                  <Select value={extensionPosition} onValueChange={(v) => setExtensionPosition(v as any)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Shape preview */}
            <div>
              <Label className="text-sm font-medium">Preview</Label>
              <div className="mt-2">
                <PoolShapePreview
                  outline={currentOutline}
                  shallowEnd={shallowEnd}
                  deepEnd={deepEnd}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="positions" className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handleSetDefaultPositions}>
                Set Default Positions
              </Button>
            </div>

            <div>
              <Label className="text-base font-semibold">Shallow End Position</Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <Label htmlFor="shallow-x">X Coordinate (mm)</Label>
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
                  <Label htmlFor="shallow-y">Y Coordinate (mm)</Label>
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
                  <Label htmlFor="deep-x">X Coordinate (mm)</Label>
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
                  <Label htmlFor="deep-y">Y Coordinate (mm)</Label>
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

            {/* Position preview */}
            <div>
              <Label className="text-sm font-medium">Preview with Positions</Label>
              <div className="mt-2">
                <PoolShapePreview
                  outline={currentOutline}
                  shallowEnd={shallowEnd}
                  deepEnd={deepEnd}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1" disabled={!poolName || currentOutline.length < 4}>
            {pool ? 'Update Pool' : 'Create Pool'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
