-- Actualizar peso de la Tanga
UPDATE products 
SET peso_g = 600 
WHERE nombre = 'Tanga de Encaje con Lazo Estilo Europeo para Mujer';

-- Verificar
SELECT nombre, peso_g, peso_kg, weight_g, weight_kg FROM products 
WHERE nombre = 'Tanga de Encaje con Lazo Estilo Europeo para Mujer';
