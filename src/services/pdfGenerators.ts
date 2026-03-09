import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';

// Module-level branding name — set via setBrandingName() from BrandingApplier
let _platformBrandName = 'SIVER MARKET 509';
export const setBrandingName = (name: string) => {
  if (name) _platformBrandName = name;
};

// Types for PDF data
interface OrderItem {
  sku: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  color?: string;
  size?: string;
  image?: string;
}

interface OrderData {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_address?: string;
  department?: string;
  commune?: string;
  items: OrderItem[];
  total_amount: number;
  payment_method?: string;
  created_at: string;
  hybrid_tracking_id?: string;
}

interface ConsolidationData {
  consolidation_number: string;
  supplier_name?: string;
  items: {
    sku: string;
    product_name: string;
    color?: string;
    size?: string;
    quantity_to_order: number;
    unit_cost: number;
    total_cost: number;
  }[];
  total_quantity: number;
  estimated_cost: number;
  created_at: string;
}

interface ManifestItem {
  hybrid_tracking_id: string;
  customer_name: string;
  customer_phone?: string;
  commune: string;
  department: string;
  unit_count: number;
  has_owner: boolean;
}

// NEW: Picking Manifest grouped by customer
interface PickingManifestCustomer {
  customer_id: string;
  customer_name: string;
  customer_phone?: string;
  commune: string;
  department: string;
  internal_tracking_id: string;
  items: {
    product_name: string;
    image?: string;
    sku: string;
    variants: { color?: string; size?: string; quantity: number }[];
  }[];
  total_units: number;
}

interface PickingManifestData {
  china_tracking: string;
  arrival_date: string;
  customers: PickingManifestCustomer[];
}

// Utility to open print window
const openPrintWindow = (content: string, title: string) => {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
};

// Common styles
const baseStyles = `
  body { font-family: 'Arial', sans-serif; margin: 0; padding: 20px; color: #333; }
  .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
  .logo { font-size: 24px; font-weight: bold; }
  .subtitle { color: #666; font-size: 12px; }
  .section { margin-bottom: 20px; }
  .section-title { font-weight: bold; font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
  th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
  th { background-color: #f5f5f5; font-weight: bold; }
  .total-row { font-weight: bold; background-color: #f0f0f0; }
  .signature-area { margin-top: 40px; border-top: 1px solid #000; padding-top: 10px; }
  .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #666; }
  @media print { body { margin: 0; } }
`;

// PDF: Purchase Order for China supplier
export const generatePurchaseOrderPDF = (data: ConsolidationData) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Orden de Compra - ${data.consolidation_number}</title>
      <style>
        ${baseStyles}
        .po-number { font-size: 18px; font-weight: bold; color: #071d7f; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">${_platformBrandName}</div>
        <div class="subtitle">Purchase Order / Orden de Compra</div>
        <div class="po-number">${data.consolidation_number}</div>
      </div>
      
      <div class="section">
        <div class="section-title">Order Details / Detalles del Pedido</div>
        <p><strong>Date:</strong> ${format(new Date(data.created_at), 'PPP', { locale: es })}</p>
        <p><strong>Supplier:</strong> ${data.supplier_name || 'N/A'}</p>
        <p><strong>Total Items:</strong> ${data.items.length}</p>
        <p><strong>Total Quantity:</strong> ${data.total_quantity} units</p>
      </div>
      
      <div class="section">
        <div class="section-title">Items to Order / Artículos a Pedir</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>SKU</th>
              <th>Product Name</th>
              <th>Color</th>
              <th>Size</th>
              <th>Qty</th>
              <th>Unit Cost</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map((item, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${item.sku}</td>
                <td>${item.product_name}</td>
                <td>${item.color || '-'}</td>
                <td>${item.size || '-'}</td>
                <td style="text-align: center;">${item.quantity_to_order}</td>
                <td style="text-align: right;">$${item.unit_cost.toFixed(2)}</td>
                <td style="text-align: right;">$${item.total_cost.toFixed(2)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="5">TOTAL</td>
              <td style="text-align: center;">${data.total_quantity}</td>
              <td></td>
              <td style="text-align: right;">$${data.estimated_cost.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="footer">
        <p>${_platformBrandName} - Puerto Príncipe, Haití</p>
        <p>Documento generado el ${format(new Date(), 'PPP p', { locale: es })}</p>
      </div>
    </body>
    </html>
  `;
  
  openPrintWindow(html, `Orden de Compra - ${data.consolidation_number}`);
};

// PDF: Arrival Manifest for Haiti staff
export const generateArrivalManifestPDF = (items: ManifestItem[], containerInfo: { tracking: string; arrival_date: string }) => {
  const withOwner = items.filter(i => i.has_owner);
  const toStock = items.filter(i => !i.has_owner);
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Manifiesto de Llegada - ${containerInfo.tracking}</title>
      <style>
        ${baseStyles}
        .has-owner { background-color: #e8f5e9; }
        .to-stock { background-color: #fff3e0; }
        .legend { display: flex; gap: 20px; margin-bottom: 15px; }
        .legend-item { display: flex; align-items: center; gap: 5px; font-size: 12px; }
        .legend-color { width: 20px; height: 20px; border: 1px solid #ccc; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">MANIFIESTO DE LLEGADA</div>
        <div class="subtitle">${_platformBrandName} - Almacén Haití</div>
      </div>
      
      <div class="section">
        <div class="section-title">Información del Contenedor</div>
        <p><strong>Tracking:</strong> ${containerInfo.tracking}</p>
        <p><strong>Fecha de Llegada:</strong> ${format(new Date(containerInfo.arrival_date), 'PPP', { locale: es })}</p>
        <p><strong>Total Paquetes:</strong> ${items.length}</p>
      </div>
      
      <div class="legend">
        <div class="legend-item">
          <div class="legend-color has-owner"></div>
          <span>Con Dueño (${withOwner.length})</span>
        </div>
        <div class="legend-item">
          <div class="legend-color to-stock"></div>
          <span>A Stock (${toStock.length})</span>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Paquetes con Dueño Asignado</div>
        <table>
          <thead>
            <tr>
              <th>ID Híbrido</th>
              <th>Cliente</th>
              <th>Comuna</th>
              <th>Departamento</th>
              <th>Unidades</th>
            </tr>
          </thead>
          <tbody>
            ${withOwner.map(item => `
              <tr class="has-owner">
                <td><strong>${item.hybrid_tracking_id}</strong></td>
                <td>${item.customer_name}</td>
                <td>${item.commune}</td>
                <td>${item.department}</td>
                <td style="text-align: center;">${item.unit_count}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      ${toStock.length > 0 ? `
        <div class="section">
          <div class="section-title">Paquetes a Stock (Sin Dueño)</div>
          <table>
            <thead>
              <tr>
                <th>ID Híbrido</th>
                <th>Destino Sugerido</th>
                <th>Unidades</th>
              </tr>
            </thead>
            <tbody>
              ${toStock.map(item => `
                <tr class="to-stock">
                  <td><strong>${item.hybrid_tracking_id}</strong></td>
                  <td>Almacén General</td>
                  <td style="text-align: center;">${item.unit_count}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
      
      <div class="signature-area">
        <p>Recibido por: ___________________________ Fecha: _______________</p>
        <p>Verificado por: _________________________ Fecha: _______________</p>
      </div>
      
      <div class="footer">
        <p>Documento generado el ${format(new Date(), 'PPP p', { locale: es })}</p>
      </div>
    </body>
    </html>
  `;
  
  openPrintWindow(html, `Manifiesto - ${containerInfo.tracking}`);
};

// PDF: Invoice/Delivery Guide with product images
export const generateInvoicePDF = (order: OrderData) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Factura - ${order.order_number}</title>
      <style>
        ${baseStyles}
        .product-row { display: flex; align-items: center; gap: 15px; padding: 10px; border-bottom: 1px solid #eee; }
        .product-image { width: 60px; height: 60px; object-fit: cover; border-radius: 4px; }
        .product-info { flex: 1; }
        .product-variant { color: #666; font-size: 11px; }
        .amounts { text-align: right; }
        .customer-info { background: #f9f9f9; padding: 15px; border-radius: 8px; }
        .tracking-id { font-family: monospace; font-size: 16px; font-weight: bold; letter-spacing: 1px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">${_platformBrandName}</div>
        <div class="subtitle">Factura / Guía de Entrega</div>
      </div>
      
      <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
        <div>
          <p><strong>Factura #:</strong> ${order.order_number}</p>
          <p><strong>Fecha:</strong> ${format(new Date(order.created_at), 'PPP', { locale: es })}</p>
          <p><strong>Método de Pago:</strong> ${order.payment_method || 'N/A'}</p>
        </div>
        ${order.hybrid_tracking_id ? `
          <div style="text-align: right;">
            <p><strong>ID de Seguimiento:</strong></p>
            <p class="tracking-id">${order.hybrid_tracking_id}</p>
          </div>
        ` : ''}
      </div>
      
      <div class="customer-info">
        <div class="section-title">Datos del Cliente</div>
        <p><strong>Nombre:</strong> ${order.customer_name}</p>
        <p><strong>Teléfono:</strong> ${order.customer_phone}</p>
        ${order.customer_address ? `<p><strong>Dirección:</strong> ${order.customer_address}</p>` : ''}
        ${order.commune && order.department ? `<p><strong>Ubicación:</strong> ${order.commune}, ${order.department}</p>` : ''}
      </div>
      
      <div class="section" style="margin-top: 20px;">
        <div class="section-title">Productos</div>
        <table>
          <thead>
            <tr>
              <th style="width: 80px;">Imagen</th>
              <th>Producto</th>
              <th>SKU</th>
              <th>Cant.</th>
              <th>Precio</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map(item => `
              <tr>
                <td>
                  ${item.image ? `<img src="${item.image}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;" />` : '-'}
                </td>
                <td>
                  <strong>${item.nombre}</strong>
                  ${item.color || item.size ? `<br/><span style="color: #666; font-size: 11px;">${item.color || ''} ${item.size || ''}</span>` : ''}
                </td>
                <td>${item.sku}</td>
                <td style="text-align: center;">${item.cantidad}</td>
                <td style="text-align: right;">$${Number(item.precio_unitario || 0).toFixed(2)}</td>
                <td style="text-align: right;">$${Number(item.subtotal || 0).toFixed(2)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="5" style="text-align: right;">TOTAL</td>
              <td style="text-align: right;">$${Number(order.total_amount || 0).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="signature-area">
        <div style="display: flex; justify-content: space-between;">
          <div style="width: 45%;">
            <p style="margin-bottom: 30px;">Firma del Cliente:</p>
            <div style="border-bottom: 1px solid #000;"></div>
            <p style="font-size: 10px; color: #666;">Recibido Conforme</p>
          </div>
          <div style="width: 45%;">
            <p style="margin-bottom: 30px;">Fecha de Recepción:</p>
            <div style="border-bottom: 1px solid #000;"></div>
          </div>
        </div>
      </div>
      
      <div class="footer">
        <p>¡Gracias por su compra! - ${_platformBrandName}</p>
        <p>Documento generado el ${format(new Date(), 'PPP p', { locale: es })}</p>
      </div>
    </body>
    </html>
  `;
  
  openPrintWindow(html, `Factura - ${order.order_number}`);
};

// PDF: Thermal Label (4x6)
export const generateThermalLabelPDF = (labelData: {
  hybridTrackingId: string;
  customerName: string;
  customerPhone: string;
  commune: string;
  department: string;
  unitCount: number;
  trackingUrl?: string;
}) => {
  const qrUrl = labelData.trackingUrl || `https://siver.market/tracking/${labelData.hybridTrackingId}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Etiqueta - ${labelData.hybridTrackingId}</title>
      <style>
        @page { size: 4in 6in; margin: 0; }
        body { 
          margin: 0; 
          padding: 8px; 
          font-family: 'Arial', sans-serif; 
          width: 4in; 
          height: 6in; 
          box-sizing: border-box;
        }
        .label-container {
          width: 100%;
          height: 100%;
          border: 3px solid #000;
          padding: 12px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }
        .tracking-header {
          text-align: center;
          border-bottom: 3px solid #000;
          padding-bottom: 10px;
          margin-bottom: 10px;
        }
        .tracking-label { font-size: 10px; color: #666; }
        .tracking-id { 
          font-size: 22px; 
          font-weight: bold; 
          letter-spacing: 2px;
          word-break: break-all;
          font-family: monospace;
        }
        .qr-section {
          display: flex;
          justify-content: center;
          padding: 15px 0;
          border-bottom: 2px dashed #000;
        }
        .units-badge {
          font-size: 32px;
          font-weight: bold;
          text-align: center;
          padding: 10px;
          border: 3px solid #000;
          margin: 10px 0;
          background: #f0f0f0;
        }
        .customer-info {
          flex: 1;
          padding: 10px 0;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 5px 0;
          font-size: 14px;
        }
        .info-label { font-weight: bold; }
        .destination {
          text-align: center;
          background: #000;
          color: #fff;
          padding: 15px;
          margin-top: auto;
        }
        .destination-title { font-size: 12px; }
        .destination-value { font-size: 18px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="label-container">
        <div class="tracking-header">
          <div class="tracking-label">ID DE SEGUIMIENTO</div>
          <div class="tracking-id">${labelData.hybridTrackingId}</div>
        </div>
        
        <div class="qr-section">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrUrl)}" 
               alt="QR Code" style="width: 120px; height: 120px;" />
        </div>
        
        <div class="units-badge">
          📦 ${labelData.unitCount} UNIDAD${labelData.unitCount > 1 ? 'ES' : ''}
        </div>
        
        <div class="customer-info">
          <div class="info-row">
            <span class="info-label">Cliente:</span>
            <span>${labelData.customerName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Teléfono:</span>
            <span>${labelData.customerPhone}</span>
          </div>
        </div>
        
        <div class="destination">
          <div class="destination-title">DESTINO</div>
          <div class="destination-value">${labelData.commune}, ${labelData.department}</div>
        </div>
      </div>
    </body>
    </html>
  `;
  
  openPrintWindow(html, `Etiqueta - ${labelData.hybridTrackingId}`);
};

// Batch print labels by department
export const generateBatchLabelsPDF = (labels: Array<{
  hybridTrackingId: string;
  customerName: string;
  customerPhone: string;
  commune: string;
  department: string;
  unitCount: number;
}>) => {
  const labelsHtml = labels.map(label => `
    <div class="label-page">
      <div class="label-container">
        <div class="tracking-header">
          <div class="tracking-label">ID DE SEGUIMIENTO</div>
          <div class="tracking-id">${label.hybridTrackingId}</div>
        </div>
        <div class="qr-section">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`https://siver.market/tracking/${label.hybridTrackingId}`)}" 
               alt="QR" style="width: 100px; height: 100px;" />
        </div>
        <div class="units-badge">📦 ${label.unitCount}</div>
        <div class="customer-info">
          <div class="info-row"><span class="info-label">Cliente:</span><span>${label.customerName}</span></div>
          <div class="info-row"><span class="info-label">Tel:</span><span>${label.customerPhone}</span></div>
        </div>
        <div class="destination">
          <div class="destination-title">DESTINO</div>
          <div class="destination-value">${label.commune}, ${label.department}</div>
        </div>
      </div>
    </div>
  `).join('');
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Lote de Etiquetas</title>
      <style>
        @page { size: 4in 6in; margin: 0; }
        body { margin: 0; padding: 0; font-family: 'Arial', sans-serif; }
        .label-page { 
          width: 4in; 
          height: 6in; 
          padding: 8px;
          box-sizing: border-box;
          page-break-after: always;
        }
        .label-container { width: 100%; height: 100%; border: 3px solid #000; padding: 10px; box-sizing: border-box; display: flex; flex-direction: column; }
        .tracking-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
        .tracking-label { font-size: 9px; color: #666; }
        .tracking-id { font-size: 16px; font-weight: bold; font-family: monospace; word-break: break-all; }
        .qr-section { display: flex; justify-content: center; padding: 10px 0; border-bottom: 1px dashed #000; }
        .units-badge { font-size: 24px; font-weight: bold; text-align: center; padding: 8px; border: 2px solid #000; margin: 8px 0; background: #f0f0f0; }
        .customer-info { flex: 1; padding: 8px 0; }
        .info-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; }
        .info-label { font-weight: bold; }
        .destination { text-align: center; background: #000; color: #fff; padding: 10px; margin-top: auto; }
        .destination-title { font-size: 10px; }
        .destination-value { font-size: 14px; font-weight: bold; }
      </style>
    </head>
    <body>
      ${labelsHtml}
    </body>
    </html>
  `;
  
  openPrintWindow(html, `Lote de ${labels.length} Etiquetas`);
};

// NEW: Picking Manifest PDF - grouped by customer with images and variants
export const generatePickingManifestPDF = (data: PickingManifestData) => {
  const customersHtml = data.customers.map((customer, idx) => `
    <div class="customer-section ${idx > 0 ? 'page-break' : ''}">
      <div class="customer-header">
        <div class="customer-number">${idx + 1}</div>
        <div class="customer-details">
          <div class="customer-name">${customer.customer_name}</div>
          <div class="customer-contact">
            ${customer.customer_phone ? `📞 ${customer.customer_phone}` : ''} 
            📍 ${customer.commune}, ${customer.department}
          </div>
        </div>
        <div class="tracking-badge">
          <div class="tracking-label">ID SIVER</div>
          <div class="tracking-value">${customer.internal_tracking_id}</div>
        </div>
      </div>
      
      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 70px;">Imagen</th>
            <th>Producto</th>
            <th>SKU</th>
            <th>Variantes</th>
            <th style="width: 60px;">Cant.</th>
          </tr>
        </thead>
        <tbody>
          ${customer.items.map(item => `
            <tr>
              <td class="image-cell">
                ${item.image 
                  ? `<img src="${item.image}" class="product-thumb" onerror="this.style.display='none'" />` 
                  : '<div class="no-image">📦</div>'}
              </td>
              <td class="product-name">${item.product_name}</td>
              <td class="sku">${item.sku}</td>
              <td class="variants">
                ${item.variants.map(v => `
                  <div class="variant-line">
                    ${v.color ? `<span class="variant-color">🎨 ${v.color}</span>` : ''}
                    ${v.size ? `<span class="variant-size">📏 ${v.size}</span>` : ''}
                    <span class="variant-qty">×${v.quantity}</span>
                  </div>
                `).join('')}
              </td>
              <td class="quantity">${item.variants.reduce((sum, v) => sum + v.quantity, 0)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="4" style="text-align: right; font-weight: bold;">TOTAL UNIDADES:</td>
            <td class="quantity" style="font-weight: bold; font-size: 16px;">${customer.total_units}</td>
          </tr>
        </tfoot>
      </table>
      
      <div class="picking-check">
        <div class="check-box">☐</div>
        <span>Verificado y Separado</span>
        <span class="check-signature">Firma: _______________</span>
      </div>
    </div>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Manifiesto de Picking - ${data.china_tracking}</title>
      <style>
        ${baseStyles}
        @page { margin: 15mm; }
        .manifest-header {
          background: linear-gradient(135deg, #071d7f 0%, #0a47a1 100%);
          color: white;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .manifest-title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
        .manifest-subtitle { font-size: 12px; opacity: 0.9; }
        .manifest-info { display: flex; justify-content: space-between; margin-top: 15px; }
        .manifest-info-item { text-align: center; }
        .manifest-info-label { font-size: 10px; opacity: 0.8; }
        .manifest-info-value { font-size: 18px; font-weight: bold; }
        
        .customer-section { 
          border: 2px solid #333; 
          border-radius: 8px; 
          margin-bottom: 25px; 
          overflow: hidden;
        }
        .customer-header {
          background: #f8f9fa;
          padding: 15px;
          display: flex;
          align-items: center;
          gap: 15px;
          border-bottom: 2px solid #333;
        }
        .customer-number {
          width: 40px;
          height: 40px;
          background: #071d7f;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: bold;
        }
        .customer-details { flex: 1; }
        .customer-name { font-size: 18px; font-weight: bold; }
        .customer-contact { font-size: 12px; color: #666; margin-top: 4px; }
        
        .tracking-badge {
          background: #000;
          color: #fff;
          padding: 10px 15px;
          border-radius: 6px;
          text-align: center;
        }
        .tracking-label { font-size: 10px; opacity: 0.8; }
        .tracking-value { font-size: 14px; font-weight: bold; font-family: monospace; }
        
        .items-table { width: 100%; border-collapse: collapse; }
        .items-table th { 
          background: #e9ecef; 
          padding: 10px; 
          text-align: left; 
          font-size: 11px;
          text-transform: uppercase;
          border-bottom: 2px solid #333;
        }
        .items-table td { padding: 10px; border-bottom: 1px solid #ddd; vertical-align: middle; }
        .image-cell { text-align: center; }
        .product-thumb { width: 60px; height: 60px; object-fit: cover; border-radius: 4px; border: 1px solid #ddd; }
        .no-image { width: 60px; height: 60px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; font-size: 24px; border-radius: 4px; }
        .product-name { font-weight: 500; }
        .sku { font-family: monospace; font-size: 11px; color: #666; }
        .variants { }
        .variant-line { 
          padding: 3px 0; 
          font-size: 12px;
          display: flex;
          gap: 10px;
          align-items: center;
        }
        .variant-color { background: #e3f2fd; padding: 2px 6px; border-radius: 3px; }
        .variant-size { background: #f3e5f5; padding: 2px 6px; border-radius: 3px; }
        .variant-qty { font-weight: bold; color: #071d7f; }
        .quantity { text-align: center; font-size: 14px; }
        .total-row { background: #f8f9fa; }
        
        .picking-check {
          background: #fff3cd;
          padding: 12px 15px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
        }
        .check-box { font-size: 20px; }
        .check-signature { margin-left: auto; }
        
        .page-break { page-break-before: always; }
        
        .summary-section {
          background: #e8f5e9;
          border: 2px solid #4caf50;
          border-radius: 8px;
          padding: 15px;
          margin-top: 20px;
        }
        .summary-title { font-weight: bold; margin-bottom: 10px; color: #2e7d32; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
        .summary-item { text-align: center; }
        .summary-label { font-size: 11px; color: #666; }
        .summary-value { font-size: 24px; font-weight: bold; color: #2e7d32; }
      </style>
    </head>
    <body>
      <div class="manifest-header">
        <div class="manifest-title">📋 MANIFIESTO DE PICKING</div>
        <div class="manifest-subtitle">Hub ${_platformBrandName} - Documento de Separación por Destinatario</div>
        <div class="manifest-info">
          <div class="manifest-info-item">
            <div class="manifest-info-label">TRACKING CHINA</div>
            <div class="manifest-info-value">${data.china_tracking}</div>
          </div>
          <div class="manifest-info-item">
            <div class="manifest-info-label">FECHA LLEGADA</div>
            <div class="manifest-info-value">${format(new Date(data.arrival_date), 'dd/MM/yyyy')}</div>
          </div>
          <div class="manifest-info-item">
            <div class="manifest-info-label">DESTINATARIOS</div>
            <div class="manifest-info-value">${data.customers.length}</div>
          </div>
          <div class="manifest-info-item">
            <div class="manifest-info-label">TOTAL UNIDADES</div>
            <div class="manifest-info-value">${data.customers.reduce((sum, c) => sum + c.total_units, 0)}</div>
          </div>
        </div>
      </div>
      
      ${customersHtml}
      
      <div class="summary-section">
        <div class="summary-title">✅ RESUMEN DE PICKING</div>
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-label">Clientes Procesados</div>
            <div class="summary-value">${data.customers.length}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Productos Diferentes</div>
            <div class="summary-value">${data.customers.reduce((sum, c) => sum + c.items.length, 0)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Unidades Totales</div>
            <div class="summary-value">${data.customers.reduce((sum, c) => sum + c.total_units, 0)}</div>
          </div>
        </div>
      </div>
      
      <div class="signature-area" style="margin-top: 30px;">
        <p>Verificación Final: __________________________ Hora: ___________</p>
      </div>
      
      <div class="footer">
        <p>${_platformBrandName} - Hub Haití</p>
        <p>Documento generado el ${format(new Date(), 'PPP p', { locale: es })}</p>
      </div>
    </body>
    </html>
  `;
  
  openPrintWindow(html, `Manifiesto Picking - ${data.china_tracking}`);
};

// PDF: PO Consolidated Visual Picking Manifest (grouped by customer with images)
// UPDATED: Now supports B2B, B2C, and Siver Match source types
type POSourceType = 'b2b' | 'b2c' | 'siver_match';

interface POPickingCustomer {
  customer_name: string;
  customer_phone: string | null;
  hybrid_tracking_id: string | null;
  department_code: string | null;
  commune_code: string | null;
  source_type: POSourceType;
  gestor_name?: string | null;
  investor_name?: string | null;
  items: {
    product_name: string;
    sku: string;
    color: string | null;
    size: string | null;
    image_url: string | null;
    quantity: number;
  }[];
}

interface POPickingManifestData {
  po_number: string;
  china_tracking: string;
  total_orders: number;
  total_items: number;
  customers: POPickingCustomer[];
}

// Helper to get source type badge
const getSourceTypeBadge = (sourceType: POSourceType): { label: string; color: string; emoji: string } => {
  switch (sourceType) {
    case 'b2c':
      return { label: 'CLIENTE DIRECTO', color: '#4caf50', emoji: '🛒' };
    case 'b2b':
      return { label: 'VENDEDOR B2B', color: '#2196f3', emoji: '🏪' };
    case 'siver_match':
      return { label: 'SIVER MATCH', color: '#9c27b0', emoji: '🤝' };
    default:
      return { label: 'CLIENTE', color: '#666', emoji: '📦' };
  }
};

export const generatePOPickingManifestPDF = (data: POPickingManifestData) => {
  const customersHtml = data.customers.map((customer, idx) => {
    const totalUnits = customer.items.reduce((sum, i) => sum + i.quantity, 0);
    
    const itemsHtml = customer.items.map(item => `
      <tr>
        <td class="image-cell">
          ${item.image_url 
            ? `<img src="${item.image_url}" class="product-thumb" onerror="this.style.display='none'" />`
            : `<div class="no-image">📦</div>`
          }
        </td>
        <td>
          <div class="product-name">${item.product_name}</div>
          <div class="sku">${item.sku}</div>
        </td>
        <td>
          ${item.color ? `<span class="variant-color">${item.color}</span>` : '-'}
        </td>
        <td>
          ${item.size ? `<span class="variant-size">${item.size}</span>` : '-'}
        </td>
        <td class="quantity">
          <span class="variant-qty">${item.quantity}</span>
        </td>
      </tr>
    `).join('');
    
    const badge = getSourceTypeBadge(customer.source_type || 'b2c');
    
    return `
      <div class="customer-block ${idx > 0 ? 'page-break' : ''}" data-source="${customer.source_type}">
        <div class="customer-header">
          <div class="customer-number">${idx + 1}</div>
          <div class="customer-details">
            <div class="source-badge" style="background: ${badge.color};">
              ${badge.emoji} ${badge.label}
            </div>
            <div class="customer-name">${customer.customer_name}</div>
            <div class="customer-contact">
              📞 ${customer.customer_phone || 'N/A'} | 
              📍 ${customer.department_code || 'XX'}-${customer.commune_code || 'XX'}
            </div>
            ${customer.source_type === 'siver_match' ? `
              <div class="siver-match-info">
                👤 Gestor: <strong>${customer.gestor_name || 'N/A'}</strong> | 
                💰 Inversor: <strong>${customer.investor_name || 'N/A'}</strong>
              </div>
            ` : ''}
          </div>
          <div class="tracking-badge">
            <div class="tracking-label">ID SEGUIMIENTO</div>
            <div class="tracking-value">${customer.hybrid_tracking_id || 'PENDING'}</div>
          </div>
        </div>
        
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 80px;">Imagen</th>
              <th>Producto</th>
              <th>Color</th>
              <th>Talla</th>
              <th style="width: 60px; text-align: center;">Qty</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
            <tr class="total-row">
              <td colspan="4" style="text-align: right; font-weight: bold;">TOTAL UNIDADES:</td>
              <td class="quantity"><strong>${totalUnits}</strong></td>
            </tr>
          </tbody>
        </table>
        
        <div class="picking-check ${customer.source_type === 'siver_match' ? 'siver-check' : ''}">
          <span class="check-box">☐</span>
          <span>Verificado y separado correctamente</span>
          ${customer.source_type === 'siver_match' 
            ? '<span class="delivery-note">⚠️ Entregar a GESTOR, no cliente final</span>' 
            : ''}
          <span class="check-signature">Firma: _______________</span>
        </div>
      </div>
    `;
  }).join('');

  const totalUnits = data.customers.reduce((sum, c) => 
    sum + c.items.reduce((s, i) => s + i.quantity, 0), 0
  );

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Manifiesto PO - ${data.po_number}</title>
      <style>
        ${baseStyles}
        body { background: #fff; }
        .manifest-header {
          background: linear-gradient(135deg, #071d7f 0%, #1a3a9f 100%);
          color: white;
          padding: 20px;
          margin: -20px -20px 20px -20px;
          border-radius: 0 0 15px 15px;
        }
        .manifest-title { font-size: 22px; font-weight: bold; margin-bottom: 5px; }
        .manifest-subtitle { font-size: 12px; opacity: 0.8; margin-bottom: 15px; }
        .manifest-info { display: flex; gap: 20px; flex-wrap: wrap; }
        .manifest-info-item { 
          background: rgba(255,255,255,0.15); 
          padding: 10px 15px; 
          border-radius: 8px; 
          min-width: 120px;
        }
        .manifest-info-label { font-size: 10px; opacity: 0.8; text-transform: uppercase; }
        .manifest-info-value { font-size: 16px; font-weight: bold; }
        
        .customer-block { 
          border: 2px solid #e0e0e0; 
          border-radius: 10px; 
          margin-bottom: 25px; 
          overflow: hidden;
          break-inside: avoid;
        }
        .customer-header { 
          background: #f5f5f5; 
          padding: 15px;
          display: flex;
          align-items: center;
          gap: 15px;
          border-bottom: 2px solid #333;
        }
        .customer-number {
          width: 40px;
          height: 40px;
          background: #071d7f;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: bold;
        }
        .customer-details { flex: 1; }
        .customer-name { font-size: 18px; font-weight: bold; margin-top: 5px; }
        .customer-contact { font-size: 12px; color: #666; margin-top: 4px; }
        
        .source-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: bold;
          color: white;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .siver-match-info {
          font-size: 11px;
          color: #9c27b0;
          margin-top: 4px;
          background: #f3e5f5;
          padding: 4px 8px;
          border-radius: 4px;
        }
        .siver-check {
          background: #f3e5f5 !important;
        }
        .delivery-note {
          color: #9c27b0;
          font-weight: bold;
          font-size: 12px;
        }
        
        .tracking-badge {
          background: #000;
          color: #fff;
          padding: 10px 15px;
          border-radius: 6px;
          text-align: center;
        }
        .tracking-label { font-size: 10px; opacity: 0.8; }
        .tracking-value { font-size: 14px; font-weight: bold; font-family: monospace; }
        
        .items-table { width: 100%; border-collapse: collapse; }
        .items-table th { 
          background: #e9ecef; 
          padding: 10px; 
          text-align: left; 
          font-size: 11px;
          text-transform: uppercase;
          border-bottom: 2px solid #333;
        }
        .items-table td { padding: 10px; border-bottom: 1px solid #ddd; vertical-align: middle; }
        .image-cell { text-align: center; }
        .product-thumb { width: 60px; height: 60px; object-fit: cover; border-radius: 4px; border: 1px solid #ddd; }
        .no-image { width: 60px; height: 60px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; font-size: 24px; border-radius: 4px; }
        .product-name { font-weight: 500; }
        .sku { font-family: monospace; font-size: 11px; color: #666; }
        .variant-color { background: #e3f2fd; padding: 2px 6px; border-radius: 3px; }
        .variant-size { background: #f3e5f5; padding: 2px 6px; border-radius: 3px; }
        .variant-qty { font-weight: bold; color: #071d7f; }
        .quantity { text-align: center; font-size: 14px; }
        .total-row { background: #f8f9fa; }
        
        .picking-check {
          background: #fff3cd;
          padding: 12px 15px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
        }
        .check-box { font-size: 20px; }
        .check-signature { margin-left: auto; }
        
        .page-break { page-break-before: always; }
        
        .summary-section {
          background: #e8f5e9;
          border: 2px solid #4caf50;
          border-radius: 8px;
          padding: 15px;
          margin-top: 20px;
        }
        .summary-title { font-weight: bold; margin-bottom: 10px; color: #2e7d32; }
        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
        .summary-item { text-align: center; }
        .summary-label { font-size: 11px; color: #666; }
        .summary-value { font-size: 24px; font-weight: bold; color: #2e7d32; }
      </style>
    </head>
    <body>
      <div class="manifest-header">
        <div class="manifest-title">📦 MANIFIESTO DE CONSOLIDACIÓN PO</div>
        <div class="manifest-subtitle">Hub ${_platformBrandName} - Separación Visual por Dueño</div>
        <div class="manifest-info">
          <div class="manifest-info-item">
            <div class="manifest-info-label">ORDEN DE COMPRA</div>
            <div class="manifest-info-value">${data.po_number}</div>
          </div>
          <div class="manifest-info-item">
            <div class="manifest-info-label">TRACKING CHINA</div>
            <div class="manifest-info-value">${data.china_tracking || 'PENDIENTE'}</div>
          </div>
          <div class="manifest-info-item">
            <div class="manifest-info-label">PEDIDOS</div>
            <div class="manifest-info-value">${data.total_orders}</div>
          </div>
          <div class="manifest-info-item">
            <div class="manifest-info-label">UNIDADES</div>
            <div class="manifest-info-value">${totalUnits}</div>
          </div>
        </div>
      </div>
      
      ${customersHtml}
      
      <div class="summary-section">
        <div class="summary-title">✅ RESUMEN DE PICKING PO - MIXTO B2B/B2C</div>
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-label">🛒 B2C (Clientes)</div>
            <div class="summary-value">${data.customers.filter(c => c.source_type === 'b2c').length}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">🏪 B2B (Vendedores)</div>
            <div class="summary-value">${data.customers.filter(c => c.source_type === 'b2b').length}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">🤝 Siver Match</div>
            <div class="summary-value">${data.customers.filter(c => c.source_type === 'siver_match').length}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">📦 Total Unidades</div>
            <div class="summary-value">${totalUnits}</div>
          </div>
        </div>
        <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #4caf50;">
          <div style="display: flex; justify-content: space-between; font-size: 12px;">
            <span><strong>Tracking China:</strong> ${data.china_tracking || 'PENDIENTE'}</span>
            <span><strong>Total Pedidos:</strong> ${data.total_orders}</span>
            <span><strong>Total Productos:</strong> ${data.total_items}</span>
          </div>
        </div>
      </div>
      
      <div class="signature-area" style="margin-top: 30px;">
        <p>Verificación Final: __________________________ Hora: ___________</p>
      </div>
      
      <div class="footer">
        <p>${_platformBrandName} - Hub Haití</p>
        <p>Documento generado el ${format(new Date(), 'PPP p', { locale: es })}</p>
      </div>
    </body>
    </html>
  `;
  
  openPrintWindow(html, `Manifiesto PO - ${data.po_number}`);
};

// PDF: Buying list for a PO (Artículos a Comprar)
export const generatePOBuyingListPDF = (data: {
  po_number: string;
  market_name: string;
  generated_at: string;
  items: {
    sku: string;
    nombre: string;
    variantName: string | null;
    image: string | null;
    cantidad: number;
    url_origen: string | null;
  }[];
}) => {
  const totalUnits = data.items.reduce((s, i) => s + i.cantidad, 0);
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Lista de Compra - ${data.po_number}</title>
      <style>
        ${baseStyles}
        .po-badge { display:inline-block; background:#071d7f; color:#fff; padding:4px 12px; border-radius:4px; font-size:14px; font-weight:bold; margin-top:6px; }
        .variant-name { color:#1d4ed8; font-weight:bold; font-size:12px; }
        .sku-text { color:#888; font-size:10px; font-family:monospace; }
        .item-img { width:64px; height:64px; object-fit:cover; border-radius:4px; border:1px solid #eee; }
        .img-placeholder { width:64px; height:64px; background:#f5f5f5; border:1px solid #eee; border-radius:4px; display:flex; align-items:center; justify-content:center; color:#bbb; font-size:10px; text-align:center; }
        td.center { text-align:center; }
        .qty-badge { display:inline-block; background:#0f766e; color:#fff; border-radius:50%; width:32px; height:32px; line-height:32px; text-align:center; font-weight:bold; font-size:14px; }
        .total-row td { background:#f0fdf4; font-weight:bold; font-size:13px; }
        a { color:#1d4ed8; font-size:10px; word-break:break-all; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">${_platformBrandName}</div>
        <div class="subtitle">Lista de Artículos a Comprar</div>
        <div class="po-badge">${data.po_number} — ${data.market_name}</div>
      </div>

      <div class="section">
        <p><strong>Fecha:</strong> ${format(new Date(data.generated_at), 'PPP p', { locale: es })}</p>
        <p><strong>Total de variantes:</strong> ${data.items.length} &nbsp;|&nbsp; <strong>Total de unidades:</strong> ${totalUnits}</p>
      </div>

      <div class="section">
        <table>
          <thead>
            <tr>
              <th style="width:70px">Imagen</th>
              <th>Producto / Variante</th>
              <th style="width:55px" class="center">Cant.</th>
              <th>URL Origen</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map((item, idx) => `
              <tr>
                <td class="center">
                  ${item.image
                    ? `<img src="${item.image}" alt="${item.nombre}" class="item-img" />`
                    : `<div class="img-placeholder">Sin<br>imagen</div>`}
                </td>
                <td>
                  <div style="font-weight:600;font-size:12px">${item.nombre}</div>
                  ${item.variantName ? `<div class="variant-name">${item.variantName}</div>` : ''}
                  <div class="sku-text">${item.sku}</div>
                </td>
                <td class="center">
                  <span class="qty-badge">${item.cantidad}</span>
                </td>
                <td>
                  ${item.url_origen
                    ? `<a href="${item.url_origen}" target="_blank">${item.url_origen}</a>`
                    : '<span style="color:#bbb">—</span>'}
                </td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="2">TOTAL</td>
              <td class="center">${totalUnits}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="footer">
        <p>${_platformBrandName} - Puerto Príncipe, Haití</p>
        <p>Documento generado el ${format(new Date(), 'PPP p', { locale: es })}</p>
      </div>
    </body>
    </html>
  `;

  openPrintWindow(html, `Lista de Compra - ${data.po_number}`);
};

// Excel: Buying list for a PO (Artículos a Comprar)
export const generatePOBuyingListExcel = (data: {
  po_number: string;
  market_name: string;
  generated_at: string;
  items: {
    sku: string;
    nombre: string;
    variantName: string | null;
    image: string | null;
    cantidad: number;
    url_origen: string | null;
  }[];
}) => {
  const wb = XLSX.utils.book_new();

  // Build rows
  const headers = ['#', 'SKU', 'Producto', 'Variante', 'Cantidad', 'URL Origen'];
  const rows = data.items.map((item, idx) => [
    idx + 1,
    item.sku,
    item.nombre,
    item.variantName || '',
    item.cantidad,
    item.url_origen || '',
  ]);

  // Total row
  const totalUnits = data.items.reduce((s, i) => s + i.cantidad, 0);
  rows.push(['', '', 'TOTAL', '', totalUnits, '']);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Column widths
  ws['!cols'] = [
    { wch: 4 },   // #
    { wch: 28 },  // SKU
    { wch: 45 },  // Producto
    { wch: 20 },  // Variante
    { wch: 10 },  // Cantidad
    { wch: 50 },  // URL
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Artículos');

  // Metadata sheet
  const meta = XLSX.utils.aoa_to_sheet([
    ['PO', data.po_number],
    ['Mercado', data.market_name],
    ['Generado', format(new Date(data.generated_at), 'PPP p', { locale: es })],
    ['Total variantes', data.items.length],
    ['Total unidades', totalUnits],
  ]);
  XLSX.utils.book_append_sheet(wb, meta, 'Info');

  XLSX.writeFile(wb, `Lista_Compra_${data.po_number}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
};

export const PDFGenerators = {
  generatePurchaseOrderPDF,
  generateArrivalManifestPDF,
  generateInvoicePDF,
  generateThermalLabelPDF,
  generateBatchLabelsPDF,
  generatePickingManifestPDF,
  generatePOPickingManifestPDF,
  generatePOBuyingListPDF,
  generatePOBuyingListExcel,
};
