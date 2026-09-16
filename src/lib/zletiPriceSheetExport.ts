import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

import { formatMoney, type MarketplaceCurrency } from './zletiPricing';

export interface PriceSheetRow {
  sku: string;
  productName: string;
  variantName?: string | null;
  quantity: number;
  unitWeightKg: number;
  volumetricWeightKg: number;
  chargeableWeightKg: number;
  volumeCm3: number;
  productCostUsd: number;
  shippingPerUnitUsd: number;
  landedUnitCostUsd: number;
  marketplaceName: string;
  currency: MarketplaceCurrency | string;
  suggestedSalePrice: number;
  netProfit: number;
  marginPercent: number;
}

export interface PriceSheetMeta {
  poNumber: string;
  generatedAt: Date;
  rateLabel: string;
  totalChargeableWeightKg: number;
  shippingCostUsd: number;
  extraExpensesUsd: number;
  totalEstimateUsd: number;
}

const round = (value: number, digits = 2) => Number((Number(value) || 0).toFixed(digits));

export const exportPriceSheetToExcel = (rows: PriceSheetRow[], meta: PriceSheetMeta) => {
  const sheetRows = rows.map(row => ({
    SKU: row.sku,
    Producto: row.productName,
    Variante: row.variantName || '',
    Unidades: row.quantity,
    'Peso real (kg/u)': round(row.unitWeightKg, 3),
    'Peso volumétrico (kg/u)': round(row.volumetricWeightKg, 3),
    'Peso facturable (kg/u)': round(row.chargeableWeightKg, 3),
    'Volumen (cm³/u)': round(row.volumeCm3, 0),
    'Costo producto (USD)': round(row.productCostUsd),
    'Envío por unidad (USD)': round(row.shippingPerUnitUsd),
    'Costo aterrizado (USD)': round(row.landedUnitCostUsd),
    Marketplace: row.marketplaceName,
    Moneda: row.currency,
    'Precio sugerido': round(row.suggestedSalePrice),
    'Ganancia neta': round(row.netProfit),
    'Margen %': round(row.marginPercent),
  }));

  const summary = [
    ['Hoja de precios ZleTI'],
    ['PO', meta.poNumber],
    ['Generado', meta.generatedAt.toLocaleString('es-MX')],
    ['Tarifa', meta.rateLabel],
    ['Peso facturable total (kg)', round(meta.totalChargeableWeightKg, 3)],
    ['Costo de envío (USD)', round(meta.shippingCostUsd)],
    ['Gastos adicionales (USD)', round(meta.extraExpensesUsd)],
    ['Total estimado (USD)', round(meta.totalEstimateUsd)],
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summary), 'Resumen');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheetRows), 'Precios');
  XLSX.writeFile(workbook, `hoja-precios-${meta.poNumber || 'zleti'}.xlsx`);
};

export const exportPriceSheetToPdf = (rows: PriceSheetRow[], meta: PriceSheetMeta) => {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 28;
  let y = 42;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.text('Hoja de precios ZleTI', marginX, y);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  y += 16;
  pdf.text(`PO ${meta.poNumber || 'sin número'} · ${meta.generatedAt.toLocaleString('es-MX')}`, marginX, y);
  y += 12;
  pdf.text(
    `Tarifa: ${meta.rateLabel} · Peso facturable: ${meta.totalChargeableWeightKg.toFixed(2)} kg · Envío: ${formatMoney(meta.shippingCostUsd, 'USD')} · Gastos: ${formatMoney(meta.extraExpensesUsd, 'USD')} · Total: ${formatMoney(meta.totalEstimateUsd, 'USD')}`,
    marginX,
    y
  );
  y += 18;

  const columns: { label: string; width: number; align?: 'right'; value: (row: PriceSheetRow) => string }[] = [
    { label: 'SKU', width: 76, value: row => row.sku || '' },
    { label: 'Producto', width: 150, value: row => `${row.productName}${row.variantName ? ` · ${row.variantName}` : ''}` },
    { label: 'Uds', width: 34, align: 'right', value: row => String(row.quantity) },
    { label: 'Peso fact.', width: 56, align: 'right', value: row => `${row.chargeableWeightKg.toFixed(3)}` },
    { label: 'Costo USD', width: 60, align: 'right', value: row => row.productCostUsd.toFixed(2) },
    { label: 'Envío USD', width: 60, align: 'right', value: row => row.shippingPerUnitUsd.toFixed(2) },
    { label: 'Aterrizado', width: 64, align: 'right', value: row => row.landedUnitCostUsd.toFixed(2) },
    { label: 'Canal', width: 80, value: row => row.marketplaceName },
    { label: 'Precio sug.', width: 74, align: 'right', value: row => `${row.suggestedSalePrice.toFixed(2)} ${row.currency}` },
    { label: 'Ganancia', width: 66, align: 'right', value: row => row.netProfit.toFixed(2) },
    { label: 'Margen', width: 50, align: 'right', value: row => `${row.marginPercent.toFixed(1)}%` },
  ];

  const drawHeader = () => {
    pdf.setFillColor(15, 42, 74);
    pdf.rect(marginX, y - 11, pageWidth - marginX * 2, 16, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    let x = marginX + 4;
    columns.forEach(column => {
      pdf.text(column.label, column.align === 'right' ? x + column.width - 8 : x, y, {
        align: column.align === 'right' ? 'right' : 'left',
      });
      x += column.width;
    });
    pdf.setTextColor(30, 30, 30);
    pdf.setFont('helvetica', 'normal');
    y += 16;
  };

  drawHeader();

  rows.forEach((row, index) => {
    if (y > pageHeight - 40) {
      pdf.addPage();
      y = 42;
      drawHeader();
    }
    if (index % 2 === 1) {
      pdf.setFillColor(243, 246, 250);
      pdf.rect(marginX, y - 9, pageWidth - marginX * 2, 14, 'F');
    }
    let x = marginX + 4;
    pdf.setFontSize(8);
    columns.forEach(column => {
      const text = pdf.splitTextToSize(column.value(row), column.width - 8)[0] || '';
      pdf.text(text, column.align === 'right' ? x + column.width - 8 : x, y, {
        align: column.align === 'right' ? 'right' : 'left',
      });
      x += column.width;
    });
    y += 14;
  });

  pdf.save(`hoja-precios-${meta.poNumber || 'zleti'}.pdf`);
};
