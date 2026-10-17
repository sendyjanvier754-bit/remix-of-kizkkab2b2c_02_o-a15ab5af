import { createFileRoute } from "@tanstack/react-router";
import DriverRegistrationPage from "@/pages/partners/DriverRegistrationPage";
import LazyRoute from "@/components/LazyRoute";

export const Route = createFileRoute("/socios/conductor/registro")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><DriverRegistrationPage /></LazyRoute>
  );
}
