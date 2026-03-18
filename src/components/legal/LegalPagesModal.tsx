import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useBranding } from '@/hooks/useBranding';
import { Shield } from 'lucide-react';

interface LegalPagesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DefaultTerms({ platformName }: { platformName: string }) {
  return (
    <div className="space-y-4 text-sm text-foreground/90 leading-relaxed">
      <h2 className="text-lg font-semibold">Términos y Condiciones de Uso</h2>
      <p>Al acceder y usar {platformName}, aceptas cumplir con los presentes términos y condiciones.</p>
      <h3 className="font-semibold mt-4">1. Aceptación de los Términos</h3>
      <p>El uso de esta plataforma implica la aceptación plena y sin reservas de los presentes términos. Si no estás de acuerdo, te pedimos que no utilices el servicio.</p>
      <h3 className="font-semibold mt-4">2. Uso de la Plataforma</h3>
      <p>La plataforma está destinada a conectar compradores y vendedores. El usuario se compromete a hacer un uso lícito y adecuado de todos los servicios ofrecidos.</p>
      <h3 className="font-semibold mt-4">3. Responsabilidad</h3>
      <p>{platformName} actúa como intermediario entre compradores y vendedores. No nos hacemos responsables de las transacciones realizadas entre usuarios.</p>
      <h3 className="font-semibold mt-4">4. Modificaciones</h3>
      <p>Nos reservamos el derecho de modificar estos términos en cualquier momento. Las modificaciones serán publicadas en esta página.</p>
      <h3 className="font-semibold mt-4">5. Contacto</h3>
      <p>Para cualquier consulta sobre estos términos, contáctanos a través de nuestros canales oficiales.</p>
    </div>
  );
}

function DefaultPrivacy({ platformName }: { platformName: string }) {
  return (
    <div className="space-y-4 text-sm text-foreground/90 leading-relaxed">
      <h2 className="text-lg font-semibold">Política de Privacidad</h2>
      <p>En {platformName} nos tomamos muy en serio la privacidad de tus datos personales.</p>
      <h3 className="font-semibold mt-4">1. Datos que Recopilamos</h3>
      <p>Recopilamos información como nombre, correo electrónico, dirección de envío y datos de pago necesarios para procesar tus pedidos.</p>
      <h3 className="font-semibold mt-4">2. Uso de los Datos</h3>
      <p>Usamos tus datos para gestionar pedidos, mejorar la experiencia del usuario y enviarte comunicaciones relevantes sobre tu cuenta.</p>
      <h3 className="font-semibold mt-4">3. Compartir Información</h3>
      <p>No vendemos tu información personal a terceros. Solo la compartimos con socios logísticos necesarios para completar tu pedido.</p>
      <h3 className="font-semibold mt-4">4. Seguridad</h3>
      <p>Implementamos medidas de seguridad técnicas y organizativas para proteger tus datos contra accesos no autorizados.</p>
      <h3 className="font-semibold mt-4">5. Tus Derechos</h3>
      <p>Tienes derecho a acceder, rectificar o eliminar tus datos personales. Contáctanos para ejercer estos derechos.</p>
    </div>
  );
}

function DefaultCookies({ platformName }: { platformName: string }) {
  return (
    <div className="space-y-4 text-sm text-foreground/90 leading-relaxed">
      <h2 className="text-lg font-semibold">Política de Cookies</h2>
      <p>{platformName} utiliza cookies para mejorar tu experiencia de navegación.</p>
      <h3 className="font-semibold mt-4">¿Qué son las Cookies?</h3>
      <p>Las cookies son pequeños archivos de texto que se almacenan en tu dispositivo cuando visitas nuestra plataforma.</p>
      <h3 className="font-semibold mt-4">Tipos de Cookies que Usamos</h3>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Cookies esenciales:</strong> Necesarias para el funcionamiento básico del sitio.</li>
        <li><strong>Cookies de rendimiento:</strong> Nos ayudan a entender cómo interactúas con la plataforma.</li>
        <li><strong>Cookies funcionales:</strong> Recuerdan tus preferencias para mejorar tu experiencia.</li>
      </ul>
      <h3 className="font-semibold mt-4">Control de Cookies</h3>
      <p>Puedes controlar y eliminar las cookies desde la configuración de tu navegador en cualquier momento.</p>
    </div>
  );
}

export function LegalPagesModal({ open, onOpenChange }: LegalPagesModalProps) {
  const { getValue } = useBranding();
  const platformName = getValue('platform_name');
  const termsHtml = getValue('legal_terms');
  const privacyHtml = getValue('legal_privacy');
  const cookiesHtml = getValue('legal_cookies');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Términos Legales
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="terms" className="flex-1 flex flex-col overflow-hidden px-6 pb-6 pt-4">
          <TabsList className="grid grid-cols-3 mb-4 shrink-0">
            <TabsTrigger value="terms">Términos</TabsTrigger>
            <TabsTrigger value="privacy">Privacidad</TabsTrigger>
            <TabsTrigger value="cookies">Cookies</TabsTrigger>
          </TabsList>
          <ScrollArea className="flex-1">
            <TabsContent value="terms" className="mt-0">
              {termsHtml ? (
                <div className="prose prose-sm max-w-none text-foreground/90"
                  dangerouslySetInnerHTML={{ __html: termsHtml }} />
              ) : (
                <DefaultTerms platformName={platformName} />
              )}
            </TabsContent>
            <TabsContent value="privacy" className="mt-0">
              {privacyHtml ? (
                <div className="prose prose-sm max-w-none text-foreground/90"
                  dangerouslySetInnerHTML={{ __html: privacyHtml }} />
              ) : (
                <DefaultPrivacy platformName={platformName} />
              )}
            </TabsContent>
            <TabsContent value="cookies" className="mt-0">
              {cookiesHtml ? (
                <div className="prose prose-sm max-w-none text-foreground/90"
                  dangerouslySetInnerHTML={{ __html: cookiesHtml }} />
              ) : (
                <DefaultCookies platformName={platformName} />
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
