import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export enum RequestType {
  SERVICE = 'SERVICE',
  INSTALLATION = 'INSTALLATION',
  RE_INSTALLATION = 'RE_INSTALLATION',
  COMPLAINT = 'COMPLAINT',
  ENQUIRY = 'ENQUIRY',
}

export enum ServicePriority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  NORMAL = 'NORMAL',
  LOW = 'LOW',
}

export class CreateServiceRequestDto {
  @IsEnum(RequestType)
  @IsNotEmpty()
  type: RequestType;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsString()
  @IsNotEmpty()
  regionId: string;

  // ✅ NEW: Installation field
  @IsString()
  @IsOptional()
  installationId?: string | null;

  @IsEnum(ServicePriority)
  @IsOptional()
  priority?: ServicePriority;

  @IsString()
  @IsOptional()
  assignedToId?: string | null;

  @IsString()
  @IsOptional()
  adminNotes?: string;

  @IsString()
  @IsOptional()
  categoryId?: string | null;

  @IsString()
  @IsOptional()
  productId?: string | null;

  @IsString()
  @IsOptional()
  sparePartId?: string | null;
}
