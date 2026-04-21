import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Warehouse, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpgradeToGrossisteModal({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  // Pre-fill from sessionStorage if the user came from the registration flow
  useEffect(() => {
    if (open) {
      const pendingName = sessionStorage.getItem('pending_grossiste_business_name');
      const pendingDesc = sessionStorage.getItem('pending_grossiste_description');
      if (pendingName) setBusinessName(pendingName);
      if (pendingDesc) setDescription(pendingDesc);
    }
  }, [open]);

  const handleUpgrade = async () => {
    if (!user?.id || !businessName.trim()) {
      toast.error("Por favor ingresa el nombre de tu negocio mayorista");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc('upgrade_to_grossiste', {
        p_business_name: businessName.trim(),
        p_description: description.trim() || null,
      });

      if (error) throw error;

      // Clean up flags
      sessionStorage.removeItem('pending_grossiste_upgrade');
      sessionStorage.removeItem('pending_grossiste_business_name');
      sessionStorage.removeItem('pending_grossiste_description');
      if (user?.id) localStorage.removeItem(`pending_grossiste_upgrade_${user.id}`);

      toast.success("¡Cuenta de mayorista creada! Bienvenido al panel grossiste.");
      onOpenChange(false);

      // Force reload to refresh role context, then navigate to grossiste dashboard
      window.location.href = '/grossiste/dashboard';
    } catch (error: any) {
      console.error('Grossiste upgrade error:', error);
      toast.error("Error al crear cuenta de mayorista: " + (error.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Warehouse className="w-5 h-5 text-emerald-600" />
            Registro de mayorista
          </DialogTitle>
          <DialogDescription>
            Crea tu cuenta de mayorista (Grossiste). Podrás publicar productos al catálogo B2B y gestionar tus pedidos al por mayor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="grossiste-business-name">Nombre comercial *</Label>
            <Input
              id="grossiste-business-name"
              placeholder="Ej: Distribuidora Caribe"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="grossiste-desc">Descripción del negocio (opcional)</Label>
            <Textarea
              id="grossiste-desc"
              placeholder="Describe brevemente tu actividad mayorista, categorías, etc."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              maxLength={400}
            />
          </div>

          <Button
            className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleUpgrade}
            disabled={loading || !businessName.trim()}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Warehouse className="w-4 h-4" />}
            {loading ? "Creando cuenta..." : "Crear mi cuenta mayorista"}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Podrás completar tu perfil fiscal y comercial después en el panel.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
