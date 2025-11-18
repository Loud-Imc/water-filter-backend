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
import { ProductCategoriesService } from './product-categories.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('product-categories')
export class ProductCategoriesController {
  constructor(private categoriesService: ProductCategoriesService) {}

  @Post()
  @RequirePermissions('categories.manage')
  create(@Body() body: CreateProductCategoryDto) {
    return this.categoriesService.create(body);
  }

  @Get()
  @RequirePermissions('categories.view')
  findAll(@Query('includeInactive') includeInactive?: string) {
    const showInactive = includeInactive === 'true';
    return this.categoriesService.findAll(showInactive);
  }

  @Get(':id')
  @RequirePermissions('categories.view')
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @Get(':id/products')
  @RequirePermissions('categories.view')
  getProductsByCategory(@Param('id') id: string) {
    return this.categoriesService.getProductsByCategory(id);
  }

  @Put(':id')
  @RequirePermissions('categories.manage')
  update(@Param('id') id: string, @Body() body: UpdateProductCategoryDto) {
    return this.categoriesService.update(id, body);
  }

  @Delete(':id')
  @RequirePermissions('categories.manage')
  delete(@Param('id') id: string) {
    return this.categoriesService.delete(id);
  }

  @Put(':id/toggle-status')
  @RequirePermissions('categories.manage')
  toggleStatus(@Param('id') id: string) {
    return this.categoriesService.toggleStatus(id);
  }
}
