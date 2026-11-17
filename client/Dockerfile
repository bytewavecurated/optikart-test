# syntax=docker/dockerfile:1
#
# OptikArt client: the React (CRA + react-app-rewired) bundle built once, served
# by nginx, which also reverse-proxies /api, /uploads and /socket.io to the API
# container so the browser stays single-origin by default.
#
# Single-origin is not a style choice here: client/src/services/api.js defaults
# to `/api`, the bundle is built with whatever REACT_APP_* you pass at BUILD
# time (CRA inlines them), and every absolute URL stored for images survives
# moving between Cloudinary (absolute https) and local disk (same-origin
# /uploads). The defaults below therefore produce a bundle that works wherever
# the domain points; the ARGs exist for the split-origin case only.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# CI=false because CRA turns warnings into build errors when CI is set, and a
# warning should not fail an image build (CI's own `npm run build` step sets it
# explicitly for exactly that reason).
ENV CI=false
ARG REACT_APP_API_URL=
ARG REACT_APP_SOCKET_URL=
ENV REACT_APP_API_URL=$REACT_APP_API_URL \
    REACT_APP_SOCKET_URL=$REACT_APP_SOCKET_URL \
    GENERATE_SOURCEMAP=false
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
# nginx:alpine is distroless-ish; the built-in busybox wget can still probe the
# SPA root and this checks nginx itself, not the API (that is its own healthcheck).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
