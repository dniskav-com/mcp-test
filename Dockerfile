# ─────────────────────────────────────────────
# DOCKERFILE — Notes MCP Server
# ─────────────────────────────────────────────
#
# Multi-stage build: compilamos TypeScript en una etapa
# y copiamos solo el resultado a la imagen final.
# Así la imagen de producción no incluye el compilador
# ni las devDependencies — más ligera y segura.
#
# Etapas:
#   1. builder → instala TODO y compila TypeScript
#   2. runner  → solo lo necesario para ejecutar

# ─────────────────────────────────────────────
# ETAPA 1: builder
# ─────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copiamos package.json y package-lock.json primero
# Esto aprovecha la caché de Docker: si no cambian las dependencias,
# no vuelve a ejecutar npm install en cada build
COPY package*.json ./

# Instalamos TODAS las dependencias (incluidas devDependencies para compilar)
RUN npm ci

# Copiamos el código fuente y la config de TypeScript
COPY tsconfig.json ./
COPY src/ ./src/

# Compilamos TypeScript → JavaScript en dist/
RUN npm run build

# ─────────────────────────────────────────────
# ETAPA 2: runner (imagen final)
# ─────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Solo copiamos package.json para instalar dependencias de producción
COPY package*.json ./
RUN npm ci --omit=dev

# Copiamos el código compilado desde la etapa anterior
COPY --from=builder /app/dist ./dist

# Creamos el directorio de datos donde se guardarán las notas
# En producción este directorio se monta como un volumen Docker
# para que las notas persistan aunque el contenedor se reinicie
RUN mkdir -p /app/data

# Puerto en el que escucha el servidor
EXPOSE 3000

# Variable de entorno para el puerto (sobreescribible en docker-compose)
ENV PORT=3000

# Comando de arranque — usamos el modo HTTP (no stdio)
CMD ["node", "dist/http.js"]
