FROM node:20-slim AS builder
WORKDIR /app

# Copia os arquivos de lock e configurações da raiz (se existirem)
COPY package*.json ./

# Copia as pastas necessárias
COPY shared/ ./shared/
COPY server/ ./server/

# Entra na pasta do servidor e instala
WORKDIR /app/server
RUN npm install --ignore-scripts

# Faz o build
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app/server

ENV NODE_ENV=production

# Traz os arquivos do estágio de builder
COPY --from=builder /app/shared /app/shared
COPY --from=builder /app/server/package*.json ./
COPY --from=builder /app/server/node_modules ./node_modules

COPY --from=builder /app/server/dist ./dist

RUN mkdir -p /data

EXPOSE 3030
CMD ["node", "dist/index.js"]