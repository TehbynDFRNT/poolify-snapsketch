import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface Step1Props {
  poolData: any;
  setPoolData: (data: any) => void;
  onNext: () => void;
  onCancel: () => void;
  onSaveDraft: () => void;
}

export default function Step1PoolInfo({ poolData, setPoolData, onNext, onCancel, onSaveDraft }: Step1Props) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!poolData.pool_name?.trim()) {
      newErrors.pool_name = 'Pool name is required';
    }
    if (!poolData.variant_name?.trim()) {
      newErrors.variant_name = 'Variant name is required';
    }
    if (poolData.length < 1000 || poolData.length > 20000) {
      newErrors.length = 'Length must be between 1m and 20m';
    }
    if (poolData.width < 1000 || poolData.width > 20000) {
      newErrors.width = 'Width must be between 1m and 20m';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      onNext();
    }
  };

  return (
    <div className="bg-card rounded-lg shadow p-8 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Step 1: Pool Information</h2>
      <p className="text-muted-foreground mb-6">Enter basic details about this pool variant</p>

      <div className="space-y-6">
        {/* Pool Name */}
        <div>
          <Label htmlFor="pool_name">Pool Name *</Label>
          <Input
            id="pool_name"
            value={poolData.pool_name}
            onChange={(e) => setPoolData({ ...poolData, pool_name: e.target.value })}
            placeholder="e.g., Latina, Empire, Barcelona"
            className={errors.pool_name ? 'border-destructive' : ''}
          />
          {errors.pool_name && (
            <p className="text-destructive text-sm mt-1">{errors.pool_name}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            This groups similar pool variants together
          </p>
        </div>

        {/* Variant Name */}
        <div>
          <Label htmlFor="variant_name">Variant Name *</Label>
          <Input
            id="variant_name"
            value={poolData.variant_name}
            onChange={(e) => setPoolData({ ...poolData, variant_name: e.target.value })}
            placeholder="e.g., No Coping, 400×400 Coping"
            className={errors.variant_name ? 'border-destructive' : ''}
          />
          {errors.variant_name && (
            <p className="text-destructive text-sm mt-1">{errors.variant_name}</p>
          )}
        </div>

        {/* Dimensions */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="length">Base Length (mm) *</Label>
            <Input
              id="length"
              type="number"
              step="100"
              value={poolData.length}
              onChange={(e) => setPoolData({ ...poolData, length: parseInt(e.target.value) || 0 })}
              className={errors.length ? 'border-destructive' : ''}
            />
            {errors.length && (
              <p className="text-destructive text-sm mt-1">{errors.length}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {(poolData.length / 1000).toFixed(1)}m
            </p>
          </div>
          <div>
            <Label htmlFor="width">Base Width (mm) *</Label>
            <Input
              id="width"
              type="number"
              step="100"
              value={poolData.width}
              onChange={(e) => setPoolData({ ...poolData, width: parseInt(e.target.value) || 0 })}
              className={errors.width ? 'border-destructive' : ''}
            />
            {errors.width && (
              <p className="text-destructive text-sm mt-1">{errors.width}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {(poolData.width / 1000).toFixed(1)}m
            </p>
          </div>
        </div>

        {/* Notes */}
        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            rows={3}
            value={poolData.notes || ''}
            onChange={(e) => setPoolData({ ...poolData, notes: e.target.value })}
            placeholder="e.g., Standard pool with corner cut"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between mt-8 pt-6 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onSaveDraft}>
            💾 Save Draft
          </Button>
          <Button onClick={handleNext}>
            Next: Pool Shape →
          </Button>
        </div>
      </div>
    </div>
  );
}
