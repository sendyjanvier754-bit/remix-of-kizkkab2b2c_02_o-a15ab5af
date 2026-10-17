import { useEffect, type ReactNode } from "react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";

// ported from main.tsx — i18next must initialise before any component renders
import "@/i18n";
import appCss from "../styles.css?url";

import { reportLovableError } from "@/lib/lovable-error-reporting";
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

const SITE_TITLE = "Kizkka | Plataforma Global de Comercio.";
const SITE_DESCRIPTION =
  "Potencia tu negocio con Kizkka. Conectamos vendedores internacionales con el mercado B2B, ofreciendo logística eficiente y los mejores precios.";
const SHARE_TITLE = "Kizkka - Soluciones de ecommerce sin fronteras";
const SHARE_DESCRIPTION =
  "Transforma tu manera de vender. Gestión de pedidos, logística internacional y precios B2B en una sola plataforma.";
const SHARE_IMAGE =
  "https://fonvunyiaxcjkodrnpox.supabase.co/storage/v1/object/public/branding-assets/dialog_share_image_url-1773679883600.png";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      { name: "google-site-verification", content: "QGxafWXmAfwmki-DGqitYqSo2uPeyuDubB-FzesV0BM" },
      { title: SITE_TITLE },
      { name: "description", content: SITE_DESCRIPTION },
      { name: "author", content: "Kizkka" },
      { name: "keywords", content: "B2B, B2C, marketplace, ecommerce, comercio, logística, Kizkka" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Kizkka" },
      { property: "og:title", content: SHARE_TITLE },
      { property: "og:description", content: SHARE_DESCRIPTION },
      { property: "og:image", content: SHARE_IMAGE },
      { property: "og:locale", content: "es_HT" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: SHARE_TITLE },
      { name: "twitter:description", content: SHARE_DESCRIPTION },
      { name: "twitter:image", content: SHARE_IMAGE },
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

function RootShell({ children }: { children: ReactNode }) {
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

function useGlobalErrorLogging() {
  // ported from main.tsx — log uncaught errors (ignores Supabase lock AbortErrors)
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      console.error("Global error caught:", e.error || e.message, e.error?.stack);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (e.reason instanceof Error && e.reason.name === "AbortError") return;
      if (typeof e.reason === "string" && e.reason.includes("aborted")) return;
      console.error("Unhandled rejection:", e.reason);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
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
  useGlobalErrorLogging();

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

function RootErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">This page didn't load</h1>
        <p className="mt-2 text-muted-foreground">Ocurrió un error inesperado. Intenta de nuevo.</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Try again
          </button>
          <Link to="/" className="rounded-md border border-border px-4 py-2 text-sm font-semibold">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
