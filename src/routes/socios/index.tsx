import { createFileRoute } from "@tanstack/react-router";
import BecomePartnerPage from "@/pages/partners/BecomePartnerPage";

export const Route = createFileRoute("/socios/")({
  component: BecomePartnerPage,
});
