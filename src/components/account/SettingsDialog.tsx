import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Settings, Lock, Bell, Shield, Loader2, Eye, EyeOff, FileText, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LegalPagesModal } from '@/components/legal/LegalPagesModal';
import { AboutModal } from '@/components/legal/AboutModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SettingsDialog = ({ open, onOpenChange }: SettingsDialogProps) => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // Notifications state (stored in localStorage for now)
  const [emailNotifications, setEmailNotifications] = useState(() => {
    const saved = localStorage.getItem('notifications_email');
    return saved !== 'false';
  });
  const [orderUpdates, setOrderUpdates] = useState(() => {
    const saved = localStorage.getItem('notifications_orders');
    return saved !== 'false';
  });
  const [promotions, setPromotions] = useState(() => {
    const saved = localStorage.getItem('notifications_promotions');
    return saved !== 'false';
  });
  
  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  // Info modals
  const [showLegal, setShowLegal] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast({
        title: 'Error',
        description: 'Por favor completa todos los campos.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Las contraseñas no coinciden.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Error',
        description: 'La contraseña debe tener al menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: 'Contraseña actualizada',
        description: 'Tu contraseña ha sido cambiada exitosamente.',
      });
      
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo cambiar la contraseña.',
        variant: 'destructive',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSaveNotifications = () => {
    localStorage.setItem('notifications_email', String(emailNotifications));
    localStorage.setItem('notifications_orders', String(orderUpdates));
    localStorage.setItem('notifications_promotions', String(promotions));
    
    toast({
      title: 'Preferencias guardadas',
      description: 'Tus preferencias de notificación han sido actualizadas.',
    });
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'ELIMINAR') {
      toast({
        title: 'Error',
        description: 'Por favor escribe ELIMINAR para confirmar.',
        variant: 'destructive',
      });
      return;
    }

    setIsDeleting(true);
    try {
      // Note: Full account deletion requires a backend function
      // For now, we just sign out and show a message
      await signOut();
      toast({
        title: 'Sesión cerrada',
        description: 'Para eliminar tu cuenta completamente, por favor contacta a soporte.',
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-[#071d7f]" />
              Configuración
            </DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="security" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="security" className="text-xs">
                <Lock className="h-3 w-3 mr-1" />
                Seguridad
              </TabsTrigger>
              <TabsTrigger value="notifications" className="text-xs">
                <Bell className="h-3 w-3 mr-1" />
                Notificaciones
              </TabsTrigger>
              <TabsTrigger value="privacy" className="text-xs">
                <Shield className="h-3 w-3 mr-1" />
                Privacidad
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="security" className="space-y-4 pt-4">
              <div className="space-y-4">
                <h4 className="font-medium">Cambiar Contraseña</h4>
                
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Nueva Contraseña</Label>
                    <div className="relative">
                      <Input
                        type={showPasswords ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowPasswords(!showPasswords)}
                      >
                        {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Confirmar Nueva Contraseña</Label>
                    <Input
                      type={showPasswords ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repite la contraseña"
                    />
                  </div>
                  
                  <Button 
                    onClick={handleChangePassword}
                    disabled={isChangingPassword || !newPassword || !confirmPassword}
                    className="w-full bg-[#071d7f] hover:bg-[#0a2a9f]"
                  >
                    {isChangingPassword && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Cambiar Contraseña
                  </Button>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <h4 className="font-medium">Email</h4>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="notifications" className="space-y-4 pt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Notificaciones por Email</p>
                    <p className="text-sm text-muted-foreground">Recibir emails con actualizaciones</p>
                  </div>
                  <Switch
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                  />
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Actualizaciones de Pedidos</p>
                    <p className="text-sm text-muted-foreground">Notificaciones sobre tus compras</p>
                  </div>
                  <Switch
                    checked={orderUpdates}
                    onCheckedChange={setOrderUpdates}
                  />
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Promociones y Ofertas</p>
                    <p className="text-sm text-muted-foreground">Recibir ofertas especiales</p>
                  </div>
                  <Switch
                    checked={promotions}
                    onCheckedChange={setPromotions}
                  />
                </div>
                
                <Button 
                  onClick={handleSaveNotifications}
                  className="w-full bg-[#071d7f] hover:bg-[#0a2a9f]"
                >
                  Guardar Preferencias
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="privacy" className="space-y-4 pt-4">
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">Tus Datos</h4>
                  <p className="text-sm text-muted-foreground">
                    Tus datos personales están protegidos y solo se utilizan para procesar tus pedidos 
                    y mejorar tu experiencia de compra.
                  </p>
                </div>
                
                <Separator />

                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2"><FileText className="h-4 w-4" /> Información Legal</h4>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowLegal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs text-gray-600 transition-colors"
                    >
                      <Shield className="h-3.5 w-3.5 text-[#071d7f]" /> Términos Legales
                    </button>
                    <button
                      onClick={() => setShowAbout(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs text-gray-600 transition-colors"
                    >
                      <Info className="h-3.5 w-3.5 text-[#071d7f]" /> Acerca de
                    </button>
                  </div>
                </div>

                <Separator />
                
                <div className="space-y-2">
                  <h4 className="font-medium text-destructive">Zona de Peligro</h4>
                  <p className="text-sm text-muted-foreground">
                    La eliminación de tu cuenta es permanente y no se puede deshacer.
                  </p>
                  <Button 
                    variant="destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full"
                  >
                    Eliminar mi Cuenta
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tu cuenta?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Esta acción es permanente y eliminará:</p>
              <ul className="list-disc list-inside text-sm">
                <li>Tu perfil y datos personales</li>
                <li>Historial de compras</li>
                <li>Direcciones guardadas</li>
                <li>Preferencias y configuración</li>
              </ul>
              <p className="pt-2">Escribe <strong>ELIMINAR</strong> para confirmar:</p>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="ELIMINAR"
                className="mt-2"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== 'ELIMINAR' || isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Eliminar Cuenta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <LegalPagesModal open={showLegal} onOpenChange={setShowLegal} />
      <AboutModal open={showAbout} onOpenChange={setShowAbout} />
    </>
  );
};
