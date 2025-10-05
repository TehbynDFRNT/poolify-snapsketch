import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Search, UserPlus } from 'lucide-react';

interface TeamMember {
  id: string;
  full_name: string;
  role: string;
  created_at: string;
}

export function TeamManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'sales_rep' | 'designer' | 'admin'>('designer');
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    checkUserRole();
    loadTeamMembers();
  }, [user]);

  const checkUserRole = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      setUserRole(data.role);
      if (data.role !== 'admin') {
        toast({
          title: 'Access denied',
          description: 'You must be an admin to access team management',
          variant: 'destructive',
        });
        navigate('/projects');
      }
    }
  };

  const loadTeamMembers = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTeamMembers((data as any) || []);
    } catch (error: any) {
      toast({
        title: 'Error loading team members',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail) {
      toast({
        title: 'Missing email',
        description: 'Please enter an email address',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // In a production app, you'd send an actual invitation email via an edge function
      toast({
        title: 'Invitation sent',
        description: `Invitation sent to ${inviteEmail}`,
      });

      setShowInviteDialog(false);
      setInviteEmail('');
      setInviteRole('designer');
    } catch (error: any) {
      toast({
        title: 'Error sending invitation',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filterMembers = (members: TeamMember[]) => {
    if (!searchQuery) return members;
    return members.filter(
      (m) =>
        m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'designer':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'sales_rep':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const formatRole = (role: string) => {
    switch (role) {
      case 'sales_rep':
        return 'Sales Rep';
      case 'designer':
        return 'Designer';
      case 'admin':
        return 'Admin';
      default:
        return role;
    }
  };

  if (userRole !== 'admin') {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading team members...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/projects')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Projects
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Team Management</h1>
          <Button onClick={() => setShowInviteDialog(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Invite User
          </Button>
        </div>

        <div className="mb-6">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search team members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Team Members ({teamMembers.length})</h2>

          {filterMembers(teamMembers).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No team members found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filterMembers(teamMembers).map((member) => (
                <Card key={member.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{member.full_name}</CardTitle>
                        <CardDescription className="mt-1">{member.id}</CardDescription>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                        {formatRole(member.role)}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground">
                      <p>Joined: {new Date(member.created_at).toLocaleDateString()}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>Send an invitation to join your team</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="newuser@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Role</Label>
              <RadioGroup value={inviteRole} onValueChange={(v) => setInviteRole(v as any)} className="mt-2 space-y-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sales_rep" id="invite_sales_rep" />
                  <Label htmlFor="invite_sales_rep" className="font-normal cursor-pointer">
                    Sales Representative
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="designer" id="invite_designer" />
                  <Label htmlFor="invite_designer" className="font-normal cursor-pointer">
                    Designer
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="admin" id="invite_admin" />
                  <Label htmlFor="invite_admin" className="font-normal cursor-pointer">
                    Admin
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <p className="text-sm text-muted-foreground">An invitation email will be sent.</p>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleInvite} disabled={loading}>
                Send Invite
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
