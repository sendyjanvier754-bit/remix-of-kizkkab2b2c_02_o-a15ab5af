import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Truck, Store, ArrowRight, ShieldCheck, DollarSign, Clock } from "lucide-react";

const BecomePartnerPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <header className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Conviértete en socio Kizkka
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Únete a la red logística más rápida de Haití. Genera ingresos extra como punto de retiro o conductor.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <Card className="group hover:shadow-xl transition-all border-2 hover:border-primary">
            <CardContent className="p-8">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <Store className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Punto de retiro</h2>
              <p className="text-muted-foreground mb-6">
                ¿Tienes un local con espacio? Recibe paquetes y los clientes los recogen contigo.
                Ganas por cada paquete recibido y por días de almacenamiento.
              </p>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary" /> Tarifa por paquete + almacenamiento</li>
                <li className="flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Tú decides los horarios</li>
                <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Pagos semanales</li>
              </ul>
              <Button asChild className="w-full" size="lg">
                <Link to="/socios/punto-retiro/registro">
                  Registrarme como punto <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-xl transition-all border-2 hover:border-primary">
            <CardContent className="p-8">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <Truck className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Conductor</h2>
              <p className="text-muted-foreground mb-6">
                Tienes vehículo y tiempo libre. Ve las rutas disponibles cerca de ti, acepta las que quieras y
                gana por cada entrega completada.
              </p>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary" /> Tarifa fija por ruta + bonus</li>
                <li className="flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Trabajas cuando quieras</li>
                <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Sin jefe, eres tu propio horario</li>
              </ul>
              <Button asChild className="w-full" size="lg">
                <Link to="/socios/conductor/registro">
                  Registrarme como conductor <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          ¿Ya enviaste tu solicitud? <Link to="/cuenta" className="text-primary hover:underline">Inicia sesión</Link> con el correo que registraste.
        </div>
      </div>
    </div>
  );
};

export default BecomePartnerPage;
