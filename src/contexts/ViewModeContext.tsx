import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types/auth";
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
  const { role } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("b2b");
  const navigate = useNavigate();

  const canToggle = role === UserRole.SELLER || role === UserRole.ADMIN;

  useEffect(() => {
    if (!canToggle) {
      setViewMode("b2b");
    }
  }, [canToggle]);

  const toggleViewMode = useCallback(() => {
    if (canToggle) {
      setViewMode((prev) => {
        const newMode = prev === "b2b" ? "client" : "b2b";
        
      if (newMode === "client") {
        navigate("/");
        toast.success("Navegando como cliente B2C");
        } else {
          toast.info("Vista B2B restaurada");
        }
        
        return newMode;
      });
    }
  }, [canToggle, navigate]);

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
