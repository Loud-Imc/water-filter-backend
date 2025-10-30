import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsEnum, IsObject } from 'class-validator';
import { UserStatus } from '@prisma/client'; // assuming you export this

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @IsObject()
  @IsOptional()
  customPermissions?: {
    add?: string[];
    remove?: string[];
  };
}
