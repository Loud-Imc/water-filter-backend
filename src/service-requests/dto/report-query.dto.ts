import { IsOptional, IsDateString, IsEnum } from 'class-validator';

export enum ReportType {
  SERVICE_REQUESTS = 'service-requests',
  TECHNICIAN_PERFORMANCE = 'technician-performance',
  REGIONAL_BREAKDOWN = 'regional-breakdown',
  CUSTOMER_ACTIVITY = 'customer-activity',
  PRODUCT_USAGE = 'product-usage',
}

export class ReportQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string; // ISO date format: "2025-11-01"

  @IsOptional()
  @IsDateString()
  endDate?: string; // ISO date format: "2025-11-10"

  @IsOptional()
  @IsEnum(ReportType)
  reportType?: ReportType;

  @IsOptional()
  regionId?: string;
}
