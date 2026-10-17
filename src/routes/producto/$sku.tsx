import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import ProductPage from "@/pages/ProductPage";
import { getProductShareMeta } from "@/lib/product-share.functions";

const SITE = "https://kizkka.com";

export const Route = createFileRoute("/producto/$sku")({
  loader: async ({ params }) => {
    const meta = await getProductShareMeta({ data: { sku: params.sku } }).catch(() => null);
    return { meta };
  },
  head: ({ loaderData, params }) => {
    const meta = loaderData?.meta;
    const title = meta ? `${meta.title} | Kizkka` : "Producto | Kizkka";
    const description = meta?.description ?? "Disponible en Kizkka";
    const url = `${SITE}/producto/${encodeURIComponent(params.sku)}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:type", content: "product" },
        { property: "og:title", content: meta?.title ?? "Kizkka" },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: meta?.title ?? "Kizkka" },
        { name: "twitter:description", content: description },
        ...(meta?.image
          ? [
              { property: "og:image", content: meta.image },
              { property: "og:image:secure_url", content: meta.image },
              { name: "twitter:image", content: meta.image },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><ProductPage /></LazyRoute>
  );
}
