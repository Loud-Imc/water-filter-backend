import { IsString } from 'class-validator';

export class StartWorkDto {
  @IsString()
  requestId: string;
}
