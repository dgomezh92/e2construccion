# Dockerfile para microservicio de pasarela de pagos
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm install --production

COPY . .

FROM node:20-alpine AS runtime
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app .

USER node
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "run", "service:start"]
