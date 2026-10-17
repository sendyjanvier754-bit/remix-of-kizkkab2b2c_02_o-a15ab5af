import { createFileRoute } from "@tanstack/react-router";
import SharedCartPage from "@/pages/SharedCartPage";

export const Route = createFileRoute("/carrito/compartido/$shareCode")({
  component: SharedCartPage,
});
