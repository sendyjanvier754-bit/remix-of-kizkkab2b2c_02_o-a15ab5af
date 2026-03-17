import { useState, useRef, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminBanners, AdminBanner } from "@/hooks/useAdminBanners";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Image as ImageIcon,
  Pencil,
  Trash2,
  Link as LinkIcon,
  Eye,
  EyeOff,
  Loader2,
  Upload,
  Smartphone,
  Save
} from "lucide-react";

const TARGET_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "sellers", label: "Solo vendedores" },
  { value: "public", label: "Solo público" },
];

const DEVICE_OPTIONS = [
  { value: "all", label: "Todos los dispositivos" },
  { value: "desktop", label: "Solo Desktop (PC / tablet)" },
  { value: "mobile", label: "Solo Móvil" },
];

const AdminBanners = () => {
  const { banners, loading, createBanner, updateBanner, deleteBanner, uploadBannerImage } = useAdminBanners();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<AdminBanner | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingDesktop, setUploadingDesktop] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeImageTab, setActiveImageTab] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');
  const [activeBannerTab, setActiveBannerTab] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputDesktopRef = useRef<HTMLInputElement>(null);

  // B2B Hero Config State
  const [b2bFeaturedIds, setB2bFeaturedIds] = useState("");

  useEffect(() => {
    const savedIds = localStorage.getItem("admin_b2b_featured_ids");
    if (savedIds) setB2bFeaturedIds(savedIds);
  }, []);

  const handleSaveB2B = () => {
    localStorage.setItem("admin_b2b_featured_ids", b2bFeaturedIds);
    toast({
      title: "Configuración guardada",
      description: "Los productos destacados del Hero B2B han sido actualizados.",
    });
  };

  const [formData, setFormData] = useState({
    title: "",
    image_url: "",
    desktop_image_url: "",
    link_url: "",
    target_audience: "all",
    device_target: "all" as "all" | "desktop" | "mobile",
    mobile_position_x: 50,
    mobile_position_y: 50,
    mobile_scale: 100,
    desktop_position_x: 50,
    desktop_position_y: 50,
    desktop_scale: 100,
    is_active: true,
    sort_order: 0,
  });

  const resetForm = () => {
    setFormData({
      title: "",
      image_url: "",
      desktop_image_url: "",
      link_url: "",
      target_audience: "all",
      device_target: "all",
      mobile_position_x: 50,
      mobile_position_y: 50,
      mobile_scale: 100,
      desktop_position_x: 50,
      desktop_position_y: 50,
      desktop_scale: 100,
      is_active: true,
      sort_order: 0,
    });
    setEditingBanner(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setActiveImageTab('mobile');
    setIsDialogOpen(true);
  };

  const openEditDialog = (banner: AdminBanner) => {
    setEditingBanner(banner);
    setActiveImageTab('mobile');
    setFormData({
      title: banner.title,
      image_url: banner.image_url,
      desktop_image_url: banner.desktop_image_url || "",
      link_url: banner.link_url || "",
      target_audience: banner.target_audience,
      device_target: (banner.device_target ?? "all") as "all" | "desktop" | "mobile",
      mobile_position_x: 50,
      mobile_position_y: 50,
      mobile_scale: 100,
      desktop_position_x: 50,
      desktop_position_y: 50,
      desktop_scale: 100,
      is_active: banner.is_active ?? true,
      sort_order: banner.sort_order ?? 0,
    });
    setIsDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("El archivo es muy grande. Máximo 5MB."); return; }
    setUploading(true);
    const url = await uploadBannerImage(file);
    if (url) setFormData(prev => ({ ...prev, image_url: url }));
    setUploading(false);
  };

  const handleDesktopImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("El archivo es muy grande. Máximo 5MB."); return; }
    setUploadingDesktop(true);
    const url = await uploadBannerImage(file);
    if (url) setFormData(prev => ({ ...prev, desktop_image_url: url }));
    setUploadingDesktop(false);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.image_url) {
      alert("El título y la imagen son requeridos");
      return;
    }

    setSaving(true);
    try {
      const bannerData = {
        ...formData,
        desktop_image_url: formData.desktop_image_url || null,
        starts_at: null,
        ends_at: null,
      };
      
      if (editingBanner) {
        await updateBanner(editingBanner.id, bannerData);
      } else {
        await createBanner(bannerData);
      }
      setIsDialogOpen(false);
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (banner: AdminBanner) => {
    await updateBanner(banner.id, { is_active: !banner.is_active });
  };

  if (loading) {
    return (
      <AdminLayout title="Banners Promocionales" subtitle="Gestiona los banners del panel de vendedores">
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Banners Promocionales" subtitle="Gestiona los banners del panel de vendedores">
      <div className="space-y-8">
        {/* B2B Hero Configuration */}
        <Card className="border-orange-200 bg-orange-50/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-orange-600" />
              <CardTitle>Carrusel de Productos Destacados B2B (Móvil)</CardTitle>
            </div>
            <CardDescription>
              Configura qué productos aparecen en el carrusel superior de la versión móvil de "Comprar Lotes".
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="b2b_ids">IDs de Productos (separados por coma)</Label>
                <Textarea
                  id="b2b_ids"
                  placeholder="Ej: 1, 2, 5"
                  value={b2bFeaturedIds}
                  onChange={(e) => setB2bFeaturedIds(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Ingresa los IDs de los productos que deseas destacar. Estos aparecerán en el slider horizontal en móviles.
                </p>
              </div>
              <Button onClick={handleSaveB2B} className="bg-orange-600 hover:bg-orange-700">
                <Save className="w-4 h-4 mr-2" />
                Guardar Configuración B2B
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Banners Generales</h2>
            <p className="text-muted-foreground mt-1">Banners de imagen para la plataforma</p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Banner
          </Button>
        </div>

        {(() => {
          const deviceSections = [
            { key: 'mobile',  label: '📱 Móvil',        sub: '< 768px',      matches: (dt: string) => dt === 'mobile' || dt === 'all' },
            { key: 'tablet',  label: '⬛ Tablet',        sub: '768–1023px',   matches: (dt: string) => dt === 'mobile' || dt === 'all' },
            { key: 'desktop', label: '🖥 PC / Desktop',  sub: '≥ 1024px',     matches: (dt: string) => dt === 'desktop' || dt === 'all' },
          ] as const;

          const BannerCard = ({ banner, previewImage }: { banner: AdminBanner; previewImage: string }) => (
            <Card className={`overflow-hidden ${!banner.is_active ? 'opacity-60' : ''}`}>
              <div className="aspect-[16/6] relative bg-muted overflow-hidden">
                <img src={previewImage} alt={banner.title} className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                  <Badge variant={banner.is_active ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                    {banner.is_active ? "Activo" : "Inactivo"}
                  </Badge>
                  <Badge variant="outline" className="bg-background/80 text-[10px] px-1.5 py-0">
                    {TARGET_OPTIONS.find(t => t.value === banner.target_audience)?.label}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate text-sm">{banner.title}</h3>
                    {banner.link_url && (
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                        <LinkIcon className="h-3 w-3 shrink-0" />{banner.link_url}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive(banner)}
                      title={banner.is_active ? "Desactivar" : "Activar"}>
                      {banner.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(banner)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar banner?</AlertDialogTitle>
                          <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteBanner(banner.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          );

          const activeSection = deviceSections.find(s => s.key === activeBannerTab)!;
          const activeBanners = banners.filter(b => activeSection.matches(b.device_target ?? 'all'));
          const isDesktopTab = activeBannerTab === 'desktop';

          return (
            <div className="space-y-4">
              {/* Horizontal tabs */}
              <div className="flex rounded-lg border overflow-hidden">
                {deviceSections.map(section => {
                  const count = banners.filter(b => section.matches(b.device_target ?? 'all')).length;
                  const isActive = activeBannerTab === section.key;
                  return (
                    <button
                      key={section.key}
                      type="button"
                      onClick={() => setActiveBannerTab(section.key)}
                      className={`flex-1 flex flex-col items-center py-3 px-2 text-sm transition-colors border-r last:border-r-0 ${
                        isActive
                          ? 'bg-primary text-primary-foreground font-semibold'
                          : 'bg-transparent text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <span>{section.label}</span>
                      <span className={`text-xs mt-0.5 ${isActive ? 'opacity-80' : 'opacity-60'}`}>{section.sub} · {count} banner{count !== 1 ? 's' : ''}</span>
                    </button>
                  );
                })}
              </div>

              {/* Active tab content */}
              {activeBanners.length === 0 ? (
                <Card className="p-10 text-center">
                  <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">Sin banners para {activeSection.label}</p>
                  <Button className="mt-4" onClick={openCreateDialog}><Plus className="h-4 w-4 mr-2" />Crear Banner</Button>
                </Card>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {activeBanners.map(banner => {
                    const previewImage = isDesktopTab && banner.desktop_image_url
                      ? banner.desktop_image_url
                      : banner.image_url;
                    return <BannerCard key={banner.id} banner={banner} previewImage={previewImage} />;
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingBanner ? "Editar Banner" : "Nuevo Banner"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Device Tab Selector */}
              <div className="flex rounded-lg border overflow-hidden">
                {([
                  { key: 'mobile',  label: '📱 Móvil',   sub: '< 768px' },
                  { key: 'tablet',  label: '⬛ Tablet',  sub: '768–1023px' },
                  { key: 'desktop', label: '🖥 PC / Desktop', sub: '≥ 1024px' },
                ] as const).map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveImageTab(tab.key)}
                    className={`flex-1 flex flex-col items-center py-2 px-1 text-xs transition-colors border-r last:border-r-0 ${
                      activeImageTab === tab.key
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : 'bg-transparent text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="text-[10px] opacity-70">{tab.sub}</span>
                  </button>
                ))}
              </div>

              {/* Mobile tab (< 768px) */}
              {(activeImageTab === 'mobile' || activeImageTab === 'tablet') && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {activeImageTab === 'mobile' ? 'Imagen para teléfonos (< 768px) · Cuadrada o vertical · ej. 750×900px' : 'Imagen para tablets (768–1023px) · misma imagen que móvil · ej. 750×900px'}
                  </p>
                  {formData.image_url ? (
                    <div className="space-y-2">
                      <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-muted max-w-xs mx-auto">
                        <img src={formData.image_url} alt="Mobile preview" className="w-full h-full object-cover"
                          style={{
                            objectPosition: `${formData.mobile_position_x}% ${formData.mobile_position_y}%`,
                            transform: `scale(${formData.mobile_scale / 100})`,
                            transformOrigin: `${formData.mobile_position_x}% ${formData.mobile_position_y}%`,
                          }} />
                        <Button variant="secondary" size="sm" className="absolute bottom-1 right-1 text-xs px-2 py-1 h-auto"
                          onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Cambiar'}
                        </Button>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">↔ Horizontal: {formData.mobile_position_x}%</p>
                        <input type="range" min={0} max={100} value={formData.mobile_position_x}
                          onChange={e => setFormData(prev => ({ ...prev, mobile_position_x: Number(e.target.value) }))}
                          className="w-full h-1.5 accent-primary" />
                        <p className="text-xs text-muted-foreground">↕ Vertical: {formData.mobile_position_y}%</p>
                        <input type="range" min={0} max={100} value={formData.mobile_position_y}
                          onChange={e => setFormData(prev => ({ ...prev, mobile_position_y: Number(e.target.value) }))}
                          className="w-full h-1.5 accent-primary" />
                        <p className="text-xs text-muted-foreground">🔍 Zoom: {formData.mobile_scale}%</p>
                        <input type="range" min={50} max={200} value={formData.mobile_scale}
                          onChange={e => setFormData(prev => ({ ...prev, mobile_scale: Number(e.target.value) }))}
                          className="w-full h-1.5 accent-primary" />
                      </div>
                    </div>
                  ) : (
                    <div onClick={() => fileInputRef.current?.click()}
                      className="aspect-[3/4] rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors max-w-xs mx-auto">
                      {uploading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : (
                        <><Upload className="h-6 w-6 text-muted-foreground mb-1" />
                          <p className="text-xs text-muted-foreground text-center px-2">Subir imagen</p></>
                      )}
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </div>
              )}

              {/* Desktop tab (≥ 1024px) */}
              {activeImageTab === 'desktop' && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Imagen para PC (≥ 1024px) · Horizontal · ej. 1920×480px</p>
                  {formData.desktop_image_url ? (
                    <div className="space-y-2">
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                        <img src={formData.desktop_image_url} alt="Desktop preview" className="w-full h-full object-cover"
                          style={{
                            objectPosition: `${formData.desktop_position_x}% ${formData.desktop_position_y}%`,
                            transform: `scale(${formData.desktop_scale / 100})`,
                            transformOrigin: `${formData.desktop_position_x}% ${formData.desktop_position_y}%`,
                          }} />
                        <Button variant="secondary" size="sm" className="absolute bottom-1 right-1 text-xs px-2 py-1 h-auto"
                          onClick={() => fileInputDesktopRef.current?.click()} disabled={uploadingDesktop}>
                          {uploadingDesktop ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Cambiar'}
                        </Button>
                        <Button variant="ghost" size="sm" className="absolute top-1 right-1 text-xs px-1 py-0.5 h-auto text-destructive"
                          onClick={() => setFormData(prev => ({ ...prev, desktop_image_url: '' }))}>
                          ✕
                        </Button>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">↔ Horizontal: {formData.desktop_position_x}%</p>
                        <input type="range" min={0} max={100} value={formData.desktop_position_x}
                          onChange={e => setFormData(prev => ({ ...prev, desktop_position_x: Number(e.target.value) }))}
                          className="w-full h-1.5 accent-primary" />
                        <p className="text-xs text-muted-foreground">↕ Vertical: {formData.desktop_position_y}%</p>
                        <input type="range" min={0} max={100} value={formData.desktop_position_y}
                          onChange={e => setFormData(prev => ({ ...prev, desktop_position_y: Number(e.target.value) }))}
                          className="w-full h-1.5 accent-primary" />
                        <p className="text-xs text-muted-foreground">🔍 Zoom: {formData.desktop_scale}%</p>
                        <input type="range" min={50} max={200} value={formData.desktop_scale}
                          onChange={e => setFormData(prev => ({ ...prev, desktop_scale: Number(e.target.value) }))}
                          className="w-full h-1.5 accent-primary" />
                      </div>
                    </div>
                  ) : (
                    <div onClick={() => fileInputDesktopRef.current?.click()}
                      className="aspect-video rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                      {uploadingDesktop ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : (
                        <><Upload className="h-6 w-6 text-muted-foreground mb-1" />
                          <p className="text-xs text-muted-foreground text-center px-2">Subir imagen desktop</p>
                          <p className="text-xs text-muted-foreground/60 text-center px-2 mt-0.5">(opcional)</p></>
                      )}
                    </div>
                  )}
                  <input ref={fileInputDesktopRef} type="file" accept="image/*" onChange={handleDesktopImageUpload} className="hidden" />
                </div>
              )}

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  placeholder="Nombre del banner"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              {/* Link URL */}
              <div className="space-y-2">
                <Label htmlFor="link_url">URL de destino (opcional)</Label>
                <Input
                  id="link_url"
                  placeholder="https://..."
                  value={formData.link_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, link_url: e.target.value }))}
                />
              </div>

              {/* Target Audience */}
              <div className="space-y-2">
                <Label>Audiencia objetivo</Label>
                <Select
                  value={formData.target_audience}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, target_audience: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Device Target */}
              <div className="space-y-2">
                <Label>Dispositivo</Label>
                <Select
                  value={formData.device_target}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, device_target: value as "all" | "desktop" | "mobile" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEVICE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Sube una imagen horizontal (ej. 1920×480px) para Desktop y una imagen cuadrada o vertical para Móvil.
                </p>
              </div>

              {/* Sort Order */}
              <div className="space-y-2">
                <Label htmlFor="sort_order">Orden de aparición</Label>
                <Input
                  id="sort_order"
                  type="number"
                  min="0"
                  value={formData.sort_order}
                  onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                />
              </div>

              {/* Active Switch */}
              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Banner activo</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving || !formData.title || !formData.image_url}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingBanner ? "Guardar cambios" : "Crear banner"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminBanners;
