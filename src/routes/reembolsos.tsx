import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import RefundsPage from "@/pages/legal/RefundsPage";

export const Route = createFileRoute("/reembolsos")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><RefundsPage /></LazyRoute>
  );
}
