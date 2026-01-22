import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Scan } from './entities/scan.entity';
import { ScannerController } from './controllers/scanner.controller';
import { ScannerService } from './services/scanner.service';
import { DnsResolverService } from './services/dns-resolver.service';
import { NmapScannerService } from './services/nmap-scanner.service';
import { NiktoScannerService } from './services/nikto-scanner.service';
import { ScannerGateway } from './gateways/scanner.gateway';
import { ScanProcessor } from './processors/scan.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([Scan]),
    BullModule.registerQueue({
      name: 'scan-queue',
    }),
  ],
  controllers: [ScannerController],
  providers: [
    ScannerService,
    DnsResolverService,
    NmapScannerService,
    NiktoScannerService,
    ScannerGateway,
    ScanProcessor,
  ],
  exports: [ScannerService, ScannerGateway],
})
export class ScannerModule {}
