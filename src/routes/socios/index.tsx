import { createFileRoute } from "@tanstack/react-router";
import BecomePartnerPage from "@/pages/partners/BecomePartnerPage";
import LazyRoute from "@/components/LazyRoute";

export const Route = createFileRoute("/socios/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><BecomePartnerPage /></LazyRoute>
  );
}
