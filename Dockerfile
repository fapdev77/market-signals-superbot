# Phase 2.5.7: reproducible container image.
#
# Two stages: the first installs with the lockfile and produces the Vite bundle + the bundled server;
# the second carries only production dependencies and the build output.
#
# Note on SQLite persistence: the application writes `data/superbot.sqlite` (app state) and
# `data/backtest.db` (backtest results). Mount a volume at /app/data, otherwise state is lost on
# every redeploy.

# ---------- build ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Install exactly what the lockfile pins, including devDependencies (vite/esbuild/typescript).
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY server ./server
COPY server.ts ./

RUN npm run build

# ---------- runtime ----------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Only production dependencies are installed in the final image.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# Application state lives here; mount a volume to persist it.
# chown before VOLUME/USER so the unprivileged `node` user can write the database
# (otherwise the server fails at boot when /app/data is owned by root).
RUN mkdir -p /app/data && chown -R node:node /app/data
VOLUME ["/app/data"]

# Cloud Run / orchestration platforms inject PORT. HOST stays 0.0.0.0 to accept container traffic.
ENV PORT=3000
ENV HOST=0.0.0.0
EXPOSE 3000

# Run as the unprivileged user that the node image already provides.
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.cjs"]
