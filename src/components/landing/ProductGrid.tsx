import { useMemo } from "react";
import ProductCard from "./ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types/auth";
import { useB2BPricesMap } from "@/hooks/useMarketplaceData";
import { useViewMode } from "@/contexts/ViewModeContext";

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  discount?: number;
  badge?: string;
  sku: string;
  storeId?: string;
  storeName?: string;
  storeWhatsapp?: string;
  rating?: number;
  source_product_id?: string;
  [key: string]: any;
}

interface ProductGridProps {
  products: Product[];
  isLoading?: boolean;
  skeletonCount?: number;
}

const ProductGrid = ({ products, isLoading = false, skeletonCount = 30 }: ProductGridProps) => {
  const { user } = useAuth();
  const { isClientPreview } = useViewMode();
  const isB2BUser = (user?.role === UserRole.SELLER || user?.role === UserRole.ADMIN) && !isClientPreview;

  const sourceProductIds = useMemo(
    () => isB2BUser ? products.map(p => p.source_product_id).filter(Boolean) as string[] : [],
    [isB2BUser, products]
  );

  const { data: b2bPricesMap = {} } = useB2BPricesMap(sourceProductIds);
  if (isLoading) {
    return (
      <div className="w-full px-4 py-2">
        <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-1">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div key={i} className="bg-card rounded-lg overflow-hidden">
              <Skeleton className="aspect-square w-full" />
              <div className="p-1 space-y-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) return null;

  return (
    <div className="w-full px-4 py-2">
      <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-1">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            b2bData={isB2BUser && product.source_product_id ? b2bPricesMap[product.source_product_id] : undefined}
          />
        ))}
      </div>
    </div>
  );
};

export default ProductGrid;