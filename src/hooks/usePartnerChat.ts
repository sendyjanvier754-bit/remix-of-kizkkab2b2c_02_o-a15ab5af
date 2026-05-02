import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type PartnerChatContext = "partner_order" | "partner_route";

/**
 * Reuses the existing support_chats / chat_messages system for partner conversations.
 * Calls the SECURITY DEFINER RPC `get_or_create_partner_chat` to obtain (or create)
 * a single chat per order or per route, then surfaces the chat id so it can be
 * fed into the existing <ChatWindow> + useSupportChat hook.
 */
export function usePartnerChat(params: {
  context: PartnerChatContext;
  orderId?: string | null;
  routeId?: string | null;
  title?: string;
  /** When false, the chat is not auto-created (read-only check). */
  autoCreate?: boolean;
}) {
  const { context, orderId, routeId, title, autoCreate = true } = params;
  const { toast } = useToast();
  const [chatId, setChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ensureChat = useCallback(async () => {
    if (!autoCreate) return null;
    if (context === "partner_order" && !orderId) return null;
    if (context === "partner_route" && !routeId) return null;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_or_create_partner_chat", {
        p_context: context,
        p_order_id: orderId ?? null,
        p_route_id: routeId ?? null,
        p_title: title ?? null,
      });
      if (error) throw error;
      const id = (data as string) ?? null;
      setChatId(id);
      return id;
    } catch (err) {
      const e = err as Error;
      toast({ title: "Error abriendo chat", description: e.message, variant: "destructive" });
      return null;
    } finally {
      setLoading(false);
    }
  }, [autoCreate, context, orderId, routeId, title, toast]);

  useEffect(() => {
    void ensureChat();
  }, [ensureChat]);

  return { chatId, loading, ensureChat };
}
