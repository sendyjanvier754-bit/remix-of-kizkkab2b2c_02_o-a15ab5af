import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams, Link } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Store as StoreIcon, ShoppingBag, LayoutGrid } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePublicCategories } from "@/hooks/useCategories";
import {
  useSearchProductsPage,
  useSearchStores,
  useSearchScope,
  RESULTS_PAGE_SIZE,
  type SearchFilters,
  type SearchProductResult,
} from "@/hooks/useGlobalSearch";
import { useTranslatedList } from "@/hooks/useTranslatedContent";
import { cn } from "@/lib/utils";

const ProductCard = ({ p, onOpen }: { p: SearchProductResult; onOpen: () => void }) => (
  <div className="bg-white rounded-lg overflow-hidden hover:shadow-xl transition duration-300 flex flex-col group border border-gray-100">
    <div className="relative h-56 bg-gray-100 cursor-pointer overflow-hidden" onClick={onOpen}>
      {p.image ? (
        <img
          src={p.image}
          alt={p.name}
          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-300">
          <ShoppingBag className="w-10 h-10" />
        </div>
      )}
    </div>
    <div className="p-4 flex-1 flex flex-col">
      <h3
        className="text-sm font-semibold text-gray-900 line-clamp-2 cursor-pointer hover:text-[#071d7f] transition"
        onClick={onOpen}
      >
        {p.name}
      </h3>
      {p.storeName && <p className="text-xs text-gray-500 mt-1 line-clamp-1">{p.storeName}</p>}
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-lg font-bold text-gray-900">${Number(p.price).toFixed(2)}</span>
        {p.moq ? <span className="text-xs text-gray-500">MOQ {p.moq}</span> : null}
      </div>
      <Button onClick={onOpen} className="w-full mt-4 bg-[#071d7f] hover:bg-[#0a2699]">
        Ver detalles
      </Button>
    </div>
  </div>
);

const SearchResultsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const scope = useSearchScope();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: categories = [] } = usePublicCategories();

  // Image search keeps using navigation state
  const imageState = (location.state || {}) as {
    products?: any[];
    type?: string;
    imageUrl?: string;
    query?: string;
  };
  const sessionImageProducts = useMemo(() => {
    if (searchParams.get("source") !== "image") return null;
    try {
      const raw = sessionStorage.getItem("imageSearchResults");
      return raw ? (JSON.parse(raw) as any[]) : null;
    } catch {
      return null;
    }
  }, [searchParams]);
  const isImageSearch = imageState.type === "image" || !!sessionImageProducts;

  const query = searchParams.get("q") || imageState.query || "";
  const tab = (searchParams.get("tab") || "products") as "products" | "stores" | "categories";
  const categoryId = searchParams.get("cat");
  const minPrice = searchParams.get("min");
  const maxPrice = searchParams.get("max");
  const sort = (searchParams.get("sort") || "relevance") as SearchFilters["sort"];

  const [page, setPage] = useState(0);
  const [accumulated, setAccumulated] = useState<SearchProductResult[]>([]);
  const [minInput, setMinInput] = useState(minPrice || "");
  const [maxInput, setMaxInput] = useState(maxPrice || "");

  const filters: SearchFilters = useMemo(
    () => ({
      categoryId: categoryId || null,
      minPrice: minPrice ? Number(minPrice) : null,
      maxPrice: maxPrice ? Number(maxPrice) : null,
      sort,
    }),
    [categoryId, minPrice, maxPrice, sort]
  );

  useEffect(() => {
    setPage(0);
    setAccumulated([]);
  }, [query, categoryId, minPrice, maxPrice, sort, scope]);

  const { data: productData, isLoading: loadingProducts, isFetching } = useSearchProductsPage(
    query,
    scope,
    filters,
    page
  );
  const { data: stores = [], isLoading: loadingStores } = useSearchStores(query);

  useEffect(() => {
    if (!productData) return;
    setAccumulated((prev) => (page === 0 ? productData.items : [...prev, ...productData.items]));
  }, [productData, page]);

  const matchedCategories = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return categories.filter((c) => c.name.toLowerCase().includes(term));
  }, [categories, query]);

  const products = isImageSearch ? (imageState.products || sessionImageProducts || []) : accumulated;

  // Show product and category names in the current UI language
  const { getTranslated: getTranslatedProduct } = useTranslatedList(
    "product",
    (products as any[]).map((p: any) => ({
      id: p.sourceProductId || p.source_product_id || p.id,
      nombre: p.name || p.nombre,
    })),
    (item) => ({ name: item.nombre })
  );
  const { getTranslated: getTranslatedCategory } = useTranslatedList(
    "category",
    matchedCategories,
    (c) => ({ name: c.name })
  );

  const total = isImageSearch ? products.length : productData?.total ?? 0;
  const hasMore = !isImageSearch && accumulated.length < total && (productData?.items.length ?? 0) > 0;

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const openProduct = (p: any) => navigate(`/producto/${p.sku || p.id}`);

  const tabs = [
    { id: "products", label: "Productos", count: total, icon: ShoppingBag },
    { id: "stores", label: "Tiendas", count: stores.length, icon: StoreIcon },
    { id: "categories", label: "Categorías", count: matchedCategories.length, icon: LayoutGrid },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50">
      {!isMobile && <Header />}
      <main className={cn("container mx-auto px-4 py-8", isMobile && "pb-24")}>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {isImageSearch ? "Resultados de búsqueda visual" : `Resultados para "${query}"`}
          </h1>
          <p className="text-gray-500 mt-1">
            {scope === "b2b" ? "Catálogo mayorista (B2B)" : "Catálogo de tiendas (B2C)"}
          </p>
        </div>

        {imageState.imageUrl && (
          <div className="mb-8 flex items-center gap-4 p-4 bg-white rounded-lg shadow-sm border border-gray-100">
            <div className="w-20 h-20 rounded overflow-hidden border border-gray-200 bg-gray-50">
              <img src={imageState.imageUrl} alt="Búsqueda" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Búsqueda por imagen</p>
              <p className="text-sm text-gray-500">Mostrando productos visualmente similares</p>
            </div>
          </div>
        )}

        {!isImageSearch && (
          <Tabs value={tab} onValueChange={(v) => updateParam("tab", v)} className="mb-6">
            <TabsList>
              {tabs.map((tItem) => (
                <TabsTrigger key={tItem.id} value={tItem.id} className="gap-2">
                  <tItem.icon className="w-4 h-4" />
                  {tItem.label}
                  <span className="text-xs text-gray-500">({tItem.count})</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {tab === "products" || isImageSearch ? (
          <div className="flex gap-6">
            {!isImageSearch && !isMobile && (
              <aside className="w-60 flex-shrink-0 space-y-6">
                <div className="bg-white rounded-lg border border-gray-100 p-4">
                  <p className="font-semibold text-sm mb-3">Ordenar por</p>
                  <div className="space-y-2 text-sm">
                    {[
                      { id: "relevance", label: "Relevancia" },
                      { id: "price_asc", label: "Precio: menor a mayor" },
                      { id: "price_desc", label: "Precio: mayor a menor" },
                      { id: "newest", label: "Más recientes" },
                    ].map((o) => (
                      <button
                        key={o.id}
                        onClick={() => updateParam("sort", o.id === "relevance" ? null : o.id)}
                        className={cn(
                          "block w-full text-left px-2 py-1 rounded hover:bg-gray-50",
                          sort === o.id && "text-[#071d7f] font-medium"
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-100 p-4">
                  <p className="font-semibold text-sm mb-3">Precio</p>
                  <div className="flex items-center gap-2">
                    <Input
                      value={minInput}
                      onChange={(e) => setMinInput(e.target.value)}
                      placeholder="Mín"
                      inputMode="decimal"
                      className="h-8"
                    />
                    <Input
                      value={maxInput}
                      onChange={(e) => setMaxInput(e.target.value)}
                      placeholder="Máx"
                      inputMode="decimal"
                      className="h-8"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-3"
                    onClick={() => {
                      const next = new URLSearchParams(searchParams);
                      minInput ? next.set("min", minInput) : next.delete("min");
                      maxInput ? next.set("max", maxInput) : next.delete("max");
                      setSearchParams(next, { replace: true });
                    }}
                  >
                    Aplicar
                  </Button>
                </div>

                <div className="bg-white rounded-lg border border-gray-100 p-4">
                  <p className="font-semibold text-sm mb-3">Categoría</p>
                  <div className="space-y-1 text-sm max-h-72 overflow-y-auto">
                    <button
                      onClick={() => updateParam("cat", null)}
                      className={cn(
                        "block w-full text-left px-2 py-1 rounded hover:bg-gray-50",
                        !categoryId && "text-[#071d7f] font-medium"
                      )}
                    >
                      Todas
                    </button>
                    {categories
                      .filter((c) => !c.parent_id)
                      .map((c) => (
                        <button
                          key={c.id}
                          onClick={() => updateParam("cat", c.id)}
                          className={cn(
                            "block w-full text-left px-2 py-1 rounded hover:bg-gray-50",
                            categoryId === c.id && "text-[#071d7f] font-medium"
                          )}
                        >
                          {c.name}
                        </button>
                      ))}
                  </div>
                </div>
              </aside>
            )}

            <div className="flex-1">
              {loadingProducts && page === 0 && !isImageSearch ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-80 rounded-lg" />
                  ))}
                </div>
              ) : products.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {products.map((p: any) => (
                      <ProductCard
                        key={p.id || p.sku}
                        p={{
                          id: p.id,
                          sku: p.sku || p.id,
                          name:
                            getTranslatedProduct({
                              id: p.sourceProductId || p.source_product_id || p.id,
                              nombre: p.name || p.nombre,
                            }).name ||
                            p.name ||
                            p.nombre,
                          price: p.price ?? p.precio ?? 0,
                          image: p.image || p.imagen || p.images?.[0] || "",
                          storeName: p.storeName,
                          moq: p.moq,
                        }}
                        onOpen={() => openProduct(p)}
                      />
                    ))}
                  </div>
                  {hasMore && (
                    <div className="flex justify-center mt-8">
                      <Button variant="outline" disabled={isFetching} onClick={() => setPage((x) => x + 1)}>
                        {isFetching ? "Cargando..." : "Cargar más"}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-20 bg-white rounded-lg border border-gray-100">
                  <p className="text-gray-500 text-lg">No se encontraron productos para "{query}".</p>
                  <p className="text-gray-400 text-sm mt-2">Prueba con otras palabras o explora las categorías.</p>
                  <Button variant="outline" className="mt-4" onClick={() => navigate("/categorias")}>
                    Ver categorías
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : tab === "stores" ? (
          loadingStores ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          ) : stores.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {stores.map((s) => (
                <Link
                  key={s.id}
                  to={`/tienda/${s.slug || s.id}`}
                  className="flex items-center gap-4 bg-white p-4 rounded-lg border border-gray-100 hover:shadow-md transition"
                >
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
                    {s.logo ? (
                      <img src={s.logo} alt={s.name} className="w-full h-full object-cover" />
                    ) : (
                      <StoreIcon className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 line-clamp-1">{s.name}</p>
                    <p className="text-sm text-gray-500 line-clamp-1">{s.description || "Ver tienda"}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-lg border border-gray-100 text-gray-500">
              No se encontraron tiendas para "{query}".
            </div>
          )
        ) : matchedCategories.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {matchedCategories.map((c) => (
              <Link
                key={c.id}
                to={`/categoria/${c.slug}`}
                className="bg-white p-4 rounded-lg border border-gray-100 hover:shadow-md transition text-center"
              >
                <LayoutGrid className="w-6 h-6 mx-auto text-[#071d7f]" />
                <p className="mt-2 font-medium text-gray-900 text-sm line-clamp-2">{getTranslatedCategory(c).name || c.name}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-lg border border-gray-100 text-gray-500">
            No se encontraron categorías para "{query}".
          </div>
        )}
      </main>
      {!isMobile && <Footer />}
    </div>
  );
};

export default SearchResultsPage;
