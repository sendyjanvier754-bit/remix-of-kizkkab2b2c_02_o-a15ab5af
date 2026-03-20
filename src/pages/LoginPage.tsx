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
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";

const LoginPage = () => {
  const { t } = useTranslation();
  const { getValue } = useBranding();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  const [otpEmail, setOtpEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountType, setAccountType] = useState<'buyer' | 'seller' | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loginTermsAccepted, setLoginTermsAccepted] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  
  const { signIn, signUp, user, role, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const defaultTab = searchParams.get('tab') === 'register' ? 'register' : 'login';

  useEffect(() => {
    if (!authLoading && user) {
      const justLoggedIn = sessionStorage.getItem('just_logged_in') === 'true';
      if (!justLoggedIn) {
        if (role === UserRole.SELLER) {
          navigate('/seller/adquisicion-lotes', { replace: true });
        } else if (role === UserRole.ADMIN) {
          navigate('/admin/dashboard', { replace: true });
        } else if (role === UserRole.USER) {
          navigate('/perfil', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      }
    }
  }, [user, role, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!loginTermsAccepted) {
      setError('Debes aceptar los Términos y Condiciones para continuar.');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await signIn(loginEmail, loginPassword);
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          setError(t('loginPage.invalidCredentials'));
        } else {
          setError(error.message);
        }
      } else {
        // If user had no terms_accepted_at yet (registered before this feature), save it now
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          await supabase
            .from('profiles')
            .update({ terms_accepted_at: new Date().toISOString() } as any)
            .eq('id', session.user.id)
            .is('terms_accepted_at', null);
        }
      }
    } catch (err) {
      setError(t('loginPage.loginError'));
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
        options: { shouldCreateUser: false },
      });

      if (error) {
        if (error.message.includes("Signups not allowed") || error.message.includes("otp")) {
          setError(t('loginPage.otpNotEnabled'));
        } else if (error.message.includes("rate limit") || error.message.includes("429")) {
          setError(t('loginPage.tooManyAttempts'));
        } else {
          setError(error.message);
        }
      } else {
        setOtpSent(true);
        setSuccess(t('loginPage.otpSent'));
      }
    } catch {
      setError(t('loginPage.sendError'));
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
          setError(t('loginPage.codeExpired'));
        } else {
          setError(t('loginPage.invalidCode'));
        }
      }
    } catch {
      sessionStorage.removeItem('just_logged_in');
      setError(t('loginPage.verifyError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    if (registerPassword !== confirmPassword) {
      setError(t('loginPage.passwordMismatch'));
      return;
    }
    
    if (registerPassword.length < 6) {
      setError(t('loginPage.passwordMinLength'));
      return;
    }

    if (!termsAccepted) {
      setError('Debes aceptar los Términos y Condiciones para continuar.');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await signUp(registerEmail, registerPassword, registerName, new Date().toISOString());
      if (error) {
        if (error.message.includes("already registered")) {
          setError(t('loginPage.alreadyRegistered'));
        } else {
          setError(error.message);
        }
      } else {
        setSuccess(t('loginPage.accountCreated'));
        setRegisterName("");
        setRegisterEmail("");
        setRegisterPassword("");
        setConfirmPassword("");
        setTermsAccepted(false);
      }
    } catch (err) {
      setError(t('loginPage.createError'));
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
            <h1 className="text-3xl font-bold text-foreground mb-2">{t('loginPage.welcome', { name: getValue('platform_name') })}</h1>
            <p className="text-muted-foreground">{getValue('platform_slogan')}</p>
          </div>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl text-center">{t('loginPage.access')}</CardTitle>
              <CardDescription className="text-center">
                {t('loginPage.loginOrCreate')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={defaultTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="login">{t('loginPage.passwordTab')}</TabsTrigger>
                  <TabsTrigger value="otp">
                    <KeyRound className="h-3 w-3 mr-1" />
                    {t('loginPage.emailCodeTab')}
                  </TabsTrigger>
                  <TabsTrigger value="register">{t('loginPage.registerTab')}</TabsTrigger>
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
                      <Label htmlFor="login-email">{t('auth.email')}</Label>
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
                        <Label htmlFor="login-password">{t('loginPage.passwordLabel')}</Label>
                        <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                          {t('auth.forgotPassword')}
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

                    {/* Terms & Conditions checkbox for login */}
                    <div className="flex items-start gap-3 p-3 bg-muted/40 rounded-lg border">
                      <Checkbox
                        id="login-terms-accepted"
                        checked={loginTermsAccepted}
                        onCheckedChange={(v) => setLoginTermsAccepted(v === true)}
                        className="mt-0.5 shrink-0"
                      />
                      <label htmlFor="login-terms-accepted" className="text-xs text-muted-foreground leading-relaxed cursor-pointer select-none">
                        Acepto los{' '}
                        <button
                          type="button"
                          onClick={() => setShowLegal(true)}
                          className="text-primary underline hover:no-underline font-medium"
                        >
                          Términos y Condiciones
                        </button>{' '}y la{' '}
                        <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline font-medium">
                          Política de Privacidad
                        </a>.
                      </label>
                    </div>

                    <Button type="submit" className="w-full" disabled={isLoading || !loginTermsAccepted}>
                      {isLoading ? t('loginPage.loggingIn') : t('loginPage.loginButton')}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="otp">
                  {!otpSent ? (
                    <form onSubmit={handleSendOTP} className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        {t('loginPage.otpDescription')}
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="otp-email">{t('auth.email')}</Label>
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
                        {isLoading ? t('loginPage.sending') : t('loginPage.sendCode')}
                      </Button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyOTP} className="space-y-4">
                      <p className="text-sm text-muted-foreground text-center">
                        {t('loginPage.enterCode')} <strong>{otpEmail}</strong>
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
                        {isLoading ? t('loginPage.verifying') : t('loginPage.verifyCode')}
                      </Button>
                      <Button type="button" variant="ghost" className="w-full" onClick={() => { setOtpSent(false); setOtpCode(""); setError(null); setSuccess(null); }}>
                        {t('loginPage.newCode')}
                      </Button>
                    </form>
                  )}
                </TabsContent>

                <TabsContent value="register">
                  {accountType === null && (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground text-center">{t('loginPage.accountTypeQuestion')}</p>
                      <button
                        type="button"
                        onClick={() => setAccountType('buyer')}
                        className="w-full flex items-center gap-4 p-4 border-2 border-border rounded-xl hover:border-primary hover:bg-primary/5 transition group text-left"
                      >
                        <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition">
                          <ShoppingBag className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">{t('loginPage.buyerAccount')}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{t('loginPage.buyerAccountDesc')}</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // Register as buyer first, then after login they'll be prompted to upgrade
                          setAccountType('buyer');
                          sessionStorage.setItem('pending_seller_upgrade', 'true');
                        }}
                        className="w-full flex items-center gap-4 p-4 border-2 border-border rounded-xl hover:border-green-500 hover:bg-green-50 transition group text-left"
                      >
                        <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition">
                          <Store className="h-6 w-6 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">{t('loginPage.sellerAccount')}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Crea tu cuenta y luego activa tu tienda desde tu perfil</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-green-500 transition" />
                      </button>
                    </div>
                  )}

                  {accountType === 'buyer' && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setAccountType(null)}
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        {t('loginPage.changeAccountType')}
                      </button>
                      <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-name">{t('loginPage.fullName')}</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="register-name"
                          type="text"
                          placeholder={t('loginPage.yourName')}
                          className="pl-10"
                          value={registerName}
                          onChange={(e) => setRegisterName(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-email">{t('auth.email')}</Label>
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
                      <Label htmlFor="register-password">{t('loginPage.passwordLabel')}</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="register-password"
                          type={showPassword ? "text" : "password"}
                          placeholder={t('loginPage.minChars')}
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
                      <Label htmlFor="confirm-password">{t('loginPage.confirmPassword')}</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="confirm-password"
                          type={showPassword ? "text" : "password"}
                          placeholder={t('loginPage.repeatPassword')}
                          className="pl-10"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    {/* Terms & Conditions checkbox */}
                    <div className="flex items-start gap-3 p-3 bg-muted/40 rounded-lg border">
                      <Checkbox
                        id="terms-accepted"
                        checked={termsAccepted}
                        onCheckedChange={(v) => setTermsAccepted(v === true)}
                        className="mt-0.5 shrink-0"
                      />
                      <label htmlFor="terms-accepted" className="text-xs text-muted-foreground leading-relaxed cursor-pointer select-none">
                        He leído y acepto los{' '}
                        <button
                          type="button"
                          onClick={() => setShowLegal(true)}
                          className="text-primary underline hover:no-underline font-medium"
                        >
                          Términos y Condiciones
                        </button>
                        ,{' '}
                        <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline font-medium">
                          Política de Privacidad
                        </a>{' '}y{' '}
                        <a href="/devoluciones" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline font-medium">
                          Política de Devoluciones
                        </a>
                        .
                      </label>
                    </div>

                    <Button type="submit" className="w-full" disabled={isLoading || !termsAccepted}>
                      {isLoading ? t('loginPage.creatingAccount') : t('loginPage.createAccountBtn')}
                    </Button>
                  </form>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <div className="mt-6 pt-6 border-t space-y-3">
                <p className="text-sm text-center text-muted-foreground mb-4">
                  {t('loginPage.wantToSell', { name: getValue('platform_name') })}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      sessionStorage.setItem('pending_seller_upgrade', 'true');
                      // Switch to register tab with buyer type
                      setAccountType('buyer');
                    }}
                  >
                    <Store className="h-4 w-4" />
                    {t('loginPage.beSeller')}
                  </Button>
                  <Button variant="outline" asChild className="gap-2">
                    <Link to="/">
                      <ShoppingBag className="h-4 w-4" />
                      {t('loginPage.explore')}
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
                    {t('loginPage.legalTerms')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setShowAbout(true)}
                  >
                    <Info className="h-3.5 w-3.5" />
                    {t('loginPage.about')}
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
