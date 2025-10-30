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
import { RegionsService } from './regions.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';

// ✅ UPDATED: Added PermissionsGuard
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('regions')
export class RegionsController {
  constructor(private regionsService: RegionsService) {}

  // ✅ UPDATED: Permission-based
  @Get()
  // @RequirePermissions('regions.view')
  findAll() {
    return this.regionsService.findAll();
  }

  // ✅ UPDATED: Permission-based
  @Get('search')
  @RequirePermissions('regions.view')
  searchRegions(
    @Query('query') query: string,
    @Query('limit') limit: string = '20',
  ) {
    return this.regionsService.searchRegions(query, parseInt(limit));
  }

  // ✅ UPDATED: Permission-based
  @Get(':id')
  @RequirePermissions('regions.view')
  findOne(@Param('id') id: string) {
    return this.regionsService.findOne(id);
  }

  // ✅ UPDATED: Permission-based
  @Post()
  @RequirePermissions('regions.create')
  create(@Body() body: CreateRegionDto) {
    return this.regionsService.create(body);
  }

  // ✅ UPDATED: Permission-based
  @Put(':id')
  @RequirePermissions('regions.create') // or 'regions.edit' if you add it
  update(@Param('id') id: string, @Body() body: UpdateRegionDto) {
    return this.regionsService.update(id, body);
  }

  // ✅ UPDATED: Permission-based
  @Delete(':id')
  @RequirePermissions('regions.create') // or 'regions.delete' if you add it
  remove(@Param('id') id: string) {
    return this.regionsService.remove(id);
  }
}
