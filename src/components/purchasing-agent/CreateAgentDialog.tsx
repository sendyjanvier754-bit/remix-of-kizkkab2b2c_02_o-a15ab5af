import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldCheck, Copy, Check, UserPlus, ExternalLink } from "lucide-react";

interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

type Step = "form" | "success";

export function CreateAgentDialog({ open, onOpenChange, onCreated }: CreateAgentDialogProps) {
  const [step, setStep] = useState<Step>("form");
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    country_code: "CN",
    country_name: "China",
  });

  const [createdCredentials, setCreatedCredentials] = useState({
    email: "",
    password: "",
    portalUrl: "",
  });

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$";
    let pass = "";
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, password: pass }));
  };

  const handleCreate = async () => {
    if (!formData.full_name || !formData.email || !formData.password) {
      toast.error("Completa todos los campos obligatorios");
      return;
    }

    setIsCreating(true);

    try {
      // 1. Create auth user via Supabase signUp (using admin workaround: sign up, then assign role)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
          },
        },
      });

      if (authError) throw new Error(`Error creando cuenta: ${authError.message}`);
      if (!authData.user) throw new Error("No se pudo crear el usuario");

      const userId = authData.user.id;

      // 2. Assign purchasing_agent role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "purchasing_agent" });

      if (roleError) {
        console.error("Role assignment error:", roleError);
        // Don't throw - user is created, role can be assigned manually
        toast.warning("Cuenta creada pero el rol debe asignarse manualmente");
      }

      // 3. Create purchasing_agents profile
      const agentCode = `AGT-${Date.now().toString(36).toUpperCase()}`;
      const { error: profileError } = await supabase
        .from("purchasing_agents")
        .insert({
          user_id: userId,
          agent_code: agentCode,
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone || null,
          country_code: formData.country_code,
          country_name: formData.country_name,
          status: "active",
        });

      if (profileError) {
        console.error("Profile creation error:", profileError);
        toast.warning("Cuenta y rol creados, pero el perfil de agente debe configurarse");
      }

      // 4. Sign out the newly created user (admin stays logged in via their own session)
      // Note: signUp in Supabase doesn't auto-login if email confirmation is enabled
      
      const portalUrl = `${window.location.origin}/agente-compra/login`;
      setCreatedCredentials({
        email: formData.email,
        password: formData.password,
        portalUrl,
      });

      setStep("success");
      toast.success("Agente de compra creado exitosamente");
      onCreated?.();
    } catch (error: any) {
      toast.error(error.message || "Error al crear el agente");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyCredentials = () => {
    const text = `🔐 Portal Agente de Compra\n\n📧 Email: ${createdCredentials.email}\n🔑 Contraseña: ${createdCredentials.password}\n🌐 Portal: ${createdCredentials.portalUrl}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Credenciales copiadas al portapapeles");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setStep("form");
      setFormData({
        full_name: "",
        email: "",
        password: "",
        phone: "",
        country_code: "CN",
        country_name: "China",
      });
      setCopied(false);
    }
    onOpenChange(isOpen);
  };

  const countries: Record<string, string> = {
    CN: "China",
    US: "Estados Unidos",
    MX: "México",
    CO: "Colombia",
    PA: "Panamá",
    TR: "Turquía",
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-md">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle>{step === "form" ? "Crear Agente de Compra" : "¡Agente Creado!"}</DialogTitle>
              <DialogDescription>
                {step === "form"
                  ? "Crea una cuenta con acceso al portal de compras"
                  : "Comparte las credenciales con el agente"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === "form" ? (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nombre Completo *</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                placeholder="Wang Li"
              />
            </div>

            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="agente@ejemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Contraseña *</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Mínimo 6 caracteres"
                />
                <Button type="button" variant="outline" size="sm" onClick={generatePassword} className="shrink-0">
                  Generar
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+86 123 456 7890"
              />
            </div>

            <div className="space-y-2">
              <Label>País de Operación</Label>
              <Select
                value={formData.country_code}
                onValueChange={(value) =>
                  setFormData(prev => ({
                    ...prev,
                    country_code: value,
                    country_name: countries[value] || value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(countries).map(([code, name]) => (
                    <SelectItem key={code} value={code}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleCreate}
              disabled={isCreating || !formData.full_name || !formData.email || !formData.password}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white"
            >
              {isCreating ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                  Creando cuenta...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  Crear Agente
                </span>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3 border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Email</span>
                <span className="text-sm font-mono font-medium">{createdCredentials.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Contraseña</span>
                <span className="text-sm font-mono font-medium">{createdCredentials.password}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Portal</span>
                <a
                  href={createdCredentials.portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  Abrir <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <Button onClick={handleCopyCredentials} variant="outline" className="w-full">
              {copied ? (
                <span className="flex items-center gap-2 text-green-600">
                  <Check className="w-4 h-4" />
                  ¡Copiado!
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Copy className="w-4 h-4" />
                  Copiar Credenciales
                </span>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Envía estas credenciales al agente de forma segura. El agente podrá cambiar su contraseña después de iniciar sesión.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
