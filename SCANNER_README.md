# Network Scanner Implementation

## Overview

A complete network scanning system built with NestJS following TDD principles. The system performs DNS resolution and nmap port scanning with real-time WebSocket updates.

## Features

- ✅ DNS resolution with nslookup (supports URLs, domains, and IPs)
- ✅ Nmap port scanning with configurable ports
- ✅ BullMQ queue processing with Redis
- ✅ SQLite database with JSON support
- ✅ Real-time WebSocket updates
- ✅ REST API endpoints
- ✅ Comprehensive unit and E2E tests

## Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Start Redis (required for BullMQ):**
```bash
# Using Docker
docker run -d -p 6379:6379 redis:alpine

# Or using Homebrew on macOS
brew services start redis
```

3. **Create `.env` file:**
```env
REDIS_HOST=localhost
REDIS_PORT=6379
DATABASE_PATH=./scanner.sqlite
MONGO_URI=mongodb://localhost:27017/nestpj
```

4. **Run the application:**
```bash
npm run start:dev
```

## Architecture

### Flow
1. Client submits scan request (REST API or WebSocket)
2. Scan record created in SQLite
3. Job added to BullMQ queue
4. Processor picks up job:
   - Resolves domain to IP (if not already IP)
   - Runs nmap scan
   - Parses results
   - Saves to database
5. Real-time updates sent via WebSocket

### Components

- **DNS Resolver Service**: Resolves domains to IPs using nslookup
- **Nmap Scanner Service**: Executes nmap and parses results
- **Scanner Service**: Manages scan records and queue
- **Scan Processor**: Orchestrates the scanning workflow
- **Scanner Gateway**: WebSocket communication
- **Scanner Controller**: REST API endpoints

## API Endpoints

### REST API

**Create Scan**
```http
POST /scan
Content-Type: application/json

{
  "target": "http://testphp.vulnweb.com/"
}

Response: 202 Accepted
{
  "id": "uuid",
  "target": "http://testphp.vulnweb.com/",
  "status": "pending",
  "ports": [],
  "createdAt": "2026-01-22T..."
}
```

**Get Scan**
```http
GET /scan/:id

Response: 200 OK
{
  "id": "uuid",
  "target": "http://testphp.vulnweb.com/",
  "resolvedIp": "44.228.249.3",
  "status": "completed",
  "ports": [
    {
      "port": 80,
      "protocol": "tcp",
      "state": "open",
      "service": "http"
    }
  ],
  "createdAt": "2026-01-22T...",
  "completedAt": "2026-01-22T..."
}
```

**List All Scans**
```http
GET /scan

Response: 200 OK
[
  { /* scan objects */ }
]
```

### WebSocket Events

**Client -> Server**

```javascript
// Start a scan
socket.emit('start-scan', { target: 'example.com' }, (response) => {
  console.log(response.data); // { id, target, status, ... }
});

// Join scan room for updates
socket.emit('join-scan-room', { scanId: 'uuid' });
```

**Server -> Client**

```javascript
// Scan lifecycle events
socket.on('scan-started', (data) => {
  // { scanId, target, status: 'processing' }
});

socket.on('dns-resolved', (data) => {
  // { scanId, resolvedIp: '1.2.3.4' }
});

socket.on('scanning-ports', (data) => {
  // { scanId, resolvedIp }
});

socket.on('scan-complete', (data) => {
  // { scanId, status: 'completed', ports: [...], completedAt }
});

socket.on('scan-failed', (data) => {
  // { scanId, status: 'failed', error: 'message' }
});
```

## Configuration

Edit `config/scanner.config.ts` to customize:

```typescript
export const SCANNER_CONFIG = {
  nmapOptions: {
    scanType: '-sS',     // SYN scan
    timing: '-T4',       // Aggressive timing
    openOnly: '--open',  // Only show open ports
  },
  defaultPorts: [80, 443, 8080, 22, 21, 3306, 5432, 27017],
  timeout: 300000, // 5 minutes
};
```

## Testing

**Run unit tests:**
```bash
npm test
```

**Run E2E tests:**
```bash
npm run test:e2e
```

**Test with example URL:**
```bash
# Start the server
npm run start:dev

# In another terminal
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -d '{"target":"http://testphp.vulnweb.com/"}'
```

## Permissions

**Note:** Nmap SYN scan (-sS) requires sudo privileges. Ensure the application has permission to run sudo nmap or modify the scan type in the config.

Alternative without sudo:
```typescript
// In config/scanner.config.ts
nmapOptions: {
  scanType: '-sT',  // TCP Connect scan (no sudo required)
  timing: '-T4',
  openOnly: '--open',
}
```

## Example Usage

### Using REST API

```bash
# Create scan
SCAN_ID=$(curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -d '{"target":"testphp.vulnweb.com"}' \
  | jq -r '.id')

# Check status
curl http://localhost:3000/scan/$SCAN_ID | jq
```

### Using WebSocket Client (see client.html)

Open `client.html` in a browser and enter target URL.

## Troubleshooting

**Redis connection error:**
- Ensure Redis is running: `redis-cli ping` (should return "PONG")

**Nmap permission error:**
- Run with sudo or change scan type to `-sT`
- Ensure nmap is installed: `nmap --version`

**DNS resolution fails:**
- Check internet connection
- Verify target domain exists
- Check firewall settings

## Testing with testphp.vulnweb.com

The default test URL `http://testphp.vulnweb.com/` is a vulnerable web application for testing:
- Expected DNS resolution: ~44.228.249.3 (may vary)
- Expected open ports: 80 (http), 443 (https)

## Development

All scanner files are located in `src/scanner/`:
```
src/scanner/
├── controllers/scanner.controller.ts
├── gateways/scanner.gateway.ts
├── services/
│   ├── dns-resolver.service.ts
│   ├── nmap-scanner.service.ts
│   └── scanner.service.ts
├── processors/scan.processor.ts
├── entities/scan.entity.ts
├── dtos/
└── scanner.module.ts
```

## License

UNLICENSED
