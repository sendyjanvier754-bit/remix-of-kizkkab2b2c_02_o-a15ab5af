/**
 * Componente ProtectedRoute para controlar acceso según rol
 * 
 * Uso:
 * <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SELLER]} fallbackPath="/login">
 *   <AdminPage />
 * </ProtectedRoute>
 */

import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { UserRole, ProtectedRouteProps } from "@/types/auth";
import { PageLoader } from "@/components/ui/PageLoader";

const ProtectedRoute = ({
  children,
  requiredRoles,
  fallbackPath = "/",
}: ProtectedRouteProps) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  // Si no hay usuario autenticado, redirigir al fallback o home
  if (!user) {
    return <Navigate to={fallbackPath} replace />;
  }

  // Si se especificaron roles requeridos y el usuario no tiene el rol requerido
  if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.includes(user.role as UserRole)) {
    // Redirigir según su rol
    const redirectPath = getRoleRedirectPath(user.role as UserRole);
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};

/**
 * Obtiene la ruta de redirección según el rol del usuario
 */
export const getRoleRedirectPath = (role: UserRole): string => {
  switch (role) {
    case UserRole.ADMIN:
      return "/admin/dashboard";
    case UserRole.PURCHASING_AGENT:
      return "/agente-compra";
    case UserRole.SELLER:
      return "/seller/adquisicion-lotes";
    case UserRole.USER:
    default:
      return "/perfil";
  }
};

export default ProtectedRoute;
