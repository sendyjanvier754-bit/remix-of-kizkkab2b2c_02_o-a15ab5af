import { useNavigate } from "react-router-dom";
import { Category } from "@/hooks/useCategories";

interface SubcategoryGridProps {
  subcategories: Category[];
  parentCategory: Category | null;
}

const SubcategoryGrid = ({ subcategories, parentCategory }: SubcategoryGridProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      {/* Section title */}
      <div className="px-4 py-3 sticky top-0 bg-white z-10">
        <h2 className="text-base font-semibold text-gray-900">
          Picks for You
        </h2>
      </div>

      {/* Subcategories grid */}
      <div className="px-2 pb-20">
        {subcategories.length > 0 ? (
          <div className="grid grid-cols-3 gap-x-2 gap-y-4">
            {subcategories.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(`/categoria/${item.slug}`)}
                className="flex flex-col items-center text-center group"
              >
                {/* Circular image container */}
                <div className="w-[72px] h-[72px] rounded-full overflow-hidden bg-gray-100 mb-2 border border-gray-200 group-hover:border-red-400 transition-colors">
                  {item.icon ? (
                    <img 
                      src={item.icon} 
                      alt={item.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-pink-100 via-gray-100 to-blue-100 flex items-center justify-center">
                      <span className="text-xl text-gray-400 font-medium">
                        {item.name.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>
                {/* Name */}
                <span className="text-[11px] text-gray-700 leading-tight line-clamp-2 px-1">
                  {item.name}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            No hay subcategorías
          </div>
        )}
      </div>
    </div>
  );
};

export default SubcategoryGrid;
