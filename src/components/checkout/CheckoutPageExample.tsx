/**
 * CheckoutPage.tsx
 * 
 * Ejemplo completo de cómo usar los motores separados en checkout
 * - Motor de Precio: useB2BPricingEngine
 * - Motor de Logística: useLogisticsEngine  
 * - Orquestador: useCheckoutCalculator
 */

import { useState, useEffect } from 'react';
import { useCheckoutCalculator, CheckoutSummary } from '@/hooks/useCheckoutCalculator';
import { useB2BPricingEngine, ProductBasePrice } from '@/hooks/useB2BPricingEngine';
import { useLogisticsEngine, ShippingRoute } from '@/hooks/useLogisticsEngineSeparated';

export function CheckoutPage() {
  const checkout = useCheckoutCalculator();
  const pricing = useB2BPricingEngine();
  const logistics = useLogisticsEngine();

  const [checkoutSummary, setCheckoutSummary] = useState<CheckoutSummary | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Calcular y actualizar el resumen
   */
  const updateCheckoutSummary = async () => {
    if (!checkout.checkoutItems.length || !checkout.selectedRoute) {
      setCheckoutSummary(null);
      return;
    }

    setLoading(true);
    try {
      const summary = await checkout.calculateCheckoutTotal(
        checkout.checkoutItems
      );
      setCheckoutSummary(summary);
    } catch (error) {
      console.error('Error calculating checkout:', error);
    } finally {
      setLoading(false);
    }
  };

  // Actualizar resumen cuando cambia el carrito o la ruta
  useEffect(() => {
    updateCheckoutSummary();
  }, [checkout.checkoutItems, checkout.selectedRoute]);

  return (
    <div className="checkout-page">
      <div className="checkout-container">
        {/* HEADER */}
        <h1>Checkout - Motor Separado</h1>

        {/* ITEMS SECTION */}
        <section className="checkout-items">
          <h2>Productos ({checkout.checkoutItems.length})</h2>

          {checkout.checkoutItems.length === 0 ? (
            <p className="empty-state">No hay productos en el carrito</p>
          ) : (
            <div className="items-list">
              {checkout.checkoutItems.map((item) => (
                <CheckoutItemRow
                  key={item.product.product_id}
                  item={item}
                  onUpdateQuantity={(qty) =>
                    checkout.updateQuantity(item.product.product_id, qty)
                  }
                  onRemove={() =>
                    checkout.removeFromCheckout(item.product.product_id)
                  }
                />
              ))}
            </div>
          )}
        </section>

        {/* ROUTES SECTION */}
        {checkout.checkoutItems.length > 0 && (
          <section className="checkout-routes">
            <h2>Seleccionar Ruta de Envío</h2>

            {logistics.loadingRoutes ? (
              <p>Cargando rutas...</p>
            ) : (
              <>
                {/* Recommended Routes */}
                <div className="recommended-routes">
                  <h3>Recomendadas (Más baratas)</h3>
                  {checkout.getRecommendedRoutes().map((routeId) => {
                    const route = logistics.getRouteInfo(routeId);
                    if (!route) return null;

                    return (
                      <RouteOption
                        key={routeId}
                        route={route}
                        isSelected={checkout.selectedRoute === routeId}
                        onSelect={() => checkout.changeRoute(routeId)}
                      />
                    );
                  })}
                </div>

                {/* All Routes */}
                <div className="all-routes">
                  <h3>Todas las Rutas</h3>
                  {logistics.routes.map((route) => (
                    <RouteOption
                      key={route.route_id}
                      route={route}
                      isSelected={checkout.selectedRoute === route.route_id}
                      onSelect={() => checkout.changeRoute(route.route_id)}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {/* SUMMARY SECTION */}
        {checkoutSummary && (
          <section className="checkout-summary">
            <h2>Resumen de Orden</h2>

            <CheckoutSummaryDisplay summary={checkoutSummary} loading={loading} />

            {/* CTA Buttons */}
            <div className="checkout-actions">
              <button
                className="btn btn-secondary"
                onClick={() => checkout.clearCheckout()}
              >
                Vaciar Carrito
              </button>
              <button className="btn btn-primary" disabled={loading}>
                {loading ? 'Procesando...' : 'Continuar a Pago'}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/**
 * Fila individual en el checkout
 */
function CheckoutItemRow({ item, onUpdateQuantity, onRemove }) {
  return (
    <div className="checkout-item-row">
      <div className="item-info">
        <h4>{item.productName}</h4>
        <p className="sku">SKU: {item.sku}</p>
      </div>

      <div className="item-price">
        <p className="label">Precio Base</p>
        <p className="value">${item.priceBase.toFixed(2)}</p>
      </div>

      <div className="item-qty">
        <label>Cantidad</label>
        <input
          type="number"
          min="1"
          value={item.quantity}
          onChange={(e) => onUpdateQuantity(parseInt(e.target.value))}
        />
      </div>

      <div className="item-logistics">
        <p className="label">Envío</p>
        <p className="value">${item.logisticsCost.toFixed(2)}</p>
      </div>

      <div className="item-subtotal">
        <p className="label">Subtotal</p>
        <p className="value">${item.subtotal.toFixed(2)}</p>
      </div>

      <button className="btn-remove" onClick={onRemove}>
        ✕
      </button>
    </div>
  );
}

/**
 * Opción de ruta de envío
 */
function RouteOption({ route, isSelected, onSelect }) {
  return (
    <div
      className={`route-option ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <input
        type="radio"
        name="shipping-route"
        checked={isSelected}
        onChange={() => {}}
      />

      <div className="route-info">
        <h4>{route.destination_country_name}</h4>
        <p className="hub">
          {route.is_direct ? 'Directo' : `Via ${route.transit_hub_name}`}
        </p>
      </div>

      <div className="route-segments">
        {route.segment_a && (
          <div className="segment">
            <span className="label">China → Hub:</span>
            <span className="cost">
              ${(route.segment_a.cost_per_kg * 5).toFixed(2)}/5kg
            </span>
          </div>
        )}
        {route.segment_b && (
          <div className="segment">
            <span className="label">Hub → Destino:</span>
            <span className="cost">
              ${(route.segment_b.cost_per_kg * 5).toFixed(2)}/5kg
            </span>
          </div>
        )}
      </div>

      {route.segment_a && route.segment_b && (
        <div className="route-time">
          <p className="days">
            {route.segment_a.estimated_days_min +
              route.segment_b.estimated_days_min}
            -
            {route.segment_a.estimated_days_max +
              route.segment_b.estimated_days_max}{' '}
            días
          </p>
          <p className="eta">
            Entrega: {new Date(Date.now() + (route.segment_a.estimated_days_min + route.segment_b.estimated_days_min) * 86400000).toLocaleDateString()} - 
            {new Date(Date.now() + (route.segment_a.estimated_days_max + route.segment_b.estimated_days_max) * 86400000).toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Resumen del checkout
 */
function CheckoutSummaryDisplay({ summary, loading }) {
  return (
    <div className="summary-display">
      <div className="summary-items">
        <div className="summary-row">
          <span>Productos ({summary.items.length})</span>
          <span>${summary.subtotalPrice.toFixed(2)}</span>
        </div>

        <div className="summary-row">
          <span>Envío a {summary.routeName}</span>
          <span>${summary.logisticsCost.toFixed(2)}</span>
        </div>

        <div className="summary-row secondary">
          <span>Subtotal</span>
          <span>${summary.subtotal.toFixed(2)}</span>
        </div>

        <div className="summary-row">
          <span>Fee de Plataforma (12%)</span>
          <span>${summary.platformFee.toFixed(2)}</span>
        </div>

        <div className="summary-row">
          <span>Impuestos</span>
          <span>${summary.tax.toFixed(2)}</span>
        </div>

        {summary.estimatedDaysMin && summary.estimatedDaysMax && (
          <div className="summary-row info">
            <span>Entrega Estimada</span>
            <span>
              {summary.estimatedDaysMin}-{summary.estimatedDaysMax} días
            </span>
          </div>
        )}
      </div>

      <div className="summary-total">
        <span className="label">TOTAL</span>
        <span className="amount">${summary.total.toFixed(2)}</span>
      </div>

      {loading && <div className="loading-overlay">Calculando...</div>}
    </div>
  );
}

/* ==========================================
   ESTILOS (CSS)
   ========================================== */

const styles = `
.checkout-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.checkout-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 2rem;
}

.checkout-container h1 {
  margin-bottom: 2rem;
  font-size: 1.8rem;
  color: #333;
}

section {
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid #eee;
}

section:last-child {
  border-bottom: none;
}

section h2 {
  font-size: 1.3rem;
  margin-bottom: 1rem;
  color: #555;
}

/* Items Section */
.items-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.checkout-item-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr auto;
  gap: 1rem;
  align-items: center;
  padding: 1rem;
  background: #f9f9f9;
  border-radius: 4px;
  border-left: 4px solid #007bff;
}

.item-info h4 {
  margin: 0 0 0.25rem 0;
  font-size: 1rem;
}

.item-info .sku {
  font-size: 0.85rem;
  color: #888;
}

.item-qty input {
  width: 60px;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.btn-remove {
  background: #ff4444;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.btn-remove:hover {
  background: #cc0000;
}

/* Routes Section */
.checkout-routes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

.recommended-routes,
.all-routes {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.recommended-routes h3,
.all-routes h3 {
  font-size: 1.1rem;
  color: #555;
}

.route-option {
  display: grid;
  grid-template-columns: auto 1fr 1fr 1fr auto;
  gap: 1rem;
  padding: 1rem;
  background: #f9f9f9;
  border: 2px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  align-items: center;
  transition: all 0.3s ease;
}

.route-option:hover {
  border-color: #007bff;
  background: #f0f7ff;
}

.route-option.selected {
  border-color: #007bff;
  background: #e7f0ff;
}

.route-info h4 {
  margin: 0 0 0.25rem 0;
}

.route-info .hub {
  font-size: 0.85rem;
  color: #888;
}

.route-segments {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.segment {
  display: flex;
  gap: 0.5rem;
}

.segment .label {
  font-weight: bold;
  min-width: 120px;
}

.route-time .days {
  color: #007bff;
  font-weight: bold;
}

/* Summary Section */
.summary-display {
  background: #f9f9f9;
  padding: 1.5rem;
  border-radius: 4px;
  position: relative;
}

.summary-items {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  font-size: 1rem;
  color: #555;
}

.summary-row.secondary {
  font-weight: bold;
  padding-top: 0.75rem;
  border-top: 1px solid #ddd;
}

.summary-row.info {
  color: #0066cc;
  font-size: 0.9rem;
}

.summary-total {
  display: flex;
  justify-content: space-between;
  font-size: 1.5rem;
  font-weight: bold;
  color: #333;
  padding-top: 1rem;
  border-top: 2px solid #ddd;
}

.summary-total .label {
  color: #555;
}

.summary-total .amount {
  color: #28a745;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  border-radius: 4px;
}

/* Buttons */
.checkout-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
  justify-content: flex-end;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #999;
  font-size: 1.1rem;
}
`;

export default styles;
