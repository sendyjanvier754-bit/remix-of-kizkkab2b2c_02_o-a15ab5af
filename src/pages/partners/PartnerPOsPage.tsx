import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import PartnerLayout from "@/components/partners/PartnerLayout";
import { POPreviewModal } from "@/components/logistics/POPreviewModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { POBuyingListData } from "@/services/pdfGenerators";

const money = (value: number) => `$${Number(value || 0).toFixed(2)}`;

export default function PartnerPOsPage() {
  const { user } = useAuth();
  const [previewData, setPreviewData] = useState<POBuyingListData | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loadingPoId, setLoadingPoId] = useState<string | null>(null);

  const { data: pos = [], isLoading } = useQuery({
    queryKey: ["partner-zleti-pos", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("master_purchase_orders")
        .select("id, po_number, status, total_items, total_quantity, total_amount, notes, created_at")
        .eq("brand_identity", "zleti")
        .eq("created_by", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const openPreview = async (po: any) => {
    setLoadingPoId(po.id);
    try {
      const { data: items, error } = await (supabase as any)
        .from("zleti_manual_po_items")
        .select("*")
        .eq("po_id", po.id)
        .order("created_at");
      if (error) throw error;

      setPreviewData({
        po_number: po.po_number,
        market_name: "ZleTI México",
        brand_identity: "zleti",
        generated_at: po.created_at,
        items: (items || []).map((item: any) => ({
          sku: item.sku,
          nombre: item.product_name,
          variantName: item.variant_name,
          image: item.image_url,
          cantidad: item.quantity,
          url_origen: item.source_url,
          unit_cost: item.unit_cost,
        })),
      });
      setPreviewOpen(true);
    } catch (error: any) {
      toast.error(error?.message || "No se pudo abrir la vista previa");
    } finally {
      setLoadingPoId(null);
    }
  };

  return (
    <PartnerLayout variant="influencer" title="Mis PO guardados">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Órdenes de compra ZleTI</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : pos.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Todavía no has guardado ninguna PO.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Artículos</TableHead>
                    <TableHead className="text-right">Unidades</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pos.map((po: any) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-medium">{po.po_number}</TableCell>
                      <TableCell>{new Date(po.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">{po.total_items ?? 0}</TableCell>
                      <TableCell className="text-right">{po.total_quantity ?? 0}</TableCell>
                      <TableCell className="text-right">{money(po.total_amount)}</TableCell>
                      <TableCell><Badge variant="secondary">{po.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" disabled={loadingPoId === po.id} onClick={() => openPreview(po)}>
                          {loadingPoId === po.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                          Ver PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <POPreviewModal open={previewOpen} onOpenChange={setPreviewOpen} data={previewData} />
    </PartnerLayout>
  );
}
