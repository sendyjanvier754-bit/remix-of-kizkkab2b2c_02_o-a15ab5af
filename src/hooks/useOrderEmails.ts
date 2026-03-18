import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// Order Email Service - Sends emails via the send-email edge function
// Supports both B2B and B2C orders with template-based emails
// ============================================================================

interface OrderEmailParams {
  buyerEmail: string;
  buyerName: string;
  orderId: string;
  orderNumber?: string;
  totalAmount: number;
  currency?: string;
  items?: Array<{ nombre: string; cantidad: number; precio_unitario: number }>;
  paymentMethod?: string;
  sellerName?: string;
  sellerEmail?: string;
  destinationCountryId?: string;
  orderType?: 'b2b' | 'b2c';
}

interface StatusChangeParams extends OrderEmailParams {
  newStatus: string;
  trackingNumber?: string;
  carrier?: string;
  carrierUrl?: string;
}

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('es', { style: 'currency', currency }).format(amount);
}

function formatOrderNumber(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}

function buildItemsTable(items: Array<{ nombre: string; cantidad: number; precio_unitario: number }>): string {
  if (!items || items.length === 0) return '';
  const rows = items.map(i =>
    `<tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${i.nombre}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.cantidad}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(i.precio_unitario)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(i.precio_unitario * i.cantidad)}</td>
    </tr>`
  ).join('');

  return `
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <thead>
        <tr style="background:#f3f4f6">
          <th style="padding:8px;text-align:left">Producto</th>
          <th style="padding:8px;text-align:center">Cant.</th>
          <th style="padding:8px;text-align:right">P. Unit.</th>
          <th style="padding:8px;text-align:right">Subtotal</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

const STATUS_LABELS: Record<string, string> = {
  placed: 'Pedido Realizado',
  paid: 'Pagado',
  preparing: 'En Preparación',
  shipped: 'Enviado',
  in_transit: 'En Tránsito',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  pending: 'Pendiente',
  pending_validation: 'Pendiente de Validación',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  moncash: 'MonCash',
  natcash: 'NatCash',
  stripe: 'Tarjeta de Crédito',
  transfer: 'Transferencia Bancaria',
};

async function sendOrderEmail(params: {
  to: string | string[];
  subject: string;
  htmlContent: string;
  type: string;
  destinationCountryId?: string;
}) {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to: params.to,
        subject: params.subject,
        htmlContent: params.htmlContent,
        type: params.type,
        destination_country_id: params.destinationCountryId,
      },
    });
    if (error) {
      console.error('[OrderEmail] Error sending:', error);
      return false;
    }
    console.log('[OrderEmail] Sent successfully:', params.type);
    return true;
  } catch (err) {
    console.error('[OrderEmail] Exception:', err);
    return false;
  }
}

function wrapEmailHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f9fafb">
  <div style="max-width:600px;margin:0 auto;padding:20px">
    <div style="background:linear-gradient(135deg,#071d7f 0%,#1e40af 100%);color:white;padding:30px;text-align:center;border-radius:8px 8px 0 0">
      <h1 style="margin:0;font-size:22px">Siver Market</h1>
    </div>
    <div style="background:#fff;padding:30px;border:1px solid #e5e7eb;border-top:none">
      ${body}
    </div>
    <div style="text-align:center;padding:20px;color:#6b7280;font-size:12px">
      <p>Este es un mensaje automático de Siver Market.</p>
      <p>© ${new Date().getFullYear()} Siver Market. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>`;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/** Send order confirmation email to buyer */
export async function sendOrderConfirmationEmail(params: OrderEmailParams) {
  const orderNum = params.orderNumber || formatOrderNumber(params.orderId);
  const itemsHtml = buildItemsTable(params.items || []);
  const paymentLabel = PAYMENT_METHOD_LABELS[params.paymentMethod || ''] || params.paymentMethod || 'N/A';

  const body = `
    <h2 style="color:#071d7f;margin-top:0">¡Pedido Confirmado! 🎉</h2>
    <p>Hola <strong>${params.buyerName}</strong>,</p>
    <p>Tu pedido <strong>#${orderNum}</strong> ha sido registrado exitosamente.</p>
    ${itemsHtml}
    <div style="background:#f0f9ff;padding:16px;border-radius:8px;margin:16px 0">
      <p style="margin:0"><strong>Total:</strong> ${formatCurrency(params.totalAmount, params.currency)}</p>
      <p style="margin:4px 0 0"><strong>Método de pago:</strong> ${paymentLabel}</p>
      <p style="margin:4px 0 0"><strong>Tipo:</strong> ${params.orderType === 'b2c' ? 'Tienda B2C' : 'Mayorista B2B'}</p>
    </div>
    <p>Te mantendremos informado sobre el estado de tu pedido.</p>`;

  return sendOrderEmail({
    to: params.buyerEmail,
    subject: `Pedido #${orderNum} confirmado - Siver Market`,
    htmlContent: wrapEmailHtml('Pedido Confirmado', body),
    type: 'orders',
    destinationCountryId: params.destinationCountryId,
  });
}

/** Send payment instructions email to buyer */
export async function sendPaymentDetailsEmail(params: OrderEmailParams) {
  const orderNum = params.orderNumber || formatOrderNumber(params.orderId);
  const paymentLabel = PAYMENT_METHOD_LABELS[params.paymentMethod || ''] || params.paymentMethod || 'N/A';

  let paymentInstructions = '';
  switch (params.paymentMethod) {
    case 'moncash':
      paymentInstructions = `
        <div style="background:#fff3cd;padding:16px;border-radius:8px;border-left:4px solid #ffc107">
          <h3 style="margin-top:0;color:#856404">📱 Pago por MonCash</h3>
          <p>Realiza tu pago a través de MonCash y luego sube el comprobante en la sección "Mis Pedidos".</p>
          <p><strong>Monto a pagar:</strong> ${formatCurrency(params.totalAmount, params.currency)}</p>
          <p><strong>Referencia:</strong> #${orderNum}</p>
        </div>`;
      break;
    case 'natcash':
      paymentInstructions = `
        <div style="background:#fff3cd;padding:16px;border-radius:8px;border-left:4px solid #ffc107">
          <h3 style="margin-top:0;color:#856404">📱 Pago por NatCash</h3>
          <p>Realiza tu pago a través de NatCash y luego sube el comprobante en la sección "Mis Pedidos".</p>
          <p><strong>Monto a pagar:</strong> ${formatCurrency(params.totalAmount, params.currency)}</p>
          <p><strong>Referencia:</strong> #${orderNum}</p>
        </div>`;
      break;
    case 'transfer':
      paymentInstructions = `
        <div style="background:#fff3cd;padding:16px;border-radius:8px;border-left:4px solid #ffc107">
          <h3 style="margin-top:0;color:#856404">🏦 Transferencia Bancaria</h3>
          <p>Realiza una transferencia bancaria y sube el comprobante en la sección "Mis Pedidos".</p>
          <p><strong>Monto a pagar:</strong> ${formatCurrency(params.totalAmount, params.currency)}</p>
          <p><strong>Referencia:</strong> #${orderNum}</p>
        </div>`;
      break;
    default:
      paymentInstructions = `
        <div style="background:#d1ecf1;padding:16px;border-radius:8px;border-left:4px solid #0dcaf0">
          <h3 style="margin-top:0;color:#0c5460">💳 Pago con Tarjeta</h3>
          <p>Tu pago será procesado automáticamente.</p>
          <p><strong>Monto:</strong> ${formatCurrency(params.totalAmount, params.currency)}</p>
        </div>`;
  }

  const body = `
    <h2 style="color:#071d7f;margin-top:0">Instrucciones de Pago 💰</h2>
    <p>Hola <strong>${params.buyerName}</strong>,</p>
    <p>Para completar tu pedido <strong>#${orderNum}</strong>, sigue estas instrucciones:</p>
    ${paymentInstructions}
    <p style="margin-top:16px">Una vez realizado el pago, sube tu comprobante desde la app para que podamos verificarlo.</p>
    <p style="color:#6b7280;font-size:13px">⏳ Tu pedido se mantendrá reservado mientras verificamos tu pago.</p>`;

  return sendOrderEmail({
    to: params.buyerEmail,
    subject: `Instrucciones de pago - Pedido #${orderNum}`,
    htmlContent: wrapEmailHtml('Instrucciones de Pago', body),
    type: 'orders',
    destinationCountryId: params.destinationCountryId,
  });
}

/** Send new order notification to seller */
export async function sendSellerNewOrderEmail(params: OrderEmailParams) {
  const orderNum = params.orderNumber || formatOrderNumber(params.orderId);
  const itemsHtml = buildItemsTable(params.items || []);

  const body = `
    <h2 style="color:#071d7f;margin-top:0">¡Nuevo Pedido Recibido! 🛒</h2>
    <p>Hola <strong>${params.sellerName || 'Vendedor'}</strong>,</p>
    <p>Has recibido un nuevo pedido <strong>#${orderNum}</strong> de <strong>${params.buyerName}</strong>.</p>
    ${itemsHtml}
    <div style="background:#ecfdf5;padding:16px;border-radius:8px;margin:16px 0">
      <p style="margin:0"><strong>Total del pedido:</strong> ${formatCurrency(params.totalAmount, params.currency)}</p>
      <p style="margin:4px 0 0"><strong>Tipo:</strong> ${params.orderType === 'b2c' ? 'Venta B2C' : 'Pedido B2B'}</p>
    </div>
    <p>Ingresa a tu panel para gestionar este pedido.</p>`;

  if (!params.sellerEmail) return false;

  return sendOrderEmail({
    to: params.sellerEmail,
    subject: `Nuevo pedido #${orderNum} recibido - Siver Market`,
    htmlContent: wrapEmailHtml('Nuevo Pedido', body),
    type: 'orders',
    destinationCountryId: params.destinationCountryId,
  });
}

/** Send order status change email to buyer */
export async function sendOrderStatusChangeEmail(params: StatusChangeParams) {
  const orderNum = params.orderNumber || formatOrderNumber(params.orderId);
  const statusLabel = STATUS_LABELS[params.newStatus] || params.newStatus;

  let statusIcon = '📋';
  let statusColor = '#071d7f';
  switch (params.newStatus) {
    case 'paid': statusIcon = '✅'; statusColor = '#059669'; break;
    case 'preparing': statusIcon = '📦'; statusColor = '#d97706'; break;
    case 'shipped': case 'in_transit': statusIcon = '🚚'; statusColor = '#2563eb'; break;
    case 'delivered': statusIcon = '🎉'; statusColor = '#059669'; break;
    case 'cancelled': statusIcon = '❌'; statusColor = '#dc2626'; break;
  }

  let trackingHtml = '';
  if (params.trackingNumber) {
    const trackingLink = params.carrierUrl
      ? `<a href="${params.carrierUrl}" style="color:#2563eb">${params.trackingNumber}</a>`
      : params.trackingNumber;
    trackingHtml = `
      <div style="background:#eff6ff;padding:16px;border-radius:8px;margin:16px 0">
        <h3 style="margin-top:0">🚚 Información de Envío</h3>
        <p><strong>Número de rastreo:</strong> ${trackingLink}</p>
        ${params.carrier ? `<p><strong>Transportista:</strong> ${params.carrier}</p>` : ''}
      </div>`;
  }

  const body = `
    <h2 style="color:${statusColor};margin-top:0">${statusIcon} ${statusLabel}</h2>
    <p>Hola <strong>${params.buyerName}</strong>,</p>
    <p>El estado de tu pedido <strong>#${orderNum}</strong> ha sido actualizado a: <strong style="color:${statusColor}">${statusLabel}</strong></p>
    ${trackingHtml}
    <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:16px 0">
      <p style="margin:0"><strong>Total:</strong> ${formatCurrency(params.totalAmount, params.currency)}</p>
    </div>
    <p>Puedes ver los detalles de tu pedido en la sección "Mis Pedidos".</p>`;

  return sendOrderEmail({
    to: params.buyerEmail,
    subject: `Pedido #${orderNum} - ${statusLabel}`,
    htmlContent: wrapEmailHtml(`Estado: ${statusLabel}`, body),
    type: 'orders',
    destinationCountryId: params.destinationCountryId,
  });
}

/** Send cancellation email to buyer */
export async function sendOrderCancelledEmail(params: OrderEmailParams & { reason?: string; cancelledBy?: string }) {
  const orderNum = params.orderNumber || formatOrderNumber(params.orderId);

  const body = `
    <h2 style="color:#dc2626;margin-top:0">❌ Pedido Cancelado</h2>
    <p>Hola <strong>${params.buyerName}</strong>,</p>
    <p>Tu pedido <strong>#${orderNum}</strong> ha sido cancelado.</p>
    ${params.reason ? `<p><strong>Motivo:</strong> ${params.reason}</p>` : ''}
    <div style="background:#fef2f2;padding:16px;border-radius:8px;margin:16px 0">
      <p style="margin:0"><strong>Monto:</strong> ${formatCurrency(params.totalAmount, params.currency)}</p>
      <p style="margin:4px 0 0"><strong>Cancelado por:</strong> ${params.cancelledBy === 'buyer' ? 'Comprador' : params.cancelledBy === 'seller' ? 'Vendedor' : 'Administrador'}</p>
    </div>
    <p>Si tienes preguntas, no dudes en contactarnos.</p>`;

  return sendOrderEmail({
    to: params.buyerEmail,
    subject: `Pedido #${orderNum} cancelado - Siver Market`,
    htmlContent: wrapEmailHtml('Pedido Cancelado', body),
    type: 'orders',
    destinationCountryId: params.destinationCountryId,
  });
}

/** Send payment confirmed email to buyer */
export async function sendPaymentConfirmedEmail(params: OrderEmailParams) {
  const orderNum = params.orderNumber || formatOrderNumber(params.orderId);

  const body = `
    <h2 style="color:#059669;margin-top:0">✅ Pago Confirmado</h2>
    <p>Hola <strong>${params.buyerName}</strong>,</p>
    <p>Tu pago para el pedido <strong>#${orderNum}</strong> ha sido verificado y confirmado.</p>
    <div style="background:#ecfdf5;padding:16px;border-radius:8px;margin:16px 0">
      <p style="margin:0"><strong>Monto pagado:</strong> ${formatCurrency(params.totalAmount, params.currency)}</p>
    </div>
    <p>Tu pedido está ahora en proceso. Te notificaremos cuando esté listo para envío.</p>`;

  return sendOrderEmail({
    to: params.buyerEmail,
    subject: `Pago confirmado - Pedido #${orderNum}`,
    htmlContent: wrapEmailHtml('Pago Confirmado', body),
    type: 'orders',
    destinationCountryId: params.destinationCountryId,
  });
}

/** Send payment rejected email to buyer */
export async function sendPaymentRejectedEmail(params: OrderEmailParams & { reason?: string }) {
  const orderNum = params.orderNumber || formatOrderNumber(params.orderId);

  const body = `
    <h2 style="color:#dc2626;margin-top:0">⚠️ Pago Rechazado</h2>
    <p>Hola <strong>${params.buyerName}</strong>,</p>
    <p>El pago para tu pedido <strong>#${orderNum}</strong> no pudo ser verificado.</p>
    ${params.reason ? `<p><strong>Motivo:</strong> ${params.reason}</p>` : ''}
    <div style="background:#fef2f2;padding:16px;border-radius:8px;margin:16px 0">
      <p style="margin:0"><strong>Monto:</strong> ${formatCurrency(params.totalAmount, params.currency)}</p>
    </div>
    <p>Por favor, verifica tu comprobante e intenta nuevamente o contacta a soporte.</p>`;

  return sendOrderEmail({
    to: params.buyerEmail,
    subject: `Pago rechazado - Pedido #${orderNum}`,
    htmlContent: wrapEmailHtml('Pago Rechazado', body),
    type: 'orders',
    destinationCountryId: params.destinationCountryId,
  });
}

// ============================================================================
// HELPER: Fetch buyer/seller info for email sending
// ============================================================================

export async function fetchOrderEmailData(orderId: string, orderType: 'b2b' | 'b2c') {
  if (orderType === 'b2b') {
    const { data, error } = await supabase
      .from('orders_b2b')
      .select(`
        id, total_amount, currency, payment_method, status, metadata,
        buyer_profile:profiles!orders_b2b_buyer_id_fkey (full_name, email),
        seller_profile:profiles!orders_b2b_seller_id_fkey (full_name, email),
        order_items_b2b (nombre, cantidad, precio_unitario)
      `)
      .eq('id', orderId)
      .single();
    
    if (error || !data) return null;
    
    const buyer = data.buyer_profile as any;
    const seller = data.seller_profile as any;
    
    return {
      orderId: data.id,
      totalAmount: data.total_amount,
      currency: data.currency || 'USD',
      paymentMethod: data.payment_method,
      buyerEmail: buyer?.email || '',
      buyerName: buyer?.full_name || 'Cliente',
      sellerEmail: seller?.email || '',
      sellerName: seller?.full_name || 'Vendedor',
      items: (data.order_items_b2b || []).map((i: any) => ({
        nombre: i.nombre,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
      })),
      orderType: 'b2b' as const,
      metadata: data.metadata,
    };
  } else {
    const { data, error } = await supabase
      .from('orders_b2c')
      .select(`
        id, total_amount, currency, payment_method, status, metadata, buyer_user_id,
        order_items_b2c (product_name, quantity, unit_price),
        store:stores (name, owner_id)
      `)
      .eq('id', orderId)
      .single();
    
    if (error || !data) return null;
    
    // Fetch buyer profile
    const { data: buyerProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', data.buyer_user_id)
      .single();
    
    // Fetch seller profile if store has owner
    const store = data.store as any;
    let sellerEmail = '';
    let sellerName = store?.name || 'Tienda';
    if (store?.owner_id) {
      const { data: sellerProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', store.owner_id)
        .single();
      sellerEmail = sellerProfile?.email || '';
      sellerName = sellerProfile?.full_name || store?.name || 'Vendedor';
    }
    
    return {
      orderId: data.id,
      totalAmount: data.total_amount || 0,
      currency: data.currency || 'USD',
      paymentMethod: data.payment_method,
      buyerEmail: buyerProfile?.email || '',
      buyerName: buyerProfile?.full_name || 'Cliente',
      sellerEmail,
      sellerName,
      items: (data.order_items_b2c || []).map((i: any) => ({
        nombre: i.product_name,
        cantidad: i.quantity,
        precio_unitario: i.unit_price,
      })),
      orderType: 'b2c' as const,
      metadata: data.metadata,
    };
  }
}
