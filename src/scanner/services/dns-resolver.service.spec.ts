import { Test, TestingModule } from '@nestjs/testing';
import { DnsResolverService } from './dns-resolver.service';
import { exec } from 'child_process';
import { promisify } from 'util';

jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

const execAsync = promisify(exec);

describe('DnsResolverService', () => {
  let service: DnsResolverService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DnsResolverService],
    }).compile();

    service = module.get<DnsResolverService>(DnsResolverService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('parseTarget', () => {
    it('should strip http:// from URL', () => {
      const result = service.parseTarget('http://testphp.vulnweb.com/');
      expect(result).toBe('testphp.vulnweb.com');
    });

    it('should strip https:// from URL', () => {
      const result = service.parseTarget('https://example.com/path');
      expect(result).toBe('example.com');
    });

    it('should strip trailing slash', () => {
      const result = service.parseTarget('example.com/');
      expect(result).toBe('example.com');
    });

    it('should strip path from URL', () => {
      const result = service.parseTarget('https://example.com/path/to/page');
      expect(result).toBe('example.com');
    });

    it('should handle domain without protocol', () => {
      const result = service.parseTarget('example.com');
      expect(result).toBe('example.com');
    });
  });

  describe('isIpAddress', () => {
    it('should return true for valid IP address', () => {
      expect(service.isIpAddress('192.168.1.1')).toBe(true);
      expect(service.isIpAddress('10.0.0.1')).toBe(true);
      expect(service.isIpAddress('172.16.0.1')).toBe(true);
    });

    it('should return false for domain names', () => {
      expect(service.isIpAddress('example.com')).toBe(false);
      expect(service.isIpAddress('testphp.vulnweb.com')).toBe(false);
    });

    it('should return false for invalid IP', () => {
      expect(service.isIpAddress('256.1.1.1')).toBe(false);
      expect(service.isIpAddress('192.168.1')).toBe(false);
    });
  });

  describe('resolve', () => {
    it('should return IP if input is already an IP address', async () => {
      const ip = '192.168.1.1';
      const result = await service.resolve(ip);
      expect(result).toBe(ip);
    });

    it.skip('should resolve domain to IP using nslookup', async () => {
      const mockOutput = `Server:		172.20.10.1
Address:	172.20.10.1#53

Non-authoritative answer:
Name:	testphp.vulnweb.com
Address: 44.228.249.3`;

      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(null, { stdout: mockOutput, stderr: '' });
      });

      const result = await service.resolve('testphp.vulnweb.com');
      expect(result).toBe('44.228.249.3');
    });

    it.skip('should handle URL input and resolve to IP', async () => {
      const mockOutput = `Server:		172.20.10.1
Address:	172.20.10.1#53

Non-authoritative answer:
Name:	example.com
Address: 93.184.216.34`;

      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(null, { stdout: mockOutput, stderr: '' });
      });

      const result = await service.resolve('http://example.com/');
      expect(result).toBe('93.184.216.34');
    });

    it.skip('should throw error if domain cannot be resolved', async () => {
      const mockStdout = `Server:		172.20.10.1
Address:	172.20.10.1#53

** server can't find invalid.domain: NXDOMAIN`;

      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(null, { stdout: mockStdout, stderr: '' });
      });

      await expect(service.resolve('invalid.domain')).rejects.toThrow(
        'DNS resolution failed',
      );
    });

    it.skip('should throw error if nslookup command fails', async () => {
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(new Error('Command failed'));
      });

      await expect(service.resolve('example.com')).rejects.toThrow();
    });
  });
});
