import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingBag, Search, Heart, User, Camera, Loader2, Mic, MicOff, X, Flame, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCategories } from "@/hooks/useCategories";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { searchProductsByImage } from "@/services/api/imageSearch";
import { useTranslation } from "react-i18next";

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

interface SellerDesktopHeaderProps {
  selectedCategoryId: string | null;
  onCategorySelect: (categoryId: string | null) => void;
  onSearch?: (query: string) => void;
}

const SellerDesktopHeader = ({
  selectedCategoryId,
  onCategorySelect,
  onSearch
}: SellerDesktopHeaderProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [isImageSearching, setIsImageSearching] = useState(false);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const catBarRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  const [hasOverflow, setHasOverflow] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);

  const { data: categories = [] } = useCategories();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Root categories
  const rootCategories = categories.filter((c) => !c.parent_id);

  // Check for Web Speech API support
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoiceSupported(!!SpeechRecognitionAPI);
  }, []);

  // Check category bar overflow
  useEffect(() => {
    const el = catBarRef.current;
    if (!el) return;
    const check = () => setHasOverflow(el.scrollWidth > el.clientWidth + 4);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [categories]);

  // Track header height
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => setHeaderHeight(el.offsetHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
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

  const scrollHeader = (dir: number) => {
    const el = catBarRef.current;
    if (!el) return;
    const amount = Math.max(el.clientWidth * 0.5, 240);
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim() && onSearch) {
      setShowResults(false);
      onSearch(searchQuery.trim());
    }
  };

  const handleResultClick = (productId: string) => {
    setShowResults(false);
    const product = searchResults.find(p => p.id === productId);
    if (product && onSearch) {
      onSearch(product.nombre);
    }
    setSearchQuery("");
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setShowResults(false);
    if (onSearch) {
      onSearch("");
    }
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
    recognition.lang = 'es-ES';

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

      if (interimTranscript) {
        setSearchQuery(interimTranscript);
      }

      if (finalTranscript) {
        setSearchQuery(finalTranscript);
        toast.success(t('header.searching', { query: finalTranscript }));
        if (onSearch) {
          onSearch(finalTranscript.trim());
        }
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      
      if (event.error === 'no-speech') {
        toast.error("No se detectó ninguna voz. Intenta de nuevo.");
      } else if (event.error === 'audio-capture') {
        toast.error("No se pudo acceder al micrófono.");
      } else if (event.error === 'not-allowed') {
        toast.error("Permiso de micrófono denegado.");
      } else {
        toast.error("Error al reconocer voz. Intenta de nuevo.");
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleImageSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImageSearching(true);
    toast.info("Cargando modelo de IA... Esto puede tomar unos segundos la primera vez.");

    try {
      const results = await searchProductsByImage(file);
      if (results && results.length > 0) {
        sessionStorage.setItem('imageSearchResults', JSON.stringify(results));
        navigate('/seller/adquisicion-lotes?source=image');
        toast.success(`Se encontraron ${results.length} productos similares`);
      } else {
        toast.info("No se encontraron productos similares");
      }
    } catch (error) {
      console.error("Image search error:", error);
      toast.error("Error al buscar por imagen");
    } finally {
      setIsImageSearching(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <header ref={headerRef} className="fixed top-0 left-0 right-0 z-50 bg-[#ffdcdc] border-b border-gray-200">
        {/* Top Bar */}
        <div className="bg-gray-50 border-b border-gray-200 hidden md:block">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-8 text-xs text-gray-600">
              <div className="flex items-center gap-4">
                <span className="cursor-pointer hover:text-[#071d7f] transition-colors">Envío desde el extranjero</span>
                <Link to="/tendencias" className="flex items-center gap-1 hover:text-[#071d7f] transition-colors">
                  <Flame className="w-3 h-3" />
                  Tendencias
                </Link>
                <span className="cursor-pointer hover:text-[#071d7f] transition-colors">Devolución Gratis</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="cursor-pointer hover:text-[#071d7f] transition-colors">Centro de Ayuda</span>
                <span className="cursor-pointer hover:text-[#071d7f] transition-colors">Vender</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Header */}
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/seller/adquisicion-lotes" className="flex items-center gap-2 flex-shrink-0">
              <div className="w-10 h-10 rounded bg-[#071d7f] flex items-center justify-center">
                <ShoppingBag className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-2xl text-gray-900 tracking-tight">SIVER</span>
            </Link>

            {/* Search Bar */}
            <div ref={searchRef} className="flex-1 mx-8 max-w-2xl relative">
              <form onSubmit={handleSearch} className="relative w-full flex items-center">
                <Input
                  type="text"
                  placeholder="Buscar productos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
                  className="pl-4 pr-28 py-2.5 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#071d7f] bg-gray-50 hover:bg-white transition-colors"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                  {searchQuery && (
                    <button type="button" onClick={clearSearch} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {/* Camera/Image search button */}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageSearch}
                  />
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isImageSearching}
                    className="text-gray-400 hover:text-[#071d7f] transition-colors disabled:opacity-50"
                  >
                    {isImageSearching ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Camera className="w-5 h-5" />
                    )}
                  </button>
                  {voiceSupported && (
                    <button
                      type="button"
                      onClick={startVoiceSearch}
                      className={cn(
                        "transition-colors",
                        isListening 
                          ? "text-[#071d7f] animate-pulse" 
                          : "text-gray-400 hover:text-[#071d7f]"
                      )}
                    >
                      {isListening ? (
                        <MicOff className="w-5 h-5" />
                      ) : (
                        <Mic className="w-5 h-5" />
                      )}
                    </button>
                  )}
                  <button type="submit" className="text-gray-400 hover:text-[#071d7f]">
                    {isSearching ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Search className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </form>

              {/* Search Results Dropdown */}
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
                                Sin img
                              </div>
                            )}
                          </div>
                          <div className="flex-1 text-left">
                            <p className="text-sm font-medium text-gray-900 line-clamp-1">{product.nombre}</p>
                            <p className="text-xs text-gray-500">SKU: {product.sku_interno}</p>
                            <p className="text-sm font-bold text-green-600">${product.precio_b2b?.toFixed(2) || '0.00'}</p>
                          </div>
                        </button>
                      ))}
                      <button
                        onClick={handleSearch}
                        className="w-full p-3 text-center text-sm font-medium text-green-600 hover:bg-green-50 transition-colors"
                      >
                        Ver todos los resultados para "{searchQuery}"
                      </button>
                    </>
                  ) : (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No se encontraron productos para "{searchQuery}"
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Desktop Actions */}
            <div className="flex items-center gap-6">
              <Link to="/tendencias" className="flex flex-col items-center gap-1 text-gray-700 hover:text-[#071d7f] transition">
                <Flame className="w-6 h-6" />
                <span className="text-xs">Tendencias</span>
              </Link>
              <Link to="/admin/soporte-chat" className="flex flex-col items-center gap-1 text-gray-700 hover:text-[#071d7f] transition">
                <MessageCircle className="w-6 h-6" />
                <span className="text-xs">Soporte</span>
              </Link>
              <Link to="/seller/favoritos" className="flex flex-col items-center gap-1 text-gray-700 hover:text-[#071d7f] transition">
                <Heart className="w-6 h-6" />
                <span className="text-xs">Favoritos</span>
              </Link>
              <Link to="/seller/cuenta" className="flex flex-col items-center gap-1 text-gray-700 hover:text-[#071d7f] transition">
                <User className="w-6 h-6" />
                <span className="text-xs">Cuenta</span>
              </Link>
              <Link to="/seller/carrito" className="flex flex-col items-center gap-1 text-gray-700 hover:text-[#071d7f] transition">
                <ShoppingBag className="w-6 h-6" />
                <span className="text-xs">Carrito</span>
              </Link>
            </div>
          </div>

          {/* Categories Bar */}
          <div className="border-t border-gray-200 relative">
            <div 
              ref={catBarRef} 
              className="flex items-center gap-0 h-12 overflow-hidden whitespace-nowrap pl-12 pr-12"
            >
              {/* All categories button */}
              <button
                type="button"
                onClick={() => onCategorySelect(null)}
                className={cn(
                  "px-4 py-3 text-sm font-medium transition whitespace-nowrap flex items-center gap-2 border-b-2",
                  selectedCategoryId === null
                    ? "text-[#071d7f] border-[#071d7f] bg-[#071d7f]/5"
                    : "text-gray-700 hover:text-[#071d7f] hover:bg-gray-50 border-transparent"
                )}
              >
                Todos
              </button>

              {rootCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onCategorySelect(cat.id)}
                  className={cn(
                    "px-4 py-3 text-sm font-medium transition whitespace-nowrap flex items-center gap-2 border-b-2",
                    selectedCategoryId === cat.id
                      ? "text-[#071d7f] border-[#071d7f] bg-[#071d7f]/5"
                      : "text-gray-700 hover:text-[#071d7f] hover:bg-gray-50 border-transparent"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Scroll buttons */}
            {hasOverflow && (
              <>
                <button
                  aria-label="scroll left"
                  onClick={() => scrollHeader(-1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-50"
                >
                  <div className="w-6 h-6 bg-gray-200 border-2 border-black rounded flex items-center justify-center shadow-sm">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-black">
                      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </button>
                <button
                  aria-label="scroll right"
                  onClick={() => scrollHeader(1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-50"
                >
                  <div className="w-6 h-6 bg-gray-200 border-2 border-black rounded flex items-center justify-center shadow-sm">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-black">
                      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Spacer */}
      <div aria-hidden style={{ height: headerHeight }} />
    </>
  );
};

export default SellerDesktopHeader;
