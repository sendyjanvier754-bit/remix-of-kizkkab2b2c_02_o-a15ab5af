import { UserEditDialog } from "@/components/seller/UserEditDialog";
import { SellerLayout } from "@/components/seller/SellerLayout";
import { useAuth } from "@/hooks/useAuth";
import { useStoreByOwner } from "@/hooks/useStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PaymentMethodsDisplay, PaymentMethodsData } from "@/components/shared/PaymentMethodsDisplay";
import { usePaymentSettings } from "@/hooks/usePaymentSettings";
import { 
  User, MapPin, Calendar, Shield, Mail, Phone, 
  CheckCircle, Edit, ArrowLeft, FileText, CreditCard
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const SellerProfilePage = () => {
  const { user } = useAuth();
  const { data: store } = useStoreByOwner(user?.id);
  const { settings: adminPaymentSettings } = usePaymentSettings();
  const navigate = useNavigate();
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Convert admin payment settings to PaymentMethodsData format for sellers
  const adminPaymentData: PaymentMethodsData = {
    bank_info: {
      bank_name: adminPaymentSettings.bankName,
      account_number: adminPaymentSettings.bankAccount,
      account_holder: adminPaymentSettings.bankBeneficiary,
    },
    moncash_info: {
      phone_number: adminPaymentSettings.moncashNumber,
      name: adminPaymentSettings.moncashName,
    },
  };

  // Helper for semi-complete name
  const getSemiCompleteName = (fullName: string) => {
    if (!fullName) return "";
    const parts = fullName.split(" ");
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
  };

  return (
    <SellerLayout>
      <div className="min-h-screen bg-gray-50/50 pb-12 w-full font-sans">
        {/* Hero Section */}
        <div className="relative h-48 md:h-64 w-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#071d7f] via-[#0a2a9f] to-[#051560]" />
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay" />
            
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-72 h-72 bg-blue-400/10 rounded-full blur-2xl" />

            <div className="container mx-auto px-4 md:px-6 h-full flex items-end pb-6 md:pb-8 relative z-10">
                <div className="flex flex-col md:flex-row md:items-end gap-6 w-full">
                    <div className="relative cursor-pointer" onClick={() => setShowProfileModal(true)}>
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 to-cyan-300 rounded-full blur opacity-30"></div>
                            <Avatar className="h-24 w-24 md:h-32 md:w-32 border-4 border-white shadow-2xl relative hover:opacity-80 transition-opacity cursor-pointer">
                            {store?.logo && <AvatarImage src={store.logo} alt={store?.name} />}
                            <AvatarFallback className="text-4xl font-bold bg-white text-[#071d7f]">
                                {user?.name?.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                    </div>
                    
                    <div className="mb-2 text-white flex-1">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex-1">
                                <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-white drop-shadow-md">
                                    {user?.name}
                                </h1>
                                <p className="text-blue-100/80 flex items-center gap-2 mt-2 text-lg">
                                    <Mail className="h-4 w-4" />
                                    {user?.email}
                                </p>
                                <Button
                                    onClick={() => setShowProfileModal(true)}
                                    variant="outline"
                                    className="mt-3 bg-white/10 hover:bg-white/20 text-white border-white/30 hover:border-white/50"
                                >
                                    <FileText className="h-4 w-4 mr-2" />
                                    Ver Descripción
                                </Button>
                            </div>
                            
                            <Button 
                                onClick={() => navigate(-1)}
                                className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Volver
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="container mx-auto px-6 mt-8">
            <div className="grid gap-8 md:grid-cols-12">
                {/* Left Column: Quick Info */}
                <div className="md:col-span-4 lg:col-span-3 space-y-6">
                    <Card className="shadow-lg border-none overflow-hidden sticky top-28">
                        <CardHeader className="bg-gray-50 border-b pb-4">
                            <CardTitle className="text-lg font-bold text-gray-900">Estado de Cuenta</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500 font-medium">Estado</span>
                                <Badge className="bg-green-500 hover:bg-green-600">
                                    Activo
                                </Badge>
                            </div>
                            
                            <Separator />
                            
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-50 text-[#071d7f] rounded-lg">
                                        <Calendar className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Fecha de Creación</p>
                                        <p className="font-medium text-gray-900">
                                            {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "-"}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-50 text-[#071d7f] rounded-lg">
                                        <Shield className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Rol</p>
                                        <p className="font-medium text-gray-900 capitalize">
                                            {user?.role || "Vendedor"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Detailed Info */}
                <div className="md:col-span-8 lg:col-span-9 space-y-6">
                    <Card className="shadow-lg border-none overflow-hidden">
                        <CardHeader className="border-b bg-white px-8 py-6">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-xl font-bold text-[#071d7f] flex items-center gap-2">
                                    <User className="h-5 w-5" />
                                    Información Personal
                                </CardTitle>
                                <UserEditDialog user={user} />
                            </div>
                        </CardHeader>
                        <CardContent className="p-8">
                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Nombre Completo</label>
                                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 text-gray-900 font-medium">
                                        {user?.name}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Nombre Semi-Completo</label>
                                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 text-gray-900 font-medium">
                                        {getSemiCompleteName(user?.name || "")}
                                    </div>
                                    <p className="text-xs text-gray-400">Visible para compradores antes de la compra.</p>
                                </div>
                                
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Dirección</label>
                                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 text-gray-900 flex items-center gap-3">
                                        <MapPin className="h-5 w-5 text-gray-400" />
                                        <span className="font-medium">{(store as any)?.address || "Dirección no configurada"}</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-lg border-none overflow-hidden">
                        <CardHeader className="border-b bg-white px-8 py-6">
                            <CardTitle className="text-xl font-bold text-[#071d7f] flex items-center gap-2">
                                <Phone className="h-5 w-5" />
                                Información de Contacto
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8">
                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Email Principal</label>
                                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 text-gray-900 flex items-center gap-3">
                                        <Mail className="h-5 w-5 text-gray-400" />
                                        <span className="font-medium">{user?.email}</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Teléfono</label>
                                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 text-gray-900 flex items-center gap-3">
                                        <Phone className="h-5 w-5 text-gray-400" />
                                        <span className="font-medium">{(store as any)?.phone || "No configurado"}</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Admin Payment Methods - For sellers to know where to pay */}
                    <Card className="shadow-lg border-none overflow-hidden">
                        <CardHeader className="border-b bg-white px-8 py-6">
                            <CardTitle className="text-xl font-bold text-[#071d7f] flex items-center gap-2">
                                <CreditCard className="h-5 w-5" />
                                Métodos de Pago (Plataforma)
                            </CardTitle>
                            <p className="text-sm text-gray-500 mt-1">
                                Estos son los métodos de pago configurados por el administrador para realizar tus compras B2B.
                            </p>
                        </CardHeader>
                        <CardContent className="p-8">
                            <PaymentMethodsDisplay 
                                paymentData={adminPaymentData}
                                title="Datos de Pago"
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>

        {/* Profile Photo and Description Modal */}
        <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Perfil de la Tienda</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Photo Section */}
              <div className="flex justify-center">
                <div className="relative w-40 h-40">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 to-cyan-300 rounded-full blur opacity-30"></div>
                  <Avatar className="w-40 h-40 border-4 border-white shadow-2xl relative">
                    <AvatarFallback className="text-6xl font-bold bg-gradient-to-br from-blue-500 to-cyan-400 text-white">
                      {user?.name?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>

              {/* Store Info */}
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900">{user?.name}</h2>
                <p className="text-gray-500 mt-1">{user?.email}</p>
              </div>

              {/* Description Section */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[#071d7f]" />
                  Descripción de la Tienda
                </h3>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {(store as any)?.description || "Sin descripción configurada"}
                  </p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </SellerLayout>
  );
};

export default SellerProfilePage;
