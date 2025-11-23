# ================================
# Stage 1: Builder
# ================================
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY src ./src
COPY interfaces ./interfaces
COPY examples ./examples
COPY specs ./specs
COPY tests ./tests

# Build TypeScript to JavaScript (skip lib check for faster build)
RUN npx tsc --skipLibCheck

# Prune dev dependencies
RUN npm prune --production

# ================================
# Stage 2: Production Runtime
# ================================
FROM node:18-alpine

# Install runtime dependencies only
RUN apk add --no-cache \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S smalltalk && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G smalltalk smalltalk

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy production node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy compiled application from builder
COPY --from=builder /app/dist ./dist

# Copy static assets
COPY --from=builder /app/interfaces ./interfaces
COPY --from=builder /app/examples ./examples

# Copy configuration files
COPY --chown=smalltalk:smalltalk README.md CLAUDE.md LICENSE ./

# Create necessary directories with proper permissions
RUN mkdir -p /app/data /app/logs && \
    chown -R smalltalk:smalltalk /app

# Switch to non-root user
USER smalltalk

# Expose application port
EXPOSE 3000

# Expose health check port
EXPOSE 3001

# Health check (using dedicated health endpoint)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the production server
CMD ["node", "dist/src/server/server.js"]
