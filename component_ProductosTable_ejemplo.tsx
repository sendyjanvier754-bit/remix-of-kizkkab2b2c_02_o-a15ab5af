/**
 * 📋 COMPONENTE EJEMPLO: ProductosTable con Costo de Envío
 * 
 * Muestra tabla de productos como en tu screenshot, pero con:
 * - Columna "Logística" llena con costo de envío unitario (SIN REDONDEO)
 * - Actualización automática al cambiar país del usuario
 */

import React, { useState, useMemo } from 'react';
import { useCatalogShippingCostBatch } from './hooks/useCatalogShippingCost';

// Tipos
interface Product {
  id: string;
  name: string;
  precio_compra: number;
  precio_venta: number;
  peso_kg: number;
  margen: number;
  stock: number;
}

interface ProductosTableProps {
  products: Product[];
  userDestinationCountryId: string | null; // UUID del país del usuario (ej: Haiti)
}

/**
 * 🎁 COMPONENTE PRINCIPAL
 */
export const ProductosTable: React.FC<ProductosTableProps> = ({
  products,
  userDestinationCountryId,
}) => {
  // IDs de productos para batch fetch
  const productIds = useMemo(() => products.map((p) => p.id), [products]);

  // Hook para obtener costos de envío de TODOS los productos
  // (más eficiente que hook individual para cada fila)
  const { data: shippingCosts, loading: costosLoading } = useCatalogShippingCostBatch(
    productIds,
    userDestinationCountryId
  );

  // Función auxiliar para formatear costo sin redondeo excesivo
  const formatCost = (cost: number | null | undefined): string => {
    if (cost === null || cost === undefined) {
      return '$0.00';
    }
    // Mostrar hasta 4 decimales (sin redondear agresivamente)
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(cost);
  };

  return (
    <div className="productos-container">
      <table className="productos-table">
        <thead>
          <tr>
            <th>Expandir</th>
            <th>Producto</th>
            <th>Precio Compra</th>
            <th>Logística</th> {/* ← ESTA COLUMNA */}
            <th>Precio Venta</th>
            <th>Margen</th>
            <th>Stock</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            // Obtener datos de envío para este producto
            const shippingData = shippingCosts[product.id];
            const shippingCost = shippingData?.shipping_cost_usd;
            const isAvailable = shippingData?.is_available ?? false;

            return (
              <tr key={product.id} className={!isAvailable ? 'unavailable' : ''}>
                <td className="expand-btn">
                  <button>▼</button>
                </td>
                <td className="product-name">
                  <span>{product.name}</span>
                </td>
                <td className="price">
                  ${product.precio_compra.toFixed(2)}
                </td>
                
                {/* ✅ COLUMNA LOGÍSTICA - COSTO DE ENVÍO */}
                <td className="logistics-cost">
                  {costosLoading ? (
                    <span className="loading">Cargando...</span>
                  ) : isAvailable && shippingCost !== undefined ? (
                    <span className="cost-value">
                      {formatCost(shippingCost)}
                    </span>
                  ) : (
                    <span className="unavailable-cost">
                      {shippingData?.error_message || 'No disponible'}
                    </span>
                  )}
                </td>

                <td className="price price-max">
                  ${product.precio_venta.toFixed(2)}
                </td>
                <td className="status">
                  <span className={`badge badge-${product.margen > 0 ? 'good' : 'warning'}`}>
                    ✓ Bueno
                  </span>
                </td>
                <td className="stock">
                  <span className="stock-badge">
                    {product.stock > 0 ? 'Sin Stock' : 'Sin Stock'}
                  </span>
                </td>
                <td className="actions">
                  <button className="action-btn">✎ var</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ============================================================================
// 📝 CÓMO USAR EN TU APP
// ============================================================================

/**
 * Ejemplo en tu página donde muestras los productos:
 */

export const CatalogPage: React.FC = () => {
  // Obtener el país del usuario (de su dirección principal)
  const [userCountryId, setUserCountryId] = useState<string | null>(
    '737ec4c2-5b5a-459b-800c-01a4b1c3fd6a' // Haiti UUID (ejemplo)
  );

  // Tus productos
  const [products, setProducts] = useState<Product[]>([
    {
      id: 'prod-001',
      name: 'Camiseta Premium de Verano con Cuello Redondo para Hombre',
      precio_compra: 17.61,
      precio_venta: 70.44,
      peso_kg: 0.25,
      margen: 75,
      stock: 0,
    },
    {
      id: 'prod-002',
      name: 'Tanga de Encaje con Lazo Estilo Europeo para Mujer',
      precio_compra: 3.94,
      precio_venta: 15.76,
      peso_kg: 0.05,
      margen: 75,
      stock: 0,
    },
    {
      id: 'prod-003',
      name: 'Zapatillas Urbanas Cometto Suela Gruesa Ligera',
      precio_compra: 23.88,
      precio_venta: 95.52,
      peso_kg: 0.5,
      margen: 75,
      stock: 0,
    },
  ]);

  // Manejador cuando el usuario cambia su país
  const handleCountryChange = (newCountryId: string) => {
    setUserCountryId(newCountryId);
    // Los costos se actualizarán automáticamente vía hook
  };

  return (
    <div className="catalog-page">
      <h1>Catálogo de Productos</h1>

      {/* Selector de país (opcional) */}
      <div className="country-selector">
        <label>País de Destino:</label>
        <select value={userCountryId || ''} onChange={(e) => handleCountryChange(e.target.value)}>
          <option value="737ec4c2-5b5a-459b-800c-01a4b1c3fd6a">Haiti</option>
          <option value="2852a50a-d8f1-415a-a5ce-b87597ad6d8f">Dominican Republic</option>
          <option value="0c961d3-7734-42ab-a50f-a2d75adc1bbd">Jamaica</option>
          <option value="d283e08e-f6b2-4ddc-b897-d898c14e8c66">United States</option>
        </select>
      </div>

      {/* Tabla de productos */}
      <ProductosTable products={products} userDestinationCountryId={userCountryId} />
    </div>
  );
};

// ============================================================================
// 🎨 ESTILOS CSS (OPCIONAL - para que se vea como tu screenshot)
// ============================================================================

const styles = `
.productos-container {
  width: 100%;
  overflow-x: auto;
  padding: 20px;
}

.productos-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.productos-table thead {
  background: #f5f5f5;
  border-bottom: 2px solid #ddd;
}

.productos-table th {
  padding: 12px;
  text-align: left;
  font-weight: 600;
  font-size: 13px;
  color: #333;
}

.productos-table td {
  padding: 12px;
  border-bottom: 1px solid #eee;
  font-size: 14px;
}

/* 🎯 COLUMNA LOGÍSTICA */
.logistics-cost {
  font-weight: 600;
  color: #2c5aa0;
  text-align: right;
  min-width: 100px;
}

.cost-value {
  display: block;
  font-size: 15px;
}

.loading {
  color: #999;
  font-style: italic;
  font-size: 12px;
}

.unavailable-cost {
  color: #ff6b6b;
  font-size: 12px;
}

.product-name {
  max-width: 300px;
  font-weight: 500;
}

.price {
  text-align: right;
  min-width: 80px;
}

.badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.badge-good {
  background: #d4edda;
  color: #155724;
}

.badge-warning {
  background: #fff3cd;
  color: #856404;
}

.stock-badge {
  background: #ffeaea;
  color: #ff6b6b;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.action-btn {
  background: none;
  border: none;
  color: #2c5aa0;
  cursor: pointer;
  font-size: 12px;
  text-decoration: underline;
}

.expand-btn button {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
}

.unavailable {
  opacity: 0.6;
  background: #f9f9f9;
}

.country-selector {
  margin-bottom: 20px;
  display: flex;
  gap: 10px;
  align-items: center;
}

.country-selector select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}
`;
