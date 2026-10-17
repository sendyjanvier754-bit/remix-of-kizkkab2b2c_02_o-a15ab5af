import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import PrivacyPage from "@/pages/legal/PrivacyPage";

export const Route = createFileRoute("/privacidad")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><PrivacyPage /></LazyRoute>
  );
}
