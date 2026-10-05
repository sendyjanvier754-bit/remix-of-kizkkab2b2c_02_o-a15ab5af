import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Mail, Search, Heart, X, Loader2, Mic, MicOff, Camera, ShoppingBag, User, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCategories } from "@/hooks/useCategories";
import { useTranslation } from "react-i18next";

import { supabase } from "@/integrations/supabase/client";
import { useB2BCartItems } from "@/hooks/useB2BCartItems";
import { useViewMode } from "@/contexts/ViewModeContext";
import { useHeaderSearchController } from "@/hooks/useHeaderSearchController";

interface SearchResult {
  id: string;
  nombre: string;
  sku_interno: string;
  imagen_principal: string | null;
  precio_b2b: number;
  descripcion_corta?: string;
}

interface SellerMobileHeaderProps {
  selectedCategoryId: string | null;
  onCategorySelect: (categoryId: string | null) => void;
  onSearch?: (query: string) => void;
}

const SellerMobileHeader = ({ 
  selectedCategoryId, 
  onCategorySelect,
  onSearch 
}: SellerMobileHeaderProps) => {
  const { t } = useTranslation();
  const {
    searchQuery, setSearchQuery, submitSearch, clearSearch: clearSearchQuery,
    startVoiceSearch, isListening, voiceSupported,
    handleImageSearch, isImageSearching, imageInputRef,
  } = useHeaderSearchController({
    onSubmit: (term) => { setShowResults(false); onSearch?.(term); },
    imageSearchPath: '/seller/adquisicion-lotes?source=image',
  });
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [cartBounce, setCartBounce] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const prevCartCountRef = useRef<number>(0);
  const navigate = useNavigate();
  const location = useLocation();
  
  const { data: categories = [] } = useCategories();
  const { items: cartItems } = useB2BCartItems();
  const cartCount = cartItems.reduce((sum, item) => sum + item.cantidad, 0);

  // Bounce animation when cart count increases
  useEffect(() => {
    if (cartCount > prevCartCountRef.current && prevCartCountRef.current !== 0) {
      setCartBounce(true);
      const timer = setTimeout(() => setCartBounce(false), 400);
      return () => clearTimeout(timer);
    }
    prevCartCountRef.current = cartCount;
  }, [cartCount]);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Real-time search
  useEffect(() => {
    const searchProducts = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      setIsSearching(true);
      try {
        const { data, error } = await supabase
          .from("v_productos_con_precio_b2b")
          .select("id, nombre, sku_interno, imagen_principal, precio_b2b, descripcion_corta")
          .eq("is_active", true)
          .or(`nombre.ilike.%${searchQuery}%,sku_interno.ilike.%${searchQuery}%,descripcion_corta.ilike.%${searchQuery}%`)
          .limit(8);

        if (error) throw error;
        setSearchResults(data || []);
        setShowResults(true);
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchProducts, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  // Header shown on all screen sizes

  // Get root categories (no parent)
  const rootCategories = categories.filter((c) => !c.parent_id);

  const handleCategoryClick = (categoryId: string | null) => {
    if (location.pathname !== '/seller/adquisicion-lotes') {
      navigate('/seller/adquisicion-lotes', { state: { selectedCategory: categoryId } });
    } else {
      onCategorySelect(categoryId);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) submitSearch();
  };

  const handleResultClick = (productId: string) => {
    setShowResults(false);
    setSearchQuery("");
    // Scroll to the product or filter by it
    if (onSearch) {
      const product = searchResults.find(p => p.id === productId);
      if (product) {
        onSearch(product.nombre);
      }
    }
  };

  const clearSearch = () => {
    clearSearchQuery();
    setSearchResults([]);
    setShowResults(false);
    if (onSearch) {
      onSearch("");
    }
  };

  return (
    <header className="bg-[#ffdcdc] sticky top-0 z-40">
      {/* Top search bar */}
      <div className="flex items-center gap-2 px-2 py-2">
        {/* Support Chat */}
        <Link to="/admin/soporte-chat" className="relative flex-shrink-0">
          <Mail className="w-5 h-5 text-gray-700" strokeWidth={1.5} />
        </Link>

        {/* Search input with dropdown */}
        <div ref={searchRef} className="flex-1 relative min-w-0">
          <form onSubmit={handleSearch} className="flex items-center bg-gray-100 rounded-full border border-gray-200 overflow-hidden">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
              className="flex-1 bg-transparent text-sm text-gray-700 px-3 py-2 outline-none min-w-0"
            />
            {searchQuery && (
              <button type="button" onClick={clearSearch} className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            )}
            {/* Camera/Image search button */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleImageSearch}
            />
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={isImageSearching}
              className="p-1 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {isImageSearching ? (
                <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} />
              ) : (
                <Camera className="w-5 h-5" strokeWidth={1.5} />
              )}
            </button>
            {/* Voice search button */}
            {voiceSupported && (
              <button 
                type="button" 
                onClick={startVoiceSearch}
                className={cn(
                  "p-1 transition-colors flex-shrink-0",
                  isListening 
                    ? "text-[#071d7f] animate-pulse" 
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {isListening ? (
                  <MicOff className="w-5 h-5" strokeWidth={1.5} />
                ) : (
                  <Mic className="w-5 h-5" strokeWidth={1.5} />
                )}
              </button>
            )}
          </form>

          {/* Search results dropdown */}
          {showResults && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-80 overflow-y-auto z-50">
              {searchResults.length > 0 ? (
                <>
                  {searchResults.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleResultClick(product.id)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        {product.imagen_principal ? (
                          <img
                            src={product.imagen_principal}
                            alt={product.nombre}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                            {t('common.noImage')}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-gray-900 line-clamp-1">{product.nombre}</p>
                        <p className="text-sm font-bold text-green-600">${product.precio_b2b?.toFixed(2) || '0.00'}</p>
                      </div>
                    </button>
                  ))}
                  <button
                    onClick={handleSearch}
                    className="w-full p-3 text-center text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    {t('common.seeAllResults', { query: searchQuery })}
                  </button>
                </>
              ) : (
                <div className="p-4 text-center text-gray-500 text-sm">
                  {t('common.noProductsFor', { query: searchQuery })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Vista Cliente Toggle */}
        <ViewModeToggle />

        {/* Account User */}
        <Link to="/seller/cuenta" className="relative flex-shrink-0">
          <User className="w-5 h-5 text-gray-700" strokeWidth={1.5} />
        </Link>


        {/* Favorites heart */}
        <Link to="/seller/favoritos" className="relative flex-shrink-0">
          <Heart className="w-5 h-5 text-gray-700" strokeWidth={1.5} />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#071d7f] rounded-full border border-white" />
        </Link>

      </div>

      {/* Category tabs - horizontal scroll with black background */}
      <div className="flex items-center gap-2 px-2 py-2 overflow-x-auto scrollbar-hide bg-[#071d7f]">
        {/* "All" tab */}
        <button
          onClick={() => handleCategoryClick(null)}
          className={cn(
            "text-sm font-medium whitespace-nowrap pb-0.5 transition-colors",
            selectedCategoryId === null
              ? "text-white border-b-2 border-white" 
              : "text-gray-400 hover:text-white"
          )}
        >
          {t('header.allCategories')}
        </button>

        {rootCategories.map((category) => (
          <button
            key={category.id}
            onClick={() => handleCategoryClick(category.id)}
            className={cn(
              "text-sm font-medium whitespace-nowrap pb-0.5 transition-colors",
              selectedCategoryId === category.id 
                ? "text-white border-b-2 border-white" 
                : "text-gray-400 hover:text-white"
            )}
          >
            {category.name}
          </button>
        ))}
      </div>
    </header>
  );
};

const ViewModeToggle = () => {
  const { isClientPreview, toggleViewMode, canToggle } = useViewMode();
  const { t } = useTranslation();
  if (!canToggle) return null;
  return (
    <button
      onClick={toggleViewMode}
      className={cn(
        "flex-shrink-0 p-1 rounded-full transition-colors",
        isClientPreview ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
      )}
      title={isClientPreview ? t('header.backToB2B') : t('header.viewAsClient')}
    >
      {isClientPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );
};

export default SellerMobileHeader;
