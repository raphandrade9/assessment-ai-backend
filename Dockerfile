# Estágio 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependências (npm ci para builds determinísticos)
COPY package*.json ./
RUN npm ci

# Copiar código fonte e arquivos do Prisma
COPY . .

# Gerar o Prisma Client (isso usa o output configurado no schema)
RUN npx prisma generate

# Compilar o TypeScript
RUN npm run build

# Estágio 2: Produção
FROM node:20-alpine

WORKDIR /app

# Definir como produção
ENV NODE_ENV=production

# Copiar apenas os arquivos necessários do estágio anterior
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
# Copiar o diretório de geração do Prisma Client (estava configurado para src/generated/prisma no schema)
COPY --from=builder /app/src/generated ./src/generated

# Instalar apenas dependências de produção
RUN npm ci --only=production

# Segurança: Usar o usuário 'node' em vez de root
USER node

# Expor a porta
EXPOSE ${PORT}

# Comando de entrada
CMD ["node", "dist/server.js"]
