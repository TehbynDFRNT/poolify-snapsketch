import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PublishConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  variantCount: number;
  poolName: string;
}

export default function PublishConfirmDialog({
  open,
  onClose,
  onConfirm,
  variantCount,
  poolName
}: PublishConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Publish Pool Variants?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>
              You are about to publish <strong>{variantCount}</strong> variant
              {variantCount > 1 ? 's' : ''} of <strong>{poolName}</strong>.
            </p>
            
            <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded p-3">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ <strong>Warning:</strong> Once published, these pools will be 
                immediately visible in the frontend pool selector and available for 
                sales reps to use in designs.
              </p>
            </div>

            <div className="space-y-2 text-sm">
              <p className="font-medium">Publishing will:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Make pools visible to all users</li>
                <li>Include coping layouts in pool selector</li>
                <li>Log publish action with timestamp</li>
                <li>Allow pools to be used in new designs</li>
              </ul>
            </div>

            <p className="text-sm text-muted-foreground">
              You can unpublish variants later from the Pool Library admin page.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="bg-green-600 hover:bg-green-700"
          >
            ✓ Confirm & Publish
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
