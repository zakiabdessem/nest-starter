import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Scan } from '../entities/scan.entity';
import { CreateScanDto } from '../dtos/create-scan.dto';
import { ScanResultDto, PortScanResult, VulnerabilityResult } from '../dtos/scan-result.dto';
import { SCANNER_CONFIG } from '../../../config/scanner.config';

@Injectable()
export class ScannerService {
  constructor(
    @InjectRepository(Scan)
    private readonly scanRepository: Repository<Scan>,
    @InjectQueue('scan-queue')
    private readonly scanQueue: Queue,
  ) {}

  /**
   * Create a new scan and add it to the queue
   */
  async createScan(createScanDto: CreateScanDto): Promise<ScanResultDto> {
    // Create scan record
    const scan = this.scanRepository.create({
      target: createScanDto.target,
      status: 'pending',
    });

    const savedScan = await this.scanRepository.save(scan);

    // Add job to queue
    await this.scanQueue.add(
      'scan',
      { scanId: savedScan.id },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: SCANNER_CONFIG.timeoutBackoff_nmap,
        },
      },
    );

    return this.mapToDto(savedScan);
  }

  /**
   * Get scan by ID
   */
  async getScan(id: string): Promise<ScanResultDto> {
    const scan = await this.scanRepository.findOne({ where: { id } });

    if (!scan) {
      throw new Error('Scan not found');
    }

    return this.mapToDto(scan);
  }

  /**
   * Get all scans
   */
  async getAllScans(): Promise<ScanResultDto[]> {
    const scans = await this.scanRepository.find({
      order: { createdAt: 'DESC' },
    });

    return scans.map((scan) => this.mapToDto(scan));
  }

  /**
   * Map entity to DTO
   */
  private mapToDto(scan: Scan): ScanResultDto {
    let ports: PortScanResult[] = [];
    let vulnerabilities: VulnerabilityResult[] = [];

    if (scan.ports) {
      try {
        ports = JSON.parse(scan.ports);
      } catch (error) {
        // If parsing fails, return empty array
        ports = [];
      }
    }

    if (scan.vulnerabilities) {
      try {
        vulnerabilities = JSON.parse(scan.vulnerabilities);
      } catch (error) {
        // If parsing fails, return empty array
        vulnerabilities = [];
      }
    }

    return {
      id: scan.id,
      target: scan.target,
      resolvedIp: scan.resolvedIp,
      ports,
      vulnerabilities,
      status: scan.status,
      error: scan.error,
      createdAt: scan.createdAt,
      completedAt: scan.completedAt,
    };
  }
}
