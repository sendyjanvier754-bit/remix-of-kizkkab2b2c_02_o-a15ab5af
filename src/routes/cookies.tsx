import { createFileRoute } from "@tanstack/react-router";
import CookiesPage from "@/pages/legal/CookiesPage";
import LazyRoute from "@/components/LazyRoute";

export const Route = createFileRoute("/cookies")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><CookiesPage /></LazyRoute>
  );
}
