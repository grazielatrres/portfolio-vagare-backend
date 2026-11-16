FROM node:20-slim AS build
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
# Grava um Debug ID em cada .js e .js.map para o Sentry ligar o erro ao source
# map certo. Roda offline (não precisa de token) e o resultado é determinístico.
RUN npx sentry-cli sourcemaps inject dist

# Só o dist/ já com os Debug IDs. O deploy.yml exporta este estágio para enviar
# ao Sentry exatamente os mesmos arquivos que vão na imagem. Não entra na imagem final.
FROM scratch AS sourcemaps
COPY --from=build /app/dist /

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
# node_modules completo: o Prisma CLI (devDependency) é usado para rodar as migrations ao subir
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./
COPY prisma ./prisma
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
