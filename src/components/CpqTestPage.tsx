import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Link as LinkIcon, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ProjectResult {
  id: string;
  customerName: string;
  address: string;
  notes: string;
  embedToken: string;
  embedUrl: string;
  embedCode: string;
  allowExport: boolean;
  expiresAt: string | null;
  updatedAt: string;
  createdAt: string;
}

interface ApiResponse {
  success: boolean;
  count: number;
  results: ProjectResult[];
  error?: string;
}

export function CpqTestPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ProjectResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectResult | null>(null);
  const [linkedProject, setLinkedProject] = useState<ProjectResult | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto-search when typing (minimum 2 characters)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.length >= 2) {
        handleSearch();
      } else {
        setResults([]);
        setShowDropdown(false);
      }
    }, 300); // Debounce 300ms

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async () => {
    setLoading(true);

    try {
      const response = await fetch(
        'https://nosjgcmommgvbnijslbs.supabase.co/functions/v1/search-projects',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer 684874ff9c4ea32648ed417bfa89a5b0a111eea0b6be8037854ac48897914060',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ search: searchTerm }),
        }
      );

      const data: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'API request failed');
      }

      if (data.success) {
        setResults(data.results);
        setShowDropdown(data.results.length > 0);
      } else {
        throw new Error(data.error || 'Search failed');
      }
    } catch (error: any) {
      toast({
        title: 'Search failed',
        description: error.message,
        variant: 'destructive',
      });
      setResults([]);
      setShowDropdown(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProject = (project: ProjectResult) => {
    setSelectedProject(project);
    setSearchTerm(`${project.customerName} - ${project.address}`);
    setShowDropdown(false);
  };

  const handleLinkProject = () => {
    if (!selectedProject) {
      toast({
        title: 'No project selected',
        description: 'Please select a project from the search results',
        variant: 'destructive',
      });
      return;
    }

    setLinkedProject(selectedProject);
    toast({
      title: 'Project linked',
      description: `Embedded design for ${selectedProject.customerName}`,
    });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="border-b pb-4">
          <h1 className="text-3xl font-bold">CPQ Integration Test</h1>
          <p className="text-muted-foreground mt-1">
            Test the SnapSketch API endpoint for CPQ systems
          </p>
          <div className="mt-2 text-xs text-muted-foreground">
            DEV ONLY - Auto-search as you type (2+ characters)
          </div>
        </div>

        {/* Search Section */}
        <Card>
          <CardHeader>
            <CardTitle>Search & Link Project</CardTitle>
            <CardDescription>
              Start typing customer name or address - results appear automatically
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Search Input with Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Type customer name or address..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => results.length > 0 && setShowDropdown(true)}
                    className="pl-10 pr-10"
                  />
                  {loading && (
                    <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>

                {/* Dropdown Results */}
                {showDropdown && results.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-[300px] overflow-y-auto">
                    {results.map((project) => (
                      <div
                        key={project.id}
                        onClick={() => handleSelectProject(project)}
                        className="px-4 py-3 hover:bg-accent cursor-pointer border-b last:border-b-0 transition-colors"
                      >
                        <div className="font-medium text-sm">{project.customerName}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{project.address}</div>
                        {project.notes && (
                          <div className="text-xs text-muted-foreground italic mt-1">{project.notes}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Project Preview */}
              {selectedProject && (
                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{selectedProject.customerName}</h3>
                      <p className="text-sm text-muted-foreground">{selectedProject.address}</p>
                      {selectedProject.notes && (
                        <p className="text-sm text-muted-foreground italic mt-1">{selectedProject.notes}</p>
                      )}
                      <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                        <span>Updated: {new Date(selectedProject.updatedAt).toLocaleDateString()}</span>
                        <span>Export: {selectedProject.allowExport ? 'Enabled' : 'Disabled'}</span>
                        <span>
                          Expires: {selectedProject.expiresAt ? new Date(selectedProject.expiresAt).toLocaleDateString() : 'Never'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Link Button */}
              <Button
                onClick={handleLinkProject}
                disabled={!selectedProject || linkedProject?.id === selectedProject?.id}
                className="w-full"
                size="lg"
              >
                <LinkIcon className="h-4 w-4 mr-2" />
                {linkedProject?.id === selectedProject?.id ? 'Project Linked' : 'Link Project Site Plan'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Embed Section */}
        {linkedProject && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Embedded Pool Design</CardTitle>
                  <CardDescription>
                    {linkedProject.customerName} - {linkedProject.address}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLinkedProject(null);
                  }}
                >
                  Clear Embed
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden bg-muted/10">
                <iframe
                  src={linkedProject.embedUrl}
                  width="100%"
                  height="800px"
                  frameBorder="0"
                  title={`${linkedProject.customerName} Pool Design`}
                  className="w-full"
                />
              </div>
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Embed Code:</h4>
                <pre className="text-xs bg-background p-3 rounded border overflow-x-auto">
                  <code>{linkedProject.embedCode}</code>
                </pre>
              </div>
            </CardContent>
          </Card>
        )}

        {/* API Info */}
        <Card>
          <CardHeader>
            <CardTitle>API Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="font-medium">Endpoint:</div>
              <div className="font-mono text-xs">
                POST https://nosjgcmommgvbnijslbs.supabase.co/functions/v1/search-projects
              </div>
              <div className="font-medium">Authentication:</div>
              <div className="font-mono text-xs">Bearer {'{CPQ_API_KEY}'}</div>
              <div className="font-medium">Behavior:</div>
              <div className="text-xs">Auto-search triggers after 2+ characters with 300ms debounce</div>
              <div className="font-medium">Documentation:</div>
              <div className="text-xs">See CPQ_INTEGRATION.md for full details</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
