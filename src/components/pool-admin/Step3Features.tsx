import { Button } from '@/components/ui/button';

interface Step3Props {
  poolData: any;
  setPoolData: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
  onSaveDraft: () => void;
}

export default function Step3Features({ poolData, setPoolData, onNext, onBack, onSaveDraft }: Step3Props) {
  return (
    <div className="bg-card rounded-lg shadow p-8 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Step 3: Pool Features (Optional)</h2>
      <p className="text-muted-foreground mb-6">
        Add optional features like steps, benches, or spa sections
      </p>

      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded p-4 mb-6">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          ℹ️ This step is optional. You can skip it for now and add features later.
        </p>
      </div>

      <div className="flex justify-between mt-8 pt-6 border-t">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onSaveDraft}>
            💾 Save Draft
          </Button>
          <Button onClick={onNext}>
            Next: Generate Coping →
          </Button>
        </div>
      </div>
    </div>
  );
}
