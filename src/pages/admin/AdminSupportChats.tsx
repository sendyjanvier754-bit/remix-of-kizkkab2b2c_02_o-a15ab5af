import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ChatList } from '@/components/chat/ChatList';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { MessageCircle } from 'lucide-react';

export default function AdminSupportChats() {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  return (
    <AdminLayout title="Soporte - Live Chat" subtitle="Gestiona las conversaciones de soporte">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-10rem)]">
        {/* Chat list */}
        <div className="lg:col-span-4 xl:col-span-3">
          <ChatList
            onSelectChat={setSelectedChatId}
            selectedChatId={selectedChatId}
            isStaff
          />
        </div>

        {/* Chat window */}
        <div className="lg:col-span-8 xl:col-span-9">
          {selectedChatId ? (
            <ChatWindow
              chatId={selectedChatId}
              isStaff
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
    </AdminLayout>
  );
}
