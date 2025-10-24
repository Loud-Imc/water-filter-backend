import { IsEnum, IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { RequestType } from '@prisma/client';

export class CreateServiceRequestDto {
  @IsEnum(RequestType)
  type: RequestType;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  requestedById: string;

  @IsString()
  @IsNotEmpty()
  regionId: string;

  @IsString()
  @IsNotEmpty()
  customerId: string;
}
