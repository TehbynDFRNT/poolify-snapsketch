import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ExportOptions } from '@/types';
import { Download, Loader2 } from 'lucide-react';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (options: ExportOptions) => Promise<void>;
}

export const ExportDialog = ({ open, onOpenChange, onExport }: ExportDialogProps) => {
  const [exporting, setExporting] = useState(false);
  const [options, setOptions] = useState<ExportOptions>({
    format: 'pdf',
    scale: '1:100',
    includeGrid: true,
    includeMeasurements: true,
    includeLegend: true,
    includeSummary: true,
    paperSize: 'A3',
    orientation: 'landscape',
    resolution: '4K',
    backgroundColor: 'white',
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      await onExport(options);
      onOpenChange(false);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Export Design</DialogTitle>
          <DialogDescription>
            Configure your export settings below
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Format</Label>
            <Select 
              value={options.format} 
              onValueChange={(value: ExportOptions['format']) => 
                setOptions({ ...options, format: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="png">PNG Image</SelectItem>
                <SelectItem value="jpeg">JPEG Image</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Scale</Label>
              <Select 
                value={options.scale} 
                onValueChange={(value: ExportOptions['scale']) => 
                  setOptions({ ...options, scale: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1:50">1:50</SelectItem>
                  <SelectItem value="1:100">1:100</SelectItem>
                  <SelectItem value="1:200">1:200</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {options.format === 'pdf' ? (
              <div className="space-y-2">
                <Label>Paper Size</Label>
                <Select 
                  value={options.paperSize} 
                  onValueChange={(value: ExportOptions['paperSize']) => 
                    setOptions({ ...options, paperSize: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A4">A4</SelectItem>
                    <SelectItem value="A3">A3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Resolution</Label>
                <Select 
                  value={options.resolution} 
                  onValueChange={(value: '1080p' | '4K' | '8K') => 
                    setOptions({ ...options, resolution: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1080p">1080p (1920×1080)</SelectItem>
                    <SelectItem value="4K">4K (3840×2160)</SelectItem>
                    <SelectItem value="8K">8K (7680×4320)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {options.format === 'pdf' && (
            <div className="space-y-2">
              <Label>Orientation</Label>
              <Select 
                value={options.orientation} 
                onValueChange={(value: ExportOptions['orientation']) => 
                  setOptions({ ...options, orientation: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="landscape">Landscape</SelectItem>
                  <SelectItem value="portrait">Portrait</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {options.format === 'png' && (
            <div className="space-y-2">
              <Label>Background</Label>
              <Select 
                value={options.backgroundColor} 
                onValueChange={(value: 'white' | 'transparent') => 
                  setOptions({ ...options, backgroundColor: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="white">White</SelectItem>
                  <SelectItem value="transparent">Transparent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-3">
            <Label>Include in Export</Label>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="grid" 
                checked={options.includeGrid}
                onCheckedChange={(checked) => 
                  setOptions({ ...options, includeGrid: checked as boolean })
                }
              />
              <label htmlFor="grid" className="text-sm cursor-pointer">
                Grid lines
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="measurements" 
                checked={options.includeMeasurements}
                onCheckedChange={(checked) => 
                  setOptions({ ...options, includeMeasurements: checked as boolean })
                }
              />
              <label htmlFor="measurements" className="text-sm cursor-pointer">
                Measurements
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="legend" 
                checked={options.includeLegend}
                onCheckedChange={(checked) => 
                  setOptions({ ...options, includeLegend: checked as boolean })
                }
              />
              <label htmlFor="legend" className="text-sm cursor-pointer">
                Legend
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="summary" 
                checked={options.includeSummary}
                onCheckedChange={(checked) => 
                  setOptions({ ...options, includeSummary: checked as boolean })
                }
              />
              <label htmlFor="summary" className="text-sm cursor-pointer">
                Materials summary
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export {options.format.toUpperCase()}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
