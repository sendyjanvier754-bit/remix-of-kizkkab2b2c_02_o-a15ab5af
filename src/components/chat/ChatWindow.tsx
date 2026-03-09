import { useState, useRef, useEffect } from 'react';
import { useSupportChat, ChatMessage } from '@/hooks/useSupportChat';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Send, Pause, Play, X, LogIn, 
  MessageCircle, Clock, User
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

interface ChatWindowProps {
  chatId: string;
  isStaff?: boolean;
  onClose?: () => void;
}

export function ChatWindow({ chatId, isStaff = false, onClose }: ChatWindowProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const {
    chat, messages, isLoading,
    sendMessage, joinChat, pauseChat, resumeChat, closeChat, markMessagesRead,
  } = useSupportChat(chatId);

  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    waiting: { label: t('chat.waiting'), color: 'bg-amber-500/20 text-amber-600 border-amber-500/30', icon: <Clock className="h-3 w-3" /> },
    active: { label: t('chat.active'), color: 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30', icon: <MessageCircle className="h-3 w-3" /> },
    paused: { label: t('chat.paused'), color: 'bg-muted text-muted-foreground', icon: <Pause className="h-3 w-3" /> },
    closed: { label: t('chat.closed'), color: 'bg-destructive/20 text-destructive', icon: <X className="h-3 w-3" /> },
  };

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Mark messages as read when viewing
  useEffect(() => {
    if (chatId && messages.length > 0) {
      markMessagesRead();
    }
  }, [chatId, messages.length, markMessagesRead]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage(newMessage.trim());
      setNewMessage('');
      inputRef.current?.focus();
    } catch { }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const status = statusConfig[chat?.status || 'waiting'];
  const isClosed = chat?.status === 'closed';
  const isPaused = chat?.status === 'paused';
  const isWaiting = chat?.status === 'waiting';
  const isChatCreator = chat?.created_by === user?.id;
  const canSend = chat?.status === 'active' || (isStaff && isWaiting);

  return (
    <Card className="flex flex-col h-full border border-border">
      {/* Header */}
      <CardHeader className="py-3 px-4 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold truncate">{chat?.title || 'Chat'}</CardTitle>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${status?.color}`}>
                  {status?.icon}
                  <span className="ml-1">{status?.label}</span>
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isStaff && isWaiting && !isChatCreator && (
              <Button size="sm" onClick={joinChat} className="gap-1 text-xs h-7">
                <LogIn className="h-3 w-3" /> {t('chat.join')}
              </Button>
            )}
            {!isClosed && !isWaiting && (
              <>
                {isPaused ? (
                  <Button size="sm" variant="outline" onClick={resumeChat} className="gap-1 text-xs h-7">
                    <Play className="h-3 w-3" /> {t('chat.resume')}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={pauseChat} className="gap-1 text-xs h-7">
                    <Pause className="h-3 w-3" /> {t('chat.pause')}
                  </Button>
                )}
                <Button size="sm" variant="destructive" onClick={() => closeChat()} className="gap-1 text-xs h-7">
                  <X className="h-3 w-3" /> {t('chat.close')}
                </Button>
              </>
            )}
            {onClose && (
              <Button size="icon" variant="ghost" onClick={onClose} className="h-7 w-7">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="text-center text-muted-foreground text-sm py-8">{t('chat.loadingMessages')}</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            {isWaiting ? t('chat.waitingForStaff') : t('chat.noMessages')}
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} isOwnMessage={msg.sender_id === user?.id} />
          ))
        )}
      </div>

      {/* Input */}
      {!isClosed && (
        <div className="border-t border-border p-3 flex-shrink-0">
          {isWaiting && !isStaff ? (
            <div className="text-center text-sm text-muted-foreground py-2">
              <Clock className="h-4 w-4 inline mr-1" />
              {t('chat.waitingMessage')}
            </div>
          ) : isPaused ? (
            <div className="text-center text-sm text-muted-foreground py-2">
              {t('chat.pausedMessage')}
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('chat.placeholder')}
                disabled={!canSend || sending}
                className="flex-1"
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!canSend || !newMessage.trim() || sending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function MessageBubble({ message, isOwnMessage }: { message: ChatMessage; isOwnMessage: boolean }) {
  if (message.message_type === 'system') {
    return (
      <div className="text-center">
        <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] ${isOwnMessage ? 'order-2' : 'order-1'}`}>
        <div
          className={`rounded-2xl px-4 py-2 text-sm ${
            isOwnMessage
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-muted text-foreground rounded-bl-md'
          }`}
        >
          {message.content}
        </div>
        <p className={`text-[10px] text-muted-foreground mt-1 ${isOwnMessage ? 'text-right' : 'text-left'}`}>
          {format(new Date(message.created_at), 'HH:mm', { locale: es })}
        </p>
      </div>
    </div>
  );
}

export default ChatWindow;
