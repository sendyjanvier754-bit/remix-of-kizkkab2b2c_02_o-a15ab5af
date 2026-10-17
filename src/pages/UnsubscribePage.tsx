import { useEffect, useState } from "react";
import { useSearchParams, Link } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, MailX, CheckCircle2 } from "lucide-react";

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!token) { setState("error"); return; }
    supabase.functions.invoke("email-campaigns", { body: { action: "unsubscribe", token } }).then(({ data, error }) => {
      if (error || !data?.ok) setState("error"); else { setEmail(data.email); setState("ok"); }
    });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-6">
      <div className="max-w-md w-full bg-card rounded-2xl shadow-sm p-8 text-center space-y-4">
        {state === "loading" && <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />}
        {state === "ok" && (<>
          <CheckCircle2 className="w-12 h-12 mx-auto text-primary" />
          <h1 className="text-xl font-bold">Suscripción cancelada</h1>
          <p className="text-muted-foreground text-sm">{email} ya no recibirá correos promocionales de Kizkka. Seguirás recibiendo avisos sobre tus pedidos.</p>
        </>)}
        {state === "error" && (<>
          <MailX className="w-12 h-12 mx-auto text-destructive" />
          <h1 className="text-xl font-bold">Enlace no válido</h1>
          <p className="text-muted-foreground text-sm">No pudimos procesar la baja. El enlace puede haber expirado.</p>
        </>)}
        <Button asChild variant="outline"><Link to="/">Volver a la tienda</Link></Button>
      </div>
    </div>
  );
}
