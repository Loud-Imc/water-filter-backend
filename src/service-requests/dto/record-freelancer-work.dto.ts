import { IsString, IsOptional, IsArray, IsDateString, IsBoolean, IsNumber } from 'class-validator';

export class RecordFreelancerWorkDto {
  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  usedItems?: Array<{
    type: 'product' | 'sparePart';
    id?: string;
    quantityUsed: number;
    notes?: string;
    source: 'warehouse' | 'technician' | 'external';
    isExternal?: boolean;
    externalName?: string;
    externalPrice?: number;
    externalWarrantyMonths?: number;
  }>;
}
