import { createFileRoute } from "@tanstack/react-router";
import MyPurchasesPage from "@/pages/MyPurchasesPage";

export const Route = createFileRoute("/mis-compras")({
  component: MyPurchasesPage,
});
