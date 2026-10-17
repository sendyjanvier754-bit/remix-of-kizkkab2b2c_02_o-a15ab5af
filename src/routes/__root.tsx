// ported from main.tsx: i18next must initialise before any component renders
import "@/i18n";

import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { showRuntimeOverlay } from "@/lib/runtime-overlay";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import AffiliateRefCapture from "@/components/affiliates/AffiliateRefCapture";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastContainer } from "@/components/ToastContainer";
import { useToast } from "@/hooks/useToastNotification";
import { ViewModeProvider } from "@/contexts/ViewModeContext";
import { useCartMigration } from "@/hooks/useCartMigration";
import { ShippingTiersRealtimeProvider } from "@/hooks/useShippingTiersRealtimeSync";
import VariantDrawer from "@/components/products/VariantDrawer";
import WhatsAppShareDialog from "@/components/products/WhatsAppShareDialog";
import { PageLoader } from "@/components/ui/PageLoader";
import { NavigationLoader } from "@/components/ui/NavigationLoader";
import { CartAddedConfirmation } from "@/components/cart/CartAddedConfirmation";
import { PendingProofReminder } from "@/components/payments/PendingProofReminder";
import MobileBottomNav from "@/components/categories/MobileBottomNav";
import { PopupRenderer } from "@/components/marketing/PopupRenderer";
import GlobalMobileHeader from "@/components/layout/GlobalMobileHeader";
import { BrandingApplier } from "@/components/BrandingApplier";
import { SellerUpgradeProvider } from "@/components/seller/SellerUpgradeProvider";
import { GrossisteUpgradeProvider } from "@/components/grossiste/GrossisteUpgradeProvider";
import ScrollToTop from "@/components/ScrollToTop";
import LoginPromptModal from "@/components/auth/LoginPromptModal";
import { WhatsAppFloatingButton } from "@/components/support/WhatsAppFloatingButton";
import { CompleteProfilePrompt } from "@/components/profile/CompleteProfilePrompt";
import NotFound from "@/pages/NotFound";


export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      { name: "google-site-verification", content: "QGxafWXmAfwmki-DGqitYqSo2uPeyuDubB-FzesV0BM" },
      { title: "Kizkka | Plataforma Global de Comercio." },
      {
        name: "description",
        content:
          "Potencia tu negocio con Kizkka. Conectamos vendedores internacionales con el mercado B2B, ofreciendo logística eficiente y los mejores precios.",
      },
      { name: "author", content: "Kizkka" },
      { name: "keywords", content: "B2B, B2C, marketplace, ecommerce, comercio, logística, Kizkka" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Kizkka" },
      { property: "og:title", content: "Kizkka - Soluciones de ecommerce sin fronteras" },
      {
        property: "og:description",
        content:
          "Transforma tu manera de vender. Gestión de pedidos, logística internacional y precios B2B en una sola plataforma.",
      },
      { property: "og:locale", content: "es_HT" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Kizkka - Soluciones de ecommerce sin fronteras" },
      {
        name: "twitter:description",
        content:
          "Transforma tu manera de vender. Gestión de pedidos, logística internacional y precios B2B en una sola plataforma.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Kizkka",
          url: "https://kizkka.com",
          description: "Plataforma Global de Comercio B2B2C",
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: RootErrorComponent,
});


function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AppContent() {
  const { toasts, removeToast } = useToast();
  const { isLoading } = useAuth();
  useCartMigration();

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <>
      <NavigationLoader />
      <AffiliateRefCapture />
      <CartAddedConfirmation />
      <PendingProofReminder />
      <GlobalMobileHeader />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <Toaster />
      <Sonner />
      <VariantDrawer />
      <WhatsAppShareDialog />
      <LoginPromptModal />
      <WhatsAppFloatingButton />
      <CompleteProfilePrompt />
      <Outlet />
      <MobileBottomNav />
      <PopupRenderer />
    </>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // ported from main.tsx: global runtime error overlay
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      console.error("Global error caught:", e.error || e.message, e.error?.stack);
      showRuntimeOverlay(e.error || e.message || String(e));
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      // Supabase navigatorLock AbortError on component unmount — safe to ignore
      if (e.reason instanceof Error && e.reason.name === "AbortError") return;
      if (typeof e.reason === "string" && e.reason.includes("aborted")) return;
      console.error("Unhandled rejection:", e.reason);
      showRuntimeOverlay(e.reason || "Unhandled promise rejection");
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <TooltipProvider>
          <ScrollToTop />
          <AuthProvider>
            <ViewModeProvider>
              <SellerUpgradeProvider>
                <GrossisteUpgradeProvider>
                  <BrandingApplier />
                  <ShippingTiersRealtimeProvider />
                  <AppContent />
                </GrossisteUpgradeProvider>
              </SellerUpgradeProvider>
            </ViewModeProvider>
          </AuthProvider>
        </TooltipProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

function RootErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo salió mal. Intenta de nuevo o vuelve al inicio.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
          <Link to="/" className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
