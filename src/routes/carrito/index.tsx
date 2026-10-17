import { createFileRoute } from "@tanstack/react-router";
import CartPage from "@/pages/CartPage";
import LazyRoute from "@/components/LazyRoute";

export const Route = createFileRoute("/carrito/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><CartPage /></LazyRoute>
  );
}
