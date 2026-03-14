import { useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, ShoppingBag } from 'lucide-react';

interface CartModeTabsProps {
  b2cCount?: number;
  b2bCount?: number;
}

/**
 * Tab bar for sellers to switch between B2C and B2B carts.
 * Renders as navigation tabs at the top of cart pages.
 */
const CartModeTabs = ({ b2cCount = 0, b2bCount = 0 }: CartModeTabsProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isB2B = location.pathname === '/seller/carrito';
  const isB2C = location.pathname === '/carrito';

  return (
    <div className="flex gap-1 p-1 bg-muted rounded-xl mb-4">
      <button
        onClick={() => !isB2C && navigate('/carrito')}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
          isB2C
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <ShoppingCart className="w-4 h-4" />
        <span>Mi Carrito</span>
        {b2cCount > 0 && (
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
            isB2C ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/20 text-muted-foreground'
          }`}>
            {b2cCount}
          </span>
        )}
      </button>
      <button
        onClick={() => !isB2B && navigate('/seller/carrito')}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
          isB2B
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <ShoppingBag className="w-4 h-4" />
        <span>Pedido B2B</span>
        {b2bCount > 0 && (
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
            isB2B ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/20 text-muted-foreground'
          }`}>
            {b2bCount}
          </span>
        )}
      </button>
    </div>
  );
};

export default CartModeTabs;
