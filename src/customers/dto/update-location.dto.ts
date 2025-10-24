// src/customers/dto/create-customer.dto.ts
import { IsString, IsOptional, IsNumber } from 'class-validator';

export class UpdateLocationDto {
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsString()
  @IsOptional()
  googleMapsUrl?: string;
}
