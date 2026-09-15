# Restaurar vista previa e impresión del PO ZleTI

## Objetivo
Recuperar el flujo acordado: al generar o actualizar un PO, abrir primero un modal con la vista profesional del documento, sus enlaces utilizables y las imágenes exactas de las variantes; desde allí permitir imprimir, copiar enlaces y guardar el PDF.

## Cambios
- Separar la construcción del documento ZleTI de la descarga automática para que la misma plantilla alimente tanto la vista previa como el PDF.
- Restaurar el modal de impresión sobre la pantalla de Logística ZleTI con las acciones **Imprimir**, **Copiar enlaces**, **Guardar PDF** y **Cerrar**.
- Al crear un PO, mantener el carrito hasta confirmar que se creó correctamente, cerrar el carrito y abrir el modal con el PO recién creado en vez de descargar un archivo sin mostrar la vista previa.
- Al abrir un PO del historial o guardar cambios, permitir volver a mostrar el mismo modal y regenerar el PDF con el diseño acordado.
- Mantener en carrito, modal y PDF la imagen de cada variante seleccionada; no sustituirla por la imagen general del producto.
- Conservar el formato ZleTI profesional: marca ZleTI, tabla horizontal, variante, costo proveedor, cantidad, total y enlace clicable del proveedor.

## Validación
- Comprobar creación, apertura desde historial, impresión y descarga.
- Verificar que el modal aparece por encima de las demás ventanas y que sus botones funcionan.
- Revisar visualmente el PDF generado para detectar cortes, páginas vacías, imágenes incorrectas o enlaces perdidos.

## Detalles técnicos
- Reutilizar una única estructura HTML para vista previa, impresión y descarga, evitando que los formatos vuelvan a divergir.
- Añadir descripciones accesibles a los diálogos modificados para eliminar las advertencias relacionadas.
