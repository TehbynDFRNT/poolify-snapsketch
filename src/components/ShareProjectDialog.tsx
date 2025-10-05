import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Share2, X, Mail } from 'lucide-react';

interface ShareProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: {
    id: string;
    customer_name: string;
  };
}

interface ProjectShare {
  id: string;
  user_id: string;
  permission: string;
  shared_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

export function ShareProjectDialog({ open, onOpenChange, project }: ShareProjectDialogProps) {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'view' | 'edit' | 'admin'>('view');
  const [shares, setShares] = useState<ProjectShare[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadShares();
    }
  }, [open, project.id]);

  const loadShares = async () => {
    try {
      const { data, error } = await supabase
        .from('project_shares')
        .select(`
          id,
          user_id,
          permission,
          shared_at
        `)
        .eq('project_id', project.id)
        .is('revoked_at', null);

      if (error) throw error;

      // Get user details
      const sharesWithEmails = await Promise.all(
        (data || []).map(async (share) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', share.user_id)
            .single();
          
          return {
            ...share,
            profiles: {
              full_name: profile?.full_name || 'Unknown',
              email: share.user_id, // Using ID temporarily - would need edge function for real email lookup
            },
          };
        })
      );

      setShares(sharesWithEmails as any);
    } catch (error: any) {
      toast({
        title: 'Error loading shares',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleShare = async () => {
    if (!email || !user) return;

    setLoading(true);
    try {
      // Find user by email
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id) // This is a workaround since we can't query auth.users directly
        .single();

      // For now, we'll create a simple share - in production you'd want to lookup the user
      // by email first using an edge function
      const { error: shareError } = await supabase.from('project_shares').insert({
        project_id: project.id,
        user_id: email, // In production, this would be the actual user ID
        permission,
        shared_by: user.id,
      });

      if (shareError) throw shareError;

      // Log activity
      await supabase.from('activity_log').insert({
        project_id: project.id,
        user_id: user.id,
        action: 'shared',
        details: { email, permission },
      });

      toast({
        title: 'Project shared',
        description: `Project shared with ${email}`,
      });

      setEmail('');
      setPermission('view');
      loadShares();
    } catch (error: any) {
      toast({
        title: 'Error sharing project',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('project_shares')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', shareId);

      if (error) throw error;

      toast({
        title: 'Access revoked',
        description: 'User access has been removed',
      });

      loadShares();
    } catch (error: any) {
      toast({
        title: 'Error removing share',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleUpdatePermission = async (shareId: string, newPermission: 'view' | 'edit' | 'admin') => {
    try {
      const { error } = await supabase
        .from('project_shares')
        .update({ permission: newPermission })
        .eq('id', shareId);

      if (error) throw error;

      toast({
        title: 'Permission updated',
        description: 'Share permission has been updated',
      });

      loadShares();
    } catch (error: any) {
      toast({
        title: 'Error updating permission',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Share "{project.customer_name}"
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Invite section */}
          <div className="space-y-4">
            <Label>Invite people to collaborate</Label>
            
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button onClick={handleShare} disabled={loading || !email}>
                <Mail className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Permission</Label>
              <RadioGroup value={permission} onValueChange={(v) => setPermission(v as any)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="view" id="view" />
                  <Label htmlFor="view" className="font-normal cursor-pointer">
                    👁️ View Only (can see, can't edit)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="edit" id="edit" />
                  <Label htmlFor="edit" className="font-normal cursor-pointer">
                    ✏️ Can Edit (can modify design)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="admin" id="admin" />
                  <Label htmlFor="admin" className="font-normal cursor-pointer">
                    👑 Admin (full control)
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          {/* Current shares */}
          {shares.length > 0 && (
            <div className="space-y-4">
              <Label>Currently Shared With</Label>
              
              <div className="space-y-3">
                {shares.map((share) => (
                  <div key={share.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{share.profiles.full_name}</p>
                      <p className="text-sm text-muted-foreground">{share.profiles.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {share.permission === 'view' && '👁️ View Only'}
                        {share.permission === 'edit' && '✏️ Can Edit'}
                        {share.permission === 'admin' && '👑 Admin'}
                        {' • '}Shared {new Date(share.shared_at).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Select
                        value={share.permission}
                        onValueChange={(value) => handleUpdatePermission(share.id, value as 'view' | 'edit' | 'admin')}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="view">View</SelectItem>
                          <SelectItem value="edit">Edit</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveShare(share.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-muted p-4 rounded-lg text-sm">
            <p className="font-medium mb-2">ℹ️ People with access can:</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• <strong>View Only:</strong> See the design</li>
              <li>• <strong>Can Edit:</strong> Modify components</li>
              <li>• <strong>Admin:</strong> Share with others, delete</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
