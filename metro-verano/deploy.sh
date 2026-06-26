#!/usr/bin/env bash
# deploy.sh — Despliegue "llave en mano" de Metro Verano en el VPS.
#
# Hace TODO lo automatizable de forma idempotente (puedes ejecutarlo varias veces):
#   1) comprueba Node/npm
#   2) instala dependencias (Express + better-sqlite3)
#   3) crea/refresca la base de datos con los 60 entrenamientos
#   4) instala pm2 si falta
#   5) arranca/recarga la app con pm2 y guarda el estado
#
# NO toca nginx, firewall, DNS ni puertos del sistema: eso lo haces tú (ver README.md).
#
# Uso:
#   cd ~/apps/metro-verano
#   ./deploy.sh            # puerto por defecto 3010
#   PORT=3020 ./deploy.sh  # para usar otro puerto

set -euo pipefail

# Nos situamos en la carpeta del script (donde vive la app)
cd "$(dirname "$0")"

PUERTO="${PORT:-3010}"
echo "==> Metro Verano · despliegue (puerto ${PUERTO})"

# --- 1) Requisitos ---------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js no esta instalado. Instala Node y vuelve a ejecutar." >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm no esta instalado." >&2
  exit 1
fi
echo "==> Node $(node -v) · npm $(npm -v)"

# --- 2) Dependencias -------------------------------------------------------
echo "==> Instalando dependencias..."
if [ -f package-lock.json ]; then
  npm ci --omit=dev 2>/dev/null || npm install --omit=dev
else
  npm install --omit=dev
fi

# --- 3) Base de datos (60 entrenamientos) ----------------------------------
# seed.js solo recrea la tabla de entrenamientos; NO borra usuarios ni registros.
echo "==> Sembrando base de datos..."
npm run seed

# --- 4) pm2 ---------------------------------------------------------------
if ! command -v pm2 >/dev/null 2>&1; then
  echo "==> pm2 no encontrado, instalando globalmente..."
  npm install -g pm2
fi

# --- 5) Arranque persistente ----------------------------------------------
echo "==> Arrancando con pm2..."
# startOrReload: arranca si no existe, recarga sin downtime si ya estaba.
PORT="${PUERTO}" pm2 startOrReload ecosystem.config.js --update-env
pm2 save

echo ""
echo "============================================================"
echo " LISTO. Comprobaciones:"
echo "   pm2 list"
echo "   curl -s localhost:${PUERTO}/ | head -c 60"
echo ""
echo " Acceso local:  http://localhost:${PUERTO}"
echo ""
echo " PENDIENTE (manual, lo haces tu — ver README.md seccion 4 y 5):"
echo "   - pm2 startup   (para que arranque al reiniciar el servidor)"
echo "   - nginx: proxy_pass http://127.0.0.1:${PUERTO};"
echo "   - firewall/DNS/HTTPS si expones con dominio"
echo "============================================================"
pm2 list
