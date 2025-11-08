import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsEnum } from 'class-validator';
import { UserStatus } from '@prisma/client';

// Omit password and customPermissions from update (handle separately)
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password', 'customPermissions'] as const),
) {
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;
}
