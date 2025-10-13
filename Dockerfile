# 🐳 Multi-stage Docker build for AutoDevOps AI Orchestrator
# Optimized for production deployment with minimal image size

# 🏗️ Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# 📦 Install build dependencies
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++ \
    chromium \
    nss \
    freetype \
    harfbuzz \
    && npm install -g pnpm

# 🏠 Set Playwright environment
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin/chromium-browser
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# 📄 Copy package files
COPY package*.json pnpm-lock.yaml* ./
COPY tsconfig*.json ./

# 📦 Install all dependencies (including dev)
RUN pnpm install --frozen-lockfile

# 📁 Copy source code
COPY src/ ./src/
COPY public/ ./public/
COPY scripts/ ./scripts/
COPY tests/ ./tests/

# 🏗️ Build application
RUN pnpm build

# 🧪 Run tests in build stage
RUN pnpm test:ci

# 🔧 Install Playwright dependencies
RUN npx playwright install-deps

# 🗂️ Stage 2: Production stage
FROM node:20-alpine AS production

# 🛠️ Install runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    git \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nextjs -u 1001

# 🏠 Set Playwright environment
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin/chromium-browser
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

# 📄 Copy package files
COPY package*.json ./

# 📦 Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# 📁 Copy built application from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next

# 📁 Copy configuration files
COPY --chown=nextjs:nodejs next.config.js ./
COPY --chown=nextjs:nodejs tailwind.config.js ./
COPY --chown=nextjs:nodejs postcss.config.js ./
COPY --chown=nextjs:nodejs ecosystem.config.js ./

# 📁 Copy runtime scripts
COPY --from=builder --chown=nextjs:nodejs /app/scripts/health-check.js ./
COPY --from=builder --chown=nextjs:nodejs /app/scripts/startup.js ./

# 📂 Create necessary directories
RUN mkdir -p logs temp uploads \
    && chown -R nextjs:nodejs logs temp uploads

# 👥 Switch to non-root user
USER nextjs

# 📅 Health check
HEALTHCHECK --interval=30s --timeout=15s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || node health-check.js || exit 1

# 🌐 Expose ports
EXPOSE 3001 8080

# 🏠 Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"
ENV LOG_LEVEL=info
ENV MAX_MEMORY_USAGE=512

# 🚀 Start application with dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]

# 🏷️ Docker labels for metadata and OCI compliance
LABEL maintainer="George Pricop <pricopgeorge@gmail.com>"
LABEL description="AI-powered end-to-end DevOps automation platform with Task Master, GitHub API, FastMCP, Playwright and Phoenix integration"
LABEL version="1.0.0"
LABEL org.opencontainers.image.title="AutoDevOps AI Orchestrator"
LABEL org.opencontainers.image.description="AI-powered DevOps automation platform"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.authors="George Pricop <pricopgeorge@gmail.com>"
LABEL org.opencontainers.image.source="https://github.com/Gzeu/autodevops-ai-orchestrator"
LABEL org.opencontainers.image.documentation="https://github.com/Gzeu/autodevops-ai-orchestrator/blob/main/README.md"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.vendor="George Pricop"
LABEL org.opencontainers.image.url="https://autodevops-ai-orchestrator.vercel.app"