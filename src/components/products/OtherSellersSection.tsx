/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Store as StoreIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useOtherSellerOffers } from "@/hooks/useOtherSellerOffers";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface OtherSellersSectionProps {
  sourceProductId?: string | null;
  currentCatalogId?: string | null;
  compact?: boolean;
}

const OtherSellersSection = ({
  sourceProductId,
  currentCatalogId,
  compact = false,
}: OtherSellersSectionProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const carouselRef = useRef<HTMLDivElement>(null);
  const { data: offers = [], isLoading } = useOtherSellerOffers(sourceProductId, currentCatalogId);

  if (!sourceProductId) return null;

  if (isLoading) {
    return (
      <div className="mt-4 space-y-3">
        <Skeleton className="h-4 w-40" />
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-64 w-40 flex-none" />
          ))}
        </div>
      </div>
    );
  }

  if (offers.length < 2) return null;

  const goToOffer = (offer: { sku: string; storeId: string | null }) => {
    const path = `/producto/${encodeURIComponent(offer.sku)}${offer.storeId ? `?seller=${offer.storeId}` : ""}`;
    navigate(path);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrollOffers = (direction: -1 | 1) => {
    carouselRef.current?.scrollBy({ left: direction * 520, behavior: "smooth" });
  };

  return (
    <section className={compact ? "mt-4" : "mt-6"}>
      <div className="mb-3 flex items-baseline justify-between gap-3 border-t border-border pt-4">
        <h2 className={`font-bold text-foreground ${compact ? "text-sm" : "text-lg"}`}>
          {t("otherSellers.title")}
        </h2>
        <span className="shrink-0 text-xs text-muted-foreground">
          {t("otherSellers.storesAvailable", { count: offers.length })}
        </span>
      </div>

      <div className="group/carousel relative">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("common.previous", { defaultValue: "Previous" })}
          onClick={() => scrollOffers(-1)}
          className="absolute left-1 top-[36%] z-10 hidden rounded-full bg-background shadow-md md:inline-flex"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <div
          ref={carouselRef}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {offers.map((offer) => (
            <article
              key={offer.catalogId}
              className="w-[44%] min-w-36 max-w-48 flex-none snap-start overflow-hidden rounded-md border border-border bg-card sm:w-44"
            >
              <button
                type="button"
                onClick={() => !offer.isCurrent && goToOffer(offer)}
                disabled={offer.isCurrent}
                className="block w-full text-left disabled:cursor-default"
              >
                <div className="relative aspect-square overflow-hidden bg-muted">
                  {offer.image ? (
                    <img
                      src={offer.image}
                      alt={offer.productName || offer.storeName}
                      className="h-full w-full object-cover transition-transform duration-300 motion-reduce:transition-none md:hover:scale-105"
                    />
                  ) : offer.storeLogo ? (
                    <img src={offer.storeLogo} alt={offer.storeName} className="h-full w-full object-contain p-6" />
                  ) : (
                    <StoreIcon className="absolute inset-0 m-auto h-8 w-8 text-muted-foreground" />
                  )}
                  {offer.isCurrent && (
                    <span className="absolute bottom-1 left-1 right-1 rounded-sm bg-primary px-1.5 py-1 text-center text-[9px] font-bold uppercase text-primary-foreground">
                      {t("otherSellers.currentlyViewing")}
                    </span>
                  )}
                </div>

                <div className="space-y-1 p-2.5">
                  <p className="line-clamp-2 min-h-9 text-xs font-medium leading-4 text-foreground">
                    {offer.productName || t("otherSellers.unnamedStore")}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {offer.storeLogo ? (
                      <img src={offer.storeLogo} alt="" className="h-4 w-4 rounded-full object-cover" />
                    ) : (
                      <StoreIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="truncate text-[11px] text-muted-foreground">
                      {offer.storeName || t("otherSellers.unnamedStore")}
                    </span>
                  </div>
                  <p className="text-base font-bold text-destructive">${offer.price.toFixed(2)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("otherSellers.inStock", { count: offer.stock })}
                  </p>
                </div>
              </button>
            </article>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("common.next", { defaultValue: "Next" })}
          onClick={() => scrollOffers(1)}
          className="absolute right-1 top-[36%] z-10 hidden rounded-full bg-background shadow-md md:inline-flex"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </section>
  );
};

export default OtherSellersSection;
