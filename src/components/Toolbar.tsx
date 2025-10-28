import {
  MousePointer2,
  Hand,
  Waves,
  LayoutGrid,
  Droplets,
  Fence as FenceIcon,
  Construction,
  Pentagon,
  Home,
  ScanLine
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
  | 'house'
  | 'quick_measure'
  | 'reference_line';

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
    { id: 'pool' as ToolType, icon: Waves, label: 'Pool', shortcut: '1' },
    { id: 'drainage' as ToolType, icon: Droplets, label: 'Drainage', shortcut: '3' },
    { id: 'fence' as ToolType, icon: FenceIcon, label: 'Fence', shortcut: '4' },
    { id: 'wall' as ToolType, icon: Construction, label: 'Wall', shortcut: '5' },
    { id: 'boundary' as ToolType, icon: Pentagon, label: 'Boundary', shortcut: '6' },
    { id: 'house' as ToolType, icon: Home, label: 'House Outline', shortcut: '7' },
  ];

  const measureTools = [
    { id: 'quick_measure' as ToolType, icon: ScanLine, label: 'Measure', shortcut: 'M' },
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
        
        {/* Separator */}
        <div className="border-t border-border my-2" />
        
        {/* Measurement Tools Section */}
        <div className="text-xs text-muted-foreground px-2 py-1">Guides</div>
        
        {measureTools.map((tool) => (
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
              {tool.id === 'quick_measure' && (
                <p className="text-xs text-muted-foreground mt-1">Hold Shift to lock axis</p>
              )}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
};
