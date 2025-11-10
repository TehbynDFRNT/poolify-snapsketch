import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { Share2, X, Mail, Copy, Link, Calendar, Globe } from 'lucide-react';
import { ProjectPublicLink } from '@/types/publicLinks';

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
  const [publicLink, setPublicLink] = useState<ProjectPublicLink | null>(null);
  const [allowExport, setAllowExport] = useState(true);
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [publicLinkLoading, setPublicLinkLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadShares();
      loadPublicLink();
    }
  }, [open, project.id]);

  const loadPublicLink = async () => {
    try {
      const { data, error } = await supabase
        .from('project_public_links')
        .select('*')
        .eq('project_id', project.id)
        .is('revoked_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data && (!data.expires_at || new Date(data.expires_at) > new Date())) {
        setPublicLink(data);
        setAllowExport(data.allow_export);
        setExpiresAt(data.expires_at ? data.expires_at.split('T')[0] : '');
      }
    } catch (error) {
      // No public link exists yet, which is fine
      console.log('No active public link found');
    }
  };

  const generateToken = () => {
    // Generate a URL-safe random token
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  const createPublicLink = async () => {
    if (!user) return;

    setPublicLinkLoading(true);
    try {
      const token = generateToken();

      const { data, error } = await supabase
        .from('project_public_links')
        .insert({
          project_id: project.id,
          token: token,
          allow_export: allowExport,
          expires_at: expiresAt || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setPublicLink(data);

      toast({
        title: 'Public link created',
        description: 'Anyone with the link can now view this project',
      });

      // Log activity
      await supabase.from('activity_log').insert({
        project_id: project.id,
        user_id: user.id,
        action: 'public_link_created',
        details: { allow_export: allowExport, expires_at: expiresAt },
      });
    } catch (error: any) {
      toast({
        title: 'Error creating public link',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setPublicLinkLoading(false);
    }
  };

  const revokePublicLink = async () => {
    if (!publicLink || !user) return;

    setPublicLinkLoading(true);
    try {
      const { error } = await supabase
        .from('project_public_links')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', publicLink.id);

      if (error) throw error;

      setPublicLink(null);
      setExpiresAt('');

      toast({
        title: 'Public link revoked',
        description: 'The public link has been disabled',
      });

      // Log activity
      await supabase.from('activity_log').insert({
        project_id: project.id,
        user_id: user.id,
        action: 'public_link_revoked',
      });
    } catch (error: any) {
      toast({
        title: 'Error revoking public link',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setPublicLinkLoading(false);
    }
  };

  const updatePublicLink = async () => {
    if (!publicLink || !user) return;

    setPublicLinkLoading(true);
    try {
      const { error } = await supabase
        .from('project_public_links')
        .update({
          allow_export: allowExport,
          expires_at: expiresAt || null,
        })
        .eq('id', publicLink.id);

      if (error) throw error;

      toast({
        title: 'Public link updated',
        description: 'Settings have been saved',
      });
    } catch (error: any) {
      toast({
        title: 'Error updating public link',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setPublicLinkLoading(false);
    }
  };

  const copyPublicLink = () => {
    if (!publicLink) return;

    const baseUrl = import.meta.env.VITE_BASE_URL || window.location.origin;
    const url = `${baseUrl}/share/${publicLink.token}`;
    navigator.clipboard.writeText(url);

    toast({
      title: 'Link copied!',
      description: 'Public link copied to clipboard',
    });
  };

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

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users">Team Members</TabsTrigger>
            <TabsTrigger value="public">Public Link</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6 mt-6">
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
          </TabsContent>

          <TabsContent value="public" className="space-y-6 mt-6">
            {!publicLink ? (
              <div className="space-y-4">
                <div className="p-4 border-2 border-dashed rounded-lg text-center">
                  <Globe className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <h3 className="font-medium mb-1">Create a public link</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Anyone with the link can view this project without signing in
                  </p>

                  <div className="space-y-4 text-left max-w-md mx-auto">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="allow-export">Allow exports (PDF/Images)</Label>
                      <Switch
                        id="allow-export"
                        checked={allowExport}
                        onCheckedChange={setAllowExport}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="expires">Expiration date (optional)</Label>
                      <Input
                        id="expires"
                        type="date"
                        value={expiresAt}
                        onChange={(e) => setExpiresAt(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>

                    <Button
                      onClick={createPublicLink}
                      disabled={publicLinkLoading}
                      className="w-full"
                    >
                      <Link className="w-4 h-4 mr-2" />
                      Create Public Link
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <Label className="text-sm">Public Link</Label>
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

                  {publicLink.expires_at && (
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      Expires: {new Date(publicLink.expires_at).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="public-allow-export">Allow exports</Label>
                    <Switch
                      id="public-allow-export"
                      checked={allowExport}
                      onCheckedChange={setAllowExport}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="public-expires">Expiration date</Label>
                    <Input
                      id="public-expires"
                      type="date"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={updatePublicLink}
                      disabled={publicLinkLoading}
                      className="flex-1"
                    >
                      Update Settings
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={revokePublicLink}
                      disabled={publicLinkLoading}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Revoke Link
                    </Button>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg text-sm">
                  <p className="font-medium mb-2">ℹ️ Public link info:</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Anyone with this link can view the project</li>
                    <li>• No authentication required</li>
                    <li>• View-only access (no editing)</li>
                    {allowExport && <li>• Can export to PDF and images</li>}
                  </ul>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
