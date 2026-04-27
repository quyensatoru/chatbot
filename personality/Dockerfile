FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app/personality

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install

COPY . .

CMD ["node", "main.js"]
