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

export class ScanResultDto {
  id: string;
  target: string;
  resolvedIp: string;
  scanType: 'quick' | 'heavy';
  ports: PortScanResult[];
  vulnerabilities?: VulnerabilityResult[]; // Quick scan (Nikto)
  nucleiResults?: NucleiScanResult[]; // Heavy scan (Nuclei)
  heavyScanOptions?: {
    categories: string[];
    severities: string[];
  };
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}
