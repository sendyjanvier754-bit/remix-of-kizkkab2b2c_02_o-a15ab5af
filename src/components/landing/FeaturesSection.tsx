import { 
  Store, 
  CreditCard, 
  Truck, 
  Users, 
  BarChart3, 
  ShieldCheck,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const features = [
  {
    icon: Store,
    title: "Catálogo Mayorista",
    description: "Accede a miles de productos con precios exclusivos B2B. Gestión de inventario en tiempo real.",
    color: "bg-accent/10 text-accent",
  },
  {
    icon: CreditCard,
    title: "Pago Anticipado Seguro",
    description: "Sistema de conciliación con Stripe, Mon Cash y transferencia bancaria. Sin riesgo de fraude.",
    color: "bg-teal/10 text-teal",
  },
  {
    icon: Truck,
    title: "Logística Simplificada",
    description: "Red de puntos de recogida en todo Haití. Generación automática de guías de envío.",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: Users,
    title: "Gestión de Vendedores",
    description: "Sistema KYC completo. Validación de identidad y documentos de negocio.",
    color: "bg-accent/10 text-accent",
  },
  {
    icon: BarChart3,
    title: "Panel de Control",
    description: "Estadísticas detalladas de ventas, inventario y rendimiento de tu negocio.",
    color: "bg-teal/10 text-teal",
  },
  {
    icon: ShieldCheck,
    title: "Verificación KYC",
    description: "Proceso de verificación de identidad para vendedores. Máxima seguridad.",
    color: "bg-primary/10 text-primary",
  },
];

const FeaturesSection = () => {
  return (
    <section className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-semibold mb-4">
            Plataforma Completa
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
            Todo lo que necesitas para{" "}
            <span className="text-gradient-gold">crecer tu negocio</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Desde la gestión de inventario hasta el cobro seguro, 
            Siver Market 509 te ofrece las herramientas para escalar.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group p-6 rounded-2xl bg-card border border-border hover:border-accent/50 transition-all duration-300 hover:shadow-card animate-fade-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className={`w-14 h-14 rounded-xl ${feature.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                <feature.icon className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button variant="gold" size="lg" asChild>
            <Link to="/seller/registro" className="flex items-center gap-2">
              Comenzar Ahora
              <ArrowRight className="w-5 h-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
