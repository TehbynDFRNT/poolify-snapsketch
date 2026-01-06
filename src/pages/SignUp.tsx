import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from '@/hooks/use-toast';
import { verifyAccessToken, storeAccessToken, hasValidStoredToken } from '@/utils/accessToken';

export function SignUp() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'sales_rep' | 'designer'>('sales_rep');
  const [loading, setLoading] = useState(false);
  const [accessVerified, setAccessVerified] = useState<boolean | null>(null);
  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check access token on mount
  useEffect(() => {
    const checkAccess = async () => {
      const urlToken = searchParams.get('access');

      if (urlToken) {
        const isValid = await verifyAccessToken(urlToken);
        if (isValid) {
          storeAccessToken(urlToken);
          setAccessVerified(true);
          return;
        }
      }

      // Check stored token
      const hasStored = await hasValidStoredToken();
      setAccessVerified(hasStored);
    };

    checkAccess();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fullName || !email || !password) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Weak password",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    const { error } = await signUp(email, password, fullName, role);
    
    if (error) {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
    } else {
      toast({
        title: "Account created!",
        description: "Welcome to Pool Design Tool",
      });
      navigate('/projects');
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { error } = await signInWithGoogle();
    
    if (error) {
      toast({
        title: "Google sign-in failed",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  // Still checking access
  if (accessVerified === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Access denied - redirect to login
  if (!accessVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-8 text-center">
          <h1 className="text-3xl font-bold">🏊 Pool Design Tool</h1>
          <div className="mt-8 p-6 border rounded-lg bg-destructive/10">
            <h2 className="text-xl font-semibold text-destructive">Access Denied</h2>
            <p className="mt-2 text-muted-foreground">
              Valid access token required.
            </p>
            <Link to="/login" className="mt-4 inline-block text-primary hover:underline">
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">🏊 Pool Design Tool</h1>
          <h2 className="mt-6 text-2xl font-semibold">Create Your Account</h2>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Minimum 8 characters
              </p>
            </div>

            <div>
              <Label>Role</Label>
              <RadioGroup value={role} onValueChange={(value) => setRole(value as 'sales_rep' | 'designer')} className="mt-2 space-y-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sales_rep" id="sales_rep" />
                  <Label htmlFor="sales_rep" className="font-normal cursor-pointer">
                    Sales Representative
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="designer" id="designer" />
                  <Label htmlFor="designer" className="font-normal cursor-pointer">
                    Designer
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Sign Up'}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            🔵 Sign up with Google
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Log In
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
