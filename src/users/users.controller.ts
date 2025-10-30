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

// ✅ Apply all guards globally
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ✅ FIXED: Remove @Roles, use only @RequirePermissions
  @Get()
  @RequirePermissions('users.view')
  getAll() {
    return this.usersService.findAll();
  }

  // ✅ FIXED: Only permission check
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

  // ✅ FIXED: Only permission check
  @Get('my-subordinates')
  @RequirePermissions('users.view')
  getMySubordinates(@Req() req) {
    return this.usersService.getUsersByCreator(req.user.userId);
  }

  // ✅ FIXED: Only permission check
  @Get('my-hierarchy')
  @RequirePermissions('users.view')
  getMyHierarchy(@Req() req) {
    return this.usersService.getUsersInHierarchy(req.user.userId);
  }

  // ✅ FIXED: Only permission check
  @Get('assignable-roles')
  @RequirePermissions('users.view')
  getAssignableRoles(@Req() req) {
    return this.usersService.getAssignableRoles(req.user.userId);
  }

  // ✅ FIXED: Only permission check
  @Get('meta/available-permissions')
  @RequirePermissions('users.edit')
  getAvailablePermissions() {
    return this.usersService.getAvailablePermissions();
  }

  // ✅ NEW: Get my own permissions (NO RESTRICTIONS - everyone can see their own)
  @Get('me/permissions')
  getMyPermissions(@Req() req) {
    return this.usersService.getUserPermissions(req.user.userId);
  }

  // ✅ FIXED: Only permission check (for admins viewing other users)
  @Get(':id/permissions')
  @RequirePermissions('users.edit')
  getUserPermissions(@Param('id') id: string) {
    return this.usersService.getUserPermissions(id);
  }

  // ✅ FIXED: Only permission check
  @Get(':id')
  @RequirePermissions('users.view')
  getOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  // ✅ FIXED: Only permission check
  @Post()
  @RequirePermissions('users.create')
  create(@Body() dto: CreateUserDto, @Req() req) {
    return this.usersService.create({
      ...dto,
      createdById: req.user.userId,
    });
  }

  // ✅ FIXED: Only permission check
  @Put(':id')
  @RequirePermissions('users.edit')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  // ✅ FIXED: Only permission check
  @Put(':id/permissions')
  @RequirePermissions('users.edit')
  updateUserPermissions(
    @Param('id') id: string,
    @Body() dto: { add?: string[]; remove?: string[] },
  ) {
    return this.usersService.updateUserPermissions(id, dto);
  }

  // ✅ FIXED: Only permission check
  @Delete(':id')
  @RequirePermissions('users.delete')
  delete(@Param('id') id: string) {
    return this.usersService.delete(id);
  }
}
