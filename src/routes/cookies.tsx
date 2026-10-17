import { createFileRoute } from "@tanstack/react-router";
import CookiesPage from "@/pages/legal/CookiesPage";

export const Route = createFileRoute("/cookies")({
  component: CookiesPage,
});
