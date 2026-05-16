import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class CreateMergeRequestDto {
  @IsString()
  @IsNotEmpty()
  sourceId: string;

  @IsString()
  @IsNotEmpty()
  targetId: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class ProcessMergeRequestDto {
  @IsEnum(['APPROVED', 'REJECTED'])
  @IsNotEmpty()
  status: 'APPROVED' | 'REJECTED';

  @IsString()
  @IsOptional()
  adminNotes?: string;
}
