import { useState } from 'react';
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
import { AddressAutocomplete } from '@/components/AddressAutocomplete';

interface NewProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    customerName: string;
    address: string;
    coordinates?: { lat: number; lng: number };
    notes?: string;
  }) => void;
}

export const NewProjectModal = ({ open, onOpenChange, onSubmit }: NewProjectModalProps) => {
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | undefined>();
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ customerName?: string; address?: string }>({});
  const [touched, setTouched] = useState<{ customerName?: boolean; address?: boolean }>({});

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
    });

    // Reset form
    setCustomerName('');
    setAddress('');
    setCoordinates(undefined);
    setNotes('');
    setErrors({});
    setTouched({});
  };

  const handleCancel = () => {
    setCustomerName('');
    setAddress('');
    setCoordinates(undefined);
    setNotes('');
    setErrors({});
    setTouched({});
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
        className="sm:max-w-[500px]"
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
