import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { usePoolifyIntegration } from '@/hooks/usePoolifyIntegration';
import { PoolifyProject } from '@/types/poolify';
import { Loader2, CheckCircle, Link } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NewProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    customerName: string;
    address: string;
    coordinates?: { lat: number; lng: number };
    notes?: string;
    poolifyProjectId?: string;
  }) => void;
}

export const NewProjectModal = ({ open, onOpenChange, onSubmit }: NewProjectModalProps) => {
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | undefined>();
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ customerName?: string; address?: string }>({});
  const [touched, setTouched] = useState<{ customerName?: boolean; address?: boolean }>({});

  // Poolify integration state
  const [linkToPoolify, setLinkToPoolify] = useState(false);
  const [poolifySearch, setPoolifySearch] = useState('');
  const [poolifyResults, setPoolifyResults] = useState<PoolifyProject[]>([]);
  const [selectedPoolifyProject, setSelectedPoolifyProject] = useState<PoolifyProject | null>(null);
  const [poolifySearching, setPoolifySearching] = useState(false);

  const { searchProjects } = usePoolifyIntegration();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced Poolify search
  useEffect(() => {
    if (!linkToPoolify || poolifySearch.length < 2) {
      setPoolifyResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setPoolifySearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      const results = await searchProjects(poolifySearch);
      setPoolifyResults(results);
      setPoolifySearching(false);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [poolifySearch, linkToPoolify, searchProjects]);

  const validateField = (field: 'customerName' | 'address', value: string) => {
    if (field === 'customerName') {
      if (value.trim().length < 2) {
        return 'Customer name must be at least 2 characters';
      }
    }
    if (field === 'address') {
      if (value.trim().length < 5) {
        return 'Please select an address from the suggestions';
      }
      if (!coordinates) {
        return 'Please select an address from the dropdown suggestions';
      }
    }
    return undefined;
  };

  const handleBlur = (field: 'customerName' | 'address') => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const value = field === 'customerName' ? customerName : address;
    const error = validateField(field, value);
    if (error) {
      setErrors(prev => ({ ...prev, [field]: error }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: { customerName?: string; address?: string } = {};

    const customerNameError = validateField('customerName', customerName);
    const addressError = validateField('address', address);

    if (customerNameError) newErrors.customerName = customerNameError;
    if (addressError) newErrors.address = addressError;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setTouched({ customerName: true, address: true });
      return;
    }

    onSubmit({
      customerName: customerName.trim(),
      address: address.trim(),
      coordinates,
      notes: notes.trim() || undefined,
      poolifyProjectId: selectedPoolifyProject?.id,
    });

    // Reset form
    resetForm();
  };

  const resetForm = () => {
    setCustomerName('');
    setAddress('');
    setCoordinates(undefined);
    setNotes('');
    setErrors({});
    setTouched({});
    setLinkToPoolify(false);
    setPoolifySearch('');
    setPoolifyResults([]);
    setSelectedPoolifyProject(null);
  };

  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleAddressChange = (newAddress: string, coords?: { lat: number; lng: number }) => {
    setAddress(newAddress);
    setCoordinates(coords);

    // Clear error if valid address with coordinates is selected
    if (coords && newAddress.trim().length >= 5) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.address;
        return newErrors;
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => {
          const originalTarget = (e as any)?.detail?.originalEvent?.target as HTMLElement | undefined;
          if (originalTarget && (originalTarget.closest('.pac-container') || originalTarget.classList.contains('pac-item'))) {
            e.preventDefault();
          }
        }}
        onPointerDownOutside={(e) => {
          const originalTarget = (e as any)?.detail?.originalEvent?.target as HTMLElement | undefined;
          if (originalTarget && (originalTarget.closest('.pac-container') || originalTarget.classList.contains('pac-item'))) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Enter customer details to start a new pool design
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="customerName">
                Customer Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                onBlur={() => handleBlur('customerName')}
                placeholder="John Smith"
                className={touched.customerName && errors.customerName ? 'border-destructive' : ''}
              />
              {touched.customerName && errors.customerName && (
                <p className="text-sm text-destructive">{errors.customerName}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="address">
                Property Address <span className="text-destructive">*</span>
              </Label>
              <AddressAutocomplete
                value={address}
                onChange={handleAddressChange}
                onBlur={() => handleBlur('address')}
                placeholder="Start typing to search Australian addresses..."
                className={touched.address && errors.address ? 'border-destructive' : ''}
                error={touched.address && !!errors.address}
              />
              {touched.address && errors.address && (
                <p className="text-sm text-destructive">{errors.address}</p>
              )}
              {coordinates && (
                <p className="text-xs text-muted-foreground">
                  ✓ Valid address selected
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Project Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Empire pool, glass fencing..."
                rows={3}
              />
            </div>

            {/* Poolify Integration */}
            <div className="grid gap-2 pt-2 border-t">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="linkPoolify"
                  checked={linkToPoolify}
                  onCheckedChange={(checked) => {
                    setLinkToPoolify(!!checked);
                    if (!checked) {
                      setPoolifySearch('');
                      setPoolifyResults([]);
                      setSelectedPoolifyProject(null);
                    }
                  }}
                />
                <Label htmlFor="linkPoolify" className="flex items-center gap-1.5 cursor-pointer">
                  <Link className="h-4 w-4" />
                  Link to Poolify project
                </Label>
              </div>

              {linkToPoolify && (
                <div className="space-y-3 mt-2 p-3 border rounded-lg bg-muted/50">
                  <div className="relative">
                    <Input
                      placeholder="Search Poolify by customer name or address..."
                      value={poolifySearch}
                      onChange={(e) => setPoolifySearch(e.target.value)}
                    />
                    {poolifySearching && (
                      <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {poolifyResults.length > 0 && (
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {poolifyResults.map((project) => (
                        <div
                          key={project.id}
                          className={cn(
                            "p-2 border rounded cursor-pointer hover:bg-accent transition-colors",
                            selectedPoolifyProject?.id === project.id && "border-primary bg-accent"
                          )}
                          onClick={() => setSelectedPoolifyProject(project)}
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

                  {poolifySearch.length >= 2 && !poolifySearching && poolifyResults.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      No Poolify projects found
                    </p>
                  )}

                  {selectedPoolifyProject && (
                    <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-700 dark:text-green-300">
                        Will link to: <strong>{selectedPoolifyProject.owner1}</strong>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit">Create Project</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
