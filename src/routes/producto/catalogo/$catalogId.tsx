import { createFileRoute } from "@tanstack/react-router";
import ProductPage from "@/pages/ProductPage";

export const Route = createFileRoute("/producto/catalogo/$catalogId")({
  component: ProductPage,
});
