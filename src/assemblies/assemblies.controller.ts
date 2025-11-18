import {
  Controller,
  Get,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AssembliesService } from './assemblies.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('assemblies')
export class AssembliesController {
  constructor(private assembliesService: AssembliesService) {}

  @Get()
  @RequirePermissions('assembly.view')
  findAll(@Query() query: any) {
    return this.assembliesService.findAll({
      productId: query.productId,
      bomTemplateId: query.bomTemplateId,
      assembledBy: query.assembledBy,
      startDate: query.startDate,
      endDate: query.endDate,
      limit: query.limit ? parseInt(query.limit) : undefined,
    });
  }

  @Get('stats')
  @RequirePermissions('assembly.view')
  getStats(@Query() query: any) {
    return this.assembliesService.getStats({
      startDate: query.startDate,
      endDate: query.endDate,
    });
  }

  @Get('by-product')
  @RequirePermissions('assembly.view')
  getByProduct(@Query('productId') productId: string) {
    return this.assembliesService.getByProduct(productId);
  }

  @Get('by-assembler')
  @RequirePermissions('assembly.view')
  getByAssembler(@Query('userId') userId: string) {
    return this.assembliesService.getByAssembler(userId);
  }

  @Get('recent')
  @RequirePermissions('assembly.view')
  getRecent(@Query('limit') limit?: string) {
    return this.assembliesService.getRecent(limit ? parseInt(limit) : 10);
  }

  @Get(':id')
  @RequirePermissions('assembly.view')
  findOne(@Param('id') id: string) {
    return this.assembliesService.findOne(id);
  }

  @Get(':id/cost-breakdown')
  @RequirePermissions('assembly.view')
  getCostBreakdown(@Param('id') id: string) {
    return this.assembliesService.getCostBreakdown(id);
  }
}
