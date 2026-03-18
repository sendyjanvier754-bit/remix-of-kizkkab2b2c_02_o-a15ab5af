import GlobalHeader from "@/components/layout/GlobalHeader";
import Footer from "@/components/layout/Footer";
import { useBranding } from '@/hooks/useBranding';

const ExchangesPage = () => {
  const { getValue } = useBranding();
  const platformName = getValue('platform_name');
  const contactEmail = getValue('contact_email') || 'soporte@empresa.com';
  const contactPhone = getValue('contact_phone') || '+509 3234-5678';
  const customHtml = getValue('legal_exchanges');

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <GlobalHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl font-bold mb-2 text-foreground">Política de Cambios</h1>
        <p className="text-sm text-muted-foreground mb-8">Última actualización: 14 de marzo de 2026</p>

        {customHtml ? (
          <div
            className="prose prose-sm max-w-none space-y-6 text-foreground/90"
            dangerouslySetInnerHTML={{ __html: customHtml }}
          />
        ) : (
          <div className="prose prose-sm max-w-none space-y-6 text-foreground/90">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. ¿Qué es un Cambio?</h2>
              <p>
                Un cambio consiste en reemplazar el artículo recibido por otro de igual o diferente
                talla, color o modelo, sujeto a disponibilidad en {platformName}.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. Condiciones para Solicitar un Cambio</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>La solicitud debe realizarse dentro de los <strong>15 días naturales</strong> desde la recepción del pedido.</li>
                <li>El artículo debe estar en su estado original: sin usar, sin lavar, con etiquetas y embalaje.</li>
                <li>Solo se acepta un cambio por pedido.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">3. Proceso</h2>
              <ol className="list-decimal pl-6 space-y-2">
                <li>Contacta al equipo de soporte indicando tu número de pedido, el artículo a cambiar y el artículo deseado.</li>
                <li>Confirmaremos la disponibilidad del nuevo artículo.</li>
                <li>Te enviaremos las instrucciones para el envío de retorno.</li>
                <li>Una vez recibido e inspeccionado el artículo original, despachamos el nuevo.</li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">4. Diferencia de Precio</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Si el nuevo artículo tiene un precio mayor, deberás abonar la diferencia.</li>
                <li>Si el nuevo artículo tiene un precio menor, la diferencia se acreditará como saldo en tu cuenta.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. Gastos de Envío del Cambio</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>El envío de retorno del artículo original corre por cuenta del cliente.</li>
                <li>El envío del nuevo artículo tiene un costo estándar según la tarifa vigente, salvo que el cambio sea por error nuestro o defecto de fabricación.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. Artículos No Elegibles para Cambio</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Artículos de higiene personal y ropa interior.</li>
                <li>Productos personalizados o con descuento especial.</li>
                <li>Artículos dañados por el cliente.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">7. Contacto</h2>
              <p>Para solicitar un cambio o resolver dudas:</p>
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

export default ExchangesPage;
