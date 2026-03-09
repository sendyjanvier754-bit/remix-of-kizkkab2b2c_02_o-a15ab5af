import GlobalHeader from "@/components/layout/GlobalHeader";
import Footer from "@/components/layout/Footer";
import { useBranding } from '@/hooks/useBranding';

const CookiesPage = () => {
  const { getValue } = useBranding();
  const contactEmail = getValue('contact_email') || 'privacidad@empresa.com';
  const contactPhone = getValue('contact_phone') || '+509 3234-5678';

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <GlobalHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl font-bold mb-2 text-foreground">Política de Cookies</h1>
        <p className="text-sm text-muted-foreground mb-8">Última actualización: 9 de marzo de 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground/90">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. ¿Qué son las Cookies?</h2>
            <p>Las cookies son pequeños archivos de texto que se almacenan en su dispositivo cuando visita nuestra plataforma. Nos ayudan a mejorar su experiencia, recordar sus preferencias y analizar el uso del sitio.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Tipos de Cookies que Utilizamos</h2>
            
            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">Cookies Esenciales</h3>
            <p>Necesarias para el funcionamiento básico de la plataforma. Incluyen:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Autenticación y sesión de usuario.</li>
              <li>Carrito de compras y preferencias de checkout.</li>
              <li>Seguridad y prevención de fraude.</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">Cookies de Funcionalidad</h3>
            <p>Mejoran su experiencia recordando sus preferencias:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Idioma preferido (español, francés, creole).</li>
              <li>País y moneda de preferencia.</li>
              <li>Historial de productos vistos.</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">Cookies Analíticas</h3>
            <p>Nos ayudan a entender cómo se utiliza la plataforma:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Páginas más visitadas y tiempo de permanencia.</li>
              <li>Fuentes de tráfico y rutas de navegación.</li>
              <li>Rendimiento del sitio web.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Almacenamiento Local</h2>
            <p>Además de cookies, utilizamos el almacenamiento local del navegador (localStorage) para:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Mantener su sesión activa de forma segura.</li>
              <li>Guardar el contenido de su carrito de compras.</li>
              <li>Recordar sus preferencias de visualización.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Control de Cookies</h2>
            <p>Puede controlar las cookies a través de la configuración de su navegador. Tenga en cuenta que deshabilitar cookies esenciales puede afectar el funcionamiento de la plataforma, incluyendo la imposibilidad de iniciar sesión o realizar compras.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Cookies de Terceros</h2>
            <p>Algunos servicios de terceros pueden establecer sus propias cookies:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>Supabase:</strong> para autenticación y gestión de sesión.</li>
              <li><strong>Procesadores de pago:</strong> para transacciones seguras.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Actualizaciones</h2>
            <p>Esta política puede ser actualizada periódicamente. Los cambios se publicarán en esta página con la fecha de la última actualización.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Contacto</h2>
            <p>Si tiene preguntas sobre nuestra política de cookies:</p>
            <ul className="list-none space-y-1 mt-2">
              <li>📧 Email: {contactEmail}</li>
              <li>📞 Teléfono: {contactPhone}</li>
            </ul>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CookiesPage;
