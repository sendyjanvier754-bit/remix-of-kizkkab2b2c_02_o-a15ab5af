import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Store, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpgradeToSellerModal({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [storeName, setStoreName] = useState("");
  const [storeDescription, setStoreDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    if (!user?.id || !storeName.trim()) {
      toast.error("Por favor ingresa el nombre de tu tienda");
      return;
    }

    setLoading(true);
    try {
      // Call the SECURITY DEFINER RPC function that handles the full upgrade atomically
      const { data, error } = await supabase.rpc('upgrade_to_seller', {
        p_store_name: storeName.trim(),
        p_store_description: storeDescription.trim() || null,
      });

      if (error) throw error;

      // Clean up all pending flags
      sessionStorage.removeItem('pending_seller_upgrade');
      if (user?.id) localStorage.removeItem(`pending_seller_upgrade_${user.id}`);

      toast.success("¡Cuenta de vendedor creada! Continúa configurando tu tienda.");
      onOpenChange(false);
      
      // Force page reload to update role context, then navigate
      window.location.href = '/seller/cuenta';
    } catch (error: any) {
      console.error('Upgrade error:', error);
      toast.error("Error al crear cuenta de vendedor: " + (error.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" />
            Registro de vendedor
          </DialogTitle>
          <DialogDescription>
            Crea tu tienda en minutos. Solo necesitas un nombre y una descripción para comenzar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="store-name">Nombre de tu tienda *</Label>
            <Input
              id="store-name"
              placeholder="Ej: Mi Boutique"
              value={storeName}
              onChange={e => setStoreName(e.target.value)}
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="store-desc">Descripción (opcional)</Label>
            <Textarea
              id="store-desc"
              placeholder="Describe brevemente tu tienda..."
              value={storeDescription}
              onChange={e => setStoreDescription(e.target.value)}
              rows={3}
              maxLength={300}
            />
          </div>

          <Button
            className="w-full gap-2"
            onClick={handleUpgrade}
            disabled={loading || !storeName.trim()}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Store className="w-4 h-4" />}
            {loading ? "Creando tienda..." : "Crear mi tienda"}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Podrás completar tu perfil de vendedor después de crear la tienda.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
