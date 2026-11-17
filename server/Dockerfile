# syntax=docker/dockerfile:1
#
# OptikArt API server.
#
# The intended production shape is behind the client container's nginx
# (client/Dockerfile), which is why docker-compose sets TRUST_PROXY_HOPS=1 -
# the rate limiters and audit logs key on the client IP, and one hop of
# X-Forwarded-* is the difference between "a seller got rate limited" and
# "everything behind one proxy IP got rate limited".
#
# Deliberately NOT done here:
#  - No baked NODE_ENV. config/authMode.js reads NODE_ENV to decide the boot
#    checks (mandatory SMTP, 32-char JWT_SECRET, seed refusal). Whether the
#    target has SMTP credentials is a deployment fact, not a build fact, so
#    docker-compose passes it through and a wrong answer fails at boot with a
#    printed reason - which is the project's design, not an accident to paper over.
#  - The `uploads/` directory is the only writable path a container needs
#    (STORAGE_BACKEND=auto falls back to local disk in dev; production is
#    expected to use Cloudinary). Compose gives it a named volume.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --omit=dev: prettier is a harness dependency, nothing at runtime imports it.
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:22-alpine
ENV PORT=5000
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Created at import time by server.js too, but created here so the named volume
# inherits node:node ownership instead of root:root on first mount.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
# `server/.env` is excluded by .dockerignore: the image carries no credentials,
# configuration arrives via the environment (env-file or compose `environment:`).
USER node
EXPOSE 5000
# /api/health is a real readiness check (200 connected / 503 anything-else),
# so a passing probe means the process can serve, not merely that it is awake.
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
