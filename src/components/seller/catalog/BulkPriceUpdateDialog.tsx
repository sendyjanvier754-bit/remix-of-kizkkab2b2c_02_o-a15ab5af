import { useState, useMemo, useRef } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Percent, Table2, Upload, ArrowUp, ArrowDown, Loader2, Download, AlertCircle, TrendingUp } from 'lucide-react';
import { BulkPriceItem, useBulkPriceUpdate } from '@/hooks/useBulkPriceUpdate';
import { ProductoConVariantes } from '@/hooks/useSellerCatalog';
import * as XLSX from 'xlsx';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productos: ProductoConVariantes[];
  storeId: string | null;
  onSuccess: () => void;
}

export function BulkPriceUpdateDialog({ open, onOpenChange, productos, storeId, onSuccess }: Props) {
  const [tab, setTab] = useState('percentage');
  const [percentage, setPercentage] = useState(10);
  const [mode, setMode] = useState<'increase' | 'decrease'>('increase');
  const [inlineItems, setInlineItems] = useState<BulkPriceItem[]>([]);
  const [csvData, setCsvData] = useState<Array<{ sku: string; precio: number }>>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [bpPreview, setBpPreview] = useState<Array<{ id: string; sku: string; nombre: string; precioActual: number; pvpSugerido: number }>>([]);
  const [bpLoading, setBpLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { isUpdating, applyPercentageAdjustment, applyInlineEdits, applyFromCSV, applyBusinessPanelPrices, fetchBusinessPanelPreview } = useBulkPriceUpdate(storeId);

  // Flatten all variants into BulkPriceItems
  const allItems = useMemo<BulkPriceItem[]>(() => {
    return productos.flatMap(p =>
      p.variantes.map(v => ({
        id: v.id,
        sku: v.sku,
        nombre: v.nombre,
        precioActual: v.precioVenta,
        precioNuevo: v.precioVenta,
        precioCosto: v.precioCosto,
        sourceProductId: v.sourceProductId,
      }))
    );
  }, [productos]);

  // Initialize inline items when tab switches
  const handleTabChange = async (value: string) => {
    setTab(value);
    if (value === 'inline') {
      setInlineItems(allItems.map(i => ({ ...i })));
    }
    if (value === 'business') {
      setBpLoading(true);
      const preview = await fetchBusinessPanelPreview(allItems);
      setBpPreview(preview);
      setBpLoading(false);
    }
  };

  // Preview percentage changes
  const previewItems = useMemo(() => {
    const multiplier = mode === 'increase' ? 1 + percentage / 100 : 1 - percentage / 100;
    return allItems.slice(0, 5).map(i => ({
      ...i,
      precioNuevo: Math.max(0, Math.round(i.precioActual * multiplier * 100) / 100),
    }));
  }, [allItems, percentage, mode]);

  const handlePercentageApply = async () => {
    const ok = await applyPercentageAdjustment(allItems, percentage, mode);
    if (ok) { onSuccess(); onOpenChange(false); }
  };

  const handleBusinessPanelApply = async () => {
    const result = await applyBusinessPanelPrices(allItems);
    if (result.success) { onSuccess(); onOpenChange(false); }
  };

  const handleInlineApply = async () => {
    const ok = await applyInlineEdits(inlineItems);
    if (ok) { onSuccess(); onOpenChange(false); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

        const parsed: Array<{ sku: string; precio: number }> = [];
        for (const row of json) {
          const sku = String(row['SKU'] || row['sku'] || row['Sku'] || '').trim();
          const precio = parseFloat(row['Precio'] || row['precio'] || row['Price'] || row['price'] || 0);
          if (sku && !isNaN(precio) && precio >= 0) {
            parsed.push({ sku, precio });
          }
        }
        setCsvData(parsed);
        if (parsed.length === 0) {
          setCsvData([]);
        }
      } catch {
        setCsvData([]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleCsvApply = async () => {
    const ok = await applyFromCSV(csvData, allItems);
    if (ok) { onSuccess(); onOpenChange(false); }
  };

  const handleDownloadTemplate = () => {
    const templateData = allItems.map(i => ({ SKU: i.sku, Nombre: i.nombre, Precio: i.precioActual }));
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Precios');
    XLSX.writeFile(wb, 'plantilla_precios.xlsx');
  };

  const updateInlinePrice = (id: string, value: number) => {
    setInlineItems(prev => prev.map(i => i.id === id ? { ...i, precioNuevo: value } : i));
  };

  const changedCount = inlineItems.filter(i => i.precioNuevo !== i.precioActual).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">Actualización Masiva de Precios</DialogTitle>
          <DialogDescription>
            Actualiza los precios de venta de {allItems.length} variantes en tu catálogo
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="percentage" className="gap-1.5 text-xs sm:text-sm">
              <Percent className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Porcentaje</span><span className="sm:hidden">%</span>
            </TabsTrigger>
            <TabsTrigger value="business" className="gap-1.5 text-xs sm:text-sm">
              <TrendingUp className="h-3.5 w-3.5" /> <span className="hidden sm:inline">PVP Sugerido</span><span className="sm:hidden">PVP</span>
            </TabsTrigger>
            <TabsTrigger value="inline" className="gap-1.5 text-xs sm:text-sm">
              <Table2 className="h-3.5 w-3.5" /> Tabla
            </TabsTrigger>
            <TabsTrigger value="csv" className="gap-1.5 text-xs sm:text-sm">
              <Upload className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Excel/CSV</span><span className="sm:hidden">CSV</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Percentage */}
          <TabsContent value="percentage" className="flex-1 overflow-auto space-y-4 mt-4">
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={mode === 'increase' ? 'default' : 'outline'}
                  onClick={() => setMode('increase')}
                  className="gap-1"
                >
                  <ArrowUp className="h-3.5 w-3.5" /> Subir
                </Button>
                <Button
                  size="sm"
                  variant={mode === 'decrease' ? 'destructive' : 'outline'}
                  onClick={() => setMode('decrease')}
                  className="gap-1"
                >
                  <ArrowDown className="h-3.5 w-3.5" /> Bajar
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={200}
                  value={percentage}
                  onChange={e => setPercentage(Math.max(0, Number(e.target.value)))}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground font-medium">%</span>
              </div>
            </div>

            <div className="rounded-md border">
              <div className="grid grid-cols-4 gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                <span>SKU</span>
                <span>Nombre</span>
                <span className="text-right">Actual</span>
                <span className="text-right">Nuevo</span>
              </div>
              {previewItems.map(item => (
                <div key={item.id} className="grid grid-cols-4 gap-2 px-3 py-2 border-t text-sm">
                  <span className="truncate font-mono text-xs">{item.sku}</span>
                  <span className="truncate">{item.nombre}</span>
                  <span className="text-right">${item.precioActual.toFixed(2)}</span>
                  <span className={`text-right font-medium ${mode === 'increase' ? 'text-emerald-600' : 'text-red-500'}`}>
                    ${item.precioNuevo.toFixed(2)}
                  </span>
                </div>
              ))}
              {allItems.length > 5 && (
                <div className="px-3 py-2 border-t text-xs text-muted-foreground text-center">
                  ... y {allItems.length - 5} más
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handlePercentageApply} disabled={isUpdating || allItems.length === 0}>
                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Aplicar a {allItems.length} variantes
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* TAB 2: Business Panel PVP */}
          <TabsContent value="business" className="flex-1 overflow-auto space-y-4 mt-4">
            <Alert className="border-primary/30 bg-primary/5">
              <TrendingUp className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm">
                Actualiza todos los precios de tu tienda al <strong>PVP Sugerido</strong> calculado en el Business Panel 
                (basado en precio B2B + logística + markup de categoría).
              </AlertDescription>
            </Alert>

            {bpLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
                <span className="text-sm text-muted-foreground">Cargando precios sugeridos...</span>
              </div>
            ) : bpPreview.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No se encontraron precios sugeridos para tus productos.
              </div>
            ) : (
              <div className="rounded-md border max-h-[300px] overflow-auto">
                <div className="grid grid-cols-4 gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground sticky top-0">
                  <span>SKU</span>
                  <span>Nombre</span>
                  <span className="text-right">Actual</span>
                  <span className="text-right">PVP Sugerido</span>
                </div>
                {bpPreview.map(item => (
                  <div key={item.id} className="grid grid-cols-4 gap-2 px-3 py-2 border-t text-sm">
                    <span className="truncate font-mono text-xs">{item.sku}</span>
                    <span className="truncate">{item.nombre}</span>
                    <span className="text-right text-muted-foreground">${item.precioActual.toFixed(2)}</span>
                    <span className="text-right font-medium text-primary">
                      ${item.pvpSugerido.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleBusinessPanelApply} disabled={isUpdating || bpPreview.length === 0}>
                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Aplicar PVP a {bpPreview.length} variantes
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* TAB 3: Inline Table */}
          <TabsContent value="inline" className="flex-1 overflow-hidden flex flex-col mt-4">
            <ScrollArea className="flex-1 max-h-[400px] rounded-md border">
              <div className="grid grid-cols-[1fr_1.5fr_80px_100px] gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground sticky top-0">
                <span>SKU</span>
                <span>Nombre</span>
                <span className="text-right">Actual</span>
                <span className="text-right">Nuevo $</span>
              </div>
              {inlineItems.map(item => (
                <div key={item.id} className="grid grid-cols-[1fr_1.5fr_80px_100px] gap-2 px-3 py-1.5 border-t items-center text-sm">
                  <span className="truncate font-mono text-xs">{item.sku}</span>
                  <span className="truncate">{item.nombre}</span>
                  <span className="text-right text-muted-foreground">${item.precioActual.toFixed(2)}</span>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.precioNuevo}
                    onChange={e => updateInlinePrice(item.id, Number(e.target.value))}
                    className="h-7 text-right text-sm"
                  />
                </div>
              ))}
            </ScrollArea>
            {changedCount > 0 && (
              <Badge variant="secondary" className="mt-2 self-start">
                {changedCount} cambio{changedCount > 1 ? 's' : ''} pendiente{changedCount > 1 ? 's' : ''}
              </Badge>
            )}
            <DialogFooter className="mt-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleInlineApply} disabled={isUpdating || changedCount === 0}>
                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Guardar {changedCount} cambio{changedCount > 1 ? 's' : ''}
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* TAB 3: CSV/Excel */}
          <TabsContent value="csv" className="flex-1 overflow-auto space-y-4 mt-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Descargar Plantilla
                </Button>
                <span className="text-xs text-muted-foreground">
                  Columnas requeridas: SKU, Precio
                </span>
              </div>

              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {csvFileName || 'Haz clic o arrastra un archivo .xlsx o .csv'}
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            </div>

            {csvData.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {csvData.length} filas detectadas en <strong>{csvFileName}</strong>
                </AlertDescription>
              </Alert>
            )}

            {csvData.length > 0 && (
              <div className="rounded-md border max-h-[200px] overflow-auto">
                <div className="grid grid-cols-2 gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground sticky top-0">
                  <span>SKU</span>
                  <span className="text-right">Precio</span>
                </div>
                {csvData.slice(0, 10).map((row, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 px-3 py-1.5 border-t text-sm">
                    <span className="font-mono text-xs">{row.sku}</span>
                    <span className="text-right">${row.precio.toFixed(2)}</span>
                  </div>
                ))}
                {csvData.length > 10 && (
                  <div className="px-3 py-2 border-t text-xs text-muted-foreground text-center">
                    ... y {csvData.length - 10} más
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleCsvApply} disabled={isUpdating || csvData.length === 0}>
                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Importar {csvData.length} precios
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
