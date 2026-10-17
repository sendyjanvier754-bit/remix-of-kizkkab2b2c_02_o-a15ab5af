import { createFileRoute } from "@tanstack/react-router";
import ReturnsPage from "@/pages/legal/ReturnsPage";

export const Route = createFileRoute("/devoluciones")({
  component: ReturnsPage,
});
