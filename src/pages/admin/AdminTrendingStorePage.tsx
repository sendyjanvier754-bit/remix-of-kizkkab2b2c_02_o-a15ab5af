import { AdminLayout } from "@/components/admin/AdminLayout";
import { FeaturedTrendingStorePanel } from "@/components/trends/FeaturedTrendingStorePanel";
import { SponsoredProductsManager } from "@/components/trends/SponsoredProductsManager";

const AdminTrendingStorePage = () => (
  <AdminLayout
    title="Kizkka Ads"
    subtitle="Publicidad del mercado: productos patrocinados y tiendas destacadas"
  >
    <div className="space-y-6">
      <SponsoredProductsManager />
      <FeaturedTrendingStorePanel canEdit />
    </div>
  </AdminLayout>
);

export default AdminTrendingStorePage;
