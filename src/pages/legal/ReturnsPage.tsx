import GlobalHeader from "@/components/layout/GlobalHeader";
import Footer from "@/components/layout/Footer";
import { useBranding } from '@/hooks/useBranding';

const ReturnsPage = () => {
  const { getValue } = useBranding();
  const platformName = getValue('platform_name');
  const contactEmail = getValue('contact_email') || 'soporte@empresa.com';
  const contactPhone = getValue('contact_phone') || '+509 3234-5678';
  const customHtml = getValue('legal_returns');

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <GlobalHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl font-bold mb-2 text-foreground">Política de Devoluciones</h1>
        <p className="text-sm text-muted-foreground mb-8">Última actualización: 14 de marzo de 2026</p>

        {customHtml ? (
          <div
            className="prose prose-sm max-w-none space-y-6 text-foreground/90"
            dangerouslySetInnerHTML={{ __html: customHtml }}
          />
        ) : (
          <div className="prose prose-sm max-w-none space-y-6 text-foreground/90">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. Condiciones Generales</h2>
              <p>
                En {platformName} queremos que estés 100% satisfecho con tu compra. Si por
                cualquier motivo no estás conforme con tu pedido, puedes solicitarnos una
                devolución dentro del plazo establecido.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. Plazo para Devoluciones</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Tienes <strong>15 días naturales</strong> desde la fecha de recepción del pedido para solicitar una devolución.</li>
                <li>Transcurrido ese plazo no se aceptarán devoluciones, salvo defecto de fabricación o error nuestro.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">3. Requisitos del Artículo</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>El producto debe encontrarse en su estado original: sin usar, sin lavado y sin daños.</li>
                <li>Debe conservar el embalaje original, etiquetas y accesorios incluidos.</li>
                <li>No se aceptan devoluciones de artículos de higiene personal, ropa interior o productos personalizados.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">4. Proceso de Devolución</h2>
              <ol className="list-decimal pl-6 space-y-2">
                <li>Contacta a nuestro equipo de soporte indicando tu número de pedido y el motivo de la devolución.</li>
                <li>Te enviaremos las instrucciones de empaque y la dirección de envío.</li>
                <li>Una vez recibido e inspeccionado el artículo, confirmaremos la aprobación de la devolución.</li>
                <li>Procederemos al reembolso o cambio según corresponda.</li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. Gastos de Envío</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Los gastos de envío de retorno corren por cuenta del cliente, salvo que el producto presente un defecto de fabricación o se trate de un error nuestro.</li>
                <li>El envío original no es reembolsable.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. Contacto</h2>
              <p>Para iniciar una devolución contáctanos:</p>
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

export default ReturnsPage;
