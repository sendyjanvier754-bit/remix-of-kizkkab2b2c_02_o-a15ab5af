import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useCatalog } from '@/hooks/useCatalog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Upload, Trash2, Image as ImageIcon, Package, DollarSign, Ruler, History, X, Cpu, Layers, Globe } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import HierarchicalCategorySelect from './HierarchicalCategorySelect';
import EmbeddingService from '@/services/ai/embeddingService';
import VariantMatrixManager from './VariantMatrixManager';
import MarketSelector from './MarketSelector';
import { useProductMarkets } from '@/hooks/useMarkets';
import { useProductDeletion } from '@/hooks/useProductDeletion';

interface ProductEditDialogProps {
  productId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const productSchema = z.object({
  sku_interno: z.string().min(1, 'SKU requerido').max(50),
  nombre: z.string().min(1, 'Nombre requerido').max(200),
  descripcion_corta: z.string().max(500).optional().nullable(),
  descripcion_larga: z.string().max(5000).optional().nullable(),
  categoria_id: z.string().optional().nullable(),
  proveedor_id: z.string().optional().nullable(),
  precio_mayorista_base: z.coerce.number().min(0, 'Precio debe ser >= 0'),
  precio_sugerido_venta: z.coerce.number().min(0).optional().nullable(),
  moq: z.coerce.number().min(1, 'MOQ debe ser >= 1'),
  stock_fisico: z.coerce.number().min(0, 'Stock debe ser >= 0'),
  peso_g: z.preprocess(
    (val) => {
      // Convertir strings vacíos y valores falsy a null
      if (val === '' || val === null || val === undefined) return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    },
    z.number().min(1, 'Peso debe ser >= 1g').nullable().optional()
  ),
  dimensiones_largo: z.coerce.number().min(0).optional(),
  dimensiones_ancho: z.coerce.number().min(0).optional(),
  dimensiones_alto: z.coerce.number().min(0).optional(),
  url_origen: z.string().url().optional().or(z.literal('')).nullable(),
  is_active: z.boolean(),
});

type ProductFormData = z.infer<typeof productSchema>;

const ProductEditDialog = ({ productId, open, onOpenChange }: ProductEditDialogProps) => {
  const { useProduct, updateProduct, useCategories, useSuppliers, uploadImage } = useCatalog();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: product, isLoading } = useProduct(productId);
  const { data: categories } = useCategories();
  const { data: suppliers } = useSuppliers();
  const { productMarkets, assignProductToMarkets } = useProductMarkets(productId);
  const { confirmDelete, isDeleting } = useProductDeletion();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [generatingEmbedding, setGeneratingEmbedding] = useState(false);
  const [localImages, setLocalImages] = useState<string[]>([]);
  const [selectedMarketIds, setSelectedMarketIds] = useState<string[]>([]);
  const [marketsInitialized, setMarketsInitialized] = useState(false);
  const initializedRef = useRef(false);

  // Reset initialized state when product changes
  useEffect(() => {
    initializedRef.current = false;
    setMarketsInitialized(false);
  }, [productId]);

  // Initialize selected markets from existing assignments (separate effect to prevent loops)
  useEffect(() => {
    if (productMarkets && !marketsInitialized) {
      const marketIds = productMarkets.map((pm: any) => pm.market_id);
      setSelectedMarketIds(marketIds);
      setMarketsInitialized(true);
    }
  }, [productMarkets, marketsInitialized]);

  // Fetch price history
  const { data: priceHistory } = useQuery({
    queryKey: ['product-price-history', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_price_history')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!productId,
  });

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku_interno: '',
      nombre: '',
      descripcion_corta: '',
      descripcion_larga: '',
      precio_mayorista_base: 0,
      moq: 1,
      stock_fisico: 0,
      is_active: true,
    }
  });

  // Update form when product loads
  useEffect(() => {
    if (product) {
      const dims = product.dimensiones_cm as { largo?: number; ancho?: number; alto?: number } | null;
      form.reset({
        sku_interno: product.sku_interno,
        nombre: product.nombre,
        descripcion_corta: product.descripcion_corta || '',
        descripcion_larga: product.descripcion_larga || '',
        categoria_id: product.categoria_id || undefined,
        proveedor_id: product.proveedor_id || undefined,
        precio_mayorista_base: product.precio_mayorista_base,
        precio_sugerido_venta: product.precio_sugerido_venta || undefined,
        moq: product.moq,
        stock_fisico: product.stock_fisico,
        peso_g: product.peso_g || undefined,
        dimensiones_largo: dims?.largo || undefined,
        dimensiones_ancho: dims?.ancho || undefined,
        dimensiones_alto: dims?.alto || undefined,
        url_origen: product.url_origen || '',
        is_active: product.is_active,
      });
      
      if (!initializedRef.current) {
        setLocalImages(product.galeria_imagenes || []);
        initializedRef.current = true;
      }
    }
  }, [product, form]);

  const onSubmit = async (data: ProductFormData) => {
    console.log('🔍 onSubmit triggered - Form data:', data);
    console.log('👤 User ID:', user?.id);
    console.log('📦 Product ID:', productId);

    try {
      const dimensiones = (data.dimensiones_largo || data.dimensiones_ancho || data.dimensiones_alto)
        ? { largo: data.dimensiones_largo, ancho: data.dimensiones_ancho, alto: data.dimensiones_alto }
        : null;

      console.log('💾 Saving updates...');
      await updateProduct.mutateAsync({
        id: productId,
        updates: {
          sku_interno: data.sku_interno,
          nombre: data.nombre,
          descripcion_corta: data.descripcion_corta || null,
          descripcion_larga: data.descripcion_larga || null,
          categoria_id: data.categoria_id || null,
          proveedor_id: data.proveedor_id || null,
          precio_mayorista_base: data.precio_mayorista_base,
          precio_sugerido_venta: data.precio_sugerido_venta || null,
          moq: data.moq,
          stock_fisico: data.stock_fisico,
          peso_g: data.peso_g || null,
          dimensiones_cm: dimensiones,
          url_origen: data.url_origen || null,
          is_active: data.is_active,
          galeria_imagenes: localImages,
        },
        userId: user?.id,
      });
      
      console.log('✅ Product saved successfully');
      
      // Update market assignments
      console.log('🌍 Updating market assignments...');
      await assignProductToMarkets.mutateAsync({
        productId,
        marketIds: selectedMarketIds,
      });
      
      console.log('✅ Markets updated successfully');
      onOpenChange(false);
    } catch (error) {
      console.error('❌ Error saving product:', error);
      toast({ 
        title: 'Error al guardar', 
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive' 
      });
    }
  };

  // Generate embedding for an image URL
  const generateAndSaveEmbedding = async (imageUrl: string) => {
    setGeneratingEmbedding(true);
    try {
      console.log('Generating embedding for:', imageUrl);
      const embedding = await EmbeddingService.generateImageEmbedding(imageUrl);
      const embeddingString = `[${embedding.join(',')}]`;
      
      // Use any to bypass type checking - embedding field may not exist in current schema
      await (supabase as any)
        .from('products')
        .update({ embedding: embeddingString })
        .eq('id', productId);
      
      toast({ title: 'Embedding IA generado automáticamente', description: 'El producto ahora es buscable por imagen' });
    } catch (error) {
      console.error('Error generating embedding:', error);
      // Don't show error to user - embedding is optional
    } finally {
      setGeneratingEmbedding(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const url = await uploadImage(file, productId);
      
      // Set as main image if none exists, otherwise add to gallery
      if (!product?.imagen_principal) {
        await updateProduct.mutateAsync({
          id: productId,
          updates: { imagen_principal: url },
          userId: user?.id,
        });
        // Generate embedding for new main image
        generateAndSaveEmbedding(url);
      } else {
        setLocalImages(prev => [...prev, url]);
      }
      toast({ title: 'Imagen subida exitosamente' });
    } catch (error) {
      toast({ title: 'Error al subir imagen', variant: 'destructive' });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const setAsMainImage = async (url: string) => {
    const currentMain = product?.imagen_principal;
    const newGallery = localImages.filter(img => img !== url);
    if (currentMain) {
      newGallery.push(currentMain);
    }
    
    await updateProduct.mutateAsync({
      id: productId,
      updates: { 
        imagen_principal: url,
        galeria_imagenes: newGallery,
      },
      userId: user?.id,
    });
    setLocalImages(newGallery);
    
    // Generate embedding for new main image
    generateAndSaveEmbedding(url);
  };

  const removeFromGallery = (url: string) => {
    setLocalImages(prev => prev.filter(img => img !== url));
  };

  const handleRemoveMainImage = async () => {
    if (!confirm('¿Eliminar imagen principal?')) return;
    
    await updateProduct.mutateAsync({
      id: productId,
      updates: { imagen_principal: null },
      userId: user?.id,
    });
    
    // Also remove embedding
    await (supabase as any).from('products').update({ embedding: null }).eq('id', productId);
  };

  const handleDelete = async () => {
    await confirmDelete(
      product?.nombre || 'este producto',
      () => {
        onOpenChange(false);
      },
      productId
    );
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Editar Producto: {product?.sku_interno}</span>
                <div className="flex items-center gap-2">
                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                        <Label className="text-sm">
                          {field.value ? 'Activo' : 'Inactivo'}
                        </Label>
                      </div>
                    )}
                  />
                </div>
              </DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="w-full grid grid-cols-6">
                <TabsTrigger value="general" className="gap-1">
                  <Package className="h-4 w-4" />
                  General
                </TabsTrigger>
                <TabsTrigger value="variants" className="gap-1">
                  <Layers className="h-4 w-4" />
                  Variantes
                </TabsTrigger>
                <TabsTrigger value="pricing" className="gap-1">
                  <DollarSign className="h-4 w-4" />
                  B2B
                </TabsTrigger>
                <TabsTrigger value="markets" className="gap-1">
                  <Globe className="h-4 w-4" />
                  Mercados
                </TabsTrigger>
                <TabsTrigger value="logistics" className="gap-1">
                  <Ruler className="h-4 w-4" />
                  Logística
                </TabsTrigger>
                <TabsTrigger value="media" className="gap-1">
                  <ImageIcon className="h-4 w-4" />
                  Multimedia
                </TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="sku_interno"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SKU Interno *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="nombre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="descripcion_corta"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción Corta</FormLabel>
                      <FormControl>
                        <Textarea rows={2} {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="descripcion_larga"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción Larga</FormLabel>
                      <FormControl>
                        <Textarea rows={4} {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="categoria_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoría</FormLabel>
                        <FormControl>
                          <HierarchicalCategorySelect
                            categories={categories}
                            value={field.value || undefined}
                            onValueChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="proveedor_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Proveedor</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar proveedor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {suppliers?.map((sup) => (
                              <SelectItem key={sup.id} value={sup.id}>{sup.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="url_origen"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL Origen</FormLabel>
                      <FormControl>
                        <Input type="url" placeholder="https://..." {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="variants" className="space-y-4 mt-4">
                {product && (
                  <VariantMatrixManager 
                    productId={productId} 
                    productSku={product.sku_interno}
                    basePrice={product.precio_mayorista_base}
                    productImage={product.imagen_principal}
                  />
                )}
              </TabsContent>

              <TabsContent value="pricing" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Reglas B2B
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="precio_mayorista_base"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Precio Mayorista (USD) *</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" min="0" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="precio_sugerido_venta"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Precio Sugerido Venta</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" min="0" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="moq"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>MOQ (Mínimo de Pedido) *</FormLabel>
                          <FormControl>
                            <Input type="number" min="1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Price History */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <History className="h-5 w-5" />
                      Historial de Cambios
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {priceHistory && priceHistory.length > 0 ? (
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {priceHistory.map((entry: any) => (
                          <div key={entry.id} className="flex items-center justify-between text-sm border-b pb-2">
                            <div>
                              <Badge variant="outline" className="mr-2">
                                {entry.campo_modificado || entry.price_type}
                              </Badge>
                              <span className="text-muted-foreground">
                                {entry.valor_anterior || entry.old_price} → {entry.valor_nuevo || entry.new_price}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(entry.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No hay cambios registrados</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="logistics" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Inventario</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="stock_fisico"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stock Físico *</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Peso y Dimensiones</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="peso_g"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Peso (gramos) *</FormLabel>
                          <FormControl>
                            <Input type="number" step="1" min="1" placeholder="500" {...field} value={field.value || ''} />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">Requerido para cálculo de envío B2B</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="dimensiones_largo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Largo (cm)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.1" min="0" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="dimensiones_ancho"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ancho (cm)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.1" min="0" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="dimensiones_alto"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Alto (cm)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.1" min="0" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="markets" className="space-y-4 mt-4">
                <MarketSelector
                  selectedMarketIds={selectedMarketIds}
                  onSelectionChange={setSelectedMarketIds}
                  title="Mercados Disponibles"
                  description="Selecciona los mercados donde este producto estará disponible para venta"
                />
              </TabsContent>

              <TabsContent value="media" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Imagen Principal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {product?.imagen_principal ? (
                      <div className="relative inline-block group">
                        <img
                          src={product.imagen_principal}
                          alt={product.nombre}
                          className="h-40 w-40 rounded-lg object-cover border"
                        />
                        <Badge className="absolute top-2 left-2">Principal</Badge>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={handleRemoveMainImage}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="h-40 w-40 rounded-lg border-2 border-dashed flex items-center justify-center text-muted-foreground">
                        Sin imagen
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      Galería de Imágenes
                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingImage}
                        >
                          {uploadingImage ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 mr-2" />
                          )}
                          Subir Imagen
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {localImages.length > 0 ? (
                      <div className="grid grid-cols-4 gap-4">
                        {localImages.map((url, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={url}
                              alt={`Galería ${index + 1}`}
                              className="h-24 w-full rounded-lg object-cover border"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => setAsMainImage(url)}
                              >
                                Principal
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => removeFromGallery(url)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No hay imágenes en la galería</p>
                    )}
                  </CardContent>
                </Card>

                <p className="text-xs text-muted-foreground">
                  💡 Las imágenes se almacenan localmente en los servidores para evitar dependencia de URLs externas.
                </p>
              </TabsContent>
            </Tabs>

            <div className="flex justify-between mt-6 pt-4 border-t">
              <Button type="button" variant="destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateProduct.isPending}
                  onClick={(e) => {
                    console.log('🔘 Botón Guardar clickeado');
                    console.log('📋 Form state:', form.formState);
                    console.log('❌ Errores:', form.formState.errors);
                    const values = form.getValues();
                    console.log('📦 Valores actuales:', values);
                  }}
                >
                  {updateProduct.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar Cambios'
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ProductEditDialog;
