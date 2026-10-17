import { createFileRoute } from "@tanstack/react-router";
import CheckoutPage from "@/pages/CheckoutPage";
import LazyRoute from "@/components/LazyRoute";

export const Route = createFileRoute("/checkout")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><CheckoutPage /></LazyRoute>
  );
}
