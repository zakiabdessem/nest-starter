import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Scan } from '../entities/scan.entity';
import { DnsResolverService } from '../services/dns-resolver.service';
import { NmapScannerService } from '../services/nmap-scanner.service';
import { NiktoScannerService } from '../services/nikto-scanner.service';
import { NucleiScannerService } from '../services/nuclei-scanner.service';
import { ScannerGateway } from '../gateways/scanner.gateway';
import { SCANNER_CONFIG } from '../../../config/scanner.config';

@Processor('scan-queue')
@Injectable()
export class ScanProcessor extends WorkerHost {
  constructor(
    @InjectRepository(Scan)
    private readonly scanRepository: Repository<Scan>,
    private readonly dnsResolver: DnsResolverService,
    private readonly nmapScanner: NmapScannerService,
    private readonly niktoScanner: NiktoScannerService,
    private readonly nucleiScanner: NucleiScannerService,
    private readonly gateway: ScannerGateway,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    return this.processScan(job);
  }

  /**
   * Process scan job
   */
  async processScan(job: Job): Promise<void> {
    const { scanId } = job.data;

    try {
      // Find scan record
      const scan = await this.scanRepository.findOne({
        where: { id: scanId },
      });

      if (!scan) {
        throw new Error('Scan not found');
      }

      // Update status to processing
      scan.status = 'processing';
      await this.scanRepository.save(scan);

      // Emit scan started
      this.gateway.emitScanUpdate(scanId, 'scan-started', {
        scanId,
        target: scan.target,
        status: 'processing',
      });

      // Step 1: Resolve DNS (if not IP)
      let resolvedIp: string;
      try {
        resolvedIp = await this.dnsResolver.resolve(scan.target);
        scan.resolvedIp = resolvedIp;
        await this.scanRepository.save(scan);

        // Emit DNS resolved
        this.gateway.emitScanUpdate(scanId, 'dns-resolved', {
          scanId,
          resolvedIp,
        });
      } catch (error) {
        throw new Error(`DNS resolution failed: ${error.message}`);
      }

      // Emit scanning ports
      this.gateway.emitScanUpdate(scanId, 'scanning-ports', {
        scanId,
        resolvedIp,
      });

      // Step 2: Run Nmap scan
      let portResults;
      try {
        portResults = await this.nmapScanner.scan(resolvedIp);
      } catch (error) {
        throw new Error(`Nmap scan failed: ${error.message}`);
      }

      // Step 3: Save port results
      scan.ports = JSON.stringify(portResults);
      await this.scanRepository.save(scan);

      // Step 4: Run vulnerability scan based on scan type
      if (scan.scanType === 'heavy') {
        // Heavy scan: Use Nuclei
        await this.runHeavyScan(scan, scanId, portResults);
      } else {
        // Quick scan: Use Nikto if web ports found
        await this.runQuickScan(scan, scanId, portResults);
      }

      // Step 5: Mark scan as completed
      scan.status = 'completed';
      scan.completedAt = new Date();
      await this.scanRepository.save(scan);

      // Emit scan complete with appropriate results
      const completeData: any = {
        scanId,
        status: 'completed',
        resolvedIp,
        ports: portResults,
        completedAt: scan.completedAt,
      };

      if (scan.scanType === 'heavy') {
        completeData.nucleiResults = scan.nucleiResults ? JSON.parse(scan.nucleiResults) : [];
      } else {
        completeData.vulnerabilities = scan.vulnerabilities ? JSON.parse(scan.vulnerabilities) : [];
      }

      this.gateway.emitScanComplete(scanId, completeData);
    } catch (error) {
      // Handle error
      const scan = await this.scanRepository.findOne({
        where: { id: scanId },
      });

      if (scan) {
        scan.status = 'failed';
        scan.error = error.message;
        scan.completedAt = new Date();
        await this.scanRepository.save(scan);

        // Emit scan failed
        this.gateway.emitScanUpdate(scanId, 'scan-failed', {
          scanId,
          status: 'failed',
          error: error.message,
        });
      }

      throw error;
    }
  }

  /**
   * Run quick scan with Nikto
   */
  private async runQuickScan(scan: Scan, scanId: string, portResults: any[]) {
    if (!SCANNER_CONFIG.vulnerabilityScanning.enabled) {
      return;
    }

    const webPorts = portResults.filter((p) =>
      SCANNER_CONFIG.webPorts.includes(p.port),
    );

    if (
      webPorts.length > 0 &&
      (!SCANNER_CONFIG.vulnerabilityScanning.skipIfNoWebPorts ||
        webPorts.length <= SCANNER_CONFIG.vulnerabilityScanning.maxPortsToScan)
    ) {
      this.gateway.emitVulnerabilityScanStarted(scanId, {
        scanId,
        portsToScan: webPorts.length,
      });

      const allVulnerabilities = [];
      for (const port of webPorts) {
        try {
          const protocol = port.port === 443 || port.port === 8443 ? 'https' : 'http';
          
          // Use original target hostname, not resolved IP
          const targetHost = scan.target.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
          const url = port.port === 80 || port.port === 443 
            ? `${protocol}://${targetHost}`
            : `${protocol}://${targetHost}:${port.port}`;
          
          const findings = await this.niktoScanner.scan(url);
          allVulnerabilities.push(...findings);
        } catch (error) {
          console.error(`Nikto scan failed for port ${port.port}:`, error.message);
        }
      }

      scan.vulnerabilities = JSON.stringify(allVulnerabilities);
      await this.scanRepository.save(scan);

      this.gateway.emitVulnerabilityScanComplete(scanId, {
        scanId,
        vulnerabilitiesFound: allVulnerabilities.length,
      });
    }
  }

  /**
   * Run heavy scan with Nuclei
   */
  private async runHeavyScan(scan: Scan, scanId: string, portResults: any[]) {
    // Parse heavy scan options
    let categories: string[] = [];
    let severities: string[] = [];

    if (scan.heavyScanOptions) {
      try {
        const options = JSON.parse(scan.heavyScanOptions);
        categories = options.categories || [];
        severities = options.severities || [];
      } catch (error) {
        console.error('Failed to parse heavy scan options:', error);
        return;
      }
    }

    if (categories.length === 0) {
      console.log('No categories selected for heavy scan, skipping Nuclei');
      return;
    }

    // Use first web port or construct URL from target
    const webPorts = portResults.filter((p) =>
      SCANNER_CONFIG.webPorts.includes(p.port),
    );

    let targetUrl = scan.target;
    
    // If target doesn't have a protocol and we found web ports, construct URL
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      const protocol = webPorts.some(p => p.port === 443 || p.port === 8443) ? 'https' : 'http';
      targetUrl = `${protocol}://${targetUrl}`;
    }

    this.gateway.emitHeavyScanStarted(scanId, {
      scanId,
      categories,
      severities,
      targetUrl,
    });

    // Run Nuclei scans in parallel
    const nucleiResults = await this.nucleiScanner.scan(targetUrl, categories, severities);

    // Emit progress for each category
    for (const result of nucleiResults) {
      this.gateway.emitCategoryScanComplete(scanId, {
        scanId,
        category: result.category,
        findingsCount: result.findings.length,
        error: result.error,
      });
    }

    // Save results
    scan.nucleiResults = JSON.stringify(nucleiResults);
    await this.scanRepository.save(scan);

    const totalFindings = nucleiResults.reduce((sum, r) => sum + r.findings.length, 0);
    this.gateway.emitHeavyScanComplete(scanId, {
      scanId,
      totalFindings,
      categoriesScanned: nucleiResults.length,
    });
  }
}
