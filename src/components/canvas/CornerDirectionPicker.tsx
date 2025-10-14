import { Html } from 'react-konva-utils';
import { CopingPaverData } from '@/types/copingSelection';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';

interface CornerDirectionPickerProps {
  paver: CopingPaverData;
  position: { x: number; y: number }; // canvas coordinates
  onSelectDirection: (direction: 'leftSide' | 'rightSide' | 'shallowEnd' | 'deepEnd') => void;
  onCancel: () => void;
}

export const CornerDirectionPicker = ({
  paver,
  position,
  onSelectDirection,
  onCancel,
}: CornerDirectionPickerProps) => {
  return (
    <Html
      divProps={{
        style: {
          position: 'absolute',
          left: position.x,
          top: position.y,
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
        },
      }}
    >
      <Card className="p-3 bg-background shadow-lg border-2 border-primary">
        <p className="text-xs font-medium mb-2 text-center">Extend Direction:</p>
        <div className="grid grid-cols-3 gap-1">
          <div />
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSelectDirection('shallowEnd')}
            className="h-8 w-8 p-0"
            title="Shallow End (Up)"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <div />
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSelectDirection('leftSide')}
            className="h-8 w-8 p-0"
            title="Left Side"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center justify-center">
            <div className="h-6 w-6 rounded-full bg-primary/20" />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSelectDirection('rightSide')}
            className="h-8 w-8 p-0"
            title="Right Side"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
          
          <div />
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSelectDirection('deepEnd')}
            className="h-8 w-8 p-0"
            title="Deep End (Down)"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <div />
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          className="w-full mt-2 text-xs"
        >
          Cancel
        </Button>
      </Card>
    </Html>
  );
};
