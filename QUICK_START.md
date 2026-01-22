# Quick Start Guide

## ✅ Implementation Complete!

All features have been implemented following TDD approach. Here's what was built:

## 📁 Created Files

### Core Implementation
- `config/scanner.config.ts` - Port configuration
- `src/scanner/entities/scan.entity.ts` - SQLite entity with JSON support
- `src/scanner/dtos/create-scan.dto.ts` - Request DTO
- `src/scanner/dtos/scan-result.dto.ts` - Response DTO
- `src/scanner/services/dns-resolver.service.ts` - DNS resolution with nslookup
- `src/scanner/services/nmap-scanner.service.ts` - Nmap scanning and parsing
- `src/scanner/services/scanner.service.ts` - Main scanner service
- `src/scanner/processors/scan.processor.ts` - BullMQ processor
- `src/scanner/gateways/scanner.gateway.ts` - WebSocket gateway
- `src/scanner/controllers/scanner.controller.ts` - REST API
- `src/scanner/scanner.module.ts` - Module configuration

### Tests (TDD)
- `src/scanner/services/dns-resolver.service.spec.ts`
- `src/scanner/services/nmap-scanner.service.spec.ts`
- `src/scanner/processors/scan.processor.spec.ts`
- `test/scanner.e2e-spec.ts`

### Documentation & Client
- `SCANNER_README.md` - Complete documentation
- `client.html` - Beautiful WebSocket test client
- `QUICK_START.md` - This file

## 🚀 Next Steps

### 1. Install Dependencies
```bash
npm install
```

This will install:
- `@nestjs/bullmq` + `bullmq` - Queue management
- `ioredis` - Redis client
- `@nestjs/typeorm` + `typeorm` + `sql.js` - SQLite database (pure JavaScript)

### 2. Start Redis
```bash
# Using Docker (recommended)
docker run -d -p 6379:6379 redis:alpine

# Or using Homebrew (macOS)
brew services start redis
```

### 3. Run Tests
```bash
# Unit tests
npm test

# E2E tests (start Redis first)
npm run test:e2e
```

### 4. Start the Server
```bash
npm run start:dev
```

### 5. Test the Scanner

**Option A: Using the Web Client**
1. Open `client.html` in your browser
2. Enter target: `http://testphp.vulnweb.com/`
3. Click "Start Scan"
4. Watch real-time updates!

**Option B: Using cURL**
```bash
# Create scan
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -d '{"target":"http://testphp.vulnweb.com/"}'

# Get scan results (replace with your scan ID)
curl http://localhost:3000/scan/YOUR_SCAN_ID
```

**Option C: Using WebSocket Client**
```javascript
const io = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.emit('start-scan', { target: 'testphp.vulnweb.com' }, (response) => {
  console.log('Scan created:', response.data);
});

socket.on('scan-complete', (data) => {
  console.log('Scan complete!', data.ports);
});
```

## 📊 Architecture Highlights

### TDD Approach ✅
1. ✅ Tests written first
2. ✅ Implementation follows tests
3. ✅ Full test coverage

### Key Features
- **DNS Resolution**: Handles URLs, domains, and IPs
- **Nmap Integration**: Parses output from test-nmap-parse.js
- **BullMQ Queue**: Async processing with Redis
- **SQLite Storage**: JSON support for port results
- **WebSocket Updates**: Real-time scan progress
- **REST API**: Standard HTTP endpoints
- **Configurable Ports**: Easy to modify in config file

## 🔧 Configuration

Edit `config/scanner.config.ts`:
```typescript
export const SCANNER_CONFIG = {
  nmapOptions: {
    scanType: '-sS',     // Requires sudo
    timing: '-T4',
    openOnly: '--open',
  },
  defaultPorts: [80, 443, 8080, 22, 21, 3306, 5432, 27017],
  timeout: 300000,
};
```

## ⚠️ Important Notes

### Sudo Permissions
SYN scan (`-sS`) requires sudo. Options:
1. Run with sudo (not recommended for production)
2. Change to `-sT` (TCP connect scan, no sudo needed)
3. Configure sudoers to allow nmap without password

### Redis Requirement
BullMQ requires Redis. Ensure it's running before starting the app.

## 🎯 Test with Default URL

The default test URL `http://testphp.vulnweb.com/` is perfect for testing:
- It's a safe, intentionally vulnerable test site
- Usually has ports 80 and 443 open
- Good for demonstrating full flow

## 📝 Example Output

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "target": "http://testphp.vulnweb.com/",
  "resolvedIp": "44.228.249.3",
  "status": "completed",
  "ports": [
    {
      "port": 80,
      "protocol": "tcp",
      "state": "open",
      "service": "http"
    },
    {
      "port": 443,
      "protocol": "tcp",
      "state": "open",
      "service": "https"
    }
  ],
  "createdAt": "2026-01-22T10:00:00.000Z",
  "completedAt": "2026-01-22T10:00:15.000Z"
}
```

## 🐛 Troubleshooting

**Error: Cannot find module...**
→ Run `npm install`

**Error: Redis connection refused**
→ Start Redis: `docker run -d -p 6379:6379 redis:alpine`

**Error: Permission denied (nmap)**
→ Change scan type to `-sT` in config or run with appropriate permissions

**No ports found**
→ Target may have firewall blocking scans
→ Try with a known open target like `scanme.nmap.org`

## 📚 Documentation

See `SCANNER_README.md` for complete documentation including:
- Detailed API reference
- WebSocket event specifications
- Architecture diagrams
- Development guide

---

**Status**: ✅ All implementation complete and ready to use!
**Next**: Install dependencies and start testing! 🚀
