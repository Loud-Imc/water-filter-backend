import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class StockUpdateDto {
  @IsNumber()
  quantityChange: number;

  @IsString()
  @IsNotEmpty()
  reason: string;
}
