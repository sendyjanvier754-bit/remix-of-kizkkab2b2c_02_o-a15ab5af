import { createFileRoute } from "@tanstack/react-router";
import AboutPage from "@/pages/legal/AboutPage";
import LazyRoute from "@/components/LazyRoute";

export const Route = createFileRoute("/sobre-nosotros")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><AboutPage /></LazyRoute>
  );
}
