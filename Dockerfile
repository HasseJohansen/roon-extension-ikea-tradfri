# Dockerfile for Roon IKEA Tradfri Extension
# Multi-stage build for smaller final image

# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Production stage
FROM node:24-alpine

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -h /home/nodejs

# Create writable config directory and /home/node for compatibility
RUN mkdir -p /app/config /home/nodejs/.config /home/node && \
    chown -R nodejs:nodejs /app /home/nodejs /home/node

# Copy from builder (production dependencies only)
COPY --from=builder /app/node_modules ./node_modules

# Copy application files
COPY app.js connection.js devices.js logger.js state.js tradfri-manager.js settings-manager.js ./
COPY package*.json ./
COPY LICENSE ./

# Change ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port (Roon uses 9100-9200 for extensions)
EXPOSE 9100-9200

# Set environment variables
ENV NODE_ENV=production
ENV HOME=/home/nodejs

# Start the extension
CMD ["node", "app.js"]
