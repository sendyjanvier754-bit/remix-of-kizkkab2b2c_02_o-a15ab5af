import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ReactNode, Suspense } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/types/auth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastContainer } from "@/components/ToastContainer";
import { useToast } from "@/hooks/useToastNotification";
import { ViewModeProvider } from "@/contexts/ViewModeContext";
import { useCartMigration } from "@/hooks/useCartMigration";
import { ShippingTiersRealtimeProvider } from "@/hooks/useShippingTiersRealtimeSync";
import VariantDrawer from "@/components/products/VariantDrawer";
import { PageLoader } from "./components/ui/PageLoader";
import { NavigationLoader } from "./components/ui/NavigationLoader";
import MobileBottomNav from "./components/categories/MobileBottomNav";
import { PopupRenderer } from "./components/marketing/PopupRenderer";
import GlobalMobileHeader from "./components/layout/GlobalMobileHeader";
import { BrandingApplier } from "@/components/BrandingApplier";
import { SellerUpgradeProvider } from "./components/seller/SellerUpgradeProvider";
import { GrossisteUpgradeProvider } from "./components/grossiste/GrossisteUpgradeProvider";
import ScrollToTop from "./components/ScrollToTop";
import LoginPromptModal from "@/components/auth/LoginPromptModal";

// Suspense Wrapper for lazy components
const LazyRoute = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<PageLoader />}>
    {children}
  </Suspense>
);

// Eagerly loaded (critical path)
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/LoginPage";
import AdminLogin from "./pages/admin/AdminLogin";
import SellerOnboardingPage from "./pages/seller/SellerOnboardingPage";
import SellerRegistrationPage from "./pages/SellerRegistrationPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

// Lazy loaded - Public Pages
const StorePage = lazyWithRetry(() => import("./pages/StorePage"));
const ProductPage = lazyWithRetry(() => import("./pages/ProductPage"));
const CategoriesPage = lazyWithRetry(() => import("./pages/CategoriesPage"));
const CategoryProductsPage = lazyWithRetry(() => import("./pages/CategoryProductsPage"));
const StoreProfilePage = lazyWithRetry(() => import("./pages/StoreProfilePage"));
const CartPage = lazyWithRetry(() => import("./pages/CartPage"));
const SharedCartPage = lazyWithRetry(() => import("./pages/SharedCartPage"));
const FavoritesPage = lazyWithRetry(() => import("./pages/FavoritesPage"));
const SearchResultsPage = lazyWithRetry(() => import("./pages/SearchResultsPage"));
const TrendsPage = lazyWithRetry(() => import("./pages/TrendsPage"));
const MarketplacePage = lazyWithRetry(() => import("./pages/MarketplacePage"));
const MyPurchasesPage = lazyWithRetry(() => import("./pages/MyPurchasesPage"));
const CheckoutPage = lazyWithRetry(() => import("./pages/CheckoutPage"));
const UserProfilePage = lazyWithRetry(() => import("./pages/UserProfilePage"));
const EditProfilePage = lazyWithRetry(() => import("./pages/EditProfilePage"));
const UserSupportPage = lazyWithRetry(() => import("./pages/UserSupportPage"));
const UserNotificationsPage = lazyWithRetry(() => import("./pages/UserNotificationsPage"));

// Lazy loaded - Legal & Info Pages
const TermsPage = lazyWithRetry(() => import("./pages/legal/TermsPage"));
const PrivacyPage = lazyWithRetry(() => import("./pages/legal/PrivacyPage"));
const CookiesPage = lazyWithRetry(() => import("./pages/legal/CookiesPage"));
const ReturnsPage = lazyWithRetry(() => import("./pages/legal/ReturnsPage"));
const RefundsPage = lazyWithRetry(() => import("./pages/legal/RefundsPage"));
const ExchangesPage = lazyWithRetry(() => import("./pages/legal/ExchangesPage"));
const ContactPage = lazyWithRetry(() => import("./pages/legal/ContactPage"));
const AboutPage = lazyWithRetry(() => import("./pages/legal/AboutPage"));
// Lazy loaded - Siver Match Pages (B2B2C Ecosystem)
const SiverMatchHub = lazyWithRetry(() => import("./pages/siver-match/SiverMatchHub"));
const InvestorDashboard = lazyWithRetry(() => import("./pages/siver-match/InvestorDashboard"));
const GestorDashboard = lazyWithRetry(() => import("./pages/siver-match/GestorDashboard"));

// Lazy loaded - Admin Pages
const AdminDashboard = lazyWithRetry(() => import("./pages/admin/AdminDashboard"));
const AdminConciliacion = lazyWithRetry(() => import("./pages/admin/AdminConciliacion"));
const AdminCatalogo = lazyWithRetry(() => import("./pages/admin/AdminCatalogo"));
const Import1688ReviewPage = lazyWithRetry(() => import("./pages/admin/Import1688ReviewPage"));
const AdminCategorias = lazyWithRetry(() => import("./pages/admin/AdminCategorias"));
const AdminVendedores = lazyWithRetry(() => import("./pages/admin/AdminVendedores"));
const AdminB2BSyncPage = lazyWithRetry(() => import("./pages/admin/AdminB2BSyncPage"));
const AdminBanners = lazyWithRetry(() => import("./pages/admin/AdminBanners"));
const AdminProveedores = lazyWithRetry(() => import("./pages/admin/AdminProveedores"));
const AdminPedidos = lazyWithRetry(() => import("./pages/admin/AdminPedidos"));
const AdminPreciosConfig = lazyWithRetry(() => import("./pages/admin/AdminPreciosConfig"));
const AdminApprovals = lazyWithRetry(() => import("./pages/admin/AdminApprovals"));
const AdminCotizaciones = lazyWithRetry(() => import("./pages/admin/AdminCotizaciones"));
const AdminReembolsos = lazyWithRetry(() => import("./pages/admin/AdminReembolsos"));
const AdminCommissionPage = lazyWithRetry(() => import("./pages/admin/AdminCommissionPage"));
const AdminPickupPointsPage = lazyWithRetry(() => import("./pages/admin/AdminPickupPointsPage"));
const AdminPartnerApplicationsPage = lazyWithRetry(() => import("./pages/admin/AdminPartnerApplicationsPage"));
const BecomePartnerPage = lazyWithRetry(() => import("./pages/partners/BecomePartnerPage"));
const PickupPointRegistrationPage = lazyWithRetry(() => import("./pages/partners/PickupPointRegistrationPage"));
const DriverRegistrationPage = lazyWithRetry(() => import("./pages/partners/DriverRegistrationPage"));
const DriverAvailableRoutesPage = lazyWithRetry(() => import("./pages/partners/driver/DriverAvailableRoutesPage"));
const DriverMyRoutesPage = lazyWithRetry(() => import("./pages/partners/driver/DriverMyRoutesPage"));
const DriverRouteDetailPage = lazyWithRetry(() => import("./pages/partners/driver/DriverRouteDetailPage"));
const PickupOrdersPage = lazyWithRetry(() => import("./pages/partners/pickup/PickupOrdersPage"));
const PartnerEarningsPage = lazyWithRetry(() => import("./pages/partners/PartnerEarningsPage"));
const AdminTransitHubsPage = lazyWithRetry(() => import("./pages/admin/AdminTransitHubsPage"));
const AdminDiscountCodes = lazyWithRetry(() => import("./pages/admin/AdminDiscountCodes"));
const AdminPopupsPage = lazyWithRetry(() => import("./pages/admin/AdminPopupsPage"));
const AdminUserDiscounts = lazyWithRetry(() => import("./pages/admin/AdminUserDiscounts"));
const AdminCartAnalytics = lazyWithRetry(() => import("./pages/admin/AdminCartAnalytics"));
const AdminLogisticsPage = lazyWithRetry(() => import("./pages/admin/AdminLogisticsPage"));
const AdminInventoryPage = lazyWithRetry(() => import("./pages/admin/AdminInventoryPage"));
const AdminPOMasterPage = lazyWithRetry(() => import("./pages/admin/AdminPOMasterPage"));
const AdminPaymentMethodsPage = lazyWithRetry(() => import("./pages/admin/AdminPaymentMethodsPage"));
const AdminPaymentKeys = lazyWithRetry(() => import("./pages/admin/AdminPaymentKeys"));
const AdminMarketplaceSections = lazyWithRetry(() => import("./pages/admin/AdminMarketplaceSections"));
const AdminCountriesRoutesPage = lazyWithRetry(() => import("./pages/admin/AdminCountriesRoutesPage"));
const AdminMarketsPage = lazyWithRetry(() => import("./pages/admin/AdminMarketsPage"));
const AdminWishlistPage = lazyWithRetry(() => import("./pages/admin/AdminWishlistPage"));
const AdminGlobalLogisticsPage = lazyWithRetry(() => import("./pages/admin/AdminGlobalLogisticsPage"));
const AdminAgentOrders = lazyWithRetry(() => import("./pages/admin/AdminAgentOrders"));
const AdminSupportChats = lazyWithRetry(() => import("./pages/admin/AdminSupportChats"));
const NotificationsPage = lazyWithRetry(() => import("./pages/admin/NotificationsPage"));
const AdminPurchasingAgentsPage = lazyWithRetry(() => import("./pages/admin/AdminPurchasingAgentsPage"));
const AdminBrandingPage = lazyWithRetry(() => import("./pages/admin/AdminBrandingPage"));
const AdminEmailConfigPage = lazyWithRetry(() => import("./pages/admin/AdminEmailConfigPage"));
const AdminEmailTemplatesPage = lazyWithRetry(() => import("./pages/admin/AdminEmailTemplatesPage"));
const AdminAffiliatesPage = lazyWithRetry(() => import("./pages/admin/AdminAffiliatesPage"));
const AdminAccountsPage = lazyWithRetry(() => import("./pages/admin/AdminAccountsPage"));
const AdminGrossistesPage = lazyWithRetry(() => import("./pages/admin/AdminGrossistesPage"));
const AffiliatesDashboardPage = lazyWithRetry(() => import("./pages/AffiliatesDashboardPage"));
const PurchasingAgentDashboard = lazyWithRetry(() => import("./pages/purchasing-agent/PurchasingAgentDashboard"));
const PurchasingAgentLogin = lazyWithRetry(() => import("./pages/purchasing-agent/PurchasingAgentLogin"));

// Lazy loaded - Grossiste Pages
const GrossisteDashboard = lazyWithRetry(() => import("./pages/grossiste/GrossisteDashboard"));
const GrossisteProductsPage = lazyWithRetry(() => import("./pages/grossiste/GrossisteProductsPage"));
const GrossisteImportPage = lazyWithRetry(() => import("./pages/grossiste/GrossisteImportPage"));
const GrossisteOrdersPage = lazyWithRetry(() => import("./pages/grossiste/GrossisteOrdersPage"));
const GrossisteSettlementsPage = lazyWithRetry(() => import("./pages/grossiste/GrossisteSettlementsPage"));
const GrossisteB2CStorefrontPage = lazyWithRetry(() => import("./pages/grossiste/GrossisteB2CStorefrontPage"));
const GrossisteProfilePage = lazyWithRetry(() => import("./pages/grossiste/GrossisteProfilePage"));

// Lazy loaded - Seller Pages
const SellerAcquisicionLotes = lazyWithRetry(() => import("./pages/seller/SellerAcquisicionLotes"));
const SellerCheckout = lazyWithRetry(() => import("./pages/seller/SellerCheckout"));
const SellerAccountPage = lazyWithRetry(() => import("./pages/seller/SellerAccountPage"));
const SellerWalletPage = lazyWithRetry(() => import("./pages/seller/SellerWalletPage"));
const SellerDashboard = lazyWithRetry(() => import("./pages/seller/SellerDashboard"));
const SellerProfilePage = lazyWithRetry(() => import("./pages/seller/SellerProfilePage"));
const SellerCartPage = lazyWithRetry(() => import("./pages/seller/SellerCartPage"));
const SellerFavoritesPage = lazyWithRetry(() => import("./pages/seller/SellerFavoritesPage"));
const SellerInventarioB2C = lazyWithRetry(() => import("./pages/seller/SellerInventarioB2C"));
const SellerPedidosPage = lazyWithRetry(() => import("./pages/seller/SellerPedidosPage"));
const SellerMisComprasPage = lazyWithRetry(() => import("./pages/seller/SellerMisComprasPage"));
const SellerCreditPage = lazyWithRetry(() => import("./pages/seller/SellerCreditPage"));
const SellerDiscountCodes = lazyWithRetry(() => import("./pages/seller/SellerDiscountCodes"));
const SellerCustomerDiscounts = lazyWithRetry(() => import("./pages/seller/SellerCustomerDiscounts"));
const SellerMarketingPage = lazyWithRetry(() => import("./pages/seller/SellerMarketingPage"));
const SellerAnalyticsPage = lazyWithRetry(() => import("./pages/seller/SellerAnalyticsPage"));
const SellerMiCatalogoPage = lazyWithRetry(() => import("./pages/seller/SellerMiCatalogoPage"));

const AppContent = () => {
  const { toasts, removeToast } = useToast();
  const { isLoading } = useAuth();
  useCartMigration(); // Hook de migración de carrito

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <>
      <NavigationLoader />
      <GlobalMobileHeader />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <Toaster />
      <Sonner />
      <VariantDrawer />
      <LoginPromptModal />
      <Routes>
            {/* ========== PUBLIC ROUTES (B2C) ========== */}
            <Route path="/" element={<Index />} />
            <Route path="/marketplace" element={<LazyRoute><MarketplacePage /></LazyRoute>} />
            <Route path="/categorias" element={<LazyRoute><CategoriesPage /></LazyRoute>} />
            <Route path="/categoria/:slug" element={<LazyRoute><CategoryProductsPage /></LazyRoute>} />
            <Route path="/tienda/:storeId" element={<LazyRoute><StoreProfilePage /></LazyRoute>} />
            <Route path="/producto/:sku" element={<LazyRoute><ProductPage /></LazyRoute>} />
            <Route path="/producto/catalogo/:catalogId" element={<LazyRoute><ProductPage /></LazyRoute>} />
            <Route path="/cuenta" element={<LoginPage />} />
            <Route path="/perfil" element={<ProtectedRoute><LazyRoute><UserProfilePage /></LazyRoute></ProtectedRoute>} />
            <Route path="/editar-perfil" element={<ProtectedRoute><LazyRoute><EditProfilePage /></LazyRoute></ProtectedRoute>} />
            <Route path="/mis-compras" element={<LazyRoute><MyPurchasesPage /></LazyRoute>} />
            <Route path="/carrito" element={<LazyRoute><CartPage /></LazyRoute>} />
            <Route path="/carrito/compartido/:shareCode" element={<LazyRoute><SharedCartPage /></LazyRoute>} />
            <Route path="/checkout" element={<LazyRoute><CheckoutPage /></LazyRoute>} />
            <Route path="/favoritos" element={<LazyRoute><FavoritesPage /></LazyRoute>} />
            <Route path="/tendencias" element={<LazyRoute><TrendsPage /></LazyRoute>} />
            <Route path="/busqueda" element={<LazyRoute><SearchResultsPage /></LazyRoute>} />
            <Route path="/soporte" element={<ProtectedRoute><LazyRoute><UserSupportPage /></LazyRoute></ProtectedRoute>} />
            <Route path="/notificaciones" element={<ProtectedRoute><LazyRoute><UserNotificationsPage /></LazyRoute></ProtectedRoute>} />
            <Route path="/dashboard/affiliates" element={<ProtectedRoute><LazyRoute><AffiliatesDashboardPage /></LazyRoute></ProtectedRoute>} />
            
            {/* ========== LEGAL & INFO PAGES ========== */}
            <Route path="/terminos" element={<LazyRoute><TermsPage /></LazyRoute>} />
            <Route path="/privacidad" element={<LazyRoute><PrivacyPage /></LazyRoute>} />
            <Route path="/cookies" element={<LazyRoute><CookiesPage /></LazyRoute>} />
            <Route path="/devoluciones" element={<LazyRoute><ReturnsPage /></LazyRoute>} />
            <Route path="/reembolsos" element={<LazyRoute><RefundsPage /></LazyRoute>} />
            <Route path="/cambios" element={<LazyRoute><ExchangesPage /></LazyRoute>} />
            <Route path="/contacto" element={<LazyRoute><ContactPage /></LazyRoute>} />
            <Route path="/sobre-nosotros" element={<LazyRoute><AboutPage /></LazyRoute>} />
            
            {/* ========== SIVER MATCH (B2B2C Ecosystem) ========== */}
            <Route path="/siver-match" element={<LazyRoute><SiverMatchHub /></LazyRoute>} />
            <Route path="/siver-match/investor" element={<LazyRoute><InvestorDashboard /></LazyRoute>} />
            <Route path="/siver-match/gestor" element={<LazyRoute><GestorDashboard /></LazyRoute>} />
            
            {/* Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/seller/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/agente-compra/login" element={<LazyRoute><PurchasingAgentLogin /></LazyRoute>} />
            
            {/* Seller Registration Landing Page */}
            <Route path="/registro-vendedor" element={<SellerRegistrationPage />} />
            
            {/* Seller Onboarding (no auth required, just registered) */}
            <Route path="/seller/onboarding" element={<SellerOnboardingPage />} />

            {/* Partner registration (public) */}
            <Route path="/socios" element={<LazyRoute><BecomePartnerPage /></LazyRoute>} />
            <Route path="/socios/punto-retiro/registro" element={<LazyRoute><PickupPointRegistrationPage /></LazyRoute>} />
            <Route path="/socios/conductor/registro" element={<LazyRoute><DriverRegistrationPage /></LazyRoute>} />

            {/* Driver portal */}
            <Route path="/socio/conductor" element={
              <ProtectedRoute requiredRoles={[UserRole.DRIVER_PARTNER, UserRole.ADMIN]}>
                <LazyRoute><DriverAvailableRoutesPage /></LazyRoute>
              </ProtectedRoute>
            } />
            <Route path="/socio/conductor/mis-rutas" element={
              <ProtectedRoute requiredRoles={[UserRole.DRIVER_PARTNER, UserRole.ADMIN]}>
                <LazyRoute><DriverMyRoutesPage /></LazyRoute>
              </ProtectedRoute>
            } />
            <Route path="/socio/conductor/ruta/:routeId" element={
              <ProtectedRoute requiredRoles={[UserRole.DRIVER_PARTNER, UserRole.ADMIN]}>
                <LazyRoute><DriverRouteDetailPage /></LazyRoute>
              </ProtectedRoute>
            } />
            <Route path="/socio/conductor/ganancias" element={
              <ProtectedRoute requiredRoles={[UserRole.DRIVER_PARTNER, UserRole.ADMIN]}>
                <LazyRoute><PartnerEarningsPage variant="driver" /></LazyRoute>
              </ProtectedRoute>
            } />

            {/* Pickup partner portal */}
            <Route path="/socio/punto" element={
              <ProtectedRoute requiredRoles={[UserRole.PICKUP_PARTNER, UserRole.STAFF_PICKUP, UserRole.ADMIN]}>
                <LazyRoute><PickupOrdersPage /></LazyRoute>
              </ProtectedRoute>
            } />
            <Route path="/socio/punto/historial" element={
              <ProtectedRoute requiredRoles={[UserRole.PICKUP_PARTNER, UserRole.STAFF_PICKUP, UserRole.ADMIN]}>
                <LazyRoute><PickupOrdersPage historyMode /></LazyRoute>
              </ProtectedRoute>
            } />
            <Route path="/socio/punto/ganancias" element={
              <ProtectedRoute requiredRoles={[UserRole.PICKUP_PARTNER, UserRole.STAFF_PICKUP, UserRole.ADMIN]}>
                <LazyRoute><PartnerEarningsPage variant="pickup" /></LazyRoute>
              </ProtectedRoute>
            } />

            {/* ========== ADMIN ROUTES ========== */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route 
              path="/admin/dashboard" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminDashboard /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/conciliacion" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminConciliacion /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/catalogo" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminCatalogo /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/catalogo/1688/revision/:batchId" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><Import1688ReviewPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/categorias" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminCategorias /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/vendedores" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminVendedores /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/b2b-sync" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminB2BSyncPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/banners" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminBanners /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/proveedores" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminProveedores /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/pedidos" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminPedidos /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/precios" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminPreciosConfig /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/aprobaciones" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminApprovals /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/cotizaciones" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminCotizaciones /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/reembolsos" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminReembolsos /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/commissions" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminCommissionPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/pickup-points" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminPickupPointsPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/partner-applications" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminPartnerApplicationsPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/transit-hubs" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminTransitHubsPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/codigos-descuento" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminDiscountCodes /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/popups" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminPopupsPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/descuentos-usuarios" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminUserDiscounts /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/cart-analytics" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminCartAnalytics /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/logistics" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminLogisticsPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/inventory" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminInventoryPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/po-master" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminPOMasterPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/payment-methods" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminPaymentMethodsPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/payment-keys" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminPaymentKeys /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/marketplace-sections" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminMarketplaceSections /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/countries-routes" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminCountriesRoutesPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/wishlist" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminWishlistPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/markets" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminMarketsPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/global-logistics" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminGlobalLogisticsPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/branding" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminBrandingPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/agente-pedidos" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SELLER, UserRole.SALES_AGENT]}>
                  <LazyRoute><AdminAgentOrders /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/soporte-chat" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SELLER, UserRole.SALES_AGENT]}>
                  <LazyRoute><AdminSupportChats /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/purchasing-agents" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminPurchasingAgentsPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/agente-compra" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.PURCHASING_AGENT, UserRole.ADMIN]}>
                  <LazyRoute><PurchasingAgentDashboard /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route
              path="/admin/notificaciones" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SELLER, UserRole.SALES_AGENT]}>
                  <LazyRoute><NotificationsPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/email-config" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminEmailConfigPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/email-templates" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminEmailTemplatesPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/affiliates" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminAffiliatesPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/cuentas" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>
                  <LazyRoute><AdminAccountsPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route path="/admin" element={<AdminLogin />} />
            
            {/* ========== SELLER ROUTES (B2B) ========== */}
            <Route 
              path="/seller/adquisicion-lotes" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}>
                  <LazyRoute><SellerAcquisicionLotes /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/seller/checkout" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}>
                  <LazyRoute><SellerCheckout /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/seller/inventario" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}>
                  <LazyRoute><SellerInventarioB2C /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/seller/credit" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}>
                  <LazyRoute><SellerCreditPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route
              path="/seller/pedidos" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}>
                  <LazyRoute><SellerPedidosPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route
              path="/seller/mis-compras" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}>
                  <LazyRoute><SellerMisComprasPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route
              path="/seller/cuenta"
              element={
                <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}>
                  <LazyRoute><SellerAccountPage /></LazyRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/seller/wallet"
              element={
                <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}>
                  <LazyRoute><SellerWalletPage /></LazyRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/seller/dashboard"
              element={
                <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}>
                  <LazyRoute><SellerDashboard /></LazyRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/seller/profile"
              element={
                <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}>
                  <LazyRoute><SellerProfilePage /></LazyRoute>
                </ProtectedRoute>
              }
            />
            <Route 
              path="/seller/carrito" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}>
                  <LazyRoute><SellerCartPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/seller/favoritos" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}>
                  <LazyRoute><SellerFavoritesPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/seller/codigos-descuento" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}>
                  <LazyRoute><SellerDiscountCodes /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/seller/descuentos-clientes" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}>
                  <LazyRoute><SellerCustomerDiscounts /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/seller/marketing" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}>
                  <LazyRoute><SellerMarketingPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/seller/analytics" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}>
                  <LazyRoute><SellerAnalyticsPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/seller/catalogo" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.SELLER, UserRole.ADMIN]}>
                  <LazyRoute><SellerMiCatalogoPage /></LazyRoute>
                </ProtectedRoute>
              } 
            />
            
            {/* ========== GROSSISTE (MAYORISTA) ROUTES ========== */}
            <Route path="/grossiste/dashboard" element={<ProtectedRoute requiredRoles={[UserRole.GROSSISTE]}><LazyRoute><GrossisteDashboard /></LazyRoute></ProtectedRoute>} />
            <Route path="/grossiste/productos" element={<ProtectedRoute requiredRoles={[UserRole.GROSSISTE]}><LazyRoute><GrossisteProductsPage /></LazyRoute></ProtectedRoute>} />
            <Route path="/grossiste/importar" element={<ProtectedRoute requiredRoles={[UserRole.GROSSISTE]}><LazyRoute><GrossisteImportPage /></LazyRoute></ProtectedRoute>} />
            <Route path="/grossiste/pedidos" element={<ProtectedRoute requiredRoles={[UserRole.GROSSISTE]}><LazyRoute><GrossisteOrdersPage /></LazyRoute></ProtectedRoute>} />
            <Route path="/grossiste/liquidaciones" element={<ProtectedRoute requiredRoles={[UserRole.GROSSISTE]}><LazyRoute><GrossisteSettlementsPage /></LazyRoute></ProtectedRoute>} />
            <Route path="/grossiste/tienda-b2c" element={<ProtectedRoute requiredRoles={[UserRole.GROSSISTE]}><LazyRoute><GrossisteB2CStorefrontPage /></LazyRoute></ProtectedRoute>} />
            <Route path="/grossiste/perfil" element={<ProtectedRoute requiredRoles={[UserRole.GROSSISTE]}><LazyRoute><GrossisteProfilePage /></LazyRoute></ProtectedRoute>} />

            {/* Admin: gestión de mayoristas */}
            <Route path="/admin/grossistes" element={<ProtectedRoute requiredRoles={[UserRole.ADMIN]}><LazyRoute><AdminGrossistesPage /></LazyRoute></ProtectedRoute>} />

            {/* ========== 404 CATCH-ALL ========== */}
            <Route path="*" element={<NotFound />} />
          </Routes>
      <MobileBottomNav />
      <PopupRenderer />
    </>
  );
};

const App = () => (
  <ErrorBoundary>
    <TooltipProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
      </BrowserRouter>
    </TooltipProvider>
  </ErrorBoundary>
);

export default App;
