import { createFileRoute } from "@tanstack/react-router";
import { CommercialReportPage } from "@/pages/CommercialReportPage";

export const Route = createFileRoute("/reporte-comercial")({
  head: () => ({
    meta: [
      { title: "Reporte Área Comercial General — Visor Ventas" },
      { name: "description", content: "KPIs, rotación, Pareto 80/20, stock muerto y resumen ejecutivo comercial." },
      { property: "og:title", content: "Reporte Área Comercial General — Visor Ventas" },
      { property: "og:description", content: "Análisis comercial integral del historial de ventas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CommercialReportPage,
});
