import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AVAILABLE_LANGS = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "ht", label: "Kreyòl (Haitian Creole)" },
  { code: "pt", label: "Português" },
];

interface RawRow { [k: string]: any }

interface ParsedProduct {
  row_index: number;
  source_product_id_1688?: string;
  sku?: string;
  image_url?: string;
  source_title_zh?: string;
  source_description_zh?: string;
  raw_payload: Record<string, unknown>;
}

function pickHeader(headers: string[], keywords: string[]) {
  const lower = headers.map(h => h.toLowerCase());
  for (const kw of keywords) {
    const i = lower.findIndex(h => h.includes(kw));
    if (i >= 0) return headers[i];
  }
  return "";
}

export default function Import1688ReviewUploadDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<RawRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [marketId, setMarketId] = useState<string>("");
  const [markets, setMarkets] = useState<{ id: string; name: string }[]>([]);
  const [langs, setLangs] = useState<string[]>(["es"]);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.from("markets").select("id,name").eq("is_active", true).order("sort_order").then(({ data }) => {
      setMarkets((data ?? []) as any);
    });
  }, [open]);

  const reset = () => {
    setFile(null);
    setRows([]);
    setHeaders([]);
    setMarketId("");
    setLangs(["es"]);
    setProcessing(false);
  };

  const handleFile = async (f: File) => {
    setFile(f);
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", raw: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const parsed: RawRow[] = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: "" });
    if (parsed.length === 0) {
      toast.error("Excel vacío");
      return;
    }
    setRows(parsed);
    setHeaders(Object.keys(parsed[0]));
  };

  const products: ParsedProduct[] = useMemo(() => {
    if (rows.length === 0) return [];
    const idCol = pickHeader(headers, ["product id", "商品id", "商品编号", "product_id", "sku_pai", "spu"]);
    const titleCol = pickHeader(headers, ["title", "标题", "品名", "nombre", "product name"]);
    const descCol = pickHeader(headers, ["desc", "描述", "descripci"]);
    const imgCol = pickHeader(headers, ["主图", "image", "imagen", "img"]);
    const skuCol = pickHeader(headers, ["sku", "编码"]);

    // Group by source product id (or by title if no id)
    const groups = new Map<string, RawRow[]>();
    for (const r of rows) {
      const key = String((idCol && r[idCol]) || (titleCol && r[titleCol]) || Math.random());
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    let idx = 0;
    const out: ParsedProduct[] = [];
    for (const [key, group] of groups) {
      const first = group[0];
      out.push({
        row_index: idx++,
        source_product_id_1688: String((idCol && first[idCol]) || key),
        sku: skuCol ? String(first[skuCol] ?? "") : undefined,
        image_url: imgCol ? String(first[imgCol] ?? "") : undefined,
        source_title_zh: titleCol ? String(first[titleCol] ?? "") : "",
        source_description_zh: descCol ? String(first[descCol] ?? "") : "",
        raw_payload: { rows: group },
      });
    }
    return out;
  }, [rows, headers]);

  const canContinue = file && products.length > 0 && langs.length > 0;

  const handleCreate = async () => {
    if (!canContinue) return;
    setProcessing(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Sesión requerida");

      toast.info(`Traduciendo ${products.length} productos a ${langs.length} idioma(s). Esto puede tardar un momento…`);
      const { data, error } = await supabase.functions.invoke("create-import-batch", {
        body: {
          name: file!.name.replace(/\.(xlsx?|csv)$/i, ""),
          source_filename: file!.name,
          market_id: marketId || null,
          languages: langs,
          products,
        },
      });
      if (error) throw error;
      if (!data?.batch_id) throw new Error("No batch id returned");
      toast.success("Lote creado y traducciones generadas");
      onOpenChange(false);
      reset();
      navigate(`/admin/catalogo/1688/revision/${data.batch_id}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Error creando el lote");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar 1688 con revisión humana</DialogTitle>
          <DialogDescription>
            Sube el Excel de 1688. La IA generará las traducciones y luego podrás revisarlas y aprobarlas antes de generar el Excel final.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Archivo Excel (1688)</Label>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            {products.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {products.length} productos únicos detectados a partir de {rows.length} filas.
              </p>
            )}
          </div>

          <div>
            <Label>Mercado</Label>
            <Select value={marketId} onValueChange={setMarketId}>
              <SelectTrigger><SelectValue placeholder="Selecciona el mercado destino" /></SelectTrigger>
              <SelectContent>
                {markets.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Idiomas a generar y revisar</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {AVAILABLE_LANGS.map(l => (
                <label key={l.code} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={langs.includes(l.code)}
                    onCheckedChange={(v) => {
                      setLangs(prev => v ? [...prev, l.code] : prev.filter(x => x !== l.code));
                    }}
                  />
                  {l.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={!canContinue || processing}>
            {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Generar traducciones y revisar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
