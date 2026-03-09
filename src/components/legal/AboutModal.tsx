import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useBranding } from '@/hooks/useBranding';
import { Info, ShoppingBag, TrendingUp, Truck, Shield, Globe, Users, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface AboutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DefaultAbout({ platformName }: { platformName: string }) {
  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">Sobre {platformName}</h2>
        <p className="text-muted-foreground">Conectando el comercio global con el Caribe.</p>
      </div>
      <div>
        <h3 className="font-semibold text-foreground mb-2">Nuestra Misión</h3>
        <p className="text-foreground/90 leading-relaxed">
          {platformName} nació con la misión de democratizar el acceso a productos internacionales de calidad para los consumidores del Caribe. Conectamos fabricantes y proveedores globales con emprendedores y clientes finales, eliminando las barreras del comercio internacional.
        </p>
      </div>
      <div>
        <h3 className="font-semibold text-foreground mb-3">¿Qué Hacemos?</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: ShoppingBag, title: 'Marketplace B2C', desc: 'Compra productos de vendedores locales verificados.' },
            { icon: TrendingUp, title: 'Plataforma B2B', desc: 'Importa lotes al por mayor para revender.' },
            { icon: Truck, title: 'Logística Integrada', desc: 'Red logística con puntos de recogida y entrega.' },
            { icon: Shield, title: 'Control de Calidad', desc: 'Verificamos la calidad de cada producto.' },
          ].map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="bg-muted/30">
              <CardContent className="pt-4 pb-3 px-3">
                <Icon className="h-6 w-6 text-primary mb-2" />
                <h4 className="font-semibold text-xs mb-1">{title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <div>
        <h3 className="font-semibold text-foreground mb-3">Nuestros Valores</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { icon: Globe, label: 'Accesibilidad', desc: 'Productos al alcance de todos.' },
            { icon: Shield, label: 'Confianza', desc: 'Transacciones seguras.' },
            { icon: Users, label: 'Comunidad', desc: 'Empoderando emprendedores.' },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="p-3">
              <Icon className="h-6 w-6 text-primary mx-auto mb-1" />
              <h4 className="font-semibold text-xs mb-1">{label}</h4>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DefaultAffiliate({ platformName }: { platformName: string }) {
  return (
    <div className="space-y-4 text-sm text-foreground/90 leading-relaxed">
      <div className="flex items-center gap-2 mb-2">
        <Star className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Programa de Afiliados</h2>
      </div>
      <p>Únete al programa de afiliados de {platformName} y gana comisiones por cada venta que refieras a nuestra plataforma.</p>

      <h3 className="font-semibold mt-4">¿Cómo Funciona?</h3>
      <ol className="list-decimal pl-5 space-y-2">
        <li>Regístrate como afiliado en nuestra plataforma.</li>
        <li>Obtén tu enlace de referido único.</li>
        <li>Comparte el enlace con tu audiencia.</li>
        <li>Gana una comisión por cada compra realizada a través de tu enlace.</li>
      </ol>

      <h3 className="font-semibold mt-4">Términos del Programa</h3>
      <ul className="list-disc pl-5 space-y-1">
        <li>El programa está disponible para todos los usuarios registrados.</li>
        <li>Las comisiones se acreditan dentro de los 30 días posteriores a la compra confirmada.</li>
        <li>Las ventas canceladas o devueltas no generan comisión.</li>
        <li>{platformName} se reserva el derecho de modificar las tasas de comisión con previo aviso.</li>
        <li>Está prohibido el uso de métodos fraudulentos para generar referidos.</li>
        <li>El incumplimiento de los términos resultará en la cancelación del acceso al programa.</li>
      </ul>

      <h3 className="font-semibold mt-4">Pagos</h3>
      <p>Los pagos de comisiones se realizan mensualmente, una vez alcanzado el mínimo de retiro establecido. Contáctanos para conocer los métodos de pago disponibles.</p>

      <h3 className="font-semibold mt-4">Contacto</h3>
      <p>Para más información sobre el programa de afiliados, comunícate con nuestro equipo de soporte.</p>
    </div>
  );
}

export function AboutModal({ open, onOpenChange }: AboutModalProps) {
  const { getValue } = useBranding();
  const platformName = getValue('platform_name') || 'Siver Market';
  const aboutHtml = getValue('about_content');
  const affiliateHtml = getValue('affiliate_program');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            Acerca de {platformName}
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="about" className="flex-1 flex flex-col overflow-hidden px-6 pb-6 pt-4">
          <TabsList className="grid grid-cols-2 mb-4 shrink-0">
            <TabsTrigger value="about">Sobre Nosotros</TabsTrigger>
            <TabsTrigger value="affiliate">Programa de Afiliados</TabsTrigger>
          </TabsList>
          <ScrollArea className="flex-1">
            <TabsContent value="about" className="mt-0">
              {aboutHtml ? (
                <div className="prose prose-sm max-w-none text-foreground/90"
                  dangerouslySetInnerHTML={{ __html: aboutHtml }} />
              ) : (
                <DefaultAbout platformName={platformName} />
              )}
            </TabsContent>
            <TabsContent value="affiliate" className="mt-0">
              {affiliateHtml ? (
                <div className="prose prose-sm max-w-none text-foreground/90"
                  dangerouslySetInnerHTML={{ __html: affiliateHtml }} />
              ) : (
                <DefaultAffiliate platformName={platformName} />
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
