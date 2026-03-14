/**
 * Smart Cart Hook
 * Automatically routes cart operations based on user role:
 * - Unauthenticated users -> Local B2C Cart (localStorage)
 * - Sellers/Admins -> B2B Cart with MOQ
 * - Regular users -> B2C Cart
 * 
 * When users log in, useCartMigration handles migration to the appropriate cart.
 */

import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useB2BCartSupabase } from "@/hooks/useB2BCartSupabase";
import { UserRole } from "@/types/auth";
import { useViewMode } from "@/contexts/ViewModeContext";
import { toast } from "sonner";

interface ProductForCart {
  id: string;
  name: string;
  price: number; // B2C price
  priceB2B?: number; // B2B/wholesale price
  pvp?: number; // Precio venta sugerido
  moq?: number; // Minimum order quantity
  stock?: number;
  image: string;
  sku: string;
  storeId?: string;
  storeName?: string;
  storeWhatsapp?: string;
}

interface BusinessSummary {
  investment: number;
  estimatedRevenue: number;
  estimatedProfit: number;
  profitPerUnit: number;
  profitPercentage: number;
}

export const useSmartCart = () => {
  const { user, role } = useAuth();
  const b2cCart = useCart();
  const b2bCart = useB2BCartSupabase();
  const { isClientPreview } = useViewMode();

  // User is B2B only if authenticated AND has SELLER or ADMIN role AND NOT in client preview mode
  const isB2BUser = user && (role === UserRole.SELLER || role === UserRole.ADMIN) && !isClientPreview;
  
  // User is authenticated
  const isAuthenticated = !!user;

  /**
   * Add product to cart - routes based on authentication and role
   * - Not authenticated: Local cart (B2C style)
   * - Authenticated B2B user: B2B cart with MOQ
   * - Authenticated B2C user: B2C cart
   */
  const addToCart = (product: ProductForCart) => {
    // If not authenticated, always use local cart (B2C-style)
    // This will be migrated when user logs in via useCartMigration
    if (!isAuthenticated) {
      b2cCart.addItem({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        sku: product.sku,
        storeId: product.storeId,
        storeName: product.storeName,
        storeWhatsapp: product.storeWhatsapp,
      });

      toast.success("Añadido al carrito", {
        description: product.name,
      });
      return true;
    }

    // Authenticated users - route based on role
    if (isB2BUser) {
      // Add to B2B cart with MOQ
      const moq = product.moq || 1;
      const priceB2B = product.priceB2B || product.price;
      const stock = product.stock || moq;

      if (stock < moq) {
        toast.error(`Stock insuficiente. Disponible: ${stock}, MOQ: ${moq}`);
        return false;
      }

      b2bCart.addItem({
        productId: product.id,
        variantId: null,
        sku: product.sku,
        nombre: product.name,
        quantity: moq,
        unitPrice: priceB2B,
        moq: moq,
        stockDisponible: stock
      });

      toast.success(`Agregado al carrito B2B`, {
        description: `${product.name} x ${moq} unidades (MOQ)`,
      });
      return true;
    } else {
      // Authenticated B2C user
      b2cCart.addItem({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        sku: product.sku,
        storeId: product.storeId,
        storeName: product.storeName,
        storeWhatsapp: product.storeWhatsapp,
      });

      toast.success("Añadido al carrito", {
        description: product.name,
      });
      return true;
    }
  };

  const getCartInfo = () => {
    // For unauthenticated users or B2C users, show local cart
    if (!isAuthenticated || !isB2BUser) {
      return {
        totalItems: b2cCart.totalItems(),
        totalQuantity: b2cCart.items.reduce((sum, item) => sum + item.quantity, 0),
        subtotal: b2cCart.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
        items: b2cCart.items,
        cartType: "b2c" as const,
        cartLink: "/carrito",
      };
    }
    
    // B2B user
    return {
      totalItems: b2bCart.cart.items.length,
      totalQuantity: b2bCart.cart.items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: b2bCart.cart.items.reduce((sum, item) => sum + item.totalPrice, 0),
      items: b2bCart.cart.items,
      cartType: "b2b" as const,
      cartLink: "/seller/carrito",
    };
  };

  /**
   * Calculate business summary for B2B purchases
   */
  const getBusinessSummary = (
    costB2B: number,
    pvp: number,
    quantity: number
  ): BusinessSummary => {
    const profitPerUnit = pvp - costB2B;
    const profitPercentage = costB2B > 0 ? Math.round((profitPerUnit / costB2B) * 100) : 0;

    return {
      investment: quantity * costB2B,
      estimatedRevenue: quantity * pvp,
      estimatedProfit: quantity * profitPerUnit,
      profitPerUnit,
      profitPercentage,
    };
  };

  return {
    addToCart,
    getCartInfo,
    getBusinessSummary,
    isB2BUser: !!isB2BUser,
    isAuthenticated,
    // Expose underlying carts for direct access when needed
    b2cCart,
    b2bCart,
  };
};