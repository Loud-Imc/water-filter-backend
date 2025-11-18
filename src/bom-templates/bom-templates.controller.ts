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
} from '@nestjs/common';
import { BOMTemplatesService } from './bom-templates.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from 'src/auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CreateBOMTemplateDto } from './dto/create-bom-template.dto';
import { UpdateBOMTemplateDto } from './dto/update-bom-template.dto';
import { AddBOMItemDto } from './dto/add-bom-item.dto';
import { ExecuteAssemblyDto } from './dto/execute-assembly.dto';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('bom-templates')
export class BOMTemplatesController {
  constructor(private bomTemplatesService: BOMTemplatesService) {}

  // ===== BOM Template CRUD =====
  @Post()
  @RequirePermissions('assembly.create')
  create(@Body() body: CreateBOMTemplateDto) {
    return this.bomTemplatesService.create(body);
  }

  @Get()
  @RequirePermissions('assembly.view')
  findAll() {
    return this.bomTemplatesService.findAll();
  }

  @Get(':id')
  @RequirePermissions('assembly.view')
  findOne(@Param('id') id: string) {
    return this.bomTemplatesService.findOne(id);
  }

  @Get('by-product/:productId')
  @RequirePermissions('assembly.view')
  getByProduct(@Param('productId') productId: string) {
    return this.bomTemplatesService.getByProduct(productId);
  }

  @Put(':id')
  @RequirePermissions('assembly.create')
  update(@Param('id') id: string, @Body() body: UpdateBOMTemplateDto) {
    return this.bomTemplatesService.update(id, body);
  }

  @Delete(':id')
  @RequirePermissions('assembly.delete')
  delete(@Param('id') id: string) {
    return this.bomTemplatesService.delete(id);
  }

  @Put(':id/toggle-status')
  @RequirePermissions('assembly.create')
  toggleStatus(@Param('id') id: string) {
    return this.bomTemplatesService.toggleStatus(id);
  }

  // ===== BOM Items Management =====
  @Post(':id/items')
  @RequirePermissions('assembly.create')
  addItem(@Param('id') id: string, @Body() body: AddBOMItemDto) {
    return this.bomTemplatesService.addItem(id, body);
  }

  @Put(':templateId/items/:itemId')
  @RequirePermissions('assembly.create')
  updateItem(
    @Param('templateId') templateId: string,
    @Param('itemId') itemId: string,
    @Body() body: { quantity?: number; isOptional?: boolean; notes?: string },
  ) {
    return this.bomTemplatesService.updateItem(templateId, itemId, body);
  }

  @Delete(':templateId/items/:itemId')
  @RequirePermissions('assembly.create')
  removeItem(
    @Param('templateId') templateId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.bomTemplatesService.removeItem(templateId, itemId);
  }

  // ===== Assembly Execution =====
  @Post(':id/execute')
  @RequirePermissions('assembly.execute')
  executeAssembly(
    @Param('id') id: string,
    @Body() body: ExecuteAssemblyDto,
    @Req() req: any,
  ) {
    return this.bomTemplatesService.executeAssembly(
      id,
      body.selectedSparePartIds,
      req.user.userId,
      body.notes,
    );
  }

  // ===== Assembly History =====
  @Get(':id/assembly-history')
  @RequirePermissions('assembly.view')
  getAssemblyHistory(@Param('id') id: string) {
    return this.bomTemplatesService.getAssemblyHistory(id);
  }
}
