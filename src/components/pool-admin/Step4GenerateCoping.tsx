import { useState } from 'react';
import { generateCopingLayout } from '@/utils/copingAlgorithm';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';

interface Step4Props {
  poolData: any;
  setPoolData: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
  onSaveDraft: () => void;
}

export default function Step4GenerateCoping({ poolData, setPoolData, onNext, onBack, onSaveDraft }: Step4Props) {
  const [selectedTypes, setSelectedTypes] = useState({
    none: true,
    '400x400': true,
    '600x400_h': true,
    '600x400_v': true
  });
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');

  const handleGenerate = async () => {
    setGenerating(true);
    const variants = [];

    try {
      if (selectedTypes.none) {
        setProgress('Creating no-coping variant...');
        variants.push({
          ...poolData,
          variant_name: 'No Coping',
          has_coping: false,
          coping_type: null,
          coping_layout: null
        });
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (selectedTypes['400x400']) {
        setProgress('Calculating 400×400 coping layout...');
        const layout = await generateCopingLayout(
          poolData.outline_points,
          '400x400',
          400,
          5
        );
        variants.push({
          ...poolData,
          variant_name: '400×400 Coping',
          has_coping: true,
          coping_type: '400x400',
          coping_layout: layout
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (selectedTypes['600x400_h']) {
        setProgress('Calculating 600×400 H coping layout...');
        const layout = await generateCopingLayout(
          poolData.outline_points,
          '600x400_h',
          400,
          5
        );
        variants.push({
          ...poolData,
          variant_name: '600×400 H Coping',
          has_coping: true,
          coping_type: '600x400_h',
          coping_layout: layout
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (selectedTypes['600x400_v']) {
        setProgress('Calculating 600×400 V coping layout...');
        const layout = await generateCopingLayout(
          poolData.outline_points,
          '600x400_v',
          400,
          5
        );
        variants.push({
          ...poolData,
          variant_name: '600×400 V Coping',
          has_coping: true,
          coping_type: '600x400_v',
          coping_layout: layout
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      setPoolData({ ...poolData, generatedVariants: variants });
      setProgress('Complete!');
      setTimeout(() => onNext(), 500);
      
    } catch (error) {
      console.error('Coping generation failed:', error);
      setProgress('Error generating coping layouts');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-card rounded-lg shadow p-8 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Step 4: Generate Coping Layouts</h2>
      <p className="text-muted-foreground mb-6">
        Select which coping configurations to generate. Each creates a separate pool variant.
      </p>

      <div className="space-y-4 mb-8">
        <label className="flex items-start gap-3 p-4 border rounded hover:bg-muted/50 cursor-pointer">
          <Checkbox
            checked={selectedTypes.none}
            onCheckedChange={(checked) => 
              setSelectedTypes({ ...selectedTypes, none: !!checked })
            }
            className="mt-1"
          />
          <div>
            <div className="font-medium">No Coping</div>
            <div className="text-sm text-muted-foreground">Pool only, no coping pavers</div>
          </div>
        </label>

        <label className="flex items-start gap-3 p-4 border rounded hover:bg-muted/50 cursor-pointer">
          <Checkbox
            checked={selectedTypes['400x400']}
            onCheckedChange={(checked) => 
              setSelectedTypes({ ...selectedTypes, '400x400': !!checked })
            }
            className="mt-1"
          />
          <div>
            <div className="font-medium">400 × 400mm Coping</div>
            <div className="text-sm text-muted-foreground">
              Standard square pavers, 400mm from pool edge
            </div>
          </div>
        </label>

        <label className="flex items-start gap-3 p-4 border rounded hover:bg-muted/50 cursor-pointer">
          <Checkbox
            checked={selectedTypes['600x400_h']}
            onCheckedChange={(checked) => 
              setSelectedTypes({ ...selectedTypes, '600x400_h': !!checked })
            }
            className="mt-1"
          />
          <div>
            <div className="font-medium">600 × 400mm Horizontal</div>
            <div className="text-sm text-muted-foreground">
              600mm along pool edge, 400mm width
            </div>
          </div>
        </label>

        <label className="flex items-start gap-3 p-4 border rounded hover:bg-muted/50 cursor-pointer">
          <Checkbox
            checked={selectedTypes['600x400_v']}
            onCheckedChange={(checked) => 
              setSelectedTypes({ ...selectedTypes, '600x400_v': !!checked })
            }
            className="mt-1"
          />
          <div>
            <div className="font-medium">600 × 400mm Vertical</div>
            <div className="text-sm text-muted-foreground">
              400mm along pool edge, 600mm width
            </div>
          </div>
        </label>
      </div>

      {generating && (
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="animate-spin">⏳</div>
            <div className="font-medium">{progress}</div>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-6 border-t">
        <Button variant="outline" onClick={onBack} disabled={generating}>
          ← Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onSaveDraft} disabled={generating}>
            💾 Save Draft
          </Button>
          <Button onClick={handleGenerate} disabled={generating}>
            🔄 Generate All Layouts
          </Button>
        </div>
      </div>
    </div>
  );
}
