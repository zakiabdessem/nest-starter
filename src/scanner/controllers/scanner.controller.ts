import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { ScannerService } from '../services/scanner.service';
import { CreateScanDto } from '../dtos/create-scan.dto';
import { ScanResultDto } from '../dtos/scan-result.dto';

@Controller('scan')
export class ScannerController {
  constructor(private readonly scannerService: ScannerService) {}

  /**
   * Create a new scan
   * POST /scan
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async createScan(
    @Body(ValidationPipe) createScanDto: CreateScanDto,
  ): Promise<ScanResultDto> {
    return await this.scannerService.createScan(createScanDto);
  }

  /**
   * Get scan by ID
   * GET /scan/:id
   */
  @Get(':id')
  async getScan(@Param('id') id: string): Promise<ScanResultDto> {
    return await this.scannerService.getScan(id);
  }

  /**
   * Get all scans
   * GET /scan
   */
  @Get()
  async getAllScans(): Promise<ScanResultDto[]> {
    return await this.scannerService.getAllScans();
  }
}
