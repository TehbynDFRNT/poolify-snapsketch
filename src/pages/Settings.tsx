import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { UserProfile, UserButton, OrganizationProfile } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft } from 'lucide-react';
import { PoolConfigContent } from './PoolManagement';

export function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [role, setRole] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadRole = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        setRole(data.role);
      }
      setLoading(false);
    };

    loadRole();
  }, [user]);

  const isAdmin = role === 'admin';
  const canManagePools = ['admin', 'manager'].includes(role);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/projects')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Projects
          </Button>
          <UserButton />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Settings</h1>

        <Tabs defaultValue="account">
          <TabsList>
            <TabsTrigger value="account">Account</TabsTrigger>
            {isAdmin && <TabsTrigger value="team">Team</TabsTrigger>}
            {canManagePools && <TabsTrigger value="pools">Pool Config</TabsTrigger>}
          </TabsList>

          <TabsContent value="account" className="mt-6">
            <div className="[&_.cl-rootBox]:w-full [&_.cl-card]:shadow-none [&_.cl-card]:border">
              <UserProfile />
            </div>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="team" className="mt-6">
              <div className="[&_.cl-rootBox]:w-full [&_.cl-card]:shadow-none [&_.cl-card]:border">
                <OrganizationProfile />
              </div>
            </TabsContent>
          )}

          {canManagePools && (
            <TabsContent value="pools" className="mt-6">
              <PoolConfigContent />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
