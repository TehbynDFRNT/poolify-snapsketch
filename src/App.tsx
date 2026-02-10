import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { CloudHomePage } from "./components/CloudHomePage";
import { DesignCanvas } from "./components/DesignCanvas";
import { InstallPrompt } from "./components/InstallPrompt";
import { IOSInstallPrompt } from "./components/IOSInstallPrompt";
import { PublicProjectView } from "./components/PublicProjectView";
import { CpqTestPage } from "./components/CpqTestPage";
import { SignInPage } from "./pages/SignInPage";
import { SignUpPage } from "./pages/SignUpPage";
import { ProfileSettings } from "./pages/ProfileSettings";
import { TeamManagement } from "./pages/TeamManagement";
import { PoolManagement } from "./pages/PoolManagement";
import { SSO } from "./pages/SSO";
import { SupabaseAuthSync } from "./integrations/supabase/SupabaseAuthSync";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <SupabaseAuthSync />
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Navigate to="/sign-in" replace />} />
          <Route path="/sign-in/*" element={<SignInPage />} />
          <Route path="/sign-up/*" element={<SignUpPage />} />
          <Route path="/sso" element={<SSO />} />
          <Route path="/share/:token" element={<PublicProjectView />} />

          {/* Protected routes */}
          <Route path="/projects" element={
            <ProtectedRoute>
              <CloudHomePage />
            </ProtectedRoute>
          } />
          <Route path="/project/:id" element={
            <ProtectedRoute>
              <DesignCanvas />
            </ProtectedRoute>
          } />
          <Route path="/settings/profile" element={
            <ProtectedRoute>
              <ProfileSettings />
            </ProtectedRoute>
          } />
          <Route path="/settings/team" element={
            <ProtectedRoute>
              <TeamManagement />
            </ProtectedRoute>
          } />
          <Route path="/settings/pools" element={
            <ProtectedRoute>
              <PoolManagement />
            </ProtectedRoute>
          } />

          {/* Dev/Testing Routes */}
          <Route path="/cpq-test" element={<CpqTestPage />} />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      <InstallPrompt />
      <IOSInstallPrompt />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
