# Dar acceso al widget: token readonly en el backend Flask

El widget (`facturacion-widget.js`) corre en el **iPhone**, fuera del VPS, así que
no puede leer los `clientes.sqlite` directamente: necesita un **endpoint HTTP con
token**. Aquí van las dos formas de conseguirlo. La **Opción A** es la más rápida
y la recomendada para el widget.

> ⚠️ El token no va en este repo (es público). Guárdalo en una variable de
> entorno del backend (`MOBILE_PULSE_TOKEN`). El valor real se entrega por chat.
>
> Genera/regenera el token con: `openssl rand -hex 32`

---

## Opción A (recomendada) — Token-bypass en el `/v2/mobile` que ya existe

`/v2/mobile` **ya calcula** todo lo que muestra el widget (total + hoy +
crecimiento + los 3 centros). El widget además ya sabe parsear su HTML. Lo único
que falta es permitir leerlo con token, saltando el login solo para esa ruta.

En la app Flask de `facturacion.crossfitmpo.com`:

```python
import os, hmac
from functools import wraps
from flask import request, g

def _has_valid_token():
    expected = os.environ.get("MOBILE_PULSE_TOKEN")
    if not expected:
        return False
    auth = request.headers.get("Authorization", "")
    bearer = auth[7:] if auth.startswith("Bearer ") else None
    provided = request.args.get("token") or bearer or request.headers.get("X-Api-Key")
    return bool(provided) and hmac.compare_digest(str(provided), str(expected))
```

Y en el decorador de login que protege `/v2/mobile`, deja pasar si el token es
válido:

```python
def login_required(view):           # <- tu decorador actual (ajusta el nombre)
    @wraps(view)
    def wrapper(*args, **kwargs):
        if _has_valid_token():
            return view(*args, **kwargs)   # acceso readonly por token
        # ... tu lógica de sesión / redirect a login (lo que ya tienes) ...
        return view(*args, **kwargs)
    return wrapper
```

Con esto el widget funciona **tal cual está** (ya verificado el parseo del HTML).
Ventaja: cero duplicación de lógica; el widget y la web muestran exactamente lo
mismo.

---

## Opción B — Endpoint JSON nuevo `/api/bot/facturacion` (sirve también al bot de Telegram)

Más limpio y desacoplado (JSON en vez de HTML), reutilizable por el bot de
Telegram. La forma robusta es que **reutilice la misma función interna** que ya
alimenta `/v2/mobile`, devolviéndola como JSON:

```python
@app.route("/api/bot/facturacion")
def api_bot_facturacion():
    if not _has_valid_token():
        return {"error": "unauthorized"}, 401
    data = build_mobile_pulse()   # <- la función que ya usa /v2/mobile
    return jsonify(data)
```

Esquema JSON que espera el widget (mapea a lo que ya calculas):

```json
{
  "periodo": "2026-06",
  "actualizado": "21/6, 02:15",
  "total": 73025.44,
  "hoy": 0.0,
  "crecimientoAnual": 64.4,
  "centros": [
    { "nombre": "Parla",     "crecimiento": -0.5,    "facturacion": 23007.13, "socios": 260, "deltaSocios": -17, "altas": 13 },
    { "nombre": "Getafe",    "crecimiento": 42373.6, "facturacion": 29306.81, "socios": 335, "deltaSocios": -18, "altas": 22 },
    { "nombre": "Las Rosas", "crecimiento": -2.4,    "facturacion": 20711.50, "socios": 228, "deltaSocios": -11, "altas": 7  }
  ]
}
```

El widget acepta nombres alternativos (`centers`, `revenue`, `members`,
`altasConfirmadas`, etc.), así que no hace falta clavarlos exactamente.

### Referencia: leer los 3 SQLite en readonly (para la facturación)

Si prefieres calcular la facturación directamente desde los `payments` (sin pasar
por `build_mobile_pulse`):

```python
import sqlite3
from datetime import date

DBS = {
    "Getafe":    "/opt/clientes-analytics/data/clientes.sqlite",
    "Parla":     "/opt/clientes-analytics-parla/data/clientes.sqlite",
    "Las Rosas": "/opt/clientes-analytics-rosas/data/clientes.sqlite",
}

def _ro_conn(path):
    return sqlite3.connect(f"file:{path}?mode=ro", uri=True)

def facturacion_mes(path, year, month):
    con = _ro_conn(path)
    try:
        cur = con.execute(
            "SELECT COALESCE(SUM(amount), 0) FROM payments "
            "WHERE strftime('%Y-%m', payment_date) = ?",
            (f"{year:04d}-{month:02d}",),
        )
        return cur.fetchone()[0]
    finally:
        con.close()
```

> Nota: `socios`, `altas confirmadas` y `vs cierre mes pasado` salen de los datos
> de socios (no de `payments`). Por eso, para no replicar esa lógica, lo más
> seguro es que `/api/bot/facturacion` reutilice `build_mobile_pulse()` en lugar
> de recalcular todo.

---

## Configurar el widget según la opción elegida

En `facturacion-widget.js`:

```js
// Opción A:
const BASE_URL  = "https://facturacion.crossfitmpo.com/v2/mobile";
// Opción B:
const BASE_URL  = "https://facturacion.crossfitmpo.com/api/bot/facturacion";

const TOKEN     = "<el-token-real>";
const AUTH_MODE = "query";   // ?token=...  (lo más fácil de probar en el navegador)
```

## Probar

```bash
curl -s "https://facturacion.crossfitmpo.com/v2/mobile?token=$MOBILE_PULSE_TOKEN" | head
# o, opción B:
curl -s "https://facturacion.crossfitmpo.com/api/bot/facturacion?token=$MOBILE_PULSE_TOKEN" | head
```

Si devuelve datos (y no el HTML del login), el widget ya funcionará.
