import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import UnsubscribePage from "@/pages/UnsubscribePage";

export const Route = createFileRoute("/unsubscribe")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><UnsubscribePage /></LazyRoute>
  );
}
