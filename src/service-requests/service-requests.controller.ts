import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ServiceRequestsService } from './service-requests.service';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { UpdateServiceRequestDto } from './dto/update-service-request.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';

// ✅ UPDATED: Added PermissionsGuard
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('service-requests')
export class ServiceRequestsController {
  constructor(private serviceRequestsService: ServiceRequestsService) {}

  // ✅ UPDATED: Permission-based
  @Post()
  @RequirePermissions('services.create')
  create(@Body() dto: CreateServiceRequestDto) {
    return this.serviceRequestsService.create(dto);
  }

  // ✅ UPDATED: Permission-based
  @Get()
  @RequirePermissions('services.view')
  findAll() {
    return this.serviceRequestsService.findAll();
  }

  // ✅ UPDATED: Permission-based
  @Get(':id')
  @RequirePermissions('services.view')
  findOne(@Param('id') id: string) {

    console.log("Hello from service-requests.controller.ts");
    return this.serviceRequestsService.findOne(id);
  }

  // ✅ Dashboard stats - anyone authenticated can see their own stats
  @Get('dashboard/stats')
  getDashboardStats(@Req() req: any) {
    const userId = req.user.userId;
    const userRole = req.user.roleName;
    return this.serviceRequestsService.getDashboardStats(userId, userRole);
  }

  // ✅ UPDATED: Permission-based
  @Patch(':id')
  @RequirePermissions('services.edit')
  update(@Param('id') id: string, @Body() dto: UpdateServiceRequestDto) {
    return this.serviceRequestsService.update(id, dto);
  }

  // ✅ UPDATED: Permission-based
  @Patch(':id/acknowledge')
  @RequirePermissions('services.edit')
  async acknowledgeCompletion(
    @Param('id') id: string,
    @Req() req: Request & { user: { userId: string } },
    @Body() body: { comments?: string },
  ) {
    return this.serviceRequestsService.acknowledgeCompletion(
      id,
      req.user.userId,
      body.comments,
    );
  }

  // ✅ UPDATED: Permission-based
  @Post(':id/sales-approve')
  @RequirePermissions('services.approve')
  salesApprove(
    @Param('id') id: string,
    @Req() req,
    @Body('comments') comments?: string,
  ) {
    return this.serviceRequestsService.salesApprove(
      id,
      req.user.userId,
      comments,
    );
  }

  // ✅ UPDATED: Permission-based
  @Post(':id/service-approve')
  @RequirePermissions('services.approve')
  serviceApprove(
    @Param('id') id: string,
    @Req() req,
    @Body('comments') comments?: string,
  ) {
    return this.serviceRequestsService.serviceApprove(
      id,
      req.user.userId,
      comments,
    );
  }

  // ✅ UPDATED: Permission-based
  @Post(':id/reject')
  @RequirePermissions('services.approve')
  reject(
    @Param('id') id: string,
    @Req() req,
    @Body('comments') comments: string,
  ) {
    return this.serviceRequestsService.rejectRequest(
      id,
      req.user.userId,
      comments,
    );
  }

  // ✅ UPDATED: Permission-based
  @Post(':id/auto-assign')
  @RequirePermissions('services.assign')
  autoAssign(@Param('id') id: string) {
    return this.serviceRequestsService.autoAssignTechnician(id);
  }

  // ✅ UPDATED: Permission-based
  @Post(':id/manual-assign')
  @RequirePermissions('services.assign')
  manualAssign(
    @Param('id') id: string,
    @Body('technicianId') technicianId: string,
  ) {
    return this.serviceRequestsService.manualAssignTechnician(id, technicianId);
  }

  // ✅ ADD THESE ENDPOINTS:

  @Post(':id/reassign-technician')
  @RequirePermissions('services.assign')
  async reassignTechnician(
    @Param('id') id: string,
    @Req() req,
    @Body() body: { newTechnicianId: string; reason: string },
  ) {
    return this.serviceRequestsService.reassignTechnician(
      id,
      body.newTechnicianId,
      req.user.userId,
      body.reason,
    );
  }

  @Get(':id/reassignment-history')
  @RequirePermissions('services.view')
  async getReassignmentHistory(@Param('id') id: string) {
    return this.serviceRequestsService.getReassignmentHistory(id);
  }

  // ✅ ADD THESE ENDPOINTS:

  @Post(':id/used-products')
  @RequirePermissions('services.edit')
  async addUsedProducts(
    @Param('id') requestId: string,
    @Req() req,
    @Body()
    body: {
      usedProducts: Array<{
        productId: string;
        quantityUsed: number;
        notes?: string;
      }>;
    },
  ) {
    return this.serviceRequestsService.addUsedProducts(
      requestId,
      req.user.userId,
      body.usedProducts,
    );
  }

  @Get(':id/used-products')
  @RequirePermissions('services.view')
  async getUsedProducts(@Param('id') requestId: string) {
    return this.serviceRequestsService.getUsedProducts(requestId);
  }
}
