import { createFileRoute } from "@tanstack/react-router";
import CategoryProductsPage from "@/pages/CategoryProductsPage";

export const Route = createFileRoute("/categoria/$slug")({
  component: CategoryProductsPage,
});
