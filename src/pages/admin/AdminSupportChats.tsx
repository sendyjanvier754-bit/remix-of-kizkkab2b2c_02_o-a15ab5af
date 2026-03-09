import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RoleAwareLayout } from '@/components/layout/RoleAwareLayout';
import { ChatList } from '@/components/chat/ChatList';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { MessageCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/types/auth';

export default function AdminSupportChats() {
  const [searchParams] = useSearchParams();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN;

  useEffect(() => {
    const chatFromUrl = searchParams.get('chat');
    if (chatFromUrl) setSelectedChatId(chatFromUrl);
  }, [searchParams]);

  return (
    <RoleAwareLayout title="Soporte - Live Chat" subtitle="Gestiona las conversaciones de soporte">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-10rem)]">
        <div className="lg:col-span-4 xl:col-span-3">
          <ChatList
            onSelectChat={setSelectedChatId}
            selectedChatId={selectedChatId}
            isStaff={isAdmin}
          />
        </div>
        <div className="lg:col-span-8 xl:col-span-9">
          {selectedChatId ? (
            <ChatWindow
              chatId={selectedChatId}
              isStaff={isAdmin}
              onClose={() => setSelectedChatId(null)}
            />
          ) : (
            <div className="h-full flex items-center justify-center rounded-xl border border-dashed border-border bg-card">
              <div className="text-center">
                <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground text-sm">Selecciona un chat para responder</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </RoleAwareLayout>
  );
}
