import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePoolifyIntegration } from '@/hooks/usePoolifyIntegration';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NewProjectModal } from './NewProjectModal';
import { ShareProjectDialog } from './ShareProjectDialog';
import { toast } from '@/hooks/use-toast';
import { Plus, Search, MoreVertical, Share2, Trash2, User, Settings, LogOut, Database, Pencil, Loader2, CheckCircle, Link } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface CloudProject {
  id: string;
  customer_name: string;
  address: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
  org_id?: string | null;
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
  const { linkToPoolify, searchProjects, checkLink } = usePoolifyIntegration();
  const [projects, setProjects] = useState<CloudProject[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [selectedProject, setSelectedProject] = useState<CloudProject | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<CloudProject | null>(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editLinkToPoolify, setEditLinkToPoolify] = useState(false);
  const [editPoolifySearch, setEditPoolifySearch] = useState('');
  const [editPoolifyResults, setEditPoolifyResults] = useState<any[]>([]);
  const [editSelectedPoolifyProject, setEditSelectedPoolifyProject] = useState<any>(null);
  const [editPoolifySearching, setEditPoolifySearching] = useState(false);
  const [editLinkedPoolProject, setEditLinkedPoolProject] = useState<any>(null);
  const [editCheckingLink, setEditCheckingLink] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [projectFilter, setProjectFilter] = useState<'mine' | 'org'>('mine');

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

  // Debounced Poolify search for edit dialog
  const editSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!editLinkToPoolify || editPoolifySearch.length < 2) {
      setEditPoolifyResults([]);
      return;
    }

    if (editSearchTimeoutRef.current) {
      clearTimeout(editSearchTimeoutRef.current);
    }

    setEditPoolifySearching(true);
    editSearchTimeoutRef.current = setTimeout(async () => {
      const results = await searchProjects(editPoolifySearch);
      setEditPoolifyResults(results);
      setEditPoolifySearching(false);
    }, 300);

    return () => {
      if (editSearchTimeoutRef.current) {
        clearTimeout(editSearchTimeoutRef.current);
      }
    };
  }, [editPoolifySearch, editLinkToPoolify, searchProjects]);

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
        .select(`
          *,
          profiles!projects_owner_id_fkey (
            full_name
          )
        `)
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
    poolifyProjectId?: string;
  }) => {
    if (!user) return;

    try {
      const { data: newProject, error } = await supabase
        .from('projects')
        .insert({
          owner_id: user.id,
          org_id: user.orgId ?? null,
          customer_name: data.customerName,
          address: data.address,
          notes: data.notes,
          components: [],
        })
        .select()
        .single();

      if (error) throw error;

      // Generate public link token
      const generateToken = () => {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
      };

      const token = generateToken();

      // Create public link - await if linking to Poolify, otherwise run in background
      const publicLinkPromise = supabase
        .from('project_public_links')
        .insert({
          project_id: newProject.id,
          token: token,
          allow_export: true,
          expires_at: null,
          created_by: user.id,
        })
        .select()
        .single();

      if (data.poolifyProjectId) {
        // Need to await public link creation to get the token for Poolify
        const { error: linkError } = await publicLinkPromise;

        if (!linkError) {
          // Link to Poolify
          const baseUrl = import.meta.env.VITE_BASE_URL || window.location.origin;
          const embedUrl = `${baseUrl}/share/${token}`;

          const success = await linkToPoolify({
            poolProjectId: data.poolifyProjectId,
            snapsketch: {
              id: newProject.id,
              customerName: data.customerName,
              address: data.address,
              embedToken: token,
              embedUrl: embedUrl,
              embedCode: `<iframe src="${embedUrl}" width="800" height="600" frameborder="0" title="${data.customerName} Pool Design"></iframe>`,
              allowExport: true,
              expiresAt: null,
            },
          });

          if (success) {
            toast({
              title: 'Project linked to Poolify',
              description: 'Site plan will be available in Poolify automatically.',
            });
          }

          // Log public link creation
          supabase.from('activity_log').insert({
            project_id: newProject.id,
            user_id: user.id,
            action: 'public_link_auto_created',
            details: { auto_generated: true, linked_to_poolify: true },
          });
        }
      } else {
        // No Poolify linking - run public link creation in background
        publicLinkPromise
          .then(() => {
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
      }

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

  const handleEditProject = async () => {
    if (!projectToEdit || !user) return;

    try {
      // If linking to Poolify, use Poolify's owner1 and siteAddress
      const finalCustomerName = editSelectedPoolifyProject
        ? editSelectedPoolifyProject.owner1
        : editCustomerName.trim();
      const finalAddress = editSelectedPoolifyProject
        ? (editSelectedPoolifyProject.siteAddress || editSelectedPoolifyProject.homeAddress)
        : editAddress.trim();

      const { error } = await supabase
        .from('projects')
        .update({
          customer_name: finalCustomerName,
          address: finalAddress,
          notes: editNotes.trim() || null,
        })
        .eq('id', projectToEdit.id);

      if (error) throw error;

      // Handle Poolify linking if selected
      if (editSelectedPoolifyProject) {
        // Get existing public link or create one
        const { data: existingLink } = await supabase
          .from('project_public_links')
          .select('token')
          .eq('project_id', projectToEdit.id)
          .is('revoked_at', null)
          .single();

        let token = existingLink?.token;

        if (!token) {
          // Create a new public link
          const generateToken = () => {
            const array = new Uint8Array(32);
            crypto.getRandomValues(array);
            return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
          };
          token = generateToken();

          await supabase
            .from('project_public_links')
            .insert({
              project_id: projectToEdit.id,
              token: token,
              allow_export: true,
              expires_at: null,
              created_by: user.id,
            });
        }

        // Link to Poolify
        const baseUrl = import.meta.env.VITE_BASE_URL || window.location.origin;
        const embedUrl = `${baseUrl}/share/${token}`;

        const success = await linkToPoolify({
          poolProjectId: editSelectedPoolifyProject.id,
          snapsketch: {
            id: projectToEdit.id,
            customerName: finalCustomerName,
            address: finalAddress,
            embedToken: token,
            embedUrl: embedUrl,
            embedCode: `<iframe src="${embedUrl}" width="800" height="600" frameborder="0" title="${finalCustomerName} Pool Design"></iframe>`,
            allowExport: true,
            expiresAt: null,
          },
        });

        if (success) {
          toast({
            title: 'Project linked to Poolify',
            description: 'Site plan is now available in Poolify.',
          });
        }
      }

      toast({
        title: 'Project updated',
        description: 'Project details have been saved',
      });

      setEditDialogOpen(false);
      setProjectToEdit(null);
      loadProjects();
    } catch (error: any) {
      toast({
        title: 'Error updating project',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = async (project: CloudProject) => {
    setProjectToEdit(project);
    setEditCustomerName(project.customer_name);
    setEditAddress(project.address);
    setEditNotes(project.notes || '');
    setEditLinkToPoolify(false);
    setEditPoolifySearch('');
    setEditPoolifyResults([]);
    setEditSelectedPoolifyProject(null);
    setEditLinkedPoolProject(null);
    setEditDialogOpen(true);

    // Check if already linked to Poolify
    setEditCheckingLink(true);
    const linkStatus = await checkLink(project.id);
    setEditCheckingLink(false);
    if (linkStatus?.linked && linkStatus.poolProject) {
      setEditLinkedPoolProject(linkStatus.poolProject);
      // Update name and address from Poolify data
      setEditCustomerName(linkStatus.poolProject.owner1);
      if (linkStatus.poolProject.siteAddress) {
        setEditAddress(linkStatus.poolProject.siteAddress);
      }
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/sign-in');
  };

  const filterProjects = (projects: CloudProject[]) => {
    let filtered = projects;

    // Filter by ownership
    if (projectFilter === 'mine') {
      filtered = filtered.filter(p => p.owner_id === user?.id);
    } else if (projectFilter === 'org') {
      // RLS already limits visibility to own + shared + same-org projects,
      // so "org" tab just shows everything the user doesn't own.
      filtered = filtered.filter(p => p.owner_id !== user?.id);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (p) =>
          p.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
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

        {/* Tabs for My Projects vs Team Projects */}
        <div className="flex gap-1 border-b mb-6">
          <button
            onClick={() => setProjectFilter('mine')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              projectFilter === 'mine'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            My Projects
            <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded-full">
              {projects.filter(p => p.owner_id === user?.id).length}
            </span>
          </button>
          <button
            onClick={() => setProjectFilter('org')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              projectFilter === 'org'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Organisation Projects
            <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded-full">
              {projects.filter(p => p.owner_id !== user?.id).length}
            </span>
          </button>
        </div>

        <div className="mt-2">
          <p className="text-sm text-muted-foreground mb-4">
            {filterProjects(projects).length} project{filterProjects(projects).length !== 1 ? 's' : ''}
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
                        {project.owner_id !== user?.id && project.profiles?.full_name && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Owner: {project.profiles.full_name}
                          </p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => openEditDialog(project)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
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

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update project details
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="editCustomerName">Customer Name</Label>
              <Input
                id="editCustomerName"
                value={editCustomerName}
                onChange={(e) => setEditCustomerName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editAddress">Address</Label>
              <Input
                id="editAddress"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editNotes">Notes</Label>
              <Textarea
                id="editNotes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Poolify Integration */}
            <div className="grid gap-2 pt-2 border-t">
              {editCheckingLink ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Checking Poolify link...</span>
                </div>
              ) : editLinkedPoolProject ? (
                <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700 dark:text-green-300">
                    <span className="flex items-center gap-1.5">
                      <Link className="h-4 w-4" />
                      Linked to Poolify: <strong>{editLinkedPoolProject.owner1}</strong>
                    </span>
                    {editLinkedPoolProject.siteAddress && (
                      <span className="text-xs block mt-1 opacity-80">{editLinkedPoolProject.siteAddress}</span>
                    )}
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="editLinkPoolify"
                      checked={editLinkToPoolify}
                      onCheckedChange={(checked) => {
                        setEditLinkToPoolify(!!checked);
                        if (!checked) {
                          setEditPoolifySearch('');
                          setEditPoolifyResults([]);
                          setEditSelectedPoolifyProject(null);
                        }
                      }}
                    />
                    <Label htmlFor="editLinkPoolify" className="flex items-center gap-1.5 cursor-pointer">
                      <Link className="h-4 w-4" />
                      Link to Poolify project
                    </Label>
                  </div>

                  {editLinkToPoolify && (
                    <div className="space-y-3 mt-2 p-3 border rounded-lg bg-muted/50">
                      <div className="relative">
                        <Input
                          placeholder="Search Poolify by customer name or address..."
                          value={editPoolifySearch}
                          onChange={(e) => setEditPoolifySearch(e.target.value)}
                        />
                        {editPoolifySearching && (
                          <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>

                      {editPoolifyResults.length > 0 && (
                        <div className="max-h-48 overflow-y-auto space-y-2">
                          {editPoolifyResults.map((project: any) => (
                            <div
                              key={project.id}
                              className={cn(
                                "p-2 border rounded cursor-pointer hover:bg-accent transition-colors",
                                editSelectedPoolifyProject?.id === project.id && "border-primary bg-accent"
                              )}
                              onClick={() => setEditSelectedPoolifyProject(project)}
                            >
                              <p className="font-medium text-sm">{project.owner1}</p>
                              <p className="text-xs text-muted-foreground">
                                {project.siteAddress || project.homeAddress}
                              </p>
                              {project.hasSnapSketch && (
                                <Badge variant="secondary" className="mt-1 text-xs">
                                  Already linked
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {editPoolifySearch.length >= 2 && !editPoolifySearching && editPoolifyResults.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          No Poolify projects found
                        </p>
                      )}

                      {editSelectedPoolifyProject && (
                        <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <AlertDescription className="text-green-700 dark:text-green-300">
                            Will link to: <strong>{editSelectedPoolifyProject.owner1}</strong>
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditProject}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
