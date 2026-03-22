FROM node:22-alpine
RUN npm install -g pnpm@10.26.1
WORKDIR /app
COPY . .
RUN pnpm install --no-frozen-lockfile
CMD ["pnpm", "--filter", "@workspace/discord-bot", "run", "dev"]
