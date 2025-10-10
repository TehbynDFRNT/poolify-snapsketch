import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';

interface UserProfile {
  id: string;
  full_name: string;
  role: 'admin' | 'sales_rep';
  avatar_url?: string;
  created_at: string;
}

export default function UserManagement() {
  const navigate = useNavigate();

  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as UserProfile[];
    },
  });

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'sales_rep') => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      toast.success(`User role updated to ${newRole}`);
      refetch();
    } catch (error: any) {
      toast.error('Failed to update user role');
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-muted-foreground">Manage user roles and permissions</p>
          </div>
        </div>

        {/* Users List */}
        {isLoading ? (
          <div className="text-center py-12">Loading users...</div>
        ) : (
          <div className="space-y-3">
            {users?.map((user) => (
              <Card key={user.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      {user.role === 'admin' ? (
                        <Shield className="w-6 h-6 text-primary" />
                      ) : (
                        <UserIcon className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{user.full_name}</h3>
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                          {user.role === 'admin' ? '🔐 Admin' : '👤 Sales Rep'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Joined {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-sm text-muted-foreground mr-2">Role:</div>
                    <Select
                      value={user.role}
                      onValueChange={(value: 'admin' | 'sales_rep') => handleRoleChange(user.id, value)}
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            Admin
                          </div>
                        </SelectItem>
                        <SelectItem value="sales_rep">
                          <div className="flex items-center gap-2">
                            <UserIcon className="w-4 h-4" />
                            Sales Rep
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Info Card */}
        <Card className="p-6 bg-muted/50">
          <h3 className="font-semibold mb-2">Role Permissions</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 mt-0.5 text-primary" />
              <div>
                <strong className="text-foreground">Admin:</strong> Full access to pool library management, 
                user management, and all project features
              </div>
            </div>
            <div className="flex items-start gap-2">
              <UserIcon className="w-4 h-4 mt-0.5" />
              <div>
                <strong className="text-foreground">Sales Rep:</strong> Can create and manage projects, 
                but cannot access admin features
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
