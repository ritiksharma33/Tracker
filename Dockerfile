# ── Base: Node 20 slim (Debian) ─────────────────────────────────────────────
FROM node:20-slim

# Install Python + pipx (needed to install stb)
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-pip pipx \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# Install snorkelai-stb and put it on PATH
RUN pipx install snorkelai-stb
ENV PATH="/root/.local/bin:$PATH"

# ── App ──────────────────────────────────────────────────────────────────────
WORKDIR /app

# Install Node deps first (cache-friendly layer)
COPY package*.json ./
RUN npm ci

# Copy source and build Next.js production bundle
COPY . .
RUN npm run build

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

CMD ["npm", "start"]
