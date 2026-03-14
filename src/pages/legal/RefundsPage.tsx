import GlobalHeader from "@/components/layout/GlobalHeader";
import Footer from "@/components/layout/Footer";
import { useBranding } from '@/hooks/useBranding';

const RefundsPage = () => {
  const { getValue } = useBranding();
  const platformName = getValue('platform_name') || 'SIVER Market';
  const contactEmail = getValue('contact_email') || 'soporte@empresa.com';
  const contactPhone = getValue('contact_phone') || '+509 3234-5678';
  const customHtml = getValue('legal_refunds');

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <GlobalHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl font-bold mb-2 text-foreground">Política de Reembolsos</h1>
        <p className="text-sm text-muted-foreground mb-8">Última actualización: 14 de marzo de 2026</p>

        {customHtml ? (
          <div
            className="prose prose-sm max-w-none space-y-6 text-foreground/90"
            dangerouslySetInnerHTML={{ __html: customHtml }}
          />
        ) : (
          <div className="prose prose-sm max-w-none space-y-6 text-foreground/90">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. ¿Cuándo procede un Reembolso?</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>El producto llegó defectuoso o dañado durante el transporte.</li>
                <li>Recibiste un artículo diferente al que solicitaste.</li>
                <li>Tu pedido fue cancelado antes del envío.</li>
                <li>La devolución fue aprobada de acuerdo con nuestra Política de Devoluciones.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. Métodos de Reembolso</h2>
              <p>El reembolso se realizará mediante el mismo método de pago utilizado en la compra original:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>Tarjeta de crédito/débito:</strong> 5–10 días hábiles según el banco emisor.</li>
                <li><strong>MonCash / NatCash:</strong> 1–3 días hábiles.</li>
                <li><strong>Transferencia bancaria:</strong> 3–5 días hábiles.</li>
                <li><strong>Crédito en plataforma:</strong> inmediato, disponible para tu próxima compra.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">3. Plazo de Procesamiento</h2>
              <p>
                Una vez aprobada la devolución e inspeccionado el artículo, procesaremos el reembolso
                en un plazo de <strong>7–14 días hábiles</strong>. Te notificaremos por correo electrónico
                cuando el reembolso haya sido emitido.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">4. Reembolsos Parciales</h2>
              <p>Pueden aplicar reembolsos parciales en los siguientes casos:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Artículos devueltos con signos evidentes de uso.</li>
                <li>Pedidos con artículos faltantes o embalaje deteriorado por el cliente.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. Excepciones</h2>
              <p>No aplica reembolso en:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Productos de higiene personal, ropa interior o artículos personalizados.</li>
                <li>Devoluciones solicitadas fuera del plazo de 15 días.</li>
                <li>Artículos con daños causados por el cliente.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. Contacto</h2>
              <p>Para consultas sobre un reembolso:</p>
              <ul className="list-none space-y-1 mt-2">
                <li>📧 Email: {contactEmail}</li>
                <li>📞 Teléfono: {contactPhone}</li>
              </ul>
            </section>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default RefundsPage;
