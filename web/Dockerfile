# Stage 1: Build
FROM node:18-alpine as builder

WORKDIR /app/web

# Copy package files from web directory
COPY web/package*.json ./
RUN npm install

# Copy shared config to parent directory
COPY tailwind-preset.js /app/tailwind-preset.js

# Copy web source code
COPY web/ .

# Build Arguments
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

# Stage 2: Serve
FROM nginx:alpine

COPY --from=builder /app/web/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
