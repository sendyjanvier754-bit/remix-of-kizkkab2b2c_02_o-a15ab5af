import { useEffect, useState } from 'react';
import { Receipt, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DEFAULT_PROOF_POPUP, PendingProofPopupConfig, ProofPopupFrequency,
  usePendingProofPopupConfig, useSavePendingProofPopupConfig,
} from '@/hooks/usePendingProofPopupConfig';

export const PendingProofPopupSettings = () => {
  const { data } = usePendingProofPopupConfig();
  const save = useSavePendingProofPopupConfig();
  const [cfg, setCfg] = useState<PendingProofPopupConfig>(DEFAULT_PROOF_POPUP);
  useEffect(() => { if (data) setCfg(data); }, [data]);
  const set = <K extends keyof PendingProofPopupConfig>(k: K, v: PendingProofPopupConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));

  return (
    <Card className="border-primary/30">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Receipt className="h-5 w-5" /></span>
          <div>
            <CardTitle className="text-base">Pop-up: pedidos pendientes de pago</CardTitle>
            <CardDescription>Recuerda al cliente subir su comprobante cuando tiene pedidos sin pagar.</CardDescription>
          </div>
        </div>
        <Switch checked={cfg.enabled} onCheckedChange={(v) => set('enabled', v)} />
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Frecuencia</Label>
          <Select value={cfg.frequency} onValueChange={(v) => set('frequency', v as ProofPopupFrequency)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="every_visit">Cada vez que entra a su cuenta</SelectItem>
              <SelectItem value="once_per_session">Una vez por sesión del navegador</SelectItem>
              <SelectItem value="once_per_day">Una vez al día</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Retraso antes de mostrar (segundos)</Label>
          <Input type="number" min={0} max={60} value={cfg.delay_seconds} onChange={(e) => set('delay_seconds', Number(e.target.value) || 0)} />
        </div>
        <div className="space-y-1.5">
          <Label>Título (opcional)</Label>
          <Input placeholder="Vacío = texto traducido automáticamente" value={cfg.title} onChange={(e) => set('title', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Mensaje (opcional)</Label>
          <Textarea rows={2} placeholder="Vacío = texto traducido automáticamente" value={cfg.message} onChange={(e) => set('message', e.target.value)} />
        </div>
        <p className="text-xs text-muted-foreground md:col-span-2">
          Si dejas el título y el mensaje vacíos se mostrarán en el idioma de cada cliente (ES, EN, FR, HT).
        </p>
        <div className="md:col-span-2 flex justify-end">
          <Button
            disabled={save.isPending}
            onClick={() => save.mutate(cfg, {
              onSuccess: () => toast.success('Configuración guardada'),
              onError: (e: any) => toast.error(e.message || 'Error al guardar'),
            })}
          >
            <Save className="h-4 w-4 mr-2" /> Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PendingProofPopupSettings;
