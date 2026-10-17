import { createFileRoute } from "@tanstack/react-router";
import LazyRoute from "@/components/LazyRoute";
import StoreProfilePage from "@/pages/StoreProfilePage";

export const Route = createFileRoute("/tienda/$storeId")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LazyRoute><StoreProfilePage /></LazyRoute>
  );
}
