import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import ReturnsPage from "@/pages/legal/ReturnsPage";

export const Route = createFileRoute("/devoluciones")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><ReturnsPage /></LazyRoute>
  );
}
