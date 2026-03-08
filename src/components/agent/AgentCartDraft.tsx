import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Minus, Plus, Trash2, ShoppingCart, Send } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface DraftItem {
  id: string;
  product_id: string;
  variant_id: string | null;
  sku: string;
  nombre: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  color: string | null;
  size: string | null;
  image: string | null;
}

interface AgentCartDraftProps {
  items: DraftItem[];
  subtotal: number;
  itemCount: number;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onPushToCheckout: () => void;
  isLoading?: boolean;
  draftStatus: string;
}

export default function AgentCartDraft({
  items,
  subtotal,
  itemCount,
  onUpdateQuantity,
  onRemoveItem,
  onPushToCheckout,
  isLoading,
  draftStatus,
}: AgentCartDraftProps) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <ShoppingCart className="h-12 w-12 mb-3 opacity-50" />
          <p className="text-sm">Agrega productos al borrador</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Carrito ({itemCount} items)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 py-2">
            {item.image && (
              <img src={item.image} alt={item.nombre} className="h-12 w-12 rounded object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.nombre}</p>
              <div className="flex gap-1 text-xs text-muted-foreground">
                {item.color && <span>{item.color}</span>}
                {item.size && <span>/ {item.size}</span>}
                <span>· SKU: {item.sku}</span>
              </div>
              <p className="text-sm font-semibold text-primary">
                ${Number(item.unit_price).toFixed(2)} × {item.quantity} = ${Number(item.total_price).toFixed(2)}
              </p>
            </div>
            {draftStatus === 'draft' && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                  disabled={item.quantity <= 1}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="text-sm w-8 text-center">{item.quantity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 ml-1"
                  onClick={() => onRemoveItem(item.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            )}
          </div>
        ))}
        <Separator />
        <div className="flex justify-between items-center font-semibold">
          <span>Subtotal</span>
          <span className="text-primary">${subtotal.toFixed(2)}</span>
        </div>
        {draftStatus === 'draft' && (
          <Button
            onClick={onPushToCheckout}
            disabled={isLoading || items.length === 0}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            Confirmar y Enviar al Checkout
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
