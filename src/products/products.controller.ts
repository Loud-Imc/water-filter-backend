import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Post()
  @RequirePermissions('products.create')
  create(@Body() body: CreateProductDto) {
    return this.productsService.create(body);
  }

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get('low-stock')
  @RequirePermissions('products.view')
  getLowStockProducts() {
    return this.productsService.getLowStockProducts();
  }

  @Get('low-stock-threshold')
  @RequirePermissions('products.view')
  async getLowStockThreshold() {
    return {
      threshold: await this.productsService.getLowStockThreshold(),
    };
  }

  @Put('low-stock-threshold')
  @RequirePermissions('products.edit')
  async setLowStockThreshold(@Body() body: { threshold: number }, @Req() req) {
    await this.productsService.setLowStockThreshold(
      body.threshold,
      req.user.userId,
    );
    return { success: true, threshold: body.threshold };
  }

  @Get('low-stock-count')
  @RequirePermissions('products.view')
  async getLowStockCount() {
    return {
      count: await this.productsService.getLowStockCount(),
    };
  }

  @Get('filtered')
  @RequirePermissions('products.view')
  async getFiltered(@Query() filters: any) {
    console.log('filtered ', filters);
    return this.productsService.getFilteredProducts({
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

  @Get(':id')
  @RequirePermissions('products.view')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Put(':id')
  @RequirePermissions('products.update')
  update(@Param('id') id: string, @Body() body: UpdateProductDto) {
    return this.productsService.update(id, body);
  }

  @Delete(':id')
  @RequirePermissions('products.delete')
  delete(@Param('id') id: string) {
    return this.productsService.delete(id);
  }

  @Post(':id/stock')
  @RequirePermissions('products.update')
  updateStock(
    @Param('id') id: string,
    @Body() body: { quantityChange: number; reason: string },
  ) {
    return this.productsService.updateStock(
      id,
      body.quantityChange,
      body.reason,
    );
  }
}
