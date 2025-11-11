import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateRegionDto {
  @IsString()
  @IsNotEmpty()
  name: string; // Required: Full display name

  @IsString()
  @IsOptional()
  state?: string; // Optional: "Kerala"

  @IsString()
  @IsOptional()
  taluk?: string; // Optional: "Kottayam"

  @IsString()
  @IsOptional()
  district?: string; // Optional: "Kottayam"

  @IsString()
  @IsOptional()
  city?: string; // Optional: "Pala"

  @IsString()
  @IsOptional()
  pincode?: string; // Optional: "686575"
}
