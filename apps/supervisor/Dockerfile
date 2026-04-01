# ==========================================
# AgentHive Supervisor Backend Dockerfile
# ==========================================

# ------------------------------------------
# Stage 1: Dependencies
# ------------------------------------------
FROM golang:1.22-alpine AS deps
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download && go mod verify

# ------------------------------------------
# Stage 2: Builder
# ------------------------------------------
FROM golang:1.22-alpine AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /go/pkg /go/pkg

# Copy source code
COPY . .

# Build application
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags='-w -s -extldflags "-static"' \
    -a -installsuffix cgo \
    -o supervisor \
    ./cmd/server/main.go

# ------------------------------------------
# Stage 3: Production
# ------------------------------------------
FROM scratch AS production

# Copy CA certificates for HTTPS
COPY --from=deps /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy timezone data
COPY --from=deps /usr/share/zoneinfo /usr/share/zoneinfo

# Copy binary
COPY --from=builder /app/supervisor /supervisor

# Copy config (optional, can be mounted)
# COPY config.yaml /config.yaml

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["/supervisor", "-port", "8080", "||", "exit", "1"]

# Run application
ENTRYPOINT ["/supervisor"]
CMD ["-port", "8080", "-config", "/config/config.yaml"]

# ------------------------------------------
# Stage 4: Development
# ------------------------------------------
FROM golang:1.22-alpine AS development
WORKDIR /app

# Install development tools
RUN apk add --no-cache git ca-certificates tzdata curl

# Install air for hot reload
RUN go install github.com/cosmtrek/air@latest

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Expose port
EXPOSE 8080

# Run with air for hot reload
CMD ["air", "-c", ".air.toml"]
