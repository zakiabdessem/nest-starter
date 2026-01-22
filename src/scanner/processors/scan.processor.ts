import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Scan } from '../entities/scan.entity';
import { DnsResolverService } from '../services/dns-resolver.service';
import { NmapScannerService } from '../services/nmap-scanner.service';
import { NiktoScannerService } from '../services/nikto-scanner.service';
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

      // Step 4: Run vulnerability scan if web ports found
      if (SCANNER_CONFIG.vulnerabilityScanning.enabled) {
        const webPorts = portResults.filter((p) =>
          SCANNER_CONFIG.webPorts.includes(p.port),
        );

        if (
          webPorts.length > 0 &&
          (!SCANNER_CONFIG.vulnerabilityScanning.skipIfNoWebPorts ||
            webPorts.length <= SCANNER_CONFIG.vulnerabilityScanning.maxPortsToScan)
        ) {
          this.gateway.emitScanUpdate(scanId, 'vulnerability-scan-started', {
            scanId,
            portsToScan: webPorts.length,
          });

          const allVulnerabilities = [];
          for (const port of webPorts) {
            try {
              const protocol = port.port === 443 || port.port === 8443 ? 'https' : 'http';
              
              // Use original target hostname, not resolved IP
              // Nikto needs hostname for proper Host headers and SNI
              const targetHost = scan.target.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
              const url = port.port === 80 || port.port === 443 
                ? `${protocol}://${targetHost}`
                : `${protocol}://${targetHost}:${port.port}`;
              
              const findings = await this.niktoScanner.scan(url);
              allVulnerabilities.push(...findings);
            } catch (error) {
              // Log error but continue with other ports
              console.error(`Nikto scan failed for port ${port.port}:`, error.message);
            }
          }

          scan.vulnerabilities = JSON.stringify(allVulnerabilities);
          await this.scanRepository.save(scan);

          this.gateway.emitScanUpdate(scanId, 'vulnerability-scan-complete', {
            scanId,
            vulnerabilitiesFound: allVulnerabilities.length,
          });
        }
      }

      // Step 5: Mark scan as completed
      scan.status = 'completed';
      scan.completedAt = new Date();
      await this.scanRepository.save(scan);

      // Emit scan complete with vulnerabilities
      this.gateway.emitScanUpdate(scanId, 'scan-complete', {
        scanId,
        status: 'completed',
        resolvedIp,
        ports: portResults,
        vulnerabilities: scan.vulnerabilities ? JSON.parse(scan.vulnerabilities) : [],
        completedAt: scan.completedAt,
      });
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
}
