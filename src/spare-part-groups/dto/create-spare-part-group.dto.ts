import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateSparePartGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
