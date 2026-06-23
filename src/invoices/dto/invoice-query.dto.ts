import { IsOptional, IsEnum, IsString } from 'class-validator';
import { InvoiceType } from '@prisma/client';

export class InvoiceQueryDto {
  @IsEnum(InvoiceType)
  @IsOptional()
  type?: InvoiceType;

  @IsString()
  @IsOptional()
  supplierId?: string;

  @IsString()
  @IsOptional()
  customerId?: string;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  sparePartId?: string;
}
