# 构建上下文是仓库根目录（见 docker-compose.yml），因为后端要托管 ../frontend-static
# Build context is the repository root (see docker-compose.yml): the backend serves ../frontend-static
FROM node:20-alpine

WORKDIR /app

# 带上 lock 文件并用 npm ci，保证每次构建的依赖版本一致
# Copy the lockfile and use npm ci so every build installs the same versions
COPY backend-node/package.json backend-node/package-lock.json ./backend-node/
RUN cd backend-node && npm ci --omit=dev && npm cache clean --force

COPY backend-node ./backend-node
COPY frontend-static ./frontend-static

WORKDIR /app/backend-node

ENV NODE_ENV=production

# 以非 root 用户运行 / Run as the unprivileged user shipped with the image
USER node

EXPOSE 3010

# 直接用 node 启动，SIGTERM 能直达进程，docker stop 可正常退出
# Start node directly so SIGTERM reaches the process and docker stop exits cleanly
CMD ["node", "src/index.js"]
