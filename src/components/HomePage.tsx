import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Calendar, CheckCircle, AlertCircle, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { getAllProjects, deleteProject } from '@/utils/storage';
import { Project } from '@/types';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { NewProjectModal } from './NewProjectModal';
import { v4 as uuidv4 } from 'uuid';

export const HomePage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>(getAllProjects());
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filteredProjects = projects.filter(
    p =>
      p.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = (id: string) => {
    deleteProject(id);
    setProjects(getAllProjects());
    setDeleteConfirm(null);
    toast.success('Project deleted');
  };

  const handleDuplicate = (project: Project) => {
    const newProject: Project = {
      ...project,
      id: uuidv4(),
      customerName: `${project.customerName} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const { saveProject } = require('@/utils/storage');
    saveProject(newProject);
    setProjects(getAllProjects());
    toast.success('Project duplicated');
  };

  const handleCreateProject = (data: { customerName: string; address: string; notes?: string }) => {
    const newProject: Project = {
      id: uuidv4(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
      components: [],
    };
    
    const { saveProject } = require('@/utils/storage');
    saveProject(newProject);
    setShowNewProject(false);
    navigate(`/project/${newProject.id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              🏊 Pool Design Tool
            </h1>
            <p className="text-muted-foreground mt-1">Professional site plans at 1:100 scale</p>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <Button onClick={() => setShowNewProject(true)} size="lg" className="gap-2">
            <Plus className="h-5 w-5" />
            New Project
          </Button>
          
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="grid gap-4">
          {filteredProjects.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">
                  {searchQuery ? 'No projects found' : 'No projects yet'}
                </p>
                <Button onClick={() => setShowNewProject(true)} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Create your first project
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredProjects.map((project) => (
              <Card key={project.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-1">{project.customerName}</CardTitle>
                      <CardDescription className="text-base">{project.address}</CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/project/${project.id}`)}>
                          Open
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(project)}>
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteConfirm(project.id)}
                          className="text-destructive"
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {format(project.updatedAt, 'MMM d, yyyy • h:mm a')}
                    </div>
                    {project.components.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-success" />
                        {project.components.length} components
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-warning" />
                        In Progress
                      </div>
                    )}
                  </div>
                  {project.notes && (
                    <p className="text-sm text-muted-foreground mb-4">{project.notes}</p>
                  )}
                  <Button onClick={() => navigate(`/project/${project.id}`)}>
                    Open Project
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <NewProjectModal
        open={showNewProject}
        onOpenChange={setShowNewProject}
        onSubmit={handleCreateProject}
      />

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
