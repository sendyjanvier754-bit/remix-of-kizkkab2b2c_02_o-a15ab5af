import { createFileRoute } from "@tanstack/react-router";
import CategoryProductsPage from "@/pages/CategoryProductsPage";
import LazyRoute from "@/components/LazyRoute";

const prettify = (slug: string) => {
  const text = decodeURIComponent(slug).replace(/[-_]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Categoría";
};

export const Route = createFileRoute("/categoria/$slug")({
  head: ({ params }) => {
    const name = prettify(params.slug);
    const description = `Compra ${name.toLowerCase()} en Kizkka al mejor precio, con envío a tu país.`;
    return {
      meta: [
        { title: `${name} | Kizkka` },
        { name: "description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:title", content: `${name} | Kizkka` },
        { property: "og:description", content: description },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: `https://kizkka.com/categoria/${params.slug}` }],
    };
  },
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><CategoryProductsPage /></LazyRoute>
  );
}
