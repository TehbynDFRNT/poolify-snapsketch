import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Eye, Upload, Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Stage, Layer, Line, Rect } from 'react-konva';

interface PreviewButtonProps {
  variant: any;
}

export function PreviewButton({ variant }: PreviewButtonProps) {
  const [open, setOpen] = useState(false);
  
  const layout = variant.coping_layout;
  const outline = variant.outline || [];

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Eye className="w-4 h-4 mr-1" />
        Preview
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <h2 className="text-xl font-bold mb-4">{variant.pool_name}</h2>

          <div className="border rounded bg-background">
            <Stage width={1000} height={700}>
              <Layer>
                {/* Pool water */}
                {outline.length > 2 && (
                  <Line
                    points={outline.flatMap((p: any) => [p.x / 10, p.y / 10])}
                    fill="hsl(var(--primary))"
                    opacity={0.2}
                    closed={true}
                  />
                )}

                {/* Corner pavers (green) */}
                {layout?.cornerPavers?.map((paver: any) => (
                  <Rect
                    key={paver.id}
                    x={paver.position.x / 10}
                    y={paver.position.y / 10}
                    width={paver.size.width / 10}
                    height={paver.size.height / 10}
                    fill="#10B981"
                    stroke="#000"
                    strokeWidth={0.5}
                    rotation={paver.rotation}
                  />
                ))}

                {/* Full pavers (tan) */}
                {layout?.fullPavers?.map((paver: any) => (
                  <Rect
                    key={paver.id}
                    x={paver.position.x / 10}
                    y={paver.position.y / 10}
                    width={paver.size.width / 10}
                    height={paver.size.height / 10}
                    fill="#D4A574"
                    stroke="#000"
                    strokeWidth={0.5}
                    rotation={paver.rotation}
                  />
                ))}

                {/* Stripe pavers (yellow) */}
                {layout?.stripePavers?.map((paver: any) => (
                  <Rect
                    key={paver.id}
                    x={paver.position.x / 10}
                    y={paver.position.y / 10}
                    width={(paver.cutWidth || paver.size.width) / 10}
                    height={paver.size.height / 10}
                    fill="#FCD34D"
                    stroke="#000"
                    strokeWidth={0.5}
                    rotation={paver.rotation}
                  />
                ))}
              </Layer>
            </Stage>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-semibold mb-2">Measurements</h3>
              <ul className="space-y-1 text-muted-foreground">
                <li>Total pavers: {layout?.measurements?.totalPavers || 0}</li>
                <li>Corner pavers: 4</li>
                <li>Full pavers: {layout?.measurements?.fullPavers || 0}</li>
                <li>Stripe pavers: {layout?.measurements?.stripePavers || 0}</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Dimensions</h3>
              <ul className="space-y-1 text-muted-foreground">
                <li>Perimeter: {(layout?.measurements?.copingPerimeter || 0).toFixed(1)}m</li>
                <li>Area: {(layout?.measurements?.totalArea || 0).toFixed(2)} m²</li>
                <li>Paver size: {variant.paver_size}</li>
              </ul>
            </div>
          </div>

          <Button onClick={() => setOpen(false)} className="mt-4">Close</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface PublishButtonProps {
  poolId: string;
  onSuccess: () => void;
}

export function PublishButton({ poolId, onSuccess }: PublishButtonProps) {
  const [publishing, setPublishing] = useState(false);

  const handlePublish = async () => {
    setPublishing(true);
    await supabase
      .from('pool_variants')
      .update({ status: 'published', updated_at: new Date().toISOString() })
      .eq('id', poolId);
    setPublishing(false);
    onSuccess();
  };

  return (
    <Button size="sm" onClick={handlePublish} disabled={publishing}>
      <Upload className="w-4 h-4 mr-1" />
      {publishing ? 'Publishing...' : 'Publish'}
    </Button>
  );
}

interface UnpublishButtonProps {
  poolId: string;
  onSuccess: () => void;
}

export function UnpublishButton({ poolId, onSuccess }: UnpublishButtonProps) {
  const [unpublishing, setUnpublishing] = useState(false);

  const handleUnpublish = async () => {
    setUnpublishing(true);
    await supabase
      .from('pool_variants')
      .update({ status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', poolId);
    setUnpublishing(false);
    onSuccess();
  };

  return (
    <Button size="sm" variant="outline" onClick={handleUnpublish} disabled={unpublishing}>
      <Download className="w-4 h-4 mr-1" />
      {unpublishing ? 'Unpublishing...' : 'Unpublish'}
    </Button>
  );
}

interface DeleteButtonProps {
  poolId: string;
  onSuccess: () => void;
}

export function DeleteButton({ poolId, onSuccess }: DeleteButtonProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Delete this pool/variant? This action cannot be undone.')) return;
    
    setDeleting(true);
    await supabase
      .from('pool_variants')
      .delete()
      .eq('id', poolId);
    setDeleting(false);
    onSuccess();
  };

  return (
    <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
      <Trash2 className="w-4 h-4 mr-1" />
      {deleting ? 'Deleting...' : 'Delete'}
    </Button>
  );
}
