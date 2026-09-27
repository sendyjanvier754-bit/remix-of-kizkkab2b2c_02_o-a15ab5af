/* eslint-disable @typescript-eslint/no-explicit-any */
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Store as StoreIcon, ChevronRight } from "lucide-react";
import { useOtherSellerOffers } from "@/hooks/useOtherSellerOffers";
import { Skeleton } from "@/components/ui/skeleton";

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
  const { data: offers = [], isLoading } = useOtherSellerOffers(sourceProductId, currentCatalogId);

  if (!sourceProductId) return null;

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl p-4 mt-4 border border-gray-200 shadow-sm space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (offers.length < 2) return null;

  const bestPrice = Math.min(...offers.map((o) => o.price));

  const goToOffer = (offer: { sku: string; storeId: string | null }) => {
    const path = `/producto/${encodeURIComponent(offer.sku)}${offer.storeId ? `?seller=${offer.storeId}` : ""}`;
    navigate(path);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${compact ? "p-4 mt-4" : "p-5 mt-6"}`}>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className={`font-bold text-gray-900 ${compact ? "text-sm" : "text-base"}`}>
          {t("otherSellers.title")}
        </h2>
        <span className="text-xs text-gray-500">
          {t("otherSellers.storesAvailable", { count: offers.length })}
        </span>
      </div>

      <div className="divide-y divide-gray-100">
        {offers.map((offer) => (
          <button
            key={offer.catalogId}
            type="button"
            onClick={() => !offer.isCurrent && goToOffer(offer)}
            disabled={offer.isCurrent}
            className={`w-full flex items-center gap-3 py-3 text-left transition ${
              offer.isCurrent ? "opacity-100 cursor-default" : "hover:bg-gray-50"
            }`}
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center">
              {offer.storeLogo ? (
                <img src={offer.storeLogo} alt={offer.storeName} className="w-full h-full object-cover" />
              ) : (
                <StoreIcon className="w-4 h-4 text-gray-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {offer.storeName || t("otherSellers.unnamedStore")}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {offer.price === bestPrice && (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                    {t("otherSellers.bestPrice")}
                  </span>
                )}
                {offer.isCurrent && (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-50 text-[#071d7f] border border-blue-200">
                    {t("otherSellers.currentlyViewing")}
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  {t("otherSellers.inStock", { count: offer.stock })}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm font-bold text-[#94111f]">${offer.price.toFixed(2)}</span>
              {!offer.isCurrent && (
                <span className="hidden sm:flex items-center gap-1 text-xs font-semibold text-[#071d7f]">
                  {t("otherSellers.chooseStore")}
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default OtherSellersSection;
