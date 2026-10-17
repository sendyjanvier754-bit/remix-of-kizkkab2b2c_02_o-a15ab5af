import { createFileRoute } from "@tanstack/react-router";
import ProductPage from "@/pages/ProductPage";

export const Route = createFileRoute("/producto/$sku")({
  component: ProductPage,
});
