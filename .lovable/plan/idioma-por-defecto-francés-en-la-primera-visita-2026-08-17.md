# Idioma por defecto: francés en la primera visita

Hoy, un visitante nuevo ve el sitio en español (el detector usa el idioma del navegador y, si no coincide, cae en español). El cambio hace que cualquier persona que entra por primera vez vea el sitio en **francés**, sin importar el idioma de su navegador.

## Comportamiento después del cambio

- Primera visita (sin preferencia guardada): interfaz en francés.
- Si el usuario cambia el idioma desde el selector: se guarda y se respeta en todas las visitas siguientes.
- Español, inglés y kreyòl siguen disponibles igual que ahora.

## Detalle técnico

En `src/i18n/index.ts`:
- `fallbackLng: 'fr'`.
- `detection.order: ['localStorage']` (se elimina `navigator`) para que la primera visita siempre caiga en francés.
- Se mantiene `lookupLocalStorage: 'i18n_language'` y `caches: ['localStorage']`.
- No se toca el idioma fuente del contenido de base de datos: sigue siendo `es` en `useTranslatedContent` / `useTranslatedList`, así que los textos dinámicos se traducirán a francés vía `content_translations` como ya ocurre hoy.

Sin cambios de esquema ni de backend.
