import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Edit2 } from 'lucide-react';

interface RenameButtonProps {
  pool: any;
  onSuccess: () => void;
}

export function RenameButton({ pool, onSuccess }: RenameButtonProps) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState(pool.pool_name);
  const [saving, setSaving] = useState(false);

  const handleRename = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('pool_variants')
      .update({ pool_name: newName, updated_at: new Date().toISOString() })
      .eq('id', pool.id);

    setSaving(false);
    if (!error) {
      setOpen(false);
      onSuccess();
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Edit2 className="w-4 h-4 mr-1" />
        Rename
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <h2 className="text-xl font-bold mb-4">Rename Pool</h2>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g., Empire 6×3"
            className="mb-4"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={saving || !newName.trim()}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
