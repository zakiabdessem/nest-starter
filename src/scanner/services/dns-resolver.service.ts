import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class DnsResolverService {
  /**
   * Parse target to extract domain/hostname
   * Removes protocol (http://, https://) and path
   */
  parseTarget(target: string): string {
    let parsed = target;

    // Remove protocol
    parsed = parsed.replace(/^https?:\/\//, '');

    // Remove path (everything after first /)
    const slashIndex = parsed.indexOf('/');
    if (slashIndex !== -1) {
      parsed = parsed.substring(0, slashIndex);
    }

    return parsed;
  }

  /**
   * Check if target is already an IP address
   */
  isIpAddress(target: string): boolean {
    const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = target.match(ipRegex);

    if (!match) {
      return false;
    }

    // Validate each octet is 0-255
    for (let i = 1; i <= 4; i++) {
      const octet = parseInt(match[i], 10);
      if (octet < 0 || octet > 255) {
        return false;
      }
    }

    return true;
  }

  /**
   * Resolve domain to IP address using nslookup
   * If target is already an IP, return it as-is
   */
  async resolve(target: string): Promise<string> {
    const parsed = this.parseTarget(target);

    // If already an IP, return it
    if (this.isIpAddress(parsed)) {
      return parsed;
    }

    try {
      const { stdout } = await execAsync(`nslookup ${parsed}`);

      // Extract target IP address (not DNS server IP)
      // Look for "Address: <IP>" that comes after "Name:"
      const lines = stdout.split('\n');
      let foundName = false;

      for (const line of lines) {
        if (line.includes('Name:')) {
          foundName = true;
          continue;
        }

        if (foundName && line.includes('Address:')) {
          const match = line.match(/Address:\s*(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
          if (match) {
            return match[1];
          }
        }
      }

      // Alternative parsing: just find any Address line with valid IP (not DNS server)
      const addressMatch = stdout.match(/Address:\s*(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g);
      if (addressMatch && addressMatch.length > 1) {
        // First match is usually DNS server, second is target
        const ipMatch = addressMatch[1].match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
        if (ipMatch) {
          return ipMatch[1];
        }
      }

      throw new Error('Could not resolve IP address from nslookup output');
    } catch (error) {
      throw new Error(
        `DNS resolution failed for ${parsed}: ${error.message}`,
      );
    }
  }
}
