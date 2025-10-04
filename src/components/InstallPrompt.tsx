import { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show prompt after 30 seconds or on second visit
      const installPromptShown = localStorage.getItem('installPromptShown');
      if (!installPromptShown) {
        setTimeout(() => setShowPrompt(true), 30000);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted install');
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
    localStorage.setItem('installPromptShown', 'true');
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('installPromptShown', 'true');
  };

  if (!showPrompt || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 right-4 max-w-sm bg-card rounded-lg shadow-2xl border border-border p-4 z-50 animate-in slide-in-from-bottom">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
          <Download className="w-6 h-6 text-primary" />
        </div>

        <div className="flex-1">
          <h3 className="font-semibold text-foreground mb-1">
            Install Pool Design Tool
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            Add to your home screen for quick access and offline use.
          </p>

          <div className="flex gap-2">
            <button
              onClick={handleInstall}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded hover:bg-primary/90"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
