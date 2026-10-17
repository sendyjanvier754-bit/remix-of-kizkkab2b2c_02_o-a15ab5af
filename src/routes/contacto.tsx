import { createFileRoute } from "@tanstack/react-router";
import ContactPage from "@/pages/legal/ContactPage";

export const Route = createFileRoute("/contacto")({
  component: ContactPage,
});
