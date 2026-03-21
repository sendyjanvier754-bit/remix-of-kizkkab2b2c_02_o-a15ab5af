import { useState, useCallback, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Upload, FileSpreadsheet, Download, Check, Loader2, ArrowRight, AlertCircle, AlertTriangle, Trash2, X, ImageOff, ZoomIn, Pencil, Package, Settings2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { GroupedProduct, VariantRow, DetectedAttribute } from "@/hooks/useSmartProductGrouper";
import { groupProductsByParent } from "@/hooks/useSmartProductGrouper";
import { detectAttributeType, parseColorToHex } from "@/hooks/useEAVAttributes";

interface Import1688DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmImport?: (groupedProducts: GroupedProduct[], processedFile: File) => void;
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
  imagen_principal: string;
}

type Step = "upload" | "mapping" | "preview" | "export";

const BATCH_SIZE = 15;

const MAPPING_FIELDS: { key: keyof ColumnMapping; label: string; keywords: string[] }[] = [
  { key: "sku_interno", label: "SKU Interno", keywords: ["SKU ID", "ID", "商品ID", "id"] },
  { key: "nombre", label: "Título Original", keywords: ["Nombre del SKU", "标题", "Title", "título", "商品标题"] },
  { key: "costo", label: "Costo", keywords: ["PrecioCalculado2", "Precio calculado2", "Precio_calculado2", "Precio calculado", "价格", "Price", "precio"] },
  { key: "stock", label: "Stock", keywords: ["Inventario", "库存", "Stock", "stock", "存量"] },
  { key: "url_imagen", label: "URL Imagen Variante", keywords: ["Imagen SKU", "SKU图", "图片", "Image", "imagen", "Img"] },
  { key: "imagen_principal", label: "Imagen Principal Producto", keywords: ["Imagen_Principal", "imagen_principal", "main_image", "main image", "foto_principal", "product_image"] },
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
    sku_interno: "", nombre: "", costo: "", stock: "", url_imagen: "", imagen_principal: "", url_producto: "",
  });
  const [productMainImage, setProductMainImage] = useState("");
  const [confirmNoMainImage, setConfirmNoMainImage] = useState(false);
  const [heroImageFailed, setHeroImageFailed] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isTranslationDone, setIsTranslationDone] = useState(false);
  const [processedData, setProcessedData] = useState<ProcessedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [translatedFileTitle, setTranslatedFileTitle] = useState("");
  const [cleanFileTitle, setCleanFileTitle] = useState("");
  const [translationProgress, setTranslationProgress] = useState({ current: 0, total: 0 });
  const [manualUrlProducto, setManualUrlProducto] = useState("");
  const [editingVariant, setEditingVariant] = useState<ProcessedRow | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<ProcessedRow>>({});
  const [failedImageSkus, setFailedImageSkus] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setStep("upload");
    setRawData([]);
    setHeaders([]);
    setColumnMapping({ sku_interno: "", nombre: "", costo: "", stock: "", url_imagen: "", imagen_principal: "", url_producto: "" });
    setProcessedData([]);
    setProductMainImage("");
    setConfirmNoMainImage(false);
    setHeroImageFailed(false);
    setIsDownloading(false);
    setIsProcessing(false);
    setHasDownloaded(false);
    setFileName("");
    setTranslationProgress({ current: 0, total: 0 });
    setManualUrlProducto("");
    setEditingVariant(null);
    setEditDraft({});
    setFailedImageSkus(new Set());
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
    // Reset image selection whenever a new file is loaded
    setProductMainImage("");
    setConfirmNoMainImage(false);
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
        imagen_principal: autoDetect(detectedHeaders, MAPPING_FIELDS[5].keywords),
        url_producto: autoDetect(detectedHeaders, MAPPING_FIELDS[6].keywords),
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
          url_producto: row[cols.url_producto] || manualUrlProducto,
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

      // Product-level main image: read from the mapped column of the FIRST row.
      // If the column yields a value it takes precedence; otherwise keep any PC-uploaded
      // image the user already set in the mapping step (don't overwrite with empty string).
      const mainImgFromCol = cols.imagen_principal ? (rawData[0]?.[cols.imagen_principal] || "") : "";
      if (mainImgFromCol) setProductMainImage(mainImgFromCol);

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

      setIsTranslationDone(true);
      toast.success(`${processed.length} variantes procesadas`);
    } catch (err) {
      console.error("Processing error:", err);
      toast.error("Error al procesar");
    } finally {
      setIsProcessing(false);
    }
  };

  // In 1688, each exported file represents ONE parent product whose variants are the rows.
  // The title column often includes per-variant color/size suffixes so we must NOT split
  // by title — the entire file is always treated as a single product group.
  const groupedProducts = useMemo((): Grouped1688Product[] => {
    if (processedData.length === 0) return [];
    const first = processedData[0];
    return [
      {
        productId: first.product_id,
        parentName: first.nombre,
        parentNameOriginal: first.nombre_original,
        description: first.descripcion_corta,
        url: first.url_producto,
        variants: processedData,
      },
    ];
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

  // Upload a data: URL (local PC image) to Supabase Storage and return the public URL.
  const uploadDataUrl = async (dataUrl: string): Promise<string> => {
    try {
      const [meta, b64] = dataUrl.split(',');
      const mimeMatch = meta.match(/data:([^;]+);/);
      const mime = mimeMatch?.[1] || 'image/jpeg';
      const ext = mime.split('/')[1]?.split('+')[0] || 'jpg';
      const byteChars = atob(b64);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArr], { type: mime });
      const fileName = `imports/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('product-images').upload(fileName, blob, { contentType: mime, upsert: false });
      if (error) return '';
      const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
      return data.publicUrl || '';
    } catch {
      return '';
    }
  };

  const buildExcelWorkbook = (resolvedMainImg?: string, resolvedVariantImages?: Record<string, string>) => {
    const mainImgSafe = resolvedMainImg ?? (productMainImage?.startsWith("data:") ? "" : (productMainImage || ""));
    const exportData = processedData.map((row, idx) => {
      const rawUrl = row.url_imagen || "";
      const imageUrl = resolvedVariantImages?.[rawUrl] ?? (rawUrl.startsWith("data:") ? "" : rawUrl);
      return {
        SKU_Interno: row.sku_interno,
        Titulo_Producto: translatedFileTitle || row.nombre,
        Imagen_Principal: idx === 0 ? mainImgSafe : "",
        URL_Producto: row.url_producto,
        Proveedor: row.proveedor,
        Variante_1_Color: row.variante_1_color,
        Variante_2_Talla: row.variante_2_talla,
        Descripcion_Corta: row.descripcion_corta,
        Costo: row.costo,
        MOQ: row.moq,
        Stock: row.stock,
        URL_Imagen_Origen: imageUrl,
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Productos_1688");
    return wb;
  };

  const getExcelFileName = () => {
    const date = new Date().toISOString().split("T")[0];
    const baseName = (translatedFileTitle || cleanFileTitle || '1688_procesado')
      .replace(/[<>:"/\\|?*]/g, '_')
      .substring(0, 100);
    return `${baseName}_${date}.xlsx`;
  };

  const downloadExcel = async () => {
    setIsDownloading(true);
    try {
    const dataUrlsToUpload = new Set<string>();
    if (productMainImage?.startsWith("data:")) dataUrlsToUpload.add(productMainImage);
    processedData.forEach(row => { if (row.url_imagen?.startsWith("data:")) dataUrlsToUpload.add(row.url_imagen); });

    let resolvedMainImg: string | undefined;
    const resolvedVariantImages: Record<string, string> = {};

    if (dataUrlsToUpload.size > 0) {
      toast.info("Subiendo imágenes locales...");
      await Promise.all(
        Array.from(dataUrlsToUpload).map(async (dataUrl) => {
          const publicUrl = await uploadDataUrl(dataUrl);
          if (publicUrl) {
            resolvedVariantImages[dataUrl] = publicUrl;
          }
        })
      );
      if (productMainImage?.startsWith("data:")) {
        resolvedMainImg = resolvedVariantImages[productMainImage] || "";
      }
    }

    const wb = buildExcelWorkbook(resolvedMainImg, resolvedVariantImages);
    XLSX.writeFile(wb, getExcelFileName());

    setHasDownloaded(true);
    setStep("export");
    toast.success("Excel descargado correctamente");
    } finally {
      setIsDownloading(false);
    }
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

      // Product main image: explicit imagen_principal; only if absent use the first variant's image
      const mainImage = productMainImage || group.variants[0]?.url_imagen || "";

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

      // Inject a synthetic "representative" variant that carries the main image.
      // useSmartProductGrouper uses variants[0].imageUrl as imagen_principal.
      // We prepend a copy of the first real variant but override its imageUrl.
      if (mainImage && mainImage !== (variants[0]?.imageUrl || "")) {
        variants.unshift({ ...variants[0], imageUrl: mainImage });
      }

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

  const handleConfirmImport = async () => {
    setIsDownloading(true);
    try {
      // Upload any data: URL images (from PC) to Supabase so they have real public URLs
      const dataUrlsToUpload = new Set<string>();
      if (productMainImage?.startsWith("data:")) dataUrlsToUpload.add(productMainImage);
      processedData.forEach(row => { if (row.url_imagen?.startsWith("data:")) dataUrlsToUpload.add(row.url_imagen); });

      let resolvedMainImg: string | undefined;
      const resolvedVariantImages: Record<string, string> = {};

      if (dataUrlsToUpload.size > 0) {
        toast.info("Subiendo imágenes locales...");
        await Promise.all(
          Array.from(dataUrlsToUpload).map(async (dataUrl) => {
            const publicUrl = await uploadDataUrl(dataUrl);
            if (publicUrl) {
              resolvedVariantImages[dataUrl] = publicUrl;
            }
          })
        );
        if (productMainImage?.startsWith("data:")) {
          resolvedMainImg = resolvedVariantImages[productMainImage] || "";
        }
      }

      const grouped = buildGroupedProducts();
      // Build a File object from the Excel workbook for auto-loading in SmartBulkImportDialog
      const wb = buildExcelWorkbook(resolvedMainImg, resolvedVariantImages);
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const processedFile = new File([blob], getExcelFileName(), { type: blob.type });
      handleOpenChange(false);
      onConfirmImport?.(grouped, processedFile);
    } finally {
      setIsDownloading(false);
    }
  };

  const isMappingValid = columnMapping.sku_interno && columnMapping.nombre && columnMapping.costo && (columnMapping.url_producto || manualUrlProducto) && (columnMapping.imagen_principal || productMainImage || confirmNoMainImage);

  // Validation check for the preview step
  const previewValidation = useMemo(() => {
    if (processedData.length === 0) return { missingImages: 0, missingCost: 0, missingName: 0, hasErrors: false, hasWarnings: false };
    const missingImages = processedData.filter((v) => !v.url_imagen).length;    const missingCost = processedData.filter((v) => !v.costo || parseFloat(v.costo) <= 0).length;
    const missingName = processedData.filter((v) => !v.nombre || !v.nombre.trim()).length;
    return {
      missingImages,
      missingCost,
      missingName,
      // All three block progression — admin must fix or remove the offending variants
      hasErrors: missingCost > 0 || missingName > 0 || missingImages > 0,
      hasWarnings: false,
    };
  }, [processedData]);

  /** Remove a single variant row by its sku_interno */
  const removeProcessedVariant = (sku: string) => {
    setProcessedData((prev) => prev.filter((v) => v.sku_interno !== sku));
  };

  /** Update a single field of a variant by its sku_interno */
  const updateProcessedVariant = (
    sku: string,
    field: keyof ProcessedRow,
    value: string
  ) => {
    if (field === "url_imagen") {
      setFailedImageSkus((prev) => { const n = new Set(prev); n.delete(sku); return n; });
    }
    setProcessedData((prev) =>
      prev.map((v) => (v.sku_interno === sku ? { ...v, [field]: value } : v))
    );
  };

  /** Remove ALL variants that have no url_imagen */
  const removeVariantsWithoutImage = () => {
    setProcessedData((prev) => prev.filter((v) => !!v.url_imagen));
  };

  const openVariantEditor = (row: ProcessedRow) => {
    setEditingVariant(row);
    setEditDraft({ ...row });
  };

  const closeVariantEditor = () => {
    setEditingVariant(null);
    setEditDraft({});
  };

  const saveVariantEdits = () => {
    if (!editingVariant) return;
    (Object.keys(editDraft) as (keyof ProcessedRow)[]).forEach((f) => {
      const val = editDraft[f];
      if (val !== undefined && String(val) !== String(editingVariant[f])) {
        updateProcessedVariant(editingVariant.sku_interno, f, String(val));
      }
    });
    closeVariantEditor();
  };

  const stepLabel = step === "upload" ? "Paso 1/4" : step === "mapping" ? "Paso 2/4" : step === "preview" ? "Paso 3/4" : "Paso 4/4";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar desde 1688
            <Badge variant="secondary" className="text-xs">
              {stepLabel}
            </Badge>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Flujo de importación de productos desde 1688 — {stepLabel}
          </DialogDescription>
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
                    {(field.key === "sku_interno" || field.key === "nombre" || field.key === "costo" || field.key === "url_producto" || field.key === "imagen_principal") && (
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
                  {field.key === "url_producto" && !columnMapping.url_producto && (
                    <input
                      type="url"
                      value={manualUrlProducto}
                      onChange={(e) => setManualUrlProducto(e.target.value)}
                      placeholder="O ingresar URL manualmente..."
                      className="w-full text-sm border rounded-md px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  )}
                  {field.key === "imagen_principal" && !columnMapping.imagen_principal && (
                    <div className="space-y-2 mt-1">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => document.getElementById('mapping-hero-upload')?.click()}
                        >
                          <Upload className="h-3 w-3 mr-1" />
                          {productMainImage ? "Cambiar imagen" : "Subir desde PC"}
                        </Button>
                        {productMainImage && (
                          <img src={productMainImage} className="h-8 w-8 rounded object-cover border" alt="Vista previa" />
                        )}
                        <input
                          id="mapping-hero-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              if (ev.target?.result) {
                                setProductMainImage(ev.target.result as string);
                                setConfirmNoMainImage(false);
                              }
                            };
                            reader.readAsDataURL(file);
                            e.target.value = "";
                          }}
                        />
                      </div>
                      {!productMainImage && (
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <Checkbox
                            checked={confirmNoMainImage}
                            onCheckedChange={(v) => setConfirmNoMainImage(!!v)}
                            id="confirm-no-main-image"
                          />
                          <span className="text-xs text-muted-foreground">
                            Continuar sin imagen principal (se usará la imagen del primer variante)
                          </span>
                        </label>
                      )}
                      {!productMainImage && !confirmNoMainImage && (
                        <p className="text-xs text-destructive">Mapea una columna, sube una imagen o confirma continuar sin ella</p>
                      )}
                    </div>
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
                    Columnas no mapeadas:
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

        {/* Step 3: Preview — ecommerce product cards */}
        {step === "preview" && (
          <div className="flex flex-col flex-1 min-h-0 gap-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  <Package className="h-3 w-3 mr-1" />
                  {groupedProducts.length} producto{groupedProducts.length !== 1 ? "s" : ""}
                </Badge>
                <Badge variant="secondary">
                  {processedData.length} variante{processedData.length !== 1 ? "s" : ""}
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
                <Button onClick={downloadExcel} disabled={isProcessing || !isTranslationDone || isDownloading || previewValidation.hasErrors}>
                  {isDownloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  {isDownloading ? "Preparando..." : "Descargar Excel Procesado"}
                </Button>
              </div>
            </div>

            {/* Translation in progress banner */}
            {isProcessing && !isTranslationDone && (
              <div className="flex items-center gap-3 p-3 rounded-md bg-primary/10 border border-primary/30 text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                <span className="font-medium text-primary">
                  Traduciendo variantes... {translationProgress.current}/{translationProgress.total} — Por favor espera antes de continuar.
                </span>
              </div>
            )}

            {/* Validation banners */}
            {previewValidation.hasErrors && (
              <div className="space-y-2">
                {previewValidation.missingCost > 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>{previewValidation.missingCost} variante{previewValidation.missingCost !== 1 ? "s" : ""} sin precio</strong>.
                      Elimínalas desde su tarjeta (✕) o vuelve al mapeo a corregir la columna de costo.
                    </span>
                  </div>
                )}
                {previewValidation.missingName > 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>{previewValidation.missingName} variante{previewValidation.missingName !== 1 ? "s" : ""} sin nombre</strong>.
                      Elimínalas desde su tarjeta (✕) o vuelve al mapeo a corregir la columna de título.
                    </span>
                  </div>
                )}
                {previewValidation.missingImages > 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-sm text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <strong>{previewValidation.missingImages} variante{previewValidation.missingImages !== 1 ? "s" : ""} sin URL de imagen</strong>.
                      {" "}Elimínalas individualmente (✕) o usa el botón para eliminar todas.
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-shrink-0 border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                      onClick={removeVariantsWithoutImage}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Eliminar todas sin imagen
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Product cards */}
            <div className="overflow-auto flex-1 space-y-4 pb-2 pr-0.5">
              {groupedProducts.map((group) => {
                // Use explicit product main image first, then first variant image
                const heroImage = productMainImage || group.variants.find((v) => v.url_imagen)?.url_imagen;
                const prices = group.variants
                  .map((v) => parseFloat(v.costo) || 0)
                  .filter((p) => p > 0);
                const minPrice = prices.length ? Math.min(...prices) : 0;
                const maxPrice = prices.length ? Math.max(...prices) : 0;
                const totalStock = group.variants.reduce(
                  (s, v) => s + (parseInt(v.stock) || 0),
                  0
                );
                const groupHasIssue = group.variants.some(
                  (v) =>
                    !v.url_imagen ||
                    !v.costo ||
                    parseFloat(v.costo) <= 0 ||
                    !v.nombre?.trim()
                );

                return (
                  <div
                    key={group.productId}
                    className="border rounded-xl overflow-hidden bg-card shadow-sm"
                  >
                    {/* Product header row */}
                    <div className="flex gap-4 p-4 border-b bg-muted/20">
                      {/* Hero image — click to swap product main image */}
                      <div className="relative flex-shrink-0 w-20 h-20">
                        <div
                          className="w-full h-full rounded-lg overflow-hidden bg-muted border cursor-pointer group"
                          title="Click para cambiar imagen principal"
                          onClick={() => document.getElementById('hero-image-upload')?.click()}
                        >
                          {heroImage && !heroImageFailed ? (
                            <img
                              key={heroImage}
                              src={heroImage}
                              alt=""
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={() => setHeroImageFailed(true)}
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                              <ImageOff className="h-6 w-6 text-muted-foreground/30" />
                              <span className="text-[9px] text-muted-foreground/50">Principal</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center rounded-lg">
                            <Upload className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                          </div>
                        </div>
                        {/* Hidden inputs for hero image */}
                        <input
                          id="hero-image-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              if (ev.target?.result) {
                                setProductMainImage(ev.target.result as string);
                                setHeroImageFailed(false);
                              }
                            };
                            reader.readAsDataURL(file);
                            e.target.value = "";
                          }}
                        />
                      </div>

                      {/* Title + stats */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm leading-snug mb-1 line-clamp-2">
                          {translatedFileTitle || group.parentName}
                        </h3>
                        <p className="text-xs text-muted-foreground mb-2">Proveedor: 1688</p>
                        <div className="flex items-center flex-wrap gap-x-4 gap-y-1">
                          <span className="text-sm font-bold text-primary">
                            US$
                            {minPrice === maxPrice
                              ? minPrice.toFixed(2)
                              : `${minPrice.toFixed(2)} – ${maxPrice.toFixed(2)}`}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Stock: {totalStock.toLocaleString()} uds
                          </span>
                          <Badge
                            variant={groupHasIssue ? "outline" : "secondary"}
                            className={`text-xs ${
                              groupHasIssue
                                ? "border-amber-400/60 text-amber-700 dark:text-amber-400"
                                : ""
                            }`}
                          >
                            {groupHasIssue && (
                              <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                            )}
                            {group.variants.length} variante
                            {group.variants.length !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Variant chips grid */}
                    <div className="p-3">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2">
                        {group.variants.map((row) => {
                          const missingImage = !row.url_imagen;
                          const imgFailed = !missingImage && failedImageSkus.has(row.sku_interno);
                          const missingCost =
                            !row.costo || parseFloat(row.costo) <= 0;
                          const missingName = !row.nombre?.trim();
                          const hasIssue = missingImage || missingCost || missingName;

                          return (
                            <div
                              key={row.sku_interno}
                              className={`relative rounded-lg border flex flex-col gap-1.5 p-2 text-xs transition-colors cursor-pointer group ${
                                hasIssue
                                  ? "border-amber-400/60 bg-amber-50/60 dark:bg-amber-950/20"
                                  : "border-border bg-background hover:bg-muted/30"
                              }`}
                              onClick={() => openVariantEditor(row)}
                            >
                              {/* Delete button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeProcessedVariant(row.sku_interno);
                                }}
                                title="Eliminar esta variante"
                                className="absolute top-1 right-1 z-10 w-5 h-5 rounded-full bg-background/90 border border-border flex items-center justify-center hover:bg-destructive/10 hover:border-destructive/40 hover:text-destructive transition-colors"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>

                              {/* Variant image */}
                              <div className="relative w-full aspect-square rounded-md overflow-hidden bg-muted">
                                {missingImage ? (
                                  /* No URL at all — show amber paste-URL input */
                                  <div
                                    className="w-full h-full flex flex-col items-center justify-center gap-1.5 p-2 bg-amber-100/60 dark:bg-amber-900/20"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                                    <input
                                      type="url"
                                      placeholder="Pegar URL imagen"
                                      className="w-full text-[9px] px-1.5 py-1 rounded border border-amber-400/60 bg-white dark:bg-zinc-900 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-amber-400"
                                      onBlur={(e) => {
                                        const v = e.target.value.trim();
                                        if (v) updateProcessedVariant(row.sku_interno, "url_imagen", v);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          const v = (e.target as HTMLInputElement).value.trim();
                                          if (v) updateProcessedVariant(row.sku_interno, "url_imagen", v);
                                          (e.target as HTMLInputElement).blur();
                                        }
                                      }}
                                    />
                                  </div>
                                ) : (
                                  /* URL present — show image (may be CORS-blocked) */
                                  <img
                                    src={row.url_imagen}
                                    alt={row.variante_1_color || ""}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    onError={() =>
                                      setFailedImageSkus((prev) => new Set([...prev, row.sku_interno]))
                                    }
                                  />
                                )}
                                {/* Zoom overlay on hover */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center pointer-events-none">
                                  <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                                </div>
                                {/* CORS-blocked badge — URL exists but browser can't load it; server will download it */}
                                {imgFailed && (
                                  <span className="absolute bottom-0 left-0 right-0 text-[9px] bg-sky-600/80 text-white text-center py-0.5 font-medium">
                                    URL disponible
                                  </span>
                                )}
                                {missingCost && (
                                  <span className="absolute bottom-0 left-0 right-0 text-[9px] bg-destructive text-white text-center py-0.5 font-medium">
                                    Sin precio
                                  </span>
                                )}
                                {missingName && (
                                  <span className="absolute top-0 left-0 right-0 text-[9px] bg-destructive text-white text-center py-0.5 font-medium">
                                    Sin nombre
                                  </span>
                                )}
                              </div>

                              {/* Variant name — editable when missing */}
                              {missingName ? (
                                <input
                                  type="text"
                                  defaultValue=""
                                  placeholder="Nombre variante"
                                  className="w-full pr-4 text-xs px-1.5 py-1 rounded border border-destructive/60 bg-destructive/5 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-destructive font-semibold"
                                  onBlur={(e) => {
                                    const v = e.target.value.trim();
                                    if (v) updateProcessedVariant(row.sku_interno, "nombre", v);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      const v = (e.target as HTMLInputElement).value.trim();
                                      if (v) updateProcessedVariant(row.sku_interno, "nombre", v);
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                />
                              ) : (
                                <p
                                  className="font-semibold line-clamp-1 pr-4"
                                  title={row.variante_1_color || row.nombre}
                                >
                                  {row.variante_1_color || row.nombre || "—"}
                                </p>
                              )}

                              {row.variante_2_talla && (
                                <p className="text-muted-foreground">
                                  {row.variante_2_talla}
                                </p>
                              )}

                              {/* Price — editable when missing */}
                              {missingCost ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-muted-foreground">US$</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    className="w-full text-xs px-1.5 py-1 rounded border border-destructive/60 bg-destructive/5 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-destructive font-bold"
                                    onBlur={(e) => {
                                      const v = e.target.value.trim();
                                      if (v && parseFloat(v) > 0)
                                        updateProcessedVariant(row.sku_interno, "costo", v);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        const v = (e.target as HTMLInputElement).value.trim();
                                        if (v && parseFloat(v) > 0)
                                          updateProcessedVariant(row.sku_interno, "costo", v);
                                        (e.target as HTMLInputElement).blur();
                                      }
                                    }}
                                  />
                                </div>
                              ) : (
                                <p className="font-bold text-primary">US${row.costo}</p>
                              )}

                              <p className="text-muted-foreground">
                                {parseInt(row.stock || "0").toLocaleString()} uds
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
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

            {previewValidation.hasErrors && (
              <div className="w-full space-y-2">
                {previewValidation.missingCost > 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>{previewValidation.missingCost} variante{previewValidation.missingCost !== 1 ? "s" : ""} sin precio</strong>. Vuelve al paso anterior para corregirlas o eliminarlas.
                    </span>
                  </div>
                )}
                {previewValidation.missingName > 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>{previewValidation.missingName} variante{previewValidation.missingName !== 1 ? "s" : ""} sin nombre</strong>. Vuelve al paso anterior para corregirlas o eliminarlas.
                    </span>
                  </div>
                )}
                {previewValidation.missingImages > 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-sm text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <strong>{previewValidation.missingImages} variante{previewValidation.missingImages !== 1 ? "s" : ""} sin imagen</strong>.
                      {" "}Vuelve al paso anterior para eliminarlas.
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-shrink-0 border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                      onClick={() => { removeVariantsWithoutImage(); setStep("preview"); }}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Eliminar y volver
                    </Button>
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={downloadExcel} disabled={isProcessing || !isTranslationDone || isDownloading || previewValidation.hasErrors}>
                {isDownloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                {isDownloading ? 'Preparando...' : 'Descargar de nuevo'}
              </Button>
              <Button onClick={handleConfirmImport} disabled={isProcessing || !isTranslationDone || isDownloading || previewValidation.hasErrors}>
                {isDownloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                {isDownloading ? 'Subiendo imágenes...' : 'Confirmar e Importar'}
              </Button>
            </div>
          </div>
        )}
      {/* ── Variant detail editor overlay ── */}
      {editingVariant && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeVariantEditor(); }}
        >
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold flex items-center gap-2">
                <Pencil className="h-4 w-4 text-primary" />
                Editar variante
              </h2>
              <button
                onClick={closeVariantEditor}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex flex-col sm:flex-row gap-6 p-6">
              {/* Image + image URL */}
              <div className="sm:w-52 flex-shrink-0 space-y-3">
                <div className="w-full aspect-square rounded-xl overflow-hidden bg-muted border">
                  {editDraft.url_imagen ? (
                    <img
                      key={editDraft.url_imagen}
                      src={editDraft.url_imagen}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageOff className="h-12 w-12 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">URL de imagen</label>
                  <input
                    type="url"
                    value={editDraft.url_imagen || ""}
                    placeholder="https://..."
                    className="w-full text-xs px-2 py-1.5 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    onChange={(e) => setEditDraft((d) => ({ ...d, url_imagen: e.target.value }))}
                  />
                  {/* Upload from local PC */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const dataUrl = ev.target?.result as string;
                        if (dataUrl) setEditDraft((d) => ({ ...d, url_imagen: dataUrl }));
                      };
                      reader.readAsDataURL(file);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-1.5 text-xs px-2 py-1.5 rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Subir desde PC
                  </button>
                </div>
              </div>

              {/* Fields grid */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Nombre del variante</label>
                  <input
                    type="text"
                    value={editDraft.nombre || ""}
                    placeholder="Nombre..."
                    className="w-full text-sm px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    onChange={(e) => setEditDraft((d) => ({ ...d, nombre: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Color</label>
                  <input
                    type="text"
                    value={editDraft.variante_1_color || ""}
                    placeholder="Color..."
                    className="w-full text-sm px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    onChange={(e) => setEditDraft((d) => ({ ...d, variante_1_color: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Talla</label>
                  <input
                    type="text"
                    value={editDraft.variante_2_talla || ""}
                    placeholder="Talla..."
                    className="w-full text-sm px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    onChange={(e) => setEditDraft((d) => ({ ...d, variante_2_talla: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Precio costo (US$)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editDraft.costo || ""}
                    placeholder="0.00"
                    className="w-full text-sm px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    onChange={(e) => setEditDraft((d) => ({ ...d, costo: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Stock (unidades)</label>
                  <input
                    type="number"
                    min="0"
                    value={editDraft.stock || ""}
                    placeholder="0"
                    className="w-full text-sm px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    onChange={(e) => setEditDraft((d) => ({ ...d, stock: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">URL del producto en 1688</label>
                  <input
                    type="url"
                    value={editDraft.url_producto || ""}
                    placeholder="https://detail.1688.com/..."
                    className="w-full text-sm px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    onChange={(e) => setEditDraft((d) => ({ ...d, url_producto: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 p-4 border-t">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  removeProcessedVariant(editingVariant.sku_interno);
                  closeVariantEditor();
                }}
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Eliminar variante
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={closeVariantEditor}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={saveVariantEdits}>
                  <Check className="h-4 w-4 mr-1.5" />
                  Guardar cambios
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      </DialogContent>
    </Dialog>
  );
};

export default Import1688Dialog;
