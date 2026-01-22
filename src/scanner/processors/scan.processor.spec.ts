import { Test, TestingModule } from '@nestjs/testing';
import { ScanProcessor } from './scan.processor';
import { DnsResolverService } from '../services/dns-resolver.service';
import { NmapScannerService } from '../services/nmap-scanner.service';
import { NiktoScannerService } from '../services/nikto-scanner.service';
import { NucleiScannerService } from '../services/nuclei-scanner.service';
import { ScannerGateway } from '../gateways/scanner.gateway';
import { Repository } from 'typeorm';
import { Scan } from '../entities/scan.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Job } from 'bullmq';

describe('ScanProcessor', () => {
  let processor: ScanProcessor;
  let dnsResolver: DnsResolverService;
  let nmapScanner: NmapScannerService;
  let niktoScanner: NiktoScannerService;
  let nucleiScanner: NucleiScannerService;
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

  const mockNucleiScanner = {
    scan: jest.fn(),
  };

  const mockGateway = {
    emitScanUpdate: jest.fn(),
    emitScanStarted: jest.fn(),
    emitDnsResolved: jest.fn(),
    emitScanningPorts: jest.fn(),
    emitScanComplete: jest.fn(),
    emitScanFailed: jest.fn(),
    emitVulnerabilityScanStarted: jest.fn(),
    emitVulnerabilityScanComplete: jest.fn(),
    emitHeavyScanStarted: jest.fn(),
    emitCategoryScanProgress: jest.fn(),
    emitCategoryScanComplete: jest.fn(),
    emitHeavyScanComplete: jest.fn(),
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
          provide: NucleiScannerService,
          useValue: mockNucleiScanner,
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
    niktoScanner = module.get<NiktoScannerService>(NiktoScannerService);
    nucleiScanner = module.get<NucleiScannerService>(NucleiScannerService);
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
        scanType: 'quick',
        status: 'pending',
        resolvedIp: null,
        ports: null,
      };

      const mockPorts = [
        { port: 80, protocol: 'tcp', state: 'open', service: 'http' },
        { port: 443, protocol: 'tcp', state: 'open', service: 'https' },
      ];

      const mockVulnerabilities = [
        { hostname: 'testphp.vulnweb.com', ip: '44.228.249.3', port: '80', description: 'Test vuln' },
      ];

      // Mock Nikto to return vulnerabilities for each port scanned
      let niktoCallCount = 0;
      mockNiktoScanner.scan.mockImplementation(() => {
        niktoCallCount++;
        // Return the vulnerability only for the first port (80)
        return Promise.resolve(niktoCallCount === 1 ? mockVulnerabilities : []);
      });

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
      expect(mockNiktoScanner.scan).toHaveBeenCalled();
      // Check that save was called with completed status (it's called multiple times during the flow)
      const saveCalls = mockScanRepository.save.mock.calls;
      const lastSaveCall = saveCalls[saveCalls.length - 1][0];
      expect(lastSaveCall).toMatchObject({
        status: 'completed',
        resolvedIp: '44.228.249.3',
        ports: JSON.stringify(mockPorts),
        vulnerabilities: JSON.stringify(mockVulnerabilities),
      });
      expect(mockGateway.emitScanComplete).toHaveBeenCalledWith(
        'test-scan-id',
        expect.objectContaining({ 
          status: 'completed',
          vulnerabilities: mockVulnerabilities,
        }),
      );
    });

    it('should skip DNS resolution if target is already an IP', async () => {
      const mockJob = {
        data: { scanId: 'test-scan-id' },
      } as Job;

      const mockScan = {
        id: 'test-scan-id',
        target: '192.168.1.1',
        scanType: 'quick',
        status: 'pending',
      };

      const mockPorts = [
        { port: 80, protocol: 'tcp', state: 'open', service: 'http' },
      ];

      mockScanRepository.findOne.mockResolvedValue(mockScan);
      mockDnsResolver.resolve.mockResolvedValue('192.168.1.1');
      mockNmapScanner.scan.mockResolvedValue(mockPorts);
      mockNiktoScanner.scan.mockResolvedValue([]);
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

    it('should process heavy scan with Nuclei successfully', async () => {
      const mockJob = {
        data: { scanId: 'test-heavy-scan-id' },
      } as Job;

      const mockScan = {
        id: 'test-heavy-scan-id',
        target: 'http://example.com',
        scanType: 'heavy',
        heavyScanOptions: JSON.stringify({
          categories: ['cves', 'misconfiguration'],
          severities: ['high', 'critical'],
        }),
        status: 'pending',
        resolvedIp: null,
        ports: null,
      };

      const mockPorts = [
        { port: 80, protocol: 'tcp', state: 'open', service: 'http' },
        { port: 443, protocol: 'tcp', state: 'open', service: 'https' },
      ];

      const mockNucleiResults = [
        {
          category: 'cves',
          findings: [
            {
              templateID: 'CVE-2023-1234',
              name: 'Test Vulnerability',
              severity: 'high',
              description: 'Test description',
              matchedAt: 'http://example.com',
              category: 'cves',
            },
          ],
        },
        {
          category: 'misconfiguration',
          findings: [],
        },
      ];

      mockScanRepository.findOne.mockResolvedValue(mockScan);
      mockDnsResolver.resolve.mockResolvedValue('192.168.1.1');
      mockNmapScanner.scan.mockResolvedValue(mockPorts);
      mockNucleiScanner.scan.mockResolvedValue(mockNucleiResults);
      mockScanRepository.save.mockResolvedValue(mockScan);

      await processor.processScan(mockJob);

      expect(mockNucleiScanner.scan).toHaveBeenCalledWith(
        'http://example.com',
        ['cves', 'misconfiguration'],
        ['high', 'critical'],
      );
      expect(mockGateway.emitHeavyScanStarted).toHaveBeenCalled();
      expect(mockGateway.emitCategoryScanComplete).toHaveBeenCalledTimes(2);
      expect(mockGateway.emitHeavyScanComplete).toHaveBeenCalled();
      expect(mockScanRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          nucleiResults: JSON.stringify(mockNucleiResults),
        }),
      );
    });

    it('should skip Nikto for heavy scan', async () => {
      const mockJob = {
        data: { scanId: 'test-heavy-scan-id' },
      } as Job;

      const mockScan = {
        id: 'test-heavy-scan-id',
        target: 'http://example.com',
        scanType: 'heavy',
        heavyScanOptions: JSON.stringify({
          categories: ['cves'],
          severities: ['high'],
        }),
        status: 'pending',
      };

      const mockPorts = [
        { port: 80, protocol: 'tcp', state: 'open', service: 'http' },
      ];

      mockScanRepository.findOne.mockResolvedValue(mockScan);
      mockDnsResolver.resolve.mockResolvedValue('192.168.1.1');
      mockNmapScanner.scan.mockResolvedValue(mockPorts);
      mockNucleiScanner.scan.mockResolvedValue([
        { category: 'cves', findings: [] },
      ]);
      mockScanRepository.save.mockResolvedValue(mockScan);

      await processor.processScan(mockJob);

      expect(mockNiktoScanner.scan).not.toHaveBeenCalled();
      expect(mockNucleiScanner.scan).toHaveBeenCalled();
    });
  });
});
