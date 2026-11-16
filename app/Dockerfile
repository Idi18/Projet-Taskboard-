# ---- Étape 1 : installer les dépendances de production ----
FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- Étape 2 : image finale, légère ----
FROM node:26-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Utilisateur non-root (UID numérique pour Kubernetes)
# npm ne sert qu'au build : on le retire de l'image finale (failles Trivy dans ses dépendances)
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
USER 1000
EXPOSE 3000
CMD ["node", "server.js"]