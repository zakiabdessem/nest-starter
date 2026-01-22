export interface PortScanResult {
  port: number;
  protocol: string;
  state: string;
  service: string;
}

export interface VulnerabilityResult {
  hostname: string;
  ip: string;
  port: string;
  referenceUrl?: string;
  method?: string;
  path?: string;
  description: string;
}

export class ScanResultDto {
  id: string;
  target: string;
  resolvedIp: string;
  ports: PortScanResult[];
  vulnerabilities?: VulnerabilityResult[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}
