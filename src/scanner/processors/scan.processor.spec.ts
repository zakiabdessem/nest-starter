import { Test, TestingModule } from '@nestjs/testing';
import { ScanProcessor } from './scan.processor';
import { DnsResolverService } from '../services/dns-resolver.service';
import { NmapScannerService } from '../services/nmap-scanner.service';
import { NiktoScannerService } from '../services/nikto-scanner.service';
import { ScannerGateway } from '../gateways/scanner.gateway';
import { Repository } from 'typeorm';
import { Scan } from '../entities/scan.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Job } from 'bullmq';

describe('ScanProcessor', () => {
  let processor: ScanProcessor;
  let dnsResolver: DnsResolverService;
  let nmapScanner: NmapScannerService;
  let gateway: ScannerGateway;
  let scanRepository: Repository<Scan>;

  const mockScanRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockDnsResolver = {
    resolve: jest.fn(),
  };

  const mockNmapScanner = {
    scan: jest.fn(),
  };

  const mockNiktoScanner = {
    scan: jest.fn(),
  };

  const mockGateway = {
    emitScanUpdate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScanProcessor,
        {
          provide: DnsResolverService,
          useValue: mockDnsResolver,
        },
        {
          provide: NmapScannerService,
          useValue: mockNmapScanner,
        },
        {
          provide: NiktoScannerService,
          useValue: mockNiktoScanner,
        },
        {
          provide: ScannerGateway,
          useValue: mockGateway,
        },
        {
          provide: getRepositoryToken(Scan),
          useValue: mockScanRepository,
        },
      ],
    }).compile();

    processor = module.get<ScanProcessor>(ScanProcessor);
    dnsResolver = module.get<DnsResolverService>(DnsResolverService);
    nmapScanner = module.get<NmapScannerService>(NmapScannerService);
    gateway = module.get<ScannerGateway>(ScannerGateway);
    scanRepository = module.get<Repository<Scan>>(getRepositoryToken(Scan));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('processScan', () => {
    it('should process full scan flow successfully', async () => {
      const mockJob = {
        data: { scanId: 'test-scan-id' },
      } as Job;

      const mockScan = {
        id: 'test-scan-id',
        target: 'http://testphp.vulnweb.com/',
        status: 'pending',
        resolvedIp: null,
        ports: null,
      };

      const mockPorts = [
        { port: 80, protocol: 'tcp', state: 'open', service: 'http' },
        { port: 443, protocol: 'tcp', state: 'open', service: 'https' },
      ];

      mockScanRepository.findOne.mockResolvedValue(mockScan);
      mockDnsResolver.resolve.mockResolvedValue('44.228.249.3');
      mockNmapScanner.scan.mockResolvedValue(mockPorts);
      mockScanRepository.save.mockResolvedValue({
        ...mockScan,
        status: 'completed',
      });

      await processor.processScan(mockJob);

      expect(mockScanRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'test-scan-id' },
      });
      expect(mockGateway.emitScanUpdate).toHaveBeenCalledWith(
        'test-scan-id',
        'scan-started',
        expect.any(Object),
      );
      expect(mockDnsResolver.resolve).toHaveBeenCalledWith(
        'http://testphp.vulnweb.com/',
      );
      expect(mockGateway.emitScanUpdate).toHaveBeenCalledWith(
        'test-scan-id',
        'dns-resolved',
        expect.objectContaining({ resolvedIp: '44.228.249.3' }),
      );
      expect(mockNmapScanner.scan).toHaveBeenCalledWith('44.228.249.3');
      expect(mockGateway.emitScanUpdate).toHaveBeenCalledWith(
        'test-scan-id',
        'scanning-ports',
        expect.any(Object),
      );
      expect(mockScanRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          resolvedIp: '44.228.249.3',
          ports: JSON.stringify(mockPorts),
        }),
      );
      expect(mockGateway.emitScanUpdate).toHaveBeenCalledWith(
        'test-scan-id',
        'scan-complete',
        expect.objectContaining({ status: 'completed' }),
      );
    });

    it('should skip DNS resolution if target is already an IP', async () => {
      const mockJob = {
        data: { scanId: 'test-scan-id' },
      } as Job;

      const mockScan = {
        id: 'test-scan-id',
        target: '192.168.1.1',
        status: 'pending',
      };

      const mockPorts = [
        { port: 80, protocol: 'tcp', state: 'open', service: 'http' },
      ];

      mockScanRepository.findOne.mockResolvedValue(mockScan);
      mockDnsResolver.resolve.mockResolvedValue('192.168.1.1');
      mockNmapScanner.scan.mockResolvedValue(mockPorts);
      mockScanRepository.save.mockResolvedValue(mockScan);

      await processor.processScan(mockJob);

      expect(mockDnsResolver.resolve).toHaveBeenCalledWith('192.168.1.1');
      expect(mockNmapScanner.scan).toHaveBeenCalledWith('192.168.1.1');
    });

    it('should handle DNS resolution failure', async () => {
      const mockJob = {
        data: { scanId: 'test-scan-id' },
      } as Job;

      const mockScan = {
        id: 'test-scan-id',
        target: 'invalid.domain',
        status: 'pending',
      };

      mockScanRepository.findOne.mockResolvedValue(mockScan);
      mockDnsResolver.resolve.mockRejectedValue(
        new Error('Could not resolve IP'),
      );
      mockScanRepository.save.mockResolvedValue(mockScan);

      await expect(processor.processScan(mockJob)).rejects.toThrow(
        'DNS resolution failed: Could not resolve IP',
      );

      expect(mockScanRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error: expect.stringContaining('Could not resolve IP'),
        }),
      );
      expect(mockGateway.emitScanUpdate).toHaveBeenCalledWith(
        'test-scan-id',
        'scan-failed',
        expect.objectContaining({ error: expect.any(String) }),
      );
    });

    it('should handle nmap scan failure', async () => {
      const mockJob = {
        data: { scanId: 'test-scan-id' },
      } as Job;

      const mockScan = {
        id: 'test-scan-id',
        target: '192.168.1.1',
        status: 'pending',
      };

      mockScanRepository.findOne.mockResolvedValue(mockScan);
      mockDnsResolver.resolve.mockResolvedValue('192.168.1.1');
      mockNmapScanner.scan.mockRejectedValue(new Error('Nmap scan failed'));
      mockScanRepository.save.mockResolvedValue(mockScan);

      await expect(processor.processScan(mockJob)).rejects.toThrow(
        'Nmap scan failed: Nmap scan failed',
      );

      expect(mockScanRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error: expect.stringContaining('Nmap scan failed'),
        }),
      );
    });

    it('should throw error if scan not found', async () => {
      const mockJob = {
        data: { scanId: 'non-existent-id' },
      } as Job;

      mockScanRepository.findOne.mockResolvedValue(null);

      await expect(processor.processScan(mockJob)).rejects.toThrow(
        'Scan not found',
      );
    });
  });
});
