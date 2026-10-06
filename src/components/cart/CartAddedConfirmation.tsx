import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CART_ADDED_EVENT, type CartAddedDetail } from "@/lib/cartFeedback";

const TEXT: Record<string, { title: string; qty: string; keep: string; view: string; b2b: string }> = {
  es: { title: "¡Agregado al carrito!", qty: "Cantidad", keep: "Seguir comprando", view: "Ver carrito", b2b: "Pedido mayorista" },
  en: { title: "Added to cart!", qty: "Quantity", keep: "Keep shopping", view: "View cart", b2b: "Wholesale order" },
  fr: { title: "Ajouté au panier !", qty: "Quantité", keep: "Continuer mes achats", view: "Voir le panier", b2b: "Commande en gros" },
  ht: { title: "Ajoute nan panyen!", qty: "Kantite", keep: "Kontinye achte", view: "Wè panyen", b2b: "Kòmand an gwo" },
};

export const CartAddedConfirmation = () => {
  const [item, setItem] = useState<CartAddedDetail | null>(null);
  const [key, setKey] = useState(0);
  const timer = useRef<number>();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const tx = TEXT[(i18n.language || "es").slice(0, 2)] || TEXT.es;

  useEffect(() => {
    const onAdd = (e: Event) => {
      const detail = (e as CustomEvent<CartAddedDetail>).detail;
      setItem(detail);
      setKey((k) => k + 1);
      document.querySelectorAll('[data-cart-icon]').forEach((el) => {
        el.classList.remove("animate-cart-bump");
        void (el as HTMLElement).offsetWidth;
        el.classList.add("animate-cart-bump");
      });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setItem(null), 4500);
    };
    window.addEventListener(CART_ADDED_EVENT, onAdd);
    return () => {
      window.removeEventListener(CART_ADDED_EVENT, onAdd);
      window.clearTimeout(timer.current);
    };
  }, []);

  if (!item) return null;

  const close = () => setItem(null);

  return (
    <div
      key={key}
      role="status"
      aria-live="polite"
      className="fixed z-[100] left-1/2 -translate-x-1/2 bottom-20 lg:bottom-auto lg:left-auto lg:translate-x-0 lg:top-20 lg:right-6 w-[calc(100%-2rem)] max-w-sm animate-cart-pop"
    >
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl">
        <div className="flex items-center gap-3 px-4 pt-4">
          <svg viewBox="0 0 52 52" className="h-9 w-9 shrink-0">
            <circle cx="26" cy="26" r="24" fill="none" className="stroke-primary animate-check-circle" strokeWidth="3" />
            <path d="M15 27l7 7 15-15" fill="none" className="stroke-primary animate-check-mark" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="flex-1">
            <p className="font-bold leading-tight">{tx.title}</p>
            {item.isB2B && <p className="text-xs text-muted-foreground">{tx.b2b}</p>}
          </div>
          <button onClick={close} aria-label="close" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-3 p-4">
          {item.image ? (
            <img src={item.image} alt="" className="h-16 w-16 rounded-lg object-cover bg-muted animate-cart-thumb" />
          ) : (
            <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center"><ShoppingCart className="h-6 w-6 text-muted-foreground" /></div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium line-clamp-2">{item.name}</p>
            {item.variant && <p className="text-xs text-muted-foreground truncate">{item.variant}</p>}
            {item.quantity ? <p className="text-xs text-muted-foreground mt-1">{tx.qty}: {item.quantity}</p> : null}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 px-4 pb-4">
          <Button variant="outline" size="sm" onClick={close}>{tx.keep}</Button>
          <Button size="sm" onClick={() => { close(); navigate("/carrito"); }}>
            <ShoppingCart className="h-4 w-4 mr-1" />{tx.view}
          </Button>
        </div>
        <div className="absolute bottom-0 left-0 h-1 bg-primary animate-cart-progress" />
      </div>
    </div>
  );
};

export default CartAddedConfirmation;
