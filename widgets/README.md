# Widget de Facturación — iPhone (Scriptable)

Widget para iOS que muestra los datos de
`https://facturacion.crossfitmpo.com/v2/mobile` en la pantalla de inicio.

## Estado

🚧 **Borrador.** El endpoint requiere login, así que el mapeo de campos en
`facturacion-widget.js` es **provisional**. Pendiente de:

- Un ejemplo real de la respuesta JSON de `/v2/mobile` (para saber qué campos
  mostrar).
- El token/API key y cómo viaja (URL, `Bearer` o `X-Api-Key`).

## Instalación

1. Instala **Scriptable** desde la App Store (gratis).
2. Abre Scriptable → **+** → pega el contenido de `facturacion-widget.js`.
3. Edita la sección `CONFIGURACIÓN`:
   - `TOKEN`: tu token / API key.
   - `AUTH_MODE`: `"query"`, `"bearer"` o `"apikey"` según cómo lo acepte el
     servidor.
4. En la pantalla de inicio: mantén pulsado → **+** → **Scriptable** →
   elige tamaño → **Editar widget** → selecciona este script.

## Personalización

- Paleta de marca definida en `COLORS` (negro `#121212`, verde `#87B15F`).
- El mapeo de campos está en `buildWidget()`, marcado con `⚠️ MAPEO DE CAMPOS`.
- Al tocar el widget abre `apps.crossfitmpo.com` (configurable en `w.url`).
