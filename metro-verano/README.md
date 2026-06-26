# Metro Verano · CrossFit Metropolitano

App de verano para los 3 boxes (**Parla**, **Las Rosas**, **Getafe**): catálogo de
60 entrenamientos **sin material**, temporizadores por formato (AMRAP, EMOM, For Time,
Tabata, Libre), registro de marcas y ranking por box / global.

- **Backend:** Node.js + Express
- **Base de datos:** SQLite (better-sqlite3), archivo local en `data/metro-verano.db`
- **Frontend:** HTML + CSS + JS vanilla (SPA ligera servida por Express)
- **Puerto:** `3010`
- **Proceso:** pm2 (`metro-verano`)

---

## ⚠️ Nota importante sobre dónde se construyó

Esta app se desarrolló y se **verificó automáticamente** dentro del repositorio
(contenedor de Claude Code), **no por SSH dentro de tu VPS IONOS**. Por eso el
último paso — dejarla corriendo en tu VPS — lo tienes que lanzar tú con los
comandos de abajo (es copiar y pegar). Todo lo demás (esquema, seed de 60
entrenamientos, los 5 endpoints, los 4 timers, el ranking y el arranque con pm2)
está probado y funcionando.

---

## 1. Desplegar en el VPS (lo que ejecutas TÚ)

### Opción rápida (recomendada): un solo comando

Una vez tengas el código en `~/apps/metro-verano` (ver "Colocar el código" abajo),
solo necesitas:

```bash
cd ~/apps/metro-verano
./deploy.sh
```

`deploy.sh` es idempotente y hace todo lo automatizable: comprueba Node/npm,
instala dependencias, crea/refresca la base de datos con los 60 entrenamientos,
instala pm2 si falta, y arranca/recarga la app con pm2 (puerto 3010) guardando el
estado. Para otro puerto: `PORT=3020 ./deploy.sh`.

Después, lo único manual que queda (no lo automatiza por seguridad):
```bash
pm2 startup     # pega y ejecuta la línea que imprima (arranque al reiniciar)
```
…y, si expones con dominio, nginx + firewall + DNS (secciones 4 y 5).

---

### Colocar el código en el VPS

```bash
mkdir -p ~/apps
cd ~/apps
# Opción A: clona el repo (rama con la app) y entra en la subcarpeta
git clone <URL_DE_TU_REPO> metro-verano-repo
cp -r metro-verano-repo/metro-verano ~/apps/metro-verano
# (Opción B: si ya tienes el repo, haz git pull y copia la carpeta metro-verano/)

cd ~/apps/metro-verano

# 2) Instala dependencias (Express + better-sqlite3)
npm install

# 3) Crea y puebla la base de datos (60 entrenamientos)
npm run seed
# Debe imprimir: "Total entrenamientos: 60" (20 Cardio, 20 Fuerza, 20 CrossFit)

# 4) Instala pm2 si no lo tienes
npm install -g pm2

# 5) Arranca la app con pm2 (puerto 3010)
pm2 start ecosystem.config.js

# 6) Arranque persistente al reiniciar el servidor
pm2 save
pm2 startup        # ejecuta la línea que te imprima este comando
```

Comprobación rápida en el VPS:

```bash
pm2 list                       # metro-verano debe estar "online"
curl -s localhost:3010/        # debe devolver el HTML de la app
curl -s localhost:3010/api/entrenamientos | head -c 80   # JSON válido
```

---

## 2. Comandos pm2 útiles

```bash
pm2 list                 # estado de los procesos
pm2 logs metro-verano    # ver logs en vivo
pm2 restart metro-verano # reiniciar
pm2 stop metro-verano    # parar
pm2 delete metro-verano  # quitar de pm2
pm2 save                 # guardar la lista actual (para el arranque persistente)
```

---

## 3. Cómo acceder

- **En el propio VPS:** `http://localhost:3010`
- **Desde fuera, sin dominio:** abre el puerto y entra por IP (ver sección 4):
  `http://82.223.108.143:3010`
- **Con dominio:** configura nginx como proxy inverso (sección 5).

---

## 4. Lo que tienes que hacer TÚ a mano (fuera del alcance de la app)

Por seguridad, la app **no toca** nada del sistema. Estos pasos los haces tú:

- **Firewall (si usas ufw):** permitir el tráfico web.
  ```bash
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  # Solo si quieres entrar por IP:puerto directamente (no recomendado con nginx):
  # sudo ufw allow 3010/tcp
  ```
- **DNS:** crea un registro `A` apuntando tu dominio/subdominio a `82.223.108.143`.
- **nginx:** añade el bloque de la sección 5.
- **HTTPS (opcional, recomendado):** `sudo certbot --nginx -d metro.tudominio.com`

---

## 5. nginx — bloque a añadir (proxy inverso al puerto 3010)

Crea el archivo `/etc/nginx/sites-available/metro-verano` con este contenido
(cambia `metro.tudominio.com` por tu dominio real):

```nginx
server {
    listen 80;
    server_name metro.tudominio.com;

    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**La línea clave** (la que redirige el tráfico a la app) es:

```nginx
proxy_pass http://127.0.0.1:3010;
```

Luego actívalo y recarga nginx:

```bash
sudo ln -s /etc/nginx/sites-available/metro-verano /etc/nginx/sites-enabled/
sudo nginx -t        # comprobar sintaxis
sudo systemctl reload nginx
```

---

## 6. Estructura del proyecto

```
metro-verano/
├── server.js              # API Express + sirve el frontend
├── db.js                  # conexión y esquema SQLite
├── seed.js                # inserta los 60 entrenamientos
├── ecosystem.config.js    # configuración de pm2 (puerto 3010, fork, autorestart)
├── package.json
├── data/                  # base de datos SQLite (se crea con npm run seed; ignorada por git)
└── public/
    ├── index.html         # SPA (onboarding, catálogo, entreno+timer, ranking)
    ├── css/styles.css     # branding CrossFit Metropolitano
    └── js/app.js          # lógica + motor de temporizadores
```

## 7. API

| Método | Ruta                          | Descripción                                   |
|--------|-------------------------------|-----------------------------------------------|
| POST   | `/api/usuarios`               | Crea o recupera usuario por `nombre_usuario` + `box` |
| GET    | `/api/entrenamientos?categoria=` | Lista entrenamientos (filtro opcional)     |
| POST   | `/api/registros`              | Guarda un entrenamiento completado            |
| GET    | `/api/registros/:usuario_id`  | Historial de un usuario                       |
| GET    | `/api/ranking?box=`           | Ranking por nº de entrenamientos (por box o global) |

## 8. Modelo de datos (SQLite)

- **usuarios**: `id`, `nombre_usuario` (único), `box` (Parla|Las Rosas|Getafe), `creado_en`
- **entrenamientos**: `id`, `nombre`, `categoria` (Cardio|Fuerza|CrossFit), `descripcion`, `formato_timer` (AMRAP|EMOM|For Time|Tabata|Libre), `duracion_objetivo_seg`
- **registros**: `id`, `usuario_id`, `entrenamiento_id`, `fecha`, `duracion_real_seg`, `notas`

## 9. Notas

- Las **tipografías** (Bebas Neue, Oswald, Barlow Condensed) se cargan desde Google
  Fonts. En el VPS con salida a internet cargan sin problema; hay fuentes de
  respaldo (`sans-serif`) por si el servidor no tuviera acceso.
- Identificación **sin contraseña**: el atleta entra con nombre de usuario + box y
  se recuerda en `localStorage`. Toca el chip de usuario (arriba a la derecha) para
  cambiar de atleta.
- Para regenerar la base de datos desde cero: `rm -f data/*.db* && npm run seed`.
```
