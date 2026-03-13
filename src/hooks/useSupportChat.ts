import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface SupportChat {
  id: string;
  title: string;
  created_by: string;
  order_id: string | null;
  order_type: string | null;
  status: 'waiting' | 'active' | 'paused' | 'closed';
  assigned_to: string | null;
  assigned_at: string | null;
  unread_customer: number;
  unread_staff: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  creator_profile?: { full_name: string; email: string } | null;
  assignee_profile?: { full_name: string } | null;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  file_url: string | null;
  file_name: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  // Joined
  sender_profile?: { full_name: string } | null;
}

export function useSupportChat(chatId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chat, setChat] = useState<SupportChat | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<any>(null);

  // Fetch chat details
  const fetchChat = useCallback(async () => {
    if (!chatId) { setChat(null); return; }
    const { data } = await supabase
      .from('support_chats')
      .select('*')
      .eq('id', chatId)
      .single();
    if (data) setChat(data as unknown as SupportChat);
  }, [chatId]);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!chatId) { setMessages([]); setIsLoading(false); return; }
    setIsLoading(true);
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .limit(200);
    if (data) setMessages(data as ChatMessage[]);
    setIsLoading(false);
  }, [chatId]);

  useEffect(() => {
    fetchChat();
    fetchMessages();
  }, [fetchChat, fetchMessages]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!chatId) return;

    const channel = supabase
      .channel(`chat-messages:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'support_chats',
          filter: `id=eq.${chatId}`,
        },
        (payload) => {
          setChat(payload.new as unknown as SupportChat);
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId]);

  // Send message
  const sendMessage = useCallback(async (content: string, messageType = 'text', fileUrl?: string, fileName?: string) => {
    if (!chatId || !user) return;
    const { error } = await supabase.from('chat_messages').insert({
      chat_id: chatId,
      sender_id: user.id,
      content,
      message_type: messageType,
      file_url: fileUrl || null,
      file_name: fileName || null,
    });
    if (error) throw error;

    // Update last_message_at
    await supabase.from('support_chats').update({
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', chatId);
  }, [chatId, user]);

  // Join chat (staff assigns themselves)
  const joinChat = useCallback(async () => {
    if (!chatId || !user) return;
    await supabase.from('support_chats').update({
      assigned_to: user.id,
      assigned_at: new Date().toISOString(),
      status: 'active' as any,
      updated_at: new Date().toISOString(),
    }).eq('id', chatId);

    // System message
    await supabase.from('chat_messages').insert({
      chat_id: chatId,
      sender_id: user.id,
      content: 'Se ha unido al chat',
      message_type: 'system',
    });
    await fetchChat();
  }, [chatId, user, fetchChat]);

  // Pause chat
  const pauseChat = useCallback(async () => {
    if (!chatId || !user) return;
    await supabase.from('support_chats').update({
      status: 'paused' as any,
      paused_by: user.id,
      paused_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', chatId);
    await supabase.from('chat_messages').insert({
      chat_id: chatId,
      sender_id: user.id,
      content: 'Chat pausado',
      message_type: 'system',
    });
    await fetchChat();
  }, [chatId, user, fetchChat]);

  // Resume chat
  const resumeChat = useCallback(async () => {
    if (!chatId || !user) return;
    await supabase.from('support_chats').update({
      status: 'active' as any,
      paused_by: null,
      paused_at: null,
      updated_at: new Date().toISOString(),
    }).eq('id', chatId);
    await supabase.from('chat_messages').insert({
      chat_id: chatId,
      sender_id: user.id,
      content: 'Chat reanudado',
      message_type: 'system',
    });
    await fetchChat();
  }, [chatId, user, fetchChat]);

  // Close chat
  const closeChat = useCallback(async (reason?: string) => {
    if (!chatId || !user) return;
    await supabase.from('support_chats').update({
      status: 'closed' as any,
      closed_by: user.id,
      closed_at: new Date().toISOString(),
      close_reason: reason || 'Cerrado por el usuario',
      updated_at: new Date().toISOString(),
    }).eq('id', chatId);
    await supabase.from('chat_messages').insert({
      chat_id: chatId,
      sender_id: user.id,
      content: reason || 'Chat cerrado',
      message_type: 'system',
    });
    await fetchChat();
  }, [chatId, user, fetchChat]);

  // Mark messages as read
  const markMessagesRead = useCallback(async () => {
    if (!chatId || !user) return;
    await supabase.from('chat_messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('chat_id', chatId)
      .neq('sender_id', user.id)
      .eq('is_read', false);
  }, [chatId, user]);

  return {
    chat,
    messages,
    isLoading,
    sendMessage,
    joinChat,
    pauseChat,
    resumeChat,
    closeChat,
    markMessagesRead,
    refresh: fetchMessages,
  };
}

// Hook: total unread messages for the current (non-staff) user
export function useUnreadChatCount() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('support_chats')
      .select('unread_customer')
      .eq('created_by', user.id)
      .neq('status', 'closed');
    if (data) {
      const total = data.reduce((sum: number, c: any) => sum + (c.unread_customer ?? 0), 0);
      setUnreadCount(total);
    }
  }, [user]);

  useEffect(() => { fetchCount(); }, [fetchCount]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('unread-chat-count-' + user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_chats' }, () => fetchCount())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => fetchCount())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchCount]);

  return unreadCount;
}

// Hook to list all chats
export function useChatList(filter: 'all' | 'waiting' | 'active' | 'mine' | 'closed' = 'all') {
  const { user } = useAuth();
  const [chats, setChats] = useState<SupportChat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchChats = useCallback(async () => {
    if (!user) return;
    let query = supabase
      .from('support_chats')
      .select('*')
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (filter === 'waiting') query = query.eq('status', 'waiting');
    else if (filter === 'active') query = query.in('status', ['active', 'paused']);
    else if (filter === 'mine') query = query.eq('assigned_to', user.id).neq('status', 'closed');
    else if (filter === 'closed') query = query.eq('status', 'closed');

    const { data } = await query.limit(100);
    if (data) setChats(data as unknown as SupportChat[]);
    setIsLoading(false);
  }, [user, filter]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Realtime for chat list updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('chat-list-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_chats' },
        () => { fetchChats(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchChats]);

  return { chats, isLoading, refresh: fetchChats };
}

// Hook to create a new chat
export function useCreateChat() {
  const { user } = useAuth();

  const createChat = useCallback(async (title: string, orderId?: string, orderType?: string) => {
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('support_chats')
      .insert({
        title,
        created_by: user.id,
        order_id: orderId || null,
        order_type: orderType || null,
        status: 'waiting' as any,
      })
      .select()
      .single();
    if (error) throw error;

    // Send initial system message
    await supabase.from('chat_messages').insert({
      chat_id: data.id,
      sender_id: user.id,
      content: 'Chat de soporte iniciado. Un miembro del equipo se conectará pronto.',
      message_type: 'system',
    });

    // Create notification for admins - they'll see it via the chat list
    return data as unknown as SupportChat;
  }, [user]);

  return { createChat };
}
