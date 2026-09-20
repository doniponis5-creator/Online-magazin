# Сайт Smart Centr — production-образ (Next.js standalone).
# Каталог (src/data/1c/catalog.json) встраивается при сборке; при его изменении
# сервер пересобирает образ (deploy/site/update_catalog.sh).

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S site && adduser -S site -G site
COPY --from=build --chown=site:site /app/.next/standalone ./
COPY --from=build --chown=site:site /app/.next/static ./.next/static
COPY --from=build --chown=site:site /app/public ./public
# Папка журнала должна существовать в образе и принадлежать site: иначе докер
# создаст хранилище от root, и сайт не сможет в него писать.
RUN mkdir -p /app/data && chown site:site /app/data
USER site
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ru >/dev/null 2>&1 || exit 1
CMD ["node", "server.js"]
