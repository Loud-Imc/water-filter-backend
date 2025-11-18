import { IsArray, IsString, IsOptional } from 'class-validator';

export class ExecuteAssemblyDto {
  @IsArray()
  @IsString({ each: true })
  selectedSparePartIds: string[];

  @IsString()
  @IsOptional()
  notes?: string;
}
