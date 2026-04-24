import { createFileRoute } from "@tanstack/react-router";
import { ExplorerPage } from "@/pages/ExplorerPage";

export const Route = createFileRoute("/explorer")({
  component: ExplorerPage,
});
