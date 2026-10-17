import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Eye, EyeOff, LogIn, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().trim().email({ message: "Email inválido" }).max(255),
  password: z.string().min(6, { message: "Mínimo 6 caracteres" }).max(100),
});

const PurchasingAgentLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session, role, isLoading: authLoading, signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (session && role) {
      if (role === 'purchasing_agent' || role === 'admin') {
        navigate("/agente-compra", { replace: true });
      } else {
        setAccessDenied(true);
      }
    }
  }, [session, role, authLoading, navigate]);

  const validateForm = () => {
    try {
      authSchema.parse({ email, password });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true);
    setAccessDenied(false);

    try {
      const { error } = await signIn(email, password);

      if (error) {
        let message = "Credenciales incorrectas";
        if (error.message.includes("Invalid login")) {
          message = "Email o contraseña incorrectos";
        } else if (error.message.includes("Email not confirmed")) {
          message = "Por favor confirma tu email primero";
        }
        toast({
          title: "Error de acceso",
          description: message,
          variant: "destructive",
        });
        return;
      }

      // Role check will happen via useEffect after auth state updates
    } catch (error) {
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoutAndRetry = async () => {
    await supabase.auth.signOut();
    setAccessDenied(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute top-1/4 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl" />

      <div className="w-full max-w-md relative z-10">
        <Card className="shadow-2xl border-blue-500/20 bg-card/95 backdrop-blur-sm">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Portal Agente de Compra</CardTitle>
            <CardDescription>
              Acceso exclusivo para agentes de compra autorizados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {accessDenied ? (
              <div className="space-y-4 text-center">
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive font-medium">
                    Tu cuenta no tiene permisos de agente de compra.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Contacta al administrador para obtener acceso.
                  </p>
                </div>
                <Button variant="outline" onClick={handleLogoutAndRetry} className="w-full">
                  Intentar con otra cuenta
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="agente@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={errors.email ? "border-destructive" : ""}
                    required
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={errors.password ? "border-destructive" : ""}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>

                <Button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white" size="lg" disabled={isLoading}>
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                      Ingresando...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <LogIn className="w-4 h-4" />
                      Ingresar al Portal
                    </span>
                  )}
                </Button>
              </form>
            )}

            <div className="mt-6 pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
                <Package className="w-3 h-3" />
                <span>Sistema de Gestión de Compras Internacionales</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PurchasingAgentLogin;
