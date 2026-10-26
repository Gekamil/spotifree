FROM node:20-slim

# Install system dependencies: Python 3, pip, ffmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp with system packages flag (latest version with ejs support)
RUN python3 -m pip install --no-cache-dir --break-system-packages -U "yt-dlp[default]"

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
RUN npm install --omit=dev

# Copy application files
COPY . .

ENV PORT=10000
ENV PYTHON_BIN=python3
ENV NODE_ENV=production

EXPOSE 10000

CMD ["node", "server.mjs"]
