# ---- Builder: compila TypeScript a JS, con todo el toolchain de desarrollo ----
FROM node:22-alpine AS builder

WORKDIR /app

# bcrypt es un módulo nativo: necesita compilador para el postinstall.
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Production: solo el JS compilado + dependencias de producción ----
FROM node:22-alpine AS production

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
    && npm ci --omit=dev \
    && apk del .build-deps

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main.js"]
