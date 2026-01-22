import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import * as path from 'path';
import { SCANNER_CONFIG } from '../../../config/scanner.config';
import { VulnerabilityResult } from '../dtos/scan-result.dto';

const execAsync = promisify(exec);

@Injectable()
export class NiktoScannerService {
  /**
   * Build Nikto command with specified URL and CSV output path
   */
  buildCommand(url: string, csvPath: string): { command: string; cleanupFile: string } {
    const { tuning, maxTime } = SCANNER_CONFIG.niktoOptions;

    // Parse URL to extract hostname, port, and SSL flag
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const port = urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80');
    const ssl = urlObj.protocol === 'https:' ? '-ssl' : '';
    
    // For default ports (80 for HTTP, 443 for HTTPS), omit the :port
    // Only include :port for non-standard ports
    const isDefaultPort = (urlObj.protocol === 'http:' && port === '80') || 
                         (urlObj.protocol === 'https:' && port === '443');
    const hostPart = isDefaultPort ? hostname : `${hostname}:${port}`;

    // Build command: nikto -h hostname[:port] [-ssl] -Tuning X -maxtime Y -output file.csv -Format csv
    const command = `nikto -h ${hostPart} ${ssl} -Tuning ${tuning} -maxtime ${maxTime} -output ${csvPath} -Format csv`.replace(/\s+/g, ' ').trim();

    return { command, cleanupFile: csvPath };
  }

  /**
   * Parse a single CSV line, handling quoted fields
   */
  parseCsvLine(line: string): string[] {
    const regex = /"([^"]*)"/g;
    const columns: string[] = [];
    let match;
    while ((match = regex.exec(line)) !== null) {
      columns.push(match[1]);
    }
    return columns;
  }

  /**
   * Parse Nikto CSV file and extract structured vulnerability data
   */
  async parseCsvFile(csvPath: string): Promise<VulnerabilityResult[]> {
    const csvContent = await fs.readFile(csvPath, 'utf-8');
    const lines = csvContent.split('\n');
    const vulnerabilities: VulnerabilityResult[] = [];

    for (const line of lines) {
      // Skip empty lines and version headers
      if (!line.trim() || line.includes('Nikto - v')) {
        continue;
      }

      const columns = this.parseCsvLine(line);

      // Valid vulnerability rows have 7 columns with a description in the last column
      // AND must have either a referenceUrl OR both method and path (skip server info rows)
      if (columns.length === 7 && columns[6]) {
        const hasReferenceUrl = columns[3] && columns[3].trim().length > 0;
        const hasMethodAndPath = (columns[4] && columns[4].trim().length > 0) && 
                                 (columns[5] && columns[5].trim().length > 0);
        
        if (hasReferenceUrl || hasMethodAndPath) {
          vulnerabilities.push({
            hostname: columns[0],
            ip: columns[1],
            port: columns[2],
            referenceUrl: columns[3] || undefined,
            method: columns[4] || undefined,
            path: columns[5] || undefined,
            description: columns[6],
          });
        }
      }
    }

    return vulnerabilities;
  }

  /**
   * Execute Nikto scan on target URL and return structured vulnerability data
   */
  async scan(url: string): Promise<VulnerabilityResult[]> {
    const tempDir = SCANNER_CONFIG.niktoOptions.tempDir;
    const csvPath = path.join(tempDir, `nikto-${Date.now()}.csv`);

    // Ensure temp directory exists
    await fs.mkdir(tempDir, { recursive: true });

    const { command, cleanupFile } = this.buildCommand(url, csvPath);

    try {
      // Execute Nikto with CSV output
      await execAsync(command, {
        timeout: SCANNER_CONFIG.niktoOptions.timeout,
      });

      // Parse the CSV file
      const results = await this.parseCsvFile(csvPath);

      return results;
    } catch (error) {
      // Try to parse partial results even if command failed
      try {
        const partialResults = await this.parseCsvFile(csvPath);
        if (partialResults.length > 0) {
          return partialResults;
        }
      } catch (parseError) {
        // Ignore parse errors, throw original error
      }

      throw new Error(`Nikto scan failed: ${error.message}`);
    } finally {
      // Always cleanup temp file
      try {
        await fs.unlink(cleanupFile);
      } catch (e) {
        console.warn(`Failed to delete temp CSV: ${cleanupFile}`);
      }
    }
  }
}
