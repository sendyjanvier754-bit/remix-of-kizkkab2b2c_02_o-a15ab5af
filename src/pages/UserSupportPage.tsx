import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PageWrapper } from '@/components/PageWrapper';
import { ChatList } from '@/components/chat/ChatList';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { MessageCircle, ChevronLeft, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCreateChat } from '@/hooks/useSupportChat';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import GlobalHeader from '@/components/layout/GlobalHeader';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function UserSupportPage() {
  const [searchParams] = useSearchParams();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const { user, isLoading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { createChat } = useCreateChat();

  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState('');
  const [creating, setCreating] = useState(false);

  // Guard: redirect unauthenticated users to login
  useEffect(() => {
    if (!authLoading && !user) {
      sessionStorage.setItem('post_login_redirect', '/soporte');
      navigate('/cuenta', { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const chatFromUrl = searchParams.get('chat');
    if (chatFromUrl) setSelectedChatId(chatFromUrl);
  }, [searchParams]);

  const handleBack = () => setSelectedChatId(null);

  const handleCreateChat = async () => {
    if (!newChatTitle.trim()) return;
    setCreating(true);
    try {
      const chat = await createChat(newChatTitle.trim());
      setNewChatOpen(false);
      setNewChatTitle('');
      setSelectedChatId(chat.id);
    } catch {
      // silently ignore
    }
    setCreating(false);
  };

  // Don't render while checking auth
  if (authLoading || !user) return null;

  const newChatButton = (
    <Button size="sm" className="gap-1" onClick={() => setNewChatOpen(true)}>
      <Plus className="h-4 w-4" />
      Nuevo chat
    </Button>
  );

  // Mobile: show either list or chat window (not both)
  if (isMobile) {
    return (
      <PageWrapper seo={{ title: 'Soporte - Live Chat', description: 'Chatea con nuestro equipo de soporte' }}>
        <div className="h-[calc(100vh-10rem)] flex flex-col">
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
                  isStaff={false}
                  onClose={handleBack}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full gap-3">
              {/* Encabezado */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-primary" />
                  <h1 className="text-lg font-semibold">Soporte</h1>
                </div>
                {newChatButton}
              </div>
              <p className="text-xs text-muted-foreground px-1 -mt-1">
                Escríbenos, te respondemos a la brevedad.
              </p>
              <div className="flex-1 min-h-0">
                <ChatList
                  onSelectChat={setSelectedChatId}
                  selectedChatId={selectedChatId}
                  isStaff={false}
                />
              </div>
            </div>
          )}
        </div>

        <NewChatDialog
          open={newChatOpen}
          onOpenChange={setNewChatOpen}
          title={newChatTitle}
          onTitleChange={setNewChatTitle}
          onSubmit={handleCreateChat}
          creating={creating}
        />
      </PageWrapper>
    );
  }

  // Desktop: side-by-side layout
  return (
    <PageWrapper seo={{ title: 'Live Chat - Soporte', description: 'Chatea con nuestro equipo de soporte' }}>
      {/* Encabezado de página */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <MessageCircle className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">Live Chat</h1>
            <p className="text-sm text-muted-foreground">Centro de Ayuda — escríbenos, te respondemos a la brevedad.</p>
          </div>
        </div>
        {newChatButton}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-14rem)]">
        <div className="lg:col-span-4 xl:col-span-3">
          <ChatList
            onSelectChat={setSelectedChatId}
            selectedChatId={selectedChatId}
            isStaff={false}
          />
        </div>
        <div className="lg:col-span-8 xl:col-span-9">
          {selectedChatId ? (
            <ChatWindow
              chatId={selectedChatId}
              isStaff={false}
              onClose={() => setSelectedChatId(null)}
            />
          ) : (
            <div className="h-full flex items-center justify-center rounded-xl border border-dashed border-border bg-card">
              <div className="text-center">
                <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground text-sm">Selecciona un chat o crea uno nuevo</p>
                <Button size="sm" className="mt-4 gap-1" onClick={() => setNewChatOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Nuevo chat
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <NewChatDialog
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        title={newChatTitle}
        onTitleChange={setNewChatTitle}
        onSubmit={handleCreateChat}
        creating={creating}
      />
    </PageWrapper>
  );
}

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onTitleChange: (v: string) => void;
  onSubmit: () => void;
  creating: boolean;
}

function NewChatDialog({ open, onOpenChange, title, onTitleChange, onSubmit, creating }: NewChatDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nuevo chat de soporte</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="chat-title">¿En qué podemos ayudarte?</Label>
            <Input
              id="chat-title"
              placeholder="Ej: Problema con mi pedido #1234"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={!title.trim() || creating}>
            {creating ? 'Creando...' : 'Iniciar chat'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
