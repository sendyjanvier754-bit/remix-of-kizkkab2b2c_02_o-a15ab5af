import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import PickupPointRegistrationPage from "@/pages/partners/PickupPointRegistrationPage";

export const Route = createFileRoute("/socios/punto-retiro/registro")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><PickupPointRegistrationPage /></LazyRoute>
  );
}
