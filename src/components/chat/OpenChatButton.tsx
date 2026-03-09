import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCreateChat } from '@/hooks/useSupportChat';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface OpenChatButtonProps {
  orderId: string;
  orderType: 'b2b' | 'b2c';
  orderLabel?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  fullWidth?: boolean;
  navigateTo?: 'admin' | 'seller' | 'buyer';
}

export function OpenChatButton({
  orderId,
  orderType,
  orderLabel,
  variant = 'outline',
  size = 'default',
  className = '',
  fullWidth = false,
  navigateTo = 'buyer',
}: OpenChatButtonProps) {
  const { t } = useTranslation();
  const [isCreating, setIsCreating] = useState(false);
  const { createChat } = useCreateChat();
  const navigate = useNavigate();

  const handleOpenChat = async () => {
    try {
      setIsCreating(true);

      // Check if there's already an open (non-closed) chat for this order
      const { data: existingChats } = await supabase
        .from('support_chats')
        .select('id, status')
        .eq('order_id', orderId)
        .neq('status', 'closed')
        .limit(1);

      let chatId: string;

      if (existingChats && existingChats.length > 0) {
        // Navigate to existing chat
        chatId = existingChats[0].id;
        toast.info('Ya existe un chat abierto para este pedido');
      } else {
        // Create new chat
        const label = orderLabel || `Pedido #${orderId.slice(0, 8).toUpperCase()}`;
        const title = `Soporte - ${label} (${orderType.toUpperCase()})`;
        const chat = await createChat(title, orderId, orderType);
        chatId = chat.id;
        toast.success(t('common.success'));
      }

      navigate(`/admin/soporte-chat?chat=${chatId}`);
    } catch (error: any) {
      toast.error(t('errors.generic'));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleOpenChat}
      disabled={isCreating}
      className={`${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {isCreating ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : (
        <MessageCircle className="h-4 w-4 mr-2" />
      )}
      {t('chat.openSupport')}
    </Button>
  );
}
