import { Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import TrendingCategoryCard from "./TrendingCategoryCard";
import { useTrendingCategories } from "@/hooks/useTrendingCategories";
const TrendingCategoriesSection = () => {
  const {
    data: categories,
    isLoading
  } = useTrendingCategories(6);
  if (isLoading) {
    return <section>
        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 bg-purple-100 rounded-full">
            <Layers className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <Skeleton className="h-6 w-48 mb-1" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 w-full rounded-lg" />)}
        </div>
      </section>;
  }
  if (!categories || categories.length === 0) {
    return <section>
        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 bg-purple-100 rounded-full">
            <Layers className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Categorías Destacadas</h2>
            
          </div>
        </div>
        <div className="text-center py-6 text-muted-foreground">
          No hay categorías con productos disponibles.
        </div>
      </section>;
  }
  return <section>
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 bg-purple-100 rounded-full">
          <Layers className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Categorías Destacadas</h2>
          <p className="text-muted-foreground text-sm">Explora nuestras categorías principales</p>
        </div>
      </div>

      <div className="space-y-2">
        {categories.map(category => <TrendingCategoryCard key={category.id} category={category} />)}
      </div>
    </section>;
};
export default TrendingCategoriesSection;