import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Menu, X, ShoppingBag, Search, Heart, User, Mail, Camera, Loader2, TrendingUp, Flame, Mic, MicOff, Eye, EyeOff, MessageCircle } from "lucide-react";
import NotificationBell from "@/components/notifications/NotificationBell";
import { Input } from "@/components/ui/input";
import { usePublicCategories } from "@/hooks/useCategories";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { searchProductsByImage } from "@/services/api/imageSearch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useB2CCartItems } from "@/hooks/useB2CCartItems";
import { useB2BCartItems } from "@/hooks/useB2BCartItems";
import { useViewMode } from "@/contexts/ViewModeContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTranslation } from "react-i18next";
import { useBranding } from "@/hooks/useBranding";

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

interface HeaderProps {
  showViewModeSwitch?: boolean;
  selectedCategoryId?: string | null;
  onCategorySelect?: (categoryId: string | null) => void;
}

const Header = ({ 
  showViewModeSwitch = false,
  selectedCategoryId = null,
  onCategorySelect
}: HeaderProps) => {
  const { t } = useTranslation();
  const { getValue } = useBranding();
  const { canToggle, toggleViewMode, isClientPreview } = useViewMode();
  const { getValue: getBranding } = useBranding();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openMobileCategory, setOpenMobileCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isImageSearching, setIsImageSearching] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [cartBounce, setCartBounce] = useState(false);
  const isMobile = useIsMobile();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const prevCartCountRef = useRef<number>(0);
  
  const { role, user } = useAuth();
  const { items: b2cItems } = useB2CCartItems();
  const { items: b2bItems } = useB2BCartItems();
  const { data: categories = [], isLoading: categoriesLoading } = usePublicCategories();
  const navigate = useNavigate();
  const location = useLocation();

  // Force public header on home page
  const isHomePage = location.pathname === '/';

  // Determine which cart to use
  const isB2B = role === UserRole.SELLER || role === UserRole.ADMIN;
  const showB2B = isB2B && !isClientPreview && !isHomePage;
  const supportChatPath = (role === UserRole.ADMIN || role === UserRole.SELLER || role === UserRole.SALES_AGENT)
    ? '/admin/soporte-chat'
    : '/soporte';
  const cartItems = showB2B ? b2bItems : b2cItems;
  const cartCount = cartItems.reduce((sum, item) => sum + ('quantity' in item ? item.quantity : item.cantidad), 0);
  const cartLink = showB2B ? "/seller/carrito" : "/carrito";

  const catBarRef = useRef(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const headerRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  // Check for Web Speech API support
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoiceSupported(!!SpeechRecognitionAPI);
  }, []);

  // Cleanup speech recognition on unmount
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

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => setHeaderHeight(el.offsetHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const scrollHeader = (dir) => {
    const el = catBarRef.current;
    if (!el) return;
    const amount = Math.max(el.clientWidth * 0.5, 240);
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  // Root categories (no parent)
  const rootCategories = categories.filter((c) => !c.parent_id);

  const getSubcategories = (parentId) =>
    categories.filter((c) => c.parent_id === parentId);

  const accountLink = role === UserRole.SELLER ? "/seller/cuenta" : 
                    role === UserRole.ADMIN ? "/admin/dashboard" : 
                    "/cuenta";
  const favoritesLink = isB2B ? "/seller/favoritos" : "/favoritos";

  const handleCategoryClick = (category: any | null) => {
    const catId = category ? category.id : null;
    if (onCategorySelect) {
      onCategorySelect(catId);
    } else {
      if (category) {
        navigate(`/categoria/${category.slug}`);
      } else {
        navigate('/categorias');
      }
    }
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
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
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
        navigate(`/productos?q=${encodeURIComponent(finalTranscript.trim())}`);
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      
      if (event.error === 'no-speech') {
        toast.error(t('header.noSpeech'));
      } else if (event.error === 'audio-capture') {
        toast.error(t('header.noMicrophone'));
      } else if (event.error === 'not-allowed') {
        toast.error(t('header.micDenied'));
      } else {
        toast.error(t('header.voiceError'));
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  if (isMobile) {
    return (
      <>
        <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100">
          <div className="flex items-center gap-3 px-3 py-2.5">
            {/* Notification/Mail icon */}
            <button
              type="button"
              className="relative flex-shrink-0"
              onClick={(e) => {
                e.preventDefault();
                if (user) {
                  navigate(supportChatPath);
                } else {
                  sessionStorage.setItem('post_login_redirect', '/soporte');
                  navigate('/cuenta');
                }
              }}
              aria-label="Chat de soporte"
            >
              <Mail className="w-6 h-6 text-gray-700" strokeWidth={1.5} />
            </button>

            {/* Search input - pill style */}
            <div className="flex-1 max-w-[55%] flex items-center bg-gray-100 rounded-full border border-gray-200 overflow-hidden">
              <input
                type="text"
                placeholder={t('header.searchProducts')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-500 px-4 py-2 outline-none"
              />
              {/* Camera icon for image search - Mobile */}
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={isImageSearching}
                className="p-1 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
              >
                {isImageSearching ? (
                  <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} />
                ) : (
                  <Camera className="w-5 h-5" strokeWidth={1.5} />
                )}
              </button>
              {/* Voice search button - Mobile */}
              {voiceSupported && (
                <button 
                  type="button" 
                  onClick={startVoiceSearch}
                  className={cn(
                    "p-1 transition-colors",
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
            </div>

            {/* Support Chat */}
            <button
              className="relative flex-shrink-0 bg-transparent border-0 p-0 cursor-pointer"
              onClick={() => {
                if (user) {
                  navigate(supportChatPath);
                } else {
                  sessionStorage.setItem('post_login_redirect', '/soporte');
                  navigate('/cuenta');
                }
              }}
              aria-label="Chat de soporte"
            >
              <MessageCircle className="w-6 h-6 text-gray-700" strokeWidth={1.5} />
            </button>
            {/* Favorites heart */}
            <Link to={favoritesLink} className="relative flex-shrink-0">
              <Heart className="w-6 h-6 text-gray-700" strokeWidth={1.5} />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#071d7f] rounded-full border-2 border-white" />
            </Link>
            {/* Profile */}
            <Link to={accountLink} className="relative flex-shrink-0 text-gray-700 hover:text-[#071d7f] transition-colors">
              <User className="w-6 h-6" strokeWidth={1.5} />
            </Link>
          </div>

          {/* Mobile Categories Scroll Bar */}
          <div className="flex items-center gap-4 px-3 py-2 overflow-x-auto bg-[#071d7f] text-white scrollbar-hide">
            <button 
              onClick={() => handleCategoryClick(null)}
              className={cn(
                "whitespace-nowrap text-sm font-medium transition-colors",
                selectedCategoryId === null ? "text-white border-b border-white" : "text-gray-300 hover:text-white"
              )}
            >
              {t('header.allCategories')}
            </button>
            {rootCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat)}
                className={cn(
                  "whitespace-nowrap text-sm font-medium transition-colors",
                  selectedCategoryId === cat.id ? "text-white border-b border-white" : "text-gray-300 hover:text-white"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </header>
        <div className="h-[8px]" />
      </>
    );
  }

  return (
    <>
    <header ref={headerRef} className="fixed top-0 left-0 right-0 z-50 bg-[#ffdcdc] border-b border-gray-200">
      {/* Top Bar */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-10 text-xs text-gray-600">
            <div className="flex items-center gap-4">
              <span>{t('header.shippingAbroad')}</span>
              <Link to="/tendencias" className="flex items-center gap-1 hover:text-[#071d7f] transition-colors">
                <TrendingUp className="w-3 h-3" />
                <span>{t('header.trends')}</span>
              </Link>
              <span>{t('header.freeReturns')}</span>
            </div>
            <div className="flex items-center gap-4">
              <button>{t('header.helpCenter')}</button>
              <span></span>
              <Link to="/admin/login">{t('header.sell')}</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            {getValue('logo_url') ? (
              <img src={getValue('logo_url')} alt={getValue('platform_name')} className="h-10 w-auto max-w-[120px] object-contain" />
            ) : (
              <>
                <div className="w-10 h-10 rounded bg-[#071d7f] flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-white" />
                </div>
                <span className="font-bold text-lg text-gray-900">{getValue('platform_name') || 'SIVER'}</span>
              </>
            )}
          </Link>

          {/* Search Bar - Desktop */}
          <div className="hidden md:flex flex-1 mx-8 max-w-md">
            <div className="relative w-full flex items-center">
              <Input
                type="text"
                placeholder={t('header.searchProducts')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-4 pr-20 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#071d7f]"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                {/* Camera icon for image search */}
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
                  className="text-gray-400 hover:text-[#071d7f] transition-colors disabled:opacity-50"
                >
                  {isImageSearching ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5" />
                  )}
                </button>
                {/* Voice search button - Desktop */}
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
                <Search className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/tendencias" className="flex flex-col items-center gap-1 text-gray-700 hover:text-[#071d7f] transition">
              <Flame className="w-6 h-6" />
              <span className="text-xs">{t('header.trends')}</span>
            </Link>
            <button
              className="flex flex-col items-center gap-1 text-gray-700 hover:text-[#071d7f] transition bg-transparent border-0 cursor-pointer"
              onClick={() => {
                if (user) {
                  navigate(supportChatPath);
                } else {
                  sessionStorage.setItem('post_login_redirect', '/soporte');
                  navigate('/cuenta');
                }
              }}
            >
              <MessageCircle className="w-6 h-6" />
              <span className="text-xs">{t('header.support')}</span>
            </button>
            {user && (
              <div className="flex flex-col items-center gap-1">
                <NotificationBell />
                <span className="text-xs text-gray-700">Alertas</span>
              </div>
            )}
            <Link to={favoritesLink} className="flex flex-col items-center gap-1 text-gray-700 hover:text-[#071d7f] transition">
              <Heart className="w-6 h-6" />
              <span className="text-xs">{t('header.favorites')}</span>
            </Link>
            <Link to={user ? accountLink : "/cuenta"} className="flex flex-col items-center gap-1 text-gray-700 hover:text-[#071d7f] transition">
              <User className="w-6 h-6" />
              <span className="text-xs">{t('header.account')}</span>
            </Link>
            {isB2B && (
              <Link to="/seller/adquisicion-lotes" className="flex flex-col items-center gap-1 text-white bg-[#071d7f] hover:bg-[#0a3a9f] px-3 py-1 rounded-md transition">
                <ShoppingBag className="w-5 h-5" />
                <span className="text-xs font-medium">B2B</span>
              </Link>
            )}
            {showViewModeSwitch && canToggle && (
              <button
                onClick={toggleViewMode}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-1 rounded-md transition text-xs font-medium",
                  isClientPreview
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
                title={isClientPreview ? "Volver a vista B2B" : "Ver como cliente"}
              >
                {isClientPreview ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                <span>{isClientPreview ? "Vista B2B" : "Vista Cliente"}</span>
              </button>
            )}
            <Link to={cartLink} className="flex flex-col items-center gap-1 text-gray-700 hover:text-[#071d7f] transition relative">
              <ShoppingBag className="w-6 h-6" />
              <span className="text-xs">{t('header.cart')}</span>
              {cartCount > 0 && (
                <span className={cn(
                  "absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-[#071d7f] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1",
                  cartBounce && "animate-bounce"
                )}>
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>
            <LanguageSwitcher compact variant="ghost" />
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Categories Bar */}
        <div className="hidden lg:block border-t border-gray-200 relative">
          <div ref={catBarRef} className="flex items-center gap-0 h-12 overflow-hidden whitespace-nowrap pl-12 pr-12">
          {categoriesLoading ? (
            <div className="px-4 py-3 text-sm text-gray-500">{t('header.loadingCategories')}</div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleCategoryClick(null)}
                className={cn(
                  "px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap flex items-center gap-2",
                  !selectedCategoryId
                    ? "text-[#071d7f] border-[#071d7f] bg-[#071d7f]/5" 
                    : "text-gray-700 hover:text-[#071d7f] hover:bg-gray-50 border-transparent hover:border-[#071d7f]"
                )}
              >
                {t('header.allCategories')}
              </button>
              {rootCategories.map((cat) => {
                const subs = getSubcategories(cat.id);
                const isSelected = selectedCategoryId === cat.id;
                return (
                  <div key={cat.id} className="relative group inline-block">
                      <button
                        type="button"
                        onClick={() => handleCategoryClick(cat)}
                        className={cn(
                          "px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap flex items-center gap-2",
                          isSelected 
                            ? "text-[#071d7f] border-[#071d7f] bg-[#071d7f]/5" 
                            : "text-gray-700 hover:text-[#071d7f] hover:bg-gray-50 border-transparent hover:border-[#071d7f]"
                        )}
                      >
                        {cat.name}
                      </button>

                  {/* Subcategories dropdown on hover */}
                  {subs.length > 0 && (
                    <div className="absolute left-0 top-full mt-2 hidden group-hover:flex p-6 bg-white border border-gray-100 shadow-lg rounded-lg z-40 max-w-screen-lg">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {subs.map((sub) => (
                          <button key={sub.id} type="button" onClick={() => handleCategoryClick(sub)} className="flex flex-col items-center text-center w-36">
                            <div className="w-24 h-24 rounded-full overflow-hidden bg-muted flex items-center justify-center mb-2 border border-border">
                              {sub.icon ? (
                                <img src={sub.icon} alt={sub.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-muted flex items-center justify-center">
                                  <span className="text-xl text-muted-foreground">{sub.name.charAt(0).toUpperCase()}</span>
                                </div>
                              )}
                            </div>
                            <div className="text-sm text-gray-700 font-medium">{sub.name}</div>
                            {sub.description && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{sub.description}</div>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          }
          </>
        )}
          </div>

          {/* Scroll buttons */}
          {hasOverflow && (
            <>
              <button
                aria-label="scroll left"
                onClick={() => scrollHeader(-1)}
                className="hidden lg:flex absolute left-2 top-1/2 -translate-y-1/2 z-50"
              >
                <div className="w-6 h-6 bg-gray-200 border-2 border-black rounded flex items-center justify-center shadow-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-black"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              </button>
              <button
                aria-label="scroll right"
                onClick={() => scrollHeader(1)}
                className="hidden lg:flex absolute right-2 top-1/2 -translate-y-1/2 z-50"
              >
                <div className="w-6 h-6 bg-gray-200 border-2 border-black rounded flex items-center justify-center shadow-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-black"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200">
          <div className="container mx-auto px-4 py-4">
            <Input type="text" placeholder={t('header.searchPlaceholder')} className="w-full mb-4 rounded-full" />

            <nav className="flex flex-col gap-2">
              <div className="flex items-center justify-around py-4 border-b border-gray-100">
                <Link to={favoritesLink} className="flex flex-col items-center gap-1 text-gray-700" onClick={() => setIsMenuOpen(false)}>
                  <Heart className="w-6 h-6" />
                  <span className="text-xs">{t('header.favorites')}</span>
                </Link>
                <Link to={accountLink} className="flex flex-col items-center gap-1 text-gray-700" onClick={() => setIsMenuOpen(false)}>
                  <User className="w-6 h-6" />
                  <span className="text-xs">{t('header.account')}</span>
                </Link>
              </div>
              {rootCategories.map((cat) => {
                const subs = getSubcategories(cat.id);
                const isOpen = openMobileCategory === cat.id;
                return (
                  <div key={cat.id} className="border-b border-gray-100">
                    <div className="flex items-center justify-between w-full">
                      <button onClick={() => { setOpenMobileCategory(isOpen ? null : cat.id); }} className="w-full text-left py-3 px-2 text-gray-800 hover:bg-gray-50 font-medium">{cat.name}</button>
                      <button onClick={() => { setIsMenuOpen(false); handleCategoryClick(cat); }} className="px-3 py-2 text-gray-600">{t('common.go')}</button>
                    </div>

                    {isOpen && subs.length > 0 && (
                      <div className="px-2 py-2 bg-white">
                        <div className="grid grid-cols-3 gap-2">
                          {subs.map((sub) => (
                            <button key={sub.id} type="button" onClick={() => { setIsMenuOpen(false); handleCategoryClick(sub); }} className="flex flex-col items-center text-center p-2">
                              <div className="w-16 h-16 rounded-full overflow-hidden bg-muted flex items-center justify-center mb-2 border border-border">
                                {sub.icon ? (
                                  <img src={sub.icon} alt={sub.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-muted flex items-center justify-center">
                                    <span className="text-xl text-muted-foreground">{sub.name.charAt(0).toUpperCase()}</span>
                                  </div>
                                )}
                              </div>
                              <div className="text-xs text-gray-700">{sub.name}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </header>

    {/* spacer to push page content below fixed header — matches actual header height */}
    <div aria-hidden style={{ height: `${headerHeight}px` }} />
    </>
  );
};

export default Header;
