import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle, Users, Shield, TrendingUp, Loader2, LinkIcon, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { generateUniqueStoreSlug } from "@/utils/storeSlugGenerator";
import { useBranding } from "@/hooks/useBranding";

const sellerRegistrationSchema = z.object({
  storeName: z.string().min(2, "El nombre de la tienda debe tener al menos 2 caracteres").max(100),
  storeDescription: z.string().max(300, "La descripción no puede exceder 300 caracteres").optional(),
  email: z.string().email("Email inválido").max(255),
  phone: z.string().min(8, "Teléfono debe tener al menos 8 dígitos").max(20),
  country: z.string().min(1, "Selecciona un país"),
  businessType: z.string().min(1, "Selecciona un tipo de negocio"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

// Schema for linking existing account (no password required)
const linkAccountSchema = z.object({
  storeName: z.string().min(2, "El nombre de la tienda debe tener al menos 2 caracteres").max(100),
  storeDescription: z.string().max(300, "La descripción no puede exceder 300 caracteres").optional(),
  phone: z.string().min(8, "Teléfono debe tener al menos 8 dígitos").max(20),
  country: z.string().min(1, "Selecciona un país"),
  businessType: z.string().min(1, "Selecciona un tipo de negocio"),
});

const SellerRegistrationPage = () => {
  const { getValue } = useBranding();
  const platformName = getValue('platform_name');
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [existingUserData, setExistingUserData] = useState<{ id: string; email: string; full_name: string | null } | null>(null);
  const [showLinkOption, setShowLinkOption] = useState(false);
  const [formData, setFormData] = useState({
    storeName: "",
    storeDescription: "",
    email: "",
    phone: "",
    country: "",
    businessType: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Check if email exists when user leaves email field
  const checkEmailExists = async (email: string) => {
    if (!email || !email.includes('@')) return;
    
    setIsCheckingEmail(true);
    setShowLinkOption(false);
    setExistingUserData(null);
    
    try {
      // Check if profile exists with this email
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('email', email)
        .maybeSingle();
      
      if (error) {
        console.error('Error checking email:', error);
        return;
      }
      
      if (profile) {
        // Check if user already has seller role
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', profile.id)
          .eq('role', 'seller')
          .maybeSingle();
        
        if (roleData) {
          setErrors(prev => ({ ...prev, email: 'Esta cuenta ya es vendedor. Inicia sesión.' }));
        } else {
          setExistingUserData(profile);
          setShowLinkOption(true);
        }
      }
    } catch (error) {
      console.error('Error checking email:', error);
    } finally {
      setIsCheckingEmail(false);
    }
  };

  // Handle linking existing account to seller
  const handleLinkExistingAccount = async () => {
    if (!existingUserData) return;
    
    // Validate only required fields for linking
    const linkData = {
      storeName: formData.storeName,
      storeDescription: formData.storeDescription,
      phone: formData.phone,
      country: formData.country,
      businessType: formData.businessType,
    };
    
    const result = linkAccountSchema.safeParse(linkData);
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
    
    setIsLoading(true);
    
    try {
      // Create an admin approval request for the upgrade
      const { error: requestError } = await supabase
        .from('admin_approval_requests')
        .insert({
          requester_id: existingUserData.id,
          request_type: 'seller_upgrade' as any,
          status: 'pending',
          metadata: {
            user_email: existingUserData.email,
            user_name: existingUserData.full_name,
            store_name: formData.storeName,
            store_description: formData.storeDescription,
            phone: formData.phone,
            country: formData.country,
            business_type: formData.businessType,
            requested_at: new Date().toISOString(),
            source: 'seller_registration_form',
          },
        });
      
      if (requestError) throw requestError;
      
      toast.success('¡Solicitud enviada! Inicia sesión y un administrador aprobará tu cuenta vendedor.');
      navigate('/login');
    } catch (error) {
      console.error('Error linking account:', error);
      toast.error('Error al enviar la solicitud. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // If showing link option, use that flow instead
    if (showLinkOption && existingUserData) {
      handleLinkExistingAccount();
      return;
    }

    // Validate form
    const result = sellerRegistrationSchema.safeParse(formData);
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

    setIsLoading(true);

    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/seller/onboarding`,
          data: {
            full_name: formData.storeName,
          },
        },
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          // Check if we can show link option
          await checkEmailExists(formData.email);
          if (!showLinkOption) {
            toast.error("Este email ya está registrado. Intenta iniciar sesión.");
          }
        } else {
          toast.error(authError.message);
        }
        return;
      }

      if (!authData.user) {
        toast.error("Error al crear la cuenta");
        return;
      }

      // 2. Wait for profile to be created by trigger (with retry)
      let profileExists = false;
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", authData.user.id)
          .single();
        
        if (profile) {
          profileExists = true;
          break;
        }
      }

      if (!profileExists) {
        // Create profile manually if trigger didn't work
        await supabase.from("profiles").insert({
          id: authData.user.id,
          email: formData.email,
          full_name: formData.storeName,
        });
      }

      // 3. Create seller record
      const { error: sellerError } = await supabase.from("sellers").insert({
        user_id: authData.user.id,
        email: formData.email,
        name: formData.storeName,
        business_name: formData.storeName,
        phone: formData.phone,
        is_verified: false,
      });

      if (sellerError) {
        console.error("Seller creation error:", sellerError);
        // Continue even if seller creation fails
      }

      // 4. Create store record with name and description
      // Generate unique slug with collision detection
      const slug = await generateUniqueStoreSlug(async (candidateSlug) => {
        const { data } = await supabase
          .from('stores')
          .select('id')
          .eq('slug', candidateSlug)
          .maybeSingle();
        return data === null; // true if doesn't exist (unique)
      });

      if (!slug) {
        toast.error("Error generando ID de tienda. Por favor intenta de nuevo.");
        setIsLoading(false);
        return;
      }

      const { error: storeError } = await supabase.from("stores").insert({
        owner_user_id: authData.user.id,
        name: formData.storeName,
        description: formData.storeDescription || null,
        slug: slug,
        is_active: true,
      });

      if (storeError) {
        console.error("Store creation error:", storeError);
        // Don't block registration if store creation fails
      }

      // 5. Assign seller role
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: authData.user.id,
        role: "seller",
      });

      if (roleError) {
        console.error("Role assignment error:", roleError);
      }

      toast.success("¡Registro exitoso! Ahora configura tu tienda.");
      navigate("/seller/onboarding");
    } catch (error) {
      console.error("Registration error:", error);
      toast.error("Error al procesar el registro");
    } finally {
      setIsLoading(false);
    }
  };

  const benefits = [
    {
      icon: <Users className="w-8 h-8" />,
      title: "Acceso a Mayoristas",
      description: "Vende tus productos a mayoristas en toda la región",
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Pagos Seguros",
      description: "Sistema de pago anticipado verificado y confiable",
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: "Crece tu Negocio",
      description: "Herramientas para gestionar tu catálogo y ventas",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded bg-[#071d7f] flex items-center justify-center">
              <span className="text-white font-bold">S</span>
            </div>
            <span className="font-bold text-lg">{platformName}</span>
          </Link>
          <Link to="/" className="text-gray-700 hover:text-gray-900">
            Volver al inicio
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Crecimiento B2B Garantizado
          </h1>
          <p className="text-xl text-gray-700 max-w-2xl mx-auto mb-8">
            Únete a {platformName} y vende tus productos a mayoristas.
            Plataforma segura, pagos anticipados y acceso a nuevos mercados.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {benefits.map((benefit, index) => (
            <div
              key={index}
              className="bg-white rounded-lg p-8 shadow-md hover:shadow-lg transition text-center"        
            >
              <div className="flex justify-center mb-4 text-indigo-600">
                {benefit.icon}
              </div>
              <h3 className="text-xl font-bold mb-2">{benefit.title}</h3>
              <p className="text-gray-600">{benefit.description}</p>
            </div>
          ))}
        </div>

        {/* Registration Form Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left side - Value prop */}
          <div className="flex flex-col justify-center">
            <h2 className="text-3xl font-bold mb-6">¿Por qué unirse a {platformName}?</h2>

            <ul className="space-y-4">
              {[
                "Acceso a múltiples mayoristas de la región",
                "Pagos anticipados - Sin esperar a cobrar",
                "Panel de control para gestionar productos",
                "Soporte dedicado en español",
                "Comisiones competitivas",
                "Red de puntos de recogida",
              ].map((feature, index) => (
                <li key={index} className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right side - Form */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h3 className="text-2xl font-bold mb-6">Solicitar acceso</h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de tu Tienda *
                </label>
                <Input
                  type="text"
                  placeholder="Ej: Boutique Fashion Haiti"
                  value={formData.storeName}
                  onChange={(e) =>
                    setFormData({ ...formData, storeName: e.target.value })
                  }
                  required
                  className="w-full"
                  disabled={isLoading}
                />
                {errors.storeName && (
                  <p className="text-red-500 text-sm mt-1">{errors.storeName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción de tu Tienda
                </label>
                <Input
                  type="text"
                  placeholder="Ej: Ropa y accesorios de moda para toda la familia"
                  value={formData.storeDescription}
                  onChange={(e) =>
                    setFormData({ ...formData, storeDescription: e.target.value })
                  }
                  className="w-full"
                  disabled={isLoading}
                />
                {errors.storeDescription && (
                  <p className="text-red-500 text-sm mt-1">{errors.storeDescription}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <div className="relative">
                  <Input
                    type="email"
                    placeholder="contacto@empresa.com"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      setShowLinkOption(false);
                      setExistingUserData(null);
                    }}
                    onBlur={(e) => checkEmailExists(e.target.value)}
                    required
                    className="w-full"
                    disabled={isLoading}
                  />
                  {isCheckingEmail && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    </div>
                  )}
                </div>
                {errors?.email && (
                  <p className="text-red-500 text-sm mt-1">{errors.email}</p>
                )}
                
                {/* Link Existing Account Alert */}
                {showLinkOption && existingUserData && (
                  <Alert className="mt-3 border-indigo-200 bg-indigo-50">
                    <LinkIcon className="h-4 w-4 text-indigo-600" />
                    <AlertTitle className="text-indigo-800">¡Cuenta encontrada!</AlertTitle>
                    <AlertDescription className="text-indigo-700">
                      Ya existe una cuenta con este email ({existingUserData.full_name || 'Usuario'}). 
                      Puedes vincular tu cuenta existente para ser vendedor sin crear una nueva.
                      <br />
                      <span className="text-sm text-indigo-600">
                        Completa el formulario y enviaremos tu solicitud para aprobación.
                      </span>
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono *
                </label>
                <Input
                  type="tel"
                  placeholder="+1 (509) 1234-5678"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  required
                  className="w-full"
                  disabled={isLoading}
                />
                {errors.phone && (
                  <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  País *
                </label>
                <select
                  value={formData.country}
                  onChange={(e) =>
                    setFormData({ ...formData, country: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={isLoading}
                >
                  <option value="">Selecciona tu país</option>
                  <option value="haiti">Haití</option>
                  <option value="república-dominicana">República Dominicana</option>
                  <option value="jamaica">Jamaica</option>
                  <option value="otro">Otro</option>
                </select>
                {errors.country && (
                  <p className="text-red-500 text-sm mt-1">{errors.country}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Negocio *
                </label>
                <select
                  value={formData.businessType}
                  onChange={(e) =>
                    setFormData({ ...formData, businessType: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={isLoading}
                >
                  <option value="">Selecciona tu tipo de negocio</option>
                  <option value="retail">Tienda Minorista</option>
                  <option value="distribuidor">Distribuidor</option>
                  <option value="mayorista">Mayorista</option>
                  <option value="fabricante">Fabricante</option>
                  <option value="otro">Otro</option>
                </select>
                {errors.businessType && (
                  <p className="text-red-500 text-sm mt-1">{errors.businessType}</p>
                )}
              </div>

              {/* Only show password fields if NOT linking existing account */}
              {!showLinkOption && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contraseña *
                    </label>
                    <Input
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      required
                      className="w-full"
                      disabled={isLoading}
                    />
                    {errors?.password && (
                      <p className="text-red-500 text-sm mt-1">{errors.password}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirmar Contraseña *
                    </label>
                    <Input
                      type="password"
                      placeholder="Repite tu contraseña"
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        setFormData({ ...formData, confirmPassword: e.target.value })
                      }
                      required
                      className="w-full"
                      disabled={isLoading}
                    />
                    {errors?.confirmPassword && (
                      <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>
                    )}
                  </div>
                </>
              )}

              <div className="pt-4">
                <Button
                  type="submit"
                  className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition ${
                    showLinkOption 
                      ? 'bg-green-600 hover:bg-green-700 text-white' 
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Procesando...
                    </>
                  ) : showLinkOption ? (
                    <>
                      <LinkIcon className="w-4 h-4" />
                      Vincular Cuenta Existente
                    </>
                  ) : (
                    <>
                      Crear Cuenta
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>

              <p className="text-sm text-gray-600 text-center">
                ¿Ya tienes cuenta?{" "}
                <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">
                  Inicia sesión
                </Link>
              </p>

              <p className="text-xs text-gray-500 text-center mt-4">
                Tu cuenta será revisada por un administrador antes de poder publicar productos.
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white mt-16">
        <div className="container mx-auto px-4 py-8 text-center">
          <p>&copy; {new Date().getFullYear()} {platformName}. Plataforma B2B de Comercio Mayorista.</p>
        </div>
      </footer>
    </div>
  );
};

export default SellerRegistrationPage;
