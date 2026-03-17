

## Diagnóstico y Plan

### Problemas encontrados

**1. API Key de Mailjet corrupta (causa del 401)**
El valor guardado en `api_key` es `"eb055aca36b7c58ca5ef3ffa6756d50aSecret "` — tiene la palabra "Secret " concatenada al final. Mailjet rechaza la autenticación porque la clave es inválida. Necesitas corregir ese valor en el panel de admin (quitar "Secret " del final).

**2. Build error en `useAdminBanners.ts`**
La interfaz `AdminBanner` define propiedades (`desktop_image_url`, `device_target`, `mobile_position_x/y`, `mobile_scale`, `desktop_position_x/y`, `desktop_scale`) que no existen en la tabla real de la DB.

**3. Sistema de múltiples remitentes no existe**
Actualmente solo hay un registro único en `email_configuration`. No hay soporte para múltiples remitentes por tipo de email.

---

### Plan de implementación

#### 1. Corregir build error de `useAdminBanners.ts`
Actualizar la interfaz `AdminBanner` para que coincida con el esquema real de la DB (solo: `id`, `title`, `image_url`, `link_url`, `target_audience`, `is_active`, `sort_order`, `starts_at`, `ends_at`, `created_at`, `updated_at`). Eliminar las propiedades inexistentes.

#### 2. Crear tabla `email_senders` para múltiples remitentes
Nueva tabla con columnas:
- `id`, `purpose` (enum: 'authentication', 'orders', 'notifications', 'marketing', 'support')
- `sender_email`, `sender_name`, `is_active`
- La Edge Function `send-email` recibirá el `type` y buscará el remitente correspondiente en `email_senders`, con fallback al remitente principal de `email_configuration`.

#### 3. Agregar validación de API Key en el admin
- Validar formato del `api_key` (sin espacios ni texto extra) antes de guardar.
- Validar formato del `sender_email` (debe contener `@`).
- Mostrar advertencias claras si los valores parecen incorrectos.

#### 4. Actualizar la UI del admin para gestionar remitentes
Agregar una sección en `AdminEmailConfigPage` donde el admin pueda configurar un email remitente diferente para cada propósito (autenticación, pedidos, notificaciones, marketing, soporte).

#### 5. Actualizar Edge Function `send-email`
Modificar para que busque el remitente según el `type` del email en la tabla `email_senders`, con fallback a `email_configuration.sender_email`.

#### 6. Re-desplegar la Edge Function
Desplegar `send-email` después de los cambios.

