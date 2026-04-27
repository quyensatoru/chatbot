FROM node:22-slim

ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./

RUN pnpm install --prod --ignore-scripts

COPY backend ./backend

EXPOSE 3000

CMD ["node", "backend/server.js"]
