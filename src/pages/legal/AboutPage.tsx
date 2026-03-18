import GlobalHeader from "@/components/layout/GlobalHeader";
import Footer from "@/components/layout/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Globe, Users, TrendingUp, ShoppingBag, Truck } from "lucide-react";
import { useBranding } from '@/hooks/useBranding';

const AboutPage = () => {
  const { getValue } = useBranding();
  const platformName = getValue('platform_name');

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <GlobalHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl font-bold mb-2 text-foreground">Sobre {platformName}</h1>
        <p className="text-muted-foreground mb-8">Conectando el comercio global con el Caribe.</p>

        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Nuestra Misión</h2>
            <p className="text-foreground/90 leading-relaxed">
              {platformName} nació con la misión de democratizar el acceso a productos internacionales de calidad para los consumidores del Caribe. Conectamos fabricantes y proveedores globales con emprendedores y clientes finales en Haití y la región, eliminando las barreras del comercio internacional.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">¿Qué Hacemos?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Card className="bg-muted/30">
                <CardContent className="pt-6">
                  <ShoppingBag className="h-8 w-8 text-primary mb-3" />
                  <h3 className="font-semibold mb-2">Marketplace B2C</h3>
                  <p className="text-sm text-muted-foreground">Tienda en línea donde los consumidores pueden comprar productos directamente de vendedores locales verificados.</p>
                </CardContent>
              </Card>
              <Card className="bg-muted/30">
                <CardContent className="pt-6">
                  <TrendingUp className="h-8 w-8 text-primary mb-3" />
                  <h3 className="font-semibold mb-2">Plataforma B2B</h3>
                  <p className="text-sm text-muted-foreground">Sistema de adquisición de lotes al por mayor para emprendedores que desean importar y revender productos.</p>
                </CardContent>
              </Card>
              <Card className="bg-muted/30">
                <CardContent className="pt-6">
                  <Truck className="h-8 w-8 text-primary mb-3" />
                  <h3 className="font-semibold mb-2">Logística Integrada</h3>
                  <p className="text-sm text-muted-foreground">Red logística propia con puntos de recogida y entrega a domicilio en todo el territorio haitiano.</p>
                </CardContent>
              </Card>
              <Card className="bg-muted/30">
                <CardContent className="pt-6">
                  <Shield className="h-8 w-8 text-primary mb-3" />
                  <h3 className="font-semibold mb-2">Control de Calidad</h3>
                  <p className="text-sm text-muted-foreground">Agentes de compra internacionales que verifican la calidad de cada producto antes del envío.</p>
                </CardContent>
              </Card>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Nuestros Valores</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="text-center p-4">
                <Globe className="h-8 w-8 text-primary mx-auto mb-2" />
                <h3 className="font-semibold mb-1">Accesibilidad</h3>
                <p className="text-sm text-muted-foreground">Productos internacionales al alcance de todos.</p>
              </div>
              <div className="text-center p-4">
                <Shield className="h-8 w-8 text-primary mx-auto mb-2" />
                <h3 className="font-semibold mb-1">Confianza</h3>
                <p className="text-sm text-muted-foreground">Transacciones seguras y transparentes.</p>
              </div>
              <div className="text-center p-4">
                <Users className="h-8 w-8 text-primary mx-auto mb-2" />
                <h3 className="font-semibold mb-1">Comunidad</h3>
                <p className="text-sm text-muted-foreground">Empoderando emprendedores locales.</p>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AboutPage;
