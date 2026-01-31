/**
 * motors.test.ts
 * 
 * Tests para verificar que los motores funcionen correctamente
 * Ejecutar con: npm test motors.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

describe('Motores Separados - Integración', () => {
  describe('Motor de Precio', () => {
    it('should calculate base price without logistics', async () => {
      const { data, error } = await supabase.rpc('calculate_base_price_only', {
        p_product_id: 'test-product-id',
        p_margin_percent: 30,
      });

      expect(error).toBeNull();
      expect(typeof data).toBe('number');
      expect(data).toBeGreaterThan(0);
    });

    it('should retrieve products with base price', async () => {
      const { data, error } = await supabase
        .from('v_productos_precio_base')
        .select('*')
        .limit(5);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      if (data && data.length > 0) {
        const product = data[0];
        expect(product).toHaveProperty('id');
        expect(product).toHaveProperty('precio_base');
        expect(product).toHaveProperty('margin_value');
        expect(product).toHaveProperty('platform_fee');
      }
    });

    it('price breakdown should be correct', async () => {
      const { data: products } = await supabase
        .from('v_productos_precio_base')
        .select('*')
        .limit(1);

      if (products && products.length > 0) {
        const product = products[0];
        const expectedTotal =
          product.costo_fabrica +
          product.margin_value +
          product.platform_fee;

        expect(Math.abs(product.precio_base - expectedTotal)).toBeLessThan(0.01);
      }
    });
  });

  describe('Motor de Logística', () => {
    it('should calculate route cost', async () => {
      const { data: routes } = await supabase
        .from('v_rutas_logistica')
        .select('route_id')
        .limit(1);

      if (routes && routes.length > 0) {
        const routeId = routes[0].route_id;

        const { data, error } = await supabase.rpc('calculate_route_cost', {
          p_route_id: routeId,
          p_weight_kg: 5,
          p_weight_cbm: 0.1,
        });

        expect(error).toBeNull();
        expect(data).toHaveProperty('total_cost');
        expect(data).toHaveProperty('tramo_a_china_to_hub');
        expect(data).toHaveProperty('tramo_b_hub_to_destination');
        expect(data).toHaveProperty('estimated_days_min');
        expect(data).toHaveProperty('estimated_days_max');
      }
    });

    it('should retrieve available routes', async () => {
      const { data, error } = await supabase
        .from('v_rutas_logistica')
        .select('*')
        .eq('is_active', true);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(data!.length).toBeGreaterThan(0);
    });

    it('logistics cost should be sum of segments', async () => {
      const { data: routes } = await supabase
        .from('v_rutas_logistica')
        .select('*')
        .limit(1);

      if (routes && routes.length > 0) {
        const route = routes[0];
        const { data: logistics } = await supabase.rpc('calculate_route_cost', {
          p_route_id: route.route_id,
          p_weight_kg: 5,
        });

        if (logistics) {
          const expectedTotal =
            logistics.tramo_a_china_to_hub +
            logistics.tramo_b_hub_to_destination;

          expect(Math.abs(logistics.total_cost - expectedTotal)).toBeLessThan(
            0.01
          );
        }
      }
    });
  });

  describe('Integración: Precio + Logística = Checkout', () => {
    it('should calculate complete checkout total', async () => {
      // Obtener un producto
      const { data: products } = await supabase
        .from('v_productos_precio_base')
        .select('*')
        .limit(1);

      // Obtener una ruta
      const { data: routes } = await supabase
        .from('v_rutas_logistica')
        .select('*')
        .limit(1);

      if (products && routes && products.length > 0 && routes.length > 0) {
        const product = products[0];
        const route = routes[0];
        const quantity = 2;

        // Calcular precio total
        const { data: logistics } = await supabase.rpc(
          'calculate_route_cost',
          {
            p_route_id: route.route_id,
            p_weight_kg: product.weight_kg * quantity,
          }
        );

        if (logistics) {
          // TOTAL = (precio_base * qty) + costo_logistica + fee + tax
          const subtotalPrice = product.precio_base * quantity;
          const logisticsCost = logistics.total_cost;
          const subtotal = subtotalPrice + logisticsCost;
          const platformFee = subtotal * 0.12;
          const tax = subtotal * 0.1;
          const total = subtotal + platformFee + tax;

          // Verificar que los números tienen sentido
          expect(subtotalPrice).toBeGreaterThan(0);
          expect(logisticsCost).toBeGreaterThan(0);
          expect(subtotal).toBeGreaterThan(subtotalPrice);
          expect(platformFee).toBeGreaterThan(0);
          expect(tax).toBeGreaterThan(0);
          expect(total).toBeGreaterThan(subtotal);
        }
      }
    });

    it('checkout summary should include all required fields', async () => {
      const { data: summary } = await supabase
        .from('v_checkout_summary')
        .select('*')
        .limit(1);

      if (summary && summary.length > 0) {
        const item = summary[0];
        expect(item).toHaveProperty('product_id');
        expect(item).toHaveProperty('sku_interno');
        expect(item).toHaveProperty('product_name');
        expect(item).toHaveProperty('costo_fabrica');
        expect(item).toHaveProperty('precio_base');
        expect(item).toHaveProperty('available_routes');
      }
    });
  });

  describe('Separación de Concerns', () => {
    it('motor de precio no depende de logística', async () => {
      // Obtener precio sin especificar ruta
      const { data: product } = await supabase
        .from('v_productos_precio_base')
        .select('precio_base, costo_fabrica, margin_value, platform_fee')
        .limit(1)
        .single();

      expect(product).toBeDefined();
      expect(product!.precio_base).toBe(
        product!.costo_fabrica +
          product!.margin_value +
          product!.platform_fee
      );
    });

    it('motor de logística no depende de precio', async () => {
      // Calcular logística sin referencia a producto
      const { data: routes } = await supabase
        .from('v_rutas_logistica')
        .select('route_id')
        .limit(1);

      if (routes && routes.length > 0) {
        const { data: logistics } = await supabase.rpc(
          'calculate_route_cost',
          {
            p_route_id: routes[0].route_id,
            p_weight_kg: 10, // Número aleatorio, sin producto específico
          }
        );

        expect(logistics).toBeDefined();
        expect(logistics!.total_cost).toBeGreaterThan(0);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero weight gracefully', async () => {
      const { data: routes } = await supabase
        .from('v_rutas_logistica')
        .select('route_id')
        .limit(1);

      if (routes && routes.length > 0) {
        const { data: logistics } = await supabase.rpc(
          'calculate_route_cost',
          {
            p_route_id: routes[0].route_id,
            p_weight_kg: 0, // Zero weight
          }
        );

        // Debería retornar costo mínimo
        expect(logistics).toBeDefined();
        expect(logistics!.total_cost).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle missing/invalid product', async () => {
      const { data, error } = await supabase.rpc('calculate_base_price_only', {
        p_product_id: '00000000-0000-0000-0000-000000000000', // Invalid UUID
        p_margin_percent: 30,
      });

      // Debería retornar 0 o error manejado
      expect(data === 0 || error !== null).toBe(true);
    });

    it('should handle invalid route', async () => {
      const { data, error } = await supabase.rpc('calculate_route_cost', {
        p_route_id: '00000000-0000-0000-0000-000000000000', // Invalid UUID
        p_weight_kg: 5,
      });

      // Debería retornar 0 o error manejado
      expect(data?.total_cost === 0 || error !== null).toBe(true);
    });
  });
});

/**
 * INSTRUCCIONES PARA EJECUTAR TESTS
 * 
 * 1. Asegúrate que las variables de entorno están configuradas:
 *    VITE_SUPABASE_URL
 *    VITE_SUPABASE_ANON_KEY
 * 
 * 2. Ejecuta los tests:
 *    npm test motors.test.ts
 * 
 * 3. O corre en modo watch:
 *    npm test motors.test.ts --watch
 * 
 * 4. Para coverage:
 *    npm test motors.test.ts --coverage
 */
