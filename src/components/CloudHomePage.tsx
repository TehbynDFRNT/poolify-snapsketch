import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { NewProjectModal } from './NewProjectModal';
import { ShareProjectDialog } from './ShareProjectDialog';
import { toast } from '@/hooks/use-toast';
import { Plus, Search, MoreVertical, Share2, Trash2, User, Settings, LogOut, Database } from 'lucide-react';

interface CloudProject {
  id: string;
  customer_name: string;
  address: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
  components: any[];
  is_archived: boolean;
  profiles?: {
    full_name: string;
  };
  project_shares?: Array<{
    permission: string;
  }>;
}

export function CloudHomePage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [projects, setProjects] = useState<CloudProject[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [selectedProject, setSelectedProject] = useState<CloudProject | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    loadProjects();
    loadUserProfile();
    
    // Set up real-time subscriptions
    const projectsChannel = supabase
      .channel('projects-changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'projects' },
        () => loadProjects()
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'projects' },
        () => loadProjects()
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'projects' },
        () => loadProjects()
      )
      .subscribe();

    return () => {
      projectsChannel.unsubscribe();
    };
  }, [user?.id]);

  const loadUserProfile = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (!error && data) {
      setUserProfile(data);
    }
  };

  const loadProjects = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('is_archived', false)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setProjects((data as any) || []);
    } catch (error: any) {
      toast({
        title: 'Error loading projects',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (data: {
    customerName: string;
    address: string;
    coordinates?: { lat: number; lng: number };
    notes?: string;
  }) => {
    if (!user) return;

    try {
      const { data: newProject, error } = await supabase
        .from('projects')
        .insert({
          owner_id: user.id,
          customer_name: data.customerName,
          address: data.address,
          notes: data.notes,
          components: [],
        })
        .select()
        .single();

      if (error) throw error;

      // Automatically create public link in the background
      const generateToken = () => {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
      };

      // Create public link (don't await - run in background)
      supabase
        .from('project_public_links')
        .insert({
          project_id: newProject.id,
          token: generateToken(),
          allow_export: true,
          expires_at: null,
          created_by: user.id,
        })
        .then(() => {
          // Log public link creation
          supabase.from('activity_log').insert({
            project_id: newProject.id,
            user_id: user.id,
            action: 'public_link_auto_created',
            details: { auto_generated: true },
          });
        })
        .catch((err) => {
          console.error('Failed to auto-create public link:', err);
        });

      // Log activity
      await supabase.from('activity_log').insert({
        project_id: newProject.id,
        user_id: user.id,
        action: 'created',
        details: { customer_name: data.customerName },
      });

      toast({
        title: 'Project created',
        description: 'Your new project has been created',
      });

      navigate(`/project/${newProject.id}`);
    } catch (error: any) {
      toast({
        title: 'Error creating project',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Project deleted',
        description: 'The project has been deleted',
      });

      loadProjects();
    } catch (error: any) {
      toast({
        title: 'Error deleting project',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const filterProjects = (projects: CloudProject[]) => {
    if (!searchQuery) return projects;
    return projects.filter(
      (p) =>
        p.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.address.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getComponentSummary = (components: any[]) => {
    const pools = components.filter((c) => c.type === 'pool').length;
    const pavers = components.filter((c) => c.type === 'paver').length;
    const fences = components.filter((c) => c.type === 'fence');
    const totalFenceLength = fences.reduce((sum, f) => sum + (f.dimensions?.width || 0), 0);

    const parts = [];
    if (pools > 0) parts.push(`${pools} pool${pools > 1 ? 's' : ''}`);
    if (pavers > 0) parts.push(`${pavers} paver${pavers > 1 ? 's' : ''}`);
    if (fences.length > 0) parts.push(`${(totalFenceLength / 100).toFixed(1)}m fence`);

    return parts.length > 0 ? parts.join(' • ') : 'Empty project';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">🏊 Pool Design Tool</h1>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <User className="w-4 h-4 mr-2" />
                {userProfile?.full_name || user?.email}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate('/settings/profile')}>
                <Settings className="w-4 h-4 mr-2" />
                Profile Settings
              </DropdownMenuItem>
              {userProfile?.role === 'admin' && (
                <>
                  <DropdownMenuItem onClick={() => navigate('/settings/team')}>
                    <User className="w-4 h-4 mr-2" />
                    Team Management
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/settings/pools')}>
                    <Database className="w-4 h-4 mr-2" />
                    Pool Management
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main content */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4 flex-1">
            <Button onClick={() => setShowNewProjectModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </div>
          
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm text-muted-foreground mb-4">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
          {filterProjects(projects).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No projects found</p>
                <Button className="mt-4" onClick={() => setShowNewProjectModal(true)}>
                  Create your first project
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filterProjects(projects).map((project) => (
                <Card key={project.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{project.customer_name}</CardTitle>
                        <CardDescription className="mt-1">{project.address}</CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedProject(project);
                              setShowShareDialog(true);
                            }}
                          >
                            <Share2 className="w-4 h-4 mr-2" />
                            Share
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setProjectToDelete(project.id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>Updated: {formatDate(project.updated_at)}</p>
                      <p>Owner: {project.owner_id === user?.id ? 'You' : 'Shared'}</p>
                      <p>{getComponentSummary(project.components)}</p>
                    </div>
                    <Button
                      className="w-full mt-4"
                      onClick={() => navigate(`/project/${project.id}`)}
                    >
                      Open
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <NewProjectModal
        open={showNewProjectModal}
        onOpenChange={setShowNewProjectModal}
        onSubmit={handleCreateProject}
      />

      {selectedProject && (
        <ShareProjectDialog
          open={showShareDialog}
          onOpenChange={setShowShareDialog}
          project={selectedProject}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this project? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (projectToDelete) handleDeleteProject(projectToDelete);
                setDeleteDialogOpen(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
