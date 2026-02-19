import { QuantitySelector } from './quantity-selector';
import { useState } from 'react';

/**
 * Ejemplo de uso del QuantitySelector
 * Este componente demuestra los diferentes casos de uso
 */
export function QuantitySelectorDemo() {
  const [quantity1, setQuantity1] = useState(4);
  const [quantity2, setQuantity2] = useState(1);
  const [quantity3, setQuantity3] = useState(10);

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">
            Selector de cantidad - Ejemplos
          </h2>

          {/* Ejemplo 1: Uso básico */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">
              Uso Básico - Para Carrito
            </h3>
            <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-md border border-blue-200">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">
                  Tanga de Encaje con Lazo
                </p>
                <p className="text-xs text-gray-500">Talla M | Negro</p>
              </div>
              <QuantitySelector
                value={quantity1}
                onChange={setQuantity1}
                min={1}
                max={100}
              />
              <span className="text-sm font-bold text-blue-600">
                ${(3.94 * quantity1).toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Cantidad: {quantity1} unidades
            </p>
          </div>

          {/* Ejemplo 2: Con MOQ */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">
              Con Cantidad Mínima (MOQ)
            </h3>
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-md border border-gray-200">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">
                  Vestido Casual de Verano
                </p>
                <p className="text-xs text-gray-500">Talla L | Azul</p>
              </div>
              <QuantitySelector
                value={quantity2}
                onChange={setQuantity2}
                min={5}
                max={50}
              />
              <span className="text-sm font-bold text-green-600">
                ${(12.50 * quantity2).toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              MOQ: 5 unidades | Stock disponible: 50 unidades
            </p>
          </div>

          {/* Ejemplo 3: Stock limitado */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">
              Stock Limitado
            </h3>
            <div className="flex flex-col gap-3 p-4 bg-green-50 rounded-md border border-green-200">
              <div>
                <p className="text-base font-semibold text-gray-800">
                  Conjunto de Ropa Interior Premium
                </p>
                <p className="text-sm text-gray-600">Set completo | Varios colores</p>
              </div>
              <div className="flex items-center justify-between">
                <QuantitySelector
                  value={quantity3}
                  onChange={setQuantity3}
                  min={1}
                  max={10}
                />
                <div className="text-right">
                  <p className="text-xs text-gray-500">Subtotal</p>
                  <p className="text-xl font-bold text-green-600">
                    ${(25.00 * quantity3).toFixed(2)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-amber-600">
                ⚠️ Solo quedan 10 unidades en stock
              </p>
            </div>
          </div>

          {/* Ejemplo 4: Estado deshabilitado */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">
              Estado Deshabilitado
            </h3>
            <div className="flex items-center gap-4 p-4 bg-gray-100 rounded-md border border-gray-300">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500">
                  Producto sin stock
                </p>
                <p className="text-xs text-red-500">❌ Agotado</p>
              </div>
              <QuantitySelector
                value={1}
                onChange={() => {}}
                min={1}
                max={100}
                disabled={true}
              />
            </div>
          </div>

          {/* Tabla de referencia */}
          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">
              📝 Referencia Rápida
            </h4>
            <div className="text-xs text-blue-800 space-y-1">
              <p>• <strong>Diseño:</strong> Botones - / + con borde verde (border-green-300)</p>
              <p>• <strong>Tamaño:</strong> Altura 32px (h-8 w-8)</p>
              <p>• <strong>min/max</strong>: Validación automática de rangos</p>
              <p>• <strong>disabled</strong>: Los botones se deshabilitan en los límites</p>
              <p>• <strong>Auto-guardado</strong>: Integrado con hooks B2B/B2C</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
