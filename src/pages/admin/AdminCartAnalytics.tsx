import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  ShoppingCart, 
  TrendingUp, 
  Users, 
  Package,
  Calendar,
  BarChart3,
  Eye,
  Search,
  X,
  ExternalLink,
  Filter
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { format, subDays, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

type TimeRange = "7d" | "30d" | "90d" | "all";

const useCartAnalytics = (timeRange: TimeRange) => {
  return useQuery({
    queryKey: ["cart-analytics", timeRange],
    queryFn: async () => {
      let dateFilter: string | null = null;
      
      if (timeRange !== "all") {
        const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
        dateFilter = startOfDay(subDays(new Date(), days)).toISOString();
      }

      let b2bQuery = supabase
        .from("b2b_cart_items")
        .select(`
          id,
          sku,
          nombre,
          quantity,
          unit_price,
          total_price,
          created_at,
          cart_id,
          product_id,
          b2b_carts!inner(
            buyer_user_id,
            profiles:buyer_user_id(full_name, email)
          )
        `)
        .order("created_at", { ascending: false });

      if (dateFilter) {
        b2bQuery = b2bQuery.gte("created_at", dateFilter);
      }

      let b2cQuery = supabase
        .from("b2c_cart_items")
        .select(`
          id,
          sku,
          nombre,
          quantity,
          unit_price,
          total_price,
          created_at,
          cart_id,
          image,
          store_name,
          seller_catalog_id,
          b2c_carts!inner(
            user_id,
            profiles:user_id(full_name, email)
          )
        `)
        .order("created_at", { ascending: false });

      if (dateFilter) {
        b2cQuery = b2cQuery.gte("created_at", dateFilter);
      }

      const [b2bResult, b2cResult] = await Promise.all([b2bQuery, b2cQuery]);

      const b2bItems = b2bResult.data || [];
      const b2bProductStats = new Map<string, {
        sku: string;
        nombre: string;
        productId?: string;
        totalQuantity: number;
        totalValue: number;
        addCount: number;
        users: Set<string>;
        userDetails: { name: string; email: string; quantity: number; date: string }[];
      }>();

      b2bItems.forEach((item: any) => {
        const key = item.sku;
        const userId = item.b2b_carts?.buyer_user_id || "unknown";
        const userName = item.b2b_carts?.profiles?.full_name || "Usuario B2B";
        const userEmail = item.b2b_carts?.profiles?.email || "";
        
        if (!b2bProductStats.has(key)) {
          b2bProductStats.set(key, {
            sku: item.sku,
            nombre: item.nombre,
            productId: item.product_id,
            totalQuantity: 0,
            totalValue: 0,
            addCount: 0,
            users: new Set(),
            userDetails: [],
          });
        }
        
        const stat = b2bProductStats.get(key)!;
        stat.totalQuantity += item.quantity;
        stat.totalValue += Number(item.total_price) || 0;
        stat.addCount += 1;
        stat.users.add(userId);
        stat.userDetails.push({
          name: userName,
          email: userEmail,
          quantity: item.quantity,
          date: item.created_at,
        });
      });

      const b2cItems = b2cResult.data || [];
      const b2cProductStats = new Map<string, {
        sku: string;
        nombre: string;
        image?: string;
        storeName?: string;
        catalogId?: string;
        totalQuantity: number;
        totalValue: number;
        addCount: number;
        users: Set<string>;
        userDetails: { name: string; email: string; quantity: number; date: string }[];
      }>();

      b2cItems.forEach((item: any) => {
        const key = item.sku;
        const userId = item.b2c_carts?.user_id || "unknown";
        const userName = item.b2c_carts?.profiles?.full_name || "Cliente";
        const userEmail = item.b2c_carts?.profiles?.email || "";
        
        if (!b2cProductStats.has(key)) {
          b2cProductStats.set(key, {
            sku: item.sku,
            nombre: item.nombre,
            image: item.image,
            storeName: item.store_name,
            catalogId: item.seller_catalog_id,
            totalQuantity: 0,
            totalValue: 0,
            addCount: 0,
            users: new Set(),
            userDetails: [],
          });
        }
        
        const stat = b2cProductStats.get(key)!;
        stat.totalQuantity += item.quantity;
        stat.totalValue += Number(item.total_price) || 0;
        stat.addCount += 1;
        stat.users.add(userId);
        stat.userDetails.push({
          name: userName,
          email: userEmail,
          quantity: item.quantity,
          date: item.created_at,
        });
      });

      const b2bTopProducts = Array.from(b2bProductStats.values())
        .map(p => ({ ...p, uniqueUsers: p.users.size }))
        .sort((a, b) => b.addCount - a.addCount);

      const b2cTopProducts = Array.from(b2cProductStats.values())
        .map(p => ({ ...p, uniqueUsers: p.users.size }))
        .sort((a, b) => b.addCount - a.addCount);

      const b2bRecentActivity = b2bItems.slice(0, 15).map((item: any) => ({
        id: item.id,
        sku: item.sku,
        nombre: item.nombre,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        totalPrice: item.total_price,
        productId: item.product_id,
        createdAt: item.created_at,
        userName: item.b2b_carts?.profiles?.full_name || "Usuario B2B",
        userEmail: item.b2b_carts?.profiles?.email || "",
        type: "b2b" as const,
      }));

      const b2cRecentActivity = b2cItems.slice(0, 15).map((item: any) => ({
        id: item.id,
        sku: item.sku,
        nombre: item.nombre,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        totalPrice: item.total_price,
        image: item.image,
        storeName: item.store_name,
        catalogId: item.seller_catalog_id,
        createdAt: item.created_at,
        userName: item.b2c_carts?.profiles?.full_name || "Cliente",
        userEmail: item.b2c_carts?.profiles?.email || "",
        type: "b2c" as const,
      }));

      const b2bTotalItems = b2bItems.length;
      const b2cTotalItems = b2cItems.length;
      const b2bTotalValue = b2bItems.reduce((sum: number, item: any) => sum + (Number(item.total_price) || 0), 0);
      const b2cTotalValue = b2cItems.reduce((sum: number, item: any) => sum + (Number(item.total_price) || 0), 0);
      const b2bUniqueUsers = new Set(b2bItems.map((item: any) => item.b2b_carts?.buyer_user_id)).size;
      const b2cUniqueUsers = new Set(b2cItems.map((item: any) => item.b2c_carts?.user_id)).size;

      return {
        b2b: {
          topProducts: b2bTopProducts,
          recentActivity: b2bRecentActivity,
          totalItems: b2bTotalItems,
          totalValue: b2bTotalValue,
          uniqueUsers: b2bUniqueUsers,
        },
        b2c: {
          topProducts: b2cTopProducts,
          recentActivity: b2cRecentActivity,
          totalItems: b2cTotalItems,
          totalValue: b2cTotalValue,
          uniqueUsers: b2cUniqueUsers,
        },
      };
    },
    staleTime: 1000 * 60 * 5,
  });
};

const StatCard = ({ icon: Icon, label, value, subValue, color, bgColor, isLoading }: any) => (
  <div className="group relative bg-gradient-to-br from-card to-card/80 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 p-5 border border-border/30 hover:border-primary/20 overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    <div className="relative z-10">
      <div className="flex items-center justify-between mb-3">
        <div className={`${bgColor} p-2.5 rounded-xl shadow-sm`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-medium mb-1">{label}</p>
      {isLoading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <>
          <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
          {subValue && <p className="text-xs text-muted-foreground mt-1">{subValue}</p>}
        </>
      )}
    </div>
  </div>
);

const ProductRow = ({ 
  product, 
  rank, 
  type, 
  onClick 
}: { 
  product: any; 
  rank: number; 
  type: "b2b" | "b2c"; 
  onClick: () => void;
}) => (
  <div 
    className="flex items-center gap-4 p-4 rounded-lg hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0 cursor-pointer group"
    onClick={onClick}
  >
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
      rank <= 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
    }`}>
      {rank}
    </div>
    
    {type === "b2c" && product.image && (
      <img src={product.image} alt={product.nombre} className="w-12 h-12 rounded-lg object-cover border border-border/50" />
    )}
    
    <div className="flex-1 min-w-0">
      <p className="font-medium text-foreground truncate group-hover:text-primary transition-colors">{product.nombre}</p>
      <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
      {type === "b2c" && product.storeName && (
        <p className="text-xs text-primary">{product.storeName}</p>
      )}
    </div>
    
    <div className="text-right space-y-1">
      <div className="flex items-center gap-2 justify-end">
        <Badge variant="secondary" className="font-mono">
          {product.addCount} veces
        </Badge>
        <Badge variant="outline" className="font-mono">
          {product.totalQuantity} uds
        </Badge>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground justify-end">
        <Users className="w-3 h-3" />
        <span>{product.uniqueUsers} usuarios</span>
      </div>
    </div>
    
    <div className="text-right">
      <p className="font-semibold text-foreground">${product.totalValue.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">valor total</p>
    </div>
    
    <Eye className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
  </div>
);

const ActivityRow = ({ activity, onClick }: { activity: any; onClick: () => void }) => (
  <div 
    className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer group"
    onClick={onClick}
  >
    <Avatar className="h-9 w-9 border border-border/50">
      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
        {activity.userName?.substring(0, 2).toUpperCase() || "??"}
      </AvatarFallback>
    </Avatar>
    
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="font-medium text-foreground text-sm truncate group-hover:text-primary transition-colors">{activity.userName}</p>
        <Badge variant={activity.type === "b2b" ? "default" : "secondary"} className="text-[10px]">
          {activity.type.toUpperCase()}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground truncate">
        Agregó <span className="font-medium">{activity.quantity}x</span> {activity.nombre}
      </p>
    </div>
    
    <div className="text-right">
      <p className="font-medium text-foreground text-sm">${Number(activity.totalPrice).toLocaleString()}</p>
      <p className="text-[10px] text-muted-foreground">
        {format(new Date(activity.createdAt), "dd MMM, HH:mm", { locale: es })}
      </p>
    </div>
    
    <Eye className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
  </div>
);

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
  type: "b2b" | "b2c";
}

const ProductDetailModal = ({ isOpen, onClose, product, type }: ProductDetailModalProps) => {
  const navigate = useNavigate();
  
  if (!product) return null;

  const handleViewProduct = () => {
    if (type === "b2b" && product.productId) {
      // Navigate to B2B product by SKU
      navigate(`/producto/${product.sku}`);
    } else if (type === "b2c" && product.catalogId) {
      // Navigate to B2C catalog product
      navigate(`/producto/catalogo/${product.catalogId}`);
    } else {
      // Fallback to SKU
      navigate(`/producto/${product.sku}`);
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {product.image && (
              <img src={product.image} alt={product.nombre} className="w-16 h-16 rounded-lg object-cover border" />
            )}
            <div>
              <span className="text-lg">{product.nombre}</span>
              <p className="text-sm font-normal text-muted-foreground">SKU: {product.sku}</p>
            </div>
          </DialogTitle>
          <DialogDescription>
            Detalles del producto y usuarios que lo agregaron al carrito
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-primary">{product.addCount}</p>
              <p className="text-xs text-muted-foreground">Veces agregado</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{product.totalQuantity}</p>
              <p className="text-xs text-muted-foreground">Unidades totales</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{product.uniqueUsers}</p>
              <p className="text-xs text-muted-foreground">Usuarios únicos</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-600">${product.totalValue.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Valor total</p>
            </div>
          </div>

          {/* Users who added this product */}
          <div>
            <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Usuarios que agregaron este producto
            </h4>
            <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-2">
              {product.userDetails?.slice(0, 20).map((user: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {user.name?.substring(0, 2).toUpperCase() || "??"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">{user.quantity} uds</Badge>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {format(new Date(user.date), "dd/MM/yy HH:mm", { locale: es })}
                    </p>
                  </div>
                </div>
              ))}
              {(!product.userDetails || product.userDetails.length === 0) && (
                <p className="text-center text-muted-foreground py-4">No hay datos de usuarios</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            <Button onClick={handleViewProduct} className="gap-2">
              <ExternalLink className="w-4 h-4" />
              Ver Producto
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const AdminCartAnalytics = () => {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "b2b" | "b2c">("all");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedProductType, setSelectedProductType] = useState<"b2b" | "b2c">("b2b");
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const { data, isLoading } = useCartAnalytics(timeRange);

  // Filter products based on search and type
  const filteredB2BProducts = useMemo(() => {
    if (!data?.b2b.topProducts) return [];
    return data.b2b.topProducts.filter(p => 
      p.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data?.b2b.topProducts, searchQuery]);

  const filteredB2CProducts = useMemo(() => {
    if (!data?.b2c.topProducts) return [];
    return data.b2c.topProducts.filter(p => 
      p.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data?.b2c.topProducts, searchQuery]);

  const handleProductClick = (product: any, type: "b2b" | "b2c") => {
    setSelectedProduct(product);
    setSelectedProductType(type);
    setIsModalOpen(true);
  };

  const handleActivityClick = (activity: any) => {
    if (activity.type === "b2b" && activity.productId) {
      navigate(`/producto/${activity.sku}`);
    } else if (activity.type === "b2c" && activity.catalogId) {
      navigate(`/producto/catalogo/${activity.catalogId}`);
    } else {
      navigate(`/producto/${activity.sku}`);
    }
  };

  return (
    <AdminLayout 
      title="Optimización de Inventario" 
      subtitle="Análisis de productos agregados al carrito B2B y B2C"
    >
      {/* Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
            <SelectTrigger className="w-32">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="b2b">Solo B2B</SelectItem>
              <SelectItem value="b2c">Solo B2C</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 días</SelectItem>
              <SelectItem value="30d">Últimos 30 días</SelectItem>
              <SelectItem value="90d">Últimos 90 días</SelectItem>
              <SelectItem value="all">Todo el tiempo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        <StatCard
          icon={ShoppingCart}
          label="Items B2B"
          value={data?.b2b.totalItems.toLocaleString() || "0"}
          color="text-blue-600"
          bgColor="bg-blue-50"
          isLoading={isLoading}
        />
        <StatCard
          icon={ShoppingCart}
          label="Items B2C"
          value={data?.b2c.totalItems.toLocaleString() || "0"}
          color="text-purple-600"
          bgColor="bg-purple-50"
          isLoading={isLoading}
        />
        <StatCard
          icon={TrendingUp}
          label="Valor B2B"
          value={`$${((data?.b2b.totalValue || 0) / 1000).toFixed(1)}K`}
          color="text-green-600"
          bgColor="bg-green-50"
          isLoading={isLoading}
        />
        <StatCard
          icon={TrendingUp}
          label="Valor B2C"
          value={`$${((data?.b2c.totalValue || 0) / 1000).toFixed(1)}K`}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
          isLoading={isLoading}
        />
        <StatCard
          icon={Users}
          label="Usuarios B2B"
          value={data?.b2b.uniqueUsers.toString() || "0"}
          color="text-amber-600"
          bgColor="bg-amber-50"
          isLoading={isLoading}
        />
        <StatCard
          icon={Users}
          label="Usuarios B2C"
          value={data?.b2c.uniqueUsers.toString() || "0"}
          color="text-rose-600"
          bgColor="bg-rose-50"
          isLoading={isLoading}
        />
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="top-products" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="top-products" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Productos Más Agregados
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Eye className="w-4 h-4" />
            Actividad Reciente
          </TabsTrigger>
        </TabsList>

        <TabsContent value="top-products" className="space-y-6">
          <div className={`grid gap-6 ${typeFilter === "all" ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"}`}>
            {/* B2B Top Products */}
            {(typeFilter === "all" || typeFilter === "b2b") && (
              <Card className="border-border/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Badge variant="default" className="text-xs">B2B</Badge>
                        Productos Más Populares
                        {searchQuery && <Badge variant="outline" className="ml-2">{filteredB2BProducts.length} resultados</Badge>}
                      </CardTitle>
                      <CardDescription>
                        Productos más agregados al carrito por vendedores
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="p-4 space-y-4">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : filteredB2BProducts.length === 0 ? (
                    <div className="p-8 text-center">
                      <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">
                        {searchQuery ? "No se encontraron productos" : "Sin datos para este período"}
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-[500px] overflow-y-auto">
                      {filteredB2BProducts.slice(0, 20).map((product, index) => (
                        <ProductRow 
                          key={product.sku} 
                          product={product} 
                          rank={index + 1} 
                          type="b2b"
                          onClick={() => handleProductClick(product, "b2b")}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* B2C Top Products */}
            {(typeFilter === "all" || typeFilter === "b2c") && (
              <Card className="border-border/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">B2C</Badge>
                        Productos Más Populares
                        {searchQuery && <Badge variant="outline" className="ml-2">{filteredB2CProducts.length} resultados</Badge>}
                      </CardTitle>
                      <CardDescription>
                        Productos más agregados al carrito por clientes
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="p-4 space-y-4">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : filteredB2CProducts.length === 0 ? (
                    <div className="p-8 text-center">
                      <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">
                        {searchQuery ? "No se encontraron productos" : "Sin datos para este período"}
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-[500px] overflow-y-auto">
                      {filteredB2CProducts.slice(0, 20).map((product, index) => (
                        <ProductRow 
                          key={product.sku} 
                          product={product} 
                          rank={index + 1} 
                          type="b2c"
                          onClick={() => handleProductClick(product, "b2c")}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <div className={`grid gap-6 ${typeFilter === "all" ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"}`}>
            {/* B2B Activity */}
            {(typeFilter === "all" || typeFilter === "b2b") && (
              <Card className="border-border/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Badge variant="default" className="text-xs">B2B</Badge>
                    Actividad Reciente
                  </CardTitle>
                  <CardDescription>
                    Últimos productos agregados por vendedores
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="p-4 space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-14 w-full" />
                      ))}
                    </div>
                  ) : data?.b2b.recentActivity.length === 0 ? (
                    <div className="p-8 text-center">
                      <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">Sin actividad reciente</p>
                    </div>
                  ) : (
                    <div className="max-h-[500px] overflow-y-auto divide-y divide-border/30">
                      {data?.b2b.recentActivity.map((activity) => (
                        <ActivityRow 
                          key={activity.id} 
                          activity={activity}
                          onClick={() => handleActivityClick(activity)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* B2C Activity */}
            {(typeFilter === "all" || typeFilter === "b2c") && (
              <Card className="border-border/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">B2C</Badge>
                    Actividad Reciente
                  </CardTitle>
                  <CardDescription>
                    Últimos productos agregados por clientes
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="p-4 space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-14 w-full" />
                      ))}
                    </div>
                  ) : data?.b2c.recentActivity.length === 0 ? (
                    <div className="p-8 text-center">
                      <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">Sin actividad reciente</p>
                    </div>
                  ) : (
                    <div className="max-h-[500px] overflow-y-auto divide-y divide-border/30">
                      {data?.b2c.recentActivity.map((activity) => (
                        <ActivityRow 
                          key={activity.id} 
                          activity={activity}
                          onClick={() => handleActivityClick(activity)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Product Detail Modal */}
      <ProductDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        product={selectedProduct}
        type={selectedProductType}
      />
    </AdminLayout>
  );
};

export default AdminCartAnalytics;
