import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
} from 'class-validator';

export class CreateInstallationDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsString()
  @IsNotEmpty()
  regionId: string;

  @IsString()
  @IsNotEmpty()
  name: string; // e.g., "Main Office", "Branch 1"

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsOptional()
  landmark?: string;

  @IsString()
  @IsOptional()
  contactPerson?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsString()
  @IsOptional()
  googleMapsUrl?: string;

  @IsString()
  @IsOptional()
  installationType?: string; // "Residential", "Commercial", "Industrial"

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean; // Mark as default installation

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
