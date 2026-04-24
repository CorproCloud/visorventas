// Normalized sales record — adapted to the user's ERP export
// (Historial de Ventas por Producto x Año)
export interface SalesRecord {
  id: string;            // synthetic unique id
  period: string;        // year or period label (e.g. "2024")
  code: string;          // product clave
  description: string;   // product description
  unit: string;          // BOTEL, CAJA, etc.
  units: number;         // venta en unidades
  avgPrice: number;      // precio promedio MN
  netSales: number;      // venta neta MN
  netCost: number;       // costo neto MN
  marginPct: number;     // % margen
  weightPct: number;     // % en monto
  category?: string;     // derived (Whisky, Tequila, ...)
}

export interface Dataset {
  id: string;
  name: string;
  uploadedAt: number;
  rowCount: number;
  periods: string[];
  records: SalesRecord[];
}

export interface DatasetSummary {
  id: string;
  name: string;
  uploadedAt: number;
  rowCount: number;
  periods: string[];
}
