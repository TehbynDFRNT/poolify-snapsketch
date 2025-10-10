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

// Paver configuration options for corner-first methodology
const PAVER_CONFIGS = [
  { 
    key: '400x400_400x400',
    name: '400×400 Corner + 400×400 Full',
    cornerSize: { width: 400, height: 400 },
    fullSize: { width: 400, height: 400 }
  },
  { 
    key: '400x400_600x400',
    name: '400×400 Corner + 600×400 Full',
    cornerSize: { width: 400, height: 400 },
    fullSize: { width: 600, height: 400 }
  },
  { 
    key: '600x400_400x400',
    name: '600×400 Corner + 400×400 Full',
    cornerSize: { width: 600, height: 400 },
    fullSize: { width: 400, height: 400 }
  },
  { 
    key: '400x600_400x400',
    name: '400×600 Corner + 400×400 Full',
    cornerSize: { width: 400, height: 600 },
    fullSize: { width: 400, height: 400 }
  },
];

export default function Step4GenerateCoping({ poolData, setPoolData, onNext, onBack, onSaveDraft }: Step4Props) {
  const [selectedConfigs, setSelectedConfigs] = useState(
    PAVER_CONFIGS.reduce((acc, config) => ({ ...acc, [config.key]: true }), {})
  );
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');

  const handleGenerate = async () => {
    setGenerating(true);
    const variants = [];

    try {
      // Generate coping layout for each selected configuration
      for (const config of PAVER_CONFIGS) {
        if (selectedConfigs[config.key]) {
          setProgress(`Generating ${config.name} layout...`);
          
          const layout = generateCopingLayout(
            poolData.outline_points,
            config.cornerSize,
            config.fullSize
          );
          
          variants.push({
            ...poolData,
            variant_name: `${poolData.pool_name} - ${config.name}`,
            has_coping: true,
            coping_type: config.key,
            coping_layout: layout,
            paver_size_corner: `${config.cornerSize.width}×${config.cornerSize.height}`,
            paver_size_full: `${config.fullSize.width}×${config.fullSize.height}`,
          });
          
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      setPoolData({ ...poolData, generatedVariants: variants });
      setProgress(`✓ Generated ${variants.length} coping variants!`);
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
        <p className="text-sm text-muted-foreground mb-4">
          Select paver configurations to generate. Each creates a separate pool variant using the <strong>corner-first methodology</strong> with uniform stripe patterns.
        </p>
        
        {PAVER_CONFIGS.map(config => (
          <label key={config.key} className="flex items-start gap-3 p-4 border rounded hover:bg-muted/50 cursor-pointer">
            <Checkbox
              checked={selectedConfigs[config.key]}
              onCheckedChange={(checked) => 
                setSelectedConfigs({ ...selectedConfigs, [config.key]: !!checked })
              }
              className="mt-1"
            />
            <div>
              <div className="font-medium">{config.name}</div>
              <div className="text-sm text-muted-foreground">
                Corner: {config.cornerSize.width}×{config.cornerSize.height}mm • 
                Full: {config.fullSize.width}×{config.fullSize.height}mm • 
                5mm grout lines
              </div>
            </div>
          </label>
        ))}
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
