import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Link2, Percent, ArrowRight } from "lucide-react";
import GlobalHeader from "@/components/layout/GlobalHeader";
import Footer from "@/components/layout/Footer";
import { useTranslation } from "react-i18next";

const AffiliateProgramPage = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col">
      <GlobalHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-5xl">
        <header className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            {t("affiliateProgram.title")}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("affiliateProgram.subtitle")}
          </p>
        </header>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="border-2">
            <CardContent className="p-6">
              <Link2 className="w-8 h-8 text-primary mb-4" />
              <h2 className="text-xl font-bold mb-2">{t("affiliateProgram.uniqueLinkTitle")}</h2>
              <p className="text-muted-foreground">{t("affiliateProgram.uniqueLinkDescription")}</p>
            </CardContent>
          </Card>
          <Card className="border-2">
            <CardContent className="p-6">
              <Percent className="w-8 h-8 text-primary mb-4" />
              <h2 className="text-xl font-bold mb-2">{t("affiliateProgram.discountTitle")}</h2>
              <p className="text-muted-foreground">{t("affiliateProgram.discountDescription")}</p>
            </CardContent>
          </Card>
          <Card className="border-2">
            <CardContent className="p-6">
              <CheckCircle2 className="w-8 h-8 text-primary mb-4" />
              <h2 className="text-xl font-bold mb-2">{t("affiliateProgram.commissionTitle")}</h2>
              <p className="text-muted-foreground">{t("affiliateProgram.commissionDescription")}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="max-w-xl mx-auto text-center">
          <CardContent className="p-8">
            <h2 className="text-2xl font-bold mb-3">{t("affiliateProgram.createAccountTitle")}</h2>
            <p className="text-muted-foreground mb-6">{t("affiliateProgram.createAccountDescription")}</p>
            <Button asChild size="lg">
              <Link to="/cuenta?redirect=/programa-afiliados">
                {t("affiliateProgram.createAccountButton")}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default AffiliateProgramPage;
