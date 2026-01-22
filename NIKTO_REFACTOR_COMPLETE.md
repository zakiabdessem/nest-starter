# Nikto CSV-based Refactor - Implementation Complete

## Summary

Successfully refactored the Nikto vulnerability scanner to use CSV output format with proper URL parsing, structured data storage, and enhanced UI display.

## What Changed

### Backend

**1. Configuration ([config/scanner.config.ts](config/scanner.config.ts))**
- Increased timeout from 60 seconds to 600 seconds (10 minutes)
- Added `tempDir: '/tmp/nikto-scans'` for CSV file storage

**2. DTOs ([src/scanner/dtos/scan-result.dto.ts](src/scanner/dtos/scan-result.dto.ts))**
- Added `VulnerabilityResult` interface with structured fields:
  - `hostname`, `ip`, `port`
  - `referenceUrl`, `method`, `path`
  - `description`
- Changed `vulnerabilities` from `string[]` to `VulnerabilityResult[]`

**3. Nikto Scanner Service ([src/scanner/services/nikto-scanner.service.ts](src/scanner/services/nikto-scanner.service.ts))**

Complete rewrite with three main improvements:

**Command Building:**
```typescript
buildCommand(url: string, csvPath: string)
```
- Parses URL to extract hostname, port, and protocol
- Adds `-ssl` flag for HTTPS URLs
- Formats as: `nikto -h hostname:port [-ssl] -Tuning 1,2,3,4 -maxtime 300 -output file.csv -Format csv`
- Returns both command and cleanup file path

**CSV Parsing:**
```typescript
parseCsvFile(csvPath: string): Promise<VulnerabilityResult[]>
```
- Reads CSV file from disk
- Parses quoted fields correctly
- Skips version headers and server info rows
- Extracts only vulnerability records (7 columns with description)
- Returns structured `VulnerabilityResult[]` objects

**Scan Orchestration:**
```typescript
async scan(url: string): Promise<VulnerabilityResult[]>
```
- Creates temp directory if needed
- Executes Nikto with CSV output
- Parses CSV file
- **Always** cleans up temp file (even on error)
- Returns partial results if scan times out but CSV exists

**4. Scanner Service ([src/scanner/services/scanner.service.ts](src/scanner/services/scanner.service.ts))**
- Updated `mapToDto` to parse `VulnerabilityResult[]` from JSON
- Added `VulnerabilityResult` import

**5. Unit Tests ([src/scanner/services/nikto-scanner.service.spec.ts](src/scanner/services/nikto-scanner.service.spec.ts))**

New comprehensive test suite covering:
- Command building for HTTP and HTTPS
- Default port handling (80 for HTTP, 443 for HTTPS)
- SSL flag addition for HTTPS
- CSV line parsing with quoted fields
- CSV file parsing with vulnerability extraction
- Scan execution with cleanup
- Partial result handling on timeout
- Error handling

### Frontend

**1. Hooks ([client/lib/hooks/useScanner.ts](client/lib/hooks/useScanner.ts))**
- Added `VulnerabilityResult` interface matching backend
- Changed `vulnerabilities` type from `string[]` to `VulnerabilityResult[]`

**2. UI ([client/components/ScanResults.tsx](client/components/ScanResults.tsx))**

Enhanced vulnerability display:
- Shows description as primary text (bold)
- Displays HTTP method and path below
- Clickable "Learn more" link if `referenceUrl` exists
- Opens reference in new tab with `target="_blank" rel="noopener noreferrer"`
- Maintains warning alert style with proper spacing

## Command Format

### Before (Broken)
```bash
nikto -h http://example.com:80 -Tuning 1,2,3,4 -maxtime 300 -Format txt
```
**Issues:**
- Full URL with protocol confuses Nikto
- `-Format txt` requires `-output` file
- No SSL flag for HTTPS

### After (Fixed)
```bash
# HTTP
nikto -h example.com:80 -Tuning 1,2,3,4 -maxtime 300 -output /tmp/nikto-scans/nikto-1234567890.csv -Format csv

# HTTPS
nikto -h example.com:443 -ssl -Tuning 1,2,3,4 -maxtime 300 -output /tmp/nikto-scans/nikto-1234567890.csv -Format csv
```

## CSV Format Example

```csv
"Nikto - v2.5.0/"
"example.com","104.18.27.120","443","","","","cloudflare"
"example.com","104.18.27.120","443","https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options","GET","/","The anti-clickjacking X-Frame-Options header is not present."
"example.com","104.18.27.120","443","https://www.netsparker.com/web-vulnerability-scanner/vulnerabilities/missing-content-type-header/","GET","/","The X-Content-Type-Options header is not set."
```

**Parsing Logic:**
- Skip lines with "Nikto - v" (version headers)
- Skip rows with empty descriptions (server info)
- Extract 7 columns: hostname, IP, port, referenceUrl, method, path, description

## Database Schema

No changes needed - `vulnerabilities` column already exists as `text` type, storing JSON.

**Example stored data:**
```json
[
  {
    "hostname": "example.com",
    "ip": "104.18.27.120",
    "port": "443",
    "referenceUrl": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options",
    "method": "GET",
    "path": "/",
    "description": "The anti-clickjacking X-Frame-Options header is not present."
  }
]
```

## File Changes

### Modified
- `config/scanner.config.ts` - Added tempDir, increased timeout
- `src/scanner/dtos/scan-result.dto.ts` - Added VulnerabilityResult interface
- `src/scanner/services/nikto-scanner.service.ts` - Complete rewrite
- `src/scanner/services/nikto-scanner.service.spec.ts` - New test suite
- `src/scanner/services/scanner.service.ts` - Updated mapper type
- `client/lib/hooks/useScanner.ts` - Added VulnerabilityResult interface
- `client/components/ScanResults.tsx` - Enhanced vulnerability display

### Created
- `NIKTO_REFACTOR_COMPLETE.md` - This documentation

## Testing Instructions

### 1. Start Services
```bash
# Start Docker containers (Redis + PostgreSQL)
docker-compose up -d

# Start backend
npm run start:dev

# Start client (in separate terminal)
cd client && npm run dev
```

### 2. Test HTTP Scan
```bash
# Open browser: http://localhost:3001
# Target: http://testphp.vulnweb.com/
# Expected: Vulnerabilities found and displayed
```

### 3. Test HTTPS Scan
```bash
# Target: https://example.com
# Expected: Vulnerabilities with SSL findings displayed
```

### 4. Verify CSV Cleanup
```bash
# After scan completes
ls /tmp/nikto-scans/
# Should be empty (temp files cleaned up)
```

### 5. Check Database
```bash
# Use pgAdmin or psql
SELECT id, target, vulnerabilities FROM scans ORDER BY created_at DESC LIMIT 1;
# Should show structured JSON with all fields
```

## Benefits

1. **Reliability**: CSV parsing is more robust than stdout text parsing
2. **Structured Data**: Rich vulnerability information (not just descriptions)
3. **User Experience**: Clickable reference links, HTTP method/path context
4. **Correctness**: Proper hostname/port/SSL handling matches Nikto expectations
5. **Cleanup**: Automatic temp file removal prevents disk bloat
6. **Resilience**: Partial results on timeout instead of total failure

## Known Limitations

1. **Temp Directory**: Must have write access to `/tmp/nikto-scans/`
2. **Nikto Required**: Must have Nikto installed on system
3. **Disk Space**: CSV files temporarily consume disk (cleaned up after)
4. **Timeout**: 10-minute max per scan (configurable in config)

## Next Steps (Optional)

1. **Severity Classification**: Parse vulnerability descriptions to assign severity levels
2. **Filtering**: Add UI filters for severity, type, or HTTP method
3. **Export**: Download vulnerability reports as PDF or CSV
4. **Historical Tracking**: Compare scans over time to track remediation
5. **Additional Scanners**: Integrate testssl.sh, WhatWeb, or Nuclei

---

**Status**: ✅ Fully implemented and ready for testing
**Test Commands**: See Testing Instructions above
**Documentation**: This file + inline code comments

All implementation todos completed! 🎉
