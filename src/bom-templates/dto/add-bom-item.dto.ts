import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
} from 'class-validator';

export class AddBOMItemDto {
  @IsString()
  @IsNotEmpty()
  sparePartId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsBoolean()
  @IsOptional()
  isOptional?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}
