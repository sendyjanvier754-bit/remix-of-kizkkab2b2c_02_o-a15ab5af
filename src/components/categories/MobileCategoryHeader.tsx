import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Camera, Search, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { Category } from "@/hooks/useCategories";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types/auth";
import { useTranslatedList } from "@/hooks/useTranslatedContent";

interface MobileCategoryHeaderProps {
  categories: Category[];
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string) => void;
}

const MobileCategoryHeader = ({ 
  categories, 
  selectedCategory, 
  onSelectCategory 
}: MobileCategoryHeaderProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { role } = useAuth();
  const favoritesLink = (role === UserRole.SELLER || role === UserRole.ADMIN) ? "/seller/favoritos" : "/favoritos";
  const tabsRef = useRef<HTMLDivElement>(null);

  // Get root categories (no parent)
  const rootCategories = categories.filter((c) => !c.parent_id);

  // Translation hook for category names
  const { getTranslated } = useTranslatedList(
    'category',
    rootCategories,
    (cat) => ({ name: cat.name })
  );

  // Scroll to selected category tab
  useEffect(() => {
    if (selectedCategory && tabsRef.current) {
      const selectedTab = tabsRef.current.querySelector(`[data-category-id="${selectedCategory}"]`);
      if (selectedTab) {
        selectedTab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
  }, [selectedCategory]);

  return (
    <header className="bg-white sticky top-0 z-40">
      {/* Top search bar */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Notification/Mail icon */}
        <button className="relative flex-shrink-0">
          <Mail className="w-6 h-6 text-gray-700" strokeWidth={1.5} />
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-[#071d7f] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            5
          </span>
        </button>

        {/* Search input - pill style */}
        <div className="flex-1 flex items-center bg-gray-100 rounded-full border border-gray-200 overflow-hidden">
          <input
            type="text"
            placeholder="mens 2 piece outfits"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-500 px-4 py-2 outline-none"
          />
          <button className="p-2 text-gray-500 hover:text-gray-700 transition-colors">
            <Camera className="w-5 h-5" strokeWidth={1.5} />
          </button>
          <button className="bg-gray-900 hover:bg-gray-800 p-2 rounded-full m-0.5 transition-colors">
            <Search className="w-4 h-4 text-white" strokeWidth={2} />
          </button>
        </div>

        {/* Favorites heart */}
        <Link to={favoritesLink} className="relative flex-shrink-0">
          <Heart className="w-6 h-6 text-gray-700" strokeWidth={1.5} />
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#071d7f] rounded-full border-2 border-white" />
        </Link>
      </div>

      {/* Category tabs - horizontal scroll */}
      <div 
        ref={tabsRef}
        className="flex items-center gap-5 px-3 py-2 overflow-x-auto scrollbar-hide border-b border-gray-100"
      >
        {/* "All" tab */}
        <button
          onClick={() => navigate("/categorias")}
          className={cn(
            "text-sm font-medium whitespace-nowrap pb-1 transition-colors",
            !selectedCategory 
              ? "text-gray-900 border-b-2 border-gray-900" 
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          All
        </button>

        {rootCategories.map((category) => (
          <button
            key={category.id}
            data-category-id={category.id}
            onClick={() => onSelectCategory(category.id)}
            className={cn(
              "text-sm font-medium whitespace-nowrap pb-1 transition-colors",
              selectedCategory === category.id 
                ? "text-gray-900 border-b-2 border-gray-900" 
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {getTranslated(category).name || category.name}
          </button>
        ))}
      </div>
    </header>
  );
};

export default MobileCategoryHeader;
