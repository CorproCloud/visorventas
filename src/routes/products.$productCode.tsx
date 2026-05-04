import { createFileRoute } from "@tanstack/react-router";
import { ProductDetailPage } from "@/pages/ProductDetailPage";

export const Route = createFileRoute("/products/$productCode")({
  component: ProductRoute,
});

function ProductRoute() {
  const { productCode } = Route.useParams();
  return <ProductDetailPage productCode={productCode} />;
}
