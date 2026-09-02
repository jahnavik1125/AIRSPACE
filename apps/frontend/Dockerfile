# ==============================================================================
# AIRSPACE Frontend Production Multi-Stage Dockerfile
# ==============================================================================

# Stage 1: Build Next.js Application
FROM node:18-alpine AS builder
WORKDIR /workspace

# Install dependencies
COPY apps/frontend/package*.json ./
RUN npm ci

# Copy application files
COPY apps/frontend/ ./

# Define build-time environment variables for Next.js static optimization
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws/spatial
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

# Build application
RUN npm run build

# Stage 2: Production Runner
FROM node:18-alpine AS runner
WORKDIR /workspace
ENV NODE_ENV=production

# Copy built application assets
COPY --from=builder /workspace/package*.json ./
COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/.next ./.next
COPY --from=builder /workspace/public ./public

EXPOSE 3000

CMD ["npm", "run", "start"]
