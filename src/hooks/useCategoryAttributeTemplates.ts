import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export interface CategoryAttributeTemplate {
  id: string;
  category_id: string;
  attribute_name: string;
  attribute_display_name: string;
  attribute_type: string;
  render_type: string;
  suggested_values: string[] | null;
  is_required: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateWithCategory extends CategoryAttributeTemplate {
  category?: {
    id: string;
    name: string;
    slug: string;
    parent_id: string | null;
  };
}

// Fetch all templates
export const useCategoryAttributeTemplates = () => {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['category-attribute-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('category_attribute_templates')
        .select(`
          *,
          category:categories(id, name, slug, parent_id)
        `)
        .order('sort_order');

      if (error) throw error;
      return data as TemplateWithCategory[];
    },
  });
};

// Fetch templates for a specific category (including inherited from parents)
export const useTemplatesForCategory = (categoryId: string | null) => {
  return useQuery({
    queryKey: ['category-templates', categoryId],
    queryFn: async () => {
      if (!categoryId) return [];

      // Get the category and its parent chain
      const categoryIds: string[] = [categoryId];
      
      // Fetch parent categories recursively
      let currentId = categoryId;
      while (currentId) {
        const { data: cat } = await supabase
          .from('categories')
          .select('parent_id')
          .eq('id', currentId)
          .single();
        
        if (cat?.parent_id) {
          categoryIds.push(cat.parent_id);
          currentId = cat.parent_id;
        } else {
          break;
        }
      }

      // Fetch templates for all categories in the chain
      const { data, error } = await supabase
        .from('category_attribute_templates')
        .select('*')
        .in('category_id', categoryIds)
        .order('sort_order');

      if (error) throw error;

      // Deduplicate by attribute_name (child category templates override parent)
      const templateMap = new Map<string, CategoryAttributeTemplate>();
      
      // Reverse so child templates override parent templates
      [...(data || [])].reverse().forEach(template => {
        if (!templateMap.has(template.attribute_name)) {
          templateMap.set(template.attribute_name, template);
        }
      });

      return Array.from(templateMap.values()).sort((a, b) => a.sort_order - b.sort_order);
    },
    enabled: !!categoryId,
  });
};

// Create a new template
export const useCreateCategoryTemplate = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (template: Omit<CategoryAttributeTemplate, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('category_attribute_templates')
        .insert(template)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-attribute-templates'] });
      toast({ title: 'Plantilla creada exitosamente' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al crear plantilla', description: error.message, variant: 'destructive' });
    },
  });
};

// Update a template
export const useUpdateCategoryTemplate = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CategoryAttributeTemplate> }) => {
      const { data, error } = await supabase
        .from('category_attribute_templates')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-attribute-templates'] });
      toast({ title: 'Plantilla actualizada' });
    },
    onError: (error: Error) => {
      toast({ title: t('toasts.errorUpdating'), description: error.message, variant: 'destructive' });
    },
  });
};

// Delete a template
export const useDeleteCategoryTemplate = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('category_attribute_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-attribute-templates'] });
      toast({ title: 'Plantilla eliminada' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al eliminar', description: error.message, variant: 'destructive' });
    },
  });
};

// Apply template to import configuration
export const applyTemplateToImport = (
  templates: CategoryAttributeTemplate[],
  headers: string[]
): { attributeName: string; suggestedColumn: string | null; displayName: string }[] => {
  return templates.map(template => {
    // Try to find a matching column in the headers
    const headerLower = headers.map(h => h.toLowerCase());
    const matchingColumn = headers.find((h, i) => {
      const lower = headerLower[i];
      return (
        lower === template.attribute_name ||
        lower.includes(template.attribute_name) ||
        template.attribute_name.includes(lower) ||
        lower === template.attribute_display_name.toLowerCase() ||
        lower.includes(template.attribute_display_name.toLowerCase())
      );
    });

    return {
      attributeName: template.attribute_name,
      displayName: template.attribute_display_name,
      suggestedColumn: matchingColumn || null,
    };
  });
};
