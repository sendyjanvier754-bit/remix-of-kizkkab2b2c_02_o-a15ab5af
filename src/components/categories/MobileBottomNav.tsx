import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, LayoutGrid, Sparkles, ShoppingBag, Package, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types/auth";
import { useB2CCartItems } from "@/hooks/useB2CCartItems";
import { useB2BCartItems } from "@/hooks/useB2BCartItems";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const MobileBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const { items: b2cItems } = useB2CCartItems();
  const { items: b2bItems } = useB2BCartItems();
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  
  // Hide on admin routes (except support chat)
  const isAdminRoute = location.pathname.startsWith("/admin") && !location.pathname.startsWith("/admin/soporte-chat");
  
  if (isAdminRoute) {
    return null;
  }
  
  const isB2B = role === UserRole.SELLER || role === UserRole.ADMIN;
  const cartLink = isB2B ? "/seller/carrito" : "/carrito";
  
  // Get cart count based on user type
  const cartItems = isB2B ? b2bItems : b2cItems;
  const cartCount = cartItems.reduce((sum, item) => sum + ('quantity' in item ? item.quantity : item.cantidad), 0);
  const cartBadge = cartCount > 0 ? (cartCount > 99 ? "99+" : cartCount.toString()) : undefined;
  
  const categoriesLink = "/categorias";
  
  // Different nav items based on role - B2B users get B2B link, regular users/public get account link
  const navItems = isB2B ? [
    { href: "/", icon: Home, label: "Inicio" },
    { href: categoriesLink, icon: LayoutGrid, label: "Categorías" },
    { href: "/seller/adquisicion-lotes", icon: Package, label: "B2B" },
    { href: cartLink, icon: ShoppingBag, label: "Carrito", badge: cartBadge },
    { href: "/tendencias", icon: Sparkles, label: "Tendencias", hasDot: true },
  ] : [
    { href: "/", icon: Home, label: "Inicio" },
    { href: categoriesLink, icon: LayoutGrid, label: "Categorías" },
    { href: "/tendencias", icon: Sparkles, label: "Tendencias", hasDot: true },
    { href: cartLink, icon: ShoppingBag, label: "Carrito", badge: cartBadge },
    { href: user ? "/cuenta" : "/login", icon: User, label: user ? "Cuenta" : "Login" },
  ];

  return (
    <>
    <nav className="fixed bottom-0 left-0 right-0 z-[9999] bg-[#ffdcdc] border-t border-gray-200 lg:hidden shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
      <div className="flex items-center justify-around h-12 px-1 bg-[#fff3f3]">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href === "/categorias" && location.pathname.startsWith("/categoria"));
          
          const IconComponent = item.icon;
          const isCartItem = item.href === cartLink;
          const requiresAuth = isCartItem && !user;
          
          return requiresAuth ? (
            <button
              key="cart-login"
              onClick={() => setShowLoginDialog(true)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 min-w-[60px] h-full",
                "transition-colors bg-transparent border-0 cursor-pointer"
              )}
            >
              <div className="relative">
                <IconComponent className="w-5 h-5 text-gray-500" strokeWidth={1.5} />
              </div>
              <span className="text-[10px] text-gray-500">{item.label}</span>
            </button>
          ) : (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 min-w-[60px] h-full",
                "transition-colors",
                isActive ? "bg-[#071d7f]" : ""
              )}
            >
              <div className="relative">
                <IconComponent 
                  className={cn(
                    "w-5 h-5",
                    isActive ? "text-white" : "text-gray-500"
                  )} 
                  strokeWidth={isActive ? 2 : 1.5}
                />
                {item.badge && (
                  <span className="absolute -top-1.5 -right-3 min-w-[20px] h-[16px] bg-[#071d7f] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                    {item.badge}
                  </span>
                )}
                {item.hasDot && (
                  <span className="absolute -top-0.5 right-0 w-2 h-2 bg-[#071d7f] rounded-full" />
                )}
              </div>
              <span className={cn(
                "text-[10px]",
                isActive ? "text-white font-medium" : "text-gray-500"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>

    {/* Login required dialog — shown when guest clicks cart */}
    <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#071d7f]" />
            Inicia sesión
          </DialogTitle>
          <DialogDescription>
            Necesitas una cuenta para ver y gestionar tu carrito de compras.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-2">
          <button
            onClick={() => { setShowLoginDialog(false); navigate('/cuenta'); }}
            className="w-full py-2.5 px-4 bg-[#071d7f] text-white rounded-lg font-medium hover:bg-[#0a2a9f] transition"
          >
            Iniciar sesión
          </button>
          <button
            onClick={() => { setShowLoginDialog(false); navigate('/cuenta?tab=register'); }}
            className="w-full py-2.5 px-4 border border-[#071d7f] text-[#071d7f] rounded-lg font-medium hover:bg-[#071d7f]/5 transition"
          >
            Crear cuenta
          </button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default MobileBottomNav;
