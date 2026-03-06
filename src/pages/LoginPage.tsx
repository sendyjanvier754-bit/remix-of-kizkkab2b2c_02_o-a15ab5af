import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Eye, EyeOff, Mail, Lock, User, AlertCircle, Store, ShoppingBag, KeyRound } from "lucide-react";
import GlobalHeader from "@/components/layout/GlobalHeader";
import Footer from "@/components/layout/Footer";

const LoginPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  // OTP login
  const [otpEmail, setOtpEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  
  // Register form
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const { signIn, signUp, user, role, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirigir si el usuario ya está autenticado
  useEffect(() => {
    if (!authLoading && user) {
      // Solo redirigir si venimos de registro o ya estábamos aquí
      // El login genuino es manejado por useAuth
      const justLoggedIn = sessionStorage.getItem('just_logged_in') === 'true';
      if (!justLoggedIn) {
        if (role === UserRole.SELLER) {
          navigate('/seller/adquisicion-lotes', { replace: true });
        } else if (role === UserRole.ADMIN) {
          navigate('/admin/dashboard', { replace: true });
        } else if (role === UserRole.USER) {
          navigate('/perfil', { replace: true });
        } else {
          navigate('/perfil', { replace: true });
        }
      }
    }
  }, [user, role, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error } = await signIn(loginEmail, loginPassword);
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          setError("Email o contraseña incorrectos");
        } else {
          setError(error.message);
        }
      }
      // Si no hay error, useAuth manejará la redirección automáticamente
      // No necesitamos navigate() aquí
    } catch (err) {
      setError("Error al iniciar sesión. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: otpEmail,
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) {
        setError(error.message);
      } else {
        setOtpSent(true);
        setSuccess("Código enviado a tu email. Revisa tu bandeja de entrada.");
      }
    } catch {
      setError("Error al enviar el código.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      sessionStorage.setItem('just_logged_in', 'true');
      const { error } = await supabase.auth.verifyOtp({
        email: otpEmail,
        token: otpCode,
        type: 'email',
      });

      if (error) {
        sessionStorage.removeItem('just_logged_in');
        setError("Código inválido o expirado. Intenta de nuevo.");
      }
    } catch {
      sessionStorage.removeItem('just_logged_in');
      setError("Error al verificar el código.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    if (registerPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    
    if (registerPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await signUp(registerEmail, registerPassword, registerName);
      if (error) {
        if (error.message.includes("already registered")) {
          setError("Este email ya está registrado. Intenta iniciar sesión.");
        } else {
          setError(error.message);
        }
      } else {
        setSuccess("¡Cuenta creada exitosamente! Ya puedes iniciar sesión.");
        setRegisterName("");
        setRegisterEmail("");
        setRegisterPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      setError("Error al crear la cuenta. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <GlobalHeader />
      <main className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center pb-24 md:pb-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Bienvenido a Siver Market</h1>
            <p className="text-muted-foreground">Tu marketplace de confianza</p>
          </div>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl text-center">Acceder</CardTitle>
              <CardDescription className="text-center">
                Inicia sesión o crea una nueva cuenta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
                  <TabsTrigger value="register">Registrarse</TabsTrigger>
                </TabsList>

                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {success && (
                  <Alert className="mb-4 border-green-500 bg-green-50 text-green-700">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{success}</AlertDescription>
                  </Alert>
                )}

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="tu@email.com"
                          className="pl-10"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="login-password">Contraseña</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="login-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="pl-10 pr-10"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? "Iniciando..." : "Iniciar Sesión"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-name">Nombre completo</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="register-name"
                          type="text"
                          placeholder="Tu nombre"
                          className="pl-10"
                          value={registerName}
                          onChange={(e) => setRegisterName(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="register-email"
                          type="email"
                          placeholder="tu@email.com"
                          className="pl-10"
                          value={registerEmail}
                          onChange={(e) => setRegisterEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-password">Contraseña</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="register-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Mínimo 6 caracteres"
                          className="pl-10 pr-10"
                          value={registerPassword}
                          onChange={(e) => setRegisterPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirmar contraseña</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="confirm-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Repite tu contraseña"
                          className="pl-10"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? "Creando cuenta..." : "Crear Cuenta"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              <div className="mt-6 pt-6 border-t space-y-3">
                <p className="text-sm text-center text-muted-foreground mb-4">
                  ¿Quieres vender en Siver Market?
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" asChild className="gap-2">
                    <Link to="/registro-vendedor">
                      <Store className="h-4 w-4" />
                      Ser Vendedor
                    </Link>
                  </Button>
                  <Button variant="outline" asChild className="gap-2">
                    <Link to="/">
                      <ShoppingBag className="h-4 w-4" />
                      Explorar
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default LoginPage;
