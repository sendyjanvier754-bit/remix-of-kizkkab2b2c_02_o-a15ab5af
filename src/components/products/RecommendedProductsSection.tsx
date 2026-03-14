import { useTranslation } from "react-i18next";
import { useRecommendedProducts } from "@/hooks/useMarketplaceData";
import { cn } from "@/lib/utils";

interface RecommendedProductsSectionProps {
  maxProducts?: number;
  className?: string;
}

const RecommendedProductsSection = ({ maxProducts = 12, className }: RecommendedProductsSectionProps) => {
  const { t } = useTranslation();
  const { data: products = [], isLoading } = useRecommendedProducts(null, null, maxProducts);

  if (isLoading || products.length === 0) return null;

  // Shuffle products for randomness
  const shuffled = [...products].sort(() => Math.random() - 0.5);

  return (
    <div className={cn("py-6 px-4", className)}>
      <h2 className="text-lg font-bold text-foreground mb-4">{t('recommendedProducts.title')}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {shuffled.map((product) => (
          <ProductCard
            key={product.id}
            product={{
              id: product.id,
              name: product.name,
              price: product.price,
              originalPrice: product.originalPrice,
              image: product.image,
              sku: product.sku,
              storeId: product.storeId,
              storeName: product.storeName,
              storeWhatsapp: product.storeWhatsapp,
              source_product_id: product.source_product_id,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default RecommendedProductsSection;
