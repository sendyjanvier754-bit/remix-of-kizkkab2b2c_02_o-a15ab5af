import { useState } from 'react';
import { useChatList, SupportChat } from '@/hooks/useSupportChat';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Clock, Pause, X, User, Inbox } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es, enUS, fr as frLocale } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

const dateLocales: Record<string, any> = { es, en: enUS, fr: frLocale };

interface ChatListProps {
  onSelectChat: (chatId: string) => void;
  selectedChatId?: string | null;
  isStaff?: boolean;
}

export function ChatList({ onSelectChat, selectedChatId, isStaff = false }: ChatListProps) {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<'all' | 'waiting' | 'active' | 'mine' | 'closed'>('all');
  const { chats, isLoading } = useChatList(filter);

  const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    waiting: { label: t('chat.waiting'), color: 'bg-amber-500/20 text-amber-600 border-amber-500/30', icon: <Clock className="h-3 w-3" /> },
    active: { label: t('chat.active'), color: 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30', icon: <MessageCircle className="h-3 w-3" /> },
    paused: { label: t('chat.paused'), color: 'bg-muted text-muted-foreground', icon: <Pause className="h-3 w-3" /> },
    closed: { label: t('chat.closed'), color: 'bg-destructive/20 text-destructive', icon: <X className="h-3 w-3" /> },
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-3 px-4 border-b border-border flex-shrink-0">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Inbox className="h-4 w-4" />
          {isStaff ? t('header.support') : 'Live Chat'}
        </CardTitle>
      </CardHeader>
      
      {isStaff && (
        <div className="px-3 pt-3 flex-shrink-0">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
            <TabsList className="w-full grid grid-cols-4 h-8">
              <TabsTrigger value="waiting" className="text-[10px] px-1">
                <Clock className="h-3 w-3 mr-1" /> {t('chat.waiting')}
              </TabsTrigger>
              <TabsTrigger value="active" className="text-[10px] px-1">
                <MessageCircle className="h-3 w-3 mr-1" /> {t('chat.active')}
              </TabsTrigger>
              <TabsTrigger value="mine" className="text-[10px] px-1">
                <User className="h-3 w-3 mr-1" /> {t('header.account')}
              </TabsTrigger>
              <TabsTrigger value="closed" className="text-[10px] px-1">
                <X className="h-3 w-3 mr-1" /> {t('chat.closed')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="text-center text-muted-foreground text-sm py-8">{t('common.loading')}</div>
          ) : chats.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
              {t('common.noResults')}
            </div>
          ) : (
            chats.map((chat) => (
              <ChatListItem
                key={chat.id}
                chat={chat}
                isSelected={selectedChatId === chat.id}
                isStaff={isStaff}
                onClick={() => onSelectChat(chat.id)}
                statusConfig={statusConfig}
                locale={dateLocales[i18n.language] || es}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}

function ChatListItem({ chat, isSelected, isStaff, onClick, statusConfig, locale }: { 
  chat: SupportChat; isSelected: boolean; isStaff: boolean; onClick: () => void;
  statusConfig: Record<string, any>; locale: any;
}) {
  const status = statusConfig[chat.status];
  const unread = isStaff ? chat.unread_staff : chat.unread_customer;
  const timeAgo = chat.last_message_at
    ? formatDistanceToNow(new Date(chat.last_message_at), { addSuffix: true, locale })
    : formatDistanceToNow(new Date(chat.created_at), { addSuffix: true, locale });

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg p-3 transition-colors ${
        isSelected 
          ? 'bg-primary/10 border border-primary/20' 
          : 'hover:bg-muted/60 border border-transparent'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate text-foreground">{chat.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${status?.color}`}>
              {status?.icon}
              <span className="ml-1">{status?.label}</span>
            </Badge>
            <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
          </div>
        </div>
        {unread > 0 && (
          <Badge className="bg-primary text-primary-foreground text-[10px] h-5 min-w-[20px] flex items-center justify-center">
            {unread}
          </Badge>
        )}
      </div>
    </button>
  );
}

export default ChatList;
