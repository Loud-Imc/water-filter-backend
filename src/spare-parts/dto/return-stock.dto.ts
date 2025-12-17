import { IsInt, IsPositive, IsString } from 'class-validator';

export class ReturnStockDto {
    @IsString()
    technicianId: string;

    @IsInt()
    @IsPositive()
    quantity: number;
}
