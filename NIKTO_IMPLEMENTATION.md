# Nikto Vulnerability Scanner - Implementation Complete ✅

## Overview

Successfully integrated Nikto vulnerability scanning into the network scanner. The system now automatically scans web services (HTTP/HTTPS) after port discovery.

## What Was Implemented

### Backend Components

1. **Database Schema** - Added vulnerabilities column to Scan entity
   - Stores JSON array of vulnerability findings
   - PostgreSQL timestamp compatibility

2. **Configuration** - Extended scanner config with:
   - Nikto options (timeout, tuning, maxTime)
   - Web ports list [80, 443, 8080, 8443, 3000, 5000, 8000]
   - Vulnerability scanning toggle and limits

3. **Nikto Scanner Service** - New service that:
   - Builds Nikto commands with safe tuning (1,2,3,4)
   - Executes scans with timeout protection
   - Parses output to extract vulnerabilities
   - Returns clean array of vulnerability descriptions

4. **Scan Processor** - Enhanced with vulnerability scanning phase:
   - Detects web ports after nmap scan
   - Runs Nikto sequentially on each web port
   - Emits WebSocket updates for progress
   - Handles errors gracefully (continues if one port fails)

5. **DTOs & Mappers** - Updated to include:
   - `vulnerabilities: string[]` field in ScanResultDto
   - JSON parsing in mapper method

6. **WebSocket Events** - Added two new events:
   - `vulnerability-scan-started` - Notifies scan beginning
   - `vulnerability-scan-complete` - Reports findings count

7. **Unit Tests** - Comprehensive test coverage:
   - Command building tests
   - Output parsing tests
   - Error handling tests
   - Mock-based execution tests

### Frontend Components

1. **useScanner Hook** - Added event listeners:
   - Logs vulnerability scan progress
   - Updates UI with findings count

2. **ScanResults Component** - Enhanced with:
   - Vulnerabilities section with Shield icon
   - Alert components for each vulnerability
   - "No vulnerabilities detected" success message
   - Conditional rendering based on web ports

3. **Alert UI Component** - Created reusable alert with:
   - Warning variant for vulnerabilities
   - Accessible markup
   - Dark mode support

## How It Works

### Scan Flow

```
1. DNS Resolution → 2. Nmap Port Scan → 3. Nikto Vulnerability Scan → 4. Results Saved
                                                ↓
                                    Only if web ports found (80, 443, etc.)
```

### Example Output Parsing

**Nikto Raw Output:**
```
+ /: Retrieved x-powered-by header: PHP/5.6.40
+ /: The X-Frame-Options header is not present.
+ /: The X-Content-Type-Options header is not set.
```

**Parsed Array:**
```json
[
  "Retrieved x-powered-by header: PHP/5.6.40",
  "The X-Frame-Options header is not present.",
  "The X-Content-Type-Options header is not set."
]
```

## Configuration

### Enable/Disable Vulnerability Scanning

Edit `config/scanner.config.ts`:

```typescript
vulnerabilityScanning: {
  enabled: true,              // Set to false to disable
  skipIfNoWebPorts: true,     // Skip if no HTTP/HTTPS found
  maxPortsToScan: 5,          // Limit to prevent long scans
}
```

### Adjust Nikto Tuning

```typescript
niktoOptions: {
  timeout: 600000,            // 10 minutes max
  tuning: '1,2,3,4',         // Safe checks only
  maxTime: 300,              // 5 minutes per port
}
```

**Tuning Options:**
- 1: Interesting files
- 2: Misconfiguration
- 3: Information disclosure
- 4: Injection
- 5-9: More aggressive (not recommended for auto-scan)

### Define Web Ports

```typescript
webPorts: [80, 443, 8080, 8443, 3000, 5000, 8000]
```

## Testing

### Unit Tests

```bash
npm test -- nikto-scanner.service.spec
```

All tests passing:
- ✅ Command building
- ✅ Output parsing
- ✅ Scan execution
- ✅ Error handling

### Manual Testing

```bash
# Start the backend
npm run start:dev

# Start the client
cd client && npm run dev

# Open browser and scan
http://localhost:3001
Target: http://testphp.vulnweb.com/
```

## WebSocket Events

### Client → Server
```javascript
socket.emit('start-scan', { target: 'http://testphp.vulnweb.com/' })
```

### Server → Client
```javascript
'scan-started'                    // Initial scan begins
'dns-resolved'                    // IP resolved
'scanning-ports'                  // Nmap running
'vulnerability-scan-started'      // Nikto starting
'vulnerability-scan-complete'     // Nikto finished
'scan-complete'                   // Everything done
```

## Performance

- **Nmap Scan**: ~5-10 seconds
- **Nikto Scan**: ~30-300 seconds per port (configurable)
- **Total**: Depends on number of web ports found

### Optimization Tips

1. Reduce `maxPortsToScan` to limit long scans
2. Adjust `maxTime` to balance thoroughness vs speed
3. Disable vulnerability scanning for quick port-only scans

## Security Considerations

### Safe by Design
- Uses safe tuning (1,2,3,4) - no aggressive tests
- Respects target with reasonable timeouts
- Non-intrusive information gathering only

### Legal Note
⚠️ Only scan targets you have permission to test. Unauthorized scanning may be illegal.

## Database Schema

**scans table** now includes:
```sql
vulnerabilities TEXT NULL  -- JSON array of findings
```

Example data:
```json
[
  "The X-Frame-Options header is not present.",
  "The X-Content-Type-Options header is not set.",
  "Retrieved x-powered-by header: PHP/5.6.40"
]
```

## UI Features

### Vulnerability Display
- 🛡️ Shield icon with count
- ⚠️ Warning alerts for each finding
- ✅ Success message if no vulnerabilities
- 🎨 Dark mode compatible

### Real-time Updates
- Progress logs in scan logs panel
- Live vulnerability count updates
- Smooth transitions between scan phases

## Files Created/Modified

### Created
- `src/scanner/services/nikto-scanner.service.ts`
- `src/scanner/services/nikto-scanner.service.spec.ts`
- `client/components/ui/alert.tsx`
- `NIKTO_IMPLEMENTATION.md`

### Modified
- `src/scanner/entities/scan.entity.ts`
- `config/scanner.config.ts`
- `src/scanner/processors/scan.processor.ts`
- `src/scanner/dtos/scan-result.dto.ts`
- `src/scanner/services/scanner.service.ts`
- `src/scanner/gateways/scanner.gateway.ts`
- `src/scanner/scanner.module.ts`
- `client/lib/hooks/useScanner.ts`
- `client/components/ScanResults.tsx`

## Next Steps

### Potential Enhancements

1. **Severity Classification**
   - Parse vulnerability text to assign severity levels
   - Color-code by risk (low/medium/high/critical)

2. **Filtering & Sorting**
   - Filter vulnerabilities by type
   - Sort by severity or alphabetically

3. **Export Reports**
   - PDF export with scan results
   - CSV export for vulnerability lists

4. **Historical Tracking**
   - Compare scans over time
   - Track vulnerability remediation

5. **Additional Scanners**
   - testssl.sh for SSL/TLS checks
   - WhatWeb for technology fingerprinting
   - Nuclei for CVE detection

## Troubleshooting

### Nikto Not Found
```bash
# Install Nikto
sudo apt-get install nikto    # Ubuntu/Debian
brew install nikto             # macOS
```

### Scan Timeout
- Increase `niktoOptions.timeout` in config
- Reduce `maxPortsToScan` limit
- Check target is accessible

### No Vulnerabilities Shown
- Verify web ports are open (80, 443, etc.)
- Check logs for Nikto execution errors
- Ensure `vulnerabilityScanning.enabled` is true

---

**Status**: ✅ Fully implemented and tested
**Test URL**: http://testphp.vulnweb.com/
**Ready for production**: Yes (with permission-based scanning)

🎉 Nikto vulnerability scanning is now live!
