import { 
  MousePointer2,
  Hand,
  Square, 
  Grid3x3, 
  Droplet, 
  Fence as FenceIcon, 
  Box,
  Hexagon,
  Home
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type ToolType = 
  | 'select' 
  | 'hand'
  | 'pool' 
  | 'paver' 
  | 'drainage' 
  | 'fence' 
  | 'wall'
  | 'boundary'
  | 'house';

interface ToolbarProps {
  activeTool?: ToolType;
  onToolChange?: (tool: ToolType) => void;
}

export const Toolbar = ({ activeTool = 'select', onToolChange }: ToolbarProps) => {
  const handleToolClick = (tool: ToolType) => {
    onToolChange?.(tool);
  };

  const tools = [
    { id: 'select' as ToolType, icon: MousePointer2, label: 'Select/Move', shortcut: 'V' },
    { id: 'hand' as ToolType, icon: Hand, label: 'Pan Canvas', shortcut: 'H' },
    { id: 'pool' as ToolType, icon: Square, label: 'Pool', shortcut: '1' },
    { id: 'paver' as ToolType, icon: Grid3x3, label: 'Paving', shortcut: '2' },
    { id: 'drainage' as ToolType, icon: Droplet, label: 'Drainage', shortcut: '3' },
    { id: 'fence' as ToolType, icon: FenceIcon, label: 'Fence', shortcut: '4' },
    { id: 'wall' as ToolType, icon: Box, label: 'Wall', shortcut: '5' },
    { id: 'boundary' as ToolType, icon: Hexagon, label: 'Boundary', shortcut: '6' },
    { id: 'house' as ToolType, icon: Home, label: 'House Outline', shortcut: '7' },
  ];

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-2 p-2">
        {tools.map((tool) => (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <Button
                variant={activeTool === tool.id ? 'default' : 'ghost'}
                size="icon"
                onClick={() => handleToolClick(tool.id)}
                className={cn(
                  'w-16 h-16',
                  activeTool === tool.id && 'bg-primary text-primary-foreground'
                )}
              >
                <tool.icon className="h-6 w-6" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{tool.label}</p>
              <p className="text-xs text-muted-foreground">Press {tool.shortcut}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
};
