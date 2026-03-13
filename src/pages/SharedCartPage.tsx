import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { addItemB2C } from '@/services/cartService';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import GlobalHeader from '@/components/layout/GlobalHeader';
import Footer from '@/components/layout/Footer';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Package, Clock, AlertTriangle, Loader2, Check } from 'lucide-react';

interface SharedCartItem {
  sku: string;
  name: string;
  price: number;
  quantity: number;
  image?: string | null;
  storeId?: string | null;
  storeName?: string | null;
  storeWhatsapp?: string | null;
  sellerCatalogId?: string | null;
  color?: string | null;
  size?: string | null;
  variantId?: string | null;
  variantAttributes?: Record<string, any> | null;
}

const SharedCartPage = () => {
  const { shareCode } = useParams<{ shareCode: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [items, setItems] = useState<SharedCartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpired, setIsExpired] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!shareCode) return;
    (async () => {
      const { data, error } = await (supabase as any)
        .from('shared_carts')
        .select('items, expires_at')
        .eq('share_code', shareCode)
        .single();

      if (error || !data) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setIsExpired(true);
        setIsLoading(false);
        return;
      }

      setItems(data.items as SharedCartItem[]);
      setIsLoading(false);
    })();
  }, [shareCode]);

  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);

  const handleAddAll = async () => {
    if (!user?.id) {
      toast.error('Inicia sesión para agregar productos a tu carrito');
      navigate('/cuenta');
      return;
    }

    setIsAdding(true);
    try {
      for (const item of items) {
        await addItemB2C({
          userId: user.id,
          sku: item.sku,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
          storeId: item.storeId,
          storeName: item.storeName,
          storeWhatsapp: item.storeWhatsapp,
          sellerCatalogId: item.sellerCatalogId,
          variant: item.variantId ? {
            variantId: item.variantId,
            color: item.color ?? undefined,
            size: item.size ?? undefined,
            variantAttributes: item.variantAttributes ?? undefined,
          } : undefined,
        });
      }
      setAdded(true);
      toast.success(`${items.length} productos agregados a tu carrito`);
    } catch (err) {
      console.error('Error adding shared cart items:', err);
      toast.error('Error al agregar productos');
    } finally {
      setIsAdding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {!isMobile && <GlobalHeader />}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8">
            <AlertTriangle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Carrito no encontrado</h1>
            <p className="text-muted-foreground mb-4">Este enlace no es válido o ya no existe.</p>
            <Button asChild><Link to="/">Ir al inicio</Link></Button>
          </div>
        </div>
        {!isMobile && <Footer />}
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {!isMobile && <GlobalHeader />}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8">
            <Clock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Enlace expirado</h1>
            <p className="text-muted-foreground mb-4">Este carrito compartido ha expirado (7 días).</p>
            <Button asChild><Link to="/">Ir al inicio</Link></Button>
          </div>
        </div>
        {!isMobile && <Footer />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {!isMobile && <GlobalHeader />}

      <main className="flex-1 container mx-auto px-4 py-6 max-w-2xl">
        <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
          {/* Header */}
          <div className="p-4 border-b bg-muted/30">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="w-5 h-5 text-primary" />
              <h1 className="font-bold text-lg">Carrito compartido</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {totalQty} productos · ${totalPrice.toFixed(2)} total estimado
            </p>
          </div>

          {/* Items */}
          <div className="divide-y">
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-3 p-3">
                <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-5 h-5 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm line-clamp-2">{item.name}</p>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {item.color && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-medium">{item.color}</span>
                    )}
                    {item.size && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-medium">{item.size}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground">x{item.quantity}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm font-bold text-primary">${item.price.toFixed(2)}</span>
                    <span className="text-sm font-semibold">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-4 border-t bg-muted/20 space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total estimado</span>
              <span className="text-lg font-bold text-primary">${totalPrice.toFixed(2)}</span>
            </div>

            {added ? (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="w-5 h-5" />
                  <span className="font-semibold">Productos agregados</span>
                </div>
                <Button asChild className="w-full">
                  <Link to="/carrito">Ver mi carrito</Link>
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleAddAll}
                disabled={isAdding}
                className="w-full"
                size="lg"
              >
                {isAdding ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ShoppingCart className="w-4 h-4 mr-2" />
                )}
                Agregar todo a mi carrito
              </Button>
            )}
          </div>
        </div>
      </main>

      {!isMobile && <Footer />}
    </div>
  );
};

export default SharedCartPage;
