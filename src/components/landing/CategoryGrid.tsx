import CategoryCard from "./CategoryCard";
import { usePublicCategories } from "@/hooks/useCategories";
import { Skeleton } from "@/components/ui/skeleton";

const CategoryGrid = () => {
  const { data: categories = [], isLoading } = usePublicCategories();

  if (isLoading) {
    return (
      <section className="py-6 md:py-10 px-4">
        {/* Mobile skeleton */}
        <div className="lg:hidden overflow-x-auto scrollbar-hide">
          <div className="flex flex-col gap-4 min-w-max">
            <div className="flex gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center">
                  <Skeleton className="w-16 h-16 sm:w-20 sm:h-20 rounded-full" />
                  <Skeleton className="w-14 h-3 mt-2" />
                </div>
              ))}
            </div>
            <div className="flex gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center">
                  <Skeleton className="w-16 h-16 sm:w-20 sm:h-20 rounded-full" />
                  <Skeleton className="w-14 h-3 mt-2" />
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Desktop skeleton */}
        <div className="hidden lg:block w-full px-4">
          <div className="grid grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-x-4 gap-y-6 justify-items-center">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center">
                  <Skeleton className="w-28 h-28 md:w-32 md:h-32 rounded-full" />
                  <Skeleton className="w-20 h-4 mt-3" />
                </div>
              ))}
            </div>
        </div>
      </section>
    );
  }

  // Filter only root categories (no parent) for main display
  const rootCategories = categories.filter(cat => !cat.parent_id);

  // Split categories into two rows for mobile scroll
  const half = Math.ceil(rootCategories.length / 2);
  const firstRow = rootCategories.slice(0, half);
  const secondRow = rootCategories.slice(half);

  return (
    <section className="w-full py-6 md:py-10 px-4 overflow-x-hidden">
      {/* Mobile/Tablet: Horizontal scroll with 2 rows */}
      <div className="lg:hidden w-full">
        <div className="w-full overflow-x-auto scrollbar-hide">
          <div className="flex flex-col gap-4 pb-2">
            {/* First row */}
            <div className="flex gap-4">
              {firstRow.map((cat) => (
                <CategoryCard 
                  key={cat.id}
                  label={cat.name} 
                  image={cat.icon} 
                  href={`/categoria/${cat.slug}`} 
                />
              ))}
            </div>
            {/* Second row */}
            <div className="flex gap-4">
              {secondRow.map((cat) => (
                <CategoryCard 
                  key={cat.id}
                  label={cat.name} 
                  image={cat.icon} 
                  href={`/categoria/${cat.slug}`} 
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: Grid layout - full width */}
      <div className="hidden lg:block w-full px-4">
          <div className="grid grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-x-4 gap-y-6 justify-items-center">
            {rootCategories.map((cat) => (
              <div key={cat.id} className="w-full flex flex-col items-center">
                <CategoryCard 
                  label={cat.name} 
                  image={cat.icon} 
                  href={`/categoria/${cat.slug}`} 
                />
              </div>
            ))}
          </div>
        </div>
    </section>
  );
};

export default CategoryGrid;
