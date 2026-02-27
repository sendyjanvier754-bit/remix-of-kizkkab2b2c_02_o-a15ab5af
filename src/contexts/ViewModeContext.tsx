import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ViewMode = "b2b" | "client";

interface ViewModeContextType {
  viewMode: ViewMode;
  toggleViewMode: () => void;
  isClientPreview: boolean;
  canToggle: boolean;
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

export const ViewModeProvider = ({ children }: { children: ReactNode }) => {
  const { role, user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("b2b");
  const navigate = useNavigate();

  // Solo sellers y admins pueden alternar
  const canToggle = role === UserRole.SELLER || role === UserRole.ADMIN;

  // Reset to b2b when role changes or user logs out
  useEffect(() => {
    if (!canToggle) {
      setViewMode("b2b");
    }
  }, [canToggle]);

  // Función para navegar a la tienda del seller
  const navigateToOwnStore = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data: store, error } = await supabase
        .from("stores")
        .select("id, slug, name")
        .eq("owner_user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;

      if (store) {
        // Navegar a la tienda usando slug o id
        const storeUrl = store.slug ? `/tienda/${store.slug}` : `/tienda/${store.id}`;
        navigate(storeUrl);
        toast.success(`Viendo tu tienda "${store.name}" como cliente`);
      } else {
        // Si no tiene tienda, ir al marketplace
        navigate("/marketplace");
        toast.info("No tienes una tienda creada. Mostrando marketplace.");
      }
    } catch (error) {
      console.error("Error fetching store:", error);
      navigate("/");
    }
  }, [user?.id, navigate]);

  const toggleViewMode = useCallback(() => {
    if (canToggle) {
      setViewMode((prev) => {
        const newMode = prev === "b2b" ? "client" : "b2b";
        
        // Si cambia a modo cliente, navegar a su tienda
        if (newMode === "client") {
          navigateToOwnStore();
        } else {
          // Si vuelve a B2B, NO redirigir - mantener la página actual
          toast.info("Vista B2B restaurada");
        }
        
        return newMode;
      });
    }
  }, [canToggle, navigateToOwnStore]);

  const isClientPreview = viewMode === "client";

  return (
    <ViewModeContext.Provider value={{ viewMode, toggleViewMode, isClientPreview, canToggle }}>
      {children}
    </ViewModeContext.Provider>
  );
};

export const useViewMode = () => {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error("useViewMode must be used within ViewModeProvider");
  }
  return context;
};
