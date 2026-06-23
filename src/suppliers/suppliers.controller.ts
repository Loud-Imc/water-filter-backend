import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private suppliersService: SuppliersService) {}

  @Post()
  @RequirePermissions('products.create')
  create(@Body() body: CreateSupplierDto) {
    return this.suppliersService.create(body);
  }

  @Get()
  @RequirePermissions('products.view')
  findAll() {
    return this.suppliersService.findAll();
  }

  @Get(':id')
  @RequirePermissions('products.view')
  findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  @Put(':id')
  @RequirePermissions('products.update')
  update(@Param('id') id: string, @Body() body: UpdateSupplierDto) {
    return this.suppliersService.update(id, body);
  }

  @Delete(':id')
  @RequirePermissions('products.delete')
  delete(@Param('id') id: string) {
    return this.suppliersService.delete(id);
  }
}
