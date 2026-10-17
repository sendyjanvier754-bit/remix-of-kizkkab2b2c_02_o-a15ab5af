import { createFileRoute } from "@tanstack/react-router";
import DriverRegistrationPage from "@/pages/partners/DriverRegistrationPage";

export const Route = createFileRoute("/socios/conductor/registro")({
  component: DriverRegistrationPage,
});
