import { useState, useEffect } from "react";
import { OpenChatButton } from "@/components/chat/OpenChatButton";
import { SellerLayout } from "@/components/seller/SellerLayout";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useStoreByOwner } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  User, Store, Mail, Calendar, Shield, LogOut, Settings, Bell, Edit, Phone, MessageCircle, Eye, EyeOff, CheckCircle, CreditCard, Package, Clock, Truck, XCircle, DollarSign, ShoppingCart, AlertCircle, ExternalLink, MapPin, RefreshCw, AlertTriangle, Ban, ChevronRight, Loader2, Save, Star, Users, BarChart3, Smartphone, Camera, TrendingUp, Activity, Globe, Info
} from "lucide-react";
import { LegalPagesModal } from "@/components/legal/LegalPagesModal";
import { AboutModal } from "@/components/legal/AboutModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMarkets } from "@/hooks/useMarkets";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useSellerStatuses } from "@/hooks/useSellerStatuses";
import { SellerStatusViewer } from "@/components/seller/SellerStatusViewer";
import { useAdminBanners } from "@/hooks/useAdminBanners";
import { SellerQuotesHistory } from "@/components/seller/SellerQuotesHistory";
import { KYCUploadForm } from "@/components/seller/KYCUploadForm";
import { StoreShippingConfig } from "@/components/seller/StoreShippingConfig";
import { useBuyerB2BOrders, useCancelBuyerOrder, BuyerOrder, BuyerOrderStatus, RefundStatus } from "@/hooks/useBuyerOrders";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Link, useSearchParams } from "react-router-dom";
import RecommendedProductsSection from "@/components/products/RecommendedProductsSection";

const SellerAccountPage = () => {
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();
  const { data: store, isLoading } = useStoreByOwner(user?.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  
  // States for dialogs
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'informacion');
  const [showLegal, setShowLegal] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  // Scroll to section if requested via URL param
  useEffect(() => {
    const section = searchParams.get('section');
    if (section) {
      setTimeout(() => {
        const el = document.getElementById(`section-${section}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 400);
    }
  }, [searchParams]);
  const [statsTimeFilter, setStatsTimeFilter] = useState<'semana' | 'mes' | 'trimestre' | 'año'>('semana');
  const [showStatsFilter, setShowStatsFilter] = useState(false);
  const [activeStatTab, setActiveStatTab] = useState<'vistas' | 'conversion' | 'ingresos' | 'productos'>('vistas');
  const [showStatusViewer, setShowStatusViewer] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);
  const [showEditStore, setShowEditStore] = useState(false);
  const [showEditProfilePhoto, setShowEditProfilePhoto] = useState(false);
  const [showEditInfo, setShowEditInfo] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [storeDescription, setStoreDescription] = useState(store?.description || "");
  const [showViewProfilePhoto, setShowViewProfilePhoto] = useState<'profile' | 'banner' | null>(null);
  const [showEditPersonalPhoto, setShowEditPersonalPhoto] = useState(false);
  const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);
  const [newAvatarPreview, setNewAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [newLogoFile, setNewLogoFile] = useState<File | null>(null);
  const [newBannerFiles, setNewBannerFiles] = useState<File[]>([]);
  const [newLogoPreview, setNewLogoPreview] = useState<string | null>(null);
  const [newBannerPreviews, setNewBannerPreviews] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  
  // Store Info states
  const [editStoreName, setEditStoreName] = useState(store?.name || "");
  const [editStoreDescription, setEditStoreDescription] = useState(store?.description || "");
  const [editCountry, setEditCountry] = useState(store?.country || "");
  const [editDepartmentId, setEditDepartmentId] = useState(store?.department_id || "");
  const [editCommuneId, setEditCommuneId] = useState(store?.commune_id || "");
  const [locationDepartments, setLocationDepartments] = useState<{ id: string; name: string }[]>([]);
  const [locationCommunes, setLocationCommunes] = useState<{ id: string; name: string }[]>([]);
  const [savingStoreInfo, setSavingStoreInfo] = useState(false);

  // Fetch departments once
  useEffect(() => {
    supabase.from("departments").select("id, name").eq("is_active", true).order("name")
      .then(({ data }) => setLocationDepartments(data || []));
  }, []);
  // Fetch communes when department changes
  useEffect(() => {
    if (!editDepartmentId) { setLocationCommunes([]); return; }
    supabase.from("communes").select("id, name").eq("department_id", editDepartmentId).eq("is_active", true).order("name")
      .then(({ data }) => setLocationCommunes(data || []));
  }, [editDepartmentId]);
  
  // Contact Info states
  const [contactInfo, setContactInfo] = useState({
    full_name: user?.name || "",
    phone: "",
    whatsapp: store?.whatsapp || "",
  });
  const [savingContact, setSavingContact] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [statusFilter, setStatusFilter] = useState<BuyerOrderStatus | 'all'>('all');
  const [ordersPage, setOrdersPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<BuyerOrder | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [requestRefund, setRequestRefund] = useState(false);
  // Market & Shipping configuration
  // Admin manages markets; seller only picks from ready ones (country + route + tier configured).
  const { readyMarkets, isLoading: loadingMarkets } = useMarkets();
  const [selectedMarketId, setSelectedMarketId] = useState<string>('');
  const [selectedCountryId, setSelectedCountryId] = useState<string>('');
  const [currentMarketId, setCurrentMarketId] = useState<string | null>(null);
  const [savingMarket, setSavingMarket] = useState(false);

  // Load current market+country from the store object (already fetched by useStoreByOwner)
  useEffect(() => {
    const storeMarketId = store?.market_id;
    const storeCountryId = store?.destination_country_id;
    if (storeMarketId) {
      setCurrentMarketId(storeMarketId);
      setSelectedMarketId(storeMarketId);
      const mkt = readyMarkets.find(m => m.id === storeMarketId);
      if (mkt) {
        // If store already has a saved country use it, else auto‑select if market has exactly 1
        if (storeCountryId) {
          setSelectedCountryId(storeCountryId);
        } else if (mkt.countries?.length === 1) {
          setSelectedCountryId(mkt.countries[0].id);
        }
      }
    }
  }, [store, readyMarkets]);

  const handleSaveMarket = async () => {
    if (!store?.id || !selectedMarketId || !selectedCountryId) return;
    setSavingMarket(true);
    try {
      const market = readyMarkets.find(m => m.id === selectedMarketId);
      if (!market) throw new Error('Mercado no encontrado');
      // Validate: the chosen country must belong to this market
      const countryInMarket = market.countries?.find(c => c.id === selectedCountryId);
      if (!countryInMarket) throw new Error('El país seleccionado no pertenece a este mercado');
      // Save both market_id and destination_country_id to the seller's store
      const { error } = await supabase
        .from('stores')
        .update({ market_id: selectedMarketId, destination_country_id: selectedCountryId } as any)
        .eq('id', store.id);
      if (error) throw error;
      setCurrentMarketId(selectedMarketId);
      queryClient.invalidateQueries({ queryKey: ['store', 'owner', user?.id] });
      toast({ title: 'Mercado guardado', description: `Mercado "${market.name}" → ${countryInMarket.name} configurado.` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'No se pudo guardar el mercado', variant: 'destructive' });
    } finally {
      setSavingMarket(false);
    }
  };

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    orderNotifications: true,
    promotionalEmails: false,
    whatsappNotifications: true
  });
  const [storeSettings, setStoreSettings] = useState({
    is_open: true,
    allow_comments: true,
    show_stock: false
  });
  const [updatingStoreSettings, setUpdatingStoreSettings] = useState(false);
  const [bankInfo, setBankInfo] = useState({
    bank_name: "",
    account_type: "",
    account_number: "",
    account_holder: ""
  });
  const [updatingBankInfo, setUpdatingBankInfo] = useState(false);
  const [moncashInfo, setMoncashInfo] = useState({
    phone_number: "",
    name: ""
  });
  const [updatingMoncash, setUpdatingMoncash] = useState(false);
  const [natcashInfo, setNatcashInfo] = useState({
    phone_number: "",
    name: ""
  });
  const [updatingNatcash, setUpdatingNatcash] = useState(false);
  
  // Load payment info and contact info when store/user data is available
  useEffect(() => {
    if (store?.metadata) {
      const metadata = store.metadata as Record<string, any>;
      if (metadata.bank_info) {
        setBankInfo({
          bank_name: metadata.bank_info.bank_name || "",
          account_type: metadata.bank_info.account_type || "",
          account_number: metadata.bank_info.account_number || "",
          account_holder: metadata.bank_info.account_holder || ""
        });
      }
      if (metadata.moncash_info) {
        setMoncashInfo({
          phone_number: metadata.moncash_info.phone_number || "",
          name: metadata.moncash_info.name || ""
        });
      }
      if (metadata.natcash_info) {
        setNatcashInfo({
          phone_number: metadata.natcash_info.phone_number || "",
          name: metadata.natcash_info.name || ""
        });
      }
    }
    
    // Update store info states when store loads
    if (store) {
      setEditStoreName(store.name || "");
      setEditStoreDescription(store.description || "");
      setEditCountry(store.country || "");
      setEditDepartmentId(store.department_id || "");
      setEditCommuneId(store.commune_id || "");
      setStoreDescription(store.description || "");
      setContactInfo(prev => ({
        ...prev,
        whatsapp: store.whatsapp || "",
      }));
    }
  }, [store]);

  // Load profile phone when user changes
  useEffect(() => {
    const loadProfilePhone = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', user.id)
        .single();
      if (data) {
        setContactInfo(prev => ({
          ...prev,
          full_name: data.full_name || user.name || "",
          phone: data.phone || "",
        }));
      }
    };
    loadProfilePhone();
  }, [user?.id, user?.name]);

  const [showStoreDescription, setShowStoreDescription] = useState(false);
  
  // Hooks for orders
  const { data: orders, isLoading: ordersLoading } = useBuyerB2BOrders(statusFilter === 'all' ? undefined : statusFilter);
  const cancelOrder = useCancelBuyerOrder();
  
  // Statuses hook
  const { statuses, deleteStatus } = useSellerStatuses(store?.id || null);
  
  // Admin banners
  const { banners: adminBanners } = useAdminBanners('sellers');
  const activeBanner = adminBanners.find(b => b.is_active);

  // Fetch seller verification status
  const { data: seller } = useQuery({
    queryKey: ["seller", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("sellers")
        .select("is_verified")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        console.error("Error fetching seller:", error);
        return null;
      }
      return data;
    },
    enabled: !!user?.id,
  });

  // Real stats
  const { data: productsCount = 0 } = useQuery({
    queryKey: ["seller-products-count", store?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("seller_catalog")
        .select("id", { count: "exact", head: true })
        .eq("seller_store_id", store!.id)
        .eq("is_active", true);
      return count || 0;
    },
    enabled: !!store?.id,
  });

  const { data: salesCount = 0 } = useQuery({
    queryKey: ["seller-sales-count", store?.id],
    queryFn: async () => {
      const { data: sellerRow } = await supabase
        .from("sellers")
        .select("id")
        .eq("user_id", store!.owner_user_id)
        .maybeSingle();
      if (!sellerRow) return 0;
      const { count } = await supabase
        .from("orders_b2b")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", sellerRow.id)
        .not("status", "eq", "cancelled");
      return count || 0;
    },
    enabled: !!store?.id,
  });

  const isVerified = seller?.is_verified || false;

  // Status config
  const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType; bgColor: string }> = {
    draft: { label: 'Borrador', color: 'text-gray-600', icon: Clock, bgColor: 'bg-gray-100' },
    placed: { label: 'Confirmado', color: 'text-blue-600', icon: Package, bgColor: 'bg-blue-100' },
    paid: { label: 'Pagado', color: 'text-amber-600', icon: CheckCircle, bgColor: 'bg-amber-100' },
    preparing: { label: 'En Preparación', color: 'text-amber-600', icon: Package, bgColor: 'bg-amber-100' },
    in_transit: { label: 'En Tránsito', color: 'text-blue-600', icon: Truck, bgColor: 'bg-blue-100' },
    shipped: { label: 'En camino', color: 'text-purple-600', icon: Truck, bgColor: 'bg-purple-100' },
    delivered: { label: 'Entregado', color: 'text-green-600', icon: CheckCircle, bgColor: 'bg-green-100' },
    cancelled: { label: 'Cancelado', color: 'text-red-600', icon: XCircle, bgColor: 'bg-red-100' },
  };
  const defaultStatusConfig = { label: 'Desconocido', color: 'text-gray-600', icon: Clock, bgColor: 'bg-gray-100' };

  const refundStatusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    none: { label: 'Sin reembolso', color: 'text-gray-600', bgColor: 'bg-gray-100' },
    requested: { label: 'Solicitado', color: 'text-amber-600', bgColor: 'bg-amber-100' },
    processing: { label: 'En proceso', color: 'text-blue-600', bgColor: 'bg-blue-100' },
    completed: { label: 'Completado', color: 'text-green-600', bgColor: 'bg-green-100' },
    rejected: { label: 'Rechazado', color: 'text-red-600', bgColor: 'bg-red-100' },
  };

  const carrierUrls: Record<string, string> = {
    "DHL": "https://www.dhl.com/en/express/tracking.html?AWB=",
    "FedEx": "https://www.fedex.com/fedextrack/?trknbr=",
    "UPS": "https://www.ups.com/track?tracknum=",
    "USPS": "https://tools.usps.com/go/TrackConfirmAction?tLabels=",
  };

  const getStatusBadge = (status: BuyerOrderStatus) => {
    const config = statusConfig[status] ?? defaultStatusConfig;
    const Icon = config.icon;
    return (
      <Badge className={`${config.bgColor} ${config.color} gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Las contraseñas no coinciden",
        variant: "destructive",
      });
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({
        title: "Éxito",
        description: "Contraseña actualizada correctamente",
      });
      setShowChangePassword(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: "No se pudo actualizar la contraseña",
        variant: "destructive",
      });
    }
  };

  const handleSaveNotifications = () => {
    toast({
      title: "Éxito",
      description: "Configuración de notificaciones actualizada",
    });
    setShowNotifications(false);
  };

  const handleUpdateStoreSettings = async () => {
    if (!store?.id) return;
    
    setUpdatingStoreSettings(true);
    try {
      const { error } = await supabase
        .from("stores")
        .update({
          metadata: {
            ...store.metadata,
            is_open: storeSettings.is_open,
            allow_comments: storeSettings.allow_comments,
            show_stock: storeSettings.show_stock
          }
        })
        .eq("id", store.id);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Configuración de tienda actualizada correctamente",
      });

      queryClient.invalidateQueries({ queryKey: ["store", "owner", user?.id] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la configuración",
        variant: "destructive",
      });
    } finally {
      setUpdatingStoreSettings(false);
    }
  };

  const handleUpdateBankInfo = async () => {
    if (!store?.id) return;
    
    setUpdatingBankInfo(true);
    try {
      // Save to payment_methods table
      const existingMethod = await supabase
        .from('payment_methods')
        .select('id')
        .eq('owner_type', 'store')
        .eq('owner_id', store.id)
        .eq('method_type', 'bank')
        .maybeSingle();

      const paymentData = {
        owner_type: 'store',
        owner_id: store.id,
        method_type: 'bank',
        is_active: true,
        display_name: 'Transferencia Bancaria',
        bank_name: bankInfo.bank_name,
        account_type: bankInfo.account_type,
        account_number: bankInfo.account_number,
        account_holder: bankInfo.account_holder,
      };

      if (existingMethod.data?.id) {
        const { error } = await supabase
          .from('payment_methods')
          .update(paymentData)
          .eq('id', existingMethod.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('payment_methods')
          .insert(paymentData);
        if (error) throw error;
      }

      // Also update store metadata for backwards compatibility
      await supabase
        .from("stores")
        .update({
          metadata: {
            ...store.metadata,
            bank_info: bankInfo
          }
        })
        .eq("id", store.id);

      toast({
        title: "Éxito",
        description: "Información bancaria guardada correctamente",
      });

      queryClient.invalidateQueries({ queryKey: ["store", "owner", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["payment-methods", "store", store.id] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar la información bancaria",
        variant: "destructive",
      });
    } finally {
      setUpdatingBankInfo(false);
    }
  };

  const handleUpdateMoncash = async () => {
    if (!store?.id) return;
    
    setUpdatingMoncash(true);
    try {
      // Save to payment_methods table
      const existingMethod = await supabase
        .from('payment_methods')
        .select('id')
        .eq('owner_type', 'store')
        .eq('owner_id', store.id)
        .eq('method_type', 'moncash')
        .maybeSingle();

      const paymentData = {
        owner_type: 'store',
        owner_id: store.id,
        method_type: 'moncash',
        is_active: true,
        display_name: 'MonCash',
        phone_number: moncashInfo.phone_number,
        holder_name: moncashInfo.name,
      };

      if (existingMethod.data?.id) {
        const { error } = await supabase
          .from('payment_methods')
          .update(paymentData)
          .eq('id', existingMethod.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('payment_methods')
          .insert(paymentData);
        if (error) throw error;
      }

      // Also update store metadata for backwards compatibility
      await supabase
        .from("stores")
        .update({
          metadata: {
            ...store.metadata,
            moncash_info: moncashInfo
          }
        })
        .eq("id", store.id);

      toast({
        title: "Éxito",
        description: "Información Moncash guardada correctamente",
      });

      queryClient.invalidateQueries({ queryKey: ["store", "owner", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["payment-methods", "store", store.id] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar la información Moncash",
        variant: "destructive",
      });
    } finally {
      setUpdatingMoncash(false);
    }
  };

  const handleUpdateNatcash = async () => {
    if (!store?.id) return;
    
    setUpdatingNatcash(true);
    try {
      // Save to payment_methods table
      const existingMethod = await supabase
        .from('payment_methods')
        .select('id')
        .eq('owner_type', 'store')
        .eq('owner_id', store.id)
        .eq('method_type', 'natcash')
        .maybeSingle();

      const paymentData = {
        owner_type: 'store',
        owner_id: store.id,
        method_type: 'natcash',
        is_active: true,
        display_name: 'NatCash',
        phone_number: natcashInfo.phone_number,
        holder_name: natcashInfo.name,
      };

      if (existingMethod.data?.id) {
        const { error } = await supabase
          .from('payment_methods')
          .update(paymentData)
          .eq('id', existingMethod.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('payment_methods')
          .insert(paymentData);
        if (error) throw error;
      }

      // Also update store metadata for backwards compatibility
      await supabase
        .from("stores")
        .update({
          metadata: {
            ...store.metadata,
            natcash_info: natcashInfo
          }
        })
        .eq("id", store.id);

      toast({
        title: "Éxito",
        description: "Información Natcash guardada correctamente",
      });

      queryClient.invalidateQueries({ queryKey: ["store", "owner", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["payment-methods", "store", store.id] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar la información Natcash",
        variant: "destructive",
      });
    } finally {
      setUpdatingNatcash(false);
    }
  };

  const handleUpdateStoreDescription = async () => {
    if (!store?.id) return;
    
    try {
      const { error } = await supabase
        .from("stores")
        .update({ description: storeDescription })
        .eq("id", store.id);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Descripción de tienda actualizada correctamente",
      });

      setEditingDescription(false);
      queryClient.invalidateQueries({ queryKey: ["store", "owner", user?.id] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar la descripción",
        variant: "destructive",
      });
    }
  };

  const handleSavePersonalPhoto = async () => {
    if (!user?.id || !newAvatarFile) {
      setShowEditPersonalPhoto(false);
      return;
    }
    setUploadingAvatar(true);
    try {
      const ext = newAvatarFile.name.split('.').pop();
      const path = `user-avatars/${user.id}/avatar.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('product-images')
        .upload(path, newAvatarFile, { upsert: true, contentType: newAvatarFile.type });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path);
      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ avatar_url: `${urlData.publicUrl}?t=${Date.now()}` })
        .eq('id', user.id);
      if (dbErr) throw dbErr;
      setNewAvatarFile(null);
      setNewAvatarPreview(null);
      setShowEditPersonalPhoto(false);
      toast({ title: 'Foto actualizada', description: 'Tu foto de perfil personal fue guardada correctamente.' });
      queryClient.invalidateQueries({ queryKey: ['store', 'owner', user?.id] });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'No se pudo guardar la foto', variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSavePhotos = async () => {
    if (!store?.id) return;
    if (!newLogoFile && newBannerFiles.length === 0) {
      setShowEditProfilePhoto(false);
      return;
    }
    setUploadingPhotos(true);
    try {
      const updates: { logo?: string; banner?: string; banner_images?: string[] } = {};

      if (newLogoFile) {
        const ext = newLogoFile.name.split('.').pop();
        const path = `store-logos/${store.id}/logo.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('product-images')
          .upload(path, newLogoFile, { upsert: true, contentType: newLogoFile.type });
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path);
        updates.logo = `${urlData.publicUrl}?t=${Date.now()}`;
      }

      if (newBannerFiles.length > 0) {
        const uploadedUrls: string[] = [];
        // Keep existing banners that weren't replaced
        const existingBanners = store.banner_images || [];
        for (let i = 0; i < newBannerFiles.length; i++) {
          const file = newBannerFiles[i];
          const ext = file.name.split('.').pop();
          const path = `store-logos/${store.id}/banner_${Date.now()}_${i}.${ext}`;
          const { error: uploadErr } = await supabase.storage
            .from('product-images')
            .upload(path, file, { upsert: true, contentType: file.type });
          if (uploadErr) throw uploadErr;
          const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path);
          uploadedUrls.push(`${urlData.publicUrl}?t=${Date.now()}`);
        }
        // Merge: existing + new uploads
        const allBanners = [...existingBanners, ...uploadedUrls];
        updates.banner_images = allBanners;
        // Keep legacy banner = first image for backward compat
        updates.banner = allBanners[0];
      }

      const { error } = await supabase.from('stores').update(updates).eq('id', store.id);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['store', 'owner', user?.id] });
      setNewLogoFile(null);
      setNewBannerFiles([]);
      setNewLogoPreview(null);
      setNewBannerPreviews([]);
      setShowEditProfilePhoto(false);
      toast({ title: 'Fotos actualizadas', description: 'Las imágenes de tu tienda se guardaron correctamente.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'No se pudieron guardar las fotos', variant: 'destructive' });
    } finally {
      setUploadingPhotos(false);
    }
  };

  // Handler for saving store info (name and description)
  const handleSaveStoreInfo = async () => {
    if (!store?.id) return;
    
    setSavingStoreInfo(true);
    try {
      const { error } = await supabase
        .from("stores")
        .update({
          name: editStoreName,
          description: editStoreDescription,
        })
        .eq("id", store.id);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Información de tienda actualizada correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["store", "owner", user?.id] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la información",
        variant: "destructive",
      });
    } finally {
      setSavingStoreInfo(false);
    }
  };

  // Handler for saving contact info
  const handleSaveContactInfo = async () => {
    if (!user?.id) return;
    
    setSavingContact(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: contactInfo.full_name,
          phone: contactInfo.phone,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Update WhatsApp in store if store exists
      if (store?.id) {
        const { error: storeError } = await supabase
          .from('stores')
          .update({ whatsapp: contactInfo.whatsapp })
          .eq('id', store.id);
        
        if (storeError) throw storeError;
      }

      toast({
        title: "Éxito",
        description: "Información de contacto actualizada correctamente",
      });
      
      setShowEditInfo(false);
      queryClient.invalidateQueries({ queryKey: ["store", "owner", user?.id] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al guardar la información",
        variant: "destructive",
      });
    } finally {
      setSavingContact(false);
    }
  };

  // Handler for Edit Store Dialog
  const handleSaveEditStore = async () => {
    if (!store?.id) return;

    try {
      const nameInput = document.getElementById('edit-store-name') as HTMLInputElement;
      const descInput = document.getElementById('edit-store-description') as HTMLTextAreaElement;
      
      const { error } = await supabase
        .from("stores")
        .update({
          name: nameInput?.value || store.name,
          description: descInput?.value || store.description,
          country: editCountry || null,
          department_id: editDepartmentId || null,
          commune_id: editCommuneId || null,
        })
        .eq("id", store.id);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Tienda actualizada correctamente",
      });
      setShowEditStore(false);
      queryClient.invalidateQueries({ queryKey: ["store", "owner", user?.id] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar",
        variant: "destructive",
      });
    }
  };

  const handleCancelClick = (order: BuyerOrder) => {
    setSelectedOrder(order);
    setShowCancelDialog(true);
    setCancelReason("");
    setRequestRefund(false);
  };

  const handleConfirmCancel = async () => {
    if (!selectedOrder || !cancelReason.trim()) return;

    await cancelOrder.mutateAsync({
      orderId: selectedOrder.id,
      reason: cancelReason,
      requestRefund: requestRefund && selectedOrder.status === 'paid',
    });

    setShowCancelDialog(false);
    setSelectedOrder(null);
  };

  if (isLoading) {
    return (
      <SellerLayout>
        <div className="min-h-screen bg-gray-50/50 animate-pulse p-8">
          <div className="h-64 bg-gray-200 rounded-xl w-full mb-8" />
          <div className="space-y-4">
            <div className="h-12 bg-gray-200 rounded w-full" />
            <div className="h-96 bg-gray-200 rounded w-full" />
          </div>
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout>
      <div className="min-h-screen bg-gray-50/50 pb-12 w-full font-sans ${isMobile ? 'mt-0' : 'mt-3'}">
        {/* Main Content */}
        <div className="w-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            
            {/* Navigation Bar - FIXED */}
            <div className={`fixed z-50 bg-white border-b-2 border-gray-200 shadow-lg left-0 right-0 md:left-64 ${isMobile ? 'top-24 w-full' : 'top-[150px]'}`}>
              <div className="px-2 md:px-3">
                <TabsList className="grid w-full grid-cols-6 gap-0 bg-transparent rounded-none p-0 h-auto border-b-0 mb-0">
                  <TabsTrigger 
                    value="informacion" 
                    className="flex flex-col items-center justify-center gap-0.5 text-[10px] md:text-xs px-1 md:px-1.5 py-0.5 md:py-1 rounded-none border-b-2 border-transparent data-[state=active]:border-b-[#071d7f] data-[state=active]:bg-[#071d7f] data-[state=active]:text-white data-[state=active]:px-0.5 md:data-[state=active]:px-1"
                  >
                    <User className="h-3 w-3 md:h-4 md:w-4" />
                    <span className="hidden sm:inline">Información</span>
                    <span className="sm:hidden">Info</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="compras" 
                    className="flex flex-col items-center justify-center gap-0.5 text-[10px] md:text-xs px-1 md:px-1.5 py-0.5 md:py-1 rounded-none border-b-2 border-transparent data-[state=active]:border-b-[#071d7f] data-[state=active]:bg-[#071d7f] data-[state=active]:text-white data-[state=active]:px-0.5 md:data-[state=active]:px-1"
                  >
                    <Package className="h-3 w-3 md:h-4 md:w-4" />
                    <span className="hidden sm:inline">Mis Compras</span>
                    <span className="sm:hidden">Compras</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="tienda" 
                    className="flex flex-col items-center justify-center gap-0.5 text-[10px] md:text-xs px-1 md:px-1.5 py-0.5 md:py-1 rounded-none border-b-2 border-transparent data-[state=active]:border-b-[#071d7f] data-[state=active]:bg-[#071d7f] data-[state=active]:text-white data-[state=active]:px-0.5 md:data-[state=active]:px-1"
                  >
                    <Store className="h-3 w-3 md:h-4 md:w-4" />
                    <span className="hidden sm:inline">Mi Tienda</span>
                    <span className="sm:hidden">Tienda</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="pedidos" 
                    className="flex flex-col items-center justify-center gap-0.5 text-[10px] md:text-xs px-1 md:px-1.5 py-0.5 md:py-1 rounded-none border-b-2 border-transparent data-[state=active]:border-b-[#071d7f] data-[state=active]:bg-[#071d7f] data-[state=active]:text-white data-[state=active]:px-0.5 md:data-[state=active]:px-1"
                  >
                    <CreditCard className="h-3 w-3 md:h-4 md:w-4" />
                    <span className="hidden sm:inline">Pedidos</span>
                    <span className="sm:hidden">Pedidos</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="configuracion" 
                    className="flex flex-col items-center justify-center gap-0.5 text-[10px] md:text-xs px-1 md:px-1.5 py-0.5 md:py-1 rounded-none border-b-2 border-transparent data-[state=active]:border-b-[#071d7f] data-[state=active]:bg-[#071d7f] data-[state=active]:text-white data-[state=active]:px-0.5 md:data-[state=active]:px-1"
                  >
                    <Settings className="h-3 w-3 md:h-4 md:w-4" />
                    <span className="hidden sm:inline">Configuración</span>
                    <span className="sm:hidden">Config</span>
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            {/* Tab Contents */}
            <div className={`w-full px-4 md:px-6 ${isMobile ? 'pt-12' : ''}`}>
              <div className="container mx-auto">
              <TabsContent value="informacion" className={`${isMobile ? 'space-y-3 mt-0' : 'space-y-6 md:space-y-8 mt-6'}`}>
                <div className="w-full">
                  <Card className="shadow-lg border-none overflow-hidden">
                    {/* Header */}
                    <CardHeader className="bg-gray-100 text-gray-900 pb-8">
                      <div className="flex items-start justify-between">
                        <div 
                          className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setShowEditPersonalPhoto(true)}
                        >
                          <Avatar className="h-16 w-16 border-4 border-gray-300">
                            <AvatarImage src={user?.avatar_url || ""} />
                            <AvatarFallback className="bg-blue-100 text-[#071d7f] font-bold text-lg">
                              {user?.name?.charAt(0)?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h2 className="text-2xl font-bold">{user?.name || "Mi Cuenta"}</h2>
                            {isVerified && (
                              <Badge className="mt-2 bg-green-100 text-green-700 hover:bg-green-200">
                                Vendedor Verificado
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          className="bg-gray-50 text-[#071d7f] hover:bg-gray-200 border-gray-300 p-2"
                          size="sm"
                          onClick={() => setShowEditInfo(true)}
                        >
                          <Edit className="h-5 w-5" />
                        </Button>
                      </div>
                    </CardHeader>

                    <CardContent className="p-6 md:p-8">
                      {/* Contact Information */}
                      <div className="space-y-4 mb-8 pb-8 border-b">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                          <Mail className="h-4 w-4 text-[#071d7f]" />
                          Información de Contacto
                        </h3>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center py-2 border-b border-gray-100 gap-2">
                            <span className="text-gray-600 text-sm flex-shrink-0">Correo Electrónico</span>
                            <span className="font-semibold text-gray-900 truncate max-w-[180px] text-right" title={user?.email}>{user?.email}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-100 gap-2">
                            <span className="text-gray-600 text-sm flex items-center gap-1 flex-shrink-0">
                              <Phone className="h-4 w-4" />
                              Teléfono
                            </span>
                            <span className="font-semibold text-gray-900 truncate max-w-[180px] text-right">{contactInfo.phone || "No configurado"}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-100 gap-2">
                            <span className="text-gray-600 text-sm flex items-center gap-1 flex-shrink-0">
                              <MessageCircle className="h-4 w-4 text-green-600" />
                              WhatsApp
                            </span>
                            <span className="font-semibold text-gray-900 truncate max-w-[180px] text-right">{contactInfo.whatsapp || store?.whatsapp || "No configurado"}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-100 gap-2">
                            <span className="text-gray-600 text-sm flex-shrink-0">Nombre Completo</span>
                            <span className="font-semibold text-gray-900 truncate max-w-[180px] text-right">{user?.name || "N/A"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Account Information */}
                      <div className="space-y-4 mb-8 pb-8 border-b">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                          <Shield className="h-4 w-4 text-[#071d7f]" />
                          Información de la Cuenta
                        </h3>
                        <div className="space-y-3">
                          <div className="flex justify-between items-start py-2 border-b border-gray-100 last:border-b-0">
                            <span className="text-gray-600 text-sm flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              Miembro Desde
                            </span>
                            <span className="font-semibold text-gray-900">
                              {new Date(user?.created_at || '').toLocaleDateString('es-ES', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}
                            </span>
                          </div>
                          <div className="flex justify-between items-start py-2 border-b border-gray-100 last:border-b-0">
                            <span className="text-gray-600 text-sm flex items-center gap-1">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              Estado de Cuenta
                            </span>
                            <span className="font-semibold text-green-600">Activa ✓</span>
                          </div>
                          <div className="flex justify-between items-start py-2 border-b border-gray-100 last:border-b-0">
                            <span className="text-gray-600 text-sm">ID de Usuario</span>
                            <code className="bg-purple-50 px-3 py-1 rounded border border-purple-200 text-purple-700 font-semibold text-sm">
                              {user?.user_code || user?.id.slice(0, 8) + '...'}
                            </code>
                          </div>
                          <div className="flex justify-between items-start py-2 border-b border-gray-100 last:border-b-0">
                            <span className="text-gray-600 text-sm flex items-center gap-1">
                              <Store className="h-4 w-4" />
                              Tipo de Usuario
                            </span>
                            <span className="font-semibold text-[#071d7f]">Vendedor</span>
                          </div>
                        </div>
                      </div>

                      {/* Market & Shipping Configuration */}
                      <div id="section-mercado" className="space-y-4 mb-8 pb-8 border-b">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                            <Globe className="h-4 w-4 text-[#071d7f]" />
                            Mercado de Destino
                          </h3>
                          <p className="text-xs text-gray-400 mt-1 ml-6">
                            Define <strong>a qué país envías tus productos</strong> (donde tus clientes reciben los pedidos),
                            independientemente de donde estés ubicado o de dónde provengan los productos.
                          </p>
                        </div>

                        {!currentMarketId && (
                          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                            <p className="text-sm text-amber-800">
                              Configura el mercado de destino para que los costos de logística se calculen correctamente en tu catálogo.
                              El mercado determina <strong>dónde se entregan los pedidos de tus clientes</strong>.
                            </p>
                          </div>
                        )}

                        {currentMarketId && (() => {
                            const mkt = readyMarkets.find(m => m.id === currentMarketId);
                            const savedCountryName = mkt?.countries?.find(c => c.id === (store?.destination_country_id))?.name
                              ?? mkt?.destination_country_name;
                            return (
                              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
                                <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                                <span>
                                  Mercado activo: <strong>{mkt?.name ?? currentMarketId}</strong>
                                  {savedCountryName && (
                                    <span className="text-green-600 ml-1">→ {savedCountryName}</span>
                                  )}
                                </span>
                              </div>
                            );
                          })()}

                        <div className="space-y-3">
                          {/* Step 1: Market */}
                          <div className="space-y-1">
                            <Label className="text-sm font-medium text-gray-700">1. Mercado al que envías</Label>
                            <p className="text-xs text-gray-400">Zona geográfica que el administrador habilitó para recibir pedidos</p>
                            {loadingMarkets ? (
                              <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Cargando mercados...
                              </div>
                            ) : readyMarkets.length === 0 ? (
                              <div className="flex items-center gap-2 text-sm text-gray-500 py-2 px-3 border border-dashed border-gray-300 rounded-md bg-gray-50">
                                <AlertCircle className="h-4 w-4 text-gray-400 shrink-0" />
                                El administrador debe configurar al menos un mercado con ruta y tipo de envío activos.
                              </div>
                            ) : (
                              <Select
                                value={selectedMarketId}
                                onValueChange={(v) => {
                                  setSelectedMarketId(v);
                                  const mkt = readyMarkets.find(m => m.id === v);
                                  // Auto-select country only if the market has exactly 1
                                  if (mkt?.countries?.length === 1) {
                                    setSelectedCountryId(mkt.countries[0].id);
                                  } else {
                                    setSelectedCountryId('');
                                  }
                                }}
                              >
                                <SelectTrigger className="border-gray-300">
                                  <SelectValue placeholder="— Elige un mercado —" />
                                </SelectTrigger>
                                <SelectContent>
                                  {readyMarkets.map(market => (
                                    <SelectItem key={market.id} value={market.id}>
                                      <span className="flex items-center gap-2">
                                        <MapPin className="h-3.5 w-3.5 text-[#071d7f]" />
                                        {market.name}
                                        <span className="text-xs text-gray-400 font-mono">[{market.code}]</span>
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>

                          {selectedMarketId && (
                            <div className="space-y-1">
                              <Label className="text-sm font-medium text-gray-700">2. País de entrega a tus clientes</Label>
                              <p className="text-xs text-gray-400">País donde tus clientes reciben los pedidos (diferente a tu país o el origen del producto)</p>
                              <Select
                                value={selectedCountryId}
                                onValueChange={setSelectedCountryId}
                              >
                                <SelectTrigger className="border-gray-300">
                                  <SelectValue placeholder="— Elige el país —" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(() => {
                                    const mkt = readyMarkets.find(m => m.id === selectedMarketId);
                                    const ctries = mkt?.countries ?? [];
                                    if (ctries.length === 0) return (
                                      <SelectItem value="__none__" disabled>Sin países configurados</SelectItem>
                                    );
                                    return ctries.map(c => (
                                      <SelectItem key={c.id} value={c.id}>
                                        <span className="flex items-center gap-2">
                                          <Globe className="h-3.5 w-3.5 text-[#071d7f]" />
                                          {c.name}
                                          <span className="text-xs text-gray-400 font-mono">[{c.code}]</span>
                                          {c.is_primary && <span className="text-xs text-blue-500">(principal)</span>}
                                        </span>
                                      </SelectItem>
                                    ));
                                  })()}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-gray-400">Los costos de envío se calcularán para entregas en este país</p>
                            </div>
                          )}

                          {/* Save */}
                          <div className="pt-1">
                            <Button
                              onClick={handleSaveMarket}
                              disabled={
                                savingMarket ||
                                !selectedMarketId ||
                                !selectedCountryId ||
                                // Disable if nothing changed
                                (selectedMarketId === currentMarketId && selectedCountryId === (store?.destination_country_id ?? ''))
                              }
                              className="bg-[#071d7f] hover:bg-[#0a27a8]"
                            >
                              {savingMarket ? (
                                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</>
                              ) : (
                                <><Save className="h-4 w-4 mr-2" />Guardar</>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex gap-3 justify-start">
                        <button 
                          onClick={() => setShowChangePassword(true)}
                          className="p-3 bg-white rounded-lg shadow-md hover:shadow-lg border border-blue-100 hover:border-blue-300 transition-all duration-300 text-[#071d7f] hover:bg-blue-50"
                          title="Cambiar Contraseña"
                        >
                          <Shield className="h-5 w-5" />
                        </button>

                        <button 
                          onClick={() => setShowNotifications(true)}
                          className="p-3 bg-white rounded-lg shadow-md hover:shadow-lg border border-blue-100 hover:border-blue-300 transition-all duration-300 text-[#071d7f] hover:bg-blue-50"
                          title="Notificaciones"
                        >
                          <Bell className="h-5 w-5" />
                        </button>

                        <button 
                          onClick={signOut}
                          className="p-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-lg shadow-md hover:shadow-lg border border-red-600 transition-all duration-300 text-white"
                          title="Cerrar Sesión"
                        >
                          <LogOut className="h-5 w-5" />
                        </button>
                      </div>

                      {/* Legal & About Modals */}
                      <div className="pt-2 border-t border-gray-100">
                        <p className="text-[10px] text-gray-400 mb-2 uppercase tracking-wide">Información Legal</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowLegal(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs text-gray-600 transition-colors"
                          >
                            <Shield className="h-3.5 w-3.5 text-[#071d7f]" /> Términos Legales
                          </button>
                          <button
                            onClick={() => setShowAbout(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs text-gray-600 transition-colors"
                          >
                            <Info className="h-3.5 w-3.5 text-[#071d7f]" /> Acerca de
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Mis Compras Tab */}
              <TabsContent value="compras" className="space-y-4 pt-4">
                {/* Quick Stats */}
                <div className="grid grid-cols-4 gap-2">
                  <Card className="bg-amber-50 border-amber-200">
                    <CardContent className="p-2 text-center">
                      <p className="text-lg font-bold text-amber-600">
                        {orders?.filter(o => o.status === 'paid').length || 0}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Pagados</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-purple-50 border-purple-200">
                    <CardContent className="p-2 text-center">
                      <p className="text-lg font-bold text-purple-600">
                        {orders?.filter(o => o.status === 'shipped').length || 0}
                      </p>
                      <p className="text-[10px] text-muted-foreground">En Camino</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-2 text-center">
                      <p className="text-lg font-bold text-green-600">
                        {orders?.filter(o => o.status === 'delivered').length || 0}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Entregados</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-2 text-center">
                      <p className="text-lg font-bold text-green-600">
                        ${(orders?.filter(o => ['paid', 'shipped', 'delivered'].includes(o.status))
                          .reduce((sum, o) => sum + o.total_amount, 0) || 0).toFixed(0)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Total</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Filter Tabs */}
                <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v as BuyerOrderStatus | 'all'); setOrdersPage(1); }}>
                  <TabsList className="flex w-full overflow-x-auto gap-1 justify-start" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <TabsTrigger value="all" className="text-xs shrink-0">Todos</TabsTrigger>
                    <TabsTrigger value="placed" className="text-xs shrink-0">Pendientes</TabsTrigger>
                    <TabsTrigger value="paid" className="text-xs shrink-0">Pagados</TabsTrigger>
                    <TabsTrigger value="shipped" className="text-xs shrink-0">En Camino</TabsTrigger>
                    <TabsTrigger value="delivered" className="text-xs shrink-0">Entregados</TabsTrigger>
                    <TabsTrigger value="cancelled" className="text-xs shrink-0">Cancelados</TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Orders List */}
                {(() => {
                  const ordersPerPage = isMobile ? 6 : 8;
                  const paginatedOrders = orders ? orders.slice((ordersPage - 1) * ordersPerPage, ordersPage * ordersPerPage) : [];
                  const totalPages = orders ? Math.ceil(orders.length / ordersPerPage) : 0;

                  return (
                    <>
                      <div className="space-y-2">
                        {ordersLoading ? (
                          <Card className="p-6">
                            <div className="flex items-center justify-center">
                              <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            </div>
                          </Card>
                        ) : orders && orders.length === 0 ? (
                          <Card className="p-6 text-center">
                            <ShoppingCart className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                            <h3 className="font-semibold mb-1">No tienes compras aún</h3>
                            <p className="text-sm text-muted-foreground mb-3">Explora el catálogo B2B</p>
                            <Button asChild size="sm">
                              <Link to="/seller/adquisicion-lotes">Ir al Catálogo</Link>
                            </Button>
                          </Card>
                        ) : paginatedOrders.length > 0 ? (
                          paginatedOrders.map((order) => {
                            const status = statusConfig[order.status] ?? defaultStatusConfig;
                            const Icon = status.icon;
                            
                            return (
                              <Card 
                                key={order.id} 
                                className={`cursor-pointer hover:shadow-md transition-all border-l-4 ${
                                  order.status === 'shipped' ? 'border-l-purple-500' : 
                                  order.status === 'delivered' ? 'border-l-green-500' : 
                                  order.status === 'paid' ? 'border-l-amber-500' : 
                                  order.status === 'placed' ? 'border-l-blue-500' : 
                                  order.status === 'cancelled' ? 'border-l-red-500' : 'border-l-gray-300'
                                }`}
                                onClick={() => setSelectedOrder(order)}
                              >
                                <CardContent className="p-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden shrink-0">
                                        {order.order_items_b2b?.[0]?.image ? (
                                          <img 
                                            src={order.order_items_b2b[0].image} 
                                            alt={order.order_items_b2b[0].nombre}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <div className={`w-full h-full flex items-center justify-center ${status.bgColor}`}>
                                            <Icon className={`h-4 w-4 ${status.color}`} />
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-semibold text-sm shrink-0">#{order.id.slice(0, 6).toUpperCase()}</span>
                                          <span className="shrink-0">{getStatusBadge(order.status)}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                          {order.order_items_b2b?.length || 0} prod. • {order.total_quantity} uds
                                        </p>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 shrink-0">
                                      <p className="font-bold text-sm">${order.total_amount.toLocaleString()}</p>
                                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })
                        ) : null}
                      </div>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={ordersPage === 1}
                            onClick={() => setOrdersPage(p => p - 1)}
                          >
                            Anterior
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            {ordersPage} / {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={ordersPage === totalPages}
                            onClick={() => setOrdersPage(p => p + 1)}
                          >
                            Siguiente
                          </Button>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Link to full page */}
                <Button asChild variant="outline" className="w-full">
                  <Link to="/seller/mis-compras">
                    Mis Compras
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </TabsContent>

              {/* Mi Tienda Tab */}
              <TabsContent value="tienda" className={`space-y-6 mt-0 ${!isMobile ? 'pt-8' : ''}`}>

                {/* Location incomplete warning */}
                {store && !store.commune_id && (
                  <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-500" />
                    <div className="flex-1">
                      <p className="font-semibold">Completa tu ubicación</p>
                      <p className="text-amber-700 text-xs mt-0.5">
                        Tus clientes no pueden ver tu país, departamento y comuna.
                        Configúralos en <strong>Editar Tienda</strong> para que aparezcan en tu página pública.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-300 text-amber-800 hover:bg-amber-100 text-xs h-7 px-3 flex-shrink-0"
                      onClick={() => setShowEditStore(true)}
                    >
                      Configurar
                    </Button>
                  </div>
                )}

                {/* Store Header */}
                <Card className="shadow-lg border-none overflow-hidden">
                  <CardHeader
                    className="text-gray-900 pb-8 relative overflow-hidden"
                    style={store?.banner
                      ? { backgroundImage: `url(${store.banner})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                      : { backgroundColor: '#f3f4f6' }
                    }
                  >
                    {/* Dark overlay when banner is set so text stays readable */}
                    {store?.banner && <div className="absolute inset-0 bg-black/40 pointer-events-none" />}

                    {/* Edit photos button */}
                    <button 
                      type="button"
                      className="absolute top-4 left-4 p-2 bg-[#071d7f] hover:bg-[#071d7f]/90 rounded-lg transition-colors z-10"
                      onClick={() => setShowEditProfilePhoto(true)}
                      title="Editar logo y banner de la tienda"
                    >
                      <Edit className="h-5 w-5 text-white" />
                    </button>

                    <div className="relative z-10 flex items-start justify-between">
                      <div 
                        className="flex items-center gap-4 flex-1 cursor-pointer"
                        onClick={() => setShowEditProfilePhoto(true)}
                      >
                        <div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center overflow-hidden border-4 border-white hover:shadow-lg transition-shadow flex-shrink-0">
                          {store?.logo ? (
                            <img src={store.logo} alt={store?.name} className="w-full h-full object-cover" />
                          ) : (
                            <Store className="h-10 w-10 text-[#071d7f]" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className={`text-2xl font-bold ${store?.banner ? 'text-white drop-shadow' : 'text-gray-900'}`}>{store?.name || "Mi Tienda"}</h2>
                            <button 
                              type="button"
                              className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                              onClick={(e) => { e.stopPropagation(); setShowEditStore(true); }}
                              title="Editar información de la tienda"
                            >
                              <Edit className={`h-4 w-4 ${store?.banner ? 'text-white' : 'text-[#071d7f]'}`} />
                            </button>
                          </div>
                          {/* Truncated Description */}
                          <button
                            onClick={() => setShowEditProfilePhoto(true)}
                            className="mt-3 bg-white/90 rounded-lg px-4 py-2 text-left hover:bg-white transition-colors"
                            title={store?.description || "Descripción de tu tienda"}
                          >
                            <p className="text-black text-sm font-medium max-w-[140px] truncate">
                              {store?.description || "Descripción de tu tienda"}
                            </p>
                          </button>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="px-4 pb-4 pt-2">
                    <div className="grid grid-cols-4 gap-2">
                      <div className="flex flex-col items-center justify-center py-3 px-1 md:py-5 bg-blue-50 rounded-xl">
                        <Package className="h-4 w-4 md:h-7 md:w-7 text-blue-600 mb-1" />
                        <p className="text-[10px] md:text-sm text-muted-foreground text-center font-medium leading-tight">Productos</p>
                        <p className="text-base md:text-3xl font-bold text-blue-600">{productsCount}</p>
                      </div>
                      <div className="flex flex-col items-center justify-center py-3 px-1 md:py-5 bg-green-50 rounded-xl">
                        <ShoppingCart className="h-4 w-4 md:h-7 md:w-7 text-green-600 mb-1" />
                        <p className="text-[10px] md:text-sm text-muted-foreground text-center font-medium leading-tight">Ventas</p>
                        <p className="text-base md:text-3xl font-bold text-green-600">{salesCount}</p>
                      </div>
                      <div className="flex flex-col items-center justify-center py-3 px-1 md:py-5 bg-amber-50 rounded-xl">
                        <Star className="h-4 w-4 md:h-7 md:w-7 text-amber-600 mb-1" />
                        <p className="text-[10px] md:text-sm text-muted-foreground text-center font-medium leading-tight">Calificación</p>
                        <p className="text-base md:text-3xl font-bold text-amber-600">—</p>
                      </div>
                      <div className="flex flex-col items-center justify-center py-3 px-1 md:py-5 bg-purple-50 rounded-xl">
                        <Users className="h-4 w-4 md:h-7 md:w-7 text-purple-600 mb-1" />
                        <p className="text-[10px] md:text-sm text-muted-foreground text-center font-medium leading-tight">Seguidores</p>
                        <p className="text-base md:text-3xl font-bold text-purple-600">—</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Store Management Sections - Accordion */}
                <Card className="shadow-lg border-none">
                  <Accordion type="single" collapsible className="w-full">
                    {/* Store Information */}
                    <AccordionItem value="store-info">
                      <AccordionTrigger className="hover:no-underline px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Mail className="h-5 w-5 text-[#071d7f]" />
                          <h3 className="text-lg font-bold text-[#071d7f]">Información de la Tienda</h3>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-6">
                        <div className="space-y-4 bg-blue-50 p-4 rounded-lg">
                          {/* Store ID (Read-only) */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">ID de la Tienda</Label>
                            <div className="flex items-center gap-2">
                              <Input 
                                value={store?.slug || ""}
                                readOnly
                                disabled
                                className="bg-gray-100 border-gray-300 cursor-not-allowed" 
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (store?.slug) {
                                    navigator.clipboard.writeText(store.slug);
                                    toast({
                                      title: "Copiado",
                                      description: "ID de la tienda copiado al portapapeles"
                                    });
                                  }
                                }}
                              >
                                Copiar
                              </Button>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="store-name" className="text-sm font-medium">Nombre de la Tienda</Label>
                            <Input 
                              id="store-name" 
                              value={editStoreName}
                              onChange={(e) => setEditStoreName(e.target.value)}
                              placeholder="Nombre de tu tienda" 
                              className="border-gray-300" 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="store-description" className="text-sm font-medium">Descripción</Label>
                            <Textarea 
                              id="store-description" 
                              value={editStoreDescription}
                              onChange={(e) => setEditStoreDescription(e.target.value)}
                              placeholder="Describe tu tienda" 
                              rows={3} 
                              className="border-gray-300" 
                            />
                          </div>
                          <Button 
                            onClick={handleSaveStoreInfo}
                            disabled={savingStoreInfo}
                            className="w-full bg-[#071d7f] hover:bg-[#071d7f]/90"
                          >
                            {savingStoreInfo ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Guardando...
                              </>
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-2" />
                                Guardar Cambios
                              </>
                            )}
                          </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Store Settings */}
                    <AccordionItem value="store-settings">
                      <AccordionTrigger className="hover:no-underline px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Settings className="h-5 w-5 text-green-700" />
                          <h3 className="text-lg font-bold text-green-700">Configuración de Tienda</h3>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-6">
                        <div className="space-y-4 bg-green-50 p-4 rounded-lg">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                              <Label className="cursor-pointer flex items-center gap-2 flex-1">
                                <Checkbox 
                                  checked={storeSettings.is_open}
                                  onCheckedChange={(checked) => setStoreSettings({...storeSettings, is_open: checked === true})}
                                />
                                <span className="text-sm font-medium">Tienda Abierta</span>
                              </Label>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                              <Label className="cursor-pointer flex items-center gap-2 flex-1">
                                <Checkbox 
                                  checked={storeSettings.allow_comments}
                                  onCheckedChange={(checked) => setStoreSettings({...storeSettings, allow_comments: checked === true})}
                                />
                                <span className="text-sm font-medium">Permitir comentarios</span>
                              </Label>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                              <Label className="cursor-pointer flex items-center gap-2 flex-1">
                                <Checkbox 
                                  checked={storeSettings.show_stock}
                                  onCheckedChange={(checked) => setStoreSettings({...storeSettings, show_stock: checked === true})}
                                />
                                <span className="text-sm font-medium">Mostrar stock</span>
                              </Label>
                            </div>
                          </div>
                          <Button 
                            onClick={handleUpdateStoreSettings}
                            disabled={updatingStoreSettings}
                            className="w-full bg-green-600 hover:bg-green-700"
                          >
                            {updatingStoreSettings ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Actualizando...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Actualizar Configuración
                              </>
                            )}
                          </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Policies */}
                    <AccordionItem value="policies">
                      <AccordionTrigger className="hover:no-underline px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Shield className="h-5 w-5 text-amber-700" />
                          <h3 className="text-lg font-bold text-amber-700">Políticas de la Tienda</h3>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-6">
                        <div className="space-y-4 bg-amber-50 p-4 rounded-lg">
                          <div className="space-y-2">
                            <Label htmlFor="return-policy" className="text-sm font-medium">Política de Devoluciones</Label>
                            <Textarea id="return-policy" placeholder="Describe tu política de devoluciones" rows={2} className="border-gray-300" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="shipping-policy" className="text-sm font-medium">Política de Envío</Label>
                            <Textarea id="shipping-policy" placeholder="Describe tu política de envío" rows={2} className="border-gray-300" />
                          </div>
                          <Button className="w-full bg-amber-600 hover:bg-amber-700">
                            <Save className="h-4 w-4 mr-2" />
                            Guardar Políticas
                          </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Bank Information */}
                    <AccordionItem value="bank-info">
                      <AccordionTrigger className="hover:no-underline px-6 py-4">
                        <div className="flex items-center gap-3">
                          <DollarSign className="h-5 w-5 text-purple-700" />
                          <h3 className="text-lg font-bold text-purple-700">Información Bancaria</h3>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-6">
                        <div className="space-y-4 bg-purple-50 p-4 rounded-lg">
                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="bank-name" className="text-sm font-medium">Banco</Label>
                              <Input 
                                id="bank-name" 
                                placeholder="Nombre del banco" 
                                className="border-gray-300"
                                value={bankInfo.bank_name}
                                onChange={(e) => setBankInfo({...bankInfo, bank_name: e.target.value})}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="account-type" className="text-sm font-medium">Tipo de Cuenta</Label>
                              <select 
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                value={bankInfo.account_type}
                                onChange={(e) => setBankInfo({...bankInfo, account_type: e.target.value})}
                              >
                                <option>Seleccionar tipo</option>
                                <option>Ahorros</option>
                                <option>Corriente</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="account-number" className="text-sm font-medium">Número de Cuenta</Label>
                              <Input 
                                id="account-number" 
                                placeholder="Número de cuenta" 
                                className="border-gray-300" 
                                type="text"
                                value={bankInfo.account_number}
                                onChange={(e) => setBankInfo({...bankInfo, account_number: e.target.value})}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="account-holder" className="text-sm font-medium">Titular de la Cuenta</Label>
                              <Input 
                                id="account-holder" 
                                placeholder="Nombre del titular" 
                                className="border-gray-300"
                                value={bankInfo.account_holder}
                                onChange={(e) => setBankInfo({...bankInfo, account_holder: e.target.value})}
                              />
                            </div>
                          </div>
                          <Button 
                            onClick={handleUpdateBankInfo}
                            disabled={updatingBankInfo}
                            className="w-full bg-purple-600 hover:bg-purple-700"
                          >
                            {updatingBankInfo ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Guardando...
                              </>
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-2" />
                                Guardar Información Bancaria
                              </>
                            )}
                          </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Moncash Configuration */}
                    <AccordionItem value="moncash">
                      <AccordionTrigger className="hover:no-underline px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Smartphone className="h-5 w-5" style={{ color: '#94111f' }} />
                          <h3 className="text-lg font-bold" style={{ color: '#94111f' }}>Configuración Moncash</h3>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-6">
                        <div className="space-y-4 p-4 rounded-lg" style={{ backgroundColor: '#94111f20' }}>
                          <div className="bg-white border rounded-lg p-3 mb-2" style={{ borderColor: '#94111f' }}>
                            <p className="text-sm" style={{ color: '#94111f' }}>
                              <span className="font-semibold">Moncash</span> es una billetera digital haitiana. Configura tu cuenta para recibir pagos y retiros.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="moncash-number" className="text-sm font-medium">Número de Teléfono Moncash</Label>
                            <Input 
                              id="moncash-number" 
                              placeholder="+509 XXXX XXXX" 
                              className="border-gray-300"
                              value={moncashInfo.phone_number}
                              onChange={(e) => setMoncashInfo({...moncashInfo, phone_number: e.target.value})}
                            />
                            <p className="text-xs text-gray-500">Formato: +509 seguido del número de teléfono</p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="moncash-name" className="text-sm font-medium">Nombre en Moncash</Label>
                            <Input 
                              id="moncash-name" 
                              placeholder="Nombre asociado a tu cuenta" 
                              className="border-gray-300"
                              value={moncashInfo.name}
                              onChange={(e) => setMoncashInfo({...moncashInfo, name: e.target.value})}
                            />
                          </div>
                          <Button 
                            onClick={handleUpdateMoncash}
                            disabled={updatingMoncash}
                            className="w-full"
                            style={{ backgroundColor: '#94111f' }}
                          >
                            {updatingMoncash ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Guardando...
                              </>
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-2" />
                                Guardar Información Moncash
                              </>
                            )}
                          </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Natcash Configuration */}
                    <AccordionItem value="natcash">
                      <AccordionTrigger className="hover:no-underline px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Smartphone className="h-5 w-5" style={{ color: '#071d7f' }} />
                          <h3 className="text-lg font-bold" style={{ color: '#071d7f' }}>Configuración Natcash</h3>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-6">
                        <div className="space-y-4 p-4 rounded-lg" style={{ backgroundColor: '#071d7f20' }}>
                          <div className="bg-white border rounded-lg p-3 mb-2" style={{ borderColor: '#071d7f' }}>
                            <p className="text-sm" style={{ color: '#071d7f' }}>
                              <span className="font-semibold">Natcash</span> es una billetera digital haitiana. Configura tu cuenta para recibir pagos y retiros.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="natcash-number" className="text-sm font-medium">Número de Teléfono Natcash</Label>
                            <Input 
                              id="natcash-number" 
                              placeholder="+509 XXXX XXXX" 
                              className="border-gray-300"
                              value={natcashInfo.phone_number}
                              onChange={(e) => setNatcashInfo({...natcashInfo, phone_number: e.target.value})}
                            />
                            <p className="text-xs text-gray-500">Formato: +509 seguido del número de teléfono</p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="natcash-name" className="text-sm font-medium">Nombre en Natcash</Label>
                            <Input 
                              id="natcash-name" 
                              placeholder="Nombre asociado a tu cuenta" 
                              className="border-gray-300"
                              value={natcashInfo.name}
                              onChange={(e) => setNatcashInfo({...natcashInfo, name: e.target.value})}
                            />
                          </div>
                          <Button 
                            onClick={handleUpdateNatcash}
                            disabled={updatingNatcash}
                            className="w-full"
                            style={{ backgroundColor: '#071d7f' }}
                          >
                            {updatingNatcash ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Guardando...
                              </>
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-2" />
                                Guardar Información Natcash
                              </>
                            )}
                          </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </Card>

                {/* Store Stats - Sticky Tabs */}
                <Card className="shadow-lg border-none">
                  <CardHeader className="bg-gray-100 text-gray-900 sticky top-40 z-30 py-3 px-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base font-bold flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Estadísticas
                      </h3>
                      <div className="relative">
                        <button
                          onClick={() => setShowStatsFilter(!showStatsFilter)}
                          className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                          title="Filtro de tiempo"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                          </svg>
                        </button>
                        {showStatsFilter && (
                          <div className="absolute right-0 mt-2 w-48 bg-white text-gray-900 rounded-lg shadow-lg z-50">
                            <button
                              onClick={() => { setStatsTimeFilter('semana'); setShowStatsFilter(false); }}
                              className={`block w-full text-left px-4 py-2 hover:bg-gray-100 first:rounded-t-lg ${
                                statsTimeFilter === 'semana' ? 'bg-blue-100 text-[#071d7f] font-medium' : ''
                              }`}
                            >
                              Esta Semana
                            </button>
                            <button
                              onClick={() => { setStatsTimeFilter('mes'); setShowStatsFilter(false); }}
                              className={`block w-full text-left px-4 py-2 hover:bg-gray-100 ${
                                statsTimeFilter === 'mes' ? 'bg-blue-100 text-[#071d7f] font-medium' : ''
                              }`}
                            >
                              Este Mes
                            </button>
                            <button
                              onClick={() => { setStatsTimeFilter('trimestre'); setShowStatsFilter(false); }}
                              className={`block w-full text-left px-4 py-2 hover:bg-gray-100 ${
                                statsTimeFilter === 'trimestre' ? 'bg-blue-100 text-[#071d7f] font-medium' : ''
                              }`}
                            >
                              Este Trimestre
                            </button>
                            <button
                              onClick={() => { setStatsTimeFilter('año'); setShowStatsFilter(false); }}
                              className={`block w-full text-left px-4 py-2 hover:bg-gray-100 last:rounded-b-lg ${
                                statsTimeFilter === 'año' ? 'bg-blue-100 text-[#071d7f] font-medium' : ''
                              }`}
                            >
                              Este Año
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Sticky Tabs - Scrollable */}
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      <button
                        onClick={() => setActiveStatTab('vistas')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                          activeStatTab === 'vistas'
                            ? 'bg-white text-[#071d7f]'
                            : 'bg-white/20 text-white hover:bg-white/30'
                        }`}
                      >
                        Vistas
                      </button>
                      <button
                        onClick={() => setActiveStatTab('conversion')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                          activeStatTab === 'conversion'
                            ? 'bg-white text-[#071d7f]'
                            : 'bg-white/20 text-white hover:bg-white/30'
                        }`}
                      >
                        Conversión
                      </button>
                      <button
                        onClick={() => setActiveStatTab('ingresos')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          activeStatTab === 'ingresos'
                            ? 'bg-white text-[#071d7f]'
                            : 'bg-white/20 text-white hover:bg-white/30'
                        }`}
                      >
                        Ingresos
                      </button>
                      <button
                        onClick={() => setActiveStatTab('productos')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          activeStatTab === 'productos'
                            ? 'bg-white text-[#071d7f]'
                            : 'bg-white/20 text-white hover:bg-white/30'
                        }`}
                      >
                        Productos
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    {/* Vistas Tab Content */}
                    {activeStatTab === 'vistas' && (
                      <div className="text-center py-8">
                        <Eye className="h-16 w-16 text-[#071d7f] mx-auto mb-4 opacity-50" />
                        <p className="text-sm text-muted-foreground mb-2">Vistas en {
                          statsTimeFilter === 'semana' ? 'esta semana' :
                          statsTimeFilter === 'mes' ? 'este mes' :
                          statsTimeFilter === 'trimestre' ? 'este trimestre' :
                          'este año'
                        }</p>
                        <p className="text-5xl font-bold text-[#071d7f]">0</p>
                        <p className="text-sm text-muted-foreground mt-4">Sin datos disponibles</p>
                      </div>
                    )}
                    
                    {/* Conversión Tab Content */}
                    {activeStatTab === 'conversion' && (
                      <div className="text-center py-8">
                        <TrendingUp className="h-16 w-16 text-green-600 mx-auto mb-4 opacity-50" />
                        <p className="text-sm text-muted-foreground mb-2">Tasa de conversión en {
                          statsTimeFilter === 'semana' ? 'esta semana' :
                          statsTimeFilter === 'mes' ? 'este mes' :
                          statsTimeFilter === 'trimestre' ? 'este trimestre' :
                          'este año'
                        }</p>
                        <p className="text-5xl font-bold text-green-600">0<span className="text-2xl">%</span></p>
                        <p className="text-sm text-muted-foreground mt-4">Sin datos disponibles</p>
                      </div>
                    )}
                    
                    {/* Ingresos Tab Content */}
                    {activeStatTab === 'ingresos' && (
                      <div className="text-center py-8">
                        <DollarSign className="h-16 w-16 text-blue-600 mx-auto mb-4 opacity-50" />
                        <p className="text-sm text-muted-foreground mb-2">Ingresos en {
                          statsTimeFilter === 'semana' ? 'esta semana' :
                          statsTimeFilter === 'mes' ? 'este mes' :
                          statsTimeFilter === 'trimestre' ? 'este trimestre' :
                          'este año'
                        }</p>
                        <p className="text-5xl font-bold text-blue-600">$0</p>
                        <p className="text-sm text-muted-foreground mt-4">Sin datos disponibles</p>
                      </div>
                    )}
                    
                    {/* Productos Tab Content */}
                    {activeStatTab === 'productos' && (
                      <div className="text-center py-8">
                        <Package className="h-16 w-16 text-amber-600 mx-auto mb-4 opacity-50" />
                        <p className="text-sm text-muted-foreground mb-2">Productos destacados en {
                          statsTimeFilter === 'semana' ? 'esta semana' :
                          statsTimeFilter === 'mes' ? 'este mes' :
                          statsTimeFilter === 'trimestre' ? 'este trimestre' :
                          'este año'
                        }</p>
                        <p className="text-5xl font-bold text-amber-600">0</p>
                        <p className="text-sm text-muted-foreground mt-4">Sin datos disponibles</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Pedidos Tab */}
              <TabsContent value="pedidos" className="space-y-6 mt-0">
                <Card className="shadow-lg border-none">
                  <CardHeader className="bg-gray-100 text-gray-900">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Pedidos Recibidos
                    </h3>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="text-center py-12 text-gray-500">
                      <p className="text-lg">No hay pedidos para mostrar</p>
                      <p className="text-sm mt-2">Los pedidos aparecerán aquí cuando recibas ventas</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Configuración Tab */}
              <TabsContent value="configuracion" className="space-y-6 mt-0">
                {/* KYC Upload Form */}
                <KYCUploadForm />

                {/* Control Panel Card */}
                <Card className="shadow-lg border-none">
                  <CardHeader className="bg-gray-100 text-gray-900">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Configuración de Cuenta
                    </h3>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
                      {/* Payment Methods Card */}
                      <button 
                        onClick={() => setShowPaymentMethods(true)}
                        className="flex flex-col items-start p-4 bg-white rounded-xl shadow-md hover:shadow-xl border border-transparent hover:border-blue-100 transition-all duration-300 group text-left">
                        <div className="p-2 rounded-xl bg-blue-50 text-[#071d7f] group-hover:bg-[#071d7f] group-hover:text-white transition-colors mb-3 shadow-sm">
                          <CreditCard className="h-5 w-5" />
                        </div>
                        <h4 className="font-bold text-base text-gray-900 group-hover:text-[#071d7f] transition-colors">Métodos de Pago</h4>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                          Gestiona tus tarjetas y cuentas.
                        </p>
                      </button>

                      {/* Notifications Card */}
                      <button 
                        onClick={() => setShowNotifications(true)}
                        className="flex flex-col items-start p-4 bg-white rounded-xl shadow-md hover:shadow-xl border border-transparent hover:border-blue-100 transition-all duration-300 group text-left">
                        <div className="p-2 rounded-xl bg-blue-50 text-[#071d7f] group-hover:bg-[#071d7f] group-hover:text-white transition-colors mb-3 shadow-sm">
                          <Bell className="h-5 w-5" />
                        </div>
                        <h4 className="font-bold text-base text-gray-900 group-hover:text-[#071d7f] transition-colors">Notificaciones</h4>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                          Configura alertas de pedidos.
                        </p>
                      </button>

                      {/* Security Card */}
                      <button 
                        onClick={() => setShowChangePassword(true)}
                        className="flex flex-col items-start p-4 bg-white rounded-xl shadow-md hover:shadow-xl border border-transparent hover:border-blue-100 transition-all duration-300 group text-left">
                        <div className="p-2 rounded-xl bg-blue-50 text-[#071d7f] group-hover:bg-[#071d7f] group-hover:text-white transition-colors mb-3 shadow-sm">
                          <Shield className="h-5 w-5" />
                        </div>
                        <h4 className="font-bold text-base text-gray-900 group-hover:text-[#071d7f] transition-colors">Seguridad</h4>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                          Contraseña y accesos.
                        </p>
                      </button>
                    </div>
                  </CardContent>
                </Card>

                {/* Shipping Options */}
                {store && (
                  <div className="mt-4">
                    <StoreShippingConfig storeId={store.id} />
                  </div>
                )}
              </TabsContent>

              </div>
            </div>
          </Tabs>
        </div>
      </div>

      {/* Recommended products - mobile/tablet only */}
      {isMobile && (
        <RecommendedProductsSection maxProducts={12} className="lg:hidden" />
      )}

      {/* Status Viewer Modal */}
      {showStatusViewer && statuses.length > 0 && (
        <SellerStatusViewer
          statuses={statuses}
          onClose={() => setShowStatusViewer(false)}
          onDelete={deleteStatus}
          isOwner={true}
          storeName={store?.name}
          storeLogo={store?.logo}
        />
      )}

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder && !showCancelDialog} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${(statusConfig[selectedOrder.status] ?? defaultStatusConfig).bgColor} ${(statusConfig[selectedOrder.status] ?? defaultStatusConfig).color}`}>
                    {(() => {
                      const Icon = (statusConfig[selectedOrder.status] ?? defaultStatusConfig).icon;
                      return <Icon className="h-5 w-5" />;
                    })()}
                  </div>
                  <div>
                    <span className="block">Pedido #{selectedOrder.id.slice(0, 8).toUpperCase()}</span>
                    {getStatusBadge(selectedOrder.status)}
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Tracking Section */}
                {(selectedOrder.status === 'shipped' || selectedOrder.status === 'delivered') && selectedOrder.metadata?.tracking_number && (
                  <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2 text-purple-700">
                        <Truck className="h-5 w-5" />
                        Seguimiento de Envío
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Paquetería</p>
                          <p className="font-semibold text-purple-900">{selectedOrder.metadata.carrier || "No especificada"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Número de Guía</p>
                          <p className="font-mono font-semibold text-purple-900">{selectedOrder.metadata.tracking_number}</p>
                        </div>
                      </div>
                      
                      {selectedOrder.metadata.estimated_delivery && (
                        <div className="flex items-center gap-2 text-sm bg-white/60 p-2 rounded-lg">
                          <Calendar className="h-4 w-4 text-purple-600" />
                          <span className="text-muted-foreground">Entrega estimada:</span>
                          <span className="font-medium">{selectedOrder.metadata.estimated_delivery}</span>
                        </div>
                      )}

                      {selectedOrder.metadata.carrier && carrierUrls[selectedOrder.metadata.carrier] && (
                        <a 
                          href={`${carrierUrls[selectedOrder.metadata.carrier]}${selectedOrder.metadata.tracking_number}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                        >
                          <MapPin className="h-4 w-4" />
                          Rastrear en {selectedOrder.metadata.carrier}
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Timeline - Horizontal */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Estado del Pedido</h4>
                  <div className="flex items-center justify-between w-full">
                    {['placed', 'paid', 'shipped', 'delivered'].map((step, index, arr) => {
                      const stepStatus = statusConfig[step as BuyerOrderStatus] ?? defaultStatusConfig;
                      const StepIcon = stepStatus.icon;
                      const isCompleted = ['placed', 'paid', 'shipped', 'delivered'].indexOf(selectedOrder.status) >= index;
                      const isCurrent = selectedOrder.status === step;

                      return (
                        <div key={step} className="flex items-center flex-1 last:flex-none">
                          <div className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0
                              ${isCompleted ? stepStatus.bgColor : 'bg-gray-100'}
                              ${isCurrent ? 'ring-2 ring-offset-1 ring-primary' : ''}`}>
                              {isCompleted ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <StepIcon className="h-4 w-4 text-gray-400" />
                              )}
                            </div>
                            <p className={`text-[10px] mt-1 text-center ${isCompleted ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                              {stepStatus.label}
                            </p>
                          </div>
                          {index < arr.length - 1 && (
                            <div className={`flex-1 h-0.5 mx-1 ${isCompleted ? 'bg-green-400' : 'bg-gray-200'}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Order Items */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Productos ({selectedOrder.order_items_b2b?.length || 0})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedOrder.order_items_b2b?.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.nombre}</p>
                          <p className="text-xs text-muted-foreground">Cant: {item.cantidad}</p>
                        </div>
                        <p className="font-semibold">${item.subtotal.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total */}
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Total</span>
                    <span className="text-2xl font-bold text-primary">
                      {selectedOrder.currency} ${selectedOrder.total_amount.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Cancellation Info */}
                {selectedOrder.status === 'cancelled' && (
                  <Card className="bg-red-50 border-red-200">
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Ban className="h-5 w-5 text-red-600" />
                        <span className="font-medium text-red-700">Pedido Cancelado</span>
                      </div>
                      {selectedOrder.metadata?.cancellation_reason && (
                        <p className="text-sm text-red-600">
                          <span className="font-medium">Motivo:</span> {selectedOrder.metadata.cancellation_reason}
                        </p>
                      )}
                      {selectedOrder.metadata?.refund_status && selectedOrder.metadata.refund_status !== 'none' && (
                        <div className="border-t border-red-200 pt-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-red-700">Estado del Reembolso</span>
                            <Badge className={`${refundStatusConfig[selectedOrder.metadata.refund_status as RefundStatus].bgColor} ${refundStatusConfig[selectedOrder.metadata.refund_status as RefundStatus].color}`}>
                              {refundStatusConfig[selectedOrder.metadata.refund_status as RefundStatus].label}
                            </Badge>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-3">
                  <Button asChild className="w-full">
                    <Link to="/seller/adquisicion-lotes">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Volver a Comprar
                    </Link>
                  </Button>

                  <OpenChatButton
                    orderId={selectedOrder.id}
                    orderType="b2b"
                    orderLabel={`Pedido #${selectedOrder.id.slice(0, 8).toUpperCase()}`}
                    fullWidth
                    navigateTo="seller"
                  />

                  {['placed', 'paid'].includes(selectedOrder.status) && (
                    <Button 
                      variant="outline" 
                      className="w-full border-red-300 text-red-600 hover:bg-red-50"
                      onClick={() => handleCancelClick(selectedOrder)}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancelar Pedido
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-[#071d7f]">Cambiar Contraseña</DialogTitle>
            <DialogDescription>
              Ingresa tu nueva contraseña segura
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nueva Contraseña</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Ingresa tu nueva contraseña"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Contraseña</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirma tu nueva contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowChangePassword(false)}>
              Cancelar
            </Button>
            <Button onClick={handleChangePassword} className="bg-[#071d7f] hover:bg-[#071d7f]/90">
              Actualizar Contraseña
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Notifications Settings Dialog */}
      <Dialog open={showNotifications} onOpenChange={setShowNotifications}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-[#071d7f]">Configurar Notificaciones</DialogTitle>
            <DialogDescription>
              Personaliza cómo deseas recibir actualizaciones
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
              <Checkbox
                id="email-notifications"
                checked={notificationSettings.emailNotifications}
                onCheckedChange={(checked) =>
                  setNotificationSettings({...notificationSettings, emailNotifications: checked as boolean})
                }
              />
              <Label htmlFor="email-notifications" className="cursor-pointer flex-1">
                <p className="font-medium text-gray-900">Notificaciones por Correo</p>
                <p className="text-xs text-gray-500">Recibe actualizaciones en tu correo</p>
              </Label>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
              <Checkbox
                id="order-notifications"
                checked={notificationSettings.orderNotifications}
                onCheckedChange={(checked) =>
                  setNotificationSettings({...notificationSettings, orderNotifications: checked as boolean})
                }
              />
              <Label htmlFor="order-notifications" className="cursor-pointer flex-1">
                <p className="font-medium text-gray-900">Notificaciones de Pedidos</p>
                <p className="text-xs text-gray-500">Alertas cuando haya nuevos pedidos</p>
              </Label>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
              <Checkbox
                id="whatsapp-notifications"
                checked={notificationSettings.whatsappNotifications}
                onCheckedChange={(checked) =>
                  setNotificationSettings({...notificationSettings, whatsappNotifications: checked as boolean})
                }
              />
              <Label htmlFor="whatsapp-notifications" className="cursor-pointer flex-1">
                <p className="font-medium text-gray-900">Notificaciones por WhatsApp</p>
                <p className="text-xs text-gray-500">Alertas rápidas en WhatsApp</p>
              </Label>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
              <Checkbox
                id="promotional-emails"
                checked={notificationSettings.promotionalEmails}
                onCheckedChange={(checked) =>
                  setNotificationSettings({...notificationSettings, promotionalEmails: checked as boolean})
                }
              />
              <Label htmlFor="promotional-emails" className="cursor-pointer flex-1">
                <p className="font-medium text-gray-900">Emails Promocionales</p>
                <p className="text-xs text-gray-500">Ofertas y promociones especiales</p>
              </Label>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowNotifications(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveNotifications} className="bg-[#071d7f] hover:bg-[#071d7f]/90">
              Guardar Cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Order Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Cancelar Pedido
            </DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Por favor indica el motivo de la cancelación.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo de cancelación *</label>
              <Textarea
                placeholder="Escribe el motivo de la cancelación..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
              />
            </div>

            {selectedOrder?.status === 'paid' && (
              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <input
                  type="checkbox"
                  id="refund"
                  checked={requestRefund}
                  onChange={(e) => setRequestRefund(e.target.checked)}
                  className="mt-1"
                />
                <div className="space-y-1">
                  <label htmlFor="refund" className="font-medium text-amber-800 cursor-pointer">
                    Solicitar reembolso
                  </label>
                  <p className="text-xs text-amber-600">
                    Tu pedido ya fue pagado. Marca esta opción para solicitar el reembolso de ${selectedOrder?.total_amount.toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCancelDialog(false)} disabled={cancelOrder.isPending}>
              Volver
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmCancel}
              disabled={!cancelReason.trim() || cancelOrder.isPending}
            >
              {cancelOrder.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Confirmar Cancelación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Methods Dialog */}
      <Dialog open={showPaymentMethods} onOpenChange={setShowPaymentMethods}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#071d7f]">Métodos de Pago</DialogTitle>
            <DialogDescription>
              Configura los métodos de pago que aceptarás para recibir pagos
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Mon Cash Card */}
            <Card className="border-orange-200 bg-orange-50/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 rounded-lg bg-orange-100 text-orange-600 mt-1">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Mon Cash</h4>
                      <p className="text-sm text-gray-600">Billetera digital haitiana</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-200">Activo</Badge>
                        <span className="text-xs text-gray-500">Comisión: 1.5%</span>
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-orange-600 border-orange-300 hover:bg-orange-100"
                    onClick={() => {
                      setShowPaymentMethods(false);
                      setActiveTab('tienda');
                    }}
                  >
                    Configurar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Nat Cash Card */}
            <Card className="border-cyan-200 bg-cyan-50/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 rounded-lg bg-cyan-100 text-cyan-600 mt-1">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Nat Cash</h4>
                      <p className="text-sm text-gray-600">Billetera digital haitiana</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-200">Activo</Badge>
                        <span className="text-xs text-gray-500">Comisión: 1.5%</span>
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-cyan-600 border-cyan-300 hover:bg-cyan-100"
                    onClick={() => {
                      setShowPaymentMethods(false);
                      setActiveTab('tienda');
                    }}
                  >
                    Configurar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Bank Transfer Card */}
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 rounded-lg bg-green-100 text-green-600 mt-1">
                      <DollarSign className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Transferencia Bancaria</h4>
                      <p className="text-sm text-gray-600">Transferencias desde cuentas bancarias</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-200">Activo</Badge>
                        <span className="text-xs text-gray-500">Comisión: Flexible</span>
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-green-600 border-green-300 hover:bg-green-100"
                    onClick={() => {
                      setShowPaymentMethods(false);
                      setActiveTab('tienda');
                    }}
                  >
                    Configurar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">💡 Nota:</span> Configura tus métodos de pago (Moncash, Natcash y Transferencia Bancaria) en la sección "Mi Tienda" para recibir pagos. Stripe está disponible globalmente para todos los clientes.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentMethods(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Store Dialog */}
      <Dialog open={showEditStore} onOpenChange={setShowEditStore}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#071d7f]">Editar Información de la Tienda</DialogTitle>
            <DialogDescription>
              Actualiza los detalles de tu tienda
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-store-name">Nombre de la Tienda</Label>
              <Input 
                id="edit-store-name" 
                defaultValue={store?.name || ""} 
                placeholder="Nombre de tu tienda"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-store-description">Descripción</Label>
              <Textarea 
                id="edit-store-description" 
                defaultValue={store?.description || ""} 
                placeholder="Describe tu tienda"
                rows={4}
              />
            </div>

            {/* Location */}
            <div className="space-y-3 pt-2 border-t">
              <Label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <MapPin className="h-4 w-4" />
                Ubicación de la Tienda
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">País</Label>
                  <Select value={editCountry} onValueChange={setEditCountry}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="País" />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-[60] max-h-[260px]">
                      <SelectItem value="Haïtí">🇭🇹 Haïtí</SelectItem>
                      <SelectItem value="República Dominicana">🇩🇴 República Dominicana</SelectItem>
                      <SelectItem value="México">🇲🇽 México</SelectItem>
                      <SelectItem value="Colombia">🇨🇴 Colombia</SelectItem>
                      <SelectItem value="Estados Unidos">🇺🇸 Estados Unidos</SelectItem>
                      <SelectItem value="Francia">🇫🇷 Francia</SelectItem>
                      <SelectItem value="Canadá">🇨🇦 Canadá</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Departamento</Label>
                  <Select value={editDepartmentId} onValueChange={(v) => { setEditDepartmentId(v); setEditCommuneId(""); }}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Departamento" />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-[60] max-h-[260px]">
                      {locationDepartments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Comuna</Label>
                <Select
                  value={editCommuneId}
                  onValueChange={setEditCommuneId}
                  disabled={!editDepartmentId || locationCommunes.length === 0}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={editDepartmentId ? "Selecciona una comuna" : "Elige departamento primero"} />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-[60] max-h-[260px]">
                    {locationCommunes.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditStore(false)}>
              Cancelar
            </Button>
            <Button className="bg-[#071d7f] hover:bg-[#071d7f]/90" onClick={handleSaveEditStore}>
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Profile Photo Dialog */}
      <Dialog open={showViewProfilePhoto !== null} onOpenChange={() => setShowViewProfilePhoto(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#071d7f]">
              {showViewProfilePhoto === 'profile' ? 'Foto de Perfil' : 'Banner de la Tienda'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <img 
              src={showViewProfilePhoto === 'profile' ? (store?.logo || '') : (store?.banner || '')} 
              alt={showViewProfilePhoto === 'profile' ? 'Foto de perfil' : 'Banner'}
              className="max-w-full max-h-96 rounded-lg"
            />
            <Button 
              className="bg-[#071d7f] hover:bg-[#071d7f]/90 w-full"
              onClick={() => {
                setShowViewProfilePhoto(null);
                setShowEditProfilePhoto(true);
              }}
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar Imagen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Photo Dialog */}
      <Dialog open={showEditProfilePhoto} onOpenChange={(open) => {
        if (!open) {
          setNewLogoFile(null);
          setNewBannerFiles([]);
          setNewLogoPreview(null);
          setNewBannerPreviews([]);
        }
        setShowEditProfilePhoto(open);
      }}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] flex flex-col overflow-hidden p-0">
          <DialogHeader className="px-4 pt-4 pb-2 flex-shrink-0">
            <DialogTitle className="text-[#071d7f]">Editar Foto de Perfil y Banner</DialogTitle>
            <DialogDescription>
              Carga una nueva foto de perfil o banner para tu tienda
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable content area - vertical only */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4">
            <div className="space-y-4 py-2">
              {/* Profile Photo */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="profile-photo">Foto de Perfil</Label>
                  <span className="text-xs text-gray-500">800x800px mín.</span>
                </div>
                <label htmlFor="profile-photo" className="block border-2 border-dashed border-gray-300 rounded-lg overflow-hidden text-center hover:border-[#071d7f] transition-colors cursor-pointer">
                  {newLogoPreview ? (
                    <img src={newLogoPreview} alt="Vista previa logo" className="w-full h-32 object-cover" />
                  ) : store?.logo ? (
                    <img src={store.logo} alt="Logo actual" className="w-full h-32 object-cover opacity-60" />
                  ) : (
                    <div className="p-4">
                      <Edit className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs text-gray-600">Haz clic para seleccionar</p>
                    </div>
                  )}
                  <input 
                    id="profile-photo" 
                    type="file" 
                    accept="image/*" 
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setNewLogoFile(file);
                        setNewLogoPreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                </label>
                {newLogoPreview && (
                  <p className="text-xs text-green-600">✓ Nueva foto seleccionada</p>
                )}
              </div>

              {/* Banner Photos — múltiples, carrusel */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Banners de la Tienda</Label>
                  <span className="text-xs text-gray-500">7257×2079px ideal · infinitos</span>
                </div>

                {/* Existing banners from DB */}
                {(store?.banner_images ?? (store?.banner ? [store.banner] : [])).length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 font-medium">Actuales ({(store?.banner_images ?? (store?.banner ? [store.banner] : [])).length})</p>
                    <div className="flex flex-wrap gap-2">
                      {(store?.banner_images ?? (store?.banner ? [store.banner] : [])).map((url, i) => (
                        <div key={i} className="relative group">
                          <img src={url} alt={`Banner ${i+1}`} className="h-16 w-28 object-cover rounded border border-gray-200" />
                          <button
                            type="button"
                            onClick={async () => {
                              if (!store?.id) return;
                              const current = store.banner_images ?? (store.banner ? [store.banner] : []);
                              const updated = current.filter((_, idx) => idx !== i);
                              await supabase.from('stores').update({
                                banner_images: updated,
                                banner: updated[0] ?? null,
                              }).eq('id', store.id);
                              queryClient.invalidateQueries({ queryKey: ['store', 'owner', user?.id] });
                            }}
                            className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >✕</button>
                          {i === 0 && <span className="absolute bottom-0.5 left-0.5 bg-[#071d7f] text-white text-[9px] px-1 rounded">Principal</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* New banners to add */}
                {newBannerPreviews.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-green-600 font-medium">Nuevas a subir ({newBannerPreviews.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {newBannerPreviews.map((src, i) => (
                        <div key={i} className="relative group">
                          <img src={src} alt={`Nuevo banner ${i+1}`} className="h-16 w-28 object-cover rounded border-2 border-green-400" />
                          <button
                            type="button"
                            onClick={() => {
                              setNewBannerFiles(prev => prev.filter((_, idx) => idx !== i));
                              setNewBannerPreviews(prev => prev.filter((_, idx) => idx !== i));
                            }}
                            className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add more button */}
                <label htmlFor="banner-photo" className="flex items-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-3 cursor-pointer hover:border-[#071d7f] transition-colors">
                  <Edit className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="text-xs text-gray-600">Agregar foto(s) al carrusel</span>
                  <input
                    id="banner-photo"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length === 0) return;
                      setNewBannerFiles(prev => [...prev, ...files]);
                      setNewBannerPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>

              {/* Banner slide interval */}
              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label>Velocidad del carrusel</Label>
                  <span className="text-xs text-gray-500">segundos por imagen</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={2}
                    max={10}
                    step={1}
                    defaultValue={store?.banner_slide_interval ?? 3}
                    className="flex-1 accent-[#071d7f]"
                    onChange={async (e) => {
                      if (!store?.id) return;
                      const val = Number(e.target.value);
                      await supabase.from('stores').update({ banner_slide_interval: val }).eq('id', store.id);
                      queryClient.invalidateQueries({ queryKey: ['store', 'owner', user?.id] });
                    }}
                  />
                  <span className="w-10 text-center text-sm font-semibold text-[#071d7f]">
                    {store?.banner_slide_interval ?? 3}s
                  </span>
                </div>
                <p className="text-xs text-gray-400">Mínimo 2s · Máximo 10s</p>
              </div>

              {/* Store Description Section - Separate scrollable box */}
              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Descripción de la Tienda</h3>
                  {!editingDescription && (
                    <button
                      onClick={() => setEditingDescription(true)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Editar descripción"
                    >
                      <Edit className="h-4 w-4 text-[#071d7f]" />
                    </button>
                  )}
                </div>
                
                {editingDescription ? (
                  <div className="space-y-2">
                    <Textarea
                      value={storeDescription}
                      onChange={(e) => setStoreDescription(e.target.value)}
                      placeholder="Cuéntale a tus clientes sobre tu tienda..."
                      className="min-h-[80px] border-gray-300 text-sm"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingDescription(false);
                          setStoreDescription(store?.description || "");
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        className="bg-[#071d7f] hover:bg-[#071d7f]/90"
                        onClick={handleUpdateStoreDescription}
                      >
                        Guardar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 max-h-[100px] overflow-y-auto">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                      {storeDescription || "No hay descripción configurada"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Fixed footer */}
          <DialogFooter className="px-4 py-3 border-t flex-shrink-0 gap-2">
            <Button variant="outline" onClick={() => setShowEditProfilePhoto(false)} className="flex-1" disabled={uploadingPhotos}>
              Cancelar
            </Button>
            <Button className="bg-[#071d7f] hover:bg-[#071d7f]/90 flex-1" onClick={handleSavePhotos} disabled={uploadingPhotos}>
              {uploadingPhotos ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</> : 'Guardar Fotos'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Personal Photo Dialog */}
      <Dialog open={showEditPersonalPhoto} onOpenChange={(open) => {
        if (!open) { setNewAvatarFile(null); setNewAvatarPreview(null); }
        setShowEditPersonalPhoto(open);
      }}>
        <DialogContent className="w-[95vw] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#071d7f]">Foto de Perfil Personal</DialogTitle>
            <DialogDescription>
              Esta foto representa tu cuenta personal, no tu tienda.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Current / Preview avatar */}
            <div className="flex justify-center">
              <label htmlFor="personal-avatar-input" className="cursor-pointer group relative">
                <Avatar className="h-28 w-28 border-4 border-gray-200 group-hover:border-[#071d7f] transition-colors">
                  <AvatarImage src={newAvatarPreview || user?.avatar_url || ""} />
                  <AvatarFallback className="bg-blue-100 text-[#071d7f] font-bold text-3xl">
                    {user?.name?.charAt(0)?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="h-7 w-7 text-white" />
                </div>
                <input
                  id="personal-avatar-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) { setNewAvatarFile(file); setNewAvatarPreview(URL.createObjectURL(file)); }
                  }}
                />
              </label>
            </div>
            {newAvatarPreview
              ? <p className="text-xs text-green-600 text-center">✓ Nueva foto seleccionada — haz clic en Guardar</p>
              : <p className="text-xs text-gray-500 text-center">Haz clic en la imagen para seleccionar una foto</p>
            }
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowEditPersonalPhoto(false)} disabled={uploadingAvatar} className="flex-1">
              Cancelar
            </Button>
            <Button className="bg-[#071d7f] hover:bg-[#071d7f]/90 flex-1" onClick={handleSavePersonalPhoto} disabled={uploadingAvatar || !newAvatarFile}>
              {uploadingAvatar ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</> : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Information Dialog */}
      <Dialog open={showEditInfo} onOpenChange={setShowEditInfo}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#071d7f]">Editar Información de Contacto</DialogTitle>
            <DialogDescription>
              Actualiza tu información de contacto
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nombre Completo</Label>
              <Input 
                id="edit-name" 
                value={contactInfo.full_name}
                onChange={(e) => setContactInfo({...contactInfo, full_name: e.target.value})}
                placeholder="Tu nombre"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Teléfono</Label>
              <Input 
                id="edit-phone" 
                value={contactInfo.phone}
                onChange={(e) => setContactInfo({...contactInfo, phone: e.target.value})}
                placeholder="+509 XXXX XXXX"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-whatsapp">WhatsApp</Label>
              <Input 
                id="edit-whatsapp" 
                value={contactInfo.whatsapp}
                onChange={(e) => setContactInfo({...contactInfo, whatsapp: e.target.value})}
                placeholder="+509 XXXX XXXX"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditInfo(false)}>
              Cancelar
            </Button>
            <Button 
              className="bg-[#071d7f] hover:bg-[#071d7f]/90" 
              onClick={handleSaveContactInfo}
              disabled={savingContact}
            >
              {savingContact ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar Cambios"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <LegalPagesModal open={showLegal} onOpenChange={setShowLegal} />
      <AboutModal open={showAbout} onOpenChange={setShowAbout} />
    </SellerLayout>
  );
};

export default SellerAccountPage;
