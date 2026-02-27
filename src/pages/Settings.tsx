import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { UserProfile, UserButton, OrganizationProfile } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft } from 'lucide-react';
import { PoolConfigContent } from './PoolManagement';

const clerkAppearance = {
  elements: {
    rootBox: 'w-full',
    cardBox: 'w-full shadow-none',
    card: 'w-full shadow-none border-0 rounded-none',
    navbar: 'hidden',
    pageScrollBox: 'p-0',
    page: 'gap-0',
  },
};

export function Settings() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const orgRole = user?.orgRole ?? '';
  const isAdmin = orgRole === 'org:admin';
  const canManagePools = ['org:admin', 'org:manager'].includes(orgRole);

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
            <UserProfile appearance={clerkAppearance} />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="team" className="mt-6">
              <OrganizationProfile appearance={clerkAppearance} />
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
