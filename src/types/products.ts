/**
 * Tipos de productos con separación estricta entre B2B y B2C
 */

// Tipo base del producto (definido localmente para evitar depender de tipos generados por Supabase)
export type Product = ProductFull;

export interface ProductB2B {
  id: string;
  nombre: string;
  descripcion_larga: string | null;
  precio_b2b: number;
  moq: number;
  stock: number;
  galeria_imagenes: string[] | null;
  categoria_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductB2C {
  id: string;
  nombre: string;
  descripcion_larga: string | null;
  precio_b2c: number;
  stock: number;
  galeria_imagenes: string[] | null;
  categoria_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductFull {
  id: string;
  nombre: string;
  descripcion_larga: string | null;
  precio_b2b: number;
  precio_b2c: number;
  moq: number;
  stock: number;
  galeria_imagenes: string[] | null;
  categoria_id: string | null;
  created_at: string;
  updated_at: string;
}
