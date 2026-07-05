# Member Pulse — análisis y corrección

App desplegada en `https://apps.crossfitmpo.com/member-pulse/` (servida por el
servicio `caja` del servidor, no desde este repositorio). Esta carpeta contiene
una **copia mantenida** del frontend con la corrección aplicada, más el parche
mínimo para desplegarla.

## Estado tras el análisis

Se probó la app en vivo como `admin` en las cuatro pestañas (Envíos del mes,
Lectura general, Revisar respuestas, Estadísticas), en escritorio y móvil, y se
verificaron sus tres endpoints (`responses`, `bot-state`, `campaign`). Todos
responden `200`, no hay errores de consola ni de red, y no hay desbordamiento
horizontal en móvil. La app funciona correctamente; se aplicaron dos mejoras
(un bug del selector de mes y la unificación de coaches duplicados).

## Bug corregido: el selector de "Mes" no se poblaba

**Síntoma:** en la pestaña *1. Envíos del Mes*, el desplegable **Mes** solo
mostraba "Mes actual". Los meses históricos (p. ej. junio 2026, con 15 envíos
registrados) eran inaccesibles desde la interfaz, aunque el bot sí tenía los
datos.

**Causa:** el `<select id="botMonth">` se sustituye por un desplegable
personalizado (`enhanceSelect`) al iniciar, cuando todavía solo contiene la
opción placeholder. Después, `renderCampaignRows()` rellenaba el `<select>`
nativo con `fillSelect('botMonth', …)` pero **nunca** llamaba a
`syncCustomSelect('botMonth')`, así que el overlay visible (lo que el usuario
realmente pulsa, ya que el nativo queda oculto) se quedaba congelado con la
opción original. A diferencia de los selectores de centro/coach, `botMonth`
tampoco estaba en la lista de re-sincronización de `render()`.

**Corrección:** se añade `fillMonthSelect()`, que rellena el select con etiquetas
formateadas (`campaignMonthLabel`, p. ej. "Junio de 2026") y **re-sincroniza el
overlay** tras cada relleno. `renderCampaignRows()` la usa en lugar del
`fillSelect` anterior. También se sube `UI_VERSION` para invalidar la caché.

Verificado en vivo: el menú pasa a mostrar "Julio de 2026" y "Junio de 2026",
seleccionar junio carga sus 15 filas con los badges "Enviado", y la etiqueta del
botón se sincroniza al cambiar y volver.

El cambio total son 2 puntos localizados.

## Mejora: coaches duplicados unificados en las estadísticas

**Síntoma:** un mismo coach escrito de formas distintas en las respuestas
(p. ej. `Jose` vs `José`, o nombres con espacios dobles) aparecía como filas
separadas en el desglose por centro y coach, y como entradas repetidas en el
filtro de coach.

**Corrección:** al cargar las respuestas se construye un mapa canónico
(`buildCoachCanon`) que agrupa las variantes de cada coach de forma
insensible a acentos, mayúsculas y espacios, y elige un nombre de
visualización (la variante más frecuente; a igualdad, la que lleva acentos).
Ese nombre canónico se asigna a `_coach`, que es lo que usan las estadísticas,
la lectura general y el filtro de coach. La tabla de *Revisar respuestas*
mantiene el valor **literal** de cada encuesta, sin tocar.

Verificado con datos reales: en el desglose, `Parla · Jose` y `Parla · José`
se fusionan en `Parla · José · 2 respuestas` (5 filas en vez de 6), y el
desplegable de coach deja de mostrar el duplicado.

## Cómo desplegar

> El SSH al servidor no es accesible desde el sandbox del agente (el proxy de
> egress solo transporta TLS, no SSH). Estos pasos se ejecutan **desde tu
> máquina**, donde tu SSH sí funciona.

1. Localiza el fichero en el servidor:

   ```bash
   ssh root@82.223.108.143 "find / -type f -path '*member-pulse*' -name 'index.html' 2>/dev/null"
   ```

2. Haz copia de seguridad y sube el fichero corregido (sustituye `<RUTA>` por la
   que devuelva el paso 1):

   ```bash
   ssh root@82.223.108.143 "cp <RUTA> <RUTA>.bak-$(date +%Y%m%d)"
   scp member-pulse/index.html root@82.223.108.143:<RUTA>
   ```

   Alternativamente, aplica solo el parche in situ:

   ```bash
   scp member-pulse/member-pulse.patch root@82.223.108.143:/tmp/
   ssh root@82.223.108.143 "cd \$(dirname <RUTA>) && patch -p0 < /tmp/member-pulse.patch"
   ```

3. Recarga `https://apps.crossfitmpo.com/member-pulse/` (forzando recarga). La
   nueva `UI_VERSION` invalida la caché automáticamente.
