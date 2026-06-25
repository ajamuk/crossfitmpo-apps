// ecosystem.config.js — Configuracion de pm2 para "Metro Verano"
// Arranque persistente del servidor Express. Uso:
//   pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'metro-verano',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',            // un solo proceso (suficiente para SQLite local)
      autorestart: true,            // se reinicia si se cae
      watch: false,                 // no recargar en cada cambio de archivo
      max_memory_restart: '200M',   // reinicia si supera 200MB
      env: {
        NODE_ENV: 'production',
        PORT: 3010,                 // puerto alto libre
      },
    },
  ],
};
