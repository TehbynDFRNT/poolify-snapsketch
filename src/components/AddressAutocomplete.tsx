import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, coordinates?: { lat: number; lng: number }) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  error?: boolean;
}

export const AddressAutocomplete = ({
  value,
  onChange,
  onBlur,
  placeholder = '123 Main St, Brisbane QLD 4000',
  className,
  disabled,
  error,
}: AddressAutocompleteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [hasSelectedFromDropdown, setHasSelectedFromDropdown] = useState(false);
  const [lastValidAddress, setLastValidAddress] = useState('');

  // Add global styles for Google Maps autocomplete dropdown
  useEffect(() => {
    const styleId = 'google-maps-autocomplete-styles';

    // Check if styles already exist
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .pac-container {
        z-index: 99999 !important;
        border-radius: 8px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        border: 1px solid hsl(var(--border));
        margin-top: 4px;
        font-family: inherit;
        background-color: hsl(var(--background));
      }

      .pac-item {
        padding: 8px 12px;
        cursor: pointer;
        border-top: 1px solid hsl(var(--border));
        font-size: 14px;
        line-height: 1.5;
        background-color: hsl(var(--background));
      }

      .pac-item:first-child {
        border-top: none;
      }

      .pac-item:hover {
        background-color: hsl(var(--accent));
      }

      .pac-item-selected,
      .pac-item-selected:hover {
        background-color: hsl(var(--accent));
      }

      .pac-item-query {
        color: hsl(var(--foreground));
        font-size: 14px;
      }

      .pac-matched {
        font-weight: 600;
      }

      .pac-icon {
        display: none;
      }
    `;
    document.head.appendChild(style);

    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  // Load Google Maps script
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      console.error('Google Maps API key is missing');
      return;
    }

    // Check if script is already loaded
    if (window.google?.maps?.places) {
      setIsScriptLoaded(true);
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector(
      `script[src*="maps.googleapis.com"]`
    );

    if (existingScript) {
      existingScript.addEventListener('load', () => setIsScriptLoaded(true));
      return;
    }

    // Load the script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setIsScriptLoaded(true);
    script.onerror = () => console.error('Failed to load Google Maps script');
    document.head.appendChild(script);
  }, []);

  // Initialize autocomplete
  useEffect(() => {
    if (!isScriptLoaded || !inputRef.current || autocompleteRef.current) {
      return;
    }

    try {
      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'au' }, // Restrict to Australia
        fields: ['formatted_address', 'geometry', 'name'],
        types: ['address'], // Only show addresses
      });

      // Prevent dropdown from closing on click
      const input = inputRef.current;
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
        }
      });

      // Handle place selection
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();

        if (!place.geometry?.location) {
          // User pressed enter without selecting
          console.warn('No geometry for selected place');
          return;
        }

        const address = place.formatted_address || place.name || '';
        const coordinates = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };

        setHasSelectedFromDropdown(true);
        setLastValidAddress(address);
        onChange(address, coordinates);
      });

      autocompleteRef.current = autocomplete;
    } catch (error) {
      console.error('Error initializing autocomplete:', error);
    }
  }, [isScriptLoaded, onChange]);

  // Ensure pac-container has correct z-index and is visible when dropdown appears
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const pacContainers = document.querySelectorAll('.pac-container');
      pacContainers.forEach((container) => {
        const htmlContainer = container as HTMLElement;
        htmlContainer.style.zIndex = '99999';
        htmlContainer.style.pointerEvents = 'auto';
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  // Handle manual input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    // If user is typing after a valid selection, mark as invalid
    if (hasSelectedFromDropdown && newValue !== lastValidAddress) {
      setHasSelectedFromDropdown(false);
    }

    // Allow typing but don't save coordinates
    onChange(newValue, undefined);
  };

  // Handle blur - enforce mandatory selection
  const handleBlur = () => {
    // If user typed but didn't select from dropdown, clear the invalid input
    if (!hasSelectedFromDropdown && value && value !== lastValidAddress) {
      // Optionally clear or revert to last valid
      // For now, we'll allow it but the parent validation will catch it
    }

    onBlur?.();
  };

  return (
    <div className="relative w-full">
      <Input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={className}
        disabled={disabled || !isScriptLoaded}
        autoComplete="off"
        data-has-valid-selection={hasSelectedFromDropdown}
      />
    </div>
  );
};
