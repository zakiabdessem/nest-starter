export const SCANNER_CONFIG = {
  nmapOptions: {
    scanType: '-sS',
    timing: '-T4',
    openOnly: '--open',
  },
  defaultPorts: [80, 443, 8080, 22, 21, 3306, 5432, 27017],
  timeout_nmap: 70000, // 70 seconds in milliseconds
  timeout_nslookup: 5000, // 5 seconds in milliseconds
  timeoutBackoff_nmap: 1000, // 1 second in milliseconds
  timeoutBackoff_nslookup: 500, // 0.5 seconds in milliseconds
  niktoOptions: {
    timeout: 60000, // 1 minute max in milliseconds
    tuning: '1,2,3,4', // Safe checks only
    maxTime: 30, // 1 minutes per scan (Nikto uses seconds)
    tempDir: '/tmp/nikto-scans', // Directory for temp CSV files
  },
  webPorts: [80, 443, 8080, 8443, 3000, 5000, 8000],
  vulnerabilityScanning: {
    enabled: true,
    skipIfNoWebPorts: true,
    maxPortsToScan: 5,
  },
};
