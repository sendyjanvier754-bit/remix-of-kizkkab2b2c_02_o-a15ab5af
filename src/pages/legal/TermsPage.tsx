import GlobalHeader from "@/components/layout/GlobalHeader";
import Footer from "@/components/layout/Footer";
import { useTranslation } from "react-i18next";
import { useBranding } from '@/hooks/useBranding';

const TermsPage = () => {
  const { t } = useTranslation();
  const { getValue } = useBranding();
  const platformName = getValue('platform_name');
  const contactEmail = getValue('contact_email') || 'legal@empresa.com';
  const contactPhone = getValue('contact_phone') || '+509 3234-5678';

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <GlobalHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl font-bold mb-2 text-foreground">Términos y Condiciones</h1>
        <p className="text-sm text-muted-foreground mb-8">Última actualización: 9 de marzo de 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground/90">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Aceptación de los Términos</h2>
            <p>Al acceder y utilizar la plataforma {platformName} ("la Plataforma"), usted acepta estar sujeto a estos Términos y Condiciones. Si no está de acuerdo con alguno de estos términos, no debe utilizar nuestros servicios.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Descripción del Servicio</h2>
            <p>{platformName} es una plataforma de comercio electrónico que conecta compradores con vendedores, facilitando la compra y venta de productos tanto al por mayor (B2B) como al detalle (B2C). Operamos como intermediarios entre proveedores internacionales y consumidores finales en Haití y el Caribe.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Registro y Cuentas de Usuario</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Debe tener al menos 18 años para crear una cuenta.</li>
              <li>La información proporcionada debe ser veraz y actualizada.</li>
              <li>Usted es responsable de mantener la confidencialidad de su cuenta y contraseña.</li>
              <li>Debe notificarnos inmediatamente cualquier uso no autorizado de su cuenta.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Compras y Pagos</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Los precios están sujetos a cambios sin previo aviso.</li>
              <li>Aceptamos múltiples métodos de pago: tarjetas de crédito/débito, MonCash, NatCash y transferencias bancarias.</li>
              <li>El pago debe completarse antes del envío del producto.</li>
              <li>Los precios mostrados pueden no incluir impuestos o tarifas de envío aplicables.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Envíos y Entregas</h2>
            <p>Los tiempos de entrega son estimados y pueden variar según la disponibilidad del producto, el destino de envío y factores logísticos. {platformName} no se hace responsable de retrasos causados por aduanas, condiciones climáticas u otros factores fuera de nuestro control.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Devoluciones y Reembolsos</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Los productos pueden devolverse dentro de los 15 días posteriores a la recepción.</li>
              <li>Los artículos deben estar en su estado original, sin usar y con su empaque.</li>
              <li>Los gastos de devolución corren por cuenta del comprador, salvo en caso de productos defectuosos.</li>
              <li>Los reembolsos se procesarán en un plazo de 7-14 días hábiles.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Propiedad Intelectual</h2>
            <p>Todo el contenido de la plataforma, incluyendo textos, gráficos, logos, imágenes y software, es propiedad de {platformName} o sus licenciantes y está protegido por leyes de propiedad intelectual.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Limitación de Responsabilidad</h2>
            <p>{platformName} no será responsable por daños indirectos, incidentales, especiales o consecuentes derivados del uso de la plataforma. Nuestra responsabilidad máxima se limita al monto pagado por el producto o servicio en cuestión.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Modificaciones</h2>
            <p>Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios entrarán en vigor al momento de su publicación en la plataforma. El uso continuado del servicio constituye la aceptación de los términos modificados.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Contacto</h2>
            <p>Para consultas sobre estos términos, contáctenos en:</p>
            <ul className="list-none space-y-1 mt-2">
              <li>📧 Email: {contactEmail}</li>
              <li>📞 Teléfono: {contactPhone}</li>
              <li>📍 Dirección: Puerto Príncipe, Haití</li>
            </ul>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TermsPage;
