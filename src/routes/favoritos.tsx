import { createFileRoute } from "@tanstack/react-router";
import FavoritesPage from "@/pages/FavoritesPage";
import LazyRoute from "@/components/LazyRoute";

export const Route = createFileRoute("/favoritos")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><FavoritesPage /></LazyRoute>
  );
}
