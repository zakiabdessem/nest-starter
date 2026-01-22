import { Test, TestingModule } from '@nestjs/testing';
import { NmapScannerService } from './nmap-scanner.service';
import { exec } from 'child_process';

jest.mock('child_process');

describe('NmapScannerService', () => {
  let service: NmapScannerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NmapScannerService],
    }).compile();

    service = module.get<NmapScannerService>(NmapScannerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buildCommand', () => {
    it('should build nmap command with default ports', () => {
      const cmd = service.buildCommand('192.168.1.1');
      expect(cmd).toContain('sudo nmap');
      expect(cmd).toContain('-sS');
      expect(cmd).toContain('-T4');
      expect(cmd).toContain('--open');
      expect(cmd).toContain('-p 80,443,8080,22,21,3306,5432,27017');
      expect(cmd).toContain('192.168.1.1');
    });

    it('should build nmap command with custom ports', () => {
      const cmd = service.buildCommand('10.0.0.1', [80, 443]);
      expect(cmd).toContain('-p 80,443');
      expect(cmd).toContain('10.0.0.1');
    });
  });

  describe('parseOutput', () => {
    it('should parse nmap output correctly', () => {
      const nmapOutput = `Starting Nmap 7.94 ( https://nmap.org )
Nmap scan report for testphp.vulnweb.com (44.228.249.3)
Host is up (0.23s latency).
PORT     STATE SERVICE
80/tcp   open  http
443/tcp  open  https
8080/tcp open  http-proxy

Nmap done: 1 IP address (1 host up) scanned in 5.23 seconds`;

      const result = service.parseOutput(nmapOutput);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        port: 80,
        protocol: 'tcp',
        state: 'open',
        service: 'http',
      });
      expect(result[1]).toEqual({
        port: 443,
        protocol: 'tcp',
        state: 'open',
        service: 'https',
      });
      expect(result[2]).toEqual({
        port: 8080,
        protocol: 'tcp',
        state: 'open',
        service: 'http-proxy',
      });
    });

    it('should handle empty results', () => {
      const nmapOutput = `Starting Nmap 7.94 ( https://nmap.org )
Nmap scan report for 192.168.1.1
Host is up (0.001s latency).
PORT   STATE SERVICE

Nmap done: 1 IP address (1 host up) scanned in 0.50 seconds`;

      const result = service.parseOutput(nmapOutput);
      expect(result).toHaveLength(0);
    });

    it('should handle output without PORT header', () => {
      const nmapOutput = `Starting Nmap 7.94 ( https://nmap.org )
Host is not reachable`;

      const result = service.parseOutput(nmapOutput);
      expect(result).toHaveLength(0);
    });

    it('should parse multiple ports correctly', () => {
      const nmapOutput = `PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
443/tcp  open  https
3306/tcp open  mysql
5432/tcp open  postgresql

Nmap done`;

      const result = service.parseOutput(nmapOutput);
      expect(result).toHaveLength(5);
      expect(result[3]).toEqual({
        port: 3306,
        protocol: 'tcp',
        state: 'open',
        service: 'mysql',
      });
    });
  });

  describe('scan', () => {
    it('should execute nmap and return parsed results', async () => {
      const mockOutput = `PORT     STATE SERVICE
80/tcp   open  http
443/tcp  open  https

Nmap done`;

      (exec as unknown as jest.Mock).mockImplementation((cmd, options, callback) => {
        callback(null, { stdout: mockOutput, stderr: '' });
      });

      const result = await service.scan('192.168.1.1');
      
      expect(result).toHaveLength(2);
      expect(result[0].port).toBe(80);
      expect(result[1].port).toBe(443);
    });

    it('should handle scan timeout', async () => {
      (exec as unknown as jest.Mock).mockImplementation((cmd, options, callback) => {
        callback(new Error('Command timeout'));
      });

      await expect(service.scan('192.168.1.1')).rejects.toThrow();
    });

    it('should handle nmap errors', async () => {
      (exec as unknown as jest.Mock).mockImplementation((cmd, options, callback) => {
        callback(new Error('Nmap error'));
      });

      await expect(service.scan('192.168.1.1')).rejects.toThrow();
    });

    it('should use custom ports when provided', async () => {
      const mockOutput = `PORT    STATE SERVICE
80/tcp  open  http

Nmap done`;

      (exec as unknown as jest.Mock).mockImplementation((cmd, options, callback) => {
        expect(cmd).toContain('-p 80,443');
        callback(null, { stdout: mockOutput, stderr: '' });
      });

      await service.scan('192.168.1.1', [80, 443]);
    });
  });
});
