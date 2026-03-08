import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { PageLoader } from "./PageLoader";

export const NavigationLoader = () => {
  const location = useLocation();
  const [isNavigating, setIsNavigating] = useState(false);
  const isFirstRun = useRef(true);

  useEffect(() => {
    // Evitar que se ejecute en la carga inicial (ya manejada por AuthProvider)
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }

    setIsNavigating(true);
    
    // Simular tiempo de carga para la transición
    // Ajustable según preferencia (800ms es un buen balance)
    const timer = setTimeout(() => {
      setIsNavigating(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  if (!isNavigating) return null;

  return <PageLoader />;
};
