import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { usePromotedProducts } from "@/hooks/usePromotedProducts";

/** Kizkka Ads slot for news pages; falls back to official Kizkka products. */
export function NewsSponsored({ max = 4, layout = "list" }: { max?: number; layout?: "list" | "row" }) {
  const { t } = useTranslation();
  const { data = [], isLoading } = usePromotedProducts(null, false, "news", max);
  if (!isLoading && data.length === 0) return null;
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm uppercase tracking-wide">{t("news.sponsoredTitle")}</h3>
        <span className="text-[10px] uppercase text-muted-foreground border rounded px-1.5 py-0.5">{t("news.sponsored")}</span>
      </div>
      <div className={layout === "row" ? "grid grid-cols-2 sm:grid-cols-4 gap-3" : "space-y-3"}>
        {isLoading
          ? Array.from({ length: max }).map((_, i) => <div key={i} className="h-16 rounded bg-muted animate-pulse" />)
          : data.map((p) => (
              <Link key={p.id} to="/producto/$sku" params={{ sku: p.sku }}
                className={layout === "row" ? "block group" : "flex gap-3 items-center group"}>
                <img src={p.imagen_principal} alt={p.nombre} loading="lazy"
                  className={layout === "row" ? "w-full aspect-square object-cover rounded-lg bg-muted" : "h-16 w-16 rounded-lg object-cover bg-muted shrink-0"} />
                <div className="min-w-0 mt-1">
                  <p className="text-sm font-medium line-clamp-2 group-hover:text-primary">{p.nombre}</p>
                  <p className="text-sm font-bold text-price">${p.precio_b2b.toFixed(2)}</p>
                  {p.storeName && <p className="text-[11px] text-muted-foreground truncate">{p.storeName}</p>}
                </div>
              </Link>
            ))}
      </div>
    </section>
  );
}
