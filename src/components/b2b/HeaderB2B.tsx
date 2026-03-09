import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingBag, Search, Heart, User, Camera, Loader2, Mic, MicOff, Package, Clock, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePublicCategories } from "@/hooks/useCategories";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useB2BCartItems } from "@/hooks/useB2BCartItems";
import { searchProductsByImage } from "@/services/api/imageSearch";
import { toast } from "sonner";
import { useViewMode } from "@/contexts/ViewModeContext";
import { useBranding } from "@/hooks/useBranding";
const SEARCH_HISTORY_KEY = 'b2b_search_history';
const MAX_HISTORY_ITEMS = 8;

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
  onerror: ((event: Event & {
    error: string;
  }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}
interface HeaderB2BProps {
  selectedCategoryId?: string | null;
  onCategorySelect?: (categoryId: string | null) => void;
  onSearch?: (query: string) => void;
}

// Componente interno para el switch de vista
const ViewModeSwitch = () => {
  const {
    toggleViewMode,
    canToggle
  } = useViewMode();
  if (!canToggle) return null;
  return <button onClick={toggleViewMode} className="flex flex-col items-center gap-1 text-amber-600 hover:text-amber-700 transition" title="Ver como cliente">
      
      
    </button>;
};
const HeaderB2B = ({
  selectedCategoryId = null,
  onCategorySelect,
  onSearch
}: HeaderB2BProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [isImageSearching, setIsImageSearching] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const isMobile = useIsMobile();
  const { getValue } = useBranding();
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const {
    items: cartItems
  } = useB2BCartItems();
  const cartCount = cartItems.reduce((sum, item) => sum + item.cantidad, 0);
  const {
    data: categories = [],
    isLoading: categoriesLoading
  } = usePublicCategories();
  const navigate = useNavigate();
  const catBarRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  // Load search history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (stored) {
        setSearchHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Error loading search history:', e);
    }
  }, []);

  // Close history dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoiceSupported(!!SpeechRecognitionAPI);
  }, []);
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);
  useEffect(() => {
    const el = catBarRef.current;
    if (!el) return;
    const check = () => setHasOverflow(el.scrollWidth > el.clientWidth + 4);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [categories]);
  const saveToHistory = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return;
    try {
      const newHistory = [trimmed, ...searchHistory.filter(h => h.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_HISTORY_ITEMS);
      setSearchHistory(newHistory);
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
    } catch (e) {
      console.error('Error saving search history:', e);
    }
  };
  const removeFromHistory = (query: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const newHistory = searchHistory.filter(h => h !== query);
      setSearchHistory(newHistory);
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
    } catch (e) {
      console.error('Error removing from search history:', e);
    }
  };
  const clearHistory = () => {
    try {
      setSearchHistory([]);
      localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (e) {
      console.error('Error clearing search history:', e);
    }
  };
  const scrollHeader = (dir: number) => {
    const el = catBarRef.current;
    if (!el) return;
    const amount = Math.max(el.clientWidth * 0.5, 240);
    el.scrollBy({
      left: dir * amount,
      behavior: "smooth"
    });
  };
  const rootCategories = categories.filter(c => !c.parent_id);
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      saveToHistory(searchQuery);
      onSearch?.(searchQuery);
      setShowHistory(false);
    }
  };
  const handleHistoryClick = (query: string) => {
    setSearchQuery(query);
    saveToHistory(query);
    onSearch?.(query);
    setShowHistory(false);
  };
  const handleCategoryClick = (categoryId: string | null) => {
    onCategorySelect?.(categoryId);
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
  const startVoiceSearch = () => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      toast.error("Búsqueda por voz no soportada en este navegador");
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
      toast.info("Escuchando...", {
        duration: 2000
      });
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
        saveToHistory(finalTranscript);
        toast.success(`Buscando: "${finalTranscript}"`);
        onSearch?.(finalTranscript);
      }
    };
    recognition.onerror = event => {
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
  const filteredHistory = searchQuery.trim() ? searchHistory.filter(h => h.toLowerCase().includes(searchQuery.toLowerCase())) : searchHistory;
  if (isMobile) {
    return <>
        <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100">
          <div className="flex items-center justify-between gap-1 px-2 py-1">
            {/* Logo */}
            <Link to="/seller/catalogo" className="flex items-center gap-1.5 flex-shrink-0">
              <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center">
                <Package className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-sm text-gray-900">B2B</span>
            </Link>

            {/* Search input with history */}
            <div ref={searchContainerRef} className="flex-1 relative max-w-[48%]">
              <form onSubmit={handleSearch} className="flex items-center bg-gray-100 rounded-full border border-gray-200 overflow-hidden">
                {/* Voice search button */}
                <button type="button" onClick={voiceSupported ? startVoiceSearch : undefined} disabled={!voiceSupported} className={cn("p-1 transition-colors", !voiceSupported && "opacity-50 cursor-not-allowed", isListening ? "text-red-500 animate-pulse" : "text-gray-500 hover:text-blue-600")}>
                  {isListening ? <MicOff className="w-5 h-5" strokeWidth={1.5} /> : <Mic className="w-5 h-5" strokeWidth={1.5} />}
                </button>
                <input type="text" placeholder="" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onFocus={() => setShowHistory(true)} className="flex-1 min-w-0 bg-transparent text-sm text-gray-700 placeholder-gray-500 px-1 py-0.5 outline-none" />
                {/* Hidden file input for image search */}
                <input ref={imageInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageSearch} />
                {/* Camera icon for image search */}
                <button type="button" onClick={() => imageInputRef.current?.click()} disabled={isImageSearching} className="p-1 text-gray-500 hover:text-blue-600 transition-colors disabled:opacity-50">
                  {isImageSearching ? <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} /> : <Camera className="w-5 h-5" strokeWidth={1.5} />}
                </button>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 p-2 rounded-full m-0.5 transition-colors">
                  <Search className="w-4 h-4 text-white" strokeWidth={2} />
                </button>
              </form>

              {/* Search History Dropdown - Mobile */}
              {showHistory && filteredHistory.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                    <span className="text-xs font-medium text-gray-500">Búsquedas recientes</span>
                    <button onClick={clearHistory} className="text-xs text-blue-600 hover:text-blue-700">
                      Limpiar
                    </button>
                  </div>
                  {filteredHistory.map((query, index) => <button key={index} onClick={() => handleHistoryClick(query)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors text-left">
                      <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-700 flex-1 truncate">{query}</span>
                      <button onClick={e => removeFromHistory(query, e)} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-3 h-3 text-gray-400" />
                      </button>
                    </button>)}
                </div>}
            </div>

            {/* Account Link */}
            <Link to="/seller/cuenta" className="flex-shrink-0 p-1">
              <User className="w-6 h-6 text-gray-700" strokeWidth={1.5} />
            </Link>

            {/* Cart */}
            <Link to="/seller/carrito" className="relative flex-shrink-0">
              <ShoppingBag className="w-6 h-6 text-gray-700" strokeWidth={1.5} />
              {cartCount > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>}
            </Link>
          </div>

          {/* Categories Filter Bar */}
          <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto bg-gray-900 text-white scrollbar-hide">
            <button onClick={() => handleCategoryClick(null)} className={cn("whitespace-nowrap text-sm font-medium px-3 py-1 rounded-full transition-colors", selectedCategoryId === null ? "bg-blue-600 text-white" : "bg-gray-800 hover:bg-gray-700 text-gray-300")}>
              Todos
            </button>
            {rootCategories.map(cat => <button key={cat.id} onClick={() => handleCategoryClick(cat.id)} className={cn("whitespace-nowrap text-sm font-medium px-3 py-1 rounded-full transition-colors", selectedCategoryId === cat.id ? "bg-blue-600 text-white" : "bg-gray-800 hover:bg-gray-700 text-gray-300")}>
                {cat.name}
              </button>)}
          </div>
        </header>
        <div className="h-[108px]" />
      </>;
  }

  // Desktop Header
  return <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
        {/* Top Bar */}
        <div className="bg-blue-600 text-white">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-10 text-xs">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Package className="w-3.5 h-3.5" />
                  Catálogo Mayorista B2B
                </span>
                <span>Precios exclusivos para revendedores</span>
              </div>
              <div className="flex items-center gap-4">
                <Link to="/seller/cuenta" className="hover:underline">Mi Cuenta</Link>
                <Link to="/seller/pedidos" className="hover:underline">Mis Pedidos</Link>
              </div>
            </div>
          </div>
        </div>

        {/* Main Header */}
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/seller/catalogo" className="flex items-center gap-2 flex-shrink-0">
              {getValue('logo_url') ? (
                <img src={getValue('logo_url')} alt={getValue('platform_name')} className="h-10 w-auto max-w-[120px] object-contain" />
              ) : (
                <>
                  <div className="w-10 h-10 rounded bg-blue-600 flex items-center justify-center">
                    <Package className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-lg text-gray-900">{getValue('platform_name') || 'SIVER'}</span>
                    <span className="text-xs text-blue-600 font-medium -mt-1">MAYORISTA</span>
                  </div>
                </>
              )}
            </Link>

            {/* Search Bar with History */}
            <div ref={searchContainerRef} className="mx-auto max-w-[150px] relative">
              <form onSubmit={handleSearch}>
                <div className="relative w-full flex items-center">
                  <Input type="text" placeholder="" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onFocus={() => setShowHistory(true)} className="pl-4 pr-28 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  {/* Hidden file input for image search */}
                  <input ref={imageInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageSearch} />
                  <div className="absolute right-12 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                    {/* Camera icon for image search */}
                    <button type="button" onClick={() => imageInputRef.current?.click()} disabled={isImageSearching} className="text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50">
                      {isImageSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                    </button>
                    {/* Voice search button */}
                    {voiceSupported && <button type="button" onClick={startVoiceSearch} className={cn("transition-colors", isListening ? "text-red-500 animate-pulse" : "text-gray-400 hover:text-blue-600")}>
                        {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                      </button>}
                  </div>
                  <button type="submit" className="absolute right-1 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-700 p-2 rounded-full transition-colors">
                    <Search className="w-4 h-4 text-white" />
                  </button>
                </div>
              </form>

              {/* Search History Dropdown - Desktop */}
              {showHistory && filteredHistory.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-72 overflow-y-auto">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                    <span className="text-xs font-medium text-gray-500">Búsquedas recientes</span>
                    <button onClick={clearHistory} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                      Limpiar historial
                    </button>
                  </div>
                  {filteredHistory.map((query, index) => <button key={index} onClick={() => handleHistoryClick(query)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left group">
                      <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-700 flex-1">{query}</span>
                      <button onClick={e => removeFromHistory(query, e)} className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 rounded-full transition-all">
                        <X className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                    </button>)}
                </div>}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-6">
              {/* View Mode Switch */}
              <ViewModeSwitch />
              <Link to="/seller/favoritos" className="flex flex-col items-center gap-1 text-gray-700 hover:text-blue-600 transition">
                <Heart className="w-6 h-6" />
                <span className="text-xs">Favoritos</span>
              </Link>
              <Link to="/seller/cuenta" className="flex flex-col items-center gap-1 text-gray-700 hover:text-blue-600 transition">
                <User className="w-6 h-6" />
                <span className="text-xs">Cuenta</span>
              </Link>
              <Link to="/seller/carrito" className="flex flex-col items-center gap-1 text-gray-700 hover:text-blue-600 transition relative">
                <ShoppingBag className="w-6 h-6" />
                {cartCount > 0 && <span className="absolute -top-1 right-2 min-w-[18px] h-[18px] bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>}
                <span className="text-xs">Carrito</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Categories Filter Bar */}
        <div className="border-t border-gray-200 bg-gray-50">
          <div className="container mx-auto px-4">
            <div ref={catBarRef} className="flex items-center gap-1 h-12 overflow-x-auto scrollbar-hide">
              <button onClick={() => handleCategoryClick(null)} className={cn("px-4 py-2 text-sm font-medium rounded-full transition-colors whitespace-nowrap", selectedCategoryId === null ? "bg-blue-600 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100")}>
                Todos los productos
              </button>
              {categoriesLoading ? <div className="px-4 py-2 text-sm text-gray-500">Cargando...</div> : rootCategories.map(cat => <button key={cat.id} onClick={() => handleCategoryClick(cat.id)} className={cn("px-4 py-2 text-sm font-medium rounded-full transition-colors whitespace-nowrap", selectedCategoryId === cat.id ? "bg-blue-600 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100")}>
                    {cat.name}
                  </button>)}
            </div>
          </div>
        </div>
      </header>
      <div className="h-[140px]" />
    </>;
};
export default HeaderB2B;