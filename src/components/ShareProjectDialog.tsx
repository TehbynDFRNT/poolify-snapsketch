import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Share2, Copy, Globe } from 'lucide-react';
import { ProjectPublicLink } from '@/types/publicLinks';

interface ShareProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: {
    id: string;
    customer_name: string;
  };
}

export function ShareProjectDialog({ open, onOpenChange, project }: ShareProjectDialogProps) {
  const { user } = useAuth();
  const [publicLink, setPublicLink] = useState<ProjectPublicLink | null>(null);

  useEffect(() => {
    if (open) {
      loadPublicLink();
    }
  }, [open, project.id]);

  const loadPublicLink = async () => {
    try {
      const { data } = await supabase
        .from('project_public_links')
        .select('*')
        .eq('project_id', project.id)
        .is('revoked_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data && (!data.expires_at || new Date(data.expires_at) > new Date())) {
        setPublicLink(data);
      }
    } catch (error) {
      // No public link exists yet, which is fine
      console.log('No active public link found');
    }
  };

  const copyPublicLink = () => {
    if (!publicLink) return;

    const baseUrl = import.meta.env.VITE_BASE_URL || window.location.origin;
    const url = `${baseUrl}/share/${publicLink.token}`;
    navigator.clipboard.writeText(url);

    toast({
      title: 'Link copied!',
      description: 'Share link copied to clipboard',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Share "{project.customer_name}"
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {publicLink ? (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <Label className="text-sm font-medium">Share Link</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    readOnly
                    value={`${import.meta.env.VITE_BASE_URL || window.location.origin}/share/${publicLink.token}`}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyPublicLink}
                    title="Copy link"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg text-sm">
                <p className="font-medium mb-2">ℹ️ About this link:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Anyone with this link can view the project</li>
                  <li>• No sign-in required</li>
                  <li>• Permanent shareable link</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="p-6 border-2 border-dashed rounded-lg text-center">
              <Globe className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">
                Generating share link...
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
