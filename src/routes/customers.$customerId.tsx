import { createFileRoute } from "@tanstack/react-router";
import { CustomerDetailPage } from "@/pages/CustomerDetailPage";

export const Route = createFileRoute("/customers/$customerId")({
  component: CustomerRoute,
});

function CustomerRoute() {
  const { customerId } = Route.useParams();
  return <CustomerDetailPage customerId={customerId} />;
}
