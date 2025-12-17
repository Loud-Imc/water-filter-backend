import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { SparePartsService } from './spare-parts.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CreateSparePartDto } from './dto/create-spare-part.dto';
import { UpdateSparePartDto } from './dto/update-spare-part.dto';
import { StockUpdateDto } from './dto/stock-update.dto';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('spare-parts')
export class SparePartsController {
  constructor(private sparePartsService: SparePartsService) { }

  @Post()
  @RequirePermissions('spare_parts.create')
  create(@Body() body: CreateSparePartDto) {
    return this.sparePartsService.create(body);
  }

  @Get()
  @RequirePermissions('spare_parts.view')
  findAll(@Query('groupId') groupId?: string) {
    return this.sparePartsService.findAll(groupId);
  }


  @Get('low-stock')
  @RequirePermissions('spare_parts.view')
  getLowStockSpareParts() {
    return this.sparePartsService.getLowStockSpareParts();
  }

  @Get('low-stock-count')
  @RequirePermissions('spare_parts.view')
  async getLowStockCount() {
    return {
      count: await this.sparePartsService.getLowStockCount(),
    };
  }

  @Get('filtered')
  @RequirePermissions('spare_parts.view')
  async getFiltered(@Query() filters: any) {
    return this.sparePartsService.getFilteredSpareParts({
      groupId: filters.groupId,
      company: filters.company,
      minPrice: filters.minPrice ? Number(filters.minPrice) : undefined,
      maxPrice: filters.maxPrice ? Number(filters.maxPrice) : undefined,
      minStock: filters.minStock ? Number(filters.minStock) : undefined,
      maxStock: filters.maxStock ? Number(filters.maxStock) : undefined,
      searchTerm: filters.search,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    });
  }

  @Get('by-group/:groupId')
  @RequirePermissions('spare_parts.view')
  getByGroup(@Param('groupId') groupId: string) {
    return this.sparePartsService.getByGroup(groupId);
  }

  @Get(':id')
  @RequirePermissions('spare_parts.view')
  findOne(@Param('id') id: string) {
    return this.sparePartsService.findOne(id);
  }

  // ✅ Get technician stock for a spare part
  @Get(':id/technician-stock')
  @RequirePermissions('stock.view')
  getTechnicianStock(@Param('id') id: string) {
    return this.sparePartsService.getTechnicianStock(id);
  }

  @Put(':id')
  @RequirePermissions('spare_parts.update')
  update(@Param('id') id: string, @Body() body: UpdateSparePartDto) {
    return this.sparePartsService.update(id, body);
  }

  @Delete(':id')
  @RequirePermissions('spare_parts.delete')
  delete(@Param('id') id: string) {
    return this.sparePartsService.delete(id);
  }

  @Post(':id/stock')
  @RequirePermissions('stock.update')
  updateStock(@Param('id') id: string, @Body() body: StockUpdateDto) {
    return this.sparePartsService.updateStock(
      id,
      body.quantityChange,
      body.reason,
    );
  }

  // ✅ Transfer stock to technician
  @Post(':id/transfer-to-technician')
  @RequirePermissions('stock.transfer')
  transferToTechnician(
    @Param('id') id: string,
    @Body() body: { technicianId: string; quantity: number },
  ) {
    return this.sparePartsService.transferToTechnician(
      id,
      body.technicianId,
      body.quantity,
    );
  }

  // ✅ Return stock from technician
  @Post(':id/return-from-technician')
  @RequirePermissions('stock.transfer')
  returnFromTechnician(
    @Param('id') id: string,
    @Body() body: { technicianId: string; quantity: number },
  ) {
    return this.sparePartsService.returnFromTechnician(
      id,
      body.technicianId,
      body.quantity,
    );
  }
}
