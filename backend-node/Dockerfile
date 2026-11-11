# 构建上下文是仓库根目录（见 docker-compose.yml），因为后端要托管 ../frontend-static
# Build context is the repository root (see docker-compose.yml): the backend serves ../frontend-static
FROM node:20-alpine

WORKDIR /app

COPY backend-node/package.json ./backend-node/
RUN cd backend-node && npm install --omit=dev

COPY backend-node ./backend-node
COPY frontend-static ./frontend-static

WORKDIR /app/backend-node

EXPOSE 3010

CMD ["npm", "start"]
