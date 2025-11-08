import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export class CreateProductDto {
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

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  stock: number;

  @IsBoolean()
  @IsOptional()
  hasWarranty?: boolean;

  // Warranty: less than 12 months (e.g., 6 months)
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(11)
  warrantyMonths?: number;

  // Warranty: more than 12 months (e.g., 2 years = 24 months, so years=2)
  @IsNumber()
  @IsOptional()
  @Min(1)
  warrantyYears?: number;
}
