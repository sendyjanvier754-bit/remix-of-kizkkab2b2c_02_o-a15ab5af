import { useState } from "react";
import {
  CreditCard, Smartphone, Banknote, Loader2, Building2,
  CheckCircle2, Plus, Pencil, Trash2, X, Save, Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAdminPaymentMethods, PaymentMethod } from "@/hooks/usePaymentMethods";
import { useUserPaymentProfiles, UserPaymentProfile, UserPaymentProfileInput } from "@/hooks/useUserPaymentProfiles";

/* ─── Icons & Labels ─────────────────────────────────────────────────── */
const methodIcons: Record<string, React.ReactNode> = {
  bank:    <Building2 className="w-5 h-5 text-blue-600" />,
  moncash: <Smartphone className="w-5 h-5 text-orange-500" />,
  natcash: <Smartphone className="w-5 h-5 text-green-600" />,
  stripe:  <CreditCard className="w-5 h-5 text-purple-600" />,
};
const methodLabels: Record<string, string> = {
  bank:    "Transferencia Bancaria",
  moncash: "MonCash",
  natcash: "NatCash",
  stripe:  "Tarjeta de Crédito",
};
const methodBg: Record<string, string> = {
  bank:    "bg-blue-50",
  moncash: "bg-orange-50",
  natcash: "bg-green-50",
  stripe:  "bg-purple-50",
};

/* ─── Form state type ─────────────────────────────────────────────────── */
interface FormState {
  label: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  account_type: string;
  bank_swift: string;
  phone_number: string;
  holder_name: string;
}

const emptyForm = (): FormState => ({
  label: "",
  bank_name: "",
  account_number: "",
  account_holder: "",
  account_type: "",
  bank_swift: "",
  phone_number: "",
  holder_name: "",
});

const profileToForm = (p: UserPaymentProfile): FormState => ({
  label: p.label ?? "",
  bank_name: p.bank_name ?? "",
  account_number: p.account_number ?? "",
  account_holder: p.account_holder ?? "",
  account_type: p.account_type ?? "",
  bank_swift: p.bank_swift ?? "",
  phone_number: p.phone_number ?? "",
  holder_name: p.holder_name ?? "",
});

/* ─── Configured method card ─────────────────────────────────────────── */
function ConfiguredCard({
  adminMethod,
  profile,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  adminMethod: PaymentMethod;
  profile: UserPaymentProfile;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}) {
  const label = profile.label || adminMethod.display_name || methodLabels[adminMethod.method_type];
  const bg = methodBg[adminMethod.method_type] ?? "bg-muted";

  return (
    <div className="border border-border rounded-xl p-4 flex gap-3 items-start relative">
      {/* default star */}
      {profile.is_default && (
        <span className="absolute top-2 right-2">
          <Star className="w-4 h-4 text-yellow-500 fill-yellow-400" />
        </span>
      )}
      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
        {methodIcons[adminMethod.method_type] ?? <Banknote className="w-5 h-5 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">{label}</span>
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-green-400 text-green-700">
            <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />Configurado
          </Badge>
        </div>

        {/* Bank details */}
        {adminMethod.method_type === "bank" && (
          <div className="mt-1 space-y-0.5">
            {profile.bank_name && <p className="text-xs text-muted-foreground">Banco: <span className="text-foreground font-medium">{profile.bank_name}</span></p>}
            {profile.account_holder && <p className="text-xs text-muted-foreground">Titular: <span className="text-foreground font-medium">{profile.account_holder}</span></p>}
            {profile.account_number && (
              <p className="text-xs text-muted-foreground">Cuenta: <span className="text-foreground font-mono font-medium">
                {"•".repeat(Math.max(0, profile.account_number.length - 4))}{profile.account_number.slice(-4)}
              </span></p>
            )}
          </div>
        )}

        {/* Mobile money details */}
        {(adminMethod.method_type === "moncash" || adminMethod.method_type === "natcash") && (
          <div className="mt-1 space-y-0.5">
            {profile.phone_number && <p className="text-xs text-muted-foreground">Número: <span className="text-foreground font-medium">{profile.phone_number}</span></p>}
            {profile.holder_name && <p className="text-xs text-muted-foreground">Nombre: <span className="text-foreground font-medium">{profile.holder_name}</span></p>}
          </div>
        )}

        {/* Stripe */}
        {adminMethod.method_type === "stripe" && profile.card_last4 && (
          <p className="mt-1 text-xs text-muted-foreground capitalize">
            {profile.card_brand} •••• {profile.card_last4}
            {profile.card_exp_month && profile.card_exp_year && (
              <> · {String(profile.card_exp_month).padStart(2, "0")}/{profile.card_exp_year}</>
            )}
          </p>
        )}

        <div className="flex items-center gap-2 mt-2">
          {!profile.is_default && (
            <button onClick={onSetDefault} className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5">
              <Star className="w-3 h-3" /> Predeterminar
            </button>
          )}
          <button onClick={onEdit} className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5 ml-auto">
            <Pencil className="w-3 h-3" /> Editar
          </button>
          <button onClick={onDelete} className="text-[10px] text-muted-foreground hover:text-destructive transition-colors flex items-center gap-0.5">
            <Trash2 className="w-3 h-3" /> Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Empty (not configured) card ────────────────────────────────────── */
function EmptyCard({
  adminMethod,
  onConfigure,
}: {
  adminMethod: PaymentMethod;
  onConfigure: () => void;
}) {
  const label = adminMethod.display_name || methodLabels[adminMethod.method_type];
  const bg = methodBg[adminMethod.method_type] ?? "bg-muted";

  return (
    <div className="border border-dashed border-border rounded-xl p-4 flex gap-3 items-center opacity-80 hover:opacity-100 transition-opacity">
      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
        {methodIcons[adminMethod.method_type] ?? <Banknote className="w-5 h-5 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">No configurado</p>
      </div>
      <Button size="sm" variant="outline" onClick={onConfigure} className="gap-1 shrink-0">
        <Plus className="w-3.5 h-3.5" /> Configurar
      </Button>
    </div>
  );
}

/* ─── Configuration dialog ────────────────────────────────────────────── */
function ConfigDialog({
  open,
  adminMethod,
  existing,
  onClose,
  onSave,
}: {
  open: boolean;
  adminMethod: PaymentMethod | null;
  existing: UserPaymentProfile | null;
  onClose: () => void;
  onSave: (input: UserPaymentProfileInput) => Promise<boolean>;
}) {
  const [form, setForm] = useState<FormState>(existing ? profileToForm(existing) : emptyForm());
  const [saving, setSaving] = useState(false);

  // Reset form whenever the dialog opens with a different method/profile
  // We use a key on the Dialog instead (see parent), but also sync here
  const currentKey = `${adminMethod?.id ?? ""}:${existing?.id ?? "new"}`;
  const [lastKey, setLastKey] = useState(currentKey);
  if (currentKey !== lastKey) {
    setLastKey(currentKey);
    setForm(existing ? profileToForm(existing) : emptyForm());
  }

  if (!adminMethod) return null;
  const isEditing = !!existing;
  const type = adminMethod.method_type;

  const set = (key: keyof FormState, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    const ok = await onSave({
      admin_payment_method_id: adminMethod.id,
      method_type: type,
      label: form.label || undefined,
      bank_name: form.bank_name || undefined,
      account_number: form.account_number || undefined,
      account_holder: form.account_holder || undefined,
      account_type: form.account_type || undefined,
      bank_swift: form.bank_swift || undefined,
      phone_number: form.phone_number || undefined,
      holder_name: form.holder_name || undefined,
    });
    setSaving(false);
    if (ok) onClose();
  };

  const methodName = adminMethod.display_name || methodLabels[type];

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {methodIcons[type]}
            {isEditing ? `Editar ${methodName}` : `Configurar ${methodName}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Label / alias */}
          <div className="space-y-1">
            <Label htmlFor="label" className="text-xs">Alias (opcional)</Label>
            <Input id="label" placeholder={`Ej: Mi ${methodName} principal`} value={form.label} onChange={e => set("label", e.target.value)} />
          </div>

          {/* Bank fields */}
          {type === "bank" && (
            <>
              <div className="space-y-1">
                <Label htmlFor="bank_name" className="text-xs">Nombre del banco <span className="text-destructive">*</span></Label>
                <Input id="bank_name" placeholder="Ej: BNC, Digicel Bank…" value={form.bank_name} onChange={e => set("bank_name", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="account_holder" className="text-xs">Titular de la cuenta <span className="text-destructive">*</span></Label>
                <Input id="account_holder" placeholder="Nombre completo" value={form.account_holder} onChange={e => set("account_holder", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="account_number" className="text-xs">Número de cuenta <span className="text-destructive">*</span></Label>
                <Input id="account_number" placeholder="0000 0000 0000" value={form.account_number} onChange={e => set("account_number", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="account_type" className="text-xs">Tipo de cuenta</Label>
                <Input id="account_type" placeholder="Corriente / Ahorros" value={form.account_type} onChange={e => set("account_type", e.target.value)} />
              </div>
            </>
          )}

          {/* MonCash / NatCash fields */}
          {(type === "moncash" || type === "natcash") && (
            <>
              <div className="space-y-1">
                <Label htmlFor="phone_number" className="text-xs">Número de teléfono <span className="text-destructive">*</span></Label>
                <Input
                  id="phone_number"
                  type="tel"
                  placeholder="+509 XXXX XXXX"
                  value={form.phone_number}
                  onChange={e => set("phone_number", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="holder_name" className="text-xs">Nombre del titular <span className="text-destructive">*</span></Label>
                <Input id="holder_name" placeholder="Nombre registrado en la cuenta" value={form.holder_name} onChange={e => set("holder_name", e.target.value)} />
              </div>
            </>
          )}

          {/* Stripe */}
          {type === "stripe" && (
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-purple-600" /> Tarjeta de Crédito/Débito
              </p>
              <p>Al guardar, serás redirigido al formulario seguro de Stripe para agregar tu tarjeta. Tu número de tarjeta nunca se almacena en nuestros servidores.</p>
              {existing?.card_last4 && (
                <p className="text-foreground font-medium capitalize mt-1">
                  Tarjeta actual: {existing.card_brand} •••• {existing.card_last4}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            <X className="w-3.5 h-3.5 mr-1" /> Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
            {isEditing ? "Actualizar" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main panel ─────────────────────────────────────────────────────── */
export function InlinePaymentPanel() {
  const { methods, isLoading: adminLoading } = useAdminPaymentMethods();
  const { profiles, isLoading: profilesLoading, saveProfile, deleteProfile } = useUserPaymentProfiles();

  const [dialogMethod, setDialogMethod] = useState<PaymentMethod | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserPaymentProfile | null>(null);

  const activeMethods = methods.filter(m => m.is_active);
  const isLoading = adminLoading || profilesLoading;

  const handleSetDefault = async (profile: UserPaymentProfile, adminMethod: PaymentMethod) => {
    await saveProfile({
      admin_payment_method_id: adminMethod.id,
      method_type: adminMethod.method_type as 'bank' | 'moncash' | 'natcash' | 'stripe',
      label: profile.label ?? undefined,
      bank_name: profile.bank_name ?? undefined,
      account_number: profile.account_number ?? undefined,
      account_holder: profile.account_holder ?? undefined,
      account_type: profile.account_type ?? undefined,
      bank_swift: profile.bank_swift ?? undefined,
      phone_number: profile.phone_number ?? undefined,
      holder_name: profile.holder_name ?? undefined,
      is_default: true,
    });
  };

  if (isLoading) {
    return (
      <div className="bg-background border border-border rounded-xl p-10 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-background border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-primary" />
        <div>
          <h2 className="text-sm font-bold text-foreground">Mis Métodos de Pago</h2>
          <p className="text-xs text-muted-foreground">Configura tus cuentas para pagar y recibir reembolsos</p>
        </div>
      </div>

      {activeMethods.length === 0 ? (
        <div className="py-14 flex flex-col items-center gap-2 text-center px-6">
          <CreditCard className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No hay métodos de pago disponibles actualmente</p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {activeMethods.map(adminMethod => {
            const profile = profiles.find(p => p.admin_payment_method_id === adminMethod.id) ?? null;
            return profile ? (
              <ConfiguredCard
                key={adminMethod.id}
                adminMethod={adminMethod}
                profile={profile}
                onEdit={() => setDialogMethod(adminMethod)}
                onDelete={() => setDeleteTarget(profile)}
                onSetDefault={() => handleSetDefault(profile, adminMethod)}
              />
            ) : (
              <EmptyCard
                key={adminMethod.id}
                adminMethod={adminMethod}
                onConfigure={() => setDialogMethod(adminMethod)}
              />
            );
          })}
        </div>
      )}

      {/* Stripe notice */}
      {activeMethods.some(m => m.method_type === 'stripe') && (
        <div className="px-5 pb-4">
          <p className="text-[10px] text-muted-foreground">
            🔒 Los datos de tarjeta son procesados de forma segura por Stripe. Nunca almacenamos números de tarjeta.
          </p>
        </div>
      )}

      {/* Configure / Edit dialog */}
      <ConfigDialog
        open={!!dialogMethod}
        adminMethod={dialogMethod}
        existing={dialogMethod ? (profiles.find(p => p.admin_payment_method_id === dialogMethod.id) ?? null) : null}
        onClose={() => setDialogMethod(null)}
        onSave={saveProfile}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar método de pago?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la información guardada. Podrás volver a configurarlo cuando quieras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteTarget) {
                  await deleteProfile(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
