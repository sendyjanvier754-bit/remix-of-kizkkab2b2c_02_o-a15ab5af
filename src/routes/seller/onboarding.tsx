import { createFileRoute } from "@tanstack/react-router";
import SellerOnboardingPage from "@/pages/seller/SellerOnboardingPage";

export const Route = createFileRoute("/seller/onboarding")({
  component: SellerOnboardingPage,
});
