import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useMarkets, type MarketDashboard } from "@/hooks/useMarkets";
import { useKYC } from "@/hooks/useKYC";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Store, Loader2, MapPin, User, CreditCard, ShieldCheck,
  ArrowRight, ArrowLeft, Check, Upload, Instagram, Phone,
  Globe, X, AlertTriangle
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

// ── Step definitions ──
const STEPS = [
  { id: "account", label: "Cuenta", icon: Store },
  { id: "location", label: "Ubicación", icon: MapPin },
  { id: "profile", label: "Perfil", icon: User },
  { id: "payment", label: "Pagos", icon: CreditCard },
  { id: "verification", label: "Verificación", icon: ShieldCheck },
] as const;

type StepId = (typeof STEPS)[number]["id"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, skip step 1 (account already created) */
  initialStep?: StepId;
}

export function SellerRegistrationModal({ open, onOpenChange, initialStep }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { readyMarkets, isLoading: loadingMarkets } = useMarkets();
  const { uploadDocument, submitKYC } = useKYC();

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);

  // ── Step 1: Account ──
  const [storeName, setStoreName] = useState("");
  const [storeDescription, setStoreDescription] = useState("");

  // ── Step 2: Location ──
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [communes, setCommunes] = useState<{ id: string; name: string }[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [communeId, setCommuneId] = useState("");
  const [selectedMarketId, setSelectedMarketId] = useState("");
  const [selectedCountryId, setSelectedCountryId] = useState("");

  // ── Step 3: Profile ──
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [tiktok, setTiktok] = useState("");

  // ── Step 4: Payment ──
  const [moncashPhone, setMoncashPhone] = useState("");
  const [moncashName, setMoncashName] = useState("");
  const [natcashPhone, setNatcashPhone] = useState("");
  const [natcashName, setNatcashName] = useState("");

  // ── Step 5: Verification ──
  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);

  // ── Init step from prop ──
  useEffect(() => {
    if (open && initialStep) {
      const idx = STEPS.findIndex(s => s.id === initialStep);
      if (idx >= 0) setCurrentStep(idx);
    }
  }, [open, initialStep]);

  // ── Guard to auto-execute step 1 only once ──
  const autoExecutedRef = useRef(false);
  useEffect(() => { if (!open) autoExecutedRef.current = false; }, [open]);

  // ── Load existing store data OR auto-execute step 1 from LoginPage ──
  useEffect(() => {
    if (!open || !user?.id) return;
    const load = async () => {
      const pendingName = sessionStorage.getItem('pending_seller_store_name');
      const pendingDesc = sessionStorage.getItem('pending_seller_store_description') || '';

      const { data: store } = await supabase
        .from("stores")
        .select("*")
        .eq("owner_user_id", user.id)
        .maybeSingle();

      if (store) {
        setStoreId(store.id);
        setStoreName(store.name || "");
        setStoreDescription(store.description || "");
        setDepartmentId(store.department_id || "");
        setCommuneId(store.commune_id || "");
        setSelectedMarketId(store.market_id || "");
        setSelectedCountryId(store.destination_country_id || "");
        setWhatsapp(store.whatsapp || "");
        setInstagram(store.instagram || "");
        setFacebook(store.facebook || "");
        setTiktok(store.tiktok || "");
        if (store.logo) setLogoPreview(store.logo);
      }

      // Load onboarding progress to resume at correct step
      const { data: progress } = await supabase
        .from("seller_onboarding_progress")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (progress && !initialStep) {
        const stepMap: Record<string, number> = {
          store_info: 0, location: 1, profile: 2, payment: 3, verification: 4
        };
        setCurrentStep(stepMap[progress.current_step] ?? 0);
      }

      // ── Auto-execute step 1 if store name came from LoginPage registration ──
      if (pendingName && !store && !autoExecutedRef.current) {
        autoExecutedRef.current = true;
        setStoreName(pendingName);
        setStoreDescription(pendingDesc);
        setLoading(true);
        try {
          const { data, error } = await supabase.rpc("upgrade_to_seller" as any, {
            p_store_name: pendingName,
            p_store_description: pendingDesc || null,
          });
          if (error) throw error;
          const result = data as any;
          setStoreId(result?.store_id || null);
          sessionStorage.removeItem("pending_seller_upgrade");
          sessionStorage.removeItem("pending_seller_store_name");
          sessionStorage.removeItem("pending_seller_store_description");
          if (user?.id) localStorage.removeItem(`pending_seller_upgrade_${user.id}`);
          await saveProgress("location", { store_info: true });
          toast.success("¡Cuenta de vendedor creada!");
          // Reload page so useAuth picks up the new seller role
          window.location.href = "/seller/cuenta";
        } catch (err: any) {
          console.error("Auto step 1 error:", err);
          toast.error(err.message || "Error al crear cuenta");
        } finally {
          setLoading(false);
        }
        return;
      }

      // Load payment methods
      const { data: methods } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("owner_type", "seller")
        .eq("owner_id", user.id);
      if (methods) {
        const moncash = methods.find((m: any) => m.method_type === "moncash");
        const natcash = methods.find((m: any) => m.method_type === "natcash");
        if (moncash) {
          setMoncashPhone(moncash.phone_number || "");
          setMoncashName(moncash.holder_name || "");
        }
        if (natcash) {
          setNatcashPhone(natcash.phone_number || "");
          setNatcashName(natcash.holder_name || "");
        }
      }
    };
    load();
  }, [open, user?.id, initialStep]);

  // ── Load departments ──
  useEffect(() => {
    supabase.from("departments").select("id, name").eq("is_active", true).order("name").then(({ data }) => {
      if (data) setDepartments(data);
    });
  }, []);

  // ── Load communes when department changes ──
  useEffect(() => {
    if (!departmentId) { setCommunes([]); return; }
    supabase.from("communes").select("id, name").eq("department_id", departmentId).eq("is_active", true).order("name").then(({ data }) => {
      if (data) setCommunes(data);
    });
  }, [departmentId]);

  // ── Auto-select country if market has only one ──
  useEffect(() => {
    if (!selectedMarketId) return;
    const mkt = readyMarkets.find((m: MarketDashboard) => m.id === selectedMarketId);
    if (mkt?.countries?.length === 1) {
      setSelectedCountryId(mkt.countries[0].id);
    }
  }, [selectedMarketId, readyMarkets]);

  // ── Save onboarding progress ──
  const saveProgress = useCallback(async (stepId: string, completed: Record<string, boolean>) => {
    if (!user?.id) return;
    await supabase.from("seller_onboarding_progress").upsert({
      user_id: user.id,
      current_step: stepId,
      steps_completed: completed,
      is_complete: Object.keys(completed).length >= STEPS.length,
    }, { onConflict: "user_id" });
  }, [user?.id]);

  // ── STEP HANDLERS ──

  const handleStep1 = async () => {
    if (!user?.id || !storeName.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("upgrade_to_seller" as any, {
        p_store_name: storeName.trim(),
        p_store_description: storeDescription.trim() || null,
      });
      if (error) throw error;

      const result = data as any;
      setStoreId(result?.store_id || null);

      sessionStorage.removeItem("pending_seller_upgrade");
      sessionStorage.removeItem("pending_seller_store_name");
      sessionStorage.removeItem("pending_seller_store_description");
      if (user?.id) localStorage.removeItem(`pending_seller_upgrade_${user.id}`);

      await saveProgress("location", { store_info: true });
      toast.success("¡Cuenta de vendedor creada!");
      // Reload page so useAuth picks up the new seller role
      window.location.href = "/seller/cuenta";
    } catch (err: any) {
      console.error("Step 1 error:", err);
      toast.error(err.message || "Error al crear cuenta");
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async () => {
    if (!storeId && !user?.id) return;
    setLoading(true);
    try {
      const id = storeId || (await supabase.from("stores").select("id").eq("owner_user_id", user!.id).single()).data?.id;
      if (!id) throw new Error("Tienda no encontrada");

      const updates: any = { updated_at: new Date().toISOString() };
      if (departmentId) updates.department_id = departmentId;
      if (communeId) updates.commune_id = communeId;
      if (selectedMarketId) updates.market_id = selectedMarketId;
      if (selectedCountryId) updates.destination_country_id = selectedCountryId;

      const { error } = await supabase.from("stores").update(updates).eq("id", id);
      if (error) throw error;

      setStoreId(id);
      await saveProgress("profile", { store_info: true, location: true });
      setCurrentStep(2);
      toast.success("Ubicación guardada");
    } catch (err: any) {
      console.error("Step 2 error:", err);
      toast.error(err.message || "Error al guardar ubicación");
    } finally {
      setLoading(false);
    }
  };

  const handleStep3 = async () => {
    setLoading(true);
    try {
      const id = storeId || (await supabase.from("stores").select("id").eq("owner_user_id", user!.id).single()).data?.id;
      if (!id) throw new Error("Tienda no encontrada");

      // Upload logo if changed
      let logoUrl = logoPreview;
      if (logoFile) {
        const ext = logoFile.name.split(".").pop();
        const path = `stores/${id}/logo-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("product-images")
          .upload(path, logoFile, { upsert: true });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
        logoUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from("stores").update({
        logo: logoUrl,
        whatsapp: whatsapp || null,
        instagram: instagram || null,
        facebook: facebook || null,
        tiktok: tiktok || null,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;

      await saveProgress("payment", { store_info: true, location: true, profile: true });
      setCurrentStep(3);
      toast.success("Perfil actualizado");
    } catch (err: any) {
      console.error("Step 3 error:", err);
      toast.error(err.message || "Error al actualizar perfil");
    } finally {
      setLoading(false);
    }
  };

  const handleStep4 = async () => {
    setLoading(true);
    try {
      // Upsert Moncash
      if (moncashPhone.trim()) {
        const { data: existing } = await supabase
          .from("payment_methods")
          .select("id")
          .eq("owner_type", "seller")
          .eq("owner_id", user!.id)
          .eq("method_type", "moncash")
          .maybeSingle();

        const payload = {
          owner_type: "seller" as const,
          owner_id: user!.id,
          method_type: "moncash" as const,
          phone_number: moncashPhone.trim(),
          holder_name: moncashName.trim() || null,
          is_active: true,
          display_name: "Moncash",
        };

        if (existing) {
          await supabase.from("payment_methods").update(payload as any).eq("id", existing.id);
        } else {
          await supabase.from("payment_methods").insert(payload as any);
        }
      }

      // Upsert Natcash
      if (natcashPhone.trim()) {
        const { data: existing } = await supabase
          .from("payment_methods")
          .select("id")
          .eq("owner_type", "seller")
          .eq("owner_id", user!.id)
          .eq("method_type", "natcash")
          .maybeSingle();

        const payload = {
          owner_type: "seller" as const,
          owner_id: user!.id,
          method_type: "natcash" as const,
          phone_number: natcashPhone.trim(),
          holder_name: natcashName.trim() || null,
          is_active: true,
          display_name: "Natcash",
        };

        if (existing) {
          await supabase.from("payment_methods").update(payload as any).eq("id", existing.id);
        } else {
          await supabase.from("payment_methods").insert(payload as any);
        }
      }

      await saveProgress("verification", { store_info: true, location: true, profile: true, payment: true });
      setCurrentStep(4);
      toast.success("Información de pago guardada");
    } catch (err: any) {
      console.error("Step 4 error:", err);
      toast.error(err.message || "Error al guardar pagos");
    } finally {
      setLoading(false);
    }
  };

  const handleStep5 = async () => {
    if (!idFront || !idBack) {
      toast.error("Debes subir ambos lados de tu identificación");
      return;
    }
    setLoading(true);
    try {
      const idFrontUrl = await uploadDocument(idFront, "front");
      const idBackUrl = await uploadDocument(idBack, "back");
      await submitKYC.mutateAsync({ idFrontUrl, idBackUrl });

      await saveProgress("complete", {
        store_info: true, location: true, profile: true, payment: true, verification: true,
      });

      // Mark onboarding complete
      await supabase.from("seller_onboarding_progress").update({ is_complete: true }).eq("user_id", user!.id);

      sessionStorage.removeItem("pending_seller_upgrade");
      if (user?.id) localStorage.removeItem(`pending_seller_upgrade_${user.id}`);

      toast.success("¡Registro completado! Tu verificación está en proceso.");
      queryClient.invalidateQueries({ queryKey: ["store"] });
      onOpenChange(false);
      window.location.href = "/seller/cuenta";
    } catch (err: any) {
      console.error("Step 5 error:", err);
      toast.error(err.message || "Error al enviar verificación");
    } finally {
      setLoading(false);
    }
  };

  const handleSkipToEnd = () => {
    // Mark as incomplete but let them access seller dashboard
    toast.info("Puedes completar tu registro más tarde desde tu cuenta de vendedor.");
    onOpenChange(false);
    window.location.href = "/seller/cuenta";
  };

  const handleCancelRegistration = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Revert to user role — use a simple RPC or direct if admin
      // Delete seller role and re-insert user role via a SECURITY DEFINER function
      const { error } = await supabase.rpc("cancel_seller_registration" as any);
      if (error) throw error;

      sessionStorage.removeItem("pending_seller_upgrade");
      if (user?.id) localStorage.removeItem(`pending_seller_upgrade_${user.id}`);

      toast.success("Registro de vendedor cancelado. Volviste a ser usuario normal.");
      onOpenChange(false);
      window.location.href = "/perfil";
    } catch (err: any) {
      console.error("Cancel error:", err);
      toast.error(err.message || "Error al cancelar registro");
    } finally {
      setLoading(false);
    }
  };

  const step = STEPS[currentStep];
  const isAccountCreated = currentStep > 0 || storeId !== null;

  // ── RENDER ──
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" />
            Registro de vendedor
          </DialogTitle>
          <DialogDescription>
            Completa los pasos para activar tu tienda.
          </DialogDescription>
        </DialogHeader>

        {/* ── Progress indicator ── */}
        <div className="flex items-center gap-1 mb-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < currentStep;
            const active = i === currentStep;
            return (
              <div key={s.id} className="flex items-center gap-1 flex-1">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                  done ? "bg-green-500 text-white" : active ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                }`}>
                  {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 ${done ? "bg-green-500" : "bg-muted"}`} />
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground text-center mb-4">
          Paso {currentStep + 1} de {STEPS.length}: <strong>{step.label}</strong>
        </p>

        {/* ══════════ STEP 1: Account ══════════ */}
        {currentStep === 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reg-store-name">Nombre de tu tienda *</Label>
              <Input
                id="reg-store-name"
                placeholder="Ej: Mi Boutique"
                value={storeName}
                onChange={e => setStoreName(e.target.value)}
                maxLength={80}
                disabled={isAccountCreated}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-store-desc">Descripción (opcional)</Label>
              <Textarea
                id="reg-store-desc"
                placeholder="Describe brevemente tu tienda..."
                value={storeDescription}
                onChange={e => setStoreDescription(e.target.value)}
                rows={3}
                maxLength={300}
                disabled={isAccountCreated}
              />
            </div>
            {isAccountCreated ? (
              <Button className="w-full gap-2" onClick={() => setCurrentStep(1)}>
                Continuar <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button className="w-full gap-2" onClick={handleStep1} disabled={loading || !storeName.trim()}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Store className="w-4 h-4" />}
                {loading ? "Creando cuenta..." : "Crear cuenta y tienda"}
              </Button>
            )}
          </div>
        )}

        {/* ══════════ STEP 2: Location ══════════ */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select value={departmentId} onValueChange={(v) => { setDepartmentId(v); setCommuneId(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecciona departamento" /></SelectTrigger>
                <SelectContent>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {departmentId && communes.length > 0 && (
              <div className="space-y-2">
                <Label>Comuna</Label>
                <Select value={communeId} onValueChange={setCommuneId}>
                  <SelectTrigger><SelectValue placeholder="Selecciona comuna" /></SelectTrigger>
                  <SelectContent>
                    {communes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Mercado de destino</Label>
              <p className="text-xs text-muted-foreground">Zona donde tus clientes recibirán los pedidos</p>
              <Select value={selectedMarketId} onValueChange={(v) => { setSelectedMarketId(v); setSelectedCountryId(""); }}>
                <SelectTrigger><SelectValue placeholder="— Elige un mercado —" /></SelectTrigger>
                <SelectContent>
                  {readyMarkets.map((m: MarketDashboard) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedMarketId && (() => {
              const mkt = readyMarkets.find((m: MarketDashboard) => m.id === selectedMarketId);
              return mkt?.countries && mkt.countries.length > 1 ? (
                <div className="space-y-2">
                  <Label>País de destino</Label>
                  <Select value={selectedCountryId} onValueChange={setSelectedCountryId}>
                    <SelectTrigger><SelectValue placeholder="Selecciona país" /></SelectTrigger>
                    <SelectContent>
                      {mkt.countries.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : null;
            })()}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCurrentStep(0)} disabled={loading}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Button className="flex-1 gap-2" onClick={handleStep2} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? "Guardando..." : "Siguiente"}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* ══════════ STEP 3: Profile ══════════ */}
        {currentStep === 2 && (
          <div className="space-y-4">
            {/* Logo */}
            <div className="space-y-2">
              <Label>Logo de tu tienda</Label>
              <div className="flex items-center gap-4">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-16 h-16 rounded-full object-cover border" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <Store className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <label className="cursor-pointer text-sm text-primary hover:underline flex items-center gap-1">
                  <Upload className="w-4 h-4" />
                  {logoPreview ? "Cambiar" : "Subir logo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setLogoFile(f);
                        setLogoPreview(URL.createObjectURL(f));
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Social + Contact */}
            <div className="space-y-2">
              <Label htmlFor="reg-whatsapp">WhatsApp</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="reg-whatsapp" placeholder="+509 XXXX XXXX" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className="pl-10" maxLength={20} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-instagram">Instagram</Label>
              <div className="relative">
                <Instagram className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="reg-instagram" placeholder="@tutienda" value={instagram} onChange={e => setInstagram(e.target.value)} className="pl-10" maxLength={100} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="reg-facebook">Facebook</Label>
                <Input id="reg-facebook" placeholder="tutienda" value={facebook} onChange={e => setFacebook(e.target.value)} maxLength={100} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-tiktok">TikTok</Label>
                <Input id="reg-tiktok" placeholder="@tutienda" value={tiktok} onChange={e => setTiktok(e.target.value)} maxLength={100} />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCurrentStep(1)} disabled={loading}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Button className="flex-1 gap-2" onClick={handleStep3} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? "Guardando..." : "Siguiente"}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* ══════════ STEP 4: Payment ══════════ */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configura tus métodos de pago para recibir cobros de tus clientes.
            </p>

            {/* Moncash */}
            <div className="p-3 border rounded-lg space-y-3">
              <p className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-red-600" /> Moncash
              </p>
              <div className="space-y-2">
                <Label htmlFor="reg-moncash-phone">Número Moncash</Label>
                <Input id="reg-moncash-phone" placeholder="+509 XXXX XXXX" value={moncashPhone} onChange={e => setMoncashPhone(e.target.value)} maxLength={20} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-moncash-name">Nombre en Moncash</Label>
                <Input id="reg-moncash-name" placeholder="Nombre asociado a tu cuenta" value={moncashName} onChange={e => setMoncashName(e.target.value)} maxLength={100} />
              </div>
            </div>

            {/* Natcash */}
            <div className="p-3 border rounded-lg space-y-3">
              <p className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600" /> Natcash
              </p>
              <div className="space-y-2">
                <Label htmlFor="reg-natcash-phone">Número Natcash</Label>
                <Input id="reg-natcash-phone" placeholder="+509 XXXX XXXX" value={natcashPhone} onChange={e => setNatcashPhone(e.target.value)} maxLength={20} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-natcash-name">Nombre en Natcash</Label>
                <Input id="reg-natcash-name" placeholder="Nombre asociado a tu cuenta" value={natcashName} onChange={e => setNatcashName(e.target.value)} maxLength={100} />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCurrentStep(2)} disabled={loading}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Button className="flex-1 gap-2" onClick={handleStep4} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? "Guardando..." : "Siguiente"}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* ══════════ STEP 5: Verification ══════════ */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <p className="font-medium flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Verificación de identidad
              </p>
              <p className="mt-1 text-xs">Sube fotos claras de tu documento de identidad (frente y reverso). Esto nos ayuda a proteger a compradores y vendedores.</p>
            </div>

            <div className="space-y-2">
              <Label>Documento de identidad — Frente *</Label>
              <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary transition text-sm text-muted-foreground">
                {idFront ? (
                  <span className="text-foreground flex items-center gap-1"><Check className="w-4 h-4 text-green-500" /> {idFront.name}</span>
                ) : (
                  <><Upload className="w-4 h-4" /> Subir frente del documento</>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={e => setIdFront(e.target.files?.[0] || null)} />
              </label>
            </div>

            <div className="space-y-2">
              <Label>Documento de identidad — Reverso *</Label>
              <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary transition text-sm text-muted-foreground">
                {idBack ? (
                  <span className="text-foreground flex items-center gap-1"><Check className="w-4 h-4 text-green-500" /> {idBack.name}</span>
                ) : (
                  <><Upload className="w-4 h-4" /> Subir reverso del documento</>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={e => setIdBack(e.target.files?.[0] || null)} />
              </label>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCurrentStep(3)} disabled={loading}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Button className="flex-1 gap-2" onClick={handleStep5} disabled={loading || !idFront || !idBack}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {loading ? "Enviando..." : "Completar registro"}
              </Button>
            </div>
          </div>
        )}

        {/* ── Footer actions ── */}
        <div className="flex items-center justify-between pt-2 border-t mt-2">
          {currentStep > 0 && (
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1" onClick={handleSkipToEnd}>
              Completar después
            </Button>
          )}
          {isAccountCreated && (
            <Button variant="ghost" size="sm" className="text-xs text-destructive gap-1 ml-auto" onClick={handleCancelRegistration} disabled={loading}>
              <X className="w-3 h-3" /> Cancelar registro
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
