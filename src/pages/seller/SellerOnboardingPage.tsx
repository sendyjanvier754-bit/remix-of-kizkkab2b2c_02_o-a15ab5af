import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Store, Upload, Instagram, Facebook, MessageCircle, ArrowRight, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { z } from "zod";

const storeSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(100),
  description: z.string().max(500, "La descripción no puede exceder 500 caracteres").optional(),
  city: z.string().max(100).optional(),
  whatsapp: z.string().max(20).optional(),
  instagram: z.string().max(100).optional(),
  facebook: z.string().max(100).optional(),
});

const SellerOnboardingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    city: "",
    whatsapp: "",
    instagram: "",
    facebook: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch existing store data
  useEffect(() => {
    const fetchStore = async () => {
      if (!user?.id) {
        setIsFetching(false);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from("stores")
          .select("*")
          .eq("owner_user_id", user.id)
          .single();
        
        if (error && error.code !== "PGRST116") {
          console.error("Error fetching store:", error);
        }
        
        if (data) {
          setStoreId(data.slug);
          setFormData({
            name: data.name || "",
            description: data.description || "",
            city: data.city || "",
            whatsapp: data.whatsapp || "",
            instagram: data.instagram || "",
            facebook: data.facebook || "",
          });
          if (data.logo) {
            setLogoPreview(data.logo);
          }
        }
      } finally {
        setIsFetching(false);
      }
    };

    fetchStore();
  }, [user]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("El logo no puede exceder 2MB");
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile || !user?.id) return null;
    
    const fileExt = logoFile.name.split(".").pop();
    const fileName = `${user.id}/logo-${Date.now()}.${fileExt}`;
    
    const { error } = await supabase.storage
      .from("product-images")
      .upload(fileName, logoFile);
    
    if (error) {
      console.error("Logo upload error:", error);
      return null;
    }
    
    const { data: urlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(fileName);
    
    return urlData.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = storeSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    if (!user?.id) {
      toast.error("No se encontró sesión de usuario");
      return;
    }

    setIsLoading(true);

    try {
      let logoUrl = logoPreview;
      
      if (logoFile) {
        const uploadedUrl = await uploadLogo();
        if (uploadedUrl) {
          logoUrl = uploadedUrl;
        }
      }

      const slug = formData.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") + "-" + Math.floor(Math.random() * 1000);

      if (storeId) {
        // Update existing store AND ACTIVATE IT
        console.log(`📝 Completing and activating store ${storeId}...`);
        
        const { error } = await supabase
          .from("stores")
          .update({
            name: formData.name,
            description: formData.description || null,
            city: formData.city || null,
            whatsapp: formData.whatsapp || null,
            instagram: formData.instagram || null,
            facebook: formData.facebook || null,
            logo: logoUrl,
            is_active: true,  // ✅ ACTIVATE store after configuration
          })
          .eq("id", storeId);

        if (error) throw error;
        
        console.log(`✅ Store ${storeId} configured and activated!`);
      } else {
        // Create new store (shouldn't happen - store should be created when role assigned)
        console.log(`⚠️ Creating new store (placeholder didn't exist)...`);
        
        const { error } = await supabase
          .from("stores")
          .insert({
            owner_user_id: user.id,
            name: formData.name,
            description: formData.description || null,
            city: formData.city || null,
            whatsapp: formData.whatsapp || null,
            instagram: formData.instagram || null,
            facebook: formData.facebook || null,
            logo: logoUrl,
            slug: slug,
            is_active: true,
          });

        if (error) throw error;
        
        console.log(`✅ New store created and activated!`);
      }

      toast.success("¡Tu tienda ha sido configurada exitosamente!");
      navigate("/seller/adquisicion-lotes");
    } catch (error) {
      console.error("Store update error:", error);
      toast.error("Error al guardar la tienda");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    navigate("/seller/adquisicion-lotes");
  };

  if (isFetching) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const steps = [
    { number: 1, title: "Información básica", icon: Store },
    { number: 2, title: "Redes sociales", icon: Instagram },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-indigo-600 flex items-center justify-center">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-gray-900">Configura tu Tienda</h1>
              <p className="text-sm text-gray-500">Paso {currentStep} de 2</p>
            </div>
          </div>
          <Button variant="ghost" onClick={handleSkip} className="text-gray-500">
            Omitir por ahora
          </Button>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center gap-4 mb-8">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                  currentStep >= step.number
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-gray-400 border border-gray-200"
                }`}
              >
                {currentStep > step.number ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <step.icon className="w-5 h-5" />
                )}
                <span className="text-sm font-medium hidden sm:inline">{step.title}</span>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-12 h-0.5 mx-2 ${currentStep > step.number ? "bg-indigo-600" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="container mx-auto px-4 pb-16">
        <div className="max-w-xl mx-auto">
          <form onSubmit={handleSubmit}>
            {currentStep === 1 && (
              <div className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Información de tu Tienda</h2>
                  <p className="text-gray-500 mt-1">Estos datos serán visibles para tus clientes</p>
                </div>

                {/* Store ID (Read-only) */}
                {storeId && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                    <div className="flex items-center gap-3 justify-between">
                      <div>
                        <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide">ID de tu Tienda</p>
                        <p className="text-sm font-mono text-indigo-900 mt-1">{storeId}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(storeId);
                          toast.success("ID copiado al portapapeles");
                        }}
                        className="px-3 py-2 text-sm border border-indigo-300 rounded hover:bg-indigo-100 transition-colors"
                      >
                        Copiar
                      </button>
                    </div>
                  </div>
                )}

                {/* Logo Upload */}
                <div className="flex flex-col items-center">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Logo de tu Tienda
                  </label>
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <Upload className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Máximo 2MB</p>
                </div>

                {/* Store Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de la Tienda *
                  </label>
                  <Input
                    type="text"
                    placeholder="Ej: Boutique Fashion"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    disabled={isLoading}
                    className="w-full"
                  />
                  {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción
                  </label>
                  <Textarea
                    placeholder="Cuéntale a tus clientes sobre tu tienda..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    disabled={isLoading}
                    rows={3}
                    className="w-full resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">{formData.description.length}/500 caracteres</p>
                  {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
                </div>

                {/* City */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ciudad
                  </label>
                  <Input
                    type="text"
                    placeholder="Ej: Port-au-Prince"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    disabled={isLoading}
                    className="w-full"
                  />
                </div>

                <Button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                  disabled={!formData.name}
                >
                  Continuar
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}

            {currentStep === 2 && (
              <div className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Redes Sociales</h2>
                  <p className="text-gray-500 mt-1">Conecta con tus clientes (opcional)</p>
                </div>

                {/* WhatsApp */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <MessageCircle className="w-4 h-4 inline mr-2" />
                    WhatsApp
                  </label>
                  <Input
                    type="tel"
                    placeholder="+509 1234 5678"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    disabled={isLoading}
                    className="w-full"
                  />
                </div>

                {/* Instagram */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Instagram className="w-4 h-4 inline mr-2" />
                    Instagram
                  </label>
                  <Input
                    type="text"
                    placeholder="@mi_tienda"
                    value={formData.instagram}
                    onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                    disabled={isLoading}
                    className="w-full"
                  />
                </div>

                {/* Facebook */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Facebook className="w-4 h-4 inline mr-2" />
                    Facebook
                  </label>
                  <Input
                    type="text"
                    placeholder="facebook.com/mitienda"
                    value={formData.facebook}
                    onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                    disabled={isLoading}
                    className="w-full"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(1)}
                    className="flex-1"
                    disabled={isLoading}
                  >
                    Atrás
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        Finalizar
                        <CheckCircle className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default SellerOnboardingPage;
