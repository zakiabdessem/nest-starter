# Nuclei Scanner Commands Reference

## Basic Scanning Commands

### 1. CVE Scanning (Most Common)
```bash
# Scan single URL for CVEs
nuclei -u http://example.com -tags cves -o nuclei-results/cves.json

# Scan with JSON output
nuclei -u http://example.com -tags cves -o nuclei-results/cves.json -json

# Scan with verbose output
nuclei -u http://example.com -tags cves -o nuclei-results/cves.json -v
```

### 2. Multiple Target Scanning
```bash
# Scan from file
nuclei -l targets.txt -tags cves -o nuclei-results/cves.json

# Scan multiple URLs
echo "http://example.com\nhttp://test.com" | nuclei -tags cves -o nuclei-results/cves.json
```

### 3. Template Selection

#### By Tags
```bash
# CVEs only
nuclei -u http://example.com -tags cves -o nuclei-results/cves.json

# All vulnerabilities
nuclei -u http://example.com -tags vulnerability -o nuclei-results/vulns.json

# Specific severity
nuclei -u http://example.com -tags cves,severity:high -o nuclei-results/high-cves.json

# Multiple tags
nuclei -u http://example.com -tags cves,severity:critical -o nuclei-results/critical.json
```

#### By Template Path
```bash
# Specific template directory
nuclei -u http://example.com -t ~/.local/nuclei-templates/http/cves/ -o nuclei-results/cves.json

# Single template file
nuclei -u http://example.com -t ~/.local/nuclei-templates/http/cves/2023/CVE-2023-XXXX.yaml -o nuclei-results/specific.json

# Multiple template paths
nuclei -u http://example.com -t ~/.local/nuclei-templates/http/cves/ -t ~/.local/nuclei-templates/http/vulnerabilities/ -o nuclei-results/all.json
```

### 4. Output Formats

#### JSON (Structured)
```bashnuclei -u
nuclei -u http://example.com -tags cves -o nuclei-results/cves.json -json
```

#### CSV (Spreadsheet)
```bash
nuclei -u http://example.com -tags cves -o nuclei-results/cves.csv -csv
```

#### Markdown (Documentation)
```bash
nuclei -u http://example.com -tags cves -o nuclei-results/cves.md -markdown
```

#### SARIF (Security Tools)
```bash
nuclei -u http://example.com -tags cves -o nuclei-results/cves.sarif -sarif
```

### 5. Performance & Rate Limiting

#### Rate Limiting
```bash
# Limit requests per second
nuclei -u http://example.com -tags cves -rl 10 -o nuclei-results/cves.json

# Limit concurrent requests
nuclei -u http://example.com -tags cves -c 5 -o nuclei-results/cves.json
```

#### Timeouts
```bash
# Request timeout
nuclei -u http://example.com -tags cves -timeout 10 -o nuclei-results/cves.json

# Retry failed requests
nuclei -u http://example.com -tags cves -retries 3 -o nuclei-results/cves.json
```

### 6. Filtering & Exclusion

#### Exclude Tags
```bash
# Exclude specific tags
nuclei -u http://example.com -tags cves -etags dos,local -o nuclei-results/cves.json
```

#### Severity Filtering
```bash
# Only high/critical
nuclei -u http://example.com -tags cves -s high,critical -o nuclei-results/critical.json

# Exclude info severity
nuclei -u http://example.com -tags cves -es info -o nuclei-results/cves.json
```

#### Author Filtering
```bash
# Templates by specific author
nuclei -u http://example.com -tags cves -author geeknik -o nuclei-results/cves.json
```

### 7. Authentication & Headers

#### Custom Headers
```bash
# Single header
nuclei -u http://example.com -tags cves -H "X-API-Key: your-key" -o nuclei-results/cves.json

# Multiple headers
nuclei -u http://example.com -tags cves -H "Authorization: Bearer token" -H "X-Custom: value" -o nuclei-results/cves.json
```

#### Authentication
```bash
# Basic auth
nuclei -u http://example.com -tags cves -basic-auth "user:pass" -o nuclei-results/cves.json

# Bearer token
nuclei -u http://example.com -tags cves -H "Authorization: Bearer token" -o nuclei-results/cves.json
```

### 8. Validation & Testing

#### Validate Templates
```bash
# Validate all templates
nuclei -validate

# Validate specific template
nuclei -t ~/.local/nuclei-templates/http/cves/2023/CVE-2023-XXXX.yaml -validate
```

#### Dry Run (No Requests)
```bash
# List templates that would run
nuclei -u http://example.com -tags cves -dry-run
```

#### Statistics
```bash
# Show scan statistics
nuclei -u http://example.com -tags cves -stats -o nuclei-results/cves.json
```

### 9. Advanced Options

#### Custom Matchers
```bash
# Custom matcher file
nuclei -u http://example.com -tags cves -matchers-path custom-matchers.yaml -o nuclei-results/cves.json
```

#### Proxy
```bash
# HTTP proxy
nuclei -u http://example.com -tags cves -proxy http://127.0.0.1:8080 -o nuclei-results/cves.json

# SOCKS proxy
nuclei -u http://example.com -tags cves -proxy socks5://127.0.0.1:1080 -o nuclei-results/cves.json
```

#### Custom User Agent
```bash
nuclei -u http://example.com -tags cves -H "User-Agent: Custom-Scanner/1.0" -o nuclei-results/cves.json
```

### 10. Template Management

#### Update Templates
```bash
# Update all templates
nuclei -update-templates

# Update specific template
nuclei -update-templates -t ~/.local/nuclei-templates/http/cves/
```

#### List Templates
```bash
# List all templates
nuclei -tl

# List templates by tag
nuclei -tl -tags cves

# List templates by severity
nuclei -tl -s critical
```

### 11. Common Use Cases

#### Quick CVE Check
```bash
nuclei -u http://example.com -tags cves -o nuclei-results/cves.json -json -silent
```

#### Comprehensive Scan
```bash
nuclei -u http://example.com \
  -tags cves,vulnerability,exposure \
  -s high,critical \
  -o nuclei-results/full-scan.json \
  -json \
  -stats \
  -rl 20
```

#### Fast Scan (Low Impact)
```bash
nuclei -u http://example.com \
  -tags cves \
  -rl 5 \
  -c 3 \
  -timeout 5 \
  -o nuclei-results/fast-scan.json
```

#### Production Scan (Safe)
```bash
nuclei -u http://example.com \
  -tags cves \
  -rl 10 \
  -c 5 \
  -timeout 10 \
  -retries 2 \
  -H "User-Agent: Security-Scanner/1.0" \
  -o nuclei-results/production-scan.json \
  -json \
  -stats
```

### 12. Integration Examples

#### With Nmap Results
```bash
# Scan all open HTTP ports from nmap
nmap -p 80,443,8080 --open -oG - example.com | grep "open" | awk '{print $2}' | nuclei -tags cves -o nuclei-results/cves.json
```

#### Batch Processing
```bash
# Scan multiple targets from file
while read url; do
  nuclei -u "$url" -tags cves -o "nuclei-results/$(echo $url | tr '/' '_').json" -json
done < targets.txt
```

## Helper Script Usage

```bash
# Basic usage
./run-nuclei.sh http://example.com

# Custom output
./run-nuclei.sh http://example.com nuclei-results/my-scan.json
```

## Tips

1. **Always use `-json` for structured output** - Easier to parse programmatically
2. **Use `-rl` (rate limit)** - Prevents overwhelming target servers
3. **Use `-stats`** - Shows progress during long scans
4. **Use `-silent`** - Reduces output noise for automation
5. **Use `-tags` instead of `-t`** - More flexible and finds templates automatically
6. **Validate templates first** - Use `-validate` before running scans
7. **Check template count** - Use `-tl -tags cves` to see how many templates will run
