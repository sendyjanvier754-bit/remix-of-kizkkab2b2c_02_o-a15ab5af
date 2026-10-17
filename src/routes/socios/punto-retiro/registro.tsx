import { createFileRoute } from "@tanstack/react-router";
import PickupPointRegistrationPage from "@/pages/partners/PickupPointRegistrationPage";

export const Route = createFileRoute("/socios/punto-retiro/registro")({
  component: PickupPointRegistrationPage,
});
