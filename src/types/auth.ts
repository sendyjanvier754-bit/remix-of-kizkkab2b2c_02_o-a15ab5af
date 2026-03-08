/**
 * Tipos de autenticación y autorización para la aplicación
 * Separación estricta entre B2B (Mayorista) y B2C (Minorista)
 * 
 * NOTA: Los valores del enum deben coincidir con el enum app_role en la BD:
 * {admin, moderator, user, seller, staff_pickup}
 */

export enum UserRole {
  ADMIN = "admin", // Administrador - Acceso total
  SELLER = "seller", // Vendedor Siver509 - Acceso a módulo B2B
  USER = "user", // Usuario/Cliente Final - Acceso solo a experiencia B2C
  MODERATOR = "moderator", // Moderador
  STAFF_PICKUP = "staff_pickup", // Staff de punto de recogida
  SALES_AGENT = "sales_agent", // Agente de ventas - Creación de pedidos remota
}

// Alias para compatibilidad
export const CLIENT = UserRole.USER;

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
}

export interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[]; // Made optional - defaults to all authenticated users
  fallbackPath?: string;
}