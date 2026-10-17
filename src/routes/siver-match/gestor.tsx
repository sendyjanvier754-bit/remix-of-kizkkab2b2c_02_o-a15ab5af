import { createFileRoute } from "@tanstack/react-router";
import GestorDashboard from "@/pages/siver-match/GestorDashboard";
import LazyRoute from "@/components/LazyRoute";

export const Route = createFileRoute("/siver-match/gestor")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><GestorDashboard /></LazyRoute>
  );
}
