import CategoryCard from "./CategoryCard";
import { usePublicCategories } from "@/hooks/useCategories";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslatedList } from "@/hooks/useTranslatedContent";

const CategoryGrid = () => {
  const { data: categories = [], isLoading } = usePublicCategories();

  // Departments first, then subcategories; max 3 rows x 12 columns
  const displayCategories = [
    ...categories.filter(cat => !cat.parent_id),
    ...categories.filter(cat => cat.parent_id),
  ].slice(0, 36);

  const { getTranslated } = useTranslatedList(
    'category',
    displayCategories,
    (cat) => ({ name: cat.name })
  );

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
          <div className="grid grid-cols-12 gap-x-3 gap-y-5 justify-items-center">
              {Array.from({ length: 12 }).map((_, i) => (
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

  // Mobile: split into 3 horizontally scrollable rows
  const perRow = Math.ceil(displayCategories.length / 3);
  const rows = [0, 1, 2].map((i) => displayCategories.slice(i * perRow, (i + 1) * perRow)).filter((r) => r.length);

  const labelOf = (cat: typeof displayCategories[number]) =>
    getTranslated(cat).name || cat.name;

  return (
    <section className="w-full py-6 md:py-10 px-4 overflow-x-hidden">
      <div className="lg:hidden w-full">
        <div className="w-full overflow-x-auto scrollbar-hide">
          <div className="flex flex-col gap-3 pb-2">
            {rows.map((row, idx) => (
              <div key={idx} className="flex gap-4">
                {row.map((cat) => (
                  <CategoryCard key={cat.id} label={labelOf(cat)} image={cat.icon} href={`/categoria/${cat.slug}`} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop: up to 3 rows x 12 columns */}
      <div className="hidden lg:block w-full px-4">
          <div className="grid grid-cols-12 gap-x-3 gap-y-5 justify-items-center">
            {displayCategories.map((cat) => (
              <div key={cat.id} className="w-full flex flex-col items-center">
                <CategoryCard
                  label={labelOf(cat)}
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
