import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Upload, ExternalLink, Loader2, Newspaper } from "lucide-react";
import { NEWS_CATEGORIES } from "@/lib/news.functions";

type Row = {
  id: string; slug: string; title: string; excerpt: string | null; content: string; cover_image: string | null;
  category: string; language: string; author_name: string | null; status: string; is_featured: boolean; published_at: string | null;
};
const empty: Omit<Row, "id"> = { slug: "", title: "", excerpt: "", content: "", cover_image: "", category: "negocios", language: "fr", author_name: "Kizkka", status: "draft", is_featured: false, published_at: null };
const LANGS = { fr: "Français", ht: "Kreyòl", es: "Español", en: "English" };
const db = supabase as any;

const slugify = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);

export default function AdminNewsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Row, "id">>(empty);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data, error } = await db.from("news_articles").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditId(null); setForm(empty); setOpen(true); };
  const openEdit = (r: Row) => { const { id, ...rest } = r; setEditId(id); setForm({ ...rest, excerpt: rest.excerpt ?? "", cover_image: rest.cover_image ?? "" }); setOpen(true); };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `news/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setForm((f) => ({ ...f, cover_image: data.publicUrl }));
    } catch (e: any) { toast.error(e.message || "No se pudo subir la imagen"); }
    finally { setUploading(false); }
  };

  const save = async (publish?: boolean) => {
    if (!form.title.trim() || !form.content.trim()) return toast.error("Título y contenido son obligatorios");
    setSaving(true);
    const status = publish === undefined ? form.status : publish ? "published" : "draft";
    const payload = {
      ...form,
      slug: slugify(form.slug || form.title),
      excerpt: form.excerpt || null,
      cover_image: form.cover_image || null,
      status,
      published_at: status === "published" ? form.published_at || new Date().toISOString() : form.published_at,
    };
    const { data: u } = await supabase.auth.getUser();
    const res = editId
      ? await db.from("news_articles").update(payload).eq("id", editId)
      : await db.from("news_articles").insert({ ...payload, created_by: u.user?.id });
    setSaving(false);
    if (res.error) return toast.error(res.error.code === "23505" ? "Ya existe una noticia con ese enlace (slug)" : res.error.message);
    toast.success(status === "published" ? "Noticia publicada" : "Borrador guardado");
    setOpen(false); load();
  };

  const remove = async (r: Row) => {
    if (!confirm(`¿Eliminar "${r.title}"?`)) return;
    const { error } = await db.from("news_articles").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Noticia eliminada"); load();
  };

  return (
    <AdminLayout title="Noticias de negocios">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Publica noticias para atraer visitantes desde Google y redes sociales.</p>
          <div className="flex gap-2">
            <Button variant="outline" asChild><a href="/noticias" target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-2" />Ver portal</a></Button>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nueva noticia</Button>
          </div>
        </div>

        {!rows ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 border rounded-xl text-muted-foreground"><Newspaper className="h-10 w-10 mx-auto mb-2" />Aún no hay noticias.</div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3 border rounded-lg p-3 bg-card">
                <div className="h-14 w-20 rounded bg-muted overflow-hidden shrink-0">{r.cover_image && <img src={r.cover_image} alt="" className="h-full w-full object-cover" />}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{r.title}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1 text-xs">
                    <Badge variant={r.status === "published" ? "default" : "outline"}>{r.status === "published" ? "Publicada" : "Borrador"}</Badge>
                    <Badge variant="secondary">{NEWS_CATEGORIES[r.category] ?? r.category}</Badge>
                    <Badge variant="outline">{(LANGS as any)[r.language] ?? r.language}</Badge>
                    {r.is_featured && <Badge variant="outline">Destacada</Badge>}
                  </div>
                </div>
                {r.status === "published" && <Button size="icon" variant="ghost" asChild><a href={`/noticias/${r.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>}
                <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Editar noticia" : "Nueva noticia"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, slug: editId ? form.slug : slugify(e.target.value) })} /></div>
            <div><Label>Enlace (slug)</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} placeholder="se-genera-del-titulo" /><p className="text-xs text-muted-foreground mt-1">kizkka.com/noticias/{form.slug || "..."}</p></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Categoría</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(NEWS_CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Idioma</Label>
                <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(LANGS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Imagen de portada</Label>
              <div className="flex gap-3 items-center mt-1">
                <div className="h-20 w-32 rounded bg-muted overflow-hidden shrink-0">{form.cover_image && <img src={form.cover_image} alt="" className="h-full w-full object-cover" />}</div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}Subir desde el PC
                </Button>
              </div>
            </div>
            <div><Label>Resumen</Label><Textarea rows={2} value={form.excerpt ?? ""} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} /></div>
            <div><Label>Contenido</Label><Textarea rows={10} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Separa los párrafos con una línea en blanco." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Autor</Label><Input value={form.author_name ?? ""} onChange={(e) => setForm({ ...form, author_name: e.target.value })} /></div>
              <div className="flex items-center gap-2 pt-6"><Switch checked={form.is_featured} onCheckedChange={(v) => setForm({ ...form, is_featured: v })} /><Label>Destacada en portada</Label></div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => save(false)} disabled={saving}>Guardar borrador</Button>
            <Button onClick={() => save(true)} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Publicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
