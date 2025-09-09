# Use official Node.js runtime as base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache curl tzdata

# Set timezone to Switzerland
ENV TZ=Europe/Zurich

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev deps for building)
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port (for health checks)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["npm", "start"]