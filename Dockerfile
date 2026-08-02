# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS build

WORKDIR /app

# Install from the lockfile in a cache-friendly layer.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build


FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

WORKDIR /app

# Nitro's output is self-contained.
COPY --from=build --chown=node:node /app/.output ./.output

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD ["node", "-e", "const net=require('node:net');const socket=net.connect(Number(process.env.PORT)||3000,'127.0.0.1');socket.setTimeout(2000);socket.on('connect',()=>{socket.end();process.exit(0)});socket.on('timeout',()=>{socket.destroy();process.exit(1)});socket.on('error',()=>process.exit(1))"]

CMD ["node", ".output/server/index.mjs"]
