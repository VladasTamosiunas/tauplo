# Tauplo, self-hosted. Build:  docker build -t tauplo .
# Run with docker compose (see docker-compose.yml), or:  docker run -p 3000:3000 -e DATABASE_URL=... -e SITE_URL=... tauplo

# ---- dependencies
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json .npmrc ./
COPY prisma ./prisma
RUN npm ci

# ---- build
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG SITE_URL=http://localhost:3000
ENV SITE_URL=${SITE_URL}
# Build with webpack, not Next's default Turbopack. Measured on this app in a 1.8 GB container: Turbopack was killed by the
# kernel (exit 137), webpack finished with a peak near 570 MB. Turbopack's memory is native, so capping Node's heap does not
# help. On a machine with plenty of memory you can drop `--webpack` and use the default.
# The build needs a DATABASE_URL to exist but never connects to it.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate && DATABASE_URL="postgresql://build:build@localhost:5432/build" npx next build --webpack

# ---- run
FROM node:22-bookworm-slim AS run
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 tauplo && useradd --system --uid 1001 --gid tauplo tauplo

# the standalone server, its static files, and the public folder (if any)
COPY --from=build --chown=tauplo:tauplo /app/.next/standalone ./
COPY --from=build --chown=tauplo:tauplo /app/.next/static ./.next/static
# Migrations are applied at start with the Prisma CLI. Copying a few of its folders out of node_modules fails one missing
# dependency at a time (first `effect`, then more), so install the CLI properly, at the version the app was built with, into
# its own folder where it brings every dependency with it. The generated client the app uses is already in the standalone build.
COPY --from=build --chown=tauplo:tauplo /app/prisma ./prisma
COPY --from=build /app/node_modules/prisma/package.json /tmp/prisma-package.json
RUN mkdir -p /opt/prisma-cli && cd /opt/prisma-cli && npm init -y >/dev/null && npm install --no-audit --no-fund "prisma@$(node -p "require('/tmp/prisma-package.json').version")" && chown -R tauplo:tauplo /opt/prisma-cli

USER tauplo
EXPOSE 3000
# apply any new migrations (safe to repeat), then start the server
CMD ["sh", "-c", "node /opt/prisma-cli/node_modules/prisma/build/index.js migrate deploy --schema ./prisma/schema.prisma && exec node server.js"]
