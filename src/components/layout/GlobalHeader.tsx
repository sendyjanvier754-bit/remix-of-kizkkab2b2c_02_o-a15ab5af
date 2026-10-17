import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useViewMode } from "@/contexts/ViewModeContext";
import { useLocation } from "react-router-dom";
import Header from "./Header";
import HeaderB2B from "@/components/b2b/HeaderB2B";

interface GlobalHeaderProps {
  /** Props para el HeaderB2B cuando el usuario es seller */
  selectedCategoryId?: string | null;
  onCategorySelect?: (categoryId: string | null) => void;
  onSearch?: (query: string) => void;
}

/**
 * GlobalHeader - Renderiza el header apropiado según el rol del usuario
 * - Admin/Seller: HeaderB2B (azul/verde) - puede alternar a vista cliente
 * - Client/Guest: Header regular (rojo)
 */
const GlobalHeader = ({ 
  selectedCategoryId = null,
  onCategorySelect,
  onSearch
}: GlobalHeaderProps) => {
  const { role, isLoading } = useAuth();
  const isMobile = useIsMobile();
  const { isClientPreview } = useViewMode();
  const location = useLocation();

  // En mobile no mostramos este header (GlobalMobileHeader se encarga)
  // En mobile no mostramos este header (GlobalMobileHeader se encarga)
  if (isMobile) {
    return null;
  }

  // Mientras carga la autenticación, mostrar header regular por defecto
  if (isLoading) {
    return <Header />;
  }

  // Seller o Admin con preview de cliente: mostrar Header regular con switch
  const isB2BUser = role === UserRole.SELLER || role === UserRole.ADMIN;
  const isHomePage = location.pathname === '/';
  
  if (isB2BUser && (isClientPreview || isHomePage)) {
    return <Header showViewModeSwitch={true} />;
  }

  // Seller o Admin: mostrar Header regular (unificado)
  if (isB2BUser) {
    return <Header showViewModeSwitch={true} />;
  }

  // Cliente o no autenticado: Header regular
  return <Header />;
};

export default GlobalHeader;
