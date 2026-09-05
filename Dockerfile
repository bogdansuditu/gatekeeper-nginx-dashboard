# =========================================================
# Stage 1: Build Stage
# =========================================================
FROM node:22-alpine AS builder

# Install build tools required for native Node addons (better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy root workspace and package files
COPY package.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install all dependencies (including devDependencies for TypeScript & Vite)
RUN npm install

# Copy source trees
COPY server/ ./server/
COPY client/ ./client/

# Build client React application
RUN npm --prefix client run build

# Build server TypeScript application
RUN npm --prefix server run build

# Copy frontend distribution into server's static hosting directory
RUN mkdir -p /app/server/dist/public && cp -r /app/client/dist/* /app/server/dist/public/

# Prune devDependencies to keep image lean
RUN npm prune --omit=dev

# =========================================================
# Stage 2: Production Runtime Stage
# =========================================================
FROM node:22-alpine AS runner

# Install dumb-init or sqlite runtime libraries if needed
RUN apk add --no-cache dumb-init

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/data/gatekeeper.sqlite
ENV CACHE_DIR=/data/cache

# Create data volume directory and set ownership for built-in node user (UID 1000)
RUN mkdir -p /data/cache/favicons /data/avatars && \
    chown -R node:node /data /app

# Copy built application and production node_modules from builder
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/server ./server

USER node

VOLUME ["/data"]

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server/dist/index.js"]
