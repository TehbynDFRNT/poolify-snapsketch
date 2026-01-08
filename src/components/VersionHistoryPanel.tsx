import { useEffect, useState } from 'react';
import { History, RotateCcw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDesignStore } from '@/store/designStore';
import { ProjectVersion, PROJECT_STAGE_LABELS } from '@/types';
import { toast } from 'sonner';

interface VersionHistoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const VersionHistoryPanel = ({ open, onOpenChange }: VersionHistoryPanelProps) => {
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const { fetchVersions, restoreVersion, currentProject } = useDesignStore();

  useEffect(() => {
    if (open && currentProject?.id) {
      loadVersions();
    }
  }, [open, currentProject?.id]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const data = await fetchVersions();
      setVersions(data);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (version: ProjectVersion) => {
    setRestoringId(version.id);
    try {
      const result = await restoreVersion(version.id);
      if (result.success) {
        toast.success(`Restored to v${version.versionNumber} (${PROJECT_STAGE_LABELS[version.stage]})`);
        onOpenChange(false);
      } else {
        toast.error(result.error || 'Failed to restore version');
      }
    } finally {
      setRestoringId(null);
    }
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </SheetTitle>
          <SheetDescription>
            View and restore previous approved versions of this design.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No versions saved yet.</p>
              <p className="text-sm mt-2">
                Click "Approve" to save a version snapshot.
              </p>
            </div>
          ) : (
            <div className="space-y-3 pr-4">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          v{version.versionNumber}
                        </span>
                        <span className="text-sm px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {PROJECT_STAGE_LABELS[version.stage]}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDate(version.createdAt)}
                      </div>

                      {version.notes && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {version.notes}
                        </p>
                      )}

                      <p className="text-xs text-muted-foreground mt-2">
                        {(version.components?.length || 0)} components
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(version)}
                      disabled={restoringId === version.id}
                      className="shrink-0"
                    >
                      <RotateCcw className={`h-4 w-4 mr-1 ${restoringId === version.id ? 'animate-spin' : ''}`} />
                      {restoringId === version.id ? 'Restoring...' : 'Restore'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
