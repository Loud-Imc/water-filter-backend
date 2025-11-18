import { PartialType } from '@nestjs/mapped-types';
import { CreateSparePartGroupDto } from './create-spare-part-group.dto';

export class UpdateSparePartGroupDto extends PartialType(
  CreateSparePartGroupDto,
) {}
