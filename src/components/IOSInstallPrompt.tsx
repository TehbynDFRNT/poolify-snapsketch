import { useState, useEffect } from 'react';
import { Share, X } from 'lucide-react';

export const IOSInstallPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Detect iOS Safari
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone;
    
    if (isIOS && !isInStandaloneMode) {
      const promptShown = localStorage.getItem('iosInstallPromptShown');
      if (!promptShown) {
        setTimeout(() => setShowPrompt(true), 20000); // Show after 20 seconds
      }
    }
  }, []);

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('iosInstallPromptShown', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm bg-card rounded-lg shadow-2xl border border-border p-4 z-50 animate-in slide-in-from-bottom">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="pr-6">
        <h3 className="font-semibold text-foreground mb-2">
          Install Pool Design Tool
        </h3>
        <p className="text-sm text-muted-foreground mb-3">
          Install this app on your device for quick access and offline use.
        </p>

        <ol className="text-sm text-foreground space-y-2 mb-4">
          <li className="flex items-start gap-2">
            <span className="font-semibold">1.</span>
            <span>
              Tap the <Share className="inline w-4 h-4 mx-1" /> share button below
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">2.</span>
            <span>Scroll and tap "Add to Home Screen"</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">3.</span>
            <span>Tap "Add" in the top right</span>
          </li>
        </ol>

        <button
          onClick={handleDismiss}
          className="text-sm text-primary hover:text-primary/80 font-medium"
        >
          Got it
        </button>
      </div>
    </div>
  );
};
