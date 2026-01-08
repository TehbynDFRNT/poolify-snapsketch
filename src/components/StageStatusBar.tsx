import { useState } from 'react';
import { Check, ChevronDown, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDesignStore } from '@/store/designStore';
import { PROJECT_STAGE_LABELS, PROJECT_STAGE_ORDER, ProjectStage } from '@/types';
import { toast } from 'sonner';

interface StageStatusBarProps {
  onHistoryClick?: () => void;
}

export const StageStatusBar = ({ onHistoryClick }: StageStatusBarProps) => {
  const [isApproving, setIsApproving] = useState(false);
  const { currentProject, changeStage, approveProject } = useDesignStore();

  if (!currentProject) return null;

  const currentStage = currentProject.stage || 'proposal';
  const currentStatus = currentProject.status || 'draft';
  const isLastStage = PROJECT_STAGE_ORDER.indexOf(currentStage) === PROJECT_STAGE_ORDER.length - 1;

  const handleStageChange = (stage: ProjectStage) => {
    changeStage(stage);
    toast.success(`Stage changed to ${PROJECT_STAGE_LABELS[stage]}`);
  };

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const result = await approveProject();
      if (result.success) {
        if (isLastStage) {
          toast.success('Version saved! (Already at final stage)');
        } else {
          const nextStageIndex = PROJECT_STAGE_ORDER.indexOf(currentStage) + 1;
          const nextStage = PROJECT_STAGE_ORDER[nextStageIndex];
          toast.success(`Approved! Advanced to ${PROJECT_STAGE_LABELS[nextStage]}`);
        }
      } else {
        toast.error(result.error || 'Failed to approve');
      }
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Stage Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1 h-8">
            <span className="font-medium">{PROJECT_STAGE_LABELS[currentStage]}</span>
            <span className="text-muted-foreground">•</span>
            <span className={currentStatus === 'draft' ? 'text-orange-500' : 'text-green-500'}>
              {currentStatus === 'draft' ? 'Draft' : 'Approved'}
            </span>
            <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {PROJECT_STAGE_ORDER.map((stage) => (
            <DropdownMenuItem
              key={stage}
              onClick={() => handleStageChange(stage)}
              className="gap-2"
            >
              {stage === currentStage && <Check className="h-4 w-4" />}
              {stage !== currentStage && <span className="w-4" />}
              {PROJECT_STAGE_LABELS[stage]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Approve Button */}
      <Button
        variant="default"
        size="sm"
        className="h-8 bg-green-600 hover:bg-green-700"
        onClick={handleApprove}
        disabled={isApproving}
      >
        <Check className="h-4 w-4 mr-1" />
        {isApproving ? 'Saving...' : 'Approve'}
      </Button>

      {/* History Button */}
      {onHistoryClick && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={onHistoryClick}
          title="Version History"
        >
          <History className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
