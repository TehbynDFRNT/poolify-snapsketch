import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreatePoolVariant } from '@/hooks/usePoolVariants';
import { toast } from '@/hooks/use-toast';
import Papa from 'papaparse';
import { Upload, Download } from 'lucide-react';
import {
  POOL_SHAPE_TEMPLATES,
  PoolShapeType,
  RectangleParams,
  TShapeParams,
  getDefaultEndPositions,
} from '@/constants/poolShapeTemplates';

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CSVRow {
  name: string;
  shape?: string; // 'rectangle' or 't-shape'
  // Rectangle fields
  length?: string;
  width?: string;
  // T-shape fields
  mainLength?: string;
  mainWidth?: string;
  extensionLength?: string;
  extensionWidth?: string;
  extensionPosition?: string; // 'center', 'left', 'right'
  notes?: string;
}

export const CSVImportDialog = ({ open, onOpenChange }: CSVImportDialogProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const createMutation = useCreatePoolVariant();

  // Download CSV template
  const handleDownloadTemplate = () => {
    const templateContent = `name,shape,length,width,mainLength,mainWidth,extensionLength,extensionWidth,extensionPosition,notes
Oxford Pool,rectangle,7000,3000,,,,,,"Standard rectangular pool"
Latina Pool,rectangle,8500,4000,,,,,,"Large family pool"
Imperial Bench,t-shape,,,7000,3000,2000,1000,center,"Pool with centered bench"
Grandeur Left,t-shape,,,8000,3500,2500,1200,left,"Pool with left-side bench"
Bellino Right,t-shape,,,7500,3200,2000,1000,right,"Pool with right-side bench"`;

    const blob = new Blob([templateContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pool_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const validateRow = (row: CSVRow, rowIndex: number): string | null => {
    if (!row.name || row.name.trim() === '') {
      return `Row ${rowIndex + 1}: Missing pool name`;
    }

    const shapeType = (row.shape?.toLowerCase().trim() || 'rectangle') as PoolShapeType;

    if (shapeType === 'rectangle') {
      const length = parseFloat(row.length || '');
      const width = parseFloat(row.width || '');

      if (isNaN(length) || length <= 0) {
        return `Row ${rowIndex + 1} (${row.name}): Invalid length value for rectangle`;
      }
      if (isNaN(width) || width <= 0) {
        return `Row ${rowIndex + 1} (${row.name}): Invalid width value for rectangle`;
      }
    } else if (shapeType === 't-shape') {
      const mainLength = parseFloat(row.mainLength || '');
      const mainWidth = parseFloat(row.mainWidth || '');
      const extensionLength = parseFloat(row.extensionLength || '');
      const extensionWidth = parseFloat(row.extensionWidth || '');

      if (isNaN(mainLength) || mainLength <= 0) {
        return `Row ${rowIndex + 1} (${row.name}): Invalid mainLength for t-shape`;
      }
      if (isNaN(mainWidth) || mainWidth <= 0) {
        return `Row ${rowIndex + 1} (${row.name}): Invalid mainWidth for t-shape`;
      }
      if (isNaN(extensionLength) || extensionLength <= 0) {
        return `Row ${rowIndex + 1} (${row.name}): Invalid extensionLength for t-shape`;
      }
      if (isNaN(extensionWidth) || extensionWidth <= 0) {
        return `Row ${rowIndex + 1} (${row.name}): Invalid extensionWidth for t-shape`;
      }

      const extPos = row.extensionPosition?.toLowerCase().trim();
      if (extPos && !['center', 'left', 'right'].includes(extPos)) {
        return `Row ${rowIndex + 1} (${row.name}): extensionPosition must be center, left, or right`;
      }
    } else {
      return `Row ${rowIndex + 1} (${row.name}): Invalid shape type "${row.shape}" (use rectangle or t-shape)`;
    }

    return null;
  };

  // Generate outline and end positions from row data
  const generatePoolFromRow = (row: CSVRow) => {
    const shapeType = (row.shape?.toLowerCase().trim() || 'rectangle') as PoolShapeType;
    const template = POOL_SHAPE_TEMPLATES[shapeType];

    let outline: Array<{ x: number; y: number }>;
    let params: RectangleParams | TShapeParams;

    if (shapeType === 'rectangle') {
      params = {
        length: parseFloat(row.length || '7000'),
        width: parseFloat(row.width || '3000'),
      } as RectangleParams;
      outline = template.generateOutline(params);
    } else {
      const extPos = (row.extensionPosition?.toLowerCase().trim() || 'center') as 'center' | 'left' | 'right';
      params = {
        mainLength: parseFloat(row.mainLength || '7000'),
        mainWidth: parseFloat(row.mainWidth || '3000'),
        extensionLength: parseFloat(row.extensionLength || '2000'),
        extensionWidth: parseFloat(row.extensionWidth || '1000'),
        extensionPosition: extPos,
      } as TShapeParams;
      outline = template.generateOutline(params);
    }

    const endPositions = getDefaultEndPositions(outline, shapeType, params);

    return {
      outline,
      shallowPos: endPositions.shallow,
      deepPos: endPositions.deep,
    };
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: 'Invalid file',
        description: 'Please select a CSV file',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);

    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const errors: string[] = [];
          const validRows: CSVRow[] = [];

          // Validate all rows
          results.data.forEach((row, index) => {
            const error = validateRow(row, index);
            if (error) {
              errors.push(error);
            } else {
              validRows.push(row);
            }
          });

          if (errors.length > 0) {
            toast({
              title: 'CSV Validation Failed',
              description: errors.join('; '),
              variant: 'destructive',
            });
            setIsProcessing(false);
            return;
          }

          if (validRows.length === 0) {
            toast({
              title: 'No valid rows',
              description: 'CSV file contains no valid pool data',
              variant: 'destructive',
            });
            setIsProcessing(false);
            return;
          }

          // Import all valid rows
          let successCount = 0;
          let failCount = 0;

          for (const row of validRows) {
            try {
              const { outline, shallowPos, deepPos } = generatePoolFromRow(row);

              await createMutation.mutateAsync({
                pool_name: row.name.trim(),
                outline,
                shallow_end_position: shallowPos,
                deep_end_position: deepPos,
                notes: row.notes?.trim() || null,
                status: 'draft',
                features: [],
                published_at: null,
                sort_order: null,
                zone_of_influence: null,
              });

              successCount++;
            } catch (error) {
              failCount++;
              console.error(`Failed to import pool: ${row.name}`, error);
            }
          }

          // Show summary
          if (failCount === 0) {
            toast({
              title: 'Import successful',
              description: `Successfully imported ${successCount} pool${successCount !== 1 ? 's' : ''}`,
            });
          } else {
            toast({
              title: 'Import completed with errors',
              description: `Imported ${successCount} pool${successCount !== 1 ? 's' : ''}, ${failCount} failed`,
              variant: 'destructive',
            });
          }

          setIsProcessing(false);
          onOpenChange(false);
        } catch (error) {
          toast({
            title: 'Import failed',
            description: error instanceof Error ? error.message : 'Unknown error',
            variant: 'destructive',
          });
          setIsProcessing(false);
        }
      },
      error: (error) => {
        toast({
          title: 'Failed to parse CSV',
          description: error.message,
          variant: 'destructive',
        });
        setIsProcessing(false);
      },
    });

    // Reset file input
    event.target.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import Pools from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with pool dimensions. Supports both Rectangle and T-Shape pools.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Download Template Button */}
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </Button>
          </div>

          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-4">
              Select a CSV file to import pools
            </p>
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              disabled={isProcessing}
              className="cursor-pointer"
            />
          </div>

          <div className="text-xs text-muted-foreground space-y-3">
            <div>
              <p className="font-semibold mb-1">Rectangle Pools:</p>
              <p className="text-muted-foreground">
                Columns: <code className="bg-muted px-1 rounded">name, shape, length, width, notes</code>
              </p>
              <p className="text-muted-foreground mt-1">
                • <code>shape</code> = "rectangle" (or leave empty)
              </p>
            </div>

            <div>
              <p className="font-semibold mb-1">T-Shape Pools:</p>
              <p className="text-muted-foreground">
                Columns: <code className="bg-muted px-1 rounded">name, shape, mainLength, mainWidth, extensionLength, extensionWidth, extensionPosition, notes</code>
              </p>
              <p className="text-muted-foreground mt-1">
                • <code>shape</code> = "t-shape"<br />
                • <code>extensionPosition</code> = "center", "left", or "right"
              </p>
            </div>

            <p className="text-xs italic border-t pt-2">
              All dimensions in millimeters (mm). Shallow/deep end positions are automatically calculated.
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
            disabled={isProcessing}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
