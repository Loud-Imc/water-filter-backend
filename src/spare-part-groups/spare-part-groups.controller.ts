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
import { SparePartGroupsService } from './spare-part-groups.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CreateSparePartGroupDto } from './dto/create-spare-part-group.dto';
import { UpdateSparePartGroupDto } from './dto/update-spare-part-group.dto';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('spare-part-groups')
export class SparePartGroupsController {
  constructor(private groupsService: SparePartGroupsService) {}

  @Post()
  @RequirePermissions('groups.manage')
  create(@Body() body: CreateSparePartGroupDto) {
    return this.groupsService.create(body);
  }

  @Get()
  @RequirePermissions('groups.view')
  findAll(@Query('includeInactive') includeInactive?: string) {
    const showInactive = includeInactive === 'true';
    return this.groupsService.findAll(showInactive);
  }

  @Get(':id')
  @RequirePermissions('groups.view')
  findOne(@Param('id') id: string) {
    return this.groupsService.findOne(id);
  }

  @Get(':id/spare-parts')
  @RequirePermissions('groups.view')
  getSparePartsByGroup(@Param('id') id: string) {
    return this.groupsService.getSparePartsByGroup(id);
  }

  @Put(':id')
  @RequirePermissions('groups.manage')
  update(@Param('id') id: string, @Body() body: UpdateSparePartGroupDto) {
    return this.groupsService.update(id, body);
  }

  @Delete(':id')
  @RequirePermissions('groups.manage')
  delete(@Param('id') id: string) {
    return this.groupsService.delete(id);
  }

  @Put(':id/toggle-status')
  @RequirePermissions('groups.manage')
  toggleStatus(@Param('id') id: string) {
    return this.groupsService.toggleStatus(id);
  }
}
