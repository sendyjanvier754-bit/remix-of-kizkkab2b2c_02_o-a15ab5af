import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCatalog } from '@/hooks/useCatalog';
import { Loader2, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import HierarchicalCategorySelect from './HierarchicalCategorySelect';

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const productSchema = z.object({
  sku_interno: z.string().min(1, 'SKU requerido').max(50),
  nombre: z.string().min(1, 'Nombre requerido').max(200),
  descripcion_corta: z.string().max(500).optional(),
  categoria_id: z.string().optional(),
  proveedor_id: z.string().optional(),
  precio_mayorista: z.coerce.number().min(0, 'Precio debe ser >= 0'),
  precio_sugerido_venta: z.coerce.number().min(0).optional(),
  moq: z.coerce.number().min(1, 'MOQ debe ser >= 1'),
  stock_fisico: z.coerce.number().min(0, 'Stock debe ser >= 0'),
  peso_g: z.coerce.number().min(1, 'Peso debe ser >= 1g').optional(),
  url_origen: z.string().url().optional().or(z.literal('')),
});

type ProductFormData = z.infer<typeof productSchema>;

const ProductFormDialog = ({ open, onOpenChange }: ProductFormDialogProps) => {
  const { createProduct, useCategories, useSuppliers, createCategory, createSupplier } = useCatalog();
  const { data: categories } = useCategories();
  const { data: suppliers } = useSuppliers();
  
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSupplierName, setNewSupplierName] = useState('');

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku_interno: '',
      nombre: '',
      descripcion_corta: '',
      precio_mayorista: 0,
      moq: 1,
      stock_fisico: 0,
    }
  });

  const onSubmit = async (data: ProductFormData) => {
    await createProduct.mutateAsync({
      sku_interno: data.sku_interno,
      nombre: data.nombre,
      descripcion_corta: data.descripcion_corta || null,
      categoria_id: data.categoria_id || null,
      proveedor_id: data.proveedor_id || null,
      precio_mayorista: data.precio_mayorista,
      precio_sugerido_venta: data.precio_sugerido_venta || null,
      moq: data.moq,
      stock_fisico: data.stock_fisico,
      peso_g: data.peso_g || null,
      url_origen: data.url_origen || null,
    });
    form.reset();
    onOpenChange(false);
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    const slug = newCategoryName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await createCategory.mutateAsync({ name: newCategoryName, slug });
    setNewCategoryName('');
    setShowNewCategory(false);
  };

  const handleCreateSupplier = async () => {
    if (!newSupplierName.trim()) return;
    await createSupplier.mutateAsync({ name: newSupplierName });
    setNewSupplierName('');
    setShowNewSupplier(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Producto</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sku_interno"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU Interno *</FormLabel>
                    <FormControl>
                      <Input placeholder="SKU-001" {...field} />
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
                      <Input placeholder="Nombre del producto" {...field} />
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
                    <Textarea placeholder="Descripción breve del producto" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoría</Label>
                {showNewCategory ? (
                  <div className="flex gap-2">
                    <Input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Nueva categoría"
                    />
                    <Button type="button" size="sm" onClick={handleCreateCategory}>
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewCategory(false)}>
                      ✕
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <FormField
                      control={form.control}
                      name="categoria_id"
                      render={({ field }) => (
                        <div className="flex-1">
                          <HierarchicalCategorySelect
                            categories={categories}
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder="Seleccionar"
                          />
                        </div>
                      )}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={() => setShowNewCategory(true)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Proveedor</Label>
                {showNewSupplier ? (
                  <div className="flex gap-2">
                    <Input
                      value={newSupplierName}
                      onChange={(e) => setNewSupplierName(e.target.value)}
                      placeholder="Nuevo proveedor"
                    />
                    <Button type="button" size="sm" onClick={handleCreateSupplier}>
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewSupplier(false)}>
                      ✕
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <FormField
                      control={form.control}
                      name="proveedor_id"
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                          <SelectContent>
                            {suppliers?.map((sup) => (
                              <SelectItem key={sup.id} value={sup.id}>{sup.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={() => setShowNewSupplier(true)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="precio_mayorista"
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
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="moq"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MOQ *</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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

              <FormField
                control={form.control}
                name="peso_g"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Peso (gramos) *</FormLabel>
                    <FormControl>
                      <Input type="number" step="1" min="1" placeholder="500" {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Requerido para cálculo de envío B2B</p>
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
                  <FormLabel>URL Origen (ej. AliExpress)</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createProduct.isPending}>
                {createProduct.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Crear Producto'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ProductFormDialog;
