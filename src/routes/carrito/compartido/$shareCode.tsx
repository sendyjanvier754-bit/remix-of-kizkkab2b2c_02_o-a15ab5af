import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import SharedCartPage from "@/pages/SharedCartPage";

export const Route = createFileRoute("/carrito/compartido/$shareCode")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><SharedCartPage /></LazyRoute>
  );
}
