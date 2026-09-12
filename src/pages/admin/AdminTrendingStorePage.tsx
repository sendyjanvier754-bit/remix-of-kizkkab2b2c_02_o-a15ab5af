import { TrendingUp } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { FeaturedTrendingStorePanel } from "@/components/trends/FeaturedTrendingStorePanel";

const AdminTrendingStorePage = () => (
  <AdminLayout
    title="Tienda destacada en Tendencias"
    subtitle="Selecciona la tienda y consulta su actividad pública y comercial"
  >
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-orange-100 p-3">
          <TrendingUp className="h-6 w-6 text-orange-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Configuración de Tendencias</h2>
          <p className="text-sm text-muted-foreground">
            Esta configuración solo está disponible para administración y marketing.
          </p>
        </div>
      </div>
      <FeaturedTrendingStorePanel canEdit />
    </div>
  </AdminLayout>
);

export default AdminTrendingStorePage;
