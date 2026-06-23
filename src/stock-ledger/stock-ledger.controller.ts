import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StockLedgerService } from './stock-ledger.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { IsOptional, IsEnum, IsString } from 'class-validator';

export class StockLedgerQueryDto {
  @IsEnum(['PRODUCT', 'SPARE_PART'])
  @IsOptional()
  itemType?: 'PRODUCT' | 'SPARE_PART';

  @IsString()
  @IsOptional()
  itemId?: string;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  search?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('stock-ledger')
export class StockLedgerController {
  constructor(private readonly stockLedgerService: StockLedgerService) {}

  @Get()
  @RequirePermissions('stock.view')
  getLedger(@Query() query: StockLedgerQueryDto) {
    return this.stockLedgerService.getLedger(query);
  }
}
