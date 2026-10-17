import { createFileRoute } from "@tanstack/react-router";
import RefundsPage from "@/pages/legal/RefundsPage";

export const Route = createFileRoute("/reembolsos")({
  component: RefundsPage,
});
