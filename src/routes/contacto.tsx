import { createFileRoute } from "@tanstack/react-router";
import ContactPage from "@/pages/legal/ContactPage";
import LazyRoute from "@/components/LazyRoute";

export const Route = createFileRoute("/contacto")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><ContactPage /></LazyRoute>
  );
}
