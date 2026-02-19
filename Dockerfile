# Use lightweight Node image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first (better caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Install curl for Docker healthcheck  <-- ADD THIS LINE
RUN apk add --no-cache curl

# Copy rest of the code
COPY . .

# Expose backend port
EXPOSE 5000

# Health check to detect if app is frozen or hung
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Start server
CMD ["npm", "start"]
