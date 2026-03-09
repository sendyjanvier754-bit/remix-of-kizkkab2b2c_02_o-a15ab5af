import GlobalHeader from "@/components/layout/GlobalHeader";
import Footer from "@/components/layout/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Phone, Mail, Clock, MessageCircle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const ContactPage = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <GlobalHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl font-bold mb-2 text-foreground">Contáctanos</h1>
        <p className="text-muted-foreground mb-8">Estamos aquí para ayudarte. Elige el canal que prefieras.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5 text-primary" />
                Correo Electrónico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">Para consultas generales y soporte:</p>
              <a href="mailto:contacto@siver.com" className="text-primary hover:underline font-medium">
                contacto@siver.com
              </a>
              <p className="text-xs text-muted-foreground mt-2">Respondemos en un plazo de 24-48 horas.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Phone className="h-5 w-5 text-primary" />
                Teléfono
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">Llámanos directamente:</p>
              <a href="tel:+15093234567" className="text-primary hover:underline font-medium">
                +1 (509) 3234-5678
              </a>
              <p className="text-xs text-muted-foreground mt-2">Lunes a Sábado, 8:00 AM - 6:00 PM</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageCircle className="h-5 w-5 text-primary" />
                WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">Escríbenos por WhatsApp:</p>
              <a 
                href="https://wa.me/15093234567" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                +1 (509) 3234-5678
              </a>
              <p className="text-xs text-muted-foreground mt-2">Respuesta rápida en horario laboral.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5 text-primary" />
                Ubicación
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">Nuestra oficina principal:</p>
              <p className="font-medium">Puerto Príncipe, Haití</p>
              <p className="text-xs text-muted-foreground mt-2">Visitas con cita previa.</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-muted/30">
          <CardContent className="py-8 text-center">
            <HelpCircle className="h-10 w-10 text-primary mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-2">¿Tienes una pregunta frecuente?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Consulta nuestras páginas de información legal para respuestas rápidas.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button variant="outline" size="sm" asChild>
                <Link to="/terminos">Términos y Condiciones</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/privacidad">Política de Privacidad</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/cookies">Política de Cookies</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default ContactPage;
