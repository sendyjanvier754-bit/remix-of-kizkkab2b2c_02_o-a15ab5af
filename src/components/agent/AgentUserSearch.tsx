import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, User, Send, Loader2 } from 'lucide-react';

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
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-search on typing (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,user_code.ilike.%${query}%`)
          .limit(8);
        setResults((data || []) as UserResult[]);
        setShowDropdown(true);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (user: UserResult) => {
    setSelected(user);
    setQuery(user.email);
    setShowDropdown(false);
  };

  return (
    <div className="space-y-4">
      <div ref={containerRef} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Escribe nombre, email o ID del usuario..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
            className="pl-9 pr-9"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
          )}
        </div>

        {showDropdown && results.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {results.map((u) => (
              <button
                key={u.id}
                type="button"
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors text-left first:rounded-t-lg last:rounded-b-lg"
                onClick={() => handleSelect(u)}
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{u.full_name || 'Sin nombre'}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                  {u.id.slice(0, 8)}
                </span>
              </button>
            ))}
          </div>
        )}

        {showDropdown && query.length >= 2 && results.length === 0 && !searching && (
          <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg px-4 py-3 text-sm text-muted-foreground">
            No se encontraron usuarios
          </div>
        )}
      </div>

      {selected && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{selected.full_name || 'Sin nombre'}</p>
            <p className="text-xs text-muted-foreground">{selected.email}</p>
          </div>
          <Button
            onClick={() => onSelectUser(selected.id)}
            disabled={isLoading}
            size="sm"
          >
            <Send className="h-4 w-4 mr-2" />
            Solicitar Acceso
          </Button>
        </div>
      )}
    </div>
  );
}
