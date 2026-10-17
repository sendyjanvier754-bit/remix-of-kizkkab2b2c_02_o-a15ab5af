import { createFileRoute } from "@tanstack/react-router";
import AboutPage from "@/pages/legal/AboutPage";

export const Route = createFileRoute("/sobre-nosotros")({
  component: AboutPage,
});
