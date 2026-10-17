import { createFileRoute } from "@tanstack/react-router";
import CategoriesPage from "@/pages/CategoriesPage";
import LazyRoute from "@/components/LazyRoute";

export const Route = createFileRoute("/categorias")({
  head: () => ({
    meta: [
      { title: "Categorías | Kizkka" },
      { name: "description", content: "Explora todas las categorías de productos de Kizkka: moda, calzado, hogar, accesorios y más." },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Categorías | Kizkka" },
      { property: "og:description", content: "Explora todas las categorías de productos de Kizkka." },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://kizkka.com/categorias" }],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><CategoriesPage /></LazyRoute>
  );
}
