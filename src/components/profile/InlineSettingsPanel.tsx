import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Lock, Bell, Eye, EyeOff, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

export function InlineSettingsPanel() {
  const { user } = useAuth();

  // Password change
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwds, setShowPwds] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);

  const handleChangePwd = async () => {
    if (!newPwd || newPwd.length < 6) {
      toast.error("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (newPwd !== confirmPwd) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    try {
      setChangingPwd(true);
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      toast.success("Contraseña actualizada correctamente");
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (e: any) {
      toast.error(e.message || "Error al cambiar contraseña");
    } finally {
      setChangingPwd(false);
    }
  };

  return (
    <div className="space-y-4">

      {/* Account info section */}
      <div className="bg-background border border-border rounded-md overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
          <Settings className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Información de Cuenta</h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-xs text-muted-foreground">Correo electrónico</span>
            <span className="text-xs font-medium text-foreground">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-xs text-muted-foreground">Nombre</span>
            <span className="text-xs font-medium text-foreground">{user?.name || "—"}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-muted-foreground">ID de cuenta</span>
            <span className="text-xs font-mono text-muted-foreground">{user?.id?.slice(0, 12)}…</span>
          </div>
          <div className="pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = "/editar-perfil"}
              className="text-xs h-8"
            >
              Editar perfil completo
            </Button>
          </div>
        </div>
      </div>

      {/* Change password section */}
      <div className="bg-background border border-border rounded-md overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Cambiar Contraseña</h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <Label className="text-xs">Nueva contraseña</Label>
            <div className="relative mt-1">
              <Input
                type={showPwds ? "text" : "password"}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="h-9 pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPwds(!showPwds)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPwds ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div>
            <Label className="text-xs">Confirmar nueva contraseña</Label>
            <Input
              type={showPwds ? "text" : "password"}
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              placeholder="Repite la nueva contraseña"
              className="h-9 mt-1"
            />
          </div>
          {newPwd && confirmPwd && newPwd === confirmPwd && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <Check className="w-3 h-3" /> Las contraseñas coinciden
            </p>
          )}
          <Button
            size="sm"
            onClick={handleChangePwd}
            disabled={changingPwd || !newPwd || !confirmPwd}
            className="h-8 text-xs"
          >
            {changingPwd && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
            Cambiar contraseña
          </Button>
        </div>
      </div>

      {/* Notifications section — placeholder */}
      <div className="bg-background border border-border rounded-md overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Notificaciones</h2>
        </div>
        <div className="px-5 py-4 space-y-2.5">
          {[
            { label: "Actualizaciones de pedidos", defaultOn: true },
            { label: "Promociones y descuentos",   defaultOn: false },
            { label: "Recordatorios de carrito",   defaultOn: false },
          ].map((pref) => (
            <label key={pref.label} className="flex items-center justify-between cursor-pointer py-1">
              <span className="text-xs text-foreground">{pref.label}</span>
              <div className="relative">
                <input
                  type="checkbox"
                  defaultChecked={pref.defaultOn}
                  className="sr-only peer"
                  onChange={() => toast.info("Preferencias guardadas (demo)")}
                />
                <div className="w-9 h-5 bg-muted rounded-full peer-checked:bg-primary transition-colors cursor-pointer" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
