import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Mail, Search, Heart, X, Loader2, Mic, MicOff, Camera, ShoppingBag, Package, Eye, EyeOff, User, Home, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "@/i18n";
import { cn } from "@/lib/utils";
import { usePublicCategories } from "@/hooks/useCategories";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { searchProductsByImage } from "@/services/api/imageSearch";
import { useB2CCartItems } from "@/hooks/useB2CCartItems";
import { useB2BCartItems } from "@/hooks/useB2BCartItems";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types/auth";
import { useViewMode } from "@/contexts/ViewModeContext";

interface SearchResult {
  id: string;
  nombre: string;
  sku_interno: string;
  imagen_principal: string | null;
  precio_b2b: number;
  descripcion_corta?: string;
}

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event & { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface GlobalMobileHeaderProps {
  forceShow?: boolean;
}

const GlobalMobileHeader = ({ forceShow = false }: GlobalMobileHeaderProps) => {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [isImageSearching, setIsImageSearching] = useState(false);
  const [cartBounce, setCartBounce] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const prevCartCountRef = useRef<number>(0);
  const langRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { data: categories = [] } = usePublicCategories();
  const { items: b2cItems } = useB2CCartItems();
  const { items: b2bItems } = useB2BCartItems();
  const { role, user } = useAuth();
  const { isClientPreview, toggleViewMode, canToggle } = useViewMode();

  // Determine which cart to use
  const isB2B = role === UserRole.SELLER || role === UserRole.ADMIN;
  const cartItems = isB2B && !isClientPreview ? b2bItems : b2cItems;
  const cartCount = cartItems.reduce((sum, item) => sum + ('quantity' in item ? item.quantity : item.cantidad), 0);

  const isSellerOrAdmin = role === UserRole.SELLER || role === UserRole.ADMIN;
  const showAsClient = isSellerOrAdmin && isClientPreview;

  // Language menu close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setShowLangMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language) || SUPPORTED_LANGUAGES[0];

  // Bounce animation when cart count increases
  useEffect(() => {
    if (cartCount > prevCartCountRef.current && prevCartCountRef.current !== 0) {
      setCartBounce(true);
      const timer = setTimeout(() => setCartBounce(false), 400);
      return () => clearTimeout(timer);
    }
    prevCartCountRef.current = cartCount;
  }, [cartCount]);

  const isAdminRoute = location.pathname.startsWith('/admin');
  const isSellerRoute = location.pathname.startsWith('/seller');
  const isLoginRoute = location.pathname === '/login';
  const isTrendsRoute = location.pathname === '/tendencias';

  // Check for Web Speech API support
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoiceSupported(!!SpeechRecognitionAPI);
  }, []);

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

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
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

  if (!isMobile) return null;

  if (role) {
    if (isAdminRoute || isLoginRoute || isTrendsRoute || (isSellerRoute && !forceShow)) {
      return null;
    }
  }

  const rootCategories = categories.filter(c => !c.parent_id);

  const isCategoriesPage = location.pathname === '/categorias';
  const categorySlug = location.pathname.startsWith('/categoria/') ? location.pathname.split('/categoria/')[1] : null;
  const urlParams = new URLSearchParams(location.search);
  const selectedCatParam = urlParams.get('cat');
  const selectedCategory = isCategoriesPage
    ? selectedCatParam || null
    : categorySlug
      ? categories.find(c => c.slug === categorySlug)?.id || null
      : undefined;

  const handleCategorySelect = (categoryId: string | null) => {
    if (categoryId === null) {
      navigate('/categorias');
      return;
    }
    navigate(`/categorias?cat=${categoryId}`);
  };

  const handleClearFilters = () => {
    navigate('/categorias', { replace: true });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowResults(false);
      navigate(`/productos?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleResultClick = (sku: string) => {
    setShowResults(false);
    setSearchQuery("");
    navigate(`/producto/${sku}`);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setShowResults(false);
  };

  const startVoiceSearch = () => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      toast.error(t('header.voiceNotSupported'));
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = i18n.language === 'en' ? 'en-US' : i18n.language === 'fr' ? 'fr-FR' : i18n.language === 'ht' ? 'fr-HT' : 'es-ES';

    recognition.onstart = () => {
      setIsListening(true);
      toast.info(t('header.listening'), { duration: 2000 });
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      if (interimTranscript) setSearchQuery(interimTranscript);
      if (finalTranscript) {
        setSearchQuery(finalTranscript);
        toast.success(t('header.searching', { query: finalTranscript }));
        navigate(`/productos?q=${encodeURIComponent(finalTranscript.trim())}`);
      }
    };

    recognition.onerror = event => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      if (event.error === 'no-speech') toast.error(t('header.noSpeech'));
      else if (event.error === 'audio-capture') toast.error(t('header.noMicrophone'));
      else if (event.error === 'not-allowed') toast.error(t('header.micDenied'));
      else toast.error(t('header.voiceError'));
    };

    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleImageSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImageSearching(true);
    toast.info(t('header.loadingAI'));
    try {
      const results = await searchProductsByImage(file);
      if (results && results.length > 0) {
        sessionStorage.setItem('imageSearchResults', JSON.stringify(results));
        navigate('/productos?source=image');
        toast.success(t('header.similarFound', { count: results.length }));
      } else {
        toast.info(t('header.noSimilarFound'));
      }
    } catch (error) {
      console.error("Image search error:", error);
      toast.error(t('header.imageSearchError'));
    } finally {
      setIsImageSearching(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const showB2BStyle = isSellerOrAdmin && !showAsClient;
  const favoritesLink = showB2BStyle ? "/seller/favoritos" : "/favoritos";
  const cartLink = showB2BStyle ? "/seller/carrito" : "/carrito";
  const accountLink = role === UserRole.SELLER ? "/seller/cuenta" :
                      role === UserRole.ADMIN ? "/admin/dashboard" :
                      "/cuenta";
  const accentColor = showB2BStyle ? "bg-blue-600" : "bg-[#071d7f]";
  const buttonColor = showB2BStyle ? "bg-blue-600 hover:bg-blue-700" : "bg-[#071d7f] hover:bg-[#071d7f]/90";

  return (
    <header className="bg-[#ffdcdc] sticky top-0 z-40">
      {/* Top search bar */}
      <div className="flex items-center gap-2 sm:gap-4 px-2 sm:px-4 py-2 bg-[#fff3f3]">
        <button
          type="button"
          className="relative flex-shrink-0 bg-transparent border-0 p-0 cursor-pointer"
          onClick={(e) => {
            e.preventDefault();
            if (user) {
              navigate('/soporte');
            } else {
              sessionStorage.setItem('post_login_redirect', '/soporte');
              navigate('/cuenta');
            }
          }}
          aria-label={t('header.support')}
        >
          <Mail className="w-6 h-6 sm:w-7 sm:h-7 text-gray-700" strokeWidth={1.5} />
        </button>

        {/* Search input with dropdown */}
        <div ref={searchRef} className="flex-1 relative min-w-0">
          <form onSubmit={handleSearch} className="flex items-center bg-gray-100 rounded-full border border-gray-200 overflow-hidden">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
              className="flex-1 bg-transparent text-sm sm:text-base text-gray-700 px-3 sm:px-4 py-2 sm:py-2.5 outline-none min-w-0"
              placeholder={t('header.searchProducts')}
            />
            {searchQuery && (
              <button type="button" onClick={clearSearch} className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            )}
            <input ref={imageInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageSearch} />
            <button type="button" onClick={() => imageInputRef.current?.click()} disabled={isImageSearching} className="p-1 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50 flex-shrink-0">
              {isImageSearching ? <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} /> : <Camera className="w-5 h-5" strokeWidth={1.5} />}
            </button>
            {voiceSupported && (
              <button type="button" onClick={startVoiceSearch} className={cn("p-1 transition-colors flex-shrink-0", isListening ? "text-[#071d7f] animate-pulse" : "text-gray-500 hover:text-gray-700")}>
                {isListening ? <MicOff className="w-5 h-5" strokeWidth={1.5} /> : <Mic className="w-5 h-5" strokeWidth={1.5} />}
              </button>
            )}
          </form>

          {/* Search results dropdown */}
          {showResults && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-80 overflow-y-auto z-50">
              {searchResults.length > 0 ? (
                <>
                  {searchResults.map(product => (
                    <button key={product.id} onClick={() => handleResultClick(product.sku_interno)} className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        {product.imagen_principal ? (
                          <img src={product.imagen_principal} alt={product.nombre} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">{t('common.noImage')}</div>
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-gray-900 line-clamp-1">{product.nombre}</p>
                        <p className="text-xs text-gray-500">SKU: {product.sku_interno}</p>
                        <p className={cn("text-sm font-bold", isSellerOrAdmin ? "text-blue-600" : "text-green-600")}>
                          ${product.precio_b2b?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                    </button>
                  ))}
                  <button onClick={handleSearch} className="w-full p-3 text-center text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors">
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

        {/* Vista Cliente Toggle for sellers */}
        {canToggle && (
          <button
            onClick={toggleViewMode}
            className={cn(
              "flex-shrink-0 p-1 rounded-full transition-colors",
              isClientPreview ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
            )}
          >
            {isClientPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}

        

        {/* Language Selector */}
        <div ref={langRef} className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="flex items-center gap-0.5 text-xs text-gray-700 hover:text-gray-900 transition-colors"
          >
            <span className="text-sm">{currentLang.flag}</span>
          </button>
          {showLangMenu && (
            <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-[130px]">
              {SUPPORTED_LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => { i18n.changeLanguage(lang.code); setShowLangMenu(false); }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors",
                    i18n.language === lang.code ? "font-semibold text-primary bg-primary/5" : "text-gray-700"
                  )}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Account User */}
        {(user && (role === UserRole.SELLER || role === UserRole.ADMIN)) && (
          <Link to={accountLink} className="relative flex-shrink-0">
            <User className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" strokeWidth={1.5} />
          </Link>
        )}

        {/* Favorites heart */}
        <Link to={favoritesLink} className="relative flex-shrink-0">
          <Heart className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" strokeWidth={1.5} />
          <span className={cn("absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-white", accentColor)} />
        </Link>
      </div>

      {/* Category tabs */}
      <div className="border-b border-gray-200 bg-[#071d7f] overflow-hidden" style={{ overscrollBehavior: 'none' }}>
        <div
          className="overflow-x-auto overflow-y-hidden scrollbar-hide w-full flex"
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            touchAction: 'pan-x pinch-zoom',
            msOverflowStyle: 'none'
          }}
          onWheel={(e) => {
            const element = e.currentTarget;
            if (element.scrollWidth > element.clientWidth) {
              e.preventDefault();
              element.scrollLeft += (e.deltaY > 0 ? 50 : -50);
            }
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => navigate("/")}
            className="flex-shrink-0 px-1.5 py-2 text-white hover:bg-white/20 rounded-none transition-all flex items-center justify-center text-xs"
            title={t('nav.home')}
          >
            <Home className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleClearFilters()}
            className={cn(
              "flex-shrink-0 px-1.5 py-2 text-xs rounded-none whitespace-nowrap transition-all text-center",
              selectedCategory === null
                ? "bg-white/20 text-white font-medium"
                : "text-white/80 hover:bg-white/10"
            )}
          >
            {t('header.allCategories')}
          </button>
          {rootCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategorySelect(cat.id)}
              className={cn(
                "flex-shrink-0 px-1.5 py-2 text-xs rounded-none whitespace-nowrap transition-all text-center",
                selectedCategory === cat.id
                  ? "bg-white/20 text-white font-medium"
                  : "text-white/80 hover:bg-white/10"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};

export default GlobalMobileHeader;
