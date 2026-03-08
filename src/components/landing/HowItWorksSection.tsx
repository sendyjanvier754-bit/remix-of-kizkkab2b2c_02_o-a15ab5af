import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

const HowItWorksSection = () => {
  const { t } = useTranslation();

  const steps = [
    {
      number: "01",
      title: t('landing.step1Title', { defaultValue: "Regístrate como Vendedor" }),
      description: t('landing.step1Desc', { defaultValue: "Completa el proceso KYC con tu documentación y cuenta Mon Cash." }),
      features: [
        t('landing.step1Feature1', { defaultValue: "Verificación de identidad" }),
        t('landing.step1Feature2', { defaultValue: "Documentos de negocio" }),
        t('landing.step1Feature3', { defaultValue: "Cuenta Mon Cash" }),
      ],
    },
    {
      number: "02",
      title: t('landing.step2Title', { defaultValue: "Adquiere Lotes B2B" }),
      description: t('landing.step2Desc', { defaultValue: "Explora el catálogo y compra lotes al por mayor con pago anticipado." }),
      features: [
        t('landing.step2Feature1', { defaultValue: "MOQ flexible" }),
        t('landing.step2Feature2', { defaultValue: "Precios mayoristas" }),
        t('landing.step2Feature3', { defaultValue: "Pago seguro" }),
      ],
    },
    {
      number: "03",
      title: t('landing.step3Title', { defaultValue: "Personaliza y Vende" }),
      description: t('landing.step3Desc', { defaultValue: "Edita precios y descripciones de tus productos para la venta B2C." }),
      features: [
        t('landing.step3Feature1', { defaultValue: "Editor intuitivo" }),
        t('landing.step3Feature2', { defaultValue: "Fotos personalizadas" }),
        t('landing.step3Feature3', { defaultValue: "Tu margen de ganancia" }),
      ],
    },
    {
      number: "04",
      title: t('landing.step4Title', { defaultValue: "Entrega en Punto de Recogida" }),
      description: t('landing.step4Desc', { defaultValue: "El cliente recoge en el punto más cercano. Tú generas la guía." }),
      features: [
        t('landing.step4Feature1', { defaultValue: "+50 puntos en Haití" }),
        t('landing.step4Feature2', { defaultValue: "Guía automática" }),
        t('landing.step4Feature3', { defaultValue: "Seguimiento en tiempo real" }),
      ],
    },
  ];

  return (
    <section className="py-20 md:py-32 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-teal/10 text-teal text-sm font-semibold mb-4">
            {t('landing.simpleProcess', { defaultValue: "Proceso Simple" })}
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
            {t('landing.howItWorks', { defaultValue: "¿Cómo funciona" })}{" "}
            <span className="text-teal">Siver Market 509</span>?
          </h2>
          <p className="text-lg text-muted-foreground">
            {t('landing.howItWorksDesc', { defaultValue: "En 4 simples pasos puedes empezar a vender productos de calidad en toda Haití." })}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className="relative p-8 rounded-3xl bg-card border border-border hover:border-teal/30 transition-all duration-300 group animate-fade-up"
              style={{ animationDelay: `${index * 0.15}s` }}
            >
              <div className="absolute -top-4 left-8 px-4 py-1 rounded-full bg-teal text-primary-foreground font-bold text-sm">
                {t('landing.step', { defaultValue: "Paso" })} {step.number}
              </div>
              
              <div className="pt-4">
                <h3 className="text-2xl font-bold text-foreground mb-3">
                  {step.title}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {step.description}
                </p>
                
                <ul className="space-y-3">
                  {step.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-teal flex-shrink-0" />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
