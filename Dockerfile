# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS builder

COPY nest-cli.json tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS=--enable-source-maps

WORKDIR /app

COPY package.json package-lock.json ./
RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
      poppler-utils \
      tesseract-ocr \
      tesseract-ocr-eng \
      tesseract-ocr-kor \
    && npm ci --omit=dev --ignore-scripts \
    && npm cache clean --force \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder --chown=node:node /app/dist ./dist

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]
