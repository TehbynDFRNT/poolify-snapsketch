import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { Upload } from 'lucide-react';

interface LocalProject {
  id: string;
  customerName: string;
  address: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  components: any[];
}

interface MigrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMigrationComplete: () => void;
}

export function MigrationDialog({ open, onOpenChange, onMigrationComplete }: MigrationDialogProps) {
  const { user } = useAuth();
  const [localProjects, setLocalProjects] = useState<LocalProject[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [deleteLocal, setDeleteLocal] = useState(true);
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    if (open) {
      loadLocalProjects();
    }
  }, [open]);

  const loadLocalProjects = () => {
    const listData = localStorage.getItem('pool-design-projects-list');
    if (!listData) {
      setLocalProjects([]);
      return;
    }

    const ids: string[] = JSON.parse(listData);
    const projects: LocalProject[] = [];

    for (const id of ids) {
      const data = localStorage.getItem(`project_${id}`);
      if (data) {
        try {
          const project = JSON.parse(data);
          project.createdAt = new Date(project.createdAt);
          project.updatedAt = new Date(project.updatedAt);
          projects.push(project);
        } catch (error) {
          console.error(`Failed to parse project ${id}:`, error);
        }
      }
    }

    // Sort by updated date
    projects.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    setLocalProjects(projects);
    
    // Select all by default
    setSelectedProjects(new Set(projects.map((p) => p.id)));
  };

  const toggleProject = (id: string) => {
    const newSelected = new Set(selectedProjects);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedProjects(newSelected);
  };

  const handleMigrate = async () => {
    if (!user || selectedProjects.size === 0) return;

    setMigrating(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const projectId of Array.from(selectedProjects)) {
        const project = localProjects.find((p) => p.id === projectId);
        if (!project) continue;

        try {
          const { data: newProject, error } = await supabase
            .from('projects')
            .insert({
              owner_id: user.id,
              customer_name: project.customerName,
              address: project.address,
              notes: project.notes,
              components: project.components,
              created_at: project.createdAt.toISOString(),
              updated_at: project.updatedAt.toISOString(),
            })
            .select()
            .single();

          if (error) throw error;

          // Log activity
          await supabase.from('activity_log').insert({
            project_id: newProject.id,
            user_id: user.id,
            action: 'created',
            details: { migrated: true, original_id: projectId },
          });

          successCount++;

          // Delete from localStorage if requested
          if (deleteLocal) {
            localStorage.removeItem(`project_${projectId}`);
          }
        } catch (error) {
          console.error(`Failed to migrate project ${projectId}:`, error);
          errorCount++;
        }
      }

      // Update local projects list
      if (deleteLocal) {
        const listData = localStorage.getItem('pool-design-projects-list');
        if (listData) {
          const ids: string[] = JSON.parse(listData);
          const remaining = ids.filter((id) => !selectedProjects.has(id));
          if (remaining.length > 0) {
            localStorage.setItem('pool-design-projects-list', JSON.stringify(remaining));
          } else {
            localStorage.removeItem('pool-design-projects-list');
          }
        }
      }

      toast({
        title: 'Migration complete',
        description: `Successfully migrated ${successCount} project${successCount !== 1 ? 's' : ''}${
          errorCount > 0 ? `, ${errorCount} failed` : ''
        }`,
      });

      onMigrationComplete();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Migration failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setMigrating(false);
    }
  };

  if (localProjects.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>No Local Projects Found</DialogTitle>
            <DialogDescription>
              You don't have any projects saved locally on this device.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Migrate Your Local Projects
          </DialogTitle>
          <DialogDescription>
            We found {localProjects.length} project{localProjects.length !== 1 ? 's' : ''} saved locally on this
            device. Would you like to upload them to the cloud so you can access them from any device and share
            with your team?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Project list */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {localProjects.map((project) => (
              <div
                key={project.id}
                className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                onClick={() => toggleProject(project.id)}
              >
                <Checkbox
                  checked={selectedProjects.has(project.id)}
                  onCheckedChange={() => toggleProject(project.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex-1">
                  <p className="font-medium">{project.customerName}</p>
                  <p className="text-sm text-muted-foreground">{project.address}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Created: {project.createdAt.toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Delete local option */}
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Checkbox checked={deleteLocal} onCheckedChange={setDeleteLocal as any} />
            <label className="text-sm cursor-pointer" onClick={() => setDeleteLocal(!deleteLocal)}>
              Delete local copies after upload
            </label>
          </div>

          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg text-sm">
            <p className="text-blue-900 dark:text-blue-100">
              ℹ️ This is safe - your projects will be securely stored in the cloud and synced across all your
              devices.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={migrating}>
              Skip for Now
            </Button>
            <Button onClick={handleMigrate} disabled={migrating || selectedProjects.size === 0}>
              {migrating
                ? 'Migrating...'
                : `Migrate ${selectedProjects.size} Project${selectedProjects.size !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
