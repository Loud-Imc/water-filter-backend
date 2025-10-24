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
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('Super Admin')
  getAll() {
    return this.usersService.findAll();
  }

  // ⬇️ SPECIFIC ROUTES FIRST - BEFORE :id
  @Get('my-subordinates')
  @Roles(
    'Super Admin',
    'Service Admin',
    'Sales Admin',
    'Service Manager',
    'Sales Manager',
    'Service Team Lead',
    'Sales Team Lead',
  )
  async getMySubordinates(@Req() req) {
    return this.usersService.getUsersByCreator(req.user.userId);
  }

  @Get('my-hierarchy')
  @Roles(
    'Super Admin',
    'Service Admin',
    'Sales Admin',
    'Service Manager',
    'Sales Manager',
    'Service Team Lead',
    'Sales Team Lead',
  )
  async getMyHierarchy(@Req() req) {
    return this.usersService.getUsersInHierarchy(req.user.userId);
  }

  @Get('assignable-roles')
  @Roles(
    'Super Admin',
    'Service Admin',
    'Sales Admin',
    'Service Manager',
    'Sales Manager',
    'Service Team Lead',
    'Sales Team Lead',
  )
  async getAssignableRoles(@Req() req) {
    return this.usersService.getAssignableRoles(req.user.userId);
  }
  // ⬆️ SPECIFIC ROUTES END

  // ⬇️ DYNAMIC ROUTE LAST
  @Get(':id')
  @Roles('Super Admin', 'Service Admin', 'Manager')
  getOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }
  // ⬆️ DYNAMIC ROUTE

  @Post()
  @Roles('Super Admin', 'Service Admin', 'Manager')
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Put(':id')
  @Roles('Super Admin', 'Service Admin', 'Manager')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles('Super Admin')
  delete(@Param('id') id: string) {
    return this.usersService.delete(id);
  }
}
