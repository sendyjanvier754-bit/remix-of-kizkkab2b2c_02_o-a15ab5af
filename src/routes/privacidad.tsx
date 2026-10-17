import { createFileRoute } from "@tanstack/react-router";
import PrivacyPage from "@/pages/legal/PrivacyPage";

export const Route = createFileRoute("/privacidad")({
  component: PrivacyPage,
});
