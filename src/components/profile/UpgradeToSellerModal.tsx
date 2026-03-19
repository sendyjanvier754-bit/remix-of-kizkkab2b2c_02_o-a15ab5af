import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { generateUniqueStoreSlug } from "@/utils/storeSlugGenerator";
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
  const navigate = useNavigate();
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
      // 1. Delete existing role
      await supabase.from('user_roles').delete().eq('user_id', user.id);

      // 2. Insert seller role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: user.id, role: 'seller' as any });
      if (roleError && !roleError.message.includes('duplicate')) throw roleError;

      // 3. Wait for trigger or create store
      let storeCreated = false;
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 300));
        const { data: store } = await supabase.from('stores').select('id').eq('owner_user_id', user.id).maybeSingle();
        if (store) {
          // Update with user's chosen name
          await supabase.from('stores').update({ name: storeName, description: storeDescription || `Tienda de ${storeName}` }).eq('id', store.id);
          storeCreated = true;
          break;
        }
      }

      if (!storeCreated) {
        const slug = await generateUniqueStoreSlug(async (candidate) => {
          const { data } = await supabase.from('stores').select('id').eq('slug', candidate).maybeSingle();
          return data === null;
        });
        if (slug) {
          await supabase.from('stores').insert({
            owner_user_id: user.id,
            name: storeName,
            description: storeDescription || `Tienda de ${storeName}`,
            slug,
            is_active: true,
            is_accepting_orders: true,
            show_stock: true,
            country: 'Haiti',
          });
        }
      }

      // 4. Create seller record
      const { data: existingSeller } = await supabase.from('sellers').select('id').eq('user_id', user.id).maybeSingle();
      if (!existingSeller) {
        await supabase.from('sellers').insert({
          user_id: user.id,
          email: user.email || '',
          name: storeName,
          business_name: storeName,
          is_verified: false,
        });
      }

      // 5. Init onboarding progress
      await supabase.from('seller_onboarding_progress').upsert({
        user_id: user.id,
        steps_completed: { store_info: true },
        current_step: 'social_media',
        is_complete: false,
      }, { onConflict: 'user_id' });

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
            Convertirse en Vendedor
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
