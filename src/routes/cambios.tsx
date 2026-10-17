import { createFileRoute } from "@tanstack/react-router";
import ExchangesPage from "@/pages/legal/ExchangesPage";
import LazyRoute from "@/components/LazyRoute";

export const Route = createFileRoute("/cambios")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><ExchangesPage /></LazyRoute>
  );
}
