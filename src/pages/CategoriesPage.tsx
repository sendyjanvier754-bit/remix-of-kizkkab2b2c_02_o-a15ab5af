import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePublicCategories, Category } from "@/hooks/useCategories";
import { Skeleton } from "@/components/ui/skeleton";
import GlobalHeader from "@/components/layout/GlobalHeader";
import Footer from "@/components/layout/Footer";
import { ChevronRight } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useTranslatedList } from "@/hooks/useTranslatedContent";

const CategoriesPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: categories = [], isLoading } = usePublicCategories();
  const isMobile = useIsMobile();
  const { getTranslated } = useTranslatedList(
    'category',
    categories,
    (cat) => ({ name: cat.name })
  );
  const tName = (cat: Category | undefined | null) =>
    cat ? (getTranslated(cat).name || cat.name) : '';
  
  // Read selected root from URL params
  const selectedRootId = searchParams.get('cat');
  // Level 2: Selected secondary category (shown in right sidebar)
  const [selectedSecondaryId, setSelectedSecondaryId] = useState<string | null>(null);
  
  // Function to update selected root via URL
  const setSelectedRootId = (id: string | null) => {
    if (id) {
      setSearchParams({ cat: id });
    } else {
      setSearchParams({});
    }
  };

  // Filter root categories (those without a parent)
  const rootCategories = categories.filter(c => !c.parent_id);
  
  // Secondary categories (children of selected root)
  const secondaryCategories = selectedRootId 
    ? categories.filter(c => c.parent_id === selectedRootId)
    : [];
  
  // Final subcategories (children of selected secondary)
  const finalSubcategories = selectedSecondaryId
    ? categories.filter(c => c.parent_id === selectedSecondaryId)
    : [];

  // Get selected category objects
  const selectedRoot = categories.find(c => c.id === selectedRootId);
  const selectedSecondary = categories.find(c => c.id === selectedSecondaryId);

  // Auto-select first secondary when root changes
  useEffect(() => {
    if (selectedRootId && secondaryCategories.length > 0) {
      setSelectedSecondaryId(secondaryCategories[0].id);
    } else {
      setSelectedSecondaryId(null);
    }
  }, [selectedRootId, categories]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        {!isMobile && <GlobalHeader />}
        <main className="container mx-auto px-4 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </main>
        {!isMobile && <Footer />}
      </div>
    );
  }

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen bg-white overflow-x-hidden">
        
        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Right Sidebar - Secondary Categories */}
          <aside className="w-[100px] flex-shrink-0 bg-gray-50 overflow-y-auto overflow-x-hidden border-r border-gray-100 scrollbar-hide">
            {secondaryCategories.length > 0 ? (
              secondaryCategories.map(cat => (
                <div
                  key={cat.id}
                  className={cn(
                    "px-2 py-3 text-xs text-center cursor-pointer border-l-4 transition-all duration-200 flex items-center justify-center min-h-[56px] break-words",
                    selectedSecondaryId === cat.id
                      ? "bg-white border-black font-bold text-black"
                      : "border-transparent text-gray-500 hover:bg-gray-100"
                  )}
                  onClick={() => setSelectedSecondaryId(cat.id)}
                >
                  {tName(cat)}
                </div>
              ))
            ) : (
              <div className="px-2 py-4 text-xs text-center text-gray-400">
                Sin subcategorías
              </div>
            )}
          </aside>

          {/* Content Area - Final Subcategories */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-24 bg-white scrollbar-hide">
            {selectedSecondary && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 text-sm">{tName(selectedSecondary)}</h3>
                  <button
                    onClick={() => navigate(`/categoria/${selectedSecondary.slug}`)}
                    className="text-xs text-gray-500 flex items-center hover:text-black"
                  >
                    Ver todo <ChevronRight className="w-3 h-3 ml-1" />
                  </button>
                </div>

                {finalSubcategories.length > 0 ? (
                  <div className="grid grid-cols-3 gap-x-4 gap-y-6">
                    {finalSubcategories.map(sub => (
                      <div
                        key={sub.id}
                        className="flex flex-col items-center gap-2 group cursor-pointer"
                        onClick={() => navigate(`/categoria/${sub.slug}`)}
                      >
                        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shadow-sm group-hover:shadow-md transition-all">
                          {sub.icon ? (
                            <img src={sub.icon} alt={sub.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-2xl text-gray-300">{sub.name.charAt(0)}</span>
                          )}
                        </div>
                        <span className="text-[10px] text-center text-gray-600 leading-tight line-clamp-2 font-medium">
                          {tName(sub)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                    <p className="text-sm">No hay más subcategorías</p>
                    <button
                      onClick={() => navigate(`/categoria/${selectedSecondary.slug}`)}
                      className="mt-4 text-xs text-blue-600 font-medium"
                    >
                      Ver productos en {tName(selectedSecondary)}
                    </button>
                  </div>
                )}
              </div>
            )}

            {!selectedSecondary && secondaryCategories.length === 0 && selectedRoot && (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <p className="text-sm">No hay subcategorías</p>
                <button
                  onClick={() => navigate(`/categoria/${selectedRoot.slug}`)}
                  className="mt-4 text-xs text-blue-600 font-medium"
                >
                  Ver productos en {tName(selectedRoot)}
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
    );
  }

  // Desktop Layout
  return (
    <div className="min-h-screen bg-gray-50">
      <GlobalHeader />

      <main className="container mx-auto px-4 pb-8">
        {/* Breadcrumb */}
        <div className="mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <button onClick={() => navigate("/")} className="hover:text-blue-600">Inicio</button>
            <ChevronRight className="w-4 h-4" />
            <span>Categorías</span>
            {selectedRoot && (
              <>
                <ChevronRight className="w-4 h-4" />
                <span>{tName(selectedRoot)}</span>
              </>
            )}
            {selectedSecondary && (
              <>
                <ChevronRight className="w-4 h-4" />
                <span>{tName(selectedSecondary)}</span>
              </>
            )}
          </div>
        </div>

        {/* Header Tabs - Root Categories */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex px-4 py-3 gap-2 min-w-max border-b">
              {rootCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedRootId(cat.id)}
                  className={cn(
                    "px-4 py-2 text-sm rounded-lg whitespace-nowrap transition-all",
                    selectedRootId === cat.id
                      ? "bg-black text-white font-medium"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  {tName(cat)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex gap-6">
          {/* Sidebar - Secondary Categories */}
          <aside className="w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Subcategorías</h3>
              {secondaryCategories.length > 0 ? (
                <div className="space-y-1">
                  {secondaryCategories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedSecondaryId(cat.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm rounded-lg transition-all",
                        selectedSecondaryId === cat.id
                          ? "bg-black text-white font-medium"
                          : "text-gray-600 hover:bg-gray-100"
                      )}
                    >
                      {tName(cat)}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Sin subcategorías</p>
              )}
            </div>
          </aside>

          {/* Content - Final Subcategories */}
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow-sm p-6">
              {selectedSecondary && (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900">{tName(selectedSecondary)}</h2>
                    <button
                      onClick={() => navigate(`/categoria/${selectedSecondary.slug}`)}
                      className="text-sm text-blue-600 flex items-center hover:underline"
                    >
                      Ver todos los productos <ChevronRight className="w-4 h-4 ml-1" />
                    </button>
                  </div>

                  {finalSubcategories.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                      {finalSubcategories.map(sub => (
                        <div
                          key={sub.id}
                          className="flex flex-col items-center gap-3 group cursor-pointer"
                          onClick={() => navigate(`/categoria/${sub.slug}`)}
                        >
                          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shadow-sm group-hover:shadow-lg transition-all">
                            {sub.icon ? (
                              <img src={sub.icon} alt={sub.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-3xl text-gray-300">{sub.name.charAt(0)}</span>
                            )}
                          </div>
                          <span className="text-sm text-center text-gray-700 leading-tight line-clamp-2 font-medium group-hover:text-black">
                            {tName(sub)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                      <p className="text-base">No hay más subcategorías en este nivel</p>
                      <button
                        onClick={() => navigate(`/categoria/${selectedSecondary.slug}`)}
                        className="mt-4 text-sm text-blue-600 font-medium hover:underline"
                      >
                        Ver productos en {tName(selectedSecondary)}
                      </button>
                    </div>
                  )}
                </>
              )}

              {!selectedSecondary && secondaryCategories.length === 0 && selectedRoot && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <p className="text-base">Esta categoría no tiene subcategorías</p>
                  <button
                    onClick={() => navigate(`/categoria/${selectedRoot.slug}`)}
                    className="mt-4 text-sm text-blue-600 font-medium hover:underline"
                  >
                    Ver productos en {tName(selectedRoot)}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default CategoriesPage;
