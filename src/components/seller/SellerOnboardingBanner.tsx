import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSellerOnboarding, getStepLabel } from "@/hooks/useSellerOnboarding";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, Store } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types/auth";

const MINIMIZED_KEY = 'seller_onboarding_banner_minimized';

export function SellerOnboardingBanner() {
  const { user } = useAuth();
  const { progress, isLoading, progressPercent, currentStep, isOnboardingComplete } = useSellerOnboarding();
  const navigate = useNavigate();
  const [minimized, setMinimized] = useState(() => localStorage.getItem(MINIMIZED_KEY) === 'true');

  const isSeller = user?.role === UserRole.SELLER || user?.role === UserRole.ADMIN;

  useEffect(() => {
    localStorage.setItem(MINIMIZED_KEY, String(minimized));
  }, [minimized]);

  if (!isSeller || isLoading || !progress || isOnboardingComplete) return null;

  if (minimized) {
    return (
      <div className="fixed top-2 right-4 z-50">
        <Button
          size="sm"
          variant="default"
          className="shadow-lg gap-2 text-xs"
          onClick={() => setMinimized(false)}
        >
          <Store className="w-3.5 h-3.5" />
          Configurar tienda ({progressPercent}%)
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-primary/5 border-b border-primary/20 px-4 py-3">
      <div className="max-w-5xl mx-auto flex items-center gap-4">
        <Store className="w-5 h-5 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-foreground">
              Configuración de tienda — {getStepLabel(currentStep)}
            </span>
            <span className="text-xs text-muted-foreground">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
        <Button
          size="sm"
          variant="default"
          className="gap-1 text-xs flex-shrink-0"
          onClick={() => navigate('/seller/cuenta')}
        >
          Continuar <ChevronRight className="w-3.5 h-3.5" />
        </Button>
        <button onClick={() => setMinimized(true)} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
