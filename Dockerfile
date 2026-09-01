FROM node:22-alpine

WORKDIR /app

# Install backend deps first (better layer caching)
COPY backend/package*.json ./backend/
RUN npm --prefix backend ci --omit=dev

# Copy app source
COPY backend ./backend
COPY frontend ./frontend

WORKDIR /app/backend
EXPOSE 4000

CMD ["node", "server.js"]