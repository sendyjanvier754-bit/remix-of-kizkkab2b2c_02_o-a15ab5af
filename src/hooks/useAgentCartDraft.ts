import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface DraftItem {
  id: string;
  draft_id: string;
  product_id: string;
  variant_id: string | null;
  sku: string;
  nombre: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  peso_kg: number;
  color: string | null;
  size: string | null;
  image: string | null;
  moq: number;
}

interface Draft {
  id: string;
  agent_session_id: string | null;
  agent_id: string;
  target_user_id: string;
  label: string;
  status: string;
  shipping_address: any;
  market_country: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
  items?: DraftItem[];
  target_profile?: { full_name: string; email: string };
}

export function useAgentCartDraft() {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [activeDraft, setActiveDraft] = useState<Draft | null>(null);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load all drafts
  const loadDrafts = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('agent_cart_drafts')
      .select('*')
      .eq('agent_id', user.id)
      .in('status', ['draft', 'sent_to_checkout'])
      .order('updated_at', { ascending: false });
    if (data) {
      // Enrich with target user info
      const enriched = await Promise.all(
        (data as Draft[]).map(async (d) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', d.target_user_id)
            .single();
          return { ...d, target_profile: profile || undefined };
        })
      );
      setDrafts(enriched);
    }
  }, [user]);

  useEffect(() => { loadDrafts(); }, [loadDrafts]);

  // Load items for active draft
  const loadDraftItems = useCallback(async (draftId: string) => {
    const { data } = await supabase
      .from('agent_cart_draft_items')
      .select('*')
      .eq('draft_id', draftId)
      .order('created_at', { ascending: true });
    if (data) setDraftItems(data as DraftItem[]);
  }, []);

  useEffect(() => {
    if (activeDraft) loadDraftItems(activeDraft.id);
    else setDraftItems([]);
  }, [activeDraft, loadDraftItems]);

  // Create draft
  const createDraft = useCallback(async (
    targetUserId: string,
    sessionId: string | null,
    label?: string
  ) => {
    if (!user) return null;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('agent_cart_drafts')
        .insert({
          agent_id: user.id,
          target_user_id: targetUserId,
          agent_session_id: sessionId,
          label: label || 'Borrador',
        })
        .select()
        .single();
      if (error) throw error;
      await loadDrafts();
      setActiveDraft(data as Draft);
      toast.success('Borrador creado');
      return data;
    } catch (err: any) {
      toast.error(err.message || 'Error al crear borrador');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, loadDrafts]);

  // Add item to draft
  const addItem = useCallback(async (item: Omit<DraftItem, 'id' | 'draft_id'>) => {
    if (!activeDraft) return;
    setIsLoading(true);
    try {
      // Check if variant already exists in draft
      const existing = draftItems.find(
        i => i.product_id === item.product_id && i.variant_id === item.variant_id
      );
      if (existing) {
        const newQty = existing.quantity + item.quantity;
        await supabase
          .from('agent_cart_draft_items')
          .update({
            quantity: newQty,
            total_price: Number(item.unit_price) * newQty,
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('agent_cart_draft_items')
          .insert({
            draft_id: activeDraft.id,
            ...item,
          });
      }
      await loadDraftItems(activeDraft.id);
      toast.success(`${item.nombre} agregado`);
    } catch (err: any) {
      toast.error(err.message || 'Error al agregar producto');
    } finally {
      setIsLoading(false);
    }
  }, [activeDraft, draftItems, loadDraftItems]);

  // Update item quantity
  const updateItemQuantity = useCallback(async (itemId: string, quantity: number) => {
    if (quantity < 1) return;
    const item = draftItems.find(i => i.id === itemId);
    if (!item) return;
    await supabase
      .from('agent_cart_draft_items')
      .update({
        quantity,
        total_price: Number(item.unit_price) * quantity,
      })
      .eq('id', itemId);
    if (activeDraft) await loadDraftItems(activeDraft.id);
  }, [draftItems, activeDraft, loadDraftItems]);

  // Remove item
  const removeItem = useCallback(async (itemId: string) => {
    await supabase.from('agent_cart_draft_items').delete().eq('id', itemId);
    if (activeDraft) await loadDraftItems(activeDraft.id);
    toast.info('Producto eliminado');
  }, [activeDraft, loadDraftItems]);

  // Update shipping address
  const updateShippingAddress = useCallback(async (address: any) => {
    if (!activeDraft) return;
    await supabase
      .from('agent_cart_drafts')
      .update({ shipping_address: address, updated_at: new Date().toISOString() })
      .eq('id', activeDraft.id);
    setActiveDraft(prev => prev ? { ...prev, shipping_address: address } : null);
  }, [activeDraft]);

  // Update market country
  const updateMarketCountry = useCallback(async (country: string) => {
    if (!activeDraft) return;
    await supabase
      .from('agent_cart_drafts')
      .update({ market_country: country, updated_at: new Date().toISOString() })
      .eq('id', activeDraft.id);
    setActiveDraft(prev => prev ? { ...prev, market_country: country } : null);
  }, [activeDraft]);

  // Push to user checkout
  const pushToCheckout = useCallback(async () => {
    if (!activeDraft) return null;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('agent_push_cart_to_user', {
        p_draft_id: activeDraft.id,
      });
      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error);
      toast.success(`Carrito enviado al usuario con ${result.items_count} productos`);
      setActiveDraft(null);
      await loadDrafts();
      return result;
    } catch (err: any) {
      toast.error(err.message || 'Error al enviar carrito');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [activeDraft, loadDrafts]);

  // Cancel draft
  const cancelDraft = useCallback(async (draftId: string) => {
    await supabase
      .from('agent_cart_drafts')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', draftId);
    if (activeDraft?.id === draftId) setActiveDraft(null);
    await loadDrafts();
    toast.info('Borrador cancelado');
  }, [activeDraft, loadDrafts]);

  // Select draft
  const selectDraft = useCallback((draft: Draft) => {
    setActiveDraft(draft);
  }, []);

  // Update label
  const updateLabel = useCallback(async (draftId: string, label: string) => {
    await supabase
      .from('agent_cart_drafts')
      .update({ label, updated_at: new Date().toISOString() })
      .eq('id', draftId);
    await loadDrafts();
  }, [loadDrafts]);

  const draftSubtotal = draftItems.reduce((sum, i) => sum + Number(i.total_price), 0);
  const draftItemCount = draftItems.reduce((sum, i) => sum + i.quantity, 0);

  return {
    drafts,
    activeDraft,
    draftItems,
    isLoading,
    draftSubtotal,
    draftItemCount,
    createDraft,
    selectDraft,
    addItem,
    updateItemQuantity,
    removeItem,
    updateShippingAddress,
    updateMarketCountry,
    pushToCheckout,
    cancelDraft,
    updateLabel,
    loadDrafts,
  };
}
