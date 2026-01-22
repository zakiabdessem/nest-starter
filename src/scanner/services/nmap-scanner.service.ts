import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SCANNER_CONFIG } from '../../../config/scanner.config';
import { PortScanResult } from '../dtos/scan-result.dto';

const execAsync = promisify(exec);

@Injectable()
export class NmapScannerService {
  /**
   * Build nmap command with specified IP and ports
   */
  buildCommand(ip: string, ports?: number[]): string {
    const portsToScan = ports || SCANNER_CONFIG.defaultPorts;
    const portList = portsToScan.join(',');

    const { scanType, timing, openOnly } = SCANNER_CONFIG.nmapOptions;

    return `sudo nmap ${scanType} ${timing} ${openOnly} -p ${portList} ${ip}`;
  }

  /**
   * Parse nmap output to extract open ports
   * Based on logic from test-nmap-parse.js
   */
  parseOutput(output: string): PortScanResult[] {
    const lines = output.split('\n');
    const results: PortScanResult[] = [];
    let parsingPorts = false;

    for (const line of lines) {
      // Detect table header (PORT STATE SERVICE)
      if (line.startsWith('PORT')) {
        parsingPorts = true;
        continue;
      }

      // Stop if table ended (empty line after ports)
      if (parsingPorts && line.trim() === '') {
        parsingPorts = false;
        break;
      }

      if (!parsingPorts) continue;

      // Parse line format: "80/tcp open http"
      const parts = line.trim().split(/\s+/);

      if (parts.length >= 3) {
        const [portProto, state, service] = parts;
        const [portStr, protocol] = portProto.split('/');

        const port = Number(portStr);
        if (!isNaN(port)) {
          results.push({
            port,
            protocol,
            state,
            service,
          });
        }
      }
    }

    return results;
  }

  /**
   * Execute nmap scan on target IP
   */
  async scan(ip: string, ports?: number[]): Promise<PortScanResult[]> {
    const command = this.buildCommand(ip, ports);

    try {
      const { stdout } = await execAsync(command, {
        timeout: SCANNER_CONFIG.timeout_nmap,
      });

      return this.parseOutput(stdout);
    } catch (error) {
      throw new Error(`Nmap scan failed: ${error.message}`);
    }
  }
}
