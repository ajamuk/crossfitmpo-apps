# MEJORAS — Risk Scanner (dashboard)

Diagnóstico inicial: 2026-07-02. Base: copia exacta de producción
(`original/index-produccion-2026-07-02.html`, 272 KB, descargada de
https://apps.crossfitmpo.com/metro-risk-scanner/ con sesión autenticada).

**Alcance de este trabajo**: solo el frontend (este HTML). El servicio Python,
el cron y Nginx viven en el VPS y no son accesibles desde esta sesión; todo lo
que los requiera está en `PENDIENTE_MANUAL.md`. No se cambia ningún endpoint
ni URL (`api/latest`, `api/refresh`, `api/inactive-refresh`, `api/ghl/open`…).

## Auditoría (resumen)

- 4.431 líneas: ~150 KB de CSS en 45 bloques `<style>`, un `<script>` de 93 KB
  con 83 funciones. Solo 1 función muerta (`centerName`) y 16 reglas CSS
  duplicadas exactas (~1,6 KB): el código está razonablemente limpio.
- `loadData()` **sin ningún manejo de errores**: si `api/latest` responde 500,
  JSON corrupto o no responde, excepción sin capturar y **dashboard vacío en
  silencio** (verificado con servidor de pruebas: modos api500/apicorrupt).
- El botón «Recalcular» (`refreshBtn`) tiene `try/finally` sin `catch`: el
  error «No se pudo recalcular» revienta sin aviso al usuario (verificado).
- Datos obsoletos sin aviso: en producción la lista de inactivos es del
  04/06/2026 (28 días) y la UI la muestra sin ninguna alerta; los «días sin
  venir» del Trabajo diario se calculan sobre esa foto vieja.
- Sin estado de carga: pantalla vacía ~2 s mientras llega `api/latest` (1,9 MB).
- Móvil (390 px, verificado con Chromium): sin scroll horizontal y con tarjetas
  para las filas (bien), pero la navegación (4 bloques apilados) ocupa toda la
  primera pantalla; el teléfono no es pulsable (solo enlace GHL, sin `tel:`).

## Mejoras priorizadas

### ALTO
- [x] A1. Robustez de carga: `try/catch` + `response.ok` en `loadData()`, caché
  en `localStorage` de la última carga buena, banner visible «No se pudo
  actualizar — mostrando datos guardados de [fecha]» con botón Reintentar, y
  `catch` en el handler de «Recalcular».
  ✅ Verificación (pasa/no pasa): con API 500, JSON corrupto y sin red no hay
  excepciones sin capturar; con caché previa se ven los datos + banner; sin
  caché, banner de error con Reintentar.
  → PASA (2026-07-02): 4 escenarios (500 sin caché, reintento, JSON corrupto
  con caché, red caída con caché) — 0 errores sin capturar, banner correcto,
  32 filas servidas desde caché con aviso de fecha.
- [x] A2. Aviso de datos obsoletos: banner cuando la foto de inactivos tenga
  >7 días (con edad y referencia al botón «Actualizar inactivos») y cuando el
  informe principal tenga >1 día.
  ✅ Verificación: con el payload real de producción (inactivos del 04/06)
  aparece el aviso con la edad en días; con datos frescos no aparece.
  → PASA (2026-07-02): payload real → «hace 27 días» visible; datos frescos →
  oculto; informe de hace 3 días → aviso de posible fallo del proceso diario.
- [x] A3. Teléfono a un clic: enlace `tel:` junto al botón GHL en todas las
  filas/tarjetas con teléfono (helper `telLink`, prefijo +34 si falta).
  ✅ Verificación: en 390 px cada tarjeta del Trabajo diario con teléfono tiene
  `a[href^="tel:"]` pulsable.
  → PASA (2026-07-02): 29/29 filas con teléfono → enlace tel: visible en móvil
  (3 filas restantes no tienen teléfono en los datos); 0 errores JS.
- [ ] A4. Navegación móvil compacta: en ≤760 px los 4 bloques de navegación se
  colapsan a una fila única de chips con scroll horizontal para que «Personas
  a escribir hoy» entre en la primera pantalla.
  ✅ Verificación: en 390×844 la primera tarjeta de trabajo diario es visible
  sin hacer scroll.
### MEDIO
- [ ] M1. Estado de carga + primera pintura rápida: «Cargando datos…» visible
  al arrancar y *stale-while-revalidate*: si hay caché en `localStorage` se
  pinta al instante y se refresca en segundo plano.
  ✅ Verificación: primera pintura con datos (caché) < 2 s en viewport 390 px
  con red lenta simulada (API con 3 s de retardo).
- [ ] M2. Limpieza: eliminar `centerName()` (sin referencias) y las 16 reglas
  CSS duplicadas exactas.
  ✅ Verificación: re-ejecutar el análisis → 0 funciones sin referencia y 0
  reglas duplicadas exactas; la app sigue renderizando igual.
### BAJO
- [ ] B1. `README.md` del proyecto (arquitectura conocida, rutas, operación) y
  `PENDIENTE_MANUAL.md` (despliegue del HTML en el VPS + tareas de backend
  fuera de alcance: automatizar el refresh diario de inactivos en el cron).
  ✅ Verificación: ambos ficheros existen y reflejan el estado final.

## Reglas respetadas

- Sin dependencias nuevas (solo JS/CSS vanilla ya presentes).
- Sin endpoints nuevos ni cambios de URL; sin tocar Nginx/systemd/cron/credenciales.
- Solo lectura sobre datos reales; el backup previo está en `original/`.
