import { PartialType } from '@nestjs/mapped-types';
import { CreateBOMTemplateDto } from './create-bom-template.dto';
import { IsString } from 'class-validator';

export class UpdateBOMTemplateDto extends PartialType(CreateBOMTemplateDto) {
  @IsString()
  productId?: string; // Make productId optional for updates
}
