import { PartialType } from '@nestjs/mapped-types';
import { CreateSparePartDto } from './create-spare-part.dto';

export class UpdateSparePartDto extends PartialType(CreateSparePartDto) {}


