import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { getDefaultPermissionsForRole } from '../constants/permissions';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions('users.view')
  getAll() {
    return this.usersService.findAll();
  }

  @Get('technicians/search')
  @RequirePermissions('services.assign')
  searchTechnicians(
    @Query('query') query: string,
    @Query('regionId') regionId?: string,
    @Query('limit') limit: string = '20',
  ) {
    return this.usersService.searchTechnicians(
      query,
      regionId,
      parseInt(limit),
    );
  }

  @Get('my-subordinates')
  @RequirePermissions('users.view')
  getMySubordinates(@Req() req) {
    return this.usersService.getUsersByCreator(req.user.userId);
  }

  @Get('my-hierarchy')
  @RequirePermissions('users.view')
  getMyHierarchy(@Req() req) {
    return this.usersService.getUsersInHierarchy(req.user.userId);
  }

  @Get('assignable-roles')
  @RequirePermissions('users.view')
  getAssignableRoles(@Req() req) {
    return this.usersService.getAssignableRoles(req.user.userId);
  }

  @Get('meta/available-permissions')
  @RequirePermissions('users.edit')
  getAvailablePermissions() {
    return this.usersService.getAvailablePermissions();
  }

  // Get my own permissions (NO RESTRICTIONS - everyone can see their own)
  @Get('me/permissions')
  getMyPermissions(@Req() req) {
    return this.usersService.getUserPermissions(req.user.userId);
  }

  // ✅ Get default permissions for a role
  @Get('role/:roleName/default-permissions')
  @RequirePermissions('users.view')
  getDefaultPermissions(@Param('roleName') roleName: string) {
    const defaultPermissions = getDefaultPermissionsForRole(roleName);
    return {
      roleName,
      defaultPermissions,
    };
  }

  @Get(':id/permissions')
  @RequirePermissions('users.edit')
  getUserPermissions(@Param('id') id: string) {
    return this.usersService.getUserPermissions(id);
  }

  @Get(':id')
  @RequirePermissions('users.view')
  getOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @RequirePermissions('users.create')
  create(@Body() dto: CreateUserDto, @Req() req) {
    return this.usersService.create({
      ...dto,
      createdById: req.user.userId,
    });
  }

  @Put(':id')
  @RequirePermissions('users.edit')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Put(':id/permissions')
  @RequirePermissions('users.edit')
  updateUserPermissions(
    @Param('id') id: string,
    @Body() dto: { add?: string[]; remove?: string[] },
  ) {
    return this.usersService.updateUserPermissions(id, dto);
  }

  @Put(':id/reset-password')
  @RequirePermissions('users.edit')
  resetUserPassword(
    @Param('id') id: string,
    @Body() body: { newPassword: string },
  ) {
    return this.usersService.resetUserPassword(id, body.newPassword);
  }

  @Delete(':id')
  @RequirePermissions('users.delete')
  delete(@Param('id') id: string) {
    return this.usersService.delete(id);
  }
}
