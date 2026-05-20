import { useEffect, useState } from "react";
import { Download, X, Smartphone } from "lucide-react";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const daysSinceDismissed =
        (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowPrompt(true), 30000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") console.log("PWA installed");
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
    setShowPrompt(false);
  };

  if (!showPrompt || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-[9999] max-w-[320px] animate-slide-up">
      <div className="relative bg-white rounded-2xl shadow-lg border border-ink-200/70 p-4">
        <button
          onClick={handleDismiss}
          className="absolute top-2.5 right-2.5 p-1 rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
            <Smartphone className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0 pr-5">
            <h3 className="text-sm font-semibold text-ink-900 tracking-tight">
              Install Ezary
            </h3>
            <p className="text-xs text-ink-500 mt-0.5">
              Faster access, works offline, lives on your home screen.
            </p>

            <button
              onClick={handleInstall}
              className="mt-3 w-full h-8 inline-flex items-center justify-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-md transition-colors press"
            >
              <Download className="w-3.5 h-3.5" />
              Install app
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
