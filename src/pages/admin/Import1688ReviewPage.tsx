import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface Batch {
  id: string;
  name: string;
  status: string;
  languages: string[];
  total_products: number;
  created_at: string;
  last_exported_at: string | null;
}

interface Product {
  id: string;
  row_index: number;
  source_product_id_1688: string | null;
  sku: string | null;
  image_url: string | null;
  source_title_zh: string | null;
  source_description_zh: string | null;
}

interface Translation {
  id: string;
  batch_product_id: string;
  language_code: string;
  field: "title" | "description";
  ai_text: string | null;
  edited_text: string | null;
  status: "pending_approval" | "approved" | "rejected";
  approved_by: string | null;
  approved_at: string | null;
}

export default function Import1688ReviewPage() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  // Local edit buffer keyed by translation id
  const [editBuffer, setEditBuffer] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!batchId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  async function load() {
    setLoading(true);
    const [{ data: b }, { data: p }] = await Promise.all([
      supabase.from("import_batches").select("*").eq("id", batchId!).maybeSingle(),
      supabase.from("import_batch_products").select("*").eq("batch_id", batchId!).order("row_index"),
    ]);
    setBatch(b as any);
    setProducts((p as any) ?? []);
    if (p && p.length) {
      const ids = (p as Product[]).map(x => x.id);
      const { data: t } = await supabase
        .from("import_batch_translations")
        .select("*")
        .in("batch_product_id", ids);
      setTranslations((t as any) ?? []);
    }
    setLoading(false);
  }

  const translationsByProduct = useMemo(() => {
    const map = new Map<string, Translation[]>();
    for (const t of translations) {
      if (!map.has(t.batch_product_id)) map.set(t.batch_product_id, []);
      map.get(t.batch_product_id)!.push(t);
    }
    return map;
  }, [translations]);

  const totalFields = translations.length;
  const approvedFields = translations.filter(t => t.status === "approved").length;

  async function saveEdit(t: Translation) {
    setSavingId(t.id);
    const newText = editBuffer[t.id] ?? (t.edited_text ?? t.ai_text ?? "");
    const { error } = await supabase
      .from("import_batch_translations")
      .update({ edited_text: newText })
      .eq("id", t.id);
    if (error) toast.error(error.message);
    else {
      setTranslations(prev => prev.map(x => x.id === t.id ? { ...x, edited_text: newText } : x));
      toast.success("Guardado");
    }
    setSavingId(null);
  }

  async function toggleApprove(t: Translation, approve: boolean) {
    setSavingId(t.id);
    const { data: sess } = await supabase.auth.getUser();
    const uid = sess.user?.id ?? null;
    const patch: any = approve
      ? {
          status: "approved",
          approved_by: uid,
          approved_at: new Date().toISOString(),
          edited_text: editBuffer[t.id] ?? t.edited_text ?? t.ai_text ?? "",
        }
      : { status: "pending_approval", approved_by: null, approved_at: null };
    const { error } = await supabase.from("import_batch_translations").update(patch).eq("id", t.id);
    if (error) toast.error(error.message);
    else {
      setTranslations(prev => prev.map(x => x.id === t.id ? { ...x, ...patch } : x));
    }
    setSavingId(null);
  }

  async function approveAllForProduct(productId: string) {
    const list = translationsByProduct.get(productId) ?? [];
    const { data: sess } = await supabase.auth.getUser();
    const uid = sess.user?.id ?? null;
    const now = new Date().toISOString();
    const updates = list.map(t => ({
      id: t.id,
      status: "approved" as const,
      approved_by: uid,
      approved_at: now,
      edited_text: editBuffer[t.id] ?? t.edited_text ?? t.ai_text ?? "",
    }));
    // upsert not ideal on RLS; do individual updates
    for (const u of updates) {
      await supabase.from("import_batch_translations").update({
        status: u.status,
        approved_by: u.approved_by,
        approved_at: u.approved_at,
        edited_text: u.edited_text,
      }).eq("id", u.id);
    }
    await load();
    toast.success("Producto aprobado");
  }

  async function handleExport() {
    if (!batchId) return;
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("export-import-batch", {
        body: { batch_id: batchId },
      });
      if (error) throw error;
      const bytes = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename ?? "lote-1688.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel generado");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Error exportando");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!batch) return <div className="p-8">Lote no encontrado.</div>;

  const langs = batch.languages ?? [];

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/catalogo")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Revisión: {batch.name}</h1>
            <p className="text-sm text-muted-foreground">
              Estado: <Badge variant="outline">{batch.status}</Badge> · {approvedFields}/{totalFields} campos aprobados
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Generar Excel final
          </Button>
        </div>
      </div>

      <div className="grid gap-3">
        {products.map(product => {
          const tList = translationsByProduct.get(product.id) ?? [];
          const productApproved = tList.length > 0 && tList.every(t => t.status === "approved");
          const productApprovedCount = tList.filter(t => t.status === "approved").length;
          const isOpen = expandedId === product.id;
          return (
            <Card key={product.id}>
              <CardHeader
                className="cursor-pointer flex flex-row items-center justify-between space-y-0"
                onClick={() => setExpandedId(isOpen ? null : product.id)}
              >
                <div className="flex items-center gap-3">
                  {product.image_url && (
                    <img src={product.image_url} alt="" className="w-12 h-12 rounded object-cover" />
                  )}
                  <div>
                    <CardTitle className="text-base">
                      #{product.row_index + 1} · {product.source_title_zh?.slice(0, 80) || "(sin título)"}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {product.source_product_id_1688 ?? ""} {product.sku ? `· SKU ${product.sku}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {productApproved && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                  <Badge variant={productApproved ? "default" : "secondary"}>
                    {productApprovedCount}/{tList.length}
                  </Badge>
                </div>
              </CardHeader>
              {isOpen && (
                <CardContent className="space-y-4">
                  <div className="text-xs text-muted-foreground">
                    <div><strong>Original (ZH) - Título:</strong> {product.source_title_zh ?? "—"}</div>
                    <div><strong>Original (ZH) - Descripción:</strong> {product.source_description_zh ?? "—"}</div>
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" variant="secondary" onClick={() => approveAllForProduct(product.id)}>
                      Aprobar todo
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {langs.map(lang => (
                      <div key={lang} className="border rounded-md p-3 space-y-3">
                        <div className="text-sm font-semibold uppercase">{lang}</div>
                        {(["title", "description"] as const).map(field => {
                          const t = tList.find(x => x.language_code === lang && x.field === field);
                          if (!t) return null;
                          const currentValue = editBuffer[t.id] ?? t.edited_text ?? t.ai_text ?? "";
                          const isApproved = t.status === "approved";
                          return (
                            <div key={field} className="grid md:grid-cols-2 gap-3 text-sm">
                              <div>
                                <Label>{field === "title" ? "Título" : "Descripción"} — sugerencia IA</Label>
                                <div className="mt-1 p-2 bg-muted rounded text-xs whitespace-pre-wrap min-h-[60px]">
                                  {t.ai_text || <span className="italic text-muted-foreground">(vacío)</span>}
                                </div>
                              </div>
                              <div>
                                <Label>{field === "title" ? "Título" : "Descripción"} — editar</Label>
                                {field === "title" ? (
                                  <Input
                                    className="mt-1"
                                    value={currentValue}
                                    onChange={(e) => setEditBuffer(prev => ({ ...prev, [t.id]: e.target.value }))}
                                    onBlur={() => (editBuffer[t.id] !== undefined && editBuffer[t.id] !== (t.edited_text ?? t.ai_text ?? "")) && saveEdit(t)}
                                  />
                                ) : (
                                  <Textarea
                                    className="mt-1 min-h-[80px]"
                                    value={currentValue}
                                    onChange={(e) => setEditBuffer(prev => ({ ...prev, [t.id]: e.target.value }))}
                                    onBlur={() => (editBuffer[t.id] !== undefined && editBuffer[t.id] !== (t.edited_text ?? t.ai_text ?? "")) && saveEdit(t)}
                                  />
                                )}
                                <div className="mt-2 flex items-center justify-between">
                                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                                    <Checkbox
                                      checked={isApproved}
                                      disabled={savingId === t.id}
                                      onCheckedChange={(v) => toggleApprove(t, !!v)}
                                    />
                                    Aprobar
                                  </label>
                                  {isApproved && t.approved_at && (
                                    <span className="text-xs text-muted-foreground">
                                      Aprobado hace {formatDistanceToNow(new Date(t.approved_at), { locale: es })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {products.length === 0 && (
        <Card><CardContent className="p-6 flex flex-col items-center gap-2 text-sm text-muted-foreground">
          <FileSpreadsheet className="h-6 w-6" />
          Este lote no tiene productos.
        </CardContent></Card>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-medium text-muted-foreground">{children}</div>;
}
