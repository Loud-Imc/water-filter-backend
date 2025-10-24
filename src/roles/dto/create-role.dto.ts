import { IsString, IsOptional, IsObject, IsBoolean } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  parentRole?: string;

  @IsObject()
  permissions: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  immutable?: boolean;
}
