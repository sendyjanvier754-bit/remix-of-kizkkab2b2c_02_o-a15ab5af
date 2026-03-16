import { cn } from "@/lib/utils";
import { Category } from "@/hooks/useCategories";
import { useTranslatedList } from "@/hooks/useTranslatedContent";

interface CategorySidebarProps {
  categories: Category[];
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string) => void;
}

const CategorySidebar = ({ 
  categories, 
  selectedCategory, 
  onSelectCategory 
}: CategorySidebarProps) => {
  const { getTranslated } = useTranslatedList(
    'category',
    categories,
    (cat) => ({ name: cat.name, description: cat.description })
  );

  return (
    <aside className="w-[100px] flex-shrink-0 bg-gray-50 overflow-y-auto pb-20 scrollbar-hide">
      {/* "Just for You" header/item */}
      <button
        onClick={() => onSelectCategory("just-for-you")}
        className={cn(
          "w-full text-center px-2 py-4 text-[12px] leading-tight transition-colors border-l-4",
          selectedCategory === "just-for-you"
            ? "text-black font-bold bg-white border-black"
            : "text-gray-600 hover:text-gray-900 border-transparent"
        )}
      >
        Just for You
      </button>

      {/* Category list */}
      <nav>
        {categories.map((category) => {
          const isSelected = selectedCategory === category.id;
          const translated = getTranslated(category);

          return (
            <button
              key={category.id}
              onClick={() => onSelectCategory(category.id)}
              className={cn(
                "w-full text-center px-2 py-4 text-[12px] leading-tight transition-colors border-l-4",
                isSelected
                  ? "text-black font-bold bg-white border-black"
                  : "text-gray-600 hover:text-gray-900 border-transparent"
              )}
            >
              {translated.name || category.name}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

export default CategorySidebar;
