import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Search, User, Send } from 'lucide-react';

interface UserResult {
  id: string;
  full_name: string;
  email: string;
}

interface AgentUserSearchProps {
  onSelectUser: (userId: string) => void;
  isLoading?: boolean;
}

export default function AgentUserSearch({ onSelectUser, isLoading }: AgentUserSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<UserResult | null>(null);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(10);
      setResults((data || []) as UserResult[]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuario por nombre o email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            className="pl-9"
          />
        </div>
        <Button onClick={search} disabled={searching} variant="secondary">
          Buscar
        </Button>
      </div>

      {results.length > 0 && (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {results.map((u) => (
            <Card
              key={u.id}
              className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                selected?.id === u.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelected(u)}
            >
              <CardContent className="flex items-center gap-3 p-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{u.full_name || 'Sin nombre'}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <Button
          onClick={() => onSelectUser(selected.id)}
          disabled={isLoading}
          className="w-full"
        >
          <Send className="h-4 w-4 mr-2" />
          Solicitar Acceso a {selected.full_name || selected.email}
        </Button>
      )}
    </div>
  );
}
