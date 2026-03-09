import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RoleAwareLayout } from '@/components/layout/RoleAwareLayout';
import { ChatList } from '@/components/chat/ChatList';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { MessageCircle, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/types/auth';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';

export default function AdminSupportChats() {
  const [searchParams] = useSearchParams();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN;
  const isMobile = useIsMobile();

  useEffect(() => {
    const chatFromUrl = searchParams.get('chat');
    if (chatFromUrl) setSelectedChatId(chatFromUrl);
  }, [searchParams]);

  const handleBack = () => setSelectedChatId(null);

  // Mobile: show either list or chat window (not both)
  if (isMobile) {
    return (
      <RoleAwareLayout title="Soporte - Live Chat">
        <div className="h-[calc(100vh-10rem)]">
          {selectedChatId ? (
            <div className="h-full flex flex-col">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="self-start mb-2 gap-1 text-muted-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
                Volver a chats
              </Button>
              <div className="flex-1 min-h-0">
                <ChatWindow
                  chatId={selectedChatId}
                  isStaff={isAdmin}
                  onClose={handleBack}
                />
              </div>
            </div>
          ) : (
            <ChatList
              onSelectChat={setSelectedChatId}
              selectedChatId={selectedChatId}
              isStaff={isAdmin}
            />
          )}
        </div>
      </RoleAwareLayout>
    );
  }

  // Desktop: side-by-side layout
  return (
    <RoleAwareLayout title="Soporte - Live Chat">
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
