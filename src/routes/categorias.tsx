import { createFileRoute } from "@tanstack/react-router";
import CategoriesPage from "@/pages/CategoriesPage";
import LazyRoute from "@/components/LazyRoute";

export const Route = createFileRoute("/categorias")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><CategoriesPage /></LazyRoute>
  );
}
