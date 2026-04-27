FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

COPY . .

ARG VITE_API_URL=http://localhost:3000
ARG VITE_ALLOWED_HOSTS=localhost
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_ALLOWED_HOSTS=$VITE_ALLOWED_HOSTS

RUN pnpm run build

FROM node:22-alpine

RUN npm install -g serve

COPY --from=builder /app/dist /app/dist

EXPOSE 8000

CMD ["serve", "-s", "/app/dist", "-l", "8000"]
