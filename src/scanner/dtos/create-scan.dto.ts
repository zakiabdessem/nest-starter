import { IsString, IsNotEmpty } from 'class-validator';

export class CreateScanDto {
  @IsString()
  @IsNotEmpty()
  target: string; // URL, domain, or IP address
}
