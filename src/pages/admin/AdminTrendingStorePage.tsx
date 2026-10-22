import { DollarSign, LayoutGrid, Megaphone, Newspaper, Store, TrendingUp } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeaturedTrendingStorePanel } from "@/components/trends/FeaturedTrendingStorePanel";
import { SponsoredProductsManager, statusOf, PLACEMENT_LABEL } from "@/components/trends/SponsoredProductsManager";
import { useAdminSponsoredPlacements, type SponsoredPlacementType } from "@/hooks/useSponsoredPlacements";

const SPACES: { key: SponsoredPlacementType; icon: typeof LayoutGrid; where: string; detail: string }[] = [
  { key: "category", icon: LayoutGrid, where: "Franja superior de cada categoría", detail: "Se ve antes de la lista de productos. Puede apuntar a una categoría o a todas." },
  { key: "trends", icon: TrendingUp, where: "Página de Tendencias", detail: "Productos en el módulo destacado de Tendencias." },
  { key: "news", icon: Newspaper, where: "Portal de Noticias", detail: "Barra lateral de la portada y bloque dentro de cada artículo." },
];

const Kpi = ({ icon: Icon, label, value, hint }: { icon: typeof Megaphone; label: string; value: string | number; hint?: string }) => (
  <div className="rounded-lg border bg-card p-4">
    <div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4" />{label}</div>
    <p className="mt-2 text-2xl font-bold">{value}</p>
    {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
  </div>
);

const AdminTrendingStorePage = () => {
  const ads = useAdminSponsoredPlacements();
  const active = ads.rows.filter((r) => statusOf(r) === "Activo");
  const revenue = ads.rows.reduce((t, r) => t + Number(r.amount_paid || 0), 0);
  const countBy = (p: SponsoredPlacementType) => active.filter((r) => r.placement === p).length;
  const expiringSoon = active.filter((r) => r.ends_at && new Date(r.ends_at).getTime() - Date.now() < 3 * 86_400_000).length;

  return (
    <AdminLayout title="Kizkka Ads" subtitle="Publicidad del mercado: campañas de productos y tiendas destacadas">
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={Megaphone} label="Campañas activas" value={active.length} hint={`${ads.rows.length} en total`} />
          <Kpi icon={DollarSign} label="Ingresos registrados" value={`$${revenue.toFixed(2)}`} hint="Suma de montos pagados" />
          <Kpi icon={LayoutGrid} label="Por ubicación" value={`${countBy("category")} · ${countBy("trends")} · ${countBy("news")}`} hint="Categorías · Tendencias · Noticias" />
          <Kpi icon={TrendingUp} label="Por vencer (3 días)" value={expiringSoon} hint="Extiéndelas desde la tabla" />
        </div>

        <Tabs defaultValue="campaigns">
          <TabsList>
            <TabsTrigger value="campaigns"><Megaphone className="mr-1.5 h-4 w-4" />Campañas de productos</TabsTrigger>
            <TabsTrigger value="stores"><Store className="mr-1.5 h-4 w-4" />Tiendas destacadas</TabsTrigger>
            <TabsTrigger value="spaces"><LayoutGrid className="mr-1.5 h-4 w-4" />Espacios publicitarios</TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns" className="mt-4">
            <SponsoredProductsManager rows={ads.rows} isLoading={ads.isLoading} extend={ads.extend} toggle={ads.toggle} remove={ads.remove} />
          </TabsContent>

          <TabsContent value="stores" className="mt-4">
            <FeaturedTrendingStorePanel canEdit />
          </TabsContent>

          <TabsContent value="spaces" className="mt-4">
            <p className="mb-3 text-sm text-muted-foreground">Dónde aparecen los anuncios. Si un espacio no tiene campañas activas, se muestran productos oficiales de Kizkka.</p>
            <div className="grid gap-3 md:grid-cols-3">
              {SPACES.map(({ key, icon: Icon, where, detail }) => (
                <div key={key} className="rounded-lg border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold"><Icon className="h-4 w-4 text-primary" />{PLACEMENT_LABEL[key]}</div>
                    <span className="text-sm text-muted-foreground">{countBy(key)} activas</span>
                  </div>
                  <p className="mt-2 text-sm">{where}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminTrendingStorePage;
