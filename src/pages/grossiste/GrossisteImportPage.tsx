import { GrossisteLayout } from "@/components/grossiste/GrossisteLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload } from "lucide-react";

export default function GrossisteImportPage() {
  return (
    <GrossisteLayout title="Importar productos" subtitle="Carga masiva desde Excel o 1688">
      <Card className="max-w-2xl">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="w-4 h-4" />Importación masiva</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Próximamente: el flujo de importación de Excel y 1688 estará disponible aquí, idéntico al del panel admin pero con tus productos asignados automáticamente como mayorista.</p>
          <p>Mientras tanto, puedes crear productos individualmente desde <strong>Mis Productos B2B</strong>.</p>
        </CardContent>
      </Card>
    </GrossisteLayout>
  );
}
