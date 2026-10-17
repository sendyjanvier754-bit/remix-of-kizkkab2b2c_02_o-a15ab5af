import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import MyPurchasesPage from "@/pages/MyPurchasesPage";

export const Route = createFileRoute("/mis-compras")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><MyPurchasesPage /></LazyRoute>
  );
}
