import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { TechniciansService } from './technicians.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('technicians')
export class TechniciansController {
  constructor(private techniciansService: TechniciansService) {}

  @Get('my-tasks')
  @Roles('Technician')
  getMyTasks(@Req() req) {
    return this.techniciansService.getMyTasks(req.user.userId);
  }

  @Get('task-history')
  @Roles('Technician')
  getTaskHistory(@Req() req) {
    return this.techniciansService.getTaskHistory(req.user.userId);
  }

  @Get('tasks/:id')
  @Roles('Technician')
  getTaskDetails(@Req() req, @Param('id') requestId: string) {
    return this.techniciansService.getTaskDetails(req.user.userId, requestId);
  }

  @Get('my-stats')
  @Roles('Technician')
  getMyStats(@Req() req) {
    return this.techniciansService.getMyStats(req.user.userId);
  }
}
