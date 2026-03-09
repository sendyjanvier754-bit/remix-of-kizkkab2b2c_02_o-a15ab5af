import GlobalHeader from "@/components/layout/GlobalHeader";
import Footer from "@/components/layout/Footer";

const PrivacyPage = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <GlobalHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl font-bold mb-2 text-foreground">Política de Privacidad</h1>
        <p className="text-sm text-muted-foreground mb-8">Última actualización: 9 de marzo de 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground/90">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Información que Recopilamos</h2>
            <p>Recopilamos información que usted nos proporciona directamente, incluyendo:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong>Datos de registro:</strong> nombre completo, correo electrónico, número de teléfono y contraseña.</li>
              <li><strong>Datos de perfil:</strong> dirección de envío, preferencias de idioma y foto de perfil.</li>
              <li><strong>Datos de transacción:</strong> historial de compras, métodos de pago utilizados y direcciones de entrega.</li>
              <li><strong>Datos de comunicación:</strong> mensajes enviados a través del chat de soporte.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Uso de la Información</h2>
            <p>Utilizamos su información para:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Procesar y gestionar sus pedidos y transacciones.</li>
              <li>Proporcionar atención al cliente y soporte técnico.</li>
              <li>Enviar notificaciones sobre el estado de sus pedidos.</li>
              <li>Personalizar su experiencia en la plataforma.</li>
              <li>Mejorar nuestros servicios y desarrollar nuevas funcionalidades.</li>
              <li>Prevenir fraudes y garantizar la seguridad de la plataforma.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Compartición de Datos</h2>
            <p>No vendemos su información personal. Podemos compartir datos con:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong>Vendedores:</strong> información necesaria para completar sus pedidos (nombre, dirección de envío).</li>
              <li><strong>Proveedores de servicios:</strong> empresas de logística y procesadores de pago.</li>
              <li><strong>Autoridades legales:</strong> cuando sea requerido por ley o para proteger nuestros derechos.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Seguridad de los Datos</h2>
            <p>Implementamos medidas de seguridad técnicas y organizativas para proteger su información, incluyendo cifrado de datos en tránsito (SSL/TLS), almacenamiento seguro de contraseñas y control de acceso basado en roles.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Retención de Datos</h2>
            <p>Conservamos sus datos personales mientras su cuenta esté activa o según sea necesario para proporcionarle servicios. Puede solicitar la eliminación de su cuenta contactando a nuestro equipo de soporte.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Sus Derechos</h2>
            <p>Usted tiene derecho a:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Acceder a sus datos personales.</li>
              <li>Rectificar información incorrecta.</li>
              <li>Solicitar la eliminación de sus datos.</li>
              <li>Oponerse al procesamiento de sus datos para marketing.</li>
              <li>Solicitar la portabilidad de sus datos.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Menores de Edad</h2>
            <p>Nuestros servicios no están dirigidos a menores de 18 años. No recopilamos intencionalmente información de menores. Si descubrimos que hemos recopilado datos de un menor, los eliminaremos inmediatamente.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Cambios en esta Política</h2>
            <p>Podemos actualizar esta política periódicamente. Le notificaremos sobre cambios significativos a través de un aviso en la plataforma o por correo electrónico.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Contacto</h2>
            <p>Para ejercer sus derechos o consultas sobre privacidad:</p>
            <ul className="list-none space-y-1 mt-2">
              <li>📧 Email: privacidad@siver.com</li>
              <li>📞 Teléfono: +1 (509) 3234-5678</li>
            </ul>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPage;
