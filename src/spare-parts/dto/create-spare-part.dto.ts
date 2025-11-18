import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export class CreateSparePartDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  company?: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  groupId?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  stock: number;

  @IsBoolean()
  @IsOptional()
  hasWarranty?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(11)
  warrantyMonths?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  warrantyYears?: number;
}
