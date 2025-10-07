import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/20">
      <div className="max-w-4xl mx-auto px-4 text-center space-y-8">
        <h1 className="text-4xl md:text-6xl font-bold">
          Welcome to Pool Designer
        </h1>
        <p className="text-xl text-muted-foreground">
          Professional pool design and planning made simple
        </p>
        <div className="flex gap-4 justify-center">
          <Button size="lg" onClick={() => navigate('/signup')}>
            Get Started
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate('/login')}>
            Sign In
          </Button>
        </div>
      </div>
    </div>
  );
}
