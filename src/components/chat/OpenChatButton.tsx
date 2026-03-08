import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCreateChat } from '@/hooks/useSupportChat';
import { toast } from 'sonner';

interface OpenChatButtonProps {
  orderId: string;
  orderType: 'b2b' | 'b2c';
  orderLabel?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  fullWidth?: boolean;
  /** Where to navigate after creating the chat */
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
  const [isCreating, setIsCreating] = useState(false);
  const { createChat } = useCreateChat();
  const navigate = useNavigate();

  const handleOpenChat = async () => {
    try {
      setIsCreating(true);
      const label = orderLabel || `Pedido #${orderId.slice(0, 8).toUpperCase()}`;
      const title = `Soporte - ${label} (${orderType.toUpperCase()})`;
      const chat = await createChat(title, orderId, orderType);

      toast.success('Chat de soporte creado');

      // Navigate to the chat
      const routes: Record<string, string> = {
        admin: '/admin/soporte-chat',
        seller: '/admin/soporte-chat', // sellers use the same route for now
        buyer: '/admin/soporte-chat',
      };
      navigate(`${routes[navigateTo]}?chat=${chat.id}`);
    } catch (error: any) {
      toast.error('Error al crear el chat: ' + (error.message || 'Intenta de nuevo'));
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
      Abrir Chat de Soporte
    </Button>
  );
}
