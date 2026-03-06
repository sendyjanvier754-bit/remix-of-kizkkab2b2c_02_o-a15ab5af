import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types/auth';

interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar_url: string | null;
  banner_url: string | null;
  user_code: string | null;  // Código personal KZ...
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  role: UserRole | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);
  const navigate = useNavigate();

  const getUserRole = async (userId: string): Promise<UserRole> => {
    try {
      // Get all roles for user (handles duplicates and multiple roles)
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error) {
        console.error('Error checking user role:', error);
        return UserRole.USER;
      }

      if (!data || data.length === 0) {
        return UserRole.USER;
      }

      // Priority: admin > seller > user
      const roles = data.map(r => r.role as string);
      if (roles.includes('admin')) return UserRole.ADMIN;
      if (roles.includes('seller')) return UserRole.SELLER;
      return UserRole.USER;
    } catch (error) {
      console.error('Error checking user role:', error);
      return UserRole.USER;
    }
  };


  const fetchUserProfile = async (userId: string): Promise<AppUser | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      if (!data) return null;

      return {
        id: data.id,
        email: data.email || '',
        name: data.full_name || 'Usuario',
        role: UserRole.USER, // Se obtiene de la tabla user_roles
        avatar_url: data.avatar_url || null,
        banner_url: data.banner_url || null,
        user_code: data.user_code || null,  // Código KZ...
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;
    
    // Safety timeout: if auth doesn't complete within 8 seconds, show the app anyway
    const safetyTimeout = setTimeout(() => {
      if (mounted) setIsLoading(false);
    }, 8000);

    // PRIMERO: Cargar sesión existente SINCRÓNICAMENTE para evitar "parpadeo"
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user && mounted) {
          console.log('🔄 Loading existing session...');
          setSession(session);
          
          const [profile, userRole] = await Promise.all([
            fetchUserProfile(session.user.id),
            getUserRole(session.user.id),
          ]);
          
          if (!profile) {
            console.error('No profile found for user:', session.user.id);
            setIsLoading(false);
            clearTimeout(safetyTimeout);
            setHasInitialized(true);
            return;
          }
          
          const appUser: AppUser = { ...profile, role: userRole };
          setUser(appUser);
          setRole(userRole);
          setIsLoading(false);
          clearTimeout(safetyTimeout);
          setHasInitialized(true);
        } else {
          setIsLoading(false);
          clearTimeout(safetyTimeout);
          setHasInitialized(true);
        }
      } catch (error) {
        console.error('Error loading session:', error);
        setIsLoading(false);
        clearTimeout(safetyTimeout);
      }
    };
    
    initAuth();

    // SEGUNDO: Configurar listener para cambios de auth (login, logout, refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        console.log(`🔐 Auth event: ${event}`, {
          hasSession: !!session,
          currentPath: window.location.pathname,
          hasInitialized
        });
        
        setSession(session);

        // Procesar cambios de auth
        if (session?.user) {
          // Usar promesas en paralelo para reducir latencia
          (async () => {
            const [profile, userRole] = await Promise.all([
              fetchUserProfile(session.user.id),
              getUserRole(session.user.id),
            ]);
            
            if (!profile) {
              console.error('No profile found for user:', session.user.id);
              setUser(null);
              setRole(null);
              return;
            }
            
            const appUser: AppUser = { ...profile, role: userRole };

            setUser(appUser);
            setRole(userRole);

            // SOLO redirigir si es un login GENUINO desde /login
            // Usamos sessionStorage para detectar login genuino
            const justLoggedIn = sessionStorage.getItem('just_logged_in') === 'true';
            
            if (event === 'SIGNED_IN' && justLoggedIn) {
              // Limpiar flag inmediatamente
              sessionStorage.removeItem('just_logged_in');
              
              const currentPath = window.location.pathname;
              console.log('✅ Genuine login detected - checking redirect from:', currentPath, 'role:', userRole);

              // Verificar si el usuario ya está en la ruta correcta para su rol
              const isInCorrectArea = 
                (userRole === UserRole.SELLER && currentPath.startsWith('/seller')) ||
                (userRole === UserRole.ADMIN && currentPath.startsWith('/admin')) ||
                (userRole === UserRole.USER && !currentPath.startsWith('/seller') && !currentPath.startsWith('/admin'));

              console.log('🔍 Is in correct area?', isInCorrectArea, 'for role:', userRole);

              // Solo redirigir si está en páginas de autenticación, raíz, o área incorrecta
              const needsRedirect = 
                currentPath === '/login' || 
                currentPath === '/registro' ||
                currentPath === '/' ||
                !isInCorrectArea;

              console.log('🔍 Needs redirect?', needsRedirect);

              if (needsRedirect) {
                console.log('📍 Redirecting to default page for role:', userRole);
                if (userRole === UserRole.SELLER) {
                  navigate('/seller/adquisicion-lotes', { replace: true });
                } else if (userRole === UserRole.ADMIN) {
                  navigate('/admin/dashboard', { replace: true });
                } else {
                  navigate('/perfil', { replace: true });
                }
              } else {
                console.log('⏸️ Not redirecting - user already in correct area:', currentPath);
              }
            } else {
              console.log('⏸️ Not redirecting - not a genuine login (page reload or token refresh)');
            }
          })();
        } else {
          setUser(null);
          setRole(null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps: only run on mount. Removed navigate to prevent re-runs on navigation

  const signIn = async (email: string, password: string) => {
    // Marcar que este es un login genuino (no un reload)
    sessionStorage.setItem('just_logged_in', 'true');
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    // Si hay error, limpiar el flag
    if (error) {
      sessionStorage.removeItem('just_logged_in');
    }
    
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    try {
      // Clear local state first to ensure UI updates immediately
      setUser(null);
      setSession(null);
      setRole(null);
      
      // Then sign out from Supabase (ignore errors if session already expired)
      await supabase.auth.signOut();
    } catch (error) {
      console.warn('Sign out error (session may have already expired):', error);
    } finally {
      // Always navigate to home, regardless of Supabase response
      navigate('/');
    }
  };

  const value: AuthContextType = {
    user,
    session,
    role,
    isLoading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
