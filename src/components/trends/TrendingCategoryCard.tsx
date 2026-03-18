import { useNavigate } from "react-router-dom";
import { Sparkles, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types/auth";
import { useTranslatedContent } from "@/hooks/useTranslatedContent";

interface CategoryProduct {
  id: string;
  sku: string;
  nombre: string;
  imagen: string | null;
  precio: number;
}

interface TrendingCategoryCardProps {
  category: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    description: string | null;
    productCount: number;
    products: CategoryProduct[];
  };
}

const TrendingCategoryCard = ({ category }: TrendingCategoryCardProps) => {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const isB2B = user && (role === UserRole.SELLER || role === UserRole.ADMIN);

  // Translation hook for category name
  const translatedCategory = useTranslatedContent(
    'category',
    category.id,
    { name: category.name }
  );
  const displayCategoryName = translatedCategory.translated.name || category.name;

  const handleProductClick = (product: CategoryProduct) => {
    if (isB2B) {
      navigate(`/seller/adquisicion-lotes?search=${encodeURIComponent(product.sku)}`);
    } else {
      navigate(`/producto/${product.sku}`);
    }
  };

  const handleCategoryClick = () => {
    navigate(`/categoria/${category.slug}`);
  };

  return (
    <div className="bg-card overflow-hidden animate-fade-in">
      {/* Category Header */}
      <div className="p-3 flex items-start gap-3">
        {/* Category Icon with Trends Badge */}
        <div 
          className="relative cursor-pointer flex-shrink-0"
          onClick={handleCategoryClick}
        >
          <div className="w-12 h-12 rounded-full overflow-hidden bg-muted border-2 border-border">
            {category.icon ? (
              <img 
                src={category.icon} 
                alt={displayCategoryName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/40 text-primary font-bold text-lg">
                {displayCategoryName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          {/* Trends Badge */}
          <Badge 
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-purple-600 text-white text-[9px] px-1.5 py-0 font-medium border-0 shadow-sm"
          >
            Trends
          </Badge>
        </div>

        {/* Category Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 
              className="font-bold text-foreground truncate cursor-pointer hover:text-primary transition-colors text-base"
              onClick={handleCategoryClick}
            >
              {displayCategoryName}
            </h3>
            {category.productCount > 10 && (
              <Badge variant="secondary" className="bg-muted text-foreground text-[10px] px-1.5 py-0">
                Popular
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
            <span className="flex items-center gap-0.5">
              <Sparkles className="w-3 h-3 text-purple-500" />
              <span className="font-medium text-foreground">{category.productCount}</span> productos
            </span>
            {category.description && (
              <>
                <span className="text-muted-foreground/50">|</span>
                <span className="truncate max-w-[150px]">{category.description}</span>
              </>
            )}
          </div>
        </div>

        {/* View All Button */}
        <button
          onClick={handleCategoryClick}
          className="h-8 px-3 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded-md font-medium transition-colors"
        >
          Ver todo
        </button>
      </div>

      {/* Products Grid - 4 columns */}
      <div className="grid grid-cols-4 gap-1 px-3">
        {category.products.slice(0, 4).map((product) => (
          <div 
            key={product.id}
            className="cursor-pointer group"
            onClick={() => handleProductClick(product)}
          >
            <div className="aspect-[3/4] bg-muted overflow-hidden rounded">
              <img
                src={product.imagen || '/placeholder.svg'}
                alt={product.nombre}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            </div>
            {/* Price in orange */}
            <p className="text-orange-500 font-bold text-sm mt-1.5">
              <span className="text-orange-500/70 text-xs">$</span>
              <span className="text-orange-500">{product.precio.toFixed(2)}</span>
            </p>
          </div>
        ))}
        
        {/* Fill empty slots if less than 4 products */}
        {category.products.length < 4 && 
          Array.from({ length: 4 - category.products.length }).map((_, i) => (
            <div key={`empty-${i}`}>
              <div className="aspect-[3/4] bg-muted/30 rounded flex items-center justify-center">
                <Package className="w-6 h-6 text-muted-foreground/30" />
              </div>
              <div className="h-5 mt-1.5" />
            </div>
          ))
        }
      </div>

      {/* Category Description Footer */}
      <div className="px-3 py-3 flex items-center gap-1">
        <span className="text-orange-400 text-xl leading-none font-serif">"</span>
        <p className="text-sm text-muted-foreground flex-1 line-clamp-1">
          {category.description || `Explora los mejores productos en ${displayCategoryName}`}
        </p>
        <span className="text-orange-400 text-xl leading-none font-serif">"</span>
      </div>
    </div>
  );
};

export default TrendingCategoryCard;
