/**
 * Siver Match Hub - Main landing page for the B2B2C ecosystem
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSiverMatch } from '@/hooks/useSiverMatch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLogisticsEngine } from '@/hooks/useLogisticsEngine';
import {
  Users,
  TrendingUp,
  Package,
  Shield,
  Star,
  ArrowRight,
  Briefcase,
  Store,
  Globe,
  MapPin,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

const SiverMatchHub = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { useMyProfiles, createProfile } = useSiverMatch();
  const { useDepartments, useCommunes } = useLogisticsEngine();
  
  const { data: myProfiles, isLoading: loadingProfiles } = useMyProfiles();
  const { data: departments } = useDepartments();
  
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'investor' | 'gestor' | null>(null);
  const [formData, setFormData] = useState({
    display_name: user?.name || '',
    bio: '',
    phone: '',
    department_id: '',
    commune_id: '',
  });
  
  const selectedDepartment = formData.department_id;
  const { data: communes } = useCommunes(selectedDepartment || undefined);

  const hasInvestorProfile = myProfiles?.some(p => p.role === 'investor');
  const hasGestorProfile = myProfiles?.some(p => p.role === 'gestor');

  const handleCreateProfile = async () => {
    if (!selectedRole) return;
    
    try {
      await createProfile.mutateAsync({
        role: selectedRole,
        display_name: formData.display_name,
        bio: formData.bio || undefined,
        phone: formData.phone || undefined,
        department_id: selectedRole === 'gestor' ? formData.department_id || undefined : undefined,
        commune_id: selectedRole === 'gestor' ? formData.commune_id || undefined : undefined,
      });
      
      setShowOnboarding(false);
      setSelectedRole(null);
      
      // Navigate to appropriate dashboard
      if (selectedRole === 'investor') {
        navigate('/siver-match/investor');
      } else {
        navigate('/siver-match/gestor');
      }
    } catch (error) {
      // Error handled by mutation
    }
  };

  const startOnboarding = (role: 'investor' | 'gestor') => {
    if (!user) {
      toast.error('Debes iniciar sesión primero');
      navigate('/login');
      return;
    }
    setSelectedRole(role);
    setFormData(prev => ({ ...prev, display_name: user?.name || '' }));
    setShowOnboarding(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Hero Section */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-5" />
        <div className="container mx-auto text-center relative z-10">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
            Nuevo Ecosistema B2B2C
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-blue-600 to-purple-600 bg-clip-text text-transparent">
            Siver Match
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Conectamos Capital con Fuerza de Venta. Invierte desde cualquier lugar, 
            vende en Haití. Siver Market es tu garante logístico y financiero.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {hasInvestorProfile ? (
              <Button size="lg" onClick={() => navigate('/siver-match/investor')}>
                <Briefcase className="mr-2 h-5 w-5" />
                Ir a Mi Portal Inversor
              </Button>
            ) : (
              <Button size="lg" onClick={() => startOnboarding('investor')}>
                <Globe className="mr-2 h-5 w-5" />
                Quiero Invertir
              </Button>
            )}
            
            {hasGestorProfile ? (
              <Button size="lg" variant="outline" onClick={() => navigate('/siver-match/gestor')}>
                <Store className="mr-2 h-5 w-5" />
                Ir a Mi Portal Gestor
              </Button>
            ) : (
              <Button size="lg" variant="outline" onClick={() => startOnboarding('gestor')}>
                <MapPin className="mr-2 h-5 w-5" />
                Quiero Vender
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">¿Cómo Funciona?</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="relative overflow-hidden group hover:shadow-lg transition-all">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
              <CardHeader>
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                  <Briefcase className="h-6 w-6 text-blue-500" />
                </div>
                <CardTitle>1. Inversor Publica</CardTitle>
                <CardDescription>
                  Desde cualquier parte del mundo, compra stock en China/USA y publícalo en Siver Match
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Define precio y comisión para gestores
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Tracking automático desde China
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Stock custodiado en Hub Siver
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden group hover:shadow-lg transition-all">
              <div className="absolute top-0 left-0 w-1 h-full bg-green-500" />
              <CardHeader>
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-green-500" />
                </div>
                <CardTitle>2. Gestor Vende</CardTitle>
                <CardDescription>
                  Emprendedores locales solicitan vender el stock y ganan comisión por cada venta
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Sin inversión inicial necesaria
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Comisión fija por unidad vendida
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Sistema de reputación y badges
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden group hover:shadow-lg transition-all">
              <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />
              <CardHeader>
                <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-purple-500" />
                </div>
                <CardTitle>3. Siver Garantiza</CardTitle>
                <CardDescription>
                  El dinero va a escrow de Siver. Al confirmar entrega, se reparte automáticamente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Pagos protegidos en escrow
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Split automático al entregar
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    QR de recogida solo con pago confirmado
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Card className="text-center p-6">
              <div className="text-3xl font-bold text-primary">$0</div>
              <div className="text-sm text-muted-foreground">Inversión mínima gestor</div>
            </Card>
            <Card className="text-center p-6">
              <div className="text-3xl font-bold text-primary">100%</div>
              <div className="text-sm text-muted-foreground">Pagos asegurados</div>
            </Card>
            <Card className="text-center p-6">
              <div className="text-3xl font-bold text-primary">10</div>
              <div className="text-sm text-muted-foreground">Departamentos cubiertos</div>
            </Card>
            <Card className="text-center p-6">
              <div className="text-3xl font-bold text-primary">5%</div>
              <div className="text-sm text-muted-foreground">Fee plataforma</div>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-primary/10 via-blue-500/10 to-purple-500/10">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">¿Listo para comenzar?</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Ya sea que tengas capital para invertir o ganas de emprender, Siver Match te conecta con oportunidades reales.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="gap-2" onClick={() => startOnboarding('investor')}>
              Comenzar como Inversor <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="secondary" className="gap-2" onClick={() => startOnboarding('gestor')}>
              Comenzar como Gestor <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Onboarding Dialog */}
      <Dialog open={showOnboarding} onOpenChange={setShowOnboarding}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedRole === 'investor' ? (
                <>
                  <Briefcase className="h-5 w-5 text-blue-500" />
                  Registro de Inversor
                </>
              ) : (
                <>
                  <Store className="h-5 w-5 text-green-500" />
                  Registro de Gestor
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedRole === 'investor' 
                ? 'Completa tu perfil para comenzar a publicar stock'
                : 'Completa tu perfil para comenzar a vender'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre a mostrar *</Label>
              <Input
                value={formData.display_name}
                onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                placeholder="Tu nombre o nombre de negocio"
              />
            </div>

            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+509..."
              />
            </div>

            <div className="space-y-2">
              <Label>Bio / Descripción</Label>
              <Textarea
                value={formData.bio}
                onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                placeholder={selectedRole === 'investor' 
                  ? 'Cuéntanos sobre tu experiencia en inversiones...'
                  : 'Cuéntanos sobre tu experiencia en ventas...'
                }
                rows={3}
              />
            </div>

            {selectedRole === 'gestor' && (
              <>
                <div className="space-y-2">
                  <Label>Departamento *</Label>
                  <Select
                    value={formData.department_id}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, department_id: v, commune_id: '' }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments?.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Comuna</Label>
                  <Select
                    value={formData.commune_id}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, commune_id: v }))}
                    disabled={!formData.department_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona comuna" />
                    </SelectTrigger>
                    <SelectContent>
                      {communes?.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOnboarding(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateProfile}
              disabled={!formData.display_name || createProfile.isPending}
            >
              {createProfile.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Crear Perfil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SiverMatchHub;
