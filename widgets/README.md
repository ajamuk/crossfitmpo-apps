# CFMP · Mobile Pulse — Widget de iPhone (Scriptable)

Widget de iOS que muestra la facturación de
`https://facturacion.crossfitmpo.com/v2/mobile` en la pantalla de inicio.

## Qué muestra

- **Facturación mensual total**, facturación de hoy y crecimiento vs año pasado.
- **Por centro** (Parla / Getafe / Las Rosas): facturación del mes, socios,
  variación vs cierre del mes pasado y altas confirmadas.

Tamaños: **pequeño** (total + crecimiento), **mediano** (total + 3 centros
compactos) y **grande** (total + 3 centros con detalle).

## Instalación

1. Instala **Scriptable** desde la App Store (gratis).
2. Abre Scriptable → **+** → pega el contenido de `facturacion-widget.js` →
   nómbralo p.ej. `Facturación MPO`.
3. Edita la sección **CONFIGURACIÓN** (arriba del archivo):
   - `TOKEN`: tu token / API key.
   - `AUTH_MODE`: `"bearer"`, `"apikey"`, `"query"`, `"cookie"` o `"none"`.
4. Pantalla de inicio → mantén pulsado → **+** → **Scriptable** → elige tamaño
   → **Editar widget** → Script: `Facturación MPO`.

> Para ver el diseño sin red, pon `USE_MOCK = true` y ejecuta el script dentro
> de Scriptable (usa datos de ejemplo).

## Cómo lee los datos

El widget es tolerante al formato de la respuesta:

1. Si `/v2/mobile` devuelve **JSON**, lo mapea (acepta varios nombres de campo:
   `total`/`facturacionTotal`, `centros`/`centers`, etc.).
2. Si devuelve **HTML**, lo convierte a texto y extrae los valores usando las
   etiquetas como anclas (`FACTURACIÓN MENSUAL TOTAL`, `Facturación mes`,
   `Socios`, `Altas confirmadas`, …). Probado contra la respuesta real.

## Pendiente para dejarlo 100% operativo

- **Token**: facilitar el token real y confirmar `AUTH_MODE`. Ahora mismo el
  endpoint redirige a `access-admin/login`; sin auth válida el widget mostrará
  "Sin datos · Redirigido a login".
- Si la respuesta es JSON con nombres de campo distintos a los previstos, se
  ajusta `fromJson()` en un minuto.
