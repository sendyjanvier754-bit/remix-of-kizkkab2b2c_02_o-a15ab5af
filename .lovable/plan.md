

## Plan: Compartir Carrito (Share Cart)

### Concepto
Crear una funcionalidad para compartir el carrito via link. Al abrir el link, el receptor puede ver los productos y agregarlos a su propio carrito.

### 1. Base de Datos — Nueva tabla `shared_carts`

```sql
CREATE TABLE public.shared_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_code text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  items jsonb NOT NULL, -- snapshot of cart items
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days')
);

ALTER TABLE public.shared_carts ENABLE ROW LEVEL SECURITY;

-- Anyone can read a shared cart (public link)
CREATE POLICY "Anyone can view shared carts" ON public.shared_carts
  FOR SELECT USING (true);

-- Authenticated users can create
CREATE POLICY "Authenticated users can create shared carts" ON public.shared_carts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
```

### 2. Nueva Página — `/carrito/compartido/:shareCode`

- Fetch `shared_carts` by `share_code`
- Display items in read-only list (name, image, price, qty, variant info)
- Button "Agregar todo a mi carrito" — loops items and calls `addItemB2C` for each
- If expired, show message

### 3. Compartir desde CartPage

- Add share button (replace WhatsApp icon with `Share2` icon, or add alongside)
- On click: create `shared_carts` row with JSON snapshot of current items → generate link `/carrito/compartido/{share_code}`
- Show dialog/sheet with:
  - Copyable link
  - WhatsApp share button (opens `wa.me` with the link)
  - Support chat share option

### 4. Cambios en archivos

| Archivo | Cambio |
|---------|--------|
| **Migration SQL** | Crear tabla `shared_carts` |
| `src/pages/CartPage.tsx` | Agregar botón compartir (icono `Share2`), lógica para crear shared cart y mostrar dialog con link/WhatsApp |
| `src/pages/SharedCartPage.tsx` | **Nuevo** — página para ver carrito compartido y agregar items |
| `src/App.tsx` | Agregar ruta `/carrito/compartido/:shareCode` |

### 5. Flujo

```text
Usuario en /carrito
  → Toca botón compartir (Share2 icon)
  → Se crea snapshot en shared_carts
  → Dialog muestra link + botones WhatsApp/Copiar
  → Receptor abre link
  → Ve productos, toca "Agregar a mi carrito"
  → Items se copian a su carrito B2C
```

### Detalle del icono
- El botón de WhatsApp actual en el footer del carrito móvil se cambiará por un icono de compartir (`Share2` de lucide-react) que abre el dialog de compartir con opciones (copiar link, WhatsApp, soporte).

