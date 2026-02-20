import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePaymentMethods, PaymentMethodInput } from '@/hooks/usePaymentMethods';
import { useCountriesRoutes } from '@/hooks/useCountriesRoutes';
import { Building2, Smartphone, CreditCard, Save, Loader2, Zap, Hand, AlertCircle, Key, Globe, Trash2, PencilLine } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function AdminPaymentMethodsPage() {
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const { methods, isLoading, upsertMethod, getMethodByType, deleteMethod, refetch } = usePaymentMethods('admin', undefined, selectedCountryId);
  // All methods across all countries — for the list table
  const { methods: allMethods, refetch: refetchAll } = usePaymentMethods('admin');
  const { countries, isLoading: loadingCountries } = useCountriesRoutes();
  const { toast } = useToast();
  const [saving, setSaving] = useState<string | null>(null);

  // Bank form state
  const bankMethod = getMethodByType('bank');
  const [bankForm, setBankForm] = useState({
    bank_name: '',
    account_type: 'Ahorros',
    account_number: '',
    account_holder: '',
    bank_swift: '',
    is_active: true,
  });

  // MonCash form state - now with dual mode support
  const moncashMethod = getMethodByType('moncash');
  const [moncashForm, setMoncashForm] = useState({
    phone_number: '',
    holder_name: '',
    is_active: true,
    manual_enabled: true,
    automatic_enabled: false,
    // API credentials for automatic mode
    client_id: '',
    client_secret: '',
    business_key: '',
  });

  // NatCash form state - now with dual mode support
  const natcashMethod = getMethodByType('natcash');
  const [natcashForm, setNatcashForm] = useState({
    phone_number: '',
    holder_name: '',
    is_active: true,
    manual_enabled: true,
    automatic_enabled: false,
    // API credentials for automatic mode
    api_key: '',
    api_secret: '',
  });

  // Update forms when methods load
  useEffect(() => {
    if (bankMethod) {
      setBankForm({
        bank_name: bankMethod.bank_name || '',
        account_type: bankMethod.account_type || 'Ahorros',
        account_number: bankMethod.account_number || '',
        account_holder: bankMethod.account_holder || '',
        bank_swift: bankMethod.bank_swift || '',
        is_active: bankMethod.is_active ?? true,
      });
    }
    if (moncashMethod) {
      const meta = moncashMethod.metadata || {};
      setMoncashForm({
        phone_number: moncashMethod.phone_number || '',
        holder_name: moncashMethod.holder_name || '',
        is_active: moncashMethod.is_active ?? true,
        manual_enabled: moncashMethod.manual_enabled ?? true,
        automatic_enabled: moncashMethod.automatic_enabled ?? false,
        client_id: (meta.client_id as string) || '',
        client_secret: (meta.client_secret as string) || '',
        business_key: (meta.business_key as string) || '',
      });
    }
    if (natcashMethod) {
      const meta = natcashMethod.metadata || {};
      setNatcashForm({
        phone_number: natcashMethod.phone_number || '',
        holder_name: natcashMethod.holder_name || '',
        is_active: natcashMethod.is_active ?? true,
        manual_enabled: natcashMethod.manual_enabled ?? true,
        automatic_enabled: natcashMethod.automatic_enabled ?? false,
        api_key: (meta.api_key as string) || '',
        api_secret: (meta.api_secret as string) || '',
      });
    }
  }, [bankMethod, moncashMethod, natcashMethod]);

  const handleSaveBank = async () => {
    setSaving('bank');
    const input: PaymentMethodInput = {
      method_type: 'bank',
      display_name: 'Transferencia Bancaria',
      destination_country_id: selectedCountryId,
      ...bankForm,
    };
    await upsertMethod(input);
    await refetchAll();
    setSaving(null);
  };

  const handleSaveMoncash = async () => {
    // Validate: at least one mode must be enabled if active
    if (moncashForm.is_active && !moncashForm.manual_enabled && !moncashForm.automatic_enabled) {
      toast({
        title: 'Error',
        description: 'Debe habilitar al menos un modo (Manual o Automático)',
        variant: 'destructive',
      });
      return;
    }

    setSaving('moncash');
    const input: PaymentMethodInput = {
      method_type: 'moncash',
      display_name: 'MonCash',
      destination_country_id: selectedCountryId,
      phone_number: moncashForm.phone_number,
      holder_name: moncashForm.holder_name,
      is_active: moncashForm.is_active,
      manual_enabled: moncashForm.manual_enabled,
      automatic_enabled: moncashForm.automatic_enabled,
      metadata: moncashForm.automatic_enabled ? {
        client_id: moncashForm.client_id,
        client_secret: moncashForm.client_secret,
        business_key: moncashForm.business_key,
      } : {},
    };
    await upsertMethod(input);
    await refetch();
    setSaving(null);
  };

  const handleSaveNatcash = async () => {
    // Validate: at least one mode must be enabled if active
    if (natcashForm.is_active && !natcashForm.manual_enabled && !natcashForm.automatic_enabled) {
      toast({
        title: 'Error',
        description: 'Debe habilitar al menos un modo (Manual o Automático)',
        variant: 'destructive',
      });
      return;
    }

    setSaving('natcash');
    const input: PaymentMethodInput = {
      method_type: 'natcash',
      display_name: 'NatCash',
      destination_country_id: selectedCountryId,
      phone_number: natcashForm.phone_number,
      holder_name: natcashForm.holder_name,
      is_active: natcashForm.is_active,
      manual_enabled: natcashForm.manual_enabled,
      automatic_enabled: natcashForm.automatic_enabled,
      metadata: natcashForm.automatic_enabled ? {
        api_key: natcashForm.api_key,
        api_secret: natcashForm.api_secret,
      } : {},
    };
    await upsertMethod(input);
    await refetch();
    setSaving(null);
  };

  if (isLoading) {
    return (
      <AdminLayout title="Métodos de Pago">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  // Helper to render mode badges
  const renderModeBadges = (manual: boolean, automatic: boolean) => (
    <div className="flex gap-1 flex-wrap">
      {manual && (
        <span className="inline-flex items-center text-xs text-muted-foreground">
          <Hand className="h-3 w-3 mr-0.5" /> Manual
        </span>
      )}
      {automatic && (
        <span className="inline-flex items-center text-xs text-yellow-600">
          <Zap className="h-3 w-3 mr-0.5" /> API
        </span>
      )}
    </div>
  );

  return (
    <AdminLayout 
      title="Métodos de Pago" 
      subtitle="Configure los métodos de pago según el país de la cuenta bancaria o móvil para recibir pagos B2B"
    >
      <div className="space-y-6">
        {/* Country Selector */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Globe className="h-4 w-4" />
                País de la Cuenta
              </div>
              <Select
                value={selectedCountryId ?? '__all__'}
                onValueChange={v => setSelectedCountryId(v === '__all__' ? null : v)}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Selecciona un país..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Global (sin país específico)</SelectItem>
                  {countries?.filter(c => c.is_active).map(country => (
                    <SelectItem key={country.id} value={country.id}>
                      {country.name} ({country.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCountryId && (
                <Badge variant="outline" className="font-mono">
                  {countries?.find(c => c.id === selectedCountryId)?.code ?? selectedCountryId}
                </Badge>
              )}
              <p className="text-xs text-muted-foreground ml-auto">
                Selecciona el país donde está registrada la cuenta (banco o billetera móvil).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* All Payment Methods List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Métodos de Pago Registrados
            </CardTitle>
            <CardDescription>Lista de todos los métodos configurados por país de cuenta</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {allMethods.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No hay métodos configurados todavía.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>País de la Cuenta</TableHead>
                    <TableHead>Modo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allMethods.map(m => {
                    const country = countries?.find(c => c.id === m.destination_country_id);
                    const methodIcon = m.method_type === 'bank'
                      ? <Building2 className="h-4 w-4 text-purple-500" />
                      : m.method_type === 'moncash'
                      ? <Smartphone className="h-4 w-4" style={{ color: '#94111f' }} />
                      : <CreditCard className="h-4 w-4" style={{ color: '#071d7f' }} />;
                    return (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {methodIcon}
                            <span className="font-medium capitalize">{m.method_type}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {m.display_name || m.bank_name || m.holder_name || '—'}
                        </TableCell>
                        <TableCell>
                          {country ? (
                            <Badge variant="outline" className="gap-1 font-mono">
                              <Globe className="h-3 w-3" />
                              {country.code} — {country.name}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Global</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {m.manual_enabled && <Badge variant="secondary" className="text-xs">Manual</Badge>}
                            {m.automatic_enabled && <Badge variant="secondary" className="text-xs"><Zap className="h-3 w-3 mr-1" />Auto</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={m.is_active ? 'default' : 'secondary'}>
                            {m.is_active ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title="Editar: selecciona el país y edita en el formulario abajo"
                              onClick={() => setSelectedCountryId(m.destination_country_id)}
                            >
                              <PencilLine className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={async () => {
                                await deleteMethod(m.id);
                                await refetchAll();
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Status Overview */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className={bankMethod?.is_active ? 'border-purple-500/50' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Building2 className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="font-medium">Banco</p>
                    <p className="text-sm text-muted-foreground">
                      {bankMethod ? 'Configurado' : 'Sin configurar'}
                    </p>
                  </div>
                </div>
                <Badge variant={bankMethod?.is_active ? 'default' : 'secondary'}>
                  {bankMethod?.is_active ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className={moncashMethod?.is_active ? 'border-red-500/50' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(148, 17, 31, 0.1)' }}>
                    <Smartphone className="h-5 w-5" style={{ color: '#94111f' }} />
                  </div>
                  <div>
                    <p className="font-medium">MonCash</p>
                    <p className="text-sm text-muted-foreground">
                      {moncashMethod ? 'Configurado' : 'Sin configurar'}
                    </p>
                    {moncashMethod && renderModeBadges(
                      moncashMethod.manual_enabled,
                      moncashMethod.automatic_enabled
                    )}
                  </div>
                </div>
                <Badge variant={moncashMethod?.is_active ? 'default' : 'secondary'}>
                  {moncashMethod?.is_active ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className={natcashMethod?.is_active ? 'border-blue-500/50' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(7, 29, 127, 0.1)' }}>
                    <CreditCard className="h-5 w-5" style={{ color: '#071d7f' }} />
                  </div>
                  <div>
                    <p className="font-medium">NatCash</p>
                    <p className="text-sm text-muted-foreground">
                      {natcashMethod ? 'Configurado' : 'Sin configurar'}
                    </p>
                    {natcashMethod && renderModeBadges(
                      natcashMethod.manual_enabled,
                      natcashMethod.automatic_enabled
                    )}
                  </div>
                </div>
                <Badge variant={natcashMethod?.is_active ? 'default' : 'secondary'}>
                  {natcashMethod?.is_active ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Configuration Tabs */}
        <Tabs defaultValue="bank" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="bank" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Banco
            </TabsTrigger>
            <TabsTrigger value="moncash" className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              MonCash
            </TabsTrigger>
            <TabsTrigger value="natcash" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              NatCash
            </TabsTrigger>
          </TabsList>

          {/* Bank Tab */}
          <TabsContent value="bank">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-purple-500" />
                  Transferencia Bancaria
                </CardTitle>
                <CardDescription>
                  Configure los datos bancarios para recibir transferencias de los sellers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={bankForm.is_active}
                    onCheckedChange={(v) => setBankForm({ ...bankForm, is_active: v })}
                  />
                  <Label>Método activo</Label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bank_name">Nombre del Banco</Label>
                    <Input
                      id="bank_name"
                      placeholder="Ej: Banco Nacional de Haití"
                      value={bankForm.bank_name}
                      onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account_type">Tipo de Cuenta</Label>
                    <Input
                      id="account_type"
                      placeholder="Ej: Ahorros, Corriente"
                      value={bankForm.account_type}
                      onChange={(e) => setBankForm({ ...bankForm, account_type: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="account_number">Número de Cuenta</Label>
                    <Input
                      id="account_number"
                      placeholder="Ej: 001-234567-89"
                      value={bankForm.account_number}
                      onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account_holder">Titular de la Cuenta</Label>
                    <Input
                      id="account_holder"
                      placeholder="Ej: Siver Market 509 SRL"
                      value={bankForm.account_holder}
                      onChange={(e) => setBankForm({ ...bankForm, account_holder: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bank_swift">Código SWIFT (opcional)</Label>
                  <Input
                    id="bank_swift"
                    placeholder="Ej: BNHAHTHX"
                    value={bankForm.bank_swift}
                    onChange={(e) => setBankForm({ ...bankForm, bank_swift: e.target.value })}
                  />
                </div>

                <Button 
                  onClick={handleSaveBank} 
                  disabled={saving === 'bank'}
                  className="w-full md:w-auto"
                >
                  {saving === 'bank' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Guardar Datos Bancarios
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MonCash Tab */}
          <TabsContent value="moncash">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" style={{ color: '#94111f' }} />
                  MonCash
                </CardTitle>
                <CardDescription>
                  Configure los datos de MonCash para recibir pagos móviles. Puede habilitar ambos modos para que el cliente elija.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={moncashForm.is_active}
                    onCheckedChange={(v) => setMoncashForm({ ...moncashForm, is_active: v })}
                  />
                  <Label>Método activo</Label>
                </div>

                {/* Dual Mode Selection */}
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                  <Label className="text-base font-medium">Modos de Pago Disponibles</Label>
                  <p className="text-sm text-muted-foreground">
                    Habilite los modos que desea ofrecer. El cliente podrá elegir al momento de pagar.
                  </p>
                  
                  <div className="space-y-3">
                    {/* Manual Mode */}
                    <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50">
                      <Checkbox
                        id="moncash-manual"
                        checked={moncashForm.manual_enabled}
                        onCheckedChange={(checked) => 
                          setMoncashForm({ ...moncashForm, manual_enabled: checked as boolean })
                        }
                      />
                      <div className="flex-1">
                        <Label htmlFor="moncash-manual" className="flex items-center gap-2 cursor-pointer">
                          <Hand className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Pago Manual</span>
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          El cliente paga y proporciona referencia. Admin confirma manualmente.
                        </p>
                      </div>
                    </div>

                    {/* Automatic Mode */}
                    <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50">
                      <Checkbox
                        id="moncash-automatic"
                        checked={moncashForm.automatic_enabled}
                        onCheckedChange={(checked) => 
                          setMoncashForm({ ...moncashForm, automatic_enabled: checked as boolean })
                        }
                      />
                      <div className="flex-1">
                        <Label htmlFor="moncash-automatic" className="flex items-center gap-2 cursor-pointer">
                          <Zap className="h-4 w-4 text-yellow-500" />
                          <span className="font-medium">Pago Automático (API)</span>
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Integración con API de MonCash. Verificación automática de pagos.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Basic Info - Always shown */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="moncash_phone">Número de Teléfono</Label>
                    <Input
                      id="moncash_phone"
                      placeholder="Ej: +509 3XXX XXXX"
                      value={moncashForm.phone_number}
                      onChange={(e) => setMoncashForm({ ...moncashForm, phone_number: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="moncash_name">Nombre en MonCash</Label>
                    <Input
                      id="moncash_name"
                      placeholder="Ej: Siver Market 509"
                      value={moncashForm.holder_name}
                      onChange={(e) => setMoncashForm({ ...moncashForm, holder_name: e.target.value })}
                    />
                  </div>
                </div>

                {/* API Credentials - Only shown when automatic is enabled */}
                {moncashForm.automatic_enabled && (
                  <div className="space-y-4 p-4 border rounded-lg bg-yellow-50/50 border-yellow-200">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Key className="h-4 w-4" />
                      Credenciales API de MonCash
                    </div>
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Obtenga estas credenciales desde el portal de desarrolladores de MonCash (Digicel Business)
                      </AlertDescription>
                    </Alert>
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="moncash_client_id">Client ID</Label>
                        <Input
                          id="moncash_client_id"
                          type="password"
                          placeholder="Ingrese su Client ID"
                          value={moncashForm.client_id}
                          onChange={(e) => setMoncashForm({ ...moncashForm, client_id: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="moncash_client_secret">Client Secret</Label>
                        <Input
                          id="moncash_client_secret"
                          type="password"
                          placeholder="Ingrese su Client Secret"
                          value={moncashForm.client_secret}
                          onChange={(e) => setMoncashForm({ ...moncashForm, client_secret: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="moncash_business_key">Business Key</Label>
                        <Input
                          id="moncash_business_key"
                          type="password"
                          placeholder="Ingrese su Business Key"
                          value={moncashForm.business_key}
                          onChange={(e) => setMoncashForm({ ...moncashForm, business_key: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <Button 
                  onClick={handleSaveMoncash} 
                  disabled={saving === 'moncash'}
                  className="w-full md:w-auto"
                  style={{ backgroundColor: '#94111f' }}
                >
                  {saving === 'moncash' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Guardar MonCash
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* NatCash Tab */}
          <TabsContent value="natcash">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" style={{ color: '#071d7f' }} />
                  NatCash
                </CardTitle>
                <CardDescription>
                  Configure los datos de NatCash para recibir pagos móviles. Puede habilitar ambos modos para que el cliente elija.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={natcashForm.is_active}
                    onCheckedChange={(v) => setNatcashForm({ ...natcashForm, is_active: v })}
                  />
                  <Label>Método activo</Label>
                </div>

                {/* Dual Mode Selection */}
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                  <Label className="text-base font-medium">Modos de Pago Disponibles</Label>
                  <p className="text-sm text-muted-foreground">
                    Habilite los modos que desea ofrecer. El cliente podrá elegir al momento de pagar.
                  </p>
                  
                  <div className="space-y-3">
                    {/* Manual Mode */}
                    <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50">
                      <Checkbox
                        id="natcash-manual"
                        checked={natcashForm.manual_enabled}
                        onCheckedChange={(checked) => 
                          setNatcashForm({ ...natcashForm, manual_enabled: checked as boolean })
                        }
                      />
                      <div className="flex-1">
                        <Label htmlFor="natcash-manual" className="flex items-center gap-2 cursor-pointer">
                          <Hand className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Pago Manual</span>
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          El cliente paga y proporciona referencia. Admin confirma manualmente.
                        </p>
                      </div>
                    </div>

                    {/* Automatic Mode */}
                    <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50">
                      <Checkbox
                        id="natcash-automatic"
                        checked={natcashForm.automatic_enabled}
                        onCheckedChange={(checked) => 
                          setNatcashForm({ ...natcashForm, automatic_enabled: checked as boolean })
                        }
                      />
                      <div className="flex-1">
                        <Label htmlFor="natcash-automatic" className="flex items-center gap-2 cursor-pointer">
                          <Zap className="h-4 w-4 text-yellow-500" />
                          <span className="font-medium">Pago Automático (API)</span>
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Integración con API de NatCash (si disponible). Verificación automática de pagos.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Basic Info - Always shown */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="natcash_phone">Número de Teléfono</Label>
                    <Input
                      id="natcash_phone"
                      placeholder="Ej: +509 3XXX XXXX"
                      value={natcashForm.phone_number}
                      onChange={(e) => setNatcashForm({ ...natcashForm, phone_number: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="natcash_name">Nombre en NatCash</Label>
                    <Input
                      id="natcash_name"
                      placeholder="Ej: Siver Market 509"
                      value={natcashForm.holder_name}
                      onChange={(e) => setNatcashForm({ ...natcashForm, holder_name: e.target.value })}
                    />
                  </div>
                </div>

                {/* API Credentials - Only shown when automatic is enabled */}
                {natcashForm.automatic_enabled && (
                  <div className="space-y-4 p-4 border rounded-lg bg-blue-50/50 border-blue-200">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Key className="h-4 w-4" />
                      Credenciales API de NatCash
                    </div>
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Obtenga estas credenciales desde el portal de desarrolladores de NatCash (Natcom)
                      </AlertDescription>
                    </Alert>
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="natcash_api_key">API Key</Label>
                        <Input
                          id="natcash_api_key"
                          type="password"
                          placeholder="Ingrese su API Key"
                          value={natcashForm.api_key}
                          onChange={(e) => setNatcashForm({ ...natcashForm, api_key: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="natcash_api_secret">API Secret</Label>
                        <Input
                          id="natcash_api_secret"
                          type="password"
                          placeholder="Ingrese su API Secret"
                          value={natcashForm.api_secret}
                          onChange={(e) => setNatcashForm({ ...natcashForm, api_secret: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <Button 
                  onClick={handleSaveNatcash} 
                  disabled={saving === 'natcash'}
                  className="w-full md:w-auto"
                  style={{ backgroundColor: '#071d7f' }}
                >
                  {saving === 'natcash' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Guardar NatCash
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Info Card */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium mb-1">Sobre los métodos de pago</h4>
                <p className="text-sm text-muted-foreground">
                  Los métodos de pago configurados aquí se mostrarán a los sellers (B2B) y clientes (B2C) cuando realicen 
                  compras en la plataforma. Cuando habilita ambos modos (Manual y Automático), el cliente puede elegir 
                  cómo prefiere pagar. Los pagos con tarjeta se procesan automáticamente a través de Stripe.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}