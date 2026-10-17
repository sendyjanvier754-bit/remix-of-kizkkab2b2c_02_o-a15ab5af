import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import TermsPage from "@/pages/legal/TermsPage";

export const Route = createFileRoute("/terminos")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><TermsPage /></LazyRoute>
  );
}
