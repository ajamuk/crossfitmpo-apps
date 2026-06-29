FROM node:20-bookworm-slim

# better-sqlite3 necesita herramientas de compilación nativas durante el install
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 build-essential ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala dependencias (capa cacheable)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copia el código
COPY server ./server
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data

# La BD persiste en este volumen
VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=4s --start-period=10s \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
