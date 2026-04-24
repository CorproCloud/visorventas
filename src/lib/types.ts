// Modelo de datos basado en "Consecutivo de Facturas Desglosado de Ventas"
// Una factura agrupa N líneas de producto. Se preservan totales fiscales.

export interface InvoiceLine {
  code: string;          // Clave del producto
  description: string;   // Descripción
  unit: string;          // BOTEL, CAJA, etc.
  quantity: number;      // Cantidad
  unitPrice: number;     // Pre. en M.N.
  discount1: number;     // Desc. 1
  discount2: number;     // Desc. 2
  ivaUnit: number;       // IVA Pr. M.N.
  pedimento?: string;    // Lote/serie/Pedimento
  lineNet: number;       // quantity * unitPrice - descuentos (calculado)
  category?: string;     // derivado de descripción
}

export interface Invoice {
  id: string;            // {folio}-{idx}
  folio: string;         // Folio (ej. "F  29030")
  date: string;          // ISO yyyy-mm-dd
  yearMonth: string;     // yyyy-mm
  year: string;          // yyyy
  customerId: string;    // Clave de cliente
  customerName: string;  // Razón social
  status: string;        // Pagada, etc.
  currency: string;      // PESOS, USD
  agentId: string;       // Agente
  subtotal: number;      // Subtotal en M.N.
  ieps: number;          // IEPS en M.N.
  iva: number;           // IVA en M.N.
  retIsr: number;        // Ret.ISR en M.N.
  retIva: number;        // Ret.IVA en M.N.
  total: number;         // Total en M.N.
  balance: number;       // Saldo en M.N.
  lines: InvoiceLine[];
}

export interface CustomerSummary {
  id: string;
  name: string;
  invoiceCount: number;
  totalSales: number;       // suma subtotales
  totalRevenue: number;     // suma totales c/IVA
  totalUnits: number;
  avgTicket: number;        // total / invoiceCount
  lastInvoiceDate: string;
  firstInvoiceDate: string;
  outstandingBalance: number;
  uniqueSkus: number;
  topCategory: string;
}

export interface Dataset {
  id: string;
  name: string;
  uploadedAt: number;
  invoices: Invoice[];
  invoiceCount: number;
  lineCount: number;
  months: string[];        // yyyy-mm ordenados
  years: string[];         // yyyy ordenados
  dateRange: { from: string; to: string };
}

export interface DatasetSummary {
  id: string;
  name: string;
  uploadedAt: number;
  invoiceCount: number;
  months: string[];
}
