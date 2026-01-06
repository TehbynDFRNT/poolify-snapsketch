import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { CloudHomePage } from "./components/CloudHomePage";
import { DesignCanvas } from "./components/DesignCanvas";
import { InstallPrompt } from "./components/InstallPrompt";
import { IOSInstallPrompt } from "./components/IOSInstallPrompt";
import { PublicProjectView } from "./components/PublicProjectView";
import { CpqTestPage } from "./components/CpqTestPage";
import { SignUp } from "./pages/SignUp";
import { Login } from "./pages/Login";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { ProfileSettings } from "./pages/ProfileSettings";
import { TeamManagement } from "./pages/TeamManagement";
import { PoolManagement } from "./pages/PoolManagement";
import { SSO } from "./pages/SSO";
// LandingPage removed - root redirects to login
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
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
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
