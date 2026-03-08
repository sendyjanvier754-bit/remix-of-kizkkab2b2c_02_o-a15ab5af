import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';

interface AgentShippingConfigProps {
  shippingAddress: any;
  onUpdate: (address: any) => void;
  marketCountry: string | null;
  onUpdateCountry: (country: string) => void;
}

interface Country { id: string; name: string; code: string; }
interface Department { id: string; name: string; code: string; }
interface Commune { id: string; name: string; code: string; }

export default function AgentShippingConfig({
  shippingAddress,
  onUpdate,
  marketCountry,
  onUpdateCountry,
}: AgentShippingConfigProps) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [selectedCountry, setSelectedCountry] = useState(shippingAddress?.country_id || '');
  const [selectedDept, setSelectedDept] = useState(shippingAddress?.department_id || '');
  const [selectedCommune, setSelectedCommune] = useState(shippingAddress?.commune_id || '');

  useEffect(() => {
    supabase
      .from('destination_countries')
      .select('id, name, code')
      .eq('is_active', true)
      .then(({ data }) => setCountries((data || []) as Country[]));
  }, []);

  useEffect(() => {
    if (!selectedCountry) return;
    // Update market country when country changes
    const country = countries.find(c => c.id === selectedCountry);
    if (country) onUpdateCountry(country.code);

    supabase
      .from('departments')
      .select('id, name, code')
      .eq('is_active', true)
      .then(({ data }) => setDepartments((data || []) as Department[]));
  }, [selectedCountry, countries]);

  useEffect(() => {
    if (!selectedDept) return;
    supabase
      .from('communes')
      .select('id, name, code')
      .eq('department_id', selectedDept)
      .eq('is_active', true)
      .then(({ data }) => setCommunes((data || []) as Commune[]));
  }, [selectedDept]);

  useEffect(() => {
    onUpdate({
      country_id: selectedCountry,
      department_id: selectedDept,
      commune_id: selectedCommune,
      country_name: countries.find(c => c.id === selectedCountry)?.name,
      department_name: departments.find(d => d.id === selectedDept)?.name,
      commune_name: communes.find(c => c.id === selectedCommune)?.name,
    });
  }, [selectedCountry, selectedDept, selectedCommune]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Configuración de Envío
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">País de destino</label>
          <Select value={selectedCountry} onValueChange={setSelectedCountry}>
            <SelectTrigger><SelectValue placeholder="Seleccionar país" /></SelectTrigger>
            <SelectContent>
              {countries.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Departamento</label>
          <Select value={selectedDept} onValueChange={(v) => { setSelectedDept(v); setSelectedCommune(''); }}>
            <SelectTrigger><SelectValue placeholder="Seleccionar departamento" /></SelectTrigger>
            <SelectContent>
              {departments.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedDept && (
          <div>
            <label className="text-xs font-medium text-muted-foreground">Comuna / Nodo Local</label>
            <Select value={selectedCommune} onValueChange={setSelectedCommune}>
              <SelectTrigger><SelectValue placeholder="Seleccionar comuna" /></SelectTrigger>
              <SelectContent>
                {communes.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
