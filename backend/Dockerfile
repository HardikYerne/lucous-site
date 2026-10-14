FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY prisma ./prisma
COPY server.js ./

RUN npx prisma generate

EXPOSE 5000

CMD ["node", "server.js"]
