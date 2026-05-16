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
  Request,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
 import { UpdateLocationDto } from './dto/update-location.dto';
import { CreateMergeRequestDto, ProcessMergeRequestDto } from './dto/merge-customer.dto';

// ✅ UPDATED: Added PermissionsGuard
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('customers')
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  // ✅ UPDATED: Permission-based instead of role-based
  @Get()
  @RequirePermissions('customers.view')
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('regionId') regionId?: string,
  ) {
    return this.customersService.findAll(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
      regionId,
    );
  }

  // ✅ NEW: Search doesn't need special permissions (uses customers.view)
  @Get('search')
  @RequirePermissions('customers.view')
  searchCustomers(
    @Query('query') query: string,
    @Query('regionId') regionId?: string,
    @Query('limit') limit: string = '20',
  ) {
    return this.customersService.searchCustomers(
      query,
      regionId,
      parseInt(limit),
    );
  }

  // ✅ UPDATED: Permission-based
  @Get(':id/history')
  @RequirePermissions('customers.view')
  getCustomerHistory(@Param('id') id: string) {
    return this.customersService.getCustomerHistory(id);
  }

  // ✅ UPDATED: Permission-based
  @Get(':id')
  @RequirePermissions('customers.view')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  // ✅ UPDATED: Permission-based
  @Post()
  @RequirePermissions('customers.create')
  create(@Body() body: CreateCustomerDto) {
    return this.customersService.create(body);
  }

  // ✅ UPDATED: Permission-based
  @Put('/update-location/:id')
  @RequirePermissions('customers.edit')
  updateLocation(@Param('id') id: string, @Body() body: UpdateLocationDto) {
    console.log('dto: location: ', body);
    return this.customersService.update(id, body);
  }

  // Add this method to CustomersController
  @Get('stats')
  @RequirePermissions('customers.view')
  getStats() {
    return this.customersService.getCustomerStats();
  }

  // Add this method to get customers by region
  @Get('by-region/:regionId')
  @RequirePermissions('customers.view')
  getByRegion(@Param('regionId') regionId: string) {
    return this.customersService.getCustomersByRegion(regionId);
  }

  // ✅ UPDATED: Permission-based
  @Put(':id')
  @RequirePermissions('customers.edit')
  update(@Param('id') id: string, @Body() body: UpdateCustomerDto) {
    return this.customersService.update(id, body);
  }

  // ✅ UPDATED: Permission-based
  @Delete(':id')
  @RequirePermissions('customers.delete')
  remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }

  // ============================================
  // CUSTOMER MERGE ENDPOINTS
  // ============================================

  @Post('merge-request')
  @RequirePermissions('customers.edit')
  createMergeRequest(@Request() req, @Body() body: CreateMergeRequestDto) {
    return this.customersService.createMergeRequest(
      req.user.userId,
      body.sourceId,
      body.targetId,
      body.reason,
    );
  }

  @Get('merge-requests/list')
  @RequirePermissions('customers.edit')
  getMergeRequests(@Query('status') status?: string) {
    return this.customersService.getMergeRequests(status);
  }

  @Post('merge-requests/:id/process')
  @RequirePermissions('customers.delete')
  processMergeRequest(
    @Param('id') id: string,
    @Body() body: ProcessMergeRequestDto,
  ) {
    return this.customersService.processMergeRequest(
      id,
      body.status,
      body.adminNotes,
    );
  }
}
