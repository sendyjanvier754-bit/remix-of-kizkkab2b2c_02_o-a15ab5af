import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import GlobalHeader from "@/components/layout/GlobalHeader";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Package } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const ProductPage = () => {
  const { sku } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {!isMobile && <GlobalHeader />}
      <main className="container mx-auto px-4 py-8">
        <h1>Producto: {sku}</h1>
        <Button onClick={() => navigate("/")}>Volver</Button>
      </main>
      {!isMobile && <Footer />}
    </div>
  );
};

export default ProductPage;
