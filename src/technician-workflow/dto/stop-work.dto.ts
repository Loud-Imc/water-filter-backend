import { IsString, IsOptional } from 'class-validator';

export class StopWorkDto {
  @IsString()
  requestId: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
