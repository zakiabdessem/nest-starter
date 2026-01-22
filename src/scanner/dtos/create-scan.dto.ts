import { IsString, IsNotEmpty, IsOptional, IsArray, IsIn } from 'class-validator';

export class CreateScanDto {
  @IsString()
  @IsNotEmpty()
  target: string; // URL, domain, or IP address

  @IsOptional()
  @IsString()
  @IsIn(['quick', 'heavy'])
  scanType?: 'quick' | 'heavy'; // Type of scan to perform

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[]; // For heavy scan: ['cves', 'misconfiguration', 'exposures', 'technologies']

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  severities?: string[]; // For heavy scan: ['info', 'low', 'medium', 'high', 'critical']
}
