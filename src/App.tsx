import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, ReactNode, Suspense } from "react";
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
const StorePage = lazy(() => import("./pages/StorePage"));
const ProductPage = lazy(() => import("./pages/ProductPage"));
const CategoriesPage = lazy(() => import("./pages/CategoriesPage"));
const CategoryProductsPage = lazy(() => import("./pages/CategoryProductsPage"));
const StoreProfilePage = lazy(() => import("./pages/StoreProfilePage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const FavoritesPage = lazy(() => import("./pages/FavoritesPage"));
const SearchResultsPage = lazy(() => import("./pages/SearchResultsPage"));
const TrendsPage = lazy(() => import("./pages/TrendsPage"));
const MarketplacePage = lazy(() => import("./pages/MarketplacePage"));
const MyPurchasesPage = lazy(() => import("./pages/MyPurchasesPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const UserProfilePage = lazy(() => import("./pages/UserProfilePage"));
const EditProfilePage = lazy(() => import("./pages/EditProfilePage"));

// Lazy loaded - Siver Match Pages (B2B2C Ecosystem)
const SiverMatchHub = lazy(() => import("./pages/siver-match/SiverMatchHub"));
const InvestorDashboard = lazy(() => import("./pages/siver-match/InvestorDashboard"));
const GestorDashboard = lazy(() => import("./pages/siver-match/GestorDashboard"));

// Lazy loaded - Admin Pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminConciliacion = lazy(() => import("./pages/admin/AdminConciliacion"));
const AdminCatalogo = lazy(() => import("./pages/admin/AdminCatalogo"));
const AdminCategorias = lazy(() => import("./pages/admin/AdminCategorias"));
const AdminVendedores = lazy(() => import("./pages/admin/AdminVendedores"));
const AdminBanners = lazy(() => import("./pages/admin/AdminBanners"));
const AdminProveedores = lazy(() => import("./pages/admin/AdminProveedores"));
const AdminPedidos = lazy(() => import("./pages/admin/AdminPedidos"));
const AdminPreciosConfig = lazy(() => import("./pages/admin/AdminPreciosConfig"));
const AdminApprovals = lazy(() => import("./pages/admin/AdminApprovals"));
const AdminCotizaciones = lazy(() => import("./pages/admin/AdminCotizaciones"));
const AdminReembolsos = lazy(() => import("./pages/admin/AdminReembolsos"));
const AdminCommissionPage = lazy(() => import("./pages/admin/AdminCommissionPage"));
const AdminPickupPointsPage = lazy(() => import("./pages/admin/AdminPickupPointsPage"));
const AdminTransitHubsPage = lazy(() => import("./pages/admin/AdminTransitHubsPage"));
const AdminDiscountCodes = lazy(() => import("./pages/admin/AdminDiscountCodes"));
const AdminPopupsPage = lazy(() => import("./pages/admin/AdminPopupsPage"));
const AdminUserDiscounts = lazy(() => import("./pages/admin/AdminUserDiscounts"));
const AdminCartAnalytics = lazy(() => import("./pages/admin/AdminCartAnalytics"));
const AdminLogisticsPage = lazy(() => import("./pages/admin/AdminLogisticsPage"));
const AdminInventoryPage = lazy(() => import("./pages/admin/AdminInventoryPage"));
const AdminPOMasterPage = lazy(() => import("./pages/admin/AdminPOMasterPage"));
const AdminPaymentMethodsPage = lazy(() => import("./pages/admin/AdminPaymentMethodsPage"));
const AdminMarketplaceSections = lazy(() => import("./pages/admin/AdminMarketplaceSections"));
const AdminCountriesRoutesPage = lazy(() => import("./pages/admin/AdminCountriesRoutesPage"));
const AdminMarketsPage = lazy(() => import("./pages/admin/AdminMarketsPage"));
const AdminWishlistPage = lazy(() => import("./pages/admin/AdminWishlistPage"));
const AdminGlobalLogisticsPage = lazy(() => import("./pages/admin/AdminGlobalLogisticsPage"));
const AdminAgentOrders = lazy(() => import("./pages/admin/AdminAgentOrders"));
const AdminSupportChats = lazy(() => import("./pages/admin/AdminSupportChats"));
const NotificationsPage = lazy(() => import("./pages/admin/NotificationsPage"));

// Lazy loaded - Seller Pages
const SellerAcquisicionLotes = lazy(() => import("./pages/seller/SellerAcquisicionLotes"));
const SellerCheckout = lazy(() => import("./pages/seller/SellerCheckout"));
const SellerAccountPage = lazy(() => import("./pages/seller/SellerAccountPage"));
const SellerWalletPage = lazy(() => import("./pages/seller/SellerWalletPage"));
const SellerDashboard = lazy(() => import("./pages/seller/SellerDashboard"));
const SellerProfilePage = lazy(() => import("./pages/seller/SellerProfilePage"));
const SellerCartPage = lazy(() => import("./pages/seller/SellerCartPage"));
const SellerFavoritesPage = lazy(() => import("./pages/seller/SellerFavoritesPage"));
const SellerInventarioB2C = lazy(() => import("./pages/seller/SellerInventarioB2C"));
const SellerPedidosPage = lazy(() => import("./pages/seller/SellerPedidosPage"));
const SellerMisComprasPage = lazy(() => import("./pages/seller/SellerMisComprasPage"));
const SellerCreditPage = lazy(() => import("./pages/seller/SellerCreditPage"));
const SellerDiscountCodes = lazy(() => import("./pages/seller/SellerDiscountCodes"));
const SellerCustomerDiscounts = lazy(() => import("./pages/seller/SellerCustomerDiscounts"));
const SellerMarketingPage = lazy(() => import("./pages/seller/SellerMarketingPage"));
const SellerAnalyticsPage = lazy(() => import("./pages/seller/SellerAnalyticsPage"));
const SellerMiCatalogoPage = lazy(() => import("./pages/seller/SellerMiCatalogoPage"));

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
            <Route path="/checkout" element={<LazyRoute><CheckoutPage /></LazyRoute>} />
            <Route path="/favoritos" element={<LazyRoute><FavoritesPage /></LazyRoute>} />
            <Route path="/tendencias" element={<LazyRoute><TrendsPage /></LazyRoute>} />
            <Route path="/busqueda" element={<LazyRoute><SearchResultsPage /></LazyRoute>} />
            
            {/* ========== SIVER MATCH (B2B2C Ecosystem) ========== */}
            <Route path="/siver-match" element={<LazyRoute><SiverMatchHub /></LazyRoute>} />
            <Route path="/siver-match/investor" element={<LazyRoute><InvestorDashboard /></LazyRoute>} />
            <Route path="/siver-match/gestor" element={<LazyRoute><GestorDashboard /></LazyRoute>} />
            
            {/* Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/seller/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            
            {/* Seller Registration Landing Page */}
            <Route path="/registro-vendedor" element={<SellerRegistrationPage />} />
            
            {/* Seller Onboarding (no auth required, just registered) */}
            <Route path="/seller/onboarding" element={<SellerOnboardingPage />} />
            
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
              path="/admin/notificaciones" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SELLER, UserRole.SALES_AGENT]}>
                  <LazyRoute><NotificationsPage /></LazyRoute>
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
      <BrowserRouter>
        <AuthProvider>
          <ViewModeProvider>
            <ShippingTiersRealtimeProvider />
            <AppContent />
          </ViewModeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </ErrorBoundary>
);

export default App;
