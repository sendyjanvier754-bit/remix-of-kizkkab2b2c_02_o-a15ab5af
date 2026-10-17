import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import ProductPage from "@/pages/ProductPage";

export const Route = createFileRoute("/producto/catalogo/$catalogId")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><ProductPage /></LazyRoute>
  );
}
