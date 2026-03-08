import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Trash2, Eye } from 'lucide-react';

interface Draft {
  id: string;
  label: string;
  status: string;
  target_user_id: string;
  created_at: string;
  updated_at: string;
  target_profile?: { full_name: string; email: string };
}

interface AgentDraftListProps {
  drafts: Draft[];
  activeDraftId: string | null;
  onSelect: (draft: Draft) => void;
  onCancel: (draftId: string) => void;
}

export default function AgentDraftList({
  drafts,
  activeDraftId,
  onSelect,
  onCancel,
}: AgentDraftListProps) {
  if (drafts.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        No hay borradores activos
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Borradores ({drafts.length})
      </h4>
      {drafts.map((draft) => (
        <Card
          key={draft.id}
          className={`cursor-pointer transition-all hover:shadow-md ${
            activeDraftId === draft.id ? 'ring-2 ring-primary shadow-md' : ''
          }`}
          onClick={() => onSelect(draft)}
        >
          <CardContent className="flex items-center gap-3 p-3">
            <FileText className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{draft.label}</p>
              <p className="text-xs text-muted-foreground truncate">
                {draft.target_profile?.full_name || draft.target_user_id}
              </p>
            </div>
            <Badge variant={draft.status === 'draft' ? 'default' : 'secondary'}>
              {draft.status === 'draft' ? 'Activo' : 'Enviado'}
            </Badge>
            {draft.status === 'draft' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={(e) => { e.stopPropagation(); onCancel(draft.id); }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
