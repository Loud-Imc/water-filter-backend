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
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

// ✅ KEEP ROLE-BASED: Role management is admin-only
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Roles('Super Admin', 'Service Admin', 'Sales Admin') // Allow all admins
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @Roles('Super Admin', 'Service Admin', 'Sales Admin')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Post()
  @Roles('Super Admin') // Only Super Admin can create
  create(@Body() body: CreateRoleDto) {
    return this.rolesService.create(body);
  }

  @Put(':id')
  @Roles('Super Admin') // Only Super Admin can edit
  update(@Param('id') id: string, @Body() body: UpdateRoleDto) {
    return this.rolesService.update(id, body);
  }

  @Delete(':id')
  @Roles('Super Admin') // Only Super Admin can delete
  remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }
}
