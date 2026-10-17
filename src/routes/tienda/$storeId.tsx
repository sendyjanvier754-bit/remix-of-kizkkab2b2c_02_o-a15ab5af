import { createFileRoute } from "@tanstack/react-router";
import StoreProfilePage from "@/pages/StoreProfilePage";

export const Route = createFileRoute("/tienda/$storeId")({
  component: StoreProfilePage,
});
