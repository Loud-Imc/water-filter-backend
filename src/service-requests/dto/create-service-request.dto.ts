import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export enum RequestType {
  SERVICE = 'SERVICE',
  INSTALLATION = 'INSTALLATION',
  RE_INSTALLATION = 'RE_INSTALLATION',
  COMPLAINT = 'COMPLAINT',
  ENQUIRY = 'ENQUIRY',
}

// ✅ NEW: Priority enum
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

  // ✅ NEW: Priority field (optional, defaults to NORMAL)
  @IsEnum(ServicePriority)
  @IsOptional()
  priority?: ServicePriority;

  // ✅ NEW: Direct assignment during creation
  @IsString()
  @IsNotEmpty()
  assignedToId: string;

  // ✅ NEW: Optional notes for admin
  @IsString()
  @IsOptional()
  adminNotes?: string;
}
