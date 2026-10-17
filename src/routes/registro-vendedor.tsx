import { createFileRoute } from "@tanstack/react-router";
import SellerRegistrationPage from "@/pages/SellerRegistrationPage";

export const Route = createFileRoute("/registro-vendedor")({
  component: SellerRegistrationPage,
});
