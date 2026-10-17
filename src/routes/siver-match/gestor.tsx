import { createFileRoute } from "@tanstack/react-router";
import GestorDashboard from "@/pages/siver-match/GestorDashboard";

export const Route = createFileRoute("/siver-match/gestor")({
  component: GestorDashboard,
});
