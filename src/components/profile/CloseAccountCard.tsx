import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const COPY: Record<string, Record<string, string>> = {
  es: { title: "Cerrar mi cuenta", desc: "Cierra tu cuenta, perfil y tienda (si tienes). Tu historial de pedidos se conserva. Esta acción no se puede deshacer.", btn: "Cerrar mi cuenta", confirmTitle: "¿Cerrar tu cuenta definitivamente?", confirmDesc: "Se desactivará tu tienda, se borrarán tus datos personales del perfil y no podrás volver a entrar. Escribe ELIMINAR para confirmar.", cancel: "Cancelar", confirm: "Cerrar cuenta", blocked: "Tienes {p} compra(s) y {s} venta(s) en curso. Finalízalas o cancélalas primero.", done: "Tu cuenta fue cerrada." },
  en: { title: "Close my account", desc: "Close your account, profile and store (if any). Your order history is kept. This cannot be undone.", btn: "Close my account", confirmTitle: "Permanently close your account?", confirmDesc: "Your store will be deactivated, your personal profile data removed, and you won't be able to sign in again. Type ELIMINAR to confirm.", cancel: "Cancel", confirm: "Close account", blocked: "You have {p} purchase(s) and {s} sale(s) in progress. Finish or cancel them first.", done: "Your account was closed." },
  fr: { title: "Fermer mon compte", desc: "Fermez votre compte, profil et boutique (le cas échéant). L'historique des commandes est conservé. Action irréversible.", btn: "Fermer mon compte", confirmTitle: "Fermer définitivement votre compte ?", confirmDesc: "Votre boutique sera désactivée, vos données personnelles supprimées et vous ne pourrez plus vous connecter. Tapez ELIMINAR pour confirmer.", cancel: "Annuler", confirm: "Fermer le compte", blocked: "Vous avez {p} achat(s) et {s} vente(s) en cours. Terminez-les ou annulez-les d'abord.", done: "Votre compte a été fermé." },
  ht: { title: "Fèmen kont mwen", desc: "Fèmen kont ou, pwofil ou ak boutik ou (si ou genyen). Istwa kòmand yo rete. Ou pa ka defèt sa.", btn: "Fèmen kont mwen", confirmTitle: "Fèmen kont ou nèt?", confirmDesc: "Boutik ou ap dezaktive, done pèsonèl ou ap efase epi ou p ap ka konekte ankò. Ekri ELIMINAR pou konfime.", cancel: "Anile", confirm: "Fèmen kont", blocked: "Ou gen {p} acha ak {s} vant k ap fèt. Fini yo oswa anile yo anvan.", done: "Kont ou fèmen." },
};

export function CloseAccountCard() {
  const { i18n } = useTranslation();
  const c = COPY[(i18n.language || "es").slice(0, 2)] || COPY.es;
  const { user, signOut } = useAuth() as any;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const handleClose = async () => {
    if (text !== "ELIMINAR" || !user?.id) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("close_account" as any, { _user_id: user.id });
      if (error) throw error;
      const res = data as { ok: boolean; blockers?: { open_purchases?: number; open_store_sales?: number } };
      if (!res?.ok) {
        toast.error(c.blocked.replace("{p}", String(res?.blockers?.open_purchases || 0)).replace("{s}", String(res?.blockers?.open_store_sales || 0)));
        return;
      }
      toast.success(c.done);
      setOpen(false);
      await signOut?.();
      window.location.href = "/";
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-background border border-destructive/40 rounded-md overflow-hidden">
      <div className="px-5 py-3.5 border-b border-destructive/30 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-destructive" />
        <h2 className="text-sm font-bold text-destructive">{c.title}</h2>
      </div>
      <div className="px-5 py-4 space-y-3">
        <p className="text-xs text-muted-foreground">{c.desc}</p>
        <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={() => { setText(""); setOpen(true); }}>
          <Trash2 className="w-3.5 h-3.5 mr-1" /> {c.btn}
        </Button>
      </div>
      <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{c.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{c.confirmDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="ELIMINAR" />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{c.cancel}</AlertDialogCancel>
            <Button variant="destructive" disabled={busy || text !== "ELIMINAR"} onClick={handleClose}>
              {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}{c.confirm}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
