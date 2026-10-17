import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";

const TITLE = "Kizkka | Plataforma Global de Comercio.";
const DESCRIPTION =
  "Compra y vende en Kizkka: catálogo B2B y B2C, logística internacional y los mejores precios para tiendas y clientes.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Kizkka - Soluciones de ecommerce sin fronteras" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: "https://kizkka.com/" },
      {
        property: "og:image",
        content:
          "https://fonvunyiaxcjkodrnpox.supabase.co/storage/v1/object/public/branding-assets/dialog_share_image_url-1773679883600.png",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Kizkka - Soluciones de ecommerce sin fronteras" },
      { name: "twitter:description", content: DESCRIPTION },
      {
        name: "twitter:image",
        content:
          "https://fonvunyiaxcjkodrnpox.supabase.co/storage/v1/object/public/branding-assets/dialog_share_image_url-1773679883600.png",
      },
    ],
    links: [{ rel: "canonical", href: "https://kizkka.com/" }],
  }),
  component: Index,
});
