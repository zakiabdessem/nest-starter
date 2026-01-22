import { Test, TestingModule } from '@nestjs/testing';
import { NiktoScannerService } from './nikto-scanner.service';
import { exec } from 'child_process';
import { promises as fs } from 'fs';

jest.mock('child_process', () => ({
  exec: jest.fn(),
}));
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    mkdir: jest.fn(),
    unlink: jest.fn(),
  },
}));

describe('NiktoScannerService', () => {
  let service: NiktoScannerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NiktoScannerService],
    }).compile();

    service = module.get<NiktoScannerService>(NiktoScannerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buildCommand', () => {
    it('should build correct Nikto command for HTTP', () => {
      const result = service.buildCommand('http://testphp.vulnweb.com:80', '/tmp/test.csv');
      
      // Default port 80 should be omitted
      expect(result.command).toContain('nikto -h testphp.vulnweb.com');
      expect(result.command).not.toContain(':80');
      expect(result.command).toContain('-Tuning 1,2,3,4');
      expect(result.command).toContain('-maxtime 30');
      expect(result.command).toContain('-output /tmp/test.csv');
      expect(result.command).toContain('-Format csv');
      expect(result.command).not.toContain('-ssl');
      expect(result.cleanupFile).toBe('/tmp/test.csv');
    });

    it('should build correct Nikto command for HTTPS with SSL flag', () => {
      const result = service.buildCommand('https://example.com:443', '/tmp/test.csv');
      
      // Default port 443 should be omitted
      expect(result.command).toContain('nikto -h example.com');
      expect(result.command).not.toContain(':443');
      expect(result.command).toContain('-ssl');
      expect(result.command).toContain('-Tuning 1,2,3,4');
    });

    it('should use default port 80 for HTTP when not specified', () => {
      const result = service.buildCommand('http://example.com', '/tmp/test.csv');
      
      // Default port should be omitted
      expect(result.command).toContain('nikto -h example.com');
      expect(result.command).not.toContain(':80');
    });

    it('should use default port 443 for HTTPS when not specified', () => {
      const result = service.buildCommand('https://example.com', '/tmp/test.csv');
      
      // Default port should be omitted
      expect(result.command).toContain('nikto -h example.com');
      expect(result.command).not.toContain(':443');
      expect(result.command).toContain('-ssl');
    });

    it('should include non-default port in command', () => {
      const result = service.buildCommand('http://example.com:8080', '/tmp/test.csv');
      
      // Non-default port should be included
      expect(result.command).toContain('nikto -h example.com:8080');
      expect(result.command).not.toContain('-ssl');
    });
  });

  describe('parseCsvLine', () => {
    it('should parse CSV line with quoted fields', () => {
      const line = '"example.com","104.18.27.120","443","https://mdn.io","GET","/","Description here"';
      const result = service.parseCsvLine(line);

      expect(result).toEqual([
        'example.com',
        '104.18.27.120',
        '443',
        'https://mdn.io',
        'GET',
        '/',
        'Description here',
      ]);
    });

    it('should handle empty quoted fields', () => {
      const line = '"example.com","104.18.27.120","443","","","",""';
      const result = service.parseCsvLine(line);

      expect(result).toEqual(['example.com', '104.18.27.120', '443', '', '', '', '']);
    });
  });

  describe('parseCsvFile', () => {
    it('should parse CSV file and extract vulnerabilities', async () => {
      const mockCsv = `"Nikto - v2.5.0/"
"example.com","104.18.27.120","443","","","","cloudflare"
"example.com","104.18.27.120","443","https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options","GET","/","The anti-clickjacking X-Frame-Options header is not present."
"example.com","104.18.27.120","443","https://www.netsparker.com/web-vulnerability-scanner/vulnerabilities/missing-content-type-header/","GET","/","The X-Content-Type-Options header is not set."`;

      (fs.readFile as jest.Mock).mockResolvedValue(mockCsv);

      const results = await service.parseCsvFile('/tmp/test.csv');

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        hostname: 'example.com',
        ip: '104.18.27.120',
        port: '443',
        referenceUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options',
        method: 'GET',
        path: '/',
        description: 'The anti-clickjacking X-Frame-Options header is not present.',
      });
      expect(results[1]).toEqual({
        hostname: 'example.com',
        ip: '104.18.27.120',
        port: '443',
        referenceUrl: 'https://www.netsparker.com/web-vulnerability-scanner/vulnerabilities/missing-content-type-header/',
        method: 'GET',
        path: '/',
        description: 'The X-Content-Type-Options header is not set.',
      });
    });

    it('should skip version headers and server info rows', async () => {
      const mockCsv = `"Nikto - v2.5.0/"
"example.com","104.18.27.120","443","","","","cloudflare"
"example.com","104.18.27.120","443","https://mdn.io","GET","/","Real vulnerability"`;

      (fs.readFile as jest.Mock).mockResolvedValue(mockCsv);

      const results = await service.parseCsvFile('/tmp/test.csv');

      expect(results).toHaveLength(1);
      expect(results[0].description).toBe('Real vulnerability');
    });

    it('should handle empty CSV files', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue('');

      const results = await service.parseCsvFile('/tmp/test.csv');

      expect(results).toHaveLength(0);
    });
  });

  describe('scan', () => {
    it('should execute Nikto, parse CSV, and cleanup', async () => {
      const mockCsv = `"Nikto - v2.5.0/"
"example.com","104.18.27.120","443","https://mdn.io","GET","/","Test vulnerability"`;

      (exec as unknown as jest.Mock).mockImplementation((cmd, options, callback) => {
        callback(null, { stdout: '', stderr: '' });
      });
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue(mockCsv);
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      const results = await service.scan('https://example.com');

      expect(results).toHaveLength(1);
      expect(results[0].description).toBe('Test vulnerability');
      expect(fs.mkdir).toHaveBeenCalledWith('/tmp/nikto-scans', { recursive: true });
      expect(fs.unlink).toHaveBeenCalled();
    });

    it('should return partial results if scan fails but CSV exists', async () => {
      const mockCsv = `"Nikto - v2.5.0/"
"example.com","104.18.27.120","443","https://mdn.io","GET","/","Partial result"`;

      (exec as unknown as jest.Mock).mockImplementation((cmd, options, callback) => {
        callback(new Error('Scan timeout'));
      });
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue(mockCsv);
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      const results = await service.scan('https://example.com');

      expect(results).toHaveLength(1);
      expect(results[0].description).toBe('Partial result');
    });

    it('should throw error if scan fails and no results available', async () => {
      (exec as unknown as jest.Mock).mockImplementation((cmd, options, callback) => {
        callback(new Error('Nikto not found'));
      });
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      await expect(service.scan('https://example.com')).rejects.toThrow('Nikto scan failed');
    });

    it('should cleanup temp file even if scan fails', async () => {
      (exec as unknown as jest.Mock).mockImplementation((cmd, options, callback) => {
        callback(new Error('Scan failed'));
      });
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      try {
        await service.scan('https://example.com');
      } catch (e) {
        // Expected to fail
      }

      expect(fs.unlink).toHaveBeenCalled();
    });
  });
});
