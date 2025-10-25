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
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('service-requests')
export class ServiceRequestsController {
  constructor(private serviceRequestsService: ServiceRequestsService) {}

  @Post()
  @Roles(
    'Super Admin',
    'Service Admin',
    'Sales Admin',
    'Service Manager',
    'Sales Manager',
    'Service Team Lead',
    'Sales Team Lead',
    'Technician',
    'Salesman',
  )
  create(@Body() dto: CreateServiceRequestDto) {
    return this.serviceRequestsService.create(dto);
  }

  @Get()
  @Roles(
    'Super Admin',
    'Service Admin',
    'Sales Admin',
    'Service Manager',
    'Sales Manager',
  )
  findAll() {
    return this.serviceRequestsService.findAll();
  }

  @Get(':id')
  @Roles(
    'Super Admin',
    'Service Admin',
    'Sales Admin',
    'Service Manager',
    'Sales Manager',
    'Technician',
  )
  findOne(@Param('id') id: string) {
    return this.serviceRequestsService.findOne(id);
  }

  @Get('dashboard/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  getDashboardStats(@Req() req: any) {
    const userId = req.user.userId;
    const userRole = req.user.roleName;
    return this.serviceRequestsService.getDashboardStats(userId, userRole);
  }

  @Patch(':id')
  @Roles('Super Admin', 'Service Admin', 'Service Manager')
  update(@Param('id') id: string, @Body() dto: UpdateServiceRequestDto) {
    return this.serviceRequestsService.update(id, dto);
  }

  @Patch(':id/acknowledge')
  @Roles('Super Admin', 'Service Admin', 'Service Manager')
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

  @Post(':id/sales-approve')
  @Roles('Super Admin', 'Sales Admin')
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

  @Post(':id/service-approve')
  @Roles('Super Admin', 'Service Admin', 'Service Manager', 'Service Team Lead')
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

  @Post(':id/reject')
  @Roles(
    'Super Admin',
    'Service Admin',
    'Sales Admin',
    'Service Manager',
    'Service Team Lead',
  )
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

  @Post(':id/auto-assign')
  @Roles('Super Admin', 'Service Admin', 'Service Manager')
  autoAssign(@Param('id') id: string) {
    return this.serviceRequestsService.autoAssignTechnician(id);
  }

  @Post(':id/manual-assign')
  @Roles('Super Admin', 'Service Admin', 'Service Manager')
  manualAssign(
    @Param('id') id: string,
    @Body('technicianId') technicianId: string,
  ) {
    return this.serviceRequestsService.manualAssignTechnician(id, technicianId);
  }
}
