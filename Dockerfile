# Stage 1: Build the React application
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VERSION=dev
ENV VITE_APP_VERSION=${VERSION}

RUN npm run build

# Stage 2: Fetch the pinned Marine Park web build (see marine-park.version)
FROM alpine:3.20 AS marinepark
RUN apk add --no-cache curl jq unzip
WORKDIR /src
COPY marine-park.version scripts/fetch-marine-park.sh ./
ARG MARINE_PARK_REQUIRED=false
RUN --mount=type=secret,id=marine_park_token \
    MARINE_PARK_REQUIRED=${MARINE_PARK_REQUIRED} sh fetch-marine-park.sh /game

# Stage 3: Serve with nginx
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build /usr/share/nginx/html
COPY --from=marinepark /game /usr/share/nginx/html/marine-park

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
