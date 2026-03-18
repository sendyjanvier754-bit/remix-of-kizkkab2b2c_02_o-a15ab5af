import { useState, useRef } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  ChevronRight, 
  ChevronDown, 
  FolderTree,
  Eye,
  EyeOff,
  Layers,
  Tag,
  Upload,
  X,
  ImageIcon,
  Settings2
} from "lucide-react";
import { cn } from "@/lib/utils";
import CategoryAttributeTemplateManager from "@/components/admin/CategoryAttributeTemplateManager";
import { syncEntityTranslations } from "@/lib/translationSync";

interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  is_visible_public: boolean;
  description: string | null;
  icon: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
  level: number;
}

const AdminCategorias = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    parent_id: "",
    is_visible_public: true,
    description: "",
    icon: "",
    sort_order: 0,
  });

  // Fetch categories
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      
      if (error) throw error;
      return data as Category[];
    },
  });

  // Create category mutation
  const createCategory = useMutation({
    mutationFn: async (data: Omit<Category, "id" | "created_at" | "updated_at">) => {
      const { data: created, error } = await supabase
        .from("categories")
        .insert([data])
        .select("id, name")
        .single();
      if (error) throw error;

      await syncEntityTranslations('category', created.id, {
        name: created.name,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      toast({ title: "Categoría creada exitosamente" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error al crear categoría", description: error.message, variant: "destructive" });
    },
  });

  // Update category mutation
  const updateCategory = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Category> & { id: string }) => {
      const { data: updated, error } = await supabase
        .from("categories")
        .update(data)
        .eq("id", id)
        .select('id, name')
        .single();
      if (error) throw error;

      await syncEntityTranslations('category', updated.id, {
        name: updated.name,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      toast({ title: "Categoría actualizada exitosamente" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error al actualizar categoría", description: error.message, variant: "destructive" });
    },
  });

  // Delete category mutation
  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      toast({ title: "Categoría eliminada exitosamente" });
      setIsDeleteOpen(false);
      setDeletingCategory(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error al eliminar categoría", description: error.message, variant: "destructive" });
    },
  });

  // Build tree structure
  const buildTree = (items: Category[], parentId: string | null = null, level = 0): CategoryTreeNode[] => {
    return items
      .filter((item) => item.parent_id === parentId)
      .map((item) => ({
        ...item,
        level,
        children: buildTree(items, item.id, level + 1),
      }))
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  };

  const categoryTree = buildTree(categories);

  // Get all descendants of a category (to prevent circular references)
  const getDescendantIds = (categoryId: string): string[] => {
    const descendants: string[] = [];
    const findDescendants = (id: string) => {
      categories
        .filter((c) => c.parent_id === id)
        .forEach((c) => {
          descendants.push(c.id);
          findDescendants(c.id);
        });
    };
    findDescendants(categoryId);
    return descendants;
  };

  // Get available parents (excluding self and descendants)
  const getAvailableParents = () => {
    if (!editingCategory) return categories;
    const excludeIds = new Set([editingCategory.id, ...getDescendantIds(editingCategory.id)]);
    return categories.filter((c) => !excludeIds.has(c.id));
  };

  // Generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      parent_id: "",
      is_visible_public: true,
      description: "",
      icon: "",
      sort_order: 0,
    });
    setEditingCategory(null);
    setIsFormOpen(false);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      parent_id: category.parent_id || "",
      is_visible_public: category.is_visible_public,
      description: category.description || "",
      icon: category.icon || "",
      sort_order: category.sort_order,
    });
    setImagePreview(category.icon || null);
    setIsFormOpen(true);
  };

  const handleImageUpload = async (file: File) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({ title: "Solo se permiten imágenes", variant: "destructive" });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "La imagen no debe superar 5MB", variant: "destructive" });
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `category-${Date.now()}.${fileExt}`;
      const filePath = `categories/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("product-images")
        .getPublicUrl(filePath);

      setFormData({ ...formData, icon: publicUrl });
      setImagePreview(publicUrl);
      toast({ title: "Imagen subida correctamente" });
    } catch (error: any) {
      toast({ title: "Error al subir imagen", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setFormData({ ...formData, icon: "" });
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: "El nombre es requerido", variant: "destructive" });
      return;
    }

    const slug = formData.slug || generateSlug(formData.name);
    const payload = {
      name: formData.name.trim(),
      slug,
      parent_id: formData.parent_id || null,
      is_visible_public: formData.is_visible_public,
      description: formData.description || null,
      icon: formData.icon || null,
      sort_order: formData.sort_order,
    };

    if (editingCategory) {
      updateCategory.mutate({ id: editingCategory.id, ...payload });
    } else {
      createCategory.mutate(payload);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allIds = categories.filter((c) => categories.some((child) => child.parent_id === c.id)).map((c) => c.id);
    setExpandedNodes(new Set(allIds));
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  // Count stats
  const totalCategories = categories.length;
  const rootCategories = categories.filter((c) => !c.parent_id).length;
  const visibleCategories = categories.filter((c) => c.is_visible_public).length;
  const maxDepth = (() => {
    let max = 0;
    const findDepth = (id: string | null, depth: number) => {
      if (depth > max) max = depth;
      categories.filter((c) => c.parent_id === id).forEach((c) => findDepth(c.id, depth + 1));
    };
    findDepth(null, 0);
    return max;
  })();

  // Render tree node
  const renderTreeNode = (node: CategoryTreeNode) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);

    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors group",
            "border-l-2 border-transparent hover:border-primary"
          )}
          style={{ paddingLeft: `${node.level * 24 + 12}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleExpand(node.id)}
              className="p-1 hover:bg-muted rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          ) : (
            <span className="w-6" />
          )}
          
          <span className="flex-1 font-medium">{node.name}</span>
          
          {!node.is_visible_public && (
            <Badge variant="outline" className="text-xs">
              <EyeOff className="h-3 w-3 mr-1" />
              Oculta
            </Badge>
          )}
          
          <Badge variant="secondary" className="text-xs">
            Nivel {node.level + 1}
          </Badge>
          
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleEdit(node)}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => {
                setDeletingCategory(node);
                setIsDeleteOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderTreeNode(child))}
          </div>
        )}
      </div>
    );
  };

  // Get parent path for display
  const getParentPath = (parentId: string | null): string => {
    if (!parentId) return "Raíz";
    const path: string[] = [];
    let currentId: string | null = parentId;
    while (currentId) {
      const cat = categories.find((c) => c.id === currentId);
      if (cat) {
        path.unshift(cat.name);
        currentId = cat.parent_id;
      } else {
        break;
      }
    }
    return path.join(" > ");
  };

  return (
    <AdminLayout title="Gestión de Categorías" subtitle="Administra la jerarquía multinivel del catálogo">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Total Categorías
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCategories}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FolderTree className="h-4 w-4" />
              Categorías Raíz
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rootCategories}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Visibles B2C
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{visibleCategories}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Profundidad Máx.
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{maxDepth}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Categories and Templates */}
      <Tabs defaultValue="categories" className="space-y-6">
        <TabsList>
          <TabsTrigger value="categories" className="gap-2">
            <FolderTree className="h-4 w-4" />
            Categorías
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Plantillas de Atributos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4">
          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Categoría
            </Button>
            <Button variant="outline" onClick={expandAll}>
              Expandir Todo
            </Button>
            <Button variant="outline" onClick={collapseAll}>
              Colapsar Todo
            </Button>
          </div>

          {/* Category Tree */}
          <Card>
            <CardHeader>
              <CardTitle>Árbol de Categorías</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Cargando categorías...</div>
              ) : categoryTree.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay categorías. Crea la primera categoría para comenzar.
                </div>
              ) : (
                <div className="space-y-1">
                  {categoryTree.map((node) => renderTreeNode(node))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <CategoryAttributeTemplateManager />
        </TabsContent>
      </Tabs>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Editar Categoría" : "Nueva Categoría"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Electrónica de Consumo"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (URL)</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="Se genera automáticamente"
              />
              <p className="text-xs text-muted-foreground">
                Dejar vacío para generar automáticamente desde el nombre
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="parent">Categoría Padre</Label>
              <Select
                value={formData.parent_id || "__none__"}
                onValueChange={(value) => setFormData({ ...formData, parent_id: value === "__none__" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar padre (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">-- Categoría Raíz --</SelectItem>
                  {getAvailableParents().map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {getParentPath(cat.parent_id)} {cat.parent_id && "> "}{cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Imagen de Categoría</Label>
              <div className="flex items-start gap-4">
                {imagePreview ? (
                  <div className="relative w-24 h-24 rounded-full overflow-hidden border border-border">
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-0 right-0 p-1 bg-destructive text-destructive-foreground rounded-full"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-full bg-muted border border-dashed border-border flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      "Subiendo..."
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        {imagePreview ? "Cambiar imagen" : "Subir imagen"}
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG o WebP. Máx 5MB.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción opcional de la categoría"
                rows={2}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="sort_order">Orden</Label>
              <Input
                id="sort_order"
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">
                Menor número = aparece primero
              </p>
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="visible">Visible en Frontend B2C</Label>
              <Switch
                id="visible"
                checked={formData.is_visible_public}
                onCheckedChange={(checked) => setFormData({ ...formData, is_visible_public: checked })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createCategory.isPending || updateCategory.isPending}
            >
              {editingCategory ? "Guardar Cambios" : "Crear Categoría"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la categoría "{deletingCategory?.name}".
              {categories.some((c) => c.parent_id === deletingCategory?.id) && (
                <span className="block mt-2 text-destructive font-medium">
                  ⚠️ Esta categoría tiene subcategorías. Se eliminarán las referencias padre de las subcategorías.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCategory && deleteCategory.mutate(deletingCategory.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminCategorias;
