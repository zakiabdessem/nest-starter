import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SCANNER_CONFIG } from '../../../config/scanner.config';

const execAsync = promisify(exec);

export interface NucleiResult {
  templateID: string;
  name: string;
  severity: string;
  description: string;
  matchedAt: string;
  category: string;
  extractedResults?: string[];
  reference?: string[];
  tags?: string[];
  type?: string;
}

export interface NucleiScanResult {
  category: string;
  findings: NucleiResult[];
  error?: string;
}

@Injectable()
export class NucleiScannerService {
  /**
   * Build Nuclei command for a specific category and severity filters
   */
  buildCommand(
    target: string,
    category: string,
    severities: string[],
    outputPath: string,
  ): string {
    const config = SCANNER_CONFIG.nucleiOptions;
    const categoryConfig = config.categories[category];

    if (!categoryConfig) {
      throw new Error(`Unknown category: ${category}`);
    }

    // Build base command
    let command = `nuclei -u ${target}`;

    // Add category template selection
    if (categoryConfig.useTag) {
      command += ` -tags ${categoryConfig.tag}`;
    } else {
      command += ` -t ${categoryConfig.templatePath}`;
    }

    // Add severity filter if provided
    if (severities && severities.length > 0) {
      command += ` -severity ${severities.join(',')}`;
    }

    // Add rate limiting
    command += ` -rl ${config.rateLimit}`;

    // Add timeout
    command += ` -timeout ${config.requestTimeout}`;

    // Add JSON Lines output (one JSON object per line)
    command += ` -jsonl -o ${outputPath}`;

    // Add silent flag to reduce noise
    command += ` -silent`;

    return command;
  }

  /**
   * Parse Nuclei JSON output file
   */
  async parseJsonOutput(outputPath: string, category: string): Promise<NucleiResult[]> {
    try {
      const content = await fs.readFile(outputPath, 'utf-8');
      
      if (!content.trim()) {
        return [];
      }

      // Nuclei outputs one JSON object per line
      const lines = content.trim().split('\n');
      const results: NucleiResult[] = [];

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          
          results.push({
            templateID: parsed['template-id'] || parsed.templateID || 'unknown',
            name: parsed.info?.name || parsed.name || 'Unknown',
            severity: parsed.info?.severity || parsed.severity || 'info',
            description: parsed.info?.description || parsed.description || '',
            matchedAt: parsed['matched-at'] || parsed.matchedAt || parsed.host || '',
            category,
            extractedResults: parsed['extracted-results'] || parsed.extractedResults || [],
            reference: parsed.info?.reference || parsed.reference || [],
            tags: parsed.info?.tags || parsed.tags || [],
            type: parsed.type || 'unknown',
          });
        } catch (err) {
          console.warn(`Failed to parse line: ${line}`, err);
        }
      }

      return results;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, no results found
        return [];
      }
      throw error;
    }
  }

  /**
   * Execute Nuclei scan for a specific category
   */
  async scanCategory(
    target: string,
    category: string,
    severities: string[],
  ): Promise<NucleiScanResult> {
    const config = SCANNER_CONFIG.nucleiOptions;
    const timestamp = Date.now();
    const outputPath = path.join(config.outputDir, `nuclei-${category}-${timestamp}.json`);

    // Ensure output directory exists
    await fs.mkdir(config.outputDir, { recursive: true });

    try {
      const command = this.buildCommand(target, category, severities, outputPath);
      
      console.log(`Executing Nuclei scan for ${category}: ${command}`);

      await execAsync(command, {
        timeout: config.timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
      });

      const findings = await this.parseJsonOutput(outputPath, category);

      return {
        category,
        findings,
      };
    } catch (error) {
      console.error(`Nuclei scan failed for category ${category}:`, error.message);
      
      // Try to parse partial results even if scan failed
      try {
        const findings = await this.parseJsonOutput(outputPath, category);
        return {
          category,
          findings,
          error: error.message,
        };
      } catch (parseError) {
        return {
          category,
          findings: [],
          error: error.message,
        };
      }
    } finally {
      // Cleanup temp file
      try {
        await fs.unlink(outputPath);
      } catch (e) {
        console.warn(`Failed to delete temp file: ${outputPath}`, e);
      }
    }
  }

  /**
   * Execute Nuclei scans in parallel for multiple categories
   */
  async scan(
    target: string,
    categories: string[],
    severities: string[],
  ): Promise<NucleiScanResult[]> {
    console.log(`Starting Nuclei scans for categories: ${categories.join(', ')}`);
    console.log(`Severity filters: ${severities.join(', ')}`);

    // Execute all category scans in parallel
    const scanPromises = categories.map((category) =>
      this.scanCategory(target, category, severities)
    );

    const results = await Promise.allSettled(scanPromises);

    // Extract results from settled promises
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          category: categories[index],
          findings: [],
          error: result.reason?.message || 'Unknown error',
        };
      }
    });
  }
}
