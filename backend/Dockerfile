FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# Expose port and start
EXPOSE 3001
CMD ["npm", "start"]
