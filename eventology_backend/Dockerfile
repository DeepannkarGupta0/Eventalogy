FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# --- Production Image (Google Cloud Run) ---
FROM node:22-slim

WORKDIR /app

# Install Python 3 + OpenCV headless for cv_blueprint_extractor.py
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    libglib2.0-0 \
    libgl1 \
    && pip3 install --no-cache-dir --break-system-packages numpy opencv-python-headless \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY src/tools/cv_blueprint_extractor.py ./dist/tools/cv_blueprint_extractor.py

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/index.js"]
