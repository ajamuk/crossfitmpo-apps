#!/usr/bin/env bash
#
# Deploy "Entrenos" (CrossFit Metropolitano) to entrenos.crossfitmpo.com
# on an nginx VPS. Safe and idempotent: only adds its own vhost, never
# touches your other sites. Run as root ON THE VPS:
#
#     sudo bash deploy/deploy-entrenos.sh
#
set -euo pipefail

DOMAIN="entrenos.crossfitmpo.com"
EMAIL="ajamuk@gmail.com"
TARGET="/var/www/crossfitmpo-apps"
BRANCH="claude/workout-tracking-app-c6g3rm"
REPO="https://github.com/ajamuk/crossfitmpo-apps.git"

echo "==> 1/5  Obteniendo el código (rama $BRANCH)"
if [ -d "$TARGET/.git" ]; then
  git -C "$TARGET" fetch origin "$BRANCH"
  git -C "$TARGET" checkout "$BRANCH"
  git -C "$TARGET" reset --hard "origin/$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO" "$TARGET"
fi

WEBROOT="$TARGET/entrenos"
test -f "$WEBROOT/index.html" || { echo "ERROR: no existe $WEBROOT/index.html"; exit 1; }

echo "==> 2/5  Permisos de lectura para nginx"
chown -R www-data:www-data "$WEBROOT" 2>/dev/null || true
chmod -R a+rX "$WEBROOT"

echo "==> 3/5  Instalando vhost nginx"
install -m 0644 "$TARGET/deploy/nginx-entrenos.conf" "/etc/nginx/sites-available/$DOMAIN.conf"
ln -sf "/etc/nginx/sites-available/$DOMAIN.conf" "/etc/nginx/sites-enabled/$DOMAIN.conf"
nginx -t
systemctl reload nginx
echo "    OK -> http://$DOMAIN  (ya sirve si el DNS apunta aquí)"

echo "==> 4/5  TLS (HTTPS) con certbot"
if command -v certbot >/dev/null 2>&1; then
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect \
    || echo "    (certbot falló: revisa que el DNS A de $DOMAIN ya apunte a este servidor y reintenta:  certbot --nginx -d $DOMAIN )"
else
  echo "    certbot no está instalado. Instálalo y reintenta:"
  echo "      apt update && apt install -y certbot python3-certbot-nginx"
  echo "      certbot --nginx -d $DOMAIN"
fi

echo "==> 5/5  Listo."
echo "    Abre https://$DOMAIN en el móvil y «Añadir a pantalla de inicio»."
echo "    Para actualizar en el futuro: vuelve a ejecutar este script."
