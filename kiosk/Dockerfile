# Stage 1: Build
FROM node:18-alpine as builder

WORKDIR /app/kiosk

# Copy package files from kiosk directory
COPY kiosk/package*.json ./
RUN npm install

# Copy shared config to parent directory
COPY tailwind-preset.js /app/tailwind-preset.js

# Copy kiosk source code
COPY kiosk/ .

# Build Arguments (passed from docker-compose)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_MACHINE_ID
ARG VITE_WEB_APP_URL

# Set Env Vars for Build
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_MACHINE_ID=$VITE_MACHINE_ID
ENV VITE_WEB_APP_URL=$VITE_WEB_APP_URL

RUN npm run build

# Stage 2: Serve
FROM nginx:alpine

COPY --from=builder /app/kiosk/dist /usr/share/nginx/html
COPY kiosk/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
