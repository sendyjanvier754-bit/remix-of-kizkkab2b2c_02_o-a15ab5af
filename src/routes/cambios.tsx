import { createFileRoute } from "@tanstack/react-router";
import ExchangesPage from "@/pages/legal/ExchangesPage";

export const Route = createFileRoute("/cambios")({
  component: ExchangesPage,
});
