import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
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
import { Eye, EyeOff, Mail, Lock, User, AlertCircle, Store, ShoppingBag, KeyRound, ChevronRight, ArrowLeft, Shield, Info } from "lucide-react";
import GlobalHeader from "@/components/layout/GlobalHeader";
import Footer from "@/components/layout/Footer";
import { useBranding } from "@/hooks/useBranding";
import { LegalPagesModal } from "@/components/legal/LegalPagesModal";
import { AboutModal } from "@/components/legal/AboutModal";

const LoginPage = () => {
  const { getValue } = useBranding();
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
  // Account type step: null = not chosen yet
  const [accountType, setAccountType] = useState<'buyer' | 'seller' | null>(null);
  // Info modals
  const [showLegal, setShowLegal] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  
  const { signIn, signUp, user, role, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Default to register tab if ?tab=register
  const defaultTab = searchParams.get('tab') === 'register' ? 'register' : 'login';

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
          navigate('/', { replace: true });
        } else {
          navigate('/', { replace: true });
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
        if (error.message.includes("Signups not allowed") || error.message.includes("otp")) {
          setError("El inicio de sesión por código OTP no está habilitado. Contacta al administrador o usa contraseña.");
        } else if (error.message.includes("rate limit") || error.message.includes("429")) {
          setError("Demasiados intentos. Espera unos minutos antes de solicitar otro código.");
        } else {
          setError(error.message);
        }
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
        if (error.message.includes("expired") || error.message.includes("Token")) {
          setError("El código ha expirado. Solicita uno nuevo.");
        } else {
          setError("Código inválido. Verifica e intenta de nuevo.");
        }
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
            <h1 className="text-3xl font-bold text-foreground mb-2">Bienvenido a {getValue('platform_name')}</h1>
            <p className="text-muted-foreground">{getValue('platform_slogan')}</p>
          </div>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl text-center">Acceder</CardTitle>
              <CardDescription className="text-center">
                Inicia sesión o crea una nueva cuenta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={defaultTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="login">Contraseña</TabsTrigger>
                  <TabsTrigger value="otp">
                    <KeyRound className="h-3 w-3 mr-1" />
                    Código Email
                  </TabsTrigger>
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
                      <div className="flex items-center justify-between">
                        <Label htmlFor="login-password">Contraseña</Label>
                        <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                          ¿Olvidaste tu contraseña?
                        </Link>
                      </div>
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

                <TabsContent value="otp">
                  {!otpSent ? (
                    <form onSubmit={handleSendOTP} className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Te enviaremos un código de verificación a tu email para iniciar sesión sin contraseña.
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="otp-email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="otp-email"
                            type="email"
                            placeholder="tu@email.com"
                            className="pl-10"
                            value={otpEmail}
                            onChange={(e) => setOtpEmail(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? "Enviando..." : "Enviar código"}
                      </Button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyOTP} className="space-y-4">
                      <p className="text-sm text-muted-foreground text-center">
                        Ingresa el código de 6 dígitos enviado a <strong>{otpEmail}</strong>
                      </p>
                      <div className="flex justify-center">
                        <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                      <Button type="submit" className="w-full" disabled={isLoading || otpCode.length !== 6}>
                        {isLoading ? "Verificando..." : "Verificar código"}
                      </Button>
                      <Button type="button" variant="ghost" className="w-full" onClick={() => { setOtpSent(false); setOtpCode(""); setError(null); setSuccess(null); }}>
                        Enviar nuevo código
                      </Button>
                    </form>
                  )}
                </TabsContent>

                <TabsContent value="register">
                  {/* Step 1: Choose account type */}
                  {accountType === null && (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground text-center">¿Qué tipo de cuenta deseas crear?</p>
                      <button
                        type="button"
                        onClick={() => setAccountType('buyer')}
                        className="w-full flex items-center gap-4 p-4 border-2 border-border rounded-xl hover:border-primary hover:bg-primary/5 transition group text-left"
                      >
                        <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition">
                          <ShoppingBag className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">Cuenta de Cliente</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Compra productos de tus tiendas favoritas</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition" />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/registro-vendedor')}
                        className="w-full flex items-center gap-4 p-4 border-2 border-border rounded-xl hover:border-green-500 hover:bg-green-50 transition group text-left"
                      >
                        <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition">
                          <Store className="h-6 w-6 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">Cuenta de Vendedor</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Esta cuenta es para comerciantes interesados en compra al por mayor</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-green-500 transition" />
                      </button>
                    </div>
                  )}

                  {/* Step 2: Buyer registration form */}
                  {accountType === 'buyer' && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setAccountType(null)}
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Cambiar tipo de cuenta
                      </button>
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
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <div className="mt-6 pt-6 border-t space-y-3">
                <p className="text-sm text-center text-muted-foreground mb-4">
                  ¿Quieres vender en {getValue('platform_name')}?
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
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setShowLegal(true)}
                  >
                    <Shield className="h-3.5 w-3.5" />
                    Términos Legales
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setShowAbout(true)}
                  >
                    <Info className="h-3.5 w-3.5" />
                    Acerca de
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
      <LegalPagesModal open={showLegal} onOpenChange={setShowLegal} />
      <AboutModal open={showAbout} onOpenChange={setShowAbout} />
    </div>
  );
};

export default LoginPage;
