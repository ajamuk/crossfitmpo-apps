# Entrena · CrossFit Metropolitano

App web (PWA, instalable en el móvil) para **registrar entrenamientos de fuerza e hipertrofia**.
Inspirada en las mejores apps del mercado (Strong, Hevy): registro de series rápido con
autocompletado de la sesión anterior, detección de récords, rutinas reutilizables, gráficos
de progreso y calendario de días entrenados.

## ✨ Qué hace

- **Registro rápido de series**: peso, reps, RPE y tipo de serie (calentamiento, efectiva, drop set, al fallo).
- **Autocompletado de la última vez**: ves lo que hiciste la sesión anterior en cada ejercicio → progresión sencilla.
- **Récords (PR)**: marca en dorado cuando superas tu 1RM estimado y guarda tus mejores marcas por ejercicio.
- **Rutinas**: plantillas reutilizables (Push/Pull/Pierna, Full body…) para empezar a entrenar en un toque.
- **Biblioteca de ejercicios** con 48 ejercicios incorporados por grupo muscular + tus propios ejercicios.
- **Progreso**: gráficos de volumen semanal, series por grupo muscular, evolución de 1RM y peso máximo por ejercicio.
- **Calendario** de días entrenados y **tipos de entrenamiento** (hipertrofia, fuerza, metcon, cardio).
- **Peso corporal y medidas** con su gráfica de evolución.
- **Temporizador de descanso** automático entre series.
- **PWA**: se instala en la pantalla de inicio del móvil y funciona offline (el shell; los datos requieren conexión).
- **Multiusuario** con login propio. El registro se puede cerrar cuando ya tengas tus cuentas.

## 🧱 Tecnología

- **Backend**: Node.js + Express + SQLite (`better-sqlite3`). Sin servicios externos.
- **Frontend**: PWA en JavaScript puro (sin build). Gráficos SVG propios, cero dependencias de cliente.
- **Auth**: JWT + bcrypt.
- **Datos**: un único fichero SQLite en `DATA_DIR` (volumen persistente).

---

## 🚀 Instalar en tu VPS

### Opción A — Docker Compose (recomendada)

Necesitas Docker y el plugin `docker compose` en el VPS.

```bash
# 1. Clona el repo y entra en la app
git clone https://github.com/ajamuk/crossfitmpo-apps.git
cd crossfitmpo-apps/entrena-app

# 2. Crea tu configuración
cp .env.example .env
# edita .env y pon un JWT_SECRET largo (genera uno con: openssl rand -hex 32)
nano .env

# 3. Arranca
docker compose up -d --build
```

La app queda escuchando en `http://TU_IP:3000`. Abre esa URL, crea tu cuenta y empieza.

**Cerrar el registro** cuando ya tengas tus usuarios: pon `ALLOW_SIGNUP=false` en `.env` y `docker compose up -d`.

Comandos útiles:
```bash
docker compose logs -f      # ver logs
docker compose restart      # reiniciar
docker compose down         # parar (los datos se conservan en el volumen)
```

Los datos viven en el volumen `entrena_data`. Copia de seguridad:
```bash
docker run --rm -v entrena-app_entrena_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/entrena-backup.tar.gz -C /data .
```

### Opción B — Node directo (sin Docker)

```bash
cd crossfitmpo-apps/entrena-app
npm install --omit=dev
export JWT_SECRET="$(openssl rand -hex 32)"
export PORT=3000
export DATA_DIR=/var/lib/entrena      # carpeta persistente para la BD
node server/index.js
```

Para dejarlo corriendo de forma permanente, crea un servicio systemd en
`/etc/systemd/system/entrena.service`:

```ini
[Unit]
Description=Entrena
After=network.target

[Service]
WorkingDirectory=/ruta/a/crossfitmpo-apps/entrena-app
Environment=JWT_SECRET=PON_AQUI_TU_CLAVE
Environment=PORT=3000
Environment=DATA_DIR=/var/lib/entrena
ExecStart=/usr/bin/node server/index.js
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now entrena
```

### HTTPS (recomendado en producción)

Pon un reverse proxy delante (Nginx/Caddy) apuntando a `localhost:3000` y gestiona el
certificado TLS. Ejemplo con **Caddy** (un solo archivo `Caddyfile`):

```
entrena.tudominio.com {
    reverse_proxy localhost:3000
}
```

> El service worker y la instalación como PWA requieren HTTPS (o `localhost`).

---

## 🔧 Variables de entorno

| Variable        | Por defecto | Descripción                                            |
|-----------------|-------------|--------------------------------------------------------|
| `JWT_SECRET`    | *(inseguro)*| Clave para firmar las sesiones. **Cámbiala siempre.**  |
| `PORT`          | `3000`      | Puerto de escucha.                                     |
| `DATA_DIR`      | `./data`    | Carpeta donde se guarda `entrena.db`.                  |
| `ALLOW_SIGNUP`  | `true`      | Permitir el registro de nuevos usuarios.               |

## 🛠️ Desarrollo local

```bash
npm install
JWT_SECRET=dev npm run dev    # http://localhost:3000  (recarga con --watch)
```

## 📡 API (resumen)

`POST /api/auth/register · /login`, `GET /api/auth/me` ·
`GET/POST/DELETE /api/exercises` ·
`GET/POST/PUT/DELETE /api/routines` ·
`GET/POST/DELETE /api/workouts`, `GET /api/workouts/last/:exerciseId` ·
`GET /api/progress/{summary,calendar,muscle-volume,volume-trend,exercise/:id,prs}` ·
`GET/POST/DELETE /api/body`.

Todas las rutas (salvo `auth`) requieren cabecera `Authorization: Bearer <token>`.
