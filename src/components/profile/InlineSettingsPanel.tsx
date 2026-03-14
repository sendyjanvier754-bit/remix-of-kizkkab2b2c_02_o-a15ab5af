import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Lock, Bell, Eye, EyeOff, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function InlineSettingsPanel() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwds, setShowPwds] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);

  const handleChangePwd = async () => {
    if (!newPwd || newPwd.length < 6) {
      toast.error(t('settingsPanel.passwordMinError'));
      return;
    }
    if (newPwd !== confirmPwd) {
      toast.error(t('settingsPanel.passwordMismatch'));
      return;
    }
    try {
      setChangingPwd(true);
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      toast.success(t('settingsPanel.passwordUpdated'));
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (e: any) {
      toast.error(e.message || t('settingsPanel.passwordError'));
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
          <h2 className="text-sm font-bold text-foreground">{t('settingsPanel.accountInfo')}</h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-xs text-muted-foreground">{t('settingsPanel.emailLabel')}</span>
            <span className="text-xs font-medium text-foreground">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-xs text-muted-foreground">{t('settingsPanel.nameLabel')}</span>
            <span className="text-xs font-medium text-foreground">{user?.name || "—"}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-muted-foreground">{t('settingsPanel.accountId')}</span>
            <span className="text-xs font-mono text-muted-foreground">{user?.id?.slice(0, 12)}…</span>
          </div>
          <div className="pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = "/editar-perfil"}
              className="text-xs h-8"
            >
              {t('settingsPanel.editFullProfile')}
            </Button>
          </div>
        </div>
      </div>

      {/* Change password section */}
      <div className="bg-background border border-border rounded-md overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">{t('settingsPanel.changePassword')}</h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <Label className="text-xs">{t('settingsPanel.newPassword')}</Label>
            <div className="relative mt-1">
              <Input
                type={showPwds ? "text" : "password"}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder={t('settingsPanel.minChars')}
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
            <Label className="text-xs">{t('settingsPanel.confirmNewPassword')}</Label>
            <Input
              type={showPwds ? "text" : "password"}
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              placeholder={t('settingsPanel.repeatNewPassword')}
              className="h-9 mt-1"
            />
          </div>
          {newPwd && confirmPwd && newPwd === confirmPwd && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <Check className="w-3 h-3" /> {t('settingsPanel.passwordsMatch')}
            </p>
          )}
          <Button
            size="sm"
            onClick={handleChangePwd}
            disabled={changingPwd || !newPwd || !confirmPwd}
            className="h-8 text-xs"
          >
            {changingPwd && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
            {t('settingsPanel.changePasswordBtn')}
          </Button>
        </div>
      </div>

      {/* Notifications section */}
      <div className="bg-background border border-border rounded-md overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">{t('settingsPanel.notifications')}</h2>
        </div>
        <div className="px-5 py-4 space-y-2.5">
          {[
            { label: t('settingsPanel.orderUpdates'), defaultOn: true },
            { label: t('settingsPanel.promotions'), defaultOn: false },
            { label: t('settingsPanel.cartReminders'), defaultOn: false },
          ].map((pref) => (
            <label key={pref.label} className="flex items-center justify-between cursor-pointer py-1">
              <span className="text-xs text-foreground">{pref.label}</span>
              <div className="relative">
                <input
                  type="checkbox"
                  defaultChecked={pref.defaultOn}
                  className="sr-only peer"
                  onChange={() => toast.info(t('settingsPanel.prefsSaved'))}
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
