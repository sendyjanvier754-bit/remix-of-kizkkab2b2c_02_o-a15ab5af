import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Edit, Loader2, Upload, X, Store, Image, CheckCircle, MapPin, Instagram, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

// Lista de países predefinidos para el Caribe y Latinoamérica
const COUNTRIES = [
  { code: "HT", name: "Haití", flag: "🇭🇹" },
  { code: "DO", name: "República Dominicana", flag: "🇩🇴" },
  { code: "US", name: "Estados Unidos", flag: "🇺🇸" },
  { code: "PR", name: "Puerto Rico", flag: "🇵🇷" },
  { code: "CU", name: "Cuba", flag: "🇨🇺" },
  { code: "JM", name: "Jamaica", flag: "🇯🇲" },
  { code: "MX", name: "México", flag: "🇲🇽" },
  { code: "CO", name: "Colombia", flag: "🇨🇴" },
  { code: "VE", name: "Venezuela", flag: "🇻🇪" },
  { code: "PA", name: "Panamá", flag: "🇵🇦" },
  { code: "CR", name: "Costa Rica", flag: "🇨🇷" },
  { code: "GT", name: "Guatemala", flag: "🇬🇹" },
  { code: "HN", name: "Honduras", flag: "🇭🇳" },
  { code: "SV", name: "El Salvador", flag: "🇸🇻" },
  { code: "NI", name: "Nicaragua", flag: "🇳🇮" },
  { code: "EC", name: "Ecuador", flag: "🇪🇨" },
  { code: "PE", name: "Perú", flag: "🇵🇪" },
  { code: "CL", name: "Chile", flag: "🇨🇱" },
  { code: "AR", name: "Argentina", flag: "🇦🇷" },
  { code: "BR", name: "Brasil", flag: "🇧🇷" },
  { code: "ES", name: "España", flag: "🇪🇸" },
  { code: "FR", name: "Francia", flag: "🇫🇷" },
  { code: "CA", name: "Canadá", flag: "🇨🇦" },
] as const;

interface StoreEditDialogProps {
  store: {
    id: string;
    name: string;
    description: string | null;
    logo: string | null;
    banner: string | null;
    country: string | null;
    city: string | null;
    department_id: string | null;
    commune_id: string | null;
    instagram: string | null;
    facebook: string | null;
    whatsapp: string | null;
    tiktok: string | null;
  } | null;
}

export function StoreEditDialog({ store }: StoreEditDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [logoProgress, setLogoProgress] = useState(0);
  const [bannerProgress, setBannerProgress] = useState(0);
  const [name, setName] = useState(store?.name || "");
  const [description, setDescription] = useState(store?.description || "");
  const [logo, setLogo] = useState(store?.logo || "");
  const [banner, setBanner] = useState(store?.banner || "");
  const [country, setCountry] = useState(store?.country || "Haití");
  const [city, setCity] = useState(store?.city || "");
  const [departmentId, setDepartmentId] = useState(store?.department_id || "");
  const [communeId, setCommuneId] = useState(store?.commune_id || "");
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [communes, setCommunes] = useState<{ id: string; name: string }[]>([]);
  const [instagram, setInstagram] = useState(store?.instagram || "");
  const [facebook, setFacebook] = useState(store?.facebook || "");
  const [whatsapp, setWhatsapp] = useState(store?.whatsapp || "");
  const [tiktok, setTiktok] = useState(store?.tiktok || "");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Fetch departments on mount
  useEffect(() => {
    supabase.from("departments").select("id, name").eq("is_active", true).order("name")
      .then(({ data }) => setDepartments(data || []));
  }, []);

  // Fetch communes when department changes
  useEffect(() => {
    if (!departmentId) { setCommunes([]); return; }
    supabase.from("communes").select("id, name").eq("department_id", departmentId).eq("is_active", true).order("name")
      .then(({ data }) => setCommunes(data || []));
  }, [departmentId]);

  // Max file sizes: 2MB for logo, 5MB for banner
  const MAX_LOGO_SIZE = 2 * 1024 * 1024;
  const MAX_BANNER_SIZE = 5 * 1024 * 1024;
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  const validateFile = (file: File, type: "logo" | "banner"): string | null => {
    const maxSize = type === "logo" ? MAX_LOGO_SIZE : MAX_BANNER_SIZE;
    const maxSizeMB = type === "logo" ? "2MB" : "5MB";

    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Formato no válido. Usa JPG, PNG, WebP o GIF.";
    }

    if (file.size > maxSize) {
      return `El archivo es muy grande. Máximo ${maxSizeMB}.`;
    }

    return null;
  };

  const handleImageUpload = async (
    file: File,
    type: "logo" | "banner"
  ): Promise<string | null> => {
    // Validate file before upload
    const validationError = validateFile(file, type);
    if (validationError) {
      toast({
        title: "Archivo no válido",
        description: validationError,
        variant: "destructive",
      });
      return null;
    }

    const setUploading = type === "logo" ? setIsUploadingLogo : setIsUploadingBanner;
    const setProgress = type === "logo" ? setLogoProgress : setBannerProgress;
    
    setUploading(true);
    setProgress(0);

    // Simulate progress since Supabase doesn't provide native progress events
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + Math.random() * 15;
      });
    }, 150);

    try {
      const fileExt = file.name.split(".").pop()?.toLowerCase();
      const fileName = `${store?.id}/${type}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);

      clearInterval(progressInterval);
      setProgress(100);
      
      // Keep 100% visible briefly before resetting
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
      }, 500);

      return urlData.publicUrl;
    } catch (error) {
      clearInterval(progressInterval);
      console.error(`Error uploading ${type}:`, error);
      toast({
        title: "Error al subir imagen",
        description: `No se pudo subir la imagen de ${type === "logo" ? "perfil" : "portada"}.`,
        variant: "destructive",
      });
      setUploading(false);
      setProgress(0);
      return null;
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = await handleImageUpload(file, "logo");
    if (url) setLogo(url);
  };

  const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = await handleImageUpload(file, "banner");
    if (url) setBanner(url);
  };

  const handleSave = async () => {
    if (!store?.id) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("stores")
        .update({
          name,
          description,
          logo,
          banner,
          country,
          city,
          department_id: departmentId || null,
          commune_id: communeId || null,
          instagram,
          facebook,
          whatsapp,
          tiktok,
          updated_at: new Date().toISOString()
        })
        .eq("id", store.id);

      if (error) throw error;

      toast({
        title: "Tienda actualizada",
        description: "Los detalles de tu tienda han sido guardados.",
      });
      
      queryClient.invalidateQueries({ queryKey: ["store"] });
      setIsOpen(false);
    } catch (error) {
      console.error("Error updating store:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la tienda. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-[#071d7f] border-blue-200 hover:bg-blue-50">
            <Edit className="h-4 w-4 mr-2" />
            Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#071d7f]">Editar Información de la Tienda</DialogTitle>
        </DialogHeader>
        
        {/* Preview Section */}
        <div className="bg-gray-100 rounded-lg p-4 mb-4">
          <p className="text-sm font-medium text-gray-600 mb-3">Vista Previa</p>
          <div className="bg-white rounded-lg overflow-hidden shadow-sm">
            {/* Mini Banner Preview */}
            <div className="relative h-20 bg-gradient-to-r from-blue-900 to-blue-600">
              {banner && (
                <img src={banner} alt="Banner preview" className="w-full h-full object-cover" />
              )}
            </div>
            {/* Mini Profile Card Preview */}
            <div className="px-4 pb-4 -mt-6">
              <div className="flex items-end gap-3">
                <div className="w-14 h-14 rounded-lg border-2 border-white shadow-md bg-white overflow-hidden flex items-center justify-center">
                  {logo ? (
                    <img src={logo} alt="Logo preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-gray-300">
                      {name.substring(0, 2).toUpperCase() || "TI"}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <h3 className="font-bold text-gray-900 truncate text-sm">
                    {name || "Nombre de la tienda"}
                  </h3>
                  <p className="text-xs text-gray-500 line-clamp-1">
                    {description || "Descripción de la tienda..."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 py-4">
          {/* Logo Upload */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Store className="h-4 w-4" />
              Foto de Perfil (Logo)
            </Label>
            <div className="flex items-center gap-4">
              <div className="relative w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden flex items-center justify-center group">
                {logo ? (
                  <>
                    <img src={logo} alt="Logo" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setLogo("")}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <div className="text-gray-400 text-center">
                    <Store className="h-8 w-8 mx-auto mb-1" />
                    <span className="text-xs">Sin logo</span>
                  </div>
                )}
                {isUploadingLogo && (
                  <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center gap-2 p-2">
                    {logoProgress < 100 ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                        <Progress value={logoProgress} className="w-16 h-1" />
                        <span className="text-xs text-gray-500">{Math.round(logoProgress)}%</span>
                      </>
                    ) : (
                      <CheckCircle className="h-6 w-6 text-green-500" />
                    )}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={isUploadingLogo}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploadingLogo ? "Subiendo..." : "Subir Logo"}
                </Button>
                <p className="text-xs text-gray-500 mt-2">
                  Máx. 2MB · JPG, PNG, WebP
                </p>
              </div>
            </div>
          </div>

          {/* Banner Upload */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Image className="h-4 w-4" />
              Imagen de Portada (Banner)
            </Label>
            <div className="relative w-full h-32 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden flex items-center justify-center group">
              {banner ? (
                <>
                  <img src={banner} alt="Banner" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setBanner("")}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <div className="text-gray-400 text-center">
                  <Image className="h-8 w-8 mx-auto mb-1" />
                  <span className="text-xs">Sin imagen de portada</span>
                </div>
              )}
              {isUploadingBanner && (
                <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center gap-2">
                  {bannerProgress < 100 ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                      <Progress value={bannerProgress} className="w-32 h-2" />
                      <span className="text-sm text-gray-600">{Math.round(bannerProgress)}%</span>
                    </>
                  ) : (
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                onChange={handleBannerChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => bannerInputRef.current?.click()}
                disabled={isUploadingBanner}
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploadingBanner ? "Subiendo..." : "Subir Portada"}
              </Button>
              <p className="text-xs text-gray-500">
                Máx. 5MB · 1200x400px
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className="text-right">
              Nombre Comercial
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              placeholder="Nombre de tu tienda"
            />
            <p className="text-xs text-gray-500">
              Este es el nombre que verán tus clientes.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description" className="text-right">
              Descripción Pública
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="col-span-3 min-h-[100px]"
              placeholder="Describe tu negocio, productos y servicios..."
            />
          </div>

          {/* Location fields */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <MapPin className="h-4 w-4" />
              Ubicación de la Tienda
            </Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country">País</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Selecciona un país" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50 max-h-[300px]">
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.name} className="cursor-pointer">
                        <span className="flex items-center gap-2">
                          <span>{c.flag}</span>
                          <span>{c.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Ciudad (texto libre)</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ej: Port-au-Prince"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Select value={departmentId} onValueChange={(v) => { setDepartmentId(v); setCommuneId(""); }}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Selecciona departamento" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50 max-h-[300px]">
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id} className="cursor-pointer">{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Comuna</Label>
                <Select
                  value={communeId}
                  onValueChange={setCommuneId}
                  disabled={!departmentId || communes.length === 0}
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder={departmentId ? "Selecciona comuna" : "Elige departamento primero"} />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50 max-h-[300px]">
                    {communes.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="cursor-pointer">{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Social Media Fields */}
          <div className="space-y-4">
            <Label className="text-base font-semibold text-gray-700">Redes Sociales</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="instagram" className="flex items-center gap-2 text-sm">
                  <Instagram className="h-4 w-4 text-pink-500" />
                  Instagram
                </Label>
                <Input
                  id="instagram"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="@tu_tienda"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="facebook" className="flex items-center gap-2 text-sm">
                  <svg className="h-4 w-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Facebook
                </Label>
                <Input
                  id="facebook"
                  value={facebook}
                  onChange={(e) => setFacebook(e.target.value)}
                  placeholder="facebook.com/tu_tienda"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp" className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-green-500" />
                  WhatsApp
                </Label>
                <Input
                  id="whatsapp"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="+509 1234 5678"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tiktok" className="flex items-center gap-2 text-sm">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                  </svg>
                  TikTok
                </Label>
                <Input
                  id="tiktok"
                  value={tiktok}
                  onChange={(e) => setTiktok(e.target.value)}
                  placeholder="@tu_tienda"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Agrega tus redes sociales para que tus clientes puedan seguirte.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isLoading || isUploadingLogo || isUploadingBanner} 
            className="bg-[#071d7f] hover:bg-[#051560]"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Cambios
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
