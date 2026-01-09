import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CheckCircle, Loader2 } from 'lucide-react';
import { PROJECT_STAGE_LABELS, ProjectStage } from '@/types';

interface AcceptanceModalProps {
  open: boolean;
  projectName: string;
  stage?: string;
  onAccept: () => Promise<void>;
  onClose: () => void;
  isLoading: boolean;
  isAccepted: boolean;
  error?: string | null;
}

export function AcceptanceModal({
  open,
  projectName,
  stage,
  onAccept,
  onClose,
  isLoading,
  isAccepted,
  error,
}: AcceptanceModalProps) {
  const stageLabel = stage && PROJECT_STAGE_LABELS[stage as ProjectStage]
    ? PROJECT_STAGE_LABELS[stage as ProjectStage]
    : stage || 'Design';

  // Success state
  if (isAccepted) {
    return (
      <AlertDialog open={open} onOpenChange={onClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              Design Accepted
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have successfully accepted the {stageLabel.toLowerCase()} for <strong>{projectName}</strong>.
              The designer has been notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={onClose}>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Accept Design</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              You are about to accept the <strong>{stageLabel}</strong> for:
            </p>
            <p className="font-medium text-foreground">{projectName}</p>
            <p className="text-sm">
              By accepting, you confirm that you have reviewed the design and approve it to proceed.
            </p>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onAccept();
            }}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Accepting...
              </>
            ) : (
              'Accept Design'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
