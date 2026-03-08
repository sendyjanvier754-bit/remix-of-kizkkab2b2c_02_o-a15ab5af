import { Clock, X, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface AgentSessionTimerProps {
  targetUserName: string;
  timeRemaining: number;
  onClose: () => void;
}

export default function AgentSessionTimer({
  targetUserName,
  timeRemaining,
  onClose,
}: AgentSessionTimerProps) {
  const hours = Math.floor(timeRemaining / 3600000);
  const minutes = Math.floor((timeRemaining % 3600000) / 60000);
  const seconds = Math.floor((timeRemaining % 60000) / 1000);
  const timeStr = `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  const isLow = timeRemaining < 600000; // less than 10 min

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <User className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-medium truncate">{targetUserName}</span>
        <Badge variant={isLow ? 'destructive' : 'secondary'} className="flex items-center gap-1 shrink-0">
          <Clock className="h-3 w-3" />
          {timeStr}
        </Badge>
      </div>
      <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 shrink-0">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
