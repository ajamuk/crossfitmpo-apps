# Desplegar «Entrenos» en el subdominio (VPS nginx)

App privada de seguimiento de entrenos servida en
`https://entrenos.crossfitmpo.com` desde tu VPS.

## Paso 1 — DNS (una sola vez)

En tu proveedor de DNS de `crossfitmpo.com`, crea un registro:

| Tipo | Nombre     | Valor              |
|------|------------|--------------------|
| A    | `entrenos` | `82.223.108.143`   |

Espera unos minutos a que propague (`dig entrenos.crossfitmpo.com +short`
debe devolver la IP).

## Paso 2 — Desplegar (en el VPS, como root)

```bash
# si aún no tienes el repo en el servidor:
git clone --branch claude/workout-tracking-app-c6g3rm \
  https://github.com/ajamuk/crossfitmpo-apps.git /var/www/crossfitmpo-apps

# desplegar (crea el vhost nginx + HTTPS con certbot):
sudo bash /var/www/crossfitmpo-apps/deploy/deploy-entrenos.sh
```

El script es idempotente y solo añade su propio vhost: **no toca tus
otros sitios**. Para actualizar en el futuro, vuelve a ejecutarlo.

## Paso 3 — En el móvil

Abre `https://entrenos.crossfitmpo.com` e instala:
- **iPhone:** Safari → Compartir → «Añadir a pantalla de inicio»
- **Android:** Chrome → menú → «Instalar app»

## Privacidad — que solo entres tú

1. **Código en la app** (ya incluido): Ajustes → *Código de acceso* → Activar.
2. **Cloudflare Access** (recomendado, real): si pones Cloudflare delante,
   protege `entrenos.crossfitmpo.com` con política *Allow* solo a
   `ajamuk@gmail.com`. Así nadie más puede ni cargar la página.

> Tras compartir la contraseña root por chat, cámbiala y usa claves SSH.
