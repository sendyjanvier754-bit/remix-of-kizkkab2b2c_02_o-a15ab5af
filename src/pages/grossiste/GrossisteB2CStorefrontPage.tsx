import { GrossisteLayout } from "@/components/grossiste/GrossisteLayout";
import { useGrossisteProfile } from "@/hooks/useGrossisteProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function GrossisteB2CStorefrontPage() {
  const { profile, update } = useGrossisteProfile();

  return (
    <GrossisteLayout title="Tienda B2C" subtitle="Vende también al público (opcional)">
      <Card className="max-w-2xl">
        <CardHeader><CardTitle className="text-base">Activar tienda al público</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 border border-border rounded-lg">
            <div>
              <Label className="text-sm font-medium">Tienda B2C habilitada</Label>
              <p className="text-xs text-muted-foreground mt-1">Tus productos aprobados también serán visibles al público en el marketplace minorista.</p>
            </div>
            <Switch
              checked={profile?.enable_b2c_storefront || false}
              onCheckedChange={(checked) => update.mutate({ enable_b2c_storefront: checked })}
              disabled={profile?.verification_status !== 'verified'}
            />
          </div>
          {profile?.verification_status !== 'verified' && (
            <p className="text-xs text-amber-600">Necesitas estar verificado para activar la tienda B2C.</p>
          )}
        </CardContent>
      </Card>
    </GrossisteLayout>
  );
}
