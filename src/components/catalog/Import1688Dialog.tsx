import { useState, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileSpreadsheet, Download, Check, Loader2, ArrowRight, AlertCircle, Package, Settings2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { GroupedProduct, VariantRow, DetectedAttribute } from "@/hooks/useSmartProductGrouper";
import { groupProductsByParent } from "@/hooks/useSmartProductGrouper";
import { detectAttributeType, parseColorToHex } from "@/hooks/useEAVAttributes";

interface Import1688DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmImport?: (groupedProducts: GroupedProduct[]) => void;
}

interface RawRow {
  [key: string]: string;
}

interface ProcessedRow {
  product_id: string;
  sku_interno: string;
  nombre: string;
  nombre_original: string;
  url_producto: string;
  proveedor: string;
  variante_1_color: string;
  variante_2_talla: string;
  descripcion_corta: string;
  costo: string;
  moq: number;
  stock: string;
  url_imagen: string;
}

interface Grouped1688Product {
  productId: string;
  parentName: string;
  parentNameOriginal: string;
  description: string;
  url: string;
  variants: ProcessedRow[];
}

interface ColumnMapping {
  sku_interno: string;
  nombre: string;
  costo: string;
  stock: string;
  url_imagen: string;
  url_producto: string;
}

type Step = "upload" | "mapping" | "preview" | "export";

const BATCH_SIZE = 15;

const MAPPING_FIELDS: { key: keyof ColumnMapping; label: string; keywords: string[] }[] = [
  { key: "sku_interno", label: "SKU Interno", keywords: ["SKU ID", "ID", "商品ID", "id"] },
  { key: "nombre", label: "Título Original", keywords: ["Nombre del SKU", "标题", "Title", "título", "商品标题"] },
  { key: "costo", label: "Costo", keywords: ["PrecioCalculado2", "Precio calculado2", "Precio_calculado2", "Precio calculado", "价格", "Price", "precio"] },
  { key: "stock", label: "Stock", keywords: ["Inventario", "库存", "Stock", "stock", "存量"] },
  { key: "url_imagen", label: "URL Imagen", keywords: ["Imagen SKU", "SKU图", "图片", "Image", "imagen", "Img"] },
  { key: "url_producto", label: "URL Producto", keywords: ["Product_Url", "Product_URL", "URL", "url", "链接", "link"] },
];

const autoDetect = (headers: string[], keywords: string[]): string => {
  // Pass 1: exact match (priority order from keywords)
  for (const k of keywords) {
    const match = headers.find((h) => h.toLowerCase() === k.toLowerCase());
    if (match) return match;
  }
  // Pass 2: partial match
  for (const k of keywords) {
    const match = headers.find((h) => h.toLowerCase().includes(k.toLowerCase()));
    if (match) return match;
  }
  return "";
};

const Import1688Dialog = ({ open, onOpenChange, onConfirmImport }: Import1688DialogProps) => {
  const [step, setStep] = useState<Step>("upload");
  const [rawData, setRawData] = useState<RawRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    sku_interno: "", nombre: "", costo: "", stock: "", url_imagen: "", url_producto: "",
  });
  const [processedData, setProcessedData] = useState<ProcessedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [translatedFileTitle, setTranslatedFileTitle] = useState("");
  const [cleanFileTitle, setCleanFileTitle] = useState("");
  const [translationProgress, setTranslationProgress] = useState({ current: 0, total: 0 });

  const resetState = () => {
    setStep("upload");
    setRawData([]);
    setHeaders([]);
    setColumnMapping({ sku_interno: "", nombre: "", costo: "", stock: "", url_imagen: "", url_producto: "" });
    setProcessedData([]);
    setIsProcessing(false);
    setHasDownloaded(false);
    setFileName("");
    setTranslationProgress({ current: 0, total: 0 });
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) resetState();
    onOpenChange(newOpen);
  };

  const parseFile = async (file: File) => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array", raw: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: RawRow[] = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: "" });
    return rows;
  };

  // Step 1 → Step 2: Parse file and auto-detect columns
  const handleFile = async (file: File) => {
    setFileName(file.name);
    // Clean file name to extract product title
    const cleaned = file.name
      .replace(/\.(csv|xlsx?|tsv)$/i, "")
      .replace(/_?\d{10,}_sku_list$/i, "")
      .replace(/_/g, " ")
      .trim();
    setCleanFileTitle(cleaned);
    setTranslatedFileTitle(cleaned); // temporary until translated
    setIsProcessing(true);
    try {
      const rows = await parseFile(file);
      if (rows.length === 0) {
        toast.error("El archivo está vacío");
        setIsProcessing(false);
        return;
      }
      setRawData(rows);
      const detectedHeaders = Object.keys(rows[0]);
      setHeaders(detectedHeaders);

      // Auto-detect mapping suggestions
      const autoMap: ColumnMapping = {
        sku_interno: autoDetect(detectedHeaders, MAPPING_FIELDS[0].keywords),
        nombre: autoDetect(detectedHeaders, MAPPING_FIELDS[1].keywords),
        costo: autoDetect(detectedHeaders, MAPPING_FIELDS[2].keywords),
        stock: autoDetect(detectedHeaders, MAPPING_FIELDS[3].keywords),
        url_imagen: autoDetect(detectedHeaders, MAPPING_FIELDS[4].keywords),
        url_producto: autoDetect(detectedHeaders, MAPPING_FIELDS[5].keywords),
      };
      setColumnMapping(autoMap);
      setStep("mapping");
      toast.success(`${rows.length} filas detectadas. Configura el mapeo de columnas.`);
    } catch (err) {
      console.error("File processing error:", err);
      toast.error("Error al procesar el archivo");
    } finally {
      setIsProcessing(false);
    }
  };

  // Step 2 → Step 3: Process rows with user mapping and translate
  const processAndTranslate = async () => {
    setIsProcessing(true);
    try {
      const cols = columnMapping;

      // Detect variant columns: columns NOT mapped to any standard field
      const mappedCols = new Set(Object.values(cols).filter(Boolean));
      const variantHeaders = headers.filter(h => !mappedCols.has(h));

      // Detect which variant columns look like color vs size
      let colorCol = "";
      let sizeCol = "";
      for (const vh of variantHeaders) {
        const lower = vh.toLowerCase();
        if (!colorCol && (lower.includes("color") || lower.includes("颜色") || lower.includes("规格1") || lower.includes("variant1"))) {
          colorCol = vh;
        } else if (!sizeCol && (lower.includes("talla") || lower.includes("size") || lower.includes("尺码") || lower.includes("尺寸") || lower.includes("规格2") || lower.includes("variant2"))) {
          sizeCol = vh;
        }
      }
      // Fallback: first two unmapped non-standard columns
      const remainingVariants = variantHeaders.filter(v => v !== colorCol && v !== sizeCol);
      if (!colorCol && remainingVariants.length > 0) colorCol = remainingVariants.shift() || "";
      if (!sizeCol && remainingVariants.length > 0) sizeCol = remainingVariants.shift() || "";

      const processed: ProcessedRow[] = rawData.map((row) => {
        const id = row[cols.sku_interno] || "";
        const v1 = colorCol ? (row[colorCol] || "") : "";
        const v2 = sizeCol ? (row[sizeCol] || "") : "";

        const skuParts = [id, v1, v2].filter(Boolean);
        const sku = skuParts.join("-").replace(/\s+/g, "").slice(0, 50);

        return {
          product_id: id,
          sku_interno: sku,
          nombre: (row[cols.nombre] || "").replace(/_/g, " ").trim(),
          nombre_original: (row[cols.nombre] || "").replace(/_/g, " ").trim(),
          url_producto: row[cols.url_producto] || "",
          proveedor: "1688",
          variante_1_color: v1,
          variante_2_talla: v2,
          descripcion_corta: "",
          costo: (row[cols.costo] || "0").toString().replace(/[^0-9.]/g, "") || "0",
          moq: 3,
          stock: row[cols.stock] || "0",
          url_imagen: row[cols.url_imagen] || "",
        };
      });

      setProcessedData(processed);
      setStep("preview");

      // Translate file title first (as an extra item in first batch)
      try {
        const { data: titleData } = await supabase.functions.invoke("process-1688-import", {
          body: { items: [{ title: cleanFileTitle }] },
        });
        const titleTranslation = titleData?.translations?.[0];
        if (titleTranslation?.nombre) {
          setTranslatedFileTitle(titleTranslation.nombre);
        }
      } catch (err) {
        console.warn("File title translation failed:", err);
      }

      // Translate in batches
      const total = processed.length;
      setTranslationProgress({ current: 0, total });

      for (let i = 0; i < total; i += BATCH_SIZE) {
        await translateBatch(processed, i);
        setTranslationProgress({ current: Math.min(i + BATCH_SIZE, total), total });
      }

      toast.success(`${processed.length} variantes procesadas`);
    } catch (err) {
      console.error("Processing error:", err);
      toast.error("Error al procesar");
    } finally {
      setIsProcessing(false);
    }
  };

  // Group processed rows by product_id (same 1688 ID = same product)
  const groupedProducts = useMemo((): Grouped1688Product[] => {
    const groups: Record<string, Grouped1688Product> = {};

    processedData.forEach((row) => {
      const key = row.product_id || row.sku_interno;
      if (!groups[key]) {
        groups[key] = {
          productId: key,
          parentName: row.nombre,
          parentNameOriginal: row.nombre_original,
          description: row.descripcion_corta,
          url: row.url_producto,
          variants: [],
        };
      }
      groups[key].variants.push(row);
      if (row.nombre && row.nombre !== row.nombre_original) {
        groups[key].parentName = row.nombre;
      }
      if (row.descripcion_corta) {
        groups[key].description = row.descripcion_corta;
      }
    });

    return Object.values(groups);
  }, [processedData]);

  const translateBatch = async (items: ProcessedRow[], startIdx: number): Promise<void> => {
    const batchItems = items.slice(startIdx, startIdx + BATCH_SIZE).map((row) => ({
      title: row.nombre_original,
      variant1: row.variante_1_color || undefined,
      variant2: row.variante_2_talla || undefined,
    }));

    try {
      const { data, error } = await supabase.functions.invoke("process-1688-import", {
        body: { items: batchItems },
      });

      if (error) {
        console.error("Translation batch error:", error);
        toast.error("Error en traducción de lote");
        return;
      }

      const translations = data?.translations || [];

      setProcessedData((prev) => {
        const updated = [...prev];
        for (const t of translations) {
          const idx = startIdx + (t.index - 1);
          if (updated[idx]) {
            updated[idx] = {
              ...updated[idx],
              nombre: t.nombre || updated[idx].nombre,
              variante_1_color: t.variante_color || updated[idx].variante_1_color,
              variante_2_talla: t.variante_talla || updated[idx].variante_2_talla,
              descripcion_corta: t.descripcion || "",
            };
          }
        }
        return updated;
      });
    } catch (err) {
      console.error("Translation error:", err);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    []
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const downloadExcel = () => {
    const exportData = processedData.map((row) => ({
      SKU_Interno: row.sku_interno,
      Nombre: row.nombre,
      URL_Producto: row.url_producto,
      Proveedor: row.proveedor,
      Variante_1_Color: row.variante_1_color,
      Variante_2_Talla: row.variante_2_talla,
      Descripcion_Corta: row.descripcion_corta,
      Costo: row.costo,
      MOQ: row.moq,
      Stock: row.stock,
      URL_Imagen_Origen: row.url_imagen,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Productos_1688");
    XLSX.writeFile(wb, `1688_procesado_${new Date().toISOString().split("T")[0]}.xlsx`);

    setHasDownloaded(true);
    setStep("export");
    toast.success("Excel descargado correctamente");
  };

  // Build GroupedProduct[] for SmartBulkImportDialog
  const buildGroupedProducts = (): GroupedProduct[] => {
    return groupedProducts.map((group) => {
      const colorValues = new Set<string>();
      const colorImageMap: Record<string, string> = {};
      const sizeValues = new Set<string>();

      group.variants.forEach((v) => {
        if (v.variante_1_color) {
          colorValues.add(v.variante_1_color);
          if (v.url_imagen && !colorImageMap[v.variante_1_color]) {
            colorImageMap[v.variante_1_color] = v.url_imagen;
          }
        }
        if (v.variante_2_talla) sizeValues.add(v.variante_2_talla);
      });

      const detectedAttributes: DetectedAttribute[] = [];

      if (colorValues.size > 0) {
        detectedAttributes.push({
          columnName: "color",
          attributeName: "color",
          type: "color",
          renderType: "swatches",
          categoryHint: "",
          uniqueValues: colorValues,
          valueImageMap: colorImageMap,
        });
      }

      if (sizeValues.size > 0) {
        detectedAttributes.push({
          columnName: "talla",
          attributeName: "talla",
          type: "size",
          renderType: "chips",
          categoryHint: "",
          uniqueValues: sizeValues,
          valueImageMap: {},
        });
      }

      const variants: VariantRow[] = group.variants.map((v) => ({
        originalRow: {},
        sku: v.sku_interno,
        name: v.nombre,
        costBase: parseFloat(v.costo) || 0,
        stock: parseInt(v.stock) || 0,
        moq: v.moq,
        imageUrl: v.url_imagen,
        sourceUrl: v.url_producto,
        attributeValues: {
          ...(v.variante_1_color ? { color: v.variante_1_color } : {}),
          ...(v.variante_2_talla ? { talla: v.variante_2_talla } : {}),
        },
      }));

      return {
        groupKey: group.productId,
        parentName: translatedFileTitle || group.parentName,
        baseSku: group.productId,
        supplier: "1688",
        description: group.description,
        variants,
        detectedAttributes,
      };
    });
  };

  const handleConfirmImport = () => {
    const grouped = buildGroupedProducts();
    handleOpenChange(false);
    onConfirmImport?.(grouped);
  };

  const isMappingValid = columnMapping.sku_interno && columnMapping.nombre && columnMapping.costo;

  const stepLabel = step === "upload" ? "Paso 1/4" : step === "mapping" ? "Paso 2/4" : step === "preview" ? "Paso 3/4" : "Paso 4/4";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar desde 1688
            <Badge variant="secondary" className="text-xs">
              {stepLabel}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {isProcessing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground">Procesando {fileName}...</p>
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-foreground mb-2">
                  Arrastra tu archivo de 1688 aquí
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Soporta archivos Excel (.xlsx, .xls) y CSV
                </p>
                <label>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleFileInput}
                  />
                  <Button variant="outline" asChild>
                    <span>Seleccionar archivo</span>
                  </Button>
                </label>
              </>
            )}
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === "mapping" && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Settings2 className="h-4 w-4" />
              <span>Mapea cada campo de Kizkka a la columna correspondiente del archivo <strong className="text-foreground">{fileName}</strong></span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {MAPPING_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    {field.label}
                    {(field.key === "sku_interno" || field.key === "nombre" || field.key === "costo") && (
                      <span className="text-destructive ml-1">*</span>
                    )}
                  </label>
                  <Select
                    value={columnMapping[field.key] || "__none__"}
                    onValueChange={(val) =>
                      setColumnMapping((prev) => ({ ...prev, [field.key]: val === "__none__" ? "" : val }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar columna..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Sin mapear —</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {columnMapping[field.key] && (
                    <p className="text-xs text-muted-foreground">
                      Preview: <span className="font-mono">{rawData[0]?.[columnMapping[field.key]] || "—"}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Show detected unmapped columns as potential variant attributes */}
            {(() => {
              const mappedCols = new Set(Object.values(columnMapping).filter(Boolean));
              const unmapped = headers.filter(h => !mappedCols.has(h));
              if (unmapped.length === 0) return null;
              return (
                <div className="border rounded-md p-3 bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Columnas no mapeadas (se usarán como variantes automáticamente):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {unmapped.map((col) => (
                      <Badge key={col} variant="outline" className="text-xs">
                        {col}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-between items-center pt-2">
              <Button variant="ghost" onClick={() => setStep("upload")}>
                Volver
              </Button>
              <Button
                onClick={processAndTranslate}
                disabled={!isMappingValid || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    Continuar
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Preview - Grouped by product */}
        {step === "preview" && (
          <div className="flex flex-col flex-1 min-h-0 gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  <Package className="h-3 w-3 mr-1" />
                  {groupedProducts.length} producto{groupedProducts.length !== 1 ? "s" : ""}
                </Badge>
                <Badge variant="secondary">
                  {processedData.length} variantes
                </Badge>
                {isProcessing && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Traduciendo... {translationProgress.current}/{translationProgress.total}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setStep("mapping")}>
                  Volver al mapeo
                </Button>
                <Button onClick={downloadExcel} disabled={isProcessing}>
                  <Download className="h-4 w-4 mr-2" />
                  Descargar Excel Procesado
                </Button>
              </div>
            </div>

            <div className="overflow-auto flex-1 border rounded-md">
              {groupedProducts.map((group, gi) => (
                <div key={group.productId} className={gi > 0 ? "border-t-2 border-primary/20" : ""}>
                  {/* Product header */}
                  <div className="px-4 py-3 bg-muted/30 flex items-center gap-3">
                    {group.variants[0]?.url_imagen && (
                      <img
                        src={group.variants[0].url_imagen}
                        alt=""
                        className="h-10 w-10 rounded object-cover flex-shrink-0"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{translatedFileTitle || group.parentName}</p>
                      <p className="text-xs text-muted-foreground">
                        ID: {group.productId} · {group.variants.length} variante{group.variants.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  {/* Variants table */}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Img</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Título Producto</TableHead>
                        <TableHead>Nombre SKU</TableHead>
                        <TableHead>Talla</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Costo</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.variants.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            {row.url_imagen ? (
                              <img
                                src={row.url_imagen}
                                alt=""
                                className="h-8 w-8 rounded object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="h-8 w-8 rounded bg-muted" />
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs max-w-[120px] truncate">
                            {row.sku_interno}
                          </TableCell>
                          <TableCell className="max-w-[150px] text-xs" title={translatedFileTitle || group.parentName}>
                            <span className="line-clamp-2">{translatedFileTitle || group.parentName}</span>
                          </TableCell>
                          <TableCell className="max-w-[150px] text-xs" title={row.nombre}>
                            <span className="line-clamp-2">{row.nombre}</span>
                          </TableCell>
                          <TableCell>{row.variante_2_talla}</TableCell>
                          <TableCell className="max-w-[250px] text-xs text-muted-foreground" title={row.descripcion_corta}>
                            <span className="line-clamp-2">{row.descripcion_corta}</span>
                          </TableCell>
                          <TableCell className="text-right font-medium">{row.costo}</TableCell>
                          <TableCell className="text-right">{row.stock}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Export & Confirm */}
        {step === "export" && (
          <div className="flex flex-col items-center gap-6 py-8">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <Check className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Excel descargado correctamente
                </h3>
                <p className="text-sm text-muted-foreground">
                  Revisa el archivo y si todo está correcto continúa con la importación
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-4 rounded-lg bg-muted/50 border">
              <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                Se importarán {groupedProducts.length} producto{groupedProducts.length !== 1 ? "s" : ""} con {processedData.length} variantes en total.
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={downloadExcel}>
                <Download className="h-4 w-4 mr-2" />
                Descargar de nuevo
              </Button>
              <Button onClick={handleConfirmImport}>
                <ArrowRight className="h-4 w-4 mr-2" />
                Confirmar e Importar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default Import1688Dialog;
